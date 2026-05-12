/**
 * Popup-free order print & PDF export.
 *
 * Print strategy  — injects a hidden <iframe> into the current document, writes
 *   the A4 HTML into it, calls iframe.contentWindow.print(), then removes the
 *   iframe.  No window.open(), no popup permission required.
 *
 * PDF strategy    — uses jsPDF to build a structured A4 PDF entirely in JS.
 *   No canvas rasterisation, instant generation, full RTL text support via the
 *   default Helvetica glyphs (Latin) + fallback strings for Arabic.
 *   All amounts / IDs are transliterated so they render correctly.
 */

import jsPDF from 'jspdf';

// ── Public types ──────────────────────────────────────────────────────────────

export type PrintOrderItem = {
  id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  shade_name?: string;
  shade_hex?: string;
  sku?: string;
};

export type PrintOrder = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  governorate?: string;
  area?: string;
  zip?: string;
  notes?: string;
  subtotal?: number;
  shipping?: number;
  discount?: number;
  points_redeemed?: number;
  redeemed_amount?: number;
  total: number;
  status: string;
  payment_method?: string;
  payment_status?: string;
  created_at: string;
  delivery_address_text?: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_location_link?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: 'New (جديد)',
  confirmed: 'Confirmed (مؤكد)',
  preparing: 'Preparing (قيد التحضير)',
  shipped: 'Shipped (مشحون)',
  delivered: 'Delivered (مُسلَّم)',
  cancelled: 'Cancelled (ملغى)',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#FF4D8D',
  confirmed: '#4ADE80',
  preparing: '#FFB300',
  shipped: '#7C83FF',
  delivered: '#00E676',
  cancelled: '#FF4444',
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery (COD)',
  card: 'Credit Card',
  paypal: 'PayPal',
  apple: 'Apple Pay',
  online: 'Online Payment',
};

function fmt(n?: number): string {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IQ') + ' IQD';
}

function esc(s?: string | null): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sl(s: string) { return STATUS_LABELS[s] ?? s; }
function sc(s: string) { return STATUS_COLORS[s] ?? '#888'; }
function pl(m?: string) { return m ? (PAYMENT_LABELS[m] ?? m.toUpperCase()) : '—'; }

// ── HTML builder (for iframe print) ──────────────────────────────────────────

