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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { students, webinarId, eventType } = req.body as { 
    students: Student[]; 
    webinarId: string; 
    eventType?: "webinar" | "meeting";
  };

  if (!students || !Array.isArray(students) || !webinarId) {
    return res.status(400).json({ error: "Missing students array or webinarId" });
  }

  try {
    const token = await getAccessToken();
    const results: RegistrationResult[] = [];

    for (const student of students) {
      try {
        const result = await registerStudent(token, webinarId, student, eventType);
        results.push(result);
      } catch (err) {
        // One student's failure should never stop the rest of the batch
        results.push({
          email: student.email,
          status: "Failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

async function getAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Missing Zoom credentials in environment variables");
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
    throw new Error("Failed to get Zoom access token: " + JSON.stringify(data));
  }

  return data.access_token as string;
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
      error: data.message || JSON.stringify(data),
    };
  }
}
