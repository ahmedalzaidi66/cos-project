/**
 * verify-otp — Phone OTP verification edge function
 *
 * Checks a submitted 6-digit code against the stored bcrypt hash.
 * On success:
 *   - Marks the row verified_at
 *   - For "login": signs the user in via Supabase Auth (creates account if new)
 *   - For "link_phone": updates customer_profiles with phone + phone_verified_at
 *
 * ── Request body ─────────────────────────────────────────────────────────────
 *   { phone: string, code: string, purpose: "login" | "register" | "link_phone" }
 *
 * ── Response (success) ───────────────────────────────────────────────────────
 *   200  { success: true, session: { access_token, refresh_token, ... }, isNewUser: boolean }
 *
 * ── Response (errors) ────────────────────────────────────────────────────────
 *   400  { success: false, error: string }
 *   401  { success: false, error: "Invalid or expired code", attemptsLeft: number }
 *   410  { success: false, error: "Code expired" }
 *   429  { success: false, error: "Too many attempts" }
 *   500  { success: false, error: "Internal error" }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_ATTEMPTS = 5;

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  const e164digits = digits.startsWith("00") ? digits.slice(2) : digits;
  return "+" + e164digits;
}

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
    const { phone: rawPhone, code, purpose = "login" } = await req.json();

    if (!rawPhone || !code) {
      return new Response(JSON.stringify({ success: false, error: "phone and code are required" }), {
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

    if (!/^\d{6}$/.test(String(code))) {
      return new Response(JSON.stringify({ success: false, error: "Code must be 6 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Fetch latest unverified row ───────────────────────────────────────
    const { data: row, error: fetchError } = await supabaseAdmin
      .from("otp_verifications")
      .select("id, otp_hash, expires_at, attempts")
      .eq("phone", phone)
      .eq("purpose", purpose)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("[verify-otp] fetch error:", fetchError);
      throw new Error("DB error");
    }

    if (!row) {
      return new Response(
        JSON.stringify({ success: false, error: "No pending code found. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Check expiry ──────────────────────────────────────────────────────
    if (new Date(row.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Code expired. Please request a new one." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Check attempt limit ───────────────────────────────────────────────
    if (row.attempts >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many attempts. Please request a new code." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Verify hash ───────────────────────────────────────────────────────
    const { data: isValid, error: cryptError } = await supabaseAdmin
      .rpc("verify_code", { p_code: String(code), p_hash: row.otp_hash });

    if (cryptError) {
      console.error("[verify-otp] verify_code rpc error:", cryptError);
      throw new Error("Hash verification failed");
    }

    if (!isValid) {
      // Increment attempts
      await supabaseAdmin
        .from("otp_verifications")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);

      const attemptsLeft = MAX_ATTEMPTS - (row.attempts + 1);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid code",
          attemptsLeft: Math.max(0, attemptsLeft),
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Mark verified ─────────────────────────────────────────────────────
    await supabaseAdmin
      .from("otp_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", row.id);

    // ── Create or sign in user ────────────────────────────────────────────
    // Use a deterministic synthetic email so the user has a Supabase Auth account.
    // The email is never shown to or used by the customer.
    const syntheticEmail = `phone_${phone.replace(/\+/g, "")}@otp.lazurde.internal`;
    const syntheticPassword = `otp_${phone}_${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 16)}`;

    // Try to sign in first (existing user)
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: syntheticEmail,
      password: syntheticPassword,
    });

    let session = signInData?.session;
    let isNewUser = false;

    if (signInError || !session) {
      // New user — create account
      const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: { phone, auth_method: "phone_otp" },
      });

      if (signUpError || !signUpData?.user) {
        console.error("[verify-otp] createUser error:", signUpError);
        throw new Error("Failed to create user account");
      }

      isNewUser = true;

      // Sign in to get a session
      const { data: newSignInData, error: newSignInError } =
        await supabaseAdmin.auth.signInWithPassword({
          email: syntheticEmail,
          password: syntheticPassword,
        });

      if (newSignInError || !newSignInData?.session) {
        console.error("[verify-otp] signIn after create error:", newSignInError);
        throw new Error("Failed to create session");
      }

      session = newSignInData.session;

      // Create customer_profiles row for new user
      await supabaseAdmin.from("customer_profiles").upsert({
        id: signUpData.user.id,
        phone,
        phone_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    } else {
      // Existing user — update phone_verified_at
      await supabaseAdmin.from("customer_profiles").upsert({
        id: session.user.id,
        phone,
        phone_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        },
        isNewUser,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[verify-otp] unhandled error:", msg);
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