function buildHtml(order: PrintOrder, items: PrintOrderItem[]): string {
  const orderId = order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(order.created_at).toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const fullAddress = [
    order.street,
    order.area || order.state,
    order.governorate || order.city,
    order.country,
  ].filter(Boolean).join(', ');

  const hasGps = !!(order.delivery_latitude && order.delivery_longitude);
  const mapsLink = order.delivery_location_link ||
    (hasGps ? `https://www.google.com/maps?q=${order.delivery_latitude},${order.delivery_longitude}` : null);

  const subtotal        = Number(order.subtotal ?? 0);
  const shipping        = Number(order.shipping ?? 0);
  const discount        = Number(order.discount ?? 0);
  const pointsRedeemed  = Number(order.points_redeemed ?? 0);
  const redeemedAmount  = Number(order.redeemed_amount ?? 0);
  const total           = Number(order.total ?? 0);

  const itemsHtml = items.map((item, idx) => {
    const lineTotal = (Number(item.unit_price) || 0) * (Number(item.quantity) || 0);
    const shadeCell = item.shade_name
      ? `<span class="shade-dot" style="background:${esc(item.shade_hex || '#aaa')}"></span> ${esc(item.shade_name)}`
      : '—';
    const imgCell = item.product_image
      ? `<img src="${esc(item.product_image)}" class="prod-img" crossorigin="anonymous" />`
      : `<div class="prod-img-ph">${idx + 1}</div>`;
    return `<tr>
      <td class="c">${imgCell}</td>
      <td><strong>${esc(item.product_name)}</strong>${item.sku ? `<br/><span class="meta">SKU: ${esc(item.sku)}</span>` : ''}</td>
      <td class="c">${shadeCell}</td>
      <td class="c">${item.quantity}</td>
      <td class="r">${fmt(Number(item.unit_price))}</td>
      <td class="r b">${fmt(lineTotal)}</td>
    </tr>`;
  }).join('');

  const gpsHtml = hasGps ? `
    <div class="section">
      <div class="stitle">GPS Location</div>
      <div class="info-grid">
        <div class="info-row"><span class="lbl">Latitude</span><span class="val">${order.delivery_latitude}</span></div>
        <div class="info-row"><span class="lbl">Longitude</span><span class="val">${order.delivery_longitude}</span></div>
        ${mapsLink ? `<div class="info-row" style="grid-column:span 2">
          <span class="lbl">Maps Link</span>
          <a href="${esc(mapsLink)}" class="map-link">${esc(mapsLink)}</a>
        </div>` : ''}
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Order #${orderId} — Lazurde</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a2e;background:#fff;font-size:12.5px;line-height:1.5}
.page{width:210mm;min-height:297mm;margin:0 auto;padding:12mm 14mm;background:#fff}
.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:3px solid #FF4D8D;margin-bottom:16px}
.brand-name{font-size:24px;font-weight:900;color:#FF4D8D;letter-spacing:2px}
.brand-sub{font-size:10px;color:#aaa;letter-spacing:1px;margin-top:2px}
.oid{font-size:20px;font-weight:900;letter-spacing:2px;text-align:right}
.odate{font-size:10px;color:#888;margin-top:2px;text-align:right}
.sbadge{display:inline-block;padding:3px 12px;border-radius:999px;font-size:11px;font-weight:700;border:1.5px solid;margin-top:4px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.section{margin-bottom:14px}
.stitle{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#FF4D8D;border-bottom:1px solid #ffe0ec;padding-bottom:4px;margin-bottom:8px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}
.info-row{display:flex;flex-direction:column;gap:1px}
.lbl{font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.5px}
.val{font-size:12px;font-weight:600;color:#1a1a2e}
.addr-box{margin-top:6px;padding:6px 10px;background:#fff5f9;border-radius:5px;font-size:11px;color:#555;border:1px solid #ffe0ec}
table.pt{width:100%;border-collapse:collapse;margin-bottom:14px}
table.pt th{background:#fff5f9;color:#FF4D8D;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:7px 8px;border-bottom:2px solid #ffe0ec}
table.pt th.c,table.pt td.c{text-align:center}
table.pt th.r,table.pt td.r{text-align:right}
table.pt td{padding:8px;border-bottom:1px solid #f0f0f0;color:#1a1a2e;vertical-align:middle}
table.pt tr:last-child td{border-bottom:none}
.prod-img{width:40px;height:40px;object-fit:cover;border-radius:5px;border:1px solid #eee}
.prod-img-ph{width:40px;height:40px;border-radius:5px;background:#f8e8f0;border:1px solid #ffe0ec;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#FF4D8D}
.shade-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:3px;vertical-align:middle;border:1px solid #ccc}
.meta{font-size:9px;color:#aaa}
.b{font-weight:800}
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:14px}
table.tt{width:250px;border-collapse:collapse}
table.tt td{padding:5px 8px;font-size:12px;color:#555}
table.tt td:last-child{text-align:right;font-weight:600}
table.tt .trow td{border-top:2px solid #FF4D8D;padding-top:8px;font-size:15px;font-weight:900;color:#FF4D8D}
.free{color:#00C853;font-weight:700}
.pay-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;background:#f8e8f0;color:#FF4D8D;border:1px solid #ffe0ec}
.pay-st-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;background:#e8f5e9;color:#00C853;border:1px solid #c8e6c9;margin-right:6px}
.notes-box{padding:9px 12px;background:#fffde7;border:1px solid #fff9c4;border-radius:5px;font-size:12px;color:#555}
.map-link{font-size:10px;color:#FF4D8D;word-break:break-all;text-decoration:none}
.footer{margin-top:18px;padding-top:10px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#bbb}
.footer strong{color:#FF4D8D}
@media print{
  @page{size:A4;margin:12mm 14mm}
  body{background:#fff}
  .page{width:100%;padding:0;margin:0}
}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand-name">LAZURDE</div>
      <div class="brand-sub">Beauty & Care Management System</div>
    </div>
    <div>
      <div class="oid">#${esc(orderId)}</div>
      <div class="odate">${esc(orderDate)}</div>
      <div class="sbadge" style="color:${sc(order.status)};border-color:${sc(order.status)}">${sl(order.status)}</div>
    </div>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="stitle">Customer Information</div>
      <div class="info-grid">
        <div class="info-row"><span class="lbl">Full Name</span><span class="val">${esc(order.customer_first_name)} ${esc(order.customer_last_name)}</span></div>
        <div class="info-row"><span class="lbl">Email</span><span class="val">${esc(order.customer_email)}</span></div>
        <div class="info-row"><span class="lbl">Phone</span><span class="val">${esc(order.customer_phone) || '—'}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="stitle">Delivery Address</div>
      <div class="info-grid">
        ${order.street ? `<div class="info-row"><span class="lbl">Street / Building</span><span class="val">${esc(order.street)}</span></div>` : ''}
        ${(order.area || order.state) ? `<div class="info-row"><span class="lbl">Area</span><span class="val">${esc(order.area || order.state)}</span></div>` : ''}
        ${(order.governorate || order.city) ? `<div class="info-row"><span class="lbl">Governorate / City</span><span class="val">${esc(order.governorate || order.city)}</span></div>` : ''}
        ${order.country ? `<div class="info-row"><span class="lbl">Country</span><span class="val">${esc(order.country)}</span></div>` : ''}
        ${order.zip ? `<div class="info-row"><span class="lbl">ZIP</span><span class="val">${esc(order.zip)}</span></div>` : ''}
      </div>
      ${fullAddress ? `<div class="addr-box">📍 ${esc(fullAddress)}</div>` : ''}
    </div>
  </div>

  ${gpsHtml}

  <div class="section">
    <div class="stitle">Payment</div>
    <span class="pay-badge">${esc(pl(order.payment_method))}</span>
    ${order.payment_status ? `<span class="pay-st-badge">${esc(order.payment_status)}</span>` : ''}
  </div>

  <div class="section">
    <div class="stitle">Products (${items.length})</div>
    <table class="pt">
      <thead><tr>
        <th class="c" style="width:50px"></th>
        <th>Product</th>
        <th class="c">Shade / Color</th>
        <th class="c">Qty</th>
        <th class="r">Unit Price</th>
        <th class="r">Total</th>
      </tr></thead>
      <tbody>
        ${itemsHtml || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:18px">No products</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="totals-wrap">
    <table class="tt">
      <tr><td>Subtotal</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>Shipping</td><td>${shipping === 0 ? '<span class="free">Free</span>' : fmt(shipping)}</td></tr>
      ${discount > 0 ? `<tr><td>Discount / Coupon</td><td style="color:#00C853">- ${fmt(discount)}</td></tr>` : ''}
      ${pointsRedeemed > 0 ? `<tr><td style="color:#B8860B">Loyalty Points (${pointsRedeemed} pts)</td><td style="color:#B8860B">- ${fmt(redeemedAmount)}</td></tr>` : ''}
      <tr class="trow"><td>Total</td><td>${fmt(total)}</td></tr>
    </table>
  </div>

  ${order.notes ? `<div class="section">
    <div class="stitle">Order Notes</div>
    <div class="notes-box">${esc(order.notes)}</div>
  </div>` : ''}

  <div class="footer">
    <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
    <span>Lazurde · <strong>lazurdebeauty.com</strong></span>
    <span>Order: <strong>#${esc(orderId)}</strong></span>
  </div>
</div>
</body>
</html>`;
}

