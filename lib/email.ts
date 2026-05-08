/**
 * Client-side email helper — calls the send-email Edge Function.
 * The Resend API key lives only in the Edge Function; nothing sensitive
 * is ever sent to or bundled in the browser.
 */

import { supabase } from '@/lib/supabase';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  (process.env as any).supabaseUrl;

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  (process.env as any).supabaseAnonKey;

function edgeFunctionUrl(slug: string): string {
  return `${SUPABASE_URL}/functions/v1/${slug}`;
}

// ── Types mirroring the Edge Function payload ─────────────────────────────────

export type EmailOrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  shade_name?: string;
  shade_hex?: string;
};

export type EmailOrderData = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone?: string;
  street?: string;
  city?: string;
  governorate?: string;
  area?: string;
  country?: string;
  subtotal?: number;
  shipping?: number;
  total: number;
  status: string;
  payment_method?: string;
  payment_status?: string;
  created_at: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_location_link?: string | null;
  items?: EmailOrderItem[];
};

type EmailPayload =
  | { type: 'order_confirmation';  order: EmailOrderData }
  | { type: 'order_admin_notify';  order: EmailOrderData }
  | { type: 'order_status_update'; order: EmailOrderData; new_status: string }
  | { type: 'payment_confirmation'; order: EmailOrderData }
  | { type: 'shipping_update';     order: EmailOrderData; new_status: string };

// ── Core send helper ──────────────────────────────────────────────────────────

async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? SUPABASE_ANON_KEY;

    const res = await fetch(edgeFunctionUrl('send-email'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Apikey: SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (body as any)?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Network error' };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Send order confirmation to the customer after successful checkout. */
export async function sendOrderConfirmation(order: EmailOrderData): Promise<void> {
  const result = await sendEmail({ type: 'order_confirmation', order });
  if (!result.ok) {
    console.warn('[email] order_confirmation failed:', result.error);
  }
}

/** Notify admin inbox about a new order. */
export async function sendOrderAdminNotification(order: EmailOrderData): Promise<void> {
  const result = await sendEmail({ type: 'order_admin_notify', order });
  if (!result.ok) {
    console.warn('[email] order_admin_notify failed:', result.error);
  }
}

/** Notify customer when admin changes order status. */
export async function sendOrderStatusUpdate(
  order: EmailOrderData,
  newStatus: string
): Promise<void> {
  const result = await sendEmail({ type: 'order_status_update', order, new_status: newStatus });
  if (!result.ok) {
    console.warn('[email] order_status_update failed:', result.error);
  }
}

/** Confirm payment received. */
export async function sendPaymentConfirmation(order: EmailOrderData): Promise<void> {
  const result = await sendEmail({ type: 'payment_confirmation', order });
  if (!result.ok) {
    console.warn('[email] payment_confirmation failed:', result.error);
  }
}

/** Notify customer of shipping / delivery status change. */
export async function sendShippingUpdate(
  order: EmailOrderData,
  newStatus: string
): Promise<void> {
  const result = await sendEmail({ type: 'shipping_update', order, new_status: newStatus });
  if (!result.ok) {
    console.warn('[email] shipping_update failed:', result.error);
  }
}

// ── Push notification helper ───────────────────────────────────────────────────

const PUSH_TITLE_BY_STATUS: Record<string, string> = {
  confirmed: 'Order Confirmed',
  preparing: 'Order Being Prepared',
  shipped:   'Order Shipped',
  delivered: 'Order Delivered',
  cancelled: 'Order Cancelled',
};

const PUSH_BODY_BY_STATUS: Record<string, string> = {
  confirmed: 'Your order has been confirmed.',
  preparing: "We're preparing your order now.",
  shipped:   'Your order is on its way!',
  delivered: 'Your order has been delivered.',
  cancelled: 'Your order has been cancelled.',
};

/**
 * Send an Expo push notification to a user when their order status changes.
 * Calls the send-push-notification Edge Function which looks up their tokens.
 */
export async function sendOrderPushNotification(
  userId: string,
  orderId: string,
  newStatus: string
): Promise<void> {
  const title = PUSH_TITLE_BY_STATUS[newStatus];
  const body  = PUSH_BODY_BY_STATUS[newStatus];
  if (!title || !userId) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? SUPABASE_ANON_KEY;

    await fetch(edgeFunctionUrl('send-push-notification'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Apikey: SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({
        user_id: userId,
        title,
        body: `${body} Order #${orderId.slice(0, 8).toUpperCase()}`,
        data: { order_id: orderId, status: newStatus },
      }),
    });
  } catch (e: any) {
    console.warn('[push] sendOrderPushNotification failed:', e?.message ?? e);
  }
}
