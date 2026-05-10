/**
 * send-fcm-notification — Firebase Cloud Messaging Edge Function
 *
 * Sends push notifications via FCM HTTP v1 API using a service account JWT.
 * Falls back gracefully if Firebase credentials are not configured.
 *
 * Accepts POST:
 *   {
 *     user_id?: string;           // Look up FCM tokens from user_push_tokens
 *     tokens?: string[];          // Or provide explicit FCM registration tokens
 *     title: string;
 *     body: string;
 *     data?: Record<string, string>; // FCM data payload (string values only)
 *     image_url?: string;
 *   }
 *
 * Required env vars (from Supabase secrets):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *
 * Security: Should only be called from server-side (other edge functions or
 * Postgres triggers via pg_net). Not exposed to end users directly.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type FcmPayload = {
  user_id?: string;
  tokens?: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  image_url?: string;
};

// ── Firebase JWT helpers ──────────────────────────────────────────────────────

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const cleanedPem = pemKey
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(cleanedPem), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64UrlEncode(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function createFirebaseJWT(
  clientEmail: string,
  privateKey: CryptoKey,
  scope: string = "https://www.googleapis.com/auth/firebase.messaging"
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

async function getFirebaseAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const privateKey = await importPrivateKey(privateKeyPem);
  const jwt = await createFirebaseJWT(clientEmail, privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get Firebase access token: ${err}`);
  }

  const json = await res.json();
  return json.access_token;
}

// ── Send single FCM message ───────────────────────────────────────────────────

async function sendFcmMessage(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const message: Record<string, any> = {
    message: {
      token,
      notification: { title, body, ...(imageUrl ? { image: imageUrl } : {}) },
      data: data ?? {},
      android: {
        notification: { sound: "default", priority: "HIGH" },
        priority: "HIGH",
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
      webpush: {
        notification: { title, body, ...(imageUrl ? { image: imageUrl } : {}) },
        fcm_options: {},
      },
    },
  };

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const res = await fetch(fcmUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { success: false, error: `FCM API ${res.status}: ${errBody}` };
  }

  return { success: true };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check Firebase credentials ──────────────────────────────────────────
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
    const privateKeyRaw = Deno.env.get("FIREBASE_PRIVATE_KEY");

    if (!projectId || !clientEmail || !privateKeyRaw) {
      // Graceful degradation: log warning, return ok so callers don't break
      console.warn(
        "[send-fcm] Firebase credentials not configured. " +
        "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY " +
        "in Supabase Edge Function secrets to enable FCM push notifications."
      );
      return new Response(
        JSON.stringify({
          ok: true,
          sent: 0,
          skipped: true,
          reason: "firebase_not_configured",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: FcmPayload = await req.json();

    if (!payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetTokens: string[] = payload.tokens ?? [];

    // If user_id provided, look up their FCM tokens from DB
    if (payload.user_id && targetTokens.length === 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const db = createClient(supabaseUrl, serviceKey);

      const { data: tokenRows, error } = await db
        .from("user_push_tokens")
        .select("token")
        .eq("user_id", payload.user_id)
        .eq("provider", "fcm")
        .eq("is_active", true);

      if (error) {
        console.error("[send-fcm] token lookup error:", error.message);
      } else {
        targetTokens = (tokenRows ?? []).map((r: any) => r.token);
      }
    }

    if (targetTokens.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "no_fcm_tokens" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Get Firebase access token ───────────────────────────────────────────
    let accessToken: string;
    try {
      accessToken = await getFirebaseAccessToken(clientEmail, privateKeyRaw);
    } catch (jwtErr: any) {
      console.error("[send-fcm] JWT error:", jwtErr?.message);
      return new Response(
        JSON.stringify({ ok: false, error: `Firebase auth failed: ${jwtErr?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Send to each FCM token ──────────────────────────────────────────────
    let totalSent = 0;
    const errors: string[] = [];

    for (const token of targetTokens) {
      const result = await sendFcmMessage(
        projectId,
        accessToken,
        token,
        payload.title,
        payload.body,
        payload.data,
        payload.image_url
      );

      if (result.success) {
        totalSent++;
      } else {
        console.warn(`[send-fcm] Failed for token ${token.slice(0, 20)}…: ${result.error}`);
        errors.push(result.error ?? "unknown");
      }
    }

    const ok = errors.length === 0;
    console.log(`[send-fcm] Sent ${totalSent}/${targetTokens.length} FCM notifications`);

    return new Response(
      JSON.stringify({ ok, sent: totalSent, total: targetTokens.length, errors }),
      {
        status: ok ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[send-fcm] Unhandled error:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
