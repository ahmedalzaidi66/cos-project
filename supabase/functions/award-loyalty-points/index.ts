import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TIER_THRESHOLDS = { bronze: 0, silver: 2000, gold: 5000, platinum: 15000 };

function getTier(lifetime: number): string {
  if (lifetime >= 15000) return "platinum";
  if (lifetime >= 5000) return "gold";
  if (lifetime >= 2000) return "silver";
  return "bronze";
}

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

    // Fetch order with user_email
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, user_id, total, points_earned, points_redeemed, status, user_email")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status !== "delivered") {
      return new Response(JSON.stringify({ error: "Order not delivered yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.points_earned > 0) {
      return new Response(JSON.stringify({ message: "Points already awarded", points: order.points_earned }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch loyalty settings
    const { data: settings } = await supabase
      .from("loyalty_settings")
      .select("earning_enabled, points_per_iqd, min_order_to_earn")
      .eq("id", 1)
      .maybeSingle();

    if (!settings?.earning_enabled) {
      return new Response(JSON.stringify({ message: "Earning disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderTotal = Number(order.total) || 0;
    if (orderTotal < (settings.min_order_to_earn || 0)) {
      return new Response(JSON.stringify({ message: "Order below minimum" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user_id — prefer stored user_id, fall back to email lookup
    let userId: string | null = order.user_id || null;
    if (!userId && order.user_email) {
      const { data: authUser } = await supabase.auth.admin.listUsers();
      const match = authUser?.users?.find((u: any) => u.email === order.user_email);
      if (match) userId = match.id;
    }

    if (!userId) {
      return new Response(JSON.stringify({ message: "No auth user for this order" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate points from order total minus any redeemed value
    const pointsPerIqd = Number(settings.points_per_iqd) || 0.001;
    // Deduct redeemed amount before awarding (don't earn points on points-paid portion)
    const { data: loyaltyRow } = await supabase
      .from("customer_loyalty")
      .select("iqd_per_point")
      .eq("user_id", userId)
      .maybeSingle();

    // Use settings iqd_per_point for calculating how much was paid via points
    const { data: settingsFull } = await supabase
      .from("loyalty_settings")
      .select("iqd_per_point")
      .eq("id", 1)
      .maybeSingle();

    const iqd_per_point = Number(settingsFull?.iqd_per_point) || 1;
    const redeemedIqd = (order.points_redeemed || 0) * iqd_per_point;
    const earnableTotal = Math.max(0, orderTotal - redeemedIqd);
    const pointsToAward = Math.floor(earnableTotal * pointsPerIqd);

    if (pointsToAward <= 0) {
      // Still mark order as processed
      await supabase.from("orders").update({ points_earned: 0 }).eq("id", order_id);
      return new Response(JSON.stringify({ message: "No points to award" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert customer_loyalty
    const { data: existing } = await supabase
      .from("customer_loyalty")
      .select("total_points, lifetime_points")
      .eq("user_id", userId)
      .maybeSingle();

    const newTotal = (existing?.total_points || 0) + pointsToAward;
    const newLifetime = (existing?.lifetime_points || 0) + pointsToAward;
    const newTier = getTier(newLifetime);

    const { error: upsertErr } = await supabase.from("customer_loyalty").upsert(
      {
        user_id: userId,
        total_points: newTotal,
        lifetime_points: newLifetime,
        tier: newTier,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertErr) throw upsertErr;

    // Insert earn transaction
    await supabase.from("loyalty_transactions").insert({
      user_id: userId,
      order_id: order_id,
      type: "earn",
      points: pointsToAward,
      balance_after: newTotal,
      note: `Order #${order_id} delivered`,
    });

    // Mark points_earned on order
    await supabase.from("orders").update({ points_earned: pointsToAward }).eq("id", order_id);

    return new Response(
      JSON.stringify({ success: true, points_awarded: pointsToAward, new_balance: newTotal, tier: newTier }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
