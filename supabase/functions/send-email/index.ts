/**
 * send-email — Lazurde transactional email Edge Function
 *
 * Provider: Resend (https://resend.com)
 * Sender:   noreply@lazurdebeauty.com  (EMAIL_FROM_ADDRESS)
 *
 * ── DNS records required on lazurdebeauty.com ────────────────────────────────
 * After adding the domain in Resend dashboard, add these DNS records:
 *
 *   SPF (TXT):   v=spf1 include:spf.resend.com -all
 *   DKIM:        Provided by Resend dashboard after domain verification
 *                (typically:  resend._domainkey.lazurdebeauty.com  CNAME  click.resend.com)
 *   DMARC (TXT): _dmarc.lazurdebeauty.com
 *                "v=DMARC1; p=reject; rua=mailto:dmarc@lazurdebeauty.com"
 *
 * ── Edge Function secrets required ──────────────────────────────────────────
 *   RESEND_API_KEY      — from https://resend.com/api-keys
 *   EMAIL_FROM_NAME     — e.g. "Lazurde Beauty"
 *   EMAIL_FROM_ADDRESS  — e.g. "noreply@lazurdebeauty.com"
 *   ADMIN_EMAIL         — e.g. "orders@lazurdebeauty.com"
 *
 * ── Supported email types ────────────────────────────────────────────────────
 *   order_confirmation   — to customer after checkout
 *   order_admin_notify   — to admin when new order placed
 *   order_status_update  — to customer when admin changes order status
 *   payment_confirmation — to customer when payment confirmed
 *   shipping_update      — to customer when order shipped/delivered
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  shade_name?: string;
  shade_hex?: string;
};

type OrderData = {
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
  items?: OrderItem[];
};

type EmailPayload =
  | { type: "order_confirmation";  order: OrderData }
  | { type: "order_admin_notify";  order: OrderData }
  | { type: "order_status_update"; order: OrderData; new_status: string }
  | { type: "payment_confirmation"; order: OrderData }
  | { type: "shipping_update"; order: OrderData; new_status: string };

// ── Config helpers ────────────────────────────────────────────────────────────

function fromAddress(): string {
  const name = Deno.env.get("EMAIL_FROM_NAME") ?? "Lazurde Beauty";
  const addr = Deno.env.get("EMAIL_FROM_ADDRESS") ?? "noreply@lazurdebeauty.com";
  return `${name} <${addr}>`;
}

function adminEmail(): string {
  return Deno.env.get("ADMIN_EMAIL") ?? "orders@lazurdebeauty.com";
}

function resendKey(): string {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY secret is not configured");
  return key;
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtPrice(n?: number): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("ar-IQ") + " IQD";
}

function fmtAddress(o: OrderData): string {
  return [o.street, o.area, o.governorate ?? o.city, o.country]
    .filter(Boolean)
    .join("، ");
}

const STATUS_LABELS: Record<string, string> = {
  new:       "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التحضير",
  shipped:   "مشحون",
  delivered: "مُسلَّم",
  cancelled: "ملغى",
};

const STATUS_LABELS_EN: Record<string, string> = {
  new:       "New",
  confirmed: "Confirmed",
  preparing: "Preparing",
  shipped:   "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS: Record<string, string> = {
  cod:    "الدفع عند الاستلام (COD)",
  card:   "بطاقة ائتمان",
  paypal: "PayPal",
  apple:  "Apple Pay",
};

function esc(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── HTML template shell ───────────────────────────────────────────────────────

function emailShell(title: string, bodyHtml: string, plainText: string): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f8f0f4;color:#1a0e14;direction:rtl}
  .wrap{max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;
        box-shadow:0 2px 16px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#1a0e14 0%,#2d1520 100%);padding:28px 32px;text-align:center}
  .logo{font-size:28px;font-weight:900;color:#FF4D8D;letter-spacing:3px}
  .logo-sub{font-size:11px;color:#994A75;letter-spacing:2px;margin-top:3px}
  .body{padding:28px 32px}
  .greeting{font-size:20px;font-weight:700;color:#1a0e14;margin-bottom:6px}
  .subtitle{font-size:14px;color:#666;margin-bottom:20px;line-height:1.6}
  .order-box{background:#fff5f9;border:1.5px solid #ffe0ec;border-radius:10px;padding:18px;margin:18px 0}
  .order-id{font-size:22px;font-weight:900;color:#FF4D8D;letter-spacing:2px}
  .order-date{font-size:12px;color:#994A75;margin-top:2px}
  .section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;
                 color:#FF4D8D;border-bottom:1px solid #ffe0ec;padding-bottom:5px;margin:18px 0 10px}
  .info-row{display:flex;justify-content:space-between;align-items:flex-start;
            padding:6px 0;border-bottom:1px solid #f8f0f4;gap:8px}
  .info-row:last-child{border-bottom:none}
  .info-label{font-size:12px;color:#994A75;font-weight:600;flex-shrink:0}
  .info-value{font-size:13px;color:#1a0e14;font-weight:600;text-align:left}
  table.items{width:100%;border-collapse:collapse;margin:10px 0}
  table.items th{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;
                 color:#FF4D8D;padding:7px 8px;background:#fff5f9;border-bottom:2px solid #ffe0ec;text-align:right}
  table.items td{padding:9px 8px;border-bottom:1px solid #f8f0f4;font-size:13px;color:#1a0e14;vertical-align:middle}
  table.items tr:last-child td{border-bottom:none}
  .shade-dot{display:inline-block;width:10px;height:10px;border-radius:50%;
             margin-left:4px;vertical-align:middle;border:1px solid #ccc}
  .totals{background:#fff5f9;border-radius:8px;padding:14px;margin-top:12px}
  .total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#444}
  .total-final{font-size:18px;font-weight:900;color:#FF4D8D;
               border-top:2px solid #FF4D8D;margin-top:8px;padding-top:8px}
  .status-badge{display:inline-block;padding:5px 16px;border-radius:999px;font-size:12px;font-weight:700;
                background:#fff0f6;color:#FF4D8D;border:1.5px solid #FF4D8D;margin:8px 0}
  .cta-btn{display:inline-block;background:#FF4D8D;color:#fff;padding:13px 28px;border-radius:999px;
           font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.5px;margin:18px 0}
  .cta-btn:hover{background:#e0306a}
  .map-link{color:#FF4D8D;font-size:12px;text-decoration:none;word-break:break-all}
  .footer{background:#1a0e14;padding:18px 32px;text-align:center}
  .footer-text{font-size:11px;color:#994A75;line-height:1.8}
  .footer-brand{font-size:14px;font-weight:800;color:#FF4D8D;letter-spacing:2px;margin-bottom:4px}
  @media(max-width:600px){
    .body{padding:20px 16px}
    .header{padding:20px 16px}
    .order-id{font-size:18px}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="logo">LAZURDE</div>
    <div class="logo-sub">لازوردي للجمال والعناية</div>
  </div>
  <div class="body">
    ${bodyHtml}
  </div>
  <div class="footer">
    <div class="footer-brand">LAZURDE</div>
    <div class="footer-text">
      lazurdebeauty.com · للدعم: support@lazurdebeauty.com<br/>
      © ${new Date().getFullYear()} Lazurde Beauty. All rights reserved.
    </div>
  </div>
</div>
</body>
</html>`;

  return { html, text: plainText };
}

// ── Item rows HTML helper ─────────────────────────────────────────────────────

function itemsHtml(items: OrderItem[]): string {
  if (!items.length) return "<p style='color:#999;font-size:13px'>لا توجد منتجات</p>";
  const rows = items.map((i) => {
    const shade = i.shade_name
      ? `<br/><span class="shade-dot" style="background:${esc(i.shade_hex || "#aaa")}"></span><span style="font-size:11px;color:#994A75">${esc(i.shade_name)}</span>`
      : "";
    const lineTotal = (Number(i.unit_price) || 0) * (Number(i.quantity) || 0);
    return `<tr>
      <td>${esc(i.product_name)}${shade}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:left">${fmtPrice(Number(i.unit_price))}</td>
      <td style="text-align:left;font-weight:700">${fmtPrice(lineTotal)}</td>
    </tr>`;
  }).join("");
  return `<table class="items">
    <thead><tr>
      <th>المنتج</th><th style="text-align:center">الكمية</th>
      <th style="text-align:left">السعر</th><th style="text-align:left">الإجمالي</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function totalsHtml(o: OrderData): string {
  const sub = Number(o.subtotal ?? 0);
  const ship = Number(o.shipping ?? 0);
  const total = Number(o.total ?? 0);
  return `<div class="totals">
    <div class="total-row"><span>المجموع الفرعي</span><span>${fmtPrice(sub)}</span></div>
    <div class="total-row"><span>رسوم الشحن</span><span>${ship === 0 ? '<span style="color:#00C853">مجاني</span>' : fmtPrice(ship)}</span></div>
    <div class="total-row total-final"><span>الإجمالي</span><span>${fmtPrice(total)}</span></div>
  </div>`;
}

function locationHtml(o: OrderData): string {
  if (!o.delivery_latitude || !o.delivery_longitude) return "";
  const link = o.delivery_location_link ||
    `https://www.google.com/maps?q=${o.delivery_latitude},${o.delivery_longitude}`;
  return `<div class="info-row">
    <span class="info-label">الموقع</span>
    <a href="${esc(link)}" class="map-link">📍 افتح على خرائط Google</a>
  </div>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

function tplOrderConfirmation(o: OrderData) {
  const orderId = o.id.slice(0, 8).toUpperCase();
  const name = esc(`${o.customer_first_name} ${o.customer_last_name}`);
  const addr = fmtAddress(o);
  const items = o.items ?? [];

  const body = `
    <div class="greeting">شكراً لطلبك، ${name}! 🎉</div>
    <p class="subtitle">تم استلام طلبك بنجاح وسنقوم بتجهيزه في أقرب وقت.</p>

    <div class="order-box">
      <div class="order-id">#${orderId}</div>
      <div class="order-date">${new Date(o.created_at).toLocaleString("ar-EG")}</div>
      <div class="status-badge">${STATUS_LABELS[o.status] ?? o.status}</div>
    </div>

    <div class="section-title">معلومات التوصيل</div>
    <div class="info-row"><span class="info-label">الاسم</span><span class="info-value">${name}</span></div>
    ${o.customer_phone ? `<div class="info-row"><span class="info-label">الهاتف</span><span class="info-value">${esc(o.customer_phone)}</span></div>` : ""}
    ${addr ? `<div class="info-row"><span class="info-label">العنوان</span><span class="info-value">${esc(addr)}</span></div>` : ""}
    ${locationHtml(o)}

    <div class="section-title">طريقة الدفع</div>
    <div class="info-row">
      <span class="info-label">الدفع</span>
      <span class="info-value">${esc(PAYMENT_LABELS[o.payment_method ?? ""] ?? o.payment_method ?? "—")}</span>
    </div>

    <div class="section-title">المنتجات (${items.length})</div>
    ${itemsHtml(items)}
    ${totalsHtml(o)}

    <p style="font-size:13px;color:#666;margin-top:16px;line-height:1.7">
      سيتم التواصل معك قريباً لتأكيد موعد التوصيل.<br/>
      للاستفسار: <a href="mailto:support@lazurdebeauty.com" style="color:#FF4D8D">support@lazurdebeauty.com</a>
    </p>`;

  const plain =
    `شكراً لطلبك من Lazurde Beauty\n\n` +
    `رقم الطلب: #${orderId}\n` +
    `الاسم: ${o.customer_first_name} ${o.customer_last_name}\n` +
    `الهاتف: ${o.customer_phone ?? "—"}\n` +
    `العنوان: ${addr || "—"}\n` +
    `الإجمالي: ${fmtPrice(Number(o.total))}\n` +
    `طريقة الدفع: ${PAYMENT_LABELS[o.payment_method ?? ""] ?? "—"}\n\n` +
    (o.delivery_location_link ? `الموقع: ${o.delivery_location_link}\n\n` : "") +
    `للاستفسار: support@lazurdebeauty.com`;

  return emailShell(`تأكيد طلبك #${orderId} — Lazurde`, body, plain);
}

function tplOrderAdminNotify(o: OrderData) {
  const orderId = o.id.slice(0, 8).toUpperCase();
  const name = esc(`${o.customer_first_name} ${o.customer_last_name}`);
  const addr = fmtAddress(o);
  const items = o.items ?? [];

  const body = `
    <div class="greeting">🛒 طلب جديد — #${orderId}</div>
    <p class="subtitle">${new Date(o.created_at).toLocaleString("ar-EG")}</p>

    <div class="section-title">بيانات العميل</div>
    <div class="info-row"><span class="info-label">الاسم</span><span class="info-value">${name}</span></div>
    <div class="info-row"><span class="info-label">البريد</span><span class="info-value">${esc(o.customer_email)}</span></div>
    ${o.customer_phone ? `<div class="info-row"><span class="info-label">الهاتف</span><span class="info-value">${esc(o.customer_phone)}</span></div>` : ""}
    ${addr ? `<div class="info-row"><span class="info-label">العنوان</span><span class="info-value">${esc(addr)}</span></div>` : ""}
    ${locationHtml(o)}

    <div class="section-title">الطلب</div>
    <div class="info-row">
      <span class="info-label">طريقة الدفع</span>
      <span class="info-value">${esc(PAYMENT_LABELS[o.payment_method ?? ""] ?? o.payment_method ?? "—")}</span>
    </div>
    <div class="info-row">
      <span class="info-label">حالة الدفع</span>
      <span class="info-value">${esc(o.payment_status ?? "pending")}</span>
    </div>

    <div class="section-title">المنتجات (${items.length})</div>
    ${itemsHtml(items)}
    ${totalsHtml(o)}`;

  const plain =
    `طلب جديد على Lazurde\n\n` +
    `رقم الطلب: #${orderId}\n` +
    `الاسم: ${o.customer_first_name} ${o.customer_last_name}\n` +
    `البريد: ${o.customer_email}\n` +
    `الهاتف: ${o.customer_phone ?? "—"}\n` +
    `العنوان: ${addr || "—"}\n` +
    `الإجمالي: ${fmtPrice(Number(o.total))}\n` +
    `طريقة الدفع: ${PAYMENT_LABELS[o.payment_method ?? ""] ?? "—"}\n` +
    (o.delivery_location_link ? `الموقع: ${o.delivery_location_link}\n` : "");

  return emailShell(`طلب جديد #${orderId} — لوحة الإدارة`, body, plain);
}

function tplOrderStatusUpdate(o: OrderData, newStatus: string) {
  const orderId = o.id.slice(0, 8).toUpperCase();
  const name = esc(`${o.customer_first_name} ${o.customer_last_name}`);
  const label = STATUS_LABELS[newStatus] ?? newStatus;
  const labelEn = STATUS_LABELS_EN[newStatus] ?? newStatus;

  const statusMessages: Record<string, string> = {
    confirmed: "تم تأكيد طلبك وسنبدأ في تجهيزه.",
    preparing: "يتم حالياً تجهيز طلبك بعناية.",
    shipped:   "تم شحن طلبك وهو في طريقه إليك!",
    delivered: "تم تسليم طلبك بنجاح. نتمنى أن تستمتعي به! 💄",
    cancelled: "تم إلغاء طلبك. للاستفسار تواصلي معنا.",
  };

  const msg = statusMessages[newStatus] ?? "تم تحديث حالة طلبك.";

  const body = `
    <div class="greeting">تحديث طلبك، ${name}</div>
    <p class="subtitle">${esc(msg)}</p>

    <div class="order-box">
      <div class="order-id">#${orderId}</div>
      <div class="status-badge">${label}</div>
    </div>

    <div class="section-title">تفاصيل الطلب</div>
    ${totalsHtml(o)}

    <p style="font-size:13px;color:#666;margin-top:16px;line-height:1.7">
      للاستفسار: <a href="mailto:support@lazurdebeauty.com" style="color:#FF4D8D">support@lazurdebeauty.com</a>
    </p>`;

  const plain =
    `تحديث حالة طلبك من Lazurde\n\n` +
    `رقم الطلب: #${orderId}\n` +
    `الحالة الجديدة: ${label} (${labelEn})\n` +
    `${msg}\n\n` +
    `للاستفسار: support@lazurdebeauty.com`;

  return emailShell(`تحديث طلبك #${orderId} — ${label}`, body, plain);
}

function tplPaymentConfirmation(o: OrderData) {
  const orderId = o.id.slice(0, 8).toUpperCase();
  const name = esc(`${o.customer_first_name} ${o.customer_last_name}`);

  const body = `
    <div class="greeting">تم استلام دفعتك ✅</div>
    <p class="subtitle">تم تأكيد دفعتك بنجاح لطلبك من Lazurde Beauty.</p>

    <div class="order-box">
      <div class="order-id">#${orderId}</div>
      <div class="info-row" style="margin-top:8px">
        <span class="info-label">المبلغ المدفوع</span>
        <span class="info-value" style="color:#FF4D8D;font-size:18px;font-weight:900">${fmtPrice(Number(o.total))}</span>
      </div>
      <div class="info-row">
        <span class="info-label">طريقة الدفع</span>
        <span class="info-value">${esc(PAYMENT_LABELS[o.payment_method ?? ""] ?? "—")}</span>
      </div>
    </div>

    <p style="font-size:13px;color:#666;margin-top:16px;line-height:1.7">
      للاستفسار: <a href="mailto:support@lazurdebeauty.com" style="color:#FF4D8D">support@lazurdebeauty.com</a>
    </p>`;

  const plain =
    `تم تأكيد دفعتك — Lazurde Beauty\n\n` +
    `رقم الطلب: #${orderId}\n` +
    `المبلغ: ${fmtPrice(Number(o.total))}\n` +
    `طريقة الدفع: ${PAYMENT_LABELS[o.payment_method ?? ""] ?? "—"}\n\n` +
    `للاستفسار: support@lazurdebeauty.com`;

  return emailShell(`تأكيد الدفع #${orderId} — Lazurde`, body, plain);
}

function tplShippingUpdate(o: OrderData, newStatus: string) {
  const orderId = o.id.slice(0, 8).toUpperCase();
  const name = esc(`${o.customer_first_name} ${o.customer_last_name}`);
  const isDelivered = newStatus === "delivered";

  const body = `
    <div class="greeting">${isDelivered ? "تم تسليم طلبك! 🎉" : "طلبك في الطريق! 🚚"}</div>
    <p class="subtitle">${isDelivered
      ? "تم تسليم طلبك بنجاح. نتمنى أن تعجبك منتجاتنا!"
      : "تم شحن طلبك وهو في طريقه إليك."}</p>

    <div class="order-box">
      <div class="order-id">#${orderId}</div>
      <div class="status-badge">${STATUS_LABELS[newStatus] ?? newStatus}</div>
    </div>

    ${locationHtml(o)}

    <p style="font-size:13px;color:#666;margin-top:16px;line-height:1.7">
      للاستفسار: <a href="mailto:support@lazurdebeauty.com" style="color:#FF4D8D">support@lazurdebeauty.com</a>
    </p>`;

  const plain =
    `تحديث شحن طلبك — Lazurde Beauty\n\n` +
    `رقم الطلب: #${orderId}\n` +
    `الحالة: ${STATUS_LABELS[newStatus] ?? newStatus}\n` +
    (o.delivery_location_link ? `الموقع: ${o.delivery_location_link}\n` : "") +
    `\nللاستفسار: support@lazurdebeauty.com`;

  return emailShell(
    isDelivered ? `تم تسليم طلبك #${orderId}` : `طلبك في الطريق #${orderId}`,
    body,
    plain
  );
}

// ── Send via Resend ───────────────────────────────────────────────────────────

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = resendKey();

  // Basic recipient validation
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRe.test(opts.to)) {
    return { ok: false, error: `Invalid recipient: ${opts.to}` };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      reply_to: opts.replyTo,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = (body as any)?.message ?? `Resend API error ${res.status}`;
    // Log safely — no secrets
    console.error(`[send-email] Resend error:`, errMsg);
    return { ok: false, error: errMsg };
  }

  console.log(`[send-email] Sent to ${opts.to} — id: ${(body as any)?.id}`);
  return { ok: true, id: (body as any)?.id };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: EmailPayload = await req.json();

    let result: { ok: boolean; id?: string; error?: string };

    switch (payload.type) {
      case "order_confirmation": {
        const { html, text } = tplOrderConfirmation(payload.order);
        const orderId = payload.order.id.slice(0, 8).toUpperCase();
        result = await sendViaResend({
          to: payload.order.customer_email,
          subject: `تأكيد طلبك #${orderId} — Lazurde Beauty`,
          html,
          text,
          replyTo: "support@lazurdebeauty.com",
        });
        break;
      }

      case "order_admin_notify": {
        const { html, text } = tplOrderAdminNotify(payload.order);
        const orderId = payload.order.id.slice(0, 8).toUpperCase();
        result = await sendViaResend({
          to: adminEmail(),
          subject: `🛒 طلب جديد #${orderId} — ${payload.order.customer_first_name} ${payload.order.customer_last_name}`,
          html,
          text,
        });
        break;
      }

      case "order_status_update": {
        const { html, text } = tplOrderStatusUpdate(payload.order, payload.new_status);
        const orderId = payload.order.id.slice(0, 8).toUpperCase();
        const label = STATUS_LABELS[payload.new_status] ?? payload.new_status;
        result = await sendViaResend({
          to: payload.order.customer_email,
          subject: `تحديث طلبك #${orderId} — ${label}`,
          html,
          text,
          replyTo: "support@lazurdebeauty.com",
        });
        break;
      }

      case "payment_confirmation": {
        const { html, text } = tplPaymentConfirmation(payload.order);
        const orderId = payload.order.id.slice(0, 8).toUpperCase();
        result = await sendViaResend({
          to: payload.order.customer_email,
          subject: `تأكيد الدفع #${orderId} — Lazurde Beauty`,
          html,
          text,
          replyTo: "support@lazurdebeauty.com",
        });
        break;
      }

      case "shipping_update": {
        const { html, text } = tplShippingUpdate(payload.order, payload.new_status);
        const orderId = payload.order.id.slice(0, 8).toUpperCase();
        const label = STATUS_LABELS[payload.new_status] ?? payload.new_status;
        result = await sendViaResend({
          to: payload.order.customer_email,
          subject: `تحديث الشحن #${orderId} — ${label}`,
          html,
          text,
          replyTo: "support@lazurdebeauty.com",
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown email type" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    // Never expose stack traces or env values
    const message = err?.message?.includes("RESEND_API_KEY")
      ? "Email service not configured"
      : (err?.message ?? "Internal error");
    console.error("[send-email] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
