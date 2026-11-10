// File location: /api/sync-zoom-attendance.ts
// Handles Zoom Webinar/Meeting live participant sync and attendee CSV parsing into Supabase
// Supports multi-batch uploads for the same date & webinar ID (e.g. Batch 1, Batch 2, Batch 3)

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

interface BatchFileInput {
  name: string;
  content: string;
  batchSlot?: string | null;
  sessionDurationMinutes?: number;
  sessionDate?: string;
  webinarId?: string;
}

interface SyncRequest {
  webinarId?: string;
  sessionDurationMinutes?: number;
  targetBatch?: string;
  classType?: string;
  batchSlot?: string | null;
  sessionDate?: string;
  csvContent?: string;
  files?: BatchFileInput[];
  markAbsentForUnjoined?: boolean;
}

interface RawParticipant {
  name: string;
  email: string;
  joinTime?: string;
  leaveTime?: string;
  durationSeconds: number;
}

interface ParsedFileResult {
  fileName: string;
  webinarId?: string;
  topic?: string;
  actualDurationMinutes?: number;
  startTime?: string;
  detectedSlot: string | null;
  participants: RawParticipant[];
  absentRegistrants: Array<{ name: string; email: string }>;
}

let cachedZoomToken: { token: string; expiresAt: number } | null = null;

async function getZoomAccessToken(): Promise<string> {
  if (cachedZoomToken && Date.now() < cachedZoomToken.expiresAt) {
    return cachedZoomToken.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Zoom API credentials. Please set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET in environment variables."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain Zoom access token (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedZoomToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return cachedZoomToken.token;
}

function encodeZoomUuid(uuid: string): string {
  if (uuid.startsWith('/') || uuid.includes('//')) {
    return encodeURIComponent(encodeURIComponent(uuid));
  }
  return encodeURIComponent(uuid);
}

function parseFlexibleDate(input?: string | null): Date | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  if (!clean || ['na', 'n/a', '--', '-', 'null', 'undefined'].includes(clean.toLowerCase())) return null;

  // 1. Direct standard parse
  const direct = new Date(clean);
  if (!isNaN(direct.getTime())) {
    const yr = direct.getFullYear();
    if (yr >= 1990 && yr <= 2100) return direct;
  }

  // 2. Match DD/MM/YYYY or MM/DD/YYYY with optional time
  // e.g. "24/10/2026 16:30:00", "24/10/2026 04:30:00 PM", "11/02/2026", "02/11/2026 04:30 PM"
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    let hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const ampm = dmyMatch[7] ? dmyMatch[7].toUpperCase() : null;

    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    let day = p1;
    let month = p2;
    if (p1 > 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      day = p2;
      month = p1;
    } else {
      // Default to DD/MM/YYYY for British / Sri Lankan convention
      day = p1;
      month = p2;
    }

    const d = new Date(Date.UTC(year, month - 1, day, hour, min, sec));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Match YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    let hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const sec = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const ampm = ymdMatch[7] ? ymdMatch[7].toUpperCase() : null;

    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    const d = new Date(Date.UTC(year, month - 1, day, hour, min, sec));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function safeToISO(input?: string | null, fallback: string | null = null): string | null {
  return toExactStoredTimestamp(input) || fallback;
}

// Convert any Zoom CSV or Zoom API timestamp to exact stored local timestamp (YYYY-MM-DDTHH:MM:SS+00:00)
// Preserves the literal class time without timezone shifting
function toExactStoredTimestamp(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  if (!clean || ['na', 'n/a', '--', '-', 'null', 'undefined'].includes(clean.toLowerCase())) return null;

  // 1. If ISO UTC string from Zoom API (e.g. '2026-10-28T11:02:41Z' or '2026-10-28 11:02:41+00')
  const isUtcIso = clean.endsWith('Z') || clean.includes('+00') || clean.includes('+00:00');
  if (isUtcIso) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      // Add 5 hours 30 mins (330 mins) to convert UTC to Sri Lanka local time
      const sltTime = new Date(d.getTime() + 330 * 60 * 1000);
      const yr = sltTime.getUTCFullYear();
      const mo = String(sltTime.getUTCMonth() + 1).padStart(2, '0');
      const da = String(sltTime.getUTCDate()).padStart(2, '0');
      const ho = String(sltTime.getUTCHours()).padStart(2, '0');
      const mi = String(sltTime.getUTCMinutes()).padStart(2, '0');
      const se = String(sltTime.getUTCSeconds()).padStart(2, '0');
      return `${yr}-${mo}-${da}T${ho}:${mi}:${se}+00:00`;
    }
  }

  // 2. Parse from CSV format: DD/MM/YYYY or MM/DD/YYYY with AM/PM or 24h
  // e.g. '10/30/2026 08:14:02 PM', '10/30/2026 20:14:02', '30/10/2026 20:14:02'
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const yr = parseInt(dmyMatch[3], 10);
    let ho = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const mi = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const se = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const ampm = dmyMatch[7] ? dmyMatch[7].toUpperCase() : null;

    if (ampm === 'PM' && ho < 12) ho += 12;
    if (ampm === 'AM' && ho === 12) ho = 0;

    let da = p2;
    let mo = p1;
    if (p1 > 12) {
      // Must be DD/MM/YYYY
      da = p1;
      mo = p2;
    } else {
      // Zoom CSV exports are standard MM/DD/YYYY
      mo = p1;
      da = p2;
    }

    const moStr = String(mo).padStart(2, '0');
    const daStr = String(da).padStart(2, '0');
    const hoStr = String(ho).padStart(2, '0');
    const miStr = String(mi).padStart(2, '0');
    const seStr = String(se).padStart(2, '0');
    return `${yr}-${moStr}-${daStr}T${hoStr}:${miStr}:${seStr}+00:00`;
  }

  // 3. Fallback direct ISO
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toISOString().replace('.000Z', '+00:00');
  }

  return null;
}

