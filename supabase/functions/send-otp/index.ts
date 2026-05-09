/**
 * send-otp — Phone OTP generation edge function
 *
 * Generates a 6-digit OTP, bcrypt-hashes it, stores it in otp_verifications,
 * then dispatches it via the configured WhatsApp provider.
 *
 * ── WhatsApp provider configuration (Supabase secrets) ──────────────────────
 *   WHATSAPP_PROVIDER      — "mock" (default) | "whatsapp_cloud" | "twilio"
 *   WHATSAPP_API_KEY       — provider API key / bearer token
 *   WHATSAPP_SENDER_ID     — phone number ID (WhatsApp Cloud API) or from-number (Twilio)
 *   WHATSAPP_TEMPLATE_ID   — message template name (WhatsApp Cloud API)
 *
 * In "mock" mode the OTP is written to console only (Supabase edge function logs).
 * The OTP is NEVER returned to the client.
 *
 * ── Request body ─────────────────────────────────────────────────────────────
 *   { phone: string, purpose: "login" | "register" | "link_phone" }
 *
 * ── Response ─────────────────────────────────────────────────────────────────
 *   200  { success: true,  expiresAt: ISO string, cooldownSeconds: number }
 *   400  { success: false, error: string }
 *   429  { success: false, error: "Please wait before requesting a new code" }
 *   500  { success: false, error: "Internal error" }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OTP_TTL_SECONDS = 300;        // 5 minutes
const RESEND_COOLDOWN_SECONDS = 60; // 1 minute cooldown between requests
const MAX_ATTEMPTS = 5;

// ── Normalise phone to E.164 ─────────────────────────────────────────────────
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  // If it starts with 00 treat as +
  const e164digits = digits.startsWith("00") ? digits.slice(2) : digits;
  return "+" + e164digits;
}

// ── Generate cryptographically random 6-digit OTP ────────────────────────────
function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

// ── WhatsApp provider abstraction ────────────────────────────────────────────
async function sendOtpViaProvider(phone: string, otp: string): Promise<void> {
  const provider = (Deno.env.get("WHATSAPP_PROVIDER") ?? "mock").toLowerCase();

  if (provider === "mock") {
    // Development: log to server-side logs only. OTP never reaches the client.
    console.log(`[send-otp][MOCK] OTP for ${phone}: ${otp}`);
    return;
  }

  if (provider === "whatsapp_cloud") {
    const apiKey      = Deno.env.get("WHATSAPP_API_KEY") ?? "";
    const senderId    = Deno.env.get("WHATSAPP_SENDER_ID") ?? "";
    const templateId  = Deno.env.get("WHATSAPP_TEMPLATE_ID") ?? "otp_login";

    if (!apiKey || !senderId) {
      console.error("[send-otp] WHATSAPP_API_KEY or WHATSAPP_SENDER_ID not configured");
      throw new Error("WhatsApp provider not configured");
    }

    const body = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateId,
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: otp }],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: otp }],
          },
        ],
      },
    };

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${senderId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[send-otp] WhatsApp Cloud API error:", detail);
      throw new Error("Failed to send WhatsApp message");
    }
    return;
  }

  if (provider === "twilio") {
    const apiKey    = Deno.env.get("WHATSAPP_API_KEY") ?? "";
    const senderId  = Deno.env.get("WHATSAPP_SENDER_ID") ?? "";
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";

    if (!apiKey || !senderId || !accountSid) {
      throw new Error("Twilio provider not fully configured");
    }

    const body = new URLSearchParams({
      From: `whatsapp:${senderId}`,
      To:   `whatsapp:${phone}`,
      Body: `Your Lazurde verification code is: ${otp}\nExpires in 5 minutes.`,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${apiKey}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[send-otp] Twilio error:", detail);
      throw new Error("Failed to send Twilio message");
    }
    return;
  }

  throw new Error(`Unknown WHATSAPP_PROVIDER: ${provider}`);
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { phone: rawPhone, purpose = "login" } = await req.json();

    if (!rawPhone || typeof rawPhone !== "string") {
      return new Response(JSON.stringify({ success: false, error: "phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalisePhone(rawPhone);
    if (!phone) {
      return new Response(JSON.stringify({ success: false, error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validPurposes = ["login", "register", "link_phone"];
    if (!validPurposes.includes(purpose)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid purpose" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service-role client so we can read/write otp_verifications freely
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Check resend cooldown ──────────────────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from("otp_verifications")
      .select("created_at, verified_at")
      .eq("phone", phone)
      .eq("purpose", purpose)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const secondsSinceCreated =
        (Date.now() - new Date(existing.created_at).getTime()) / 1000;
      if (secondsSinceCreated < RESEND_COOLDOWN_SECONDS) {
        const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceCreated);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Please wait ${waitSeconds} seconds before requesting a new code`,
            cooldownSeconds: waitSeconds,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Delete old unverified rows for this phone+purpose ─────────────────
    await supabaseAdmin
      .from("otp_verifications")
      .delete()
      .eq("phone", phone)
      .eq("purpose", purpose)
      .is("verified_at", null);

    // ── Generate OTP and hash it ──────────────────────────────────────────
    const otp = generateOtp();

    // Use pgcrypto via rpc to hash server-side (same pattern as email_verifications)
    const { data: hashData, error: hashError } = await supabaseAdmin
      .rpc("crypt_code", { p_code: otp });

    if (hashError || !hashData) {
      console.error("[send-otp] crypt_code rpc error:", hashError);
      throw new Error("Failed to hash OTP");
    }

    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    // ── Insert hashed OTP ─────────────────────────────────────────────────
    const { error: insertError } = await supabaseAdmin
      .from("otp_verifications")
      .insert({
        phone,
        otp_hash: hashData,
        purpose,
        expires_at: expiresAt,
        attempts: 0,
      });

    if (insertError) {
      console.error("[send-otp] insert error:", insertError);
      throw new Error("Failed to store OTP");
    }

    // ── Send via provider ─────────────────────────────────────────────────
    await sendOtpViaProvider(phone, otp);

    return new Response(
      JSON.stringify({
        success: true,
        expiresAt,
        cooldownSeconds: RESEND_COOLDOWN_SECONDS,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[send-otp] unhandled error:", msg);
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
