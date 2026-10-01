// File location: /api/register-batch.ts
// Vercel automatically turns files inside /api into live endpoints.
// This one will be reachable at: https://your-app.vercel.app/api/register-batch

import type { VercelRequest, VercelResponse } from "@vercel/node";

interface Student {
  firstName: string;
  lastName: string;
  email: string;
}

interface RegistrationResult {
  email: string;
  status: "Success" | "Failed";
  joinUrl?: string;
  error?: string;
  webinarId?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { students, webinarId, webinarIds, eventType } = req.body as { 
    students: Student[]; 
    webinarId?: string; 
    webinarIds?: string[];
    eventType?: "webinar" | "meeting";
  };

  const targetWebinarIds: string[] = [];
  if (Array.isArray(webinarIds) && webinarIds.length > 0) {
    webinarIds.forEach(id => {
      const clean = String(id || '').trim();
      if (clean && !targetWebinarIds.includes(clean)) {
        targetWebinarIds.push(clean);
      }
    });
  } else if (webinarId && typeof webinarId === 'string' && webinarId.trim()) {
    targetWebinarIds.push(webinarId.trim());
  }

  if (!students || !Array.isArray(students) || targetWebinarIds.length === 0) {
    return res.status(400).json({ error: "Missing students array or valid webinarId/webinarIds" });
  }

  try {
    const token = await getAccessToken();
    const results: RegistrationResult[] = [];

    for (const currentWebinarId of targetWebinarIds) {
      for (const student of students) {
        try {
          const result = await registerStudent(token, currentWebinarId, student, eventType);
          results.push({
            ...result,
            webinarId: currentWebinarId
          });
        } catch (err) {
          // One student or webinar failure should never stop the rest of the batch
          results.push({
            email: student.email,
            status: "Failed",
            webinarId: currentWebinarId,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Zoom API credentials in environment variables. Please ensure ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET are configured."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    }
  );

  const data = await response.json();

  if (!data.access_token) {
    const errorDetail = data.reason || data.error_description || data.message || JSON.stringify(data);
    throw new Error(`Failed to authenticate with Zoom API: ${errorDetail}`);
  }

  // Cache token (Zoom access tokens are valid for 1 hour; cache safely for 45 minutes)
  cachedToken = {
    token: data.access_token as string,
    expiresAt: Date.now() + 45 * 60 * 1000,
  };

  return data.access_token as string;
}

function parseZoomErrorMessage(data: any, eventId: string): string {
  if (!data) return "Unknown error from Zoom";

  if (typeof data === "string") return data;

  // Zoom validation array errors: { errors: [ { field: "email", message: "..." } ] }
  if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    const details = data.errors
      .map((e: any) => e.message || (e.field ? `${e.field} is invalid` : ""))
      .filter(Boolean)
      .join(", ");
    if (details) return `${data.message ? data.message + ": " : ""}${details}`;
  }

  if (data.code === 3001 || data.code === 1001) {
    return `Webinar/Meeting ID (${eventId}) does not exist. Please check the ID.`;
  }

  if (data.code === 300 && (data.message || "").toLowerCase().includes("registration has not been enabled")) {
    return `Registration is not enabled for Webinar/Meeting (${eventId}). Please enable 'Required' registration in your Zoom portal.`;
  }

  if (data.code === 1002 || (data.message || "").toLowerCase().includes("already registered")) {
    return "Student is already registered for this webinar/meeting.";
  }

  return data.message || data.error || JSON.stringify(data);
}

async function registerStudent(
  token: string,
  eventId: string,
  student: Student,
  eventType?: "webinar" | "meeting"
): Promise<RegistrationResult> {
  const { firstName, lastName, email } = student;
  const cleanId = eventId.trim();

  // Primary endpoint selection
  const isMeeting = eventType === "meeting";
  const primaryUrl = isMeeting
    ? `https://api.zoom.us/v2/meetings/${cleanId}/registrants`
    : `https://api.zoom.us/v2/webinars/${cleanId}/registrants`;

  let response = await fetch(primaryUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email: email,
    }),
  });

  let data = await response.json();

  // Automatic smart fallback: if webinar failed because ID was not found or is a meeting, try meetings endpoint
  if (!isMeeting && response.status !== 201 && (data.code === 3001 || data.code === 1001 || response.status === 404)) {
    const fallbackUrl = `https://api.zoom.us/v2/meetings/${cleanId}/registrants`;
    const fallbackResponse = await fetch(fallbackUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email: email,
      }),
    });

    const fallbackData = await fallbackResponse.json();
    if (fallbackResponse.status === 201) {
      return {
        email,
        status: "Success",
        joinUrl: fallbackData.join_url,
      };
    } else {
      data = fallbackData;
      response = fallbackResponse;
    }
  }

  if (response.status === 201) {
    return {
      email,
      status: "Success",
      joinUrl: data.join_url,
    };
  } else {
    return {
      email,
      status: "Failed",
      error: parseZoomErrorMessage(data, cleanId),
    };
  }
}
