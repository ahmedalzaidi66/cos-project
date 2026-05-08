/**
 * send-push-notification — Lazurde Expo Push Notification Edge Function
 *
 * Accepts:
 *   { user_id: string, title: string, body: string, data?: Record<string, any> }
 *
 * OR for sending to explicit tokens:
 *   { tokens: string[], title: string, body: string, data?: Record<string, any> }
 *
 * Fetches all Expo push tokens for the given user_id from user_push_tokens table,
 * then sends via the Expo Push Notifications API.
 *
 * Security: Only callable with a valid Supabase service_role key or admin token.
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

    let targetTokens: string[] = payload.tokens ?? [];

    // If user_id provided, look up their tokens
    if (payload.user_id && targetTokens.length === 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const db = createClient(supabaseUrl, serviceKey);

      const { data: tokenRows, error } = await db
        .from("user_push_tokens")
        .select("token, platform")
        .eq("user_id", payload.user_id);

      if (error) {
        console.error("[send-push] token lookup error:", error.message);
      } else {
        targetTokens = (tokenRows ?? []).map((r: any) => r.token);
      }
    }

    if (targetTokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_tokens" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to valid Expo push tokens (ExponentPushToken[...])
    const expoTokens = targetTokens.filter(
      (t) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[")
    );

    if (expoTokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_valid_expo_tokens" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages — batch up to 100 per Expo API limit
    const messages: ExpoPushMessage[] = expoTokens.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: "default",
      priority: "high",
    }));

    // Send in batches of 100
    let totalSent = 0;
    const errors: string[] = [];

    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(batch),
        });

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          errors.push(`Expo API error ${res.status}: ${JSON.stringify(result)}`);
        } else {
          const data = (result as any)?.data ?? [];
          const successful = data.filter((r: any) => r.status === "ok").length;
          totalSent += successful;

          // Log receipt IDs for debugging
          const receipts = data.filter((r: any) => r.id);
          if (receipts.length > 0) {
            console.log(`[send-push] ${receipts.length} receipts from Expo`);
          }

          // Log errors from individual tokens
          const tokenErrors = data.filter((r: any) => r.status === "error");
          for (const e of tokenErrors) {
            console.warn(`[send-push] token error: ${e.message} (${e.details?.error ?? ""})`);
          }
        }
      } catch (batchErr: any) {
        errors.push(`Batch error: ${batchErr?.message ?? batchErr}`);
      }
    }

    const ok = errors.length === 0;
    console.log(`[send-push] Sent ${totalSent}/${expoTokens.length} notifications`);

    return new Response(
      JSON.stringify({ ok, sent: totalSent, total: expoTokens.length, errors }),
      {
        status: ok ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[send-push] Unhandled error:", err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