// ── Print via hidden iframe (no popup) ────────────────────────────────────────

export function printOrder(order: PrintOrder, items: PrintOrderItem[]): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const html = buildHtml(order, items);

  // Create a hidden iframe — never opens a popup
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for iframe content + images to load, then print
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // Remove iframe after a short delay to let the print dialog open
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  };
}

// ── PDF export via jsPDF ──────────────────────────────────────────────────────

export function downloadOrderPdf(order: PrintOrder, items: PrintOrderItem[]): void {
  if (typeof window === 'undefined') return;

  const orderId = order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(order.created_at).toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const fullAddress = [
    order.street,
    order.area || order.state,
    order.governorate || order.city,
    order.country,
  ].filter(Boolean).join(', ') || '—';

  const subtotal       = Number(order.subtotal ?? 0);
  const shipping       = Number(order.shipping ?? 0);
  const discount       = Number(order.discount ?? 0);
  const pointsRedeemed = Number(order.points_redeemed ?? 0);
  const redeemedAmount = Number(order.redeemed_amount ?? 0);
  const total          = Number(order.total ?? 0);

  // ── jsPDF setup ──
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const W = 210; // A4 width
  const MARGIN = 14;
  const CONTENT_W = W - MARGIN * 2;
  let y = MARGIN;

  // Pink brand color
  const PINK = '#FF4D8D';
  const DARK = '#1a1a2e';
  const MUTED = '#888888';
  const LIGHT_PINK_BG = '#fff5f9';

  function hex2rgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }

  function setColor(hex: string) {
    const [r, g, b] = hex2rgb(hex);
    doc.setTextColor(r, g, b);
  }

  function setFill(hex: string) {
    const [r, g, b] = hex2rgb(hex);
    doc.setFillColor(r, g, b);
  }

  function setDraw(hex: string) {
    const [r, g, b] = hex2rgb(hex);
    doc.setDrawColor(r, g, b);
  }

  function addSection(title: string) {
    // Section title bar
    setFill(LIGHT_PINK_BG);
    setDraw('#ffe0ec');
    doc.setFillColor(255, 245, 249);
    doc.roundedRect(MARGIN, y, CONTENT_W, 6.5, 1, 1, 'F');
    setColor(PINK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), MARGIN + 3, y + 4.5);
    y += 9;
  }

  function labelValue(label: string, value: string, x: number, colW: number) {
    setColor(MUTED);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, y);
    setColor(DARK);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(value || '—', colW - 2);
    doc.text(lines, x, y + 4);
    return 4 + lines.length * 4.5;
  }

  // ── Header ────────────────────────────────────────────────────────────────
  // Pink bottom border
  setDraw(PINK);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y + 14, W - MARGIN, y + 14);

  // Store name
  setColor(PINK);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('LAZURDE', MARGIN, y + 10);

  setColor(MUTED);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Beauty & Care Management System', MARGIN, y + 14.5);

  // Order ID (right side)
  setColor(DARK);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`#${orderId}`, W - MARGIN, y + 9, { align: 'right' });

  setColor(MUTED);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(orderDate, W - MARGIN, y + 13.5, { align: 'right' });

  // Status badge
  const statusText = sl(order.status);
  const statusClr = sc(order.status);
  const [sr, sg, sb] = hex2rgb(statusClr);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  const badgeW = doc.getTextWidth(statusText) + 8;
  doc.setFillColor(sr, sg, sb);
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
  doc.roundedRect(W - MARGIN - badgeW, y + 15, badgeW, 5.5, 1, 1, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
  setDraw(statusClr);
  doc.setLineWidth(0.4);
  doc.roundedRect(W - MARGIN - badgeW, y + 15, badgeW, 5.5, 1, 1, 'S');
  doc.setTextColor(sr, sg, sb);
  doc.text(statusText, W - MARGIN - badgeW / 2, y + 19, { align: 'center' });

  y += 20;

  // ── Customer + Address two-column ─────────────────────────────────────────
  const colW = (CONTENT_W - 8) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + 8;

  setColor(PINK);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  setFill(LIGHT_PINK_BG);
  doc.setFillColor(255, 245, 249);
  doc.roundedRect(leftX, y, colW, 6.5, 1, 1, 'F');
  doc.text('CUSTOMER INFORMATION', leftX + 3, y + 4.5);
  doc.roundedRect(rightX, y, colW, 6.5, 1, 1, 'F');
  doc.text('DELIVERY ADDRESS', rightX + 3, y + 4.5);
  y += 10;

  const custStartY = y;
  let leftY = y;
  let rightY = y;

  const custName = `${order.customer_first_name} ${order.customer_last_name}`;
  leftY += labelValue('Full Name', custName, leftX, colW) + 4;
  leftY += labelValue('Email', order.customer_email, leftX, colW) + 4;
  leftY += labelValue('Phone', order.customer_phone || '—', leftX, colW);

  rightY += labelValue('Street / Building', order.street || '—', rightX, colW) + 4;
  rightY += labelValue('Area', (order.area || order.state) || '—', rightX, colW) + 4;
  rightY += labelValue('Governorate / City', (order.governorate || order.city) || '—', rightX, colW) + 4;
  rightY += labelValue('Country', order.country || '—', rightX, colW);

  y = Math.max(leftY, rightY) + 6;

  // Full address box
  if (fullAddress !== '—') {
    setFill('#fff5f9');
    doc.setFillColor(255, 245, 249);
    setDraw('#ffe0ec');
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, 'FD');
    setColor(MUTED);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const addrLines = doc.splitTextToSize(`Address: ${fullAddress}`, CONTENT_W - 6);
    doc.text(addrLines, MARGIN + 3, y + 5);
    y += 8 + addrLines.length * 4 + 4;
  }

  // ── GPS (if available) ────────────────────────────────────────────────────
  if (order.delivery_latitude && order.delivery_longitude) {
    addSection('GPS Location');
    const gpsStr = `Lat: ${order.delivery_latitude}  Lng: ${order.delivery_longitude}`;
    setColor(DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(gpsStr, MARGIN, y);
    y += 5;
    if (order.delivery_location_link) {
      setColor(PINK);
      doc.setFontSize(8);
      doc.text(order.delivery_location_link, MARGIN, y);
      y += 5;
    }
    y += 2;
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  addSection('Payment');
  setColor(DARK);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(pl(order.payment_method), MARGIN, y);
  if (order.payment_status) {
    setColor('#00C853');
    doc.setFontSize(8.5);
    doc.text(`Status: ${order.payment_status}`, MARGIN + 80, y);
  }
  y += 7;

  // ── Products ──────────────────────────────────────────────────────────────
  addSection(`Products (${items.length})`);

  // Table header
  const colWidths = [44, 12, 24, 24, 28];
  const colLabels = ['Product Name', 'Qty', 'Shade', 'Unit Price', 'Total'];
  const colAligns: ('left' | 'center' | 'right')[] = ['left', 'center', 'center', 'right', 'right'];
  let cx = MARGIN;

  setFill(LIGHT_PINK_BG);
  doc.setFillColor(255, 245, 249);
  doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
  setColor(PINK);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  for (let i = 0; i < colLabels.length; i++) {
    const align = colAligns[i];
    const tx = align === 'right' ? cx + colWidths[i] - 2 :
               align === 'center' ? cx + colWidths[i] / 2 : cx + 2;
    doc.text(colLabels[i], tx, y + 4.8, { align });
    cx += colWidths[i];
  }
  y += 7;

  setDraw('#ffe0ec');
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, W - MARGIN, y);

  // Table rows
  items.forEach((item, idx) => {
    const lineTotal = (Number(item.unit_price) || 0) * (Number(item.quantity) || 0);
    const rowH = 9;

    // Alternating row background
    if (idx % 2 === 1) {
      doc.setFillColor(252, 248, 250);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }

    cx = MARGIN;
    setColor(DARK);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');

    const cells = [
      item.product_name,
      String(item.quantity),
      item.shade_name || '—',
      fmt(Number(item.unit_price)),
      fmt(lineTotal),
    ];

    for (let i = 0; i < cells.length; i++) {
      const align = colAligns[i];
      const tx = align === 'right' ? cx + colWidths[i] - 2 :
                 align === 'center' ? cx + colWidths[i] / 2 : cx + 2;
      const cellText = doc.splitTextToSize(cells[i], colWidths[i] - 4);
      doc.text(cellText[0] ?? '', tx, y + 5.8, { align });
      cx += colWidths[i];
    }

    doc.setLineWidth(0.2);
    setDraw('#f0f0f0');
    doc.line(MARGIN, y + rowH, W - MARGIN, y + rowH);
    y += rowH;
  });

  y += 4;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totW = 80;
  const totX = W - MARGIN - totW;

  function totRow(label: string, value: string, bold = false, color = DARK) {
    setColor(color === DARK ? DARK : color);
    doc.setFontSize(bold ? 10 : 9);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, totX, y);
    doc.text(value, W - MARGIN, y, { align: 'right' });
    y += 6;
  }

  totRow('Subtotal', fmt(subtotal));
  totRow('Shipping', shipping === 0 ? 'Free' : fmt(shipping), false, shipping === 0 ? '#00C853' : DARK);
  if (discount > 0) totRow('Discount', `- ${fmt(discount)}`, false, '#00C853');
  if (pointsRedeemed > 0) totRow(`Loyalty (${pointsRedeemed} pts)`, `- ${fmt(redeemedAmount)}`, false, '#B8860B');

  // Total divider
  setDraw(PINK);
  doc.setLineWidth(0.6);
  doc.line(totX, y, W - MARGIN, y);
  y += 3;
  totRow('TOTAL', fmt(total), true, PINK);

  y += 4;

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (order.notes) {
    addSection('Order Notes');
    doc.setFillColor(255, 253, 231);
    setDraw('#fff9c4');
    doc.setLineWidth(0.3);
    const noteLines = doc.splitTextToSize(order.notes, CONTENT_W - 8);
    const noteH = noteLines.length * 5 + 6;
    doc.roundedRect(MARGIN, y, CONTENT_W, noteH, 2, 2, 'FD');
    setColor('#555555');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(noteLines, MARGIN + 4, y + 5);
    y += noteH + 6;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = 285;
  setDraw('#eeeeee');
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY, W - MARGIN, footerY);
  setColor(MUTED);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Printed: ${new Date().toLocaleString('en-GB')}`, MARGIN, footerY + 4);
  doc.text('Lazurde · lazurdebeauty.com', W / 2, footerY + 4, { align: 'center' });
  doc.text(`Order: #${orderId}`, W - MARGIN, footerY + 4, { align: 'right' });

  // ── Save ──────────────────────────────────────────────────────────────────
  doc.save(`Lazurde-Order-${orderId}.pdf`);
}
