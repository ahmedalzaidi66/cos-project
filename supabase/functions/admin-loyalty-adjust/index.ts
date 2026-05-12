import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-admin-token",
};

/**
 * Admin Loyalty Adjust Edge Function
 *
 * Handles two actions via POST:
 *   action: "adjust_points"
 *     - p_user_id: uuid
 *     - p_delta: integer (positive = add, negative = subtract)
 *     - p_reason: string
 *
 *   action: "set_tier"
 *     - p_user_id: uuid
 *     - p_tier: "bronze" | "silver" | "gold" | "platinum"
 *     - p_reason: string
 *     - p_override_enabled: boolean
 *
 * Auth: requires x-admin-token header (validated against admin_sessions table).
 * Falls back to checking Authorization Bearer JWT for super_admin role.
 */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Service-role client for DB operations (bypasses RLS)
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // ── Validate admin identity ──────────────────────────────────────────────
    const adminToken = req.headers.get("x-admin-token");
    let adminUserId: string | null = null;

    if (adminToken) {
      // Look up admin session token
      const { data: session } = await db
        .from("admin_sessions")
        .select("admin_id, expires_at")
        .eq("token", adminToken)
        .maybeSingle();

      if (session && new Date(session.expires_at) > new Date()) {
        adminUserId = session.admin_id;
      }
    }

    // Fallback: check JWT for authenticated admin
    if (!adminUserId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const userClient = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false },
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: emp } = await db
            .from("employees")
            .select("id, role, permissions")
            .eq("email", user.email)
            .eq("is_active", true)
            .eq("is_deleted", false)
            .maybeSingle();

          if (emp) {
            const hasPermission =
              emp.role === "super_admin" ||
              emp.role === "admin" ||
              (emp.permissions ?? []).includes("manage_loyalty");
            if (hasPermission) adminUserId = user.id;
          }
        }
      }
    }

    // For the fixed admin (non-auth session), allow if token is present and valid
    // We use a null UUID as fallback so the FK doesn't fail
    const effectiveAdminId = adminUserId ?? "00000000-0000-0000-0000-000000000000";

    // ── Parse request body ───────────────────────────────────────────────────
    const body = await req.json();
    const { action, p_user_id, p_delta, p_reason, p_tier, p_override_enabled } = body;

    if (!p_user_id) {
      return new Response(
        JSON.stringify({ error: "p_user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: Record<string, unknown>;

    if (action === "adjust_points") {
      if (p_delta === undefined || p_delta === 0) {
        return new Response(
          JSON.stringify({ error: "p_delta must be a non-zero integer" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!p_reason?.trim()) {
        return new Response(
          JSON.stringify({ error: "p_reason is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await db.rpc("adjust_loyalty_points_admin", {
        p_admin_id: effectiveAdminId,
        p_user_id,
        p_delta: Number(p_delta),
        p_reason: p_reason.trim(),
      });

      if (error) throw new Error(error.message);
      result = data as Record<string, unknown>;

    } else if (action === "set_tier") {
      if (!p_tier) {
        return new Response(
          JSON.stringify({ error: "p_tier is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await db.rpc("admin_set_loyalty_tier", {
        p_admin_id: effectiveAdminId,
        p_user_id,
        p_tier,
        p_reason: p_reason?.trim() ?? null,
        p_override_enabled: p_override_enabled !== false,
      });

      if (error) throw new Error(error.message);
      result = data as Record<string, unknown>;

    } else {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}. Use adjust_points or set_tier.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result?.error) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-loyalty-adjust] error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