function safeToDateOnly(input?: string | null, fallback?: string): string {
  const defaultFallback = fallback || new Date().toISOString().split('T')[0];
  try {
    const exact = toExactStoredTimestamp(input);
    if (exact && exact.includes('T')) {
      return exact.split('T')[0];
    }
    const d = parseFlexibleDate(input);
    return d ? d.toISOString().split('T')[0] : defaultFallback;
  } catch {
    return defaultFallback;
  }
}

function detectBatchSlot(startTime?: string, fileName?: string, topic?: string): string | null {
  // 1. Direct filename / topic keyword check
  const combined = `${fileName || ''} ${topic || ''}`.toLowerCase();
  if (combined.includes('batch 1') || combined.includes('batch1') || combined.includes('b1') || combined.includes('4.30') || combined.includes('4:30')) {
    return 'Batch 1';
  }
  if (combined.includes('batch 2') || combined.includes('batch2') || combined.includes('b2') || combined.includes('8.00') || combined.includes('8:00')) {
    return 'Batch 2';
  }
  if (combined.includes('batch 3') || combined.includes('batch3') || combined.includes('b3') || combined.includes('9.30') || combined.includes('9:30')) {
    return 'Batch 3';
  }

  // 2. Exact [Actual Start Time] parsing
  if (startTime) {
    const clean = startTime.replace(/^["'\s]+|["'\s]+$/g, '').trim();

    // Check if ISO UTC (e.g. 2026-10-28T11:02:41Z or 2026-10-28 11:02:41+00)
    const isUtc = clean.endsWith('Z') || clean.includes('+00') || clean.includes('+00:00');
    
    let hour = -1;
    let minute = 0;

    // A. Match 12-hour format with AM/PM (e.g. '10/30/2026 08:07:54 PM', '4:30 PM')
    const ampmMatch = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      minute = parseInt(ampmMatch[2], 10);
      const ampm = ampmMatch[4].toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      hour = h;
    } else {
      // B. Match 24-hour time (e.g. '10/30/2026 20:07', '2026-10-28T11:02:41Z', '16:30:00')
      const time24Match = clean.match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (time24Match) {
        hour = parseInt(time24Match[1], 10);
        minute = parseInt(time24Match[2], 10);
      }
    }

    if (hour >= 0) {
      let totalMinutes = hour * 60 + minute;
      // If UTC (from Zoom API), convert to Sri Lanka Time (UTC + 5:30 = +330 mins)
      if (isUtc) {
        totalMinutes = (totalMinutes + 330) % 1440;
      }

      // Slot 1: ~4:30 PM (16:30) -> 15:30 to 18:30 (900 to 1110 min)
      if (totalMinutes >= 900 && totalMinutes <= 1110) {
        return 'Batch 1';
      }
      // Slot 2: ~8:00 PM (20:00) -> 19:00 to 20:59 (1140 to 1259 min)
      if (totalMinutes >= 1140 && totalMinutes <= 1259) {
        return 'Batch 2';
      }
      // Slot 3: ~9:30 PM (21:30) -> 21:00 to 23:59 (1260 to 1439 min)
      if (totalMinutes >= 1260 && totalMinutes <= 1439) {
        return 'Batch 3';
      }
    }
  }

  return null;
}

function parseCSVAttendees(csvText: string): {
  webinarId?: string;
  topic?: string;
  actualDurationMinutes?: number;
  startTime?: string;
  participants: RawParticipant[];
  absentRegistrants: Array<{ name: string; email: string }>;
} {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let webinarId: string | undefined;
  let topic: string | undefined;
  let actualDurationMinutes: number | undefined;
  let startTime: string | undefined;
  const participants: RawParticipant[] = [];
  const absentRegistrants: Array<{ name: string; email: string }> = [];

  // Parse header metadata
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('topic') && line.toLowerCase().includes('webinar id')) {
      const headerCols = splitCSVRow(line);
      const nextLine = lines[i + 1];
      if (nextLine) {
        const valCols = splitCSVRow(nextLine);
        const topicIdx = headerCols.findIndex(c => c.toLowerCase().includes('topic'));
        const webIdIdx = headerCols.findIndex(c => c.toLowerCase().includes('webinar id'));
        const durIdx = headerCols.findIndex(c => c.toLowerCase().includes('duration'));
        const startIdx = headerCols.findIndex(c => c.toLowerCase().includes('start time'));

        if (topicIdx >= 0 && valCols[topicIdx]) topic = valCols[topicIdx].trim();
        if (webIdIdx >= 0 && valCols[webIdIdx]) webinarId = valCols[webIdIdx].replace(/\s+/g, '').trim();
        if (durIdx >= 0 && valCols[durIdx]) {
          const num = parseInt(valCols[durIdx], 10);
          if (!isNaN(num) && num > 0) actualDurationMinutes = num;
        }
        if (startIdx >= 0 && valCols[startIdx]) startTime = valCols[startIdx].trim();
      }
      break;
    }
  }

  // Find attendee details section
  let attendeeHeaderIdx = -1;
  let isAttendeeSection = false;
  const headerMap: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('attendee details')) {
      isAttendeeSection = true;
      continue;
    }

    if (isAttendeeSection && attendeeHeaderIdx === -1) {
      if (line.toLowerCase().includes('user name') || line.toLowerCase().includes('email') || line.toLowerCase().includes('attended')) {
        attendeeHeaderIdx = i;
        const cols = splitCSVRow(line);
        cols.forEach((col, idx) => {
          headerMap[col.toLowerCase().trim()] = idx;
        });
        continue;
      }
    }

    if (attendeeHeaderIdx !== -1 && i > attendeeHeaderIdx) {
      if (line.toLowerCase().includes('other details') || line.toLowerCase().includes('host details')) {
        break;
      }

      const cols = splitCSVRow(line);
      if (cols.length < 3) continue;

      const attendedVal = (cols[headerMap['attended'] ?? 0] || '').toLowerCase().trim();
      const userName = cols[headerMap['user name (original name)'] ?? headerMap['user name'] ?? 1] || '';
      const firstName = cols[headerMap['first name'] ?? 2] || '';
      const lastName = cols[headerMap['last name'] ?? 3] || '';
      const email = cols[headerMap['email'] ?? 4] || '';
      const joinTime = cols[headerMap['join time'] ?? 7] || undefined;
      const leaveTime = cols[headerMap['leave time'] ?? 8] || undefined;
      const timeInSessionMin = cols[headerMap['time in session (minutes)'] ?? 9] || '0';

      const durMins = parseFloat(timeInSessionMin) || 0;
      const effectiveName = [firstName, lastName].filter(Boolean).join(' ') || userName;
      const finalName = effectiveName.trim() || userName.trim();
      const finalEmail = email.trim().toLowerCase();

      if (!finalName && !finalEmail) continue;

      // If Attended == No or zero duration with no join time, record as absent registrant
      if (attendedVal === 'no' || (!joinTime && durMins === 0)) {
        absentRegistrants.push({
          name: finalName,
          email: finalEmail
        });
      } else {
        participants.push({
          name: finalName,
          email: finalEmail,
          joinTime,
          leaveTime,
          durationSeconds: Math.round(durMins * 60),
        });
      }
    }
  }

  return { webinarId, topic, actualDurationMinutes, startTime, participants, absentRegistrants };
}

function splitCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"' || char === "'") {
      if (inQuotes && row[i + 1] === char) {
        current += char;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const {
    webinarId: rawWebinarId,
    sessionDurationMinutes: overrideDuration,
    targetBatch: overrideBatch,
    classType: overrideClassType,
    batchSlot: overrideBatchSlot,
    sessionDate: overrideDate,
    csvContent,
    files: incomingFiles,
    markAbsentForUnjoined = true,
  } = (req.body || {}) as SyncRequest;

  let cleanWebinarId = (rawWebinarId || '').replace(/\D/g, '');

  try {
    let sessionTitle = '';
    let sessionDate = overrideDate ? safeToDateOnly(overrideDate) : new Date().toISOString().split('T')[0];
    const detectedDurationMinutes = overrideDuration || 90;

    // Normalize incoming input into an array of parsed batches
    const parsedBatches: ParsedFileResult[] = [];
    const liveZoomRegistrants: Array<{ name: string; email: string }> = [];
    let debugRegistrantsError = '';

    // Case 1: Multi-file CSV Uploads
    if (incomingFiles && incomingFiles.length > 0) {
      incomingFiles.forEach((file, idx) => {
        const parsed = parseCSVAttendees(file.content);
        if (parsed.webinarId && !cleanWebinarId) {
          cleanWebinarId = parsed.webinarId.replace(/\D/g, '');
        }
        if (parsed.topic && !sessionTitle) {
          sessionTitle = parsed.topic;
        }
        if (parsed.startTime) {
          sessionDate = safeToDateOnly(parsed.startTime, sessionDate);
        }

        const slot = file.batchSlot || detectBatchSlot(parsed.startTime, file.name, parsed.topic) || `Batch ${idx + 1}`;
        parsedBatches.push({
          fileName: file.name,
          webinarId: file.webinarId || parsed.webinarId,
          topic: parsed.topic,
          actualDurationMinutes: file.sessionDurationMinutes || parsed.actualDurationMinutes || detectedDurationMinutes,
          startTime: parsed.startTime,
          detectedSlot: slot,
          participants: parsed.participants,
          absentRegistrants: parsed.absentRegistrants || [],
        });
      });
    }
    // Case 2: Single CSV Upload
    else if (csvContent && csvContent.trim()) {
      const parsed = parseCSVAttendees(csvContent);
      if (parsed.webinarId && !cleanWebinarId) {
        cleanWebinarId = parsed.webinarId.replace(/\D/g, '');
      }
      if (parsed.topic) sessionTitle = parsed.topic;
      if (parsed.startTime && !overrideDate) {
        sessionDate = safeToDateOnly(parsed.startTime, sessionDate);
      }

      const slot = overrideBatchSlot || detectBatchSlot(parsed.startTime, 'upload.csv', parsed.topic);
      parsedBatches.push({
        fileName: 'upload.csv',
        webinarId: parsed.webinarId,
        topic: parsed.topic,
        actualDurationMinutes: overrideDuration || parsed.actualDurationMinutes || detectedDurationMinutes,
        startTime: parsed.startTime,
        detectedSlot: slot,
        participants: parsed.participants,
        absentRegistrants: parsed.absentRegistrants || [],
      });
    }
    // Case 3: Live Zoom API Direct Sync
    else if (cleanWebinarId) {
      const token = await getZoomAccessToken();
      let apiDuration = overrideDuration || 90;
      let apiTopic = '';
      let apiStartTime = '';
      let isMeeting = false;

      // 1. Fetch metadata (Topic, Duration)
      try {
        const webinarRes = await fetch(`https://api.zoom.us/v2/webinars/${cleanWebinarId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (webinarRes.ok) {
          const webData = await webinarRes.json();
          apiTopic = webData.topic || '';
          if (webData.start_time) apiStartTime = webData.start_time;
          if (webData.duration && !overrideDuration) apiDuration = webData.duration;
          if (webData.start_time && !overrideDate) {
            sessionDate = safeToDateOnly(webData.start_time, sessionDate);
          }
        } else {
          isMeeting = true;
          const meetingRes = await fetch(`https://api.zoom.us/v2/meetings/${cleanWebinarId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (meetingRes.ok) {
            const meetingData = await meetingRes.json();
            apiTopic = meetingData.topic || '';
            if (meetingData.start_time) apiStartTime = meetingData.start_time;
            if (meetingData.duration && !overrideDuration) apiDuration = meetingData.duration;
            if (meetingData.start_time && !overrideDate) {
              sessionDate = safeToDateOnly(meetingData.start_time, sessionDate);
            }
          }
        }
      } catch (metaErr) {
        console.warn("Could not fetch webinar/meeting metadata directly:", metaErr);
      }

      // 2. Fetch past instances list to identify all sessions matching the requested sessionDate
      interface ZoomInstanceItem {
        uuid: string;
        start_time: string;
      }
      let allZoomInstances: ZoomInstanceItem[] = [];
      let matchingInstances: ZoomInstanceItem[] = [];

      try {
        const instancesEndpoint = isMeeting
          ? `https://api.zoom.us/v2/past_meetings/${cleanWebinarId}/instances`
          : `https://api.zoom.us/v2/past_webinars/${cleanWebinarId}/instances`;

        let instRes = await fetch(instancesEndpoint, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!instRes.ok && !isMeeting && instRes.status === 404) {
          isMeeting = true;
          instRes = await fetch(`https://api.zoom.us/v2/past_meetings/${cleanWebinarId}/instances`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }

        if (instRes.ok) {
          const instData = await instRes.json();
          allZoomInstances = instData.webinars || instData.meetings || [];
          
          if (overrideDate) {
            const targetDateStr = safeToDateOnly(overrideDate);
            matchingInstances = allZoomInstances.filter(inst => {
              const instDateStr = safeToDateOnly(inst.start_time);
              return instDateStr === targetDateStr;
            });
          } else {
            matchingInstances = allZoomInstances;
          }
        }
      } catch (instErr) {
        console.warn("Could not query past instances:", instErr);
      }

      // 3. Helper to fetch all participants for an ID or UUID (with pagination)
      const fetchParticipantsForTarget = async (idOrUuid: string, useMeeting: boolean): Promise<RawParticipant[]> => {
        const participants: RawParticipant[] = [];
        let nextPageToken = '';
        const encodedTarget = encodeZoomUuid(idOrUuid);

        do {
          const url: string = useMeeting
            ? `https://api.zoom.us/v2/report/meetings/${encodedTarget}/participants?page_size=300${nextPageToken ? `&next_page_token=${nextPageToken}` : ''}`
            : `https://api.zoom.us/v2/report/webinars/${encodedTarget}/participants?page_size=300${nextPageToken ? `&next_page_token=${nextPageToken}` : ''}`;

          let reportRes = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (!reportRes.ok && !useMeeting && reportRes.status === 404) {
            useMeeting = true;
            reportRes = await fetch(
              `https://api.zoom.us/v2/report/meetings/${encodedTarget}/participants?page_size=300`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
          }

          if (!reportRes.ok) {
            const errText = await reportRes.text();
            throw new Error(`Zoom Report API Error (${reportRes.status}): ${errText}`);
          }

          const reportData = await reportRes.json();
          const list = reportData.participants || [];

          for (const p of list) {
            participants.push({
              name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
              email: (p.user_email || '').toLowerCase().trim(),
              joinTime: p.join_time,
              leaveTime: p.leave_time,
              durationSeconds: Number(p.duration || 0),
            });
          }

          nextPageToken = reportData.next_page_token || '';
        } while (nextPageToken);

        return participants;
      };

      // Helper to fetch all registrants directly from Zoom API for unjoined student roll
      const fetchAllZoomRegistrants = async (id: string, useMeeting: boolean): Promise<Array<{ name: string; email: string }>> => {
        const registrants: Array<{ name: string; email: string }> = [];
        let nextPageToken = '';
        try {
          do {
            const url = useMeeting
              ? `https://api.zoom.us/v2/meetings/${encodeZoomUuid(id)}/registrants?page_size=300${nextPageToken ? `&next_page_token=${nextPageToken}` : ''}`
              : `https://api.zoom.us/v2/webinars/${encodeZoomUuid(id)}/registrants?page_size=300${nextPageToken ? `&next_page_token=${nextPageToken}` : ''}`;
            
            const regRes = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` }
            });

            console.log(`[Zoom Registrants Debug] URL: ${url}, status: ${regRes.status}`);
            if (!regRes.ok) {
              const errBody = await regRes.text();
              debugRegistrantsError = `URL: ${url} | Status: ${regRes.status} | Body: ${errBody}`;
              console.warn(`Zoom registrants fetch returned status ${regRes.status}: ${errBody}`);
              break;
            }

            const regData = await regRes.json();
            const list = regData.registrants || [];
            for (const r of list) {
              const name = `${r.first_name || ''} ${r.last_name || ''}`.trim();
              const email = (r.email || '').toLowerCase().trim();
              if (name || email) {
                registrants.push({ name, email });
              }
            }
            nextPageToken = regData.next_page_token || '';
          } while (nextPageToken);
        } catch (regErr) {
          console.warn("Could not fetch Zoom registrants via API:", regErr);
        }
        return registrants;
      };

      // Query registrants from Zoom
      try {
        const zoomRegs = await fetchAllZoomRegistrants(cleanWebinarId, isMeeting);
        liveZoomRegistrants.push(...zoomRegs);
      } catch (e) {
        console.warn("Failed fetching Zoom registrants:", e);
      }

      // 4. If matching instances were found for that date, process each one
      if (matchingInstances.length > 0) {
        // Sort chronologically by start_time
        matchingInstances.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        for (let idx = 0; idx < matchingInstances.length; idx++) {
          const inst = matchingInstances[idx];
          const participants = await fetchParticipantsForTarget(inst.uuid, isMeeting);
          
          let instanceDuration = apiDuration;
          try {
            const instDetailUrl = isMeeting
              ? `https://api.zoom.us/v2/past_meetings/${encodeZoomUuid(inst.uuid)}`
              : `https://api.zoom.us/v2/past_webinars/${encodeZoomUuid(inst.uuid)}`;
            const instDetailRes = await fetch(instDetailUrl, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (instDetailRes.ok) {
              const instDetail = await instDetailRes.json();
              if (instDetail.duration && instDetail.duration > 0) {
                instanceDuration = instDetail.duration;
              }
            }
          } catch (detailErr) {
            console.warn("Could not query past instance detail:", detailErr);
          }

          // If instanceDuration is still default or absent, derive from actual participant duration
          if ((!instanceDuration || instanceDuration === 90) && participants.length > 0) {
            const maxSeconds = Math.max(...participants.map(p => p.durationSeconds || 0));
            if (maxSeconds > 0) {
              const derivedMinutes = Math.round(maxSeconds / 60);
              if (derivedMinutes >= 15) {
                instanceDuration = derivedMinutes;
              }
            }
          }

          const slot = overrideBatchSlot 
            || detectBatchSlot(inst.start_time, '', apiTopic) 
            || (matchingInstances.length > 1 ? `Batch ${idx + 1}` : null);

          parsedBatches.push({
            fileName: `Zoom API Instance ${idx + 1}`,
            webinarId: cleanWebinarId,
            topic: apiTopic,
            actualDurationMinutes: instanceDuration,
            startTime: inst.start_time,
            detectedSlot: slot,
            participants,
            absentRegistrants: [],
          });
        }
      } else if (allZoomInstances.length > 0 && overrideDate) {
        const targetDateStr = safeToDateOnly(overrideDate);
        const availableDates = Array.from(new Set(allZoomInstances.map(i => safeToDateOnly(i.start_time)))).sort();
        const recentDates = availableDates.slice(-5).reverse();
        return res.status(404).json({
          success: false,
          errorType: 'date_mismatch',
          error: `No Zoom session found on ${targetDateStr}.`,
          webinarId: cleanWebinarId,
          requestedDate: targetDateStr,
          suggestedDates: recentDates,
          allDatesCount: availableDates.length,
          message: `Zoom found ${availableDates.length} past sessions for Webinar ${cleanWebinarId}, but none on ${targetDateStr}.`
        });
      } else {
        // Fallback: Fetch directly with cleanWebinarId if no specific instances list was found
        const participants = await fetchParticipantsForTarget(cleanWebinarId, isMeeting);
        
        if (overrideDate && apiStartTime) {
          const targetDateStr = safeToDateOnly(overrideDate);
          const actualDateStr = safeToDateOnly(apiStartTime);
          if (targetDateStr !== actualDateStr) {
            return res.status(404).json({
              success: false,
              errorType: 'date_mismatch',
              error: `Session date mismatch.`,
              webinarId: cleanWebinarId,
              requestedDate: targetDateStr,
              suggestedDates: [actualDateStr],
              allDatesCount: 1,
              message: `You entered ${targetDateStr}, but this Zoom session took place on ${actualDateStr}.`
            });
          }
        }

        let instanceDuration = apiDuration;
        if (participants.length > 0) {
          const maxSeconds = Math.max(...participants.map(p => p.durationSeconds || 0));
          if (maxSeconds > 0) {
            const derivedMinutes = Math.round(maxSeconds / 60);
            if (derivedMinutes >= 15) {
              instanceDuration = derivedMinutes;
            }
          }
        }

        parsedBatches.push({
          fileName: 'Zoom API Live',
          webinarId: cleanWebinarId,
          topic: apiTopic,
          actualDurationMinutes: instanceDuration,
          startTime: apiStartTime,
          detectedSlot: overrideBatchSlot || detectBatchSlot(apiStartTime, '', apiTopic) || null,
          participants,
          absentRegistrants: [],
        });
      }
    }

    if (!cleanWebinarId && parsedBatches.length > 0) {
      cleanWebinarId = (parsedBatches[0].webinarId || '').replace(/\D/g, '');
    }

    if (!cleanWebinarId) {
      if (parsedBatches.length > 0) {
        cleanWebinarId = `CSV_${sessionDate.replace(/\D/g, '') || Date.now().toString()}`;
      } else {
        return res.status(400).json({ error: "Webinar ID could not be identified from the input or files." });
      }
    }

    // Infer missing metadata
    const finalSessionTitle = sessionTitle || `Zoom Webinar ${cleanWebinarId}`;

    // Class Type Inference
    let classType = overrideClassType || 'MaxouT';
    const lowerTitle = finalSessionTitle.toLowerCase();
    if (!overrideClassType) {
      if (lowerTitle.includes('golden') || lowerTitle.includes('revision') || lowerTitle.includes('speed revision')) {
        classType = 'Golden Theory Speed Revision';
      } else if (lowerTitle.includes('grc')) {
        classType = 'GRC';
      } else if (lowerTitle.includes('model') || lowerTitle.includes('model paper')) {
        classType = 'Model Paper Class';
      } else if (lowerTitle.includes('theory') && lowerTitle.includes('paper')) {
        classType = 'Theory with Paper Class';
      } else if (lowerTitle.includes('maxout') || lowerTitle.includes('max-out') || lowerTitle.includes('f to a')) {
        classType = 'MaxouT';
      }
    }

    // Target Batch Inference: Strictly prioritize the user's input textbox value!
    const rawTargetBatch = (overrideBatch || '').trim();
    const isGenericBatch = !rawTargetBatch || ['all', 'all batch', 'all batches', 'general'].includes(rawTargetBatch.toLowerCase());
    let defaultTargetBatch = '2027';
    if (!isGenericBatch) {
      defaultTargetBatch = rawTargetBatch;
    } else if (lowerTitle.includes('2028')) {
      defaultTargetBatch = '2028';
    } else if (lowerTitle.includes('2026')) {
      defaultTargetBatch = '2026';
    } else if (lowerTitle.includes('2027')) {
      defaultTargetBatch = '2027';
    }
    const finalTargetBatchDisplay = !isGenericBatch ? rawTargetBatch : defaultTargetBatch;

    // Initialize Supabase Client
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration in environment variables.");
    }

    const authHeader = req.headers?.authorization || (req.headers as any)?.['authorization'];
    const clientOptions: any = {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    };
    if (authHeader) {
      const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      clientOptions.global = {
        headers: { Authorization: token }
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, clientOptions);

    // Fetch Enrolled Students for Matching & Absent Roll
    const { data: students, error: studentErr } = await supabase
      .from('student')
      .select('pcaid, name, last_name, mail, phone, proper_batch, joined_batch')
      .is('deleted_at', null)
      .limit(10000);

    if (studentErr) {
      throw new Error(`Database error fetching students: ${studentErr.message}`);
    }

    // Also fetch zoom_registration for mapping student emails and registration names to PCA ID
    const { data: regList } = await supabase
      .from('zoom_registration')
      .select('pcaid, email, student_name')
      .is('deleted_at', null)
      .limit(10000);

    // Lookup caches
    const pcaidMap = new Map<string, any>();
    const emailMap = new Map<string, string>();
    const nameMap = new Map<string, string>();

    (students || []).forEach(st => {
      const cleanPcaid = (st.pcaid || '').trim().toUpperCase();
      if (cleanPcaid) {
        pcaidMap.set(cleanPcaid, st);
        if (st.mail) emailMap.set(st.mail.trim().toLowerCase(), cleanPcaid);
        
        const fName = (st.name || '').trim().toLowerCase();
        const lName = (st.last_name || '').trim().toLowerCase();
        if (fName) nameMap.set(fName, cleanPcaid);
        if (lName) nameMap.set(lName, cleanPcaid);
        if (fName && lName) {
          nameMap.set(`${fName} ${lName}`, cleanPcaid);
          nameMap.set(`${lName} ${fName}`, cleanPcaid);
        }
      }
    });

    (regList || []).forEach(zr => {
      const cleanPcaid = (zr.pcaid || '').trim().toUpperCase();
      if (cleanPcaid) {
        if (zr.email) emailMap.set(zr.email.trim().toLowerCase(), cleanPcaid);
        if (zr.student_name) {
          const sName = zr.student_name.trim().toLowerCase();
          nameMap.set(sName, cleanPcaid);
        }
      }
    });

    // Helper: Match PCAID from participant name or email
    const findStudentPcaid = (name: string, email: string): string | null => {
      // 1. Try Regex for PCAID (e.g. BRF2315001, PPF2715902, BPF2717010, PCA-2027-001)
      const matches = name.match(/\b([A-Z]{2,4}\d{4,10})\b/i) || name.match(/\b(PCA[-_]?[A-Z0-9]+)\b/i);
      if (matches) {
        const candidate = matches[1].toUpperCase();
        if (pcaidMap.has(candidate)) return candidate;
      }

      // 2. Direct string tokens
      const words = name.split(/\s+/);
      for (const w of words) {
        const clean = w.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (clean && pcaidMap.has(clean)) return clean;
      }

      // 3. Match by student email (Primary solution when username has NO PCA ID!)
      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        if (emailMap.has(cleanEmail)) {
          return emailMap.get(cleanEmail)!;
        }
      }

      // 4. Match by exact normalized student name (first name, full name, or last name)
      const normName = name.trim().toLowerCase();
      if (normName && nameMap.has(normName)) {
        return nameMap.get(normName)!;
      }

      // 5. Try cleaning name (removing titles like Miss, Mr, Mrs, Eng, Dr)
      const cleanNameOnly = normName.replace(/^(miss|mr|mrs|dr|eng|master)\.?\s+/i, '').trim();
      if (cleanNameOnly && nameMap.has(cleanNameOnly)) {
        return nameMap.get(cleanNameOnly)!;
      }

      return null;
    };

    // Store attendance records for all batches
    const allAttendanceRecords: any[] = [];
    const joinedPcaidsAcrossAllFiles = new Set<string>();
    const studentBatchAttendanceCount = new Map<string, number>();
    const unmatchedAttendees: Array<{ name: string; email: string; duration: number; file: string }> = [];
    const batchBreakdowns: Array<{
      slot: string;
      fileName: string;
      totalParticipants: number;
      present: number;
      partial: number;
      absent: number;
    }> = [];

    // Process each batch file independently
    for (let batchIdx = 0; batchIdx < parsedBatches.length; batchIdx++) {
      const batch = parsedBatches[batchIdx];
      const isMaxoutClass = classType === 'MaxouT' || classType === 'F to A MaxouT Project' || (classType || '').toLowerCase().includes('maxout');
      // MaxouT has 3 distinct daily batches (Batch 1, 2, 3); all other class types happen once a day and have batch_slot = null
      const slot = isMaxoutClass
        ? (batch.detectedSlot || (parsedBatches.length > 1 ? `Batch ${batchIdx + 1}` : overrideBatchSlot || 'Batch 1'))
        : null;
      
      // Clean pure Webinar ID without any slot suffix
      const sessionWebinarId = cleanWebinarId;
      const batchTitle = slot ? `${batch.topic || finalSessionTitle} - ${slot}` : (batch.topic || finalSessionTitle);
      const batchDuration = Math.max(15, batch.actualDurationMinutes || overrideDuration || 90);

      // Aggregate sessions within THIS file by PCAID
      const fileAggregated = new Map<string, {
        pcaid: string;
        studentName: string;
        email: string;
        totalSeconds: number;
        sessionsCount: number;
        earliestJoin: string | null;
        latestLeave: string | null;
      }>();

      for (const p of batch.participants) {
        const pcaid = findStudentPcaid(p.name, p.email);
        if (!pcaid) {
          unmatchedAttendees.push({
            name: p.name,
            email: p.email,
            duration: Math.round(p.durationSeconds / 60),
            file: batch.fileName
          });
          continue;
        }

        const existing = fileAggregated.get(pcaid);
        if (!existing) {
          fileAggregated.set(pcaid, {
            pcaid,
            studentName: p.name,
            email: p.email,
            totalSeconds: p.durationSeconds,
            sessionsCount: 1,
            earliestJoin: p.joinTime || null,
            latestLeave: p.leaveTime || null,
          });
        } else {
          existing.totalSeconds += p.durationSeconds;
          existing.sessionsCount += 1;
          if (p.joinTime) {
            const pDate = parseFlexibleDate(p.joinTime);
            const currDate = parseFlexibleDate(existing.earliestJoin);
            if (pDate && (!currDate || pDate.getTime() < currDate.getTime())) {
              existing.earliestJoin = p.joinTime;
            }
          }
          if (p.leaveTime) {
            const pDate = parseFlexibleDate(p.leaveTime);
            const currDate = parseFlexibleDate(existing.latestLeave);
            if (pDate && (!currDate || pDate.getTime() > currDate.getTime())) {
              existing.latestLeave = p.leaveTime;
            }
          }
        }
      }

      let batchPresent = 0;
      let batchPartial = 0;
      let batchAbsent = 0;

      // Build attendance records for students in this batch
      for (const [pcaid, data] of fileAggregated.entries()) {
        joinedPcaidsAcrossAllFiles.add(pcaid);
        studentBatchAttendanceCount.set(pcaid, (studentBatchAttendanceCount.get(pcaid) || 0) + 1);

        const attendedMinutes = Math.round(data.totalSeconds / 60);
        const reconnectCount = Math.max(0, data.sessionsCount - 1);
        const rawPct = (attendedMinutes / batchDuration) * 100;
        const attendancePercentage = Math.min(100, Math.round(rawPct * 100) / 100);

        let status: 'present' | 'partial' | 'absent' = 'absent';
        if (attendancePercentage >= 75) {
          status = 'present';
          batchPresent++;
        } else if (attendancePercentage >= 25) {
          status = 'partial';
          batchPartial++;
        } else {
          status = 'absent';
          batchAbsent++;
        }

        const st = pcaidMap.get(pcaid);
        const rowTargetBatch = !isGenericBatch
          ? rawTargetBatch
          : (st?.proper_batch || defaultTargetBatch);

        allAttendanceRecords.push({
          pcaid,
          webinar_id: sessionWebinarId,
          session_title: batchTitle,
          session_date: safeToDateOnly(sessionDate),
          class_type: classType,
          target_batch: rowTargetBatch,
          batch_slot: slot,
          session_duration_minutes: batchDuration,
          attended_minutes: attendedMinutes,
          attendance_percentage: attendancePercentage,
          status,
          reconnect_count: reconnectCount,
          first_join_time: safeToISO(data.earliestJoin),
          last_leave_time: safeToISO(data.latestLeave),
          excuse_reason: null,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      batchBreakdowns.push({
        slot: slot || 'General Session',
        fileName: batch.fileName,
        totalParticipants: fileAggregated.size,
        present: batchPresent,
        partial: batchPartial,
        absent: batchAbsent
      });
    }

    // -------------------------------------------------------------
    // Combined Absent Registrants Processing (Pure Zoom Report Roll)
    // -------------------------------------------------------------
    // 1. Gather all absent registrants across all parsed batch CSVs and Zoom API
    const allRawAbsent: Array<{ name: string; email: string }> = [];
    for (const b of parsedBatches) {
      if (b.absentRegistrants && b.absentRegistrants.length > 0) {
        allRawAbsent.push(...b.absentRegistrants);
      }
    }
    if (liveZoomRegistrants.length > 0) {
      allRawAbsent.push(...liveZoomRegistrants);
    }

    // 2. Set subtraction & Deduplication:
    // If a student joined ANY batch on this date (joinedPcaidsAcrossAllFiles.has(pcaid)),
    // DROP their absent record completely!
    // If a student NEVER joined any batch, keep exactly ONE absent record per student.
    const absentStudentMap = new Map<string, any>();
    let absentIntersectionRemoved = 0;
    let totalAbsentAdded = 0;

    if (markAbsentForUnjoined) {
      for (const raw of allRawAbsent) {
        const pcaid = findStudentPcaid(raw.name, raw.email);
        if (!pcaid) continue; // Skip unmapped external attendees or host

        // If student joined any batch, keep joined record and discard absent record
        if (joinedPcaidsAcrossAllFiles.has(pcaid)) {
          absentIntersectionRemoved++;
          continue;
        }

        // Deduplicate across batches: keep only one absent candidate per unique student
        if (!absentStudentMap.has(pcaid)) {
          const studentData = pcaidMap.get(pcaid);
          absentStudentMap.set(pcaid, studentData);
        }
      }

      const absentDuration = parsedBatches.length > 0
        ? Math.max(...parsedBatches.map(b => b.actualDurationMinutes || 90), 90)
        : (detectedDurationMinutes || 90);

      for (const [pcaid, st] of absentStudentMap.entries()) {
        const rowTargetBatch = !isGenericBatch
          ? rawTargetBatch
          : (st?.proper_batch || defaultTargetBatch);

        allAttendanceRecords.push({
          pcaid: pcaid,
          webinar_id: cleanWebinarId,
          session_title: finalSessionTitle,
          session_date: safeToDateOnly(sessionDate),
          class_type: classType,
          target_batch: rowTargetBatch,
          batch_slot: null,
          session_duration_minutes: absentDuration,
          attended_minutes: 0,
          attendance_percentage: 0.00,
          status: 'absent',
          reconnect_count: 0,
          first_join_time: null,
          last_leave_time: null,
          excuse_reason: null,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        totalAbsentAdded++;
      }
    }

    // In-memory deduplication across (pcaid, webinar_id, session_date, batch_slot) to prevent any duplicate key errors
    const dedupMap = new Map<string, any>();
    for (const r of allAttendanceRecords) {
      const key = `${r.pcaid.trim().toUpperCase()}__${r.webinar_id.trim()}__${r.session_date}__${(r.batch_slot || 'NONE').trim()}`;
      const existing = dedupMap.get(key);
      if (!existing) {
        dedupMap.set(key, { ...r });
      } else {
        // Merge duplicate instance of the same slot
        existing.attended_minutes = Math.max(existing.attended_minutes, r.attended_minutes);
        existing.reconnect_count = (existing.reconnect_count || 0) + (r.reconnect_count || 0);
        if (r.status === 'present' || (r.status === 'partial' && existing.status === 'absent')) {
          existing.status = r.status;
        }
        if (r.first_join_time && (!existing.first_join_time || r.first_join_time < existing.first_join_time)) {
          existing.first_join_time = r.first_join_time;
        }
        if (r.last_leave_time && (!existing.last_leave_time || r.last_leave_time > existing.last_leave_time)) {
          existing.last_leave_time = r.last_leave_time;
        }
      }
    }
    const finalCleanRecords = Array.from(dedupMap.values());

    // Cleanly refresh this session's attendance: delete any prior rows for this webinar and date
    if (cleanWebinarId && sessionDate) {
      await supabase
        .from('student_attendance')
        .delete()
        .eq('webinar_id', cleanWebinarId)
        .eq('session_date', safeToDateOnly(sessionDate));
    }

    // Batch Upsert into student_attendance in chunks of 100
    const CHUNK_SIZE = 100;
    for (let i = 0; i < finalCleanRecords.length; i += CHUNK_SIZE) {
      const chunk = finalCleanRecords.slice(i, i + CHUNK_SIZE);
      const { error: upsertErr } = await supabase
        .from('student_attendance')
        .upsert(chunk, {
          onConflict: 'pcaid,webinar_id,session_date,batch_slot',
          ignoreDuplicates: false
        });

      if (upsertErr) {
        if (upsertErr.message?.includes('row-level security policy') || upsertErr.code === '42501') {
          throw new Error(
            `Database RLS Policy Violation: Row-Level Security on table "student_attendance" denied inserting records. Please run the provided SQL in "supabase_student_attendance.sql" inside your Supabase Dashboard SQL Editor, or provide SUPABASE_SERVICE_ROLE_KEY.`
          );
        }
        throw new Error(`Failed to save attendance chunk: ${upsertErr.message}`);
      }
    }

    // Count multi-batch students (joined >= 2 batches)
    let multiBatchCount = 0;
    for (const count of studentBatchAttendanceCount.values()) {
      if (count > 1) multiBatchCount++;
    }

    // Overall statistics
    const stats = {
      total: allAttendanceRecords.length,
      present: allAttendanceRecords.filter(r => r.status === 'present').length,
      partial: allAttendanceRecords.filter(r => r.status === 'partial').length,
      absent: allAttendanceRecords.filter(r => r.status === 'absent').length,
      excused: allAttendanceRecords.filter(r => r.status === 'excused').length,
      unmatchedCount: unmatchedAttendees.length,
      uniqueStudentsJoined: joinedPcaidsAcrossAllFiles.size,
      multiBatchCount,
      unjoinedMarkedAbsent: totalAbsentAdded,
      absentIntersectionRemoved,
      batchCount: parsedBatches.length
    };

    let warning: string | undefined;
    if (debugRegistrantsError && debugRegistrantsError.includes('does not contain scopes')) {
      warning = "Zoom API Scopes Notice: Your Zoom Server-to-Server OAuth App is missing the 'webinar:read:list_registrants:admin' scope in Zoom App Marketplace, so Zoom blocked querying unjoined registrants over API. To sync all unjoined students without scope restrictions, please upload the 3 batch CSV files or add the scope in Zoom Marketplace.";
    }

    return res.status(200).json({
      success: true,
      webinarId: cleanWebinarId,
      sessionTitle: finalSessionTitle,
      sessionDate,
      classType,
      targetBatch: finalTargetBatchDisplay,
      warning,
      stats,
      batchBreakdowns,
      unmatchedAttendees: unmatchedAttendees.slice(0, 20),
    });
  } catch (err: any) {
    console.error("Zoom Attendance Sync Error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Meeting does not exist') || msg.includes('Webinar does not exist') || msg.includes('3001')) {
      return res.status(404).json({
        success: false,
        errorType: 'not_found',
        error: `Webinar ID not found in Zoom.`,
        message: `Zoom could not find any meeting or webinar matching ID "${cleanWebinarId || 'provided'}". Please check the 11-digit Webinar ID.`
      });
    }
    return res.status(500).json({
      error: msg || "Internal server error syncing Zoom attendance"
    });
  }
}
