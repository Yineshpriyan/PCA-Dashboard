// Universal flexible date & time parsing utilities for Zoom CSVs and user inputs
// Handles DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, AM/PM, and Zoom export formats without throwing Invalid time value

export function parseFlexibleDate(input?: string | null): Date | null {
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
      // Default to DD/MM/YYYY for standard Sri Lankan / British convention
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

export function toExactStoredTimestamp(input?: string | null): string | null {
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

  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toISOString().replace('.000Z', '+00:00');
  }

  return null;
}

export function safeToISO(input?: string | null, fallback: string | null = null): string | null {
  return toExactStoredTimestamp(input) || fallback;
}

export function safeToDateOnly(input?: string | null, fallback?: string): string {
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

export function formatTimeDisplay(timeStr?: string | null): string | null {
  if (!timeStr) return null;
  // Match HH:MM(:SS) directly first to preserve exact local time without browser timezone shifting
  const timeMatch = timeStr.match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, '0');
    const mm = timeMatch[2].padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const d = parseFlexibleDate(timeStr);
  if (!d) return null;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
