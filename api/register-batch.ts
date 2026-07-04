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

  const { students, webinarId } = req.body as { students: Student[]; webinarId: string };

  if (!students || !Array.isArray(students) || !webinarId) {
    return res.status(400).json({ error: "Missing students array or webinarId" });
  }

  try {
    const token = await getAccessToken();
    const results: RegistrationResult[] = [];

    for (const student of students) {
      try {
        const result = await registerStudent(token, webinarId, student);
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
  webinarId: string,
  student: Student
): Promise<RegistrationResult> {
  const { firstName, lastName, email } = student;

  const response = await fetch(
    `https://api.zoom.us/v2/webinars/${webinarId}/registrants`,
    {
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
    }
  );

  const data = await response.json();

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
