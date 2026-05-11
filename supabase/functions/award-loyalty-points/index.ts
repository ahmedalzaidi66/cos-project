import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // The DB trigger already fires on status=delivered, but this endpoint
    // allows manual/external invocation (e.g. from admin, webhooks).
    // It delegates to the same idempotent DB function.
    const { data, error } = await supabase.rpc("award_loyalty_points_for_order", {
      p_order_id: order_id,
    });

    if (error) throw error;

    const result = data as any;

    // If tier was upgraded, insert a special tier-up notification
    if (result?.tier_upgraded && result?.success) {
      const tierLabels: Record<string, string> = {
        silver: "Silver",
        gold: "Gold",
        platinum: "Platinum",
      };
      const newTierLabel = tierLabels[result.tier] ?? result.tier;

      // Resolve user_id from order
      const { data: order } = await supabase
        .from("orders")
        .select("user_id, customer_email")
        .eq("id", order_id)
        .maybeSingle();

      let userId = order?.user_id;
      if (!userId && order?.customer_email) {
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const match = authUsers?.users?.find((u: any) => u.email === order.customer_email);
        if (match) userId = match.id;
      }

      if (userId) {
        await supabase.from("order_notifications").insert({
          user_id: userId,
          order_id: order_id,
          title: `Tier Upgraded to ${newTierLabel}!`,
          body: `Congratulations! You've reached ${newTierLabel} tier with ${result.new_balance?.toLocaleString()} points.`,
          type: "order_delivered",
          is_read: false,
        });
      }
    }

    return new Response(JSON.stringify(result ?? { message: "processed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
