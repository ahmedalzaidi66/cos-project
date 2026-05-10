/**
 * send-push-notification — Unified Push Notification Edge Function
 *
 * Sends via BOTH Expo Push and Firebase FCM depending on which tokens are stored.
 * If Firebase credentials are not configured, FCM is silently skipped.
 *
 * Accepts POST:
 *   { user_id?: string, tokens?: string[], title: string, body: string, data?: Record<string, any> }
 *
 * Behavior:
 *   - Looks up user's push tokens from user_push_tokens table by provider
 *   - Sends Expo tokens → Expo Push API
 *   - Sends FCM tokens → delegates to send-fcm-notification function
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PushPayload = {
  user_id?: string;
  tokens?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default";
  priority?: "default" | "normal" | "high";
  badge?: number;
};

// ── Expo sender ───────────────────────────────────────────────────────────────

async function sendExpoNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ sent: number; errors: string[] }> {
  const expoTokens = tokens.filter(
    (t) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[")
  );

  if (expoTokens.length === 0) return { sent: 0, errors: [] };

  const messages: ExpoPushMessage[] = expoTokens.map((token) => ({
    to: token,
    title,
    body,
    data: data ?? {},
    sound: "default",
    priority: "high",
  }));

  let totalSent = 0;
  const errors: string[] = [];

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        errors.push(`Expo API error ${res.status}: ${JSON.stringify(result)}`);
      } else {
        const resultData = (result as any)?.data ?? [];
        totalSent += resultData.filter((r: any) => r.status === "ok").length;

        for (const e of resultData.filter((r: any) => r.status === "error")) {
          console.warn(`[send-push] Expo token error: ${e.message} (${e.details?.error ?? ""})`);
        }
      }
    } catch (batchErr: any) {
      errors.push(`Expo batch error: ${batchErr?.message ?? batchErr}`);
    }
  }

  return { sent: totalSent, errors };
}

// ── FCM sender (delegates to send-fcm-notification) ──────────────────────────

async function sendFcmNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ sent: number; skipped: boolean; errors: string[] }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-fcm-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ tokens, title, body, data }),
    });

    const json = await res.json().catch(() => ({})) as any;

    if (json?.skipped) {
      return { sent: 0, skipped: true, errors: [] };
    }

    return {
      sent: json?.sent ?? 0,
      skipped: false,
      errors: json?.errors ?? [],
    };
  } catch (err: any) {
    console.warn("[send-push] FCM dispatch error:", err?.message);
    return { sent: 0, skipped: false, errors: [err?.message ?? "FCM dispatch failed"] };
  }
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

    const payload: PushPayload = await req.json();

    if (!payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let expoTokens: string[] = [];
    let fcmTokens: string[] = [];

    if (payload.tokens && payload.tokens.length > 0) {
      // Caller provided explicit tokens — route by format
      expoTokens = payload.tokens.filter(
        (t) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[")
      );
      // Everything else treated as FCM registration token
      fcmTokens = payload.tokens.filter(
        (t) => !t.startsWith("ExponentPushToken[") && !t.startsWith("ExpoPushToken[")
      );
    } else if (payload.user_id) {
      // Look up tokens from DB separated by provider
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const db = createClient(supabaseUrl, serviceKey);

      const { data: tokenRows, error } = await db
        .from("user_push_tokens")
        .select("token, provider")
        .eq("user_id", payload.user_id)
        .eq("is_active", true);

      if (error) {
        console.error("[send-push] token lookup error:", error.message);
      } else {
        for (const row of tokenRows ?? []) {
          if (row.provider === "fcm") {
            fcmTokens.push(row.token);
          } else {
            expoTokens.push(row.token);
          }
        }
      }
    }

    if (expoTokens.length === 0 && fcmTokens.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "no_tokens" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Dispatch both in parallel
    const [expoResult, fcmResult] = await Promise.all([
      expoTokens.length > 0
        ? sendExpoNotifications(expoTokens, payload.title, payload.body, payload.data)
        : Promise.resolve({ sent: 0, errors: [] }),
      fcmTokens.length > 0
        ? sendFcmNotifications(fcmTokens, payload.title, payload.body, payload.data)
        : Promise.resolve({ sent: 0, skipped: false, errors: [] }),
    ]);

    const totalSent = expoResult.sent + fcmResult.sent;
    const allErrors = [...expoResult.errors, ...(fcmResult.errors ?? [])];
    const ok = allErrors.length === 0;

    console.log(
      `[send-push] Expo: ${expoResult.sent}/${expoTokens.length}, ` +
      `FCM: ${fcmResult.sent}/${fcmTokens.length}` +
      (fcmResult.skipped ? " (FCM skipped — not configured)" : "")
    );

    return new Response(
      JSON.stringify({
        ok,
        sent: totalSent,
        expo: { sent: expoResult.sent, total: expoTokens.length },
        fcm: { sent: fcmResult.sent, total: fcmTokens.length, skipped: fcmResult.skipped },
        errors: allErrors,
      }),
      {
        status: ok ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[send-push] Unhandled error:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
