/**
 * Generates and opens a printable A4 order sheet in a new browser window.
 * Uses window.print() and @media print CSS for clean A4 output.
 * PDF export delegates to the browser's built-in Save as PDF.
 * Web-only.
 */

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

const STATUS_LABELS: Record<string, string> = {
  new: 'جديد',
  confirmed: 'مؤكد',
  preparing: 'قيد التحضير',
  shipped: 'مشحون',
  delivered: 'مُسلَّم',
  cancelled: 'ملغى',
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
  cod: 'الدفع عند الاستلام (COD)',
  card: 'بطاقة ائتمان',
  paypal: 'PayPal',
  apple: 'Apple Pay',
  online: 'دفع إلكتروني',
};

function fmt(n?: number): string {
  if (n == null) return '—';
  return Number(n).toLocaleString('ar-IQ') + ' IQD';
}

function escHtml(s?: string | null): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

function statusColor(s: string): string {
  return STATUS_COLORS[s] ?? '#888';
}

function paymentLabel(m?: string): string {
  if (!m) return '—';
  return PAYMENT_LABELS[m] ?? m.toUpperCase();
}

function buildQrUrl(text: string): string {
  return `https://chart.googleapis.com/chart?cht=qr&chs=150x150&chl=${encodeURIComponent(text)}&choe=UTF-8`;
}

function buildStaticMapUrl(lat: number, lng: number): string {
  // OpenStreetMap-based static map — no API key required, real coordinates
  // Uses staticmap.openstreetmap.de with a red marker pin
  const marker = `${lat},${lng}`;
  return (
    `https://staticmap.openstreetmap.de/staticmap.php` +
    `?center=${lat},${lng}` +
    `&zoom=15` +
    `&size=480x220` +
    `&markers=${marker},red-pushpin`
  );
}

function buildHtml(order: PrintOrder, items: PrintOrderItem[]): string {
  const orderId = order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(order.created_at).toLocaleString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const fullAddress = [
    order.street,
    order.area || order.state,
    order.governorate || order.city,
    order.country,
  ].filter(Boolean).join('، ');

  const hasGps = !!(order.delivery_latitude && order.delivery_longitude);
  const mapsLink = order.delivery_location_link ||
    (hasGps ? `https://www.google.com/maps?q=${order.delivery_latitude},${order.delivery_longitude}` : null);

  const subtotal = Number(order.subtotal ?? 0);
  const shipping = Number(order.shipping ?? 0);
  const discount = Number(order.discount ?? 0);
  const total    = Number(order.total ?? 0);

  const itemsHtml = items.map((item, idx) => {
    const lineTotal = (Number(item.unit_price) || 0) * (Number(item.quantity) || 0);
    const shadeCell = item.shade_name
      ? `<span class="shade-dot" style="background:${escHtml(item.shade_hex || '#aaa')}"></span>${escHtml(item.shade_name)}`
      : '—';
    const imgCell = item.product_image
      ? `<img src="${escHtml(item.product_image)}" class="prod-img" crossorigin="anonymous" />`
      : `<div class="prod-img-placeholder">${idx + 1}</div>`;
    return `
      <tr>
        <td class="center">${imgCell}</td>
        <td>
          <strong>${escHtml(item.product_name)}</strong>
          ${item.sku ? `<br/><span class="meta">SKU: ${escHtml(item.sku)}</span>` : ''}
        </td>
        <td class="center">${shadeCell}</td>
        <td class="center">${item.quantity}</td>
        <td class="right">${fmt(Number(item.unit_price))}</td>
        <td class="right bold">${fmt(lineTotal)}</td>
      </tr>`;
  }).join('');

  const staticMapUrl = hasGps
    ? buildStaticMapUrl(order.delivery_latitude!, order.delivery_longitude!)
    : null;

  const gpsSection = hasGps ? `
    <div class="section">
      <div class="section-title">الموقع الجغرافي</div>

      <!-- Static map image row -->
      <div class="map-row">
        <div class="map-img-wrap" id="map-wrap">
          <img
            id="static-map"
            src="${escHtml(staticMapUrl!)}"
            class="static-map-img"
            alt="خريطة موقع التوصيل"
            onerror="document.getElementById('map-wrap').innerHTML='<div class=\\'map-fallback\\'>تعذّر تحميل الخريطة — انظر رمز QR</div>'"
          />
          <div class="map-pin-label">📍 ${escHtml(order.delivery_latitude!.toFixed(5))}, ${escHtml(order.delivery_longitude!.toFixed(5))}</div>
        </div>

        <div class="map-sidebar">
          <div class="info-row" style="margin-bottom:8px">
            <span class="label">خط العرض</span>
            <span class="value">${order.delivery_latitude}</span>
          </div>
          <div class="info-row" style="margin-bottom:8px">
            <span class="label">خط الطول</span>
            <span class="value">${order.delivery_longitude}</span>
          </div>
          ${mapsLink ? `<div class="info-row" style="margin-bottom:12px">
            <span class="label">رابط الخريطة</span>
            <a href="${escHtml(mapsLink)}" class="map-link">${escHtml(mapsLink)}</a>
          </div>
          <div class="qr-cell" style="text-align:center">
            <img src="${buildQrUrl(mapsLink)}" class="qr-img" alt="QR Code للموقع"
              onerror="this.style.display='none'" />
            <div class="qr-label">امسح لفتح الموقع</div>
          </div>` : ''}
        </div>
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>طلب #${orderId} — Lazurde</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      direction: rtl;
      color: #1a1a2e;
      background: #fff;
      font-size: 13px;
      line-height: 1.5;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 12mm 14mm;
      background: #fff;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 10px;
      border-bottom: 3px solid #FF4D8D;
      margin-bottom: 18px;
    }
    .store-brand {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .store-name {
      font-size: 24px;
      font-weight: 900;
      color: #FF4D8D;
      letter-spacing: 2px;
    }
    .store-tagline {
      font-size: 11px;
      color: #888;
      letter-spacing: 1px;
    }
    .order-meta {
      text-align: left;
      gap: 4px;
    }
    .order-id {
      font-size: 22px;
      font-weight: 900;
      color: #1a1a2e;
      letter-spacing: 2px;
    }
    .order-date {
      font-size: 11px;
      color: #888;
      margin-top: 3px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      margin-top: 5px;
      border: 1.5px solid;
    }

    /* ── Section ── */
    .section {
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #FF4D8D;
      border-bottom: 1px solid #ffe0ec;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }

    /* ── Info grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 20px;
    }
    .info-row {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .label {
      font-size: 10px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .value {
      font-size: 13px;
      font-weight: 600;
      color: #1a1a2e;
    }

    /* ── Two-column layout for customer + delivery ── */
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    /* ── Products table ── */
    .prod-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .prod-table th {
      background: #fff5f9;
      color: #FF4D8D;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 8px 10px;
      border-bottom: 2px solid #ffe0ec;
      text-align: right;
    }
    .prod-table th.center,
    .prod-table td.center { text-align: center; }
    .prod-table th.right,
    .prod-table td.right  { text-align: left; }
    .prod-table td {
      padding: 9px 10px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: middle;
      color: #1a1a2e;
    }
    .prod-table tr:last-child td { border-bottom: none; }
    .prod-img {
      width: 44px;
      height: 44px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #eee;
    }
    .prod-img-placeholder {
      width: 44px;
      height: 44px;
      border-radius: 6px;
      background: #f8e8f0;
      border: 1px solid #ffe0ec;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      color: #FF4D8D;
    }
    .shade-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-left: 4px;
      vertical-align: middle;
      border: 1px solid #ccc;
    }
    .meta { font-size: 10px; color: #999; }
    .bold { font-weight: 800; }

    /* ── Totals ── */
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    .totals-table {
      width: 260px;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 10px;
      font-size: 13px;
      color: #444;
    }
    .totals-table .total-row td {
      border-top: 2px solid #FF4D8D;
      padding-top: 9px;
      font-size: 16px;
      font-weight: 900;
      color: #FF4D8D;
    }
    .totals-table td:last-child { text-align: left; font-weight: 600; }
    .totals-table .total-row td:last-child { color: #FF4D8D; }
    .free-ship { color: #00C853; font-weight: 700; }

    /* ── GPS / Map section ── */
    .map-row {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .map-img-wrap {
      flex: 1;
      border-radius: 8px;
      overflow: hidden;
      border: 1.5px solid #ffe0ec;
      position: relative;
      background: #f9f0f4;
      min-height: 80px;
    }
    .static-map-img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
    }
    .map-pin-label {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255,255,255,0.88);
      font-size: 10px;
      font-weight: 700;
      color: #FF4D8D;
      padding: 4px 8px;
      text-align: center;
      letter-spacing: 0.3px;
    }
    .map-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 80px;
      font-size: 11px;
      color: #aaa;
      background: #f9f0f4;
    }
    .map-sidebar {
      width: 170px;
      flex-shrink: 0;
    }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-left { vertical-align: top; padding-left: 20px; }
    .qr-cell { text-align: center; vertical-align: top; }
    .qr-img { width: 140px; height: 140px; border: 2px solid #ffe0ec; border-radius: 8px; }
    .qr-label { font-size: 10px; color: #888; margin-top: 4px; }
    .map-link {
      font-size: 10px;
      color: #FF4D8D;
      word-break: break-all;
      text-decoration: none;
    }

    /* ── Payment ── */
    .payment-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .pay-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #f8e8f0;
      color: #FF4D8D;
      border: 1px solid #ffe0ec;
    }
    .pay-status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #e8f5e9;
      color: #00C853;
      border: 1px solid #c8e6c9;
    }

    /* ── Footer ── */
    .footer {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #bbb;
    }
    .footer strong { color: #FF4D8D; }

    /* ── Print controls (screen only) ── */
    .print-controls {
      position: fixed;
      top: 16px;
      left: 16px;
      display: flex;
      gap: 10px;
      z-index: 9999;
    }
    .btn-print {
      padding: 10px 22px;
      background: #FF4D8D;
      color: #fff;
      border: none;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(255,77,141,0.4);
    }
    .btn-pdf {
      padding: 10px 22px;
      background: #fff;
      color: #FF4D8D;
      border: 2px solid #FF4D8D;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-close {
      padding: 10px 22px;
      background: #f5f5f5;
      color: #444;
      border: 1.5px solid #ddd;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-print:hover { background: #e0306a; }
    .btn-pdf:hover { background: #fff5f9; }

    /* ── @media print ── */
    @media print {
      @page {
        size: A4;
        margin: 12mm 14mm;
      }
      body { background: #fff; }
      .print-controls { display: none !important; }
      .page { width: 100%; padding: 0; margin: 0; }
      a { color: #FF4D8D !important; }
      .static-map-img {
        width: 100% !important;
        height: 190px !important;
        object-fit: cover !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .map-img-wrap {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .map-row { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Screen-only print controls -->
  <div class="print-controls">
    <button class="btn-print" onclick="window.print()">🖨 طباعة</button>
    <button class="btn-pdf" onclick="triggerPdf()">⬇ PDF</button>
    <button class="btn-close" onclick="window.close()">✕ إغلاق</button>
  </div>

  <div class="page">

    <!-- ── Header ── -->
    <div class="header">
      <div class="store-brand">
        <div class="store-name">LAZURDE</div>
        <div class="store-tagline">لازوردي للجمال والعناية</div>
      </div>
      <div class="order-meta">
        <div class="order-id">#${escHtml(orderId)}</div>
        <div class="order-date">${escHtml(orderDate)}</div>
        <div class="status-badge" style="color:${statusColor(order.status)};border-color:${statusColor(order.status)}">
          ${statusLabel(order.status)}
        </div>
      </div>
    </div>

    <!-- ── Customer + Delivery ── -->
    <div class="two-col">
      <div class="section">
        <div class="section-title">معلومات العميل</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="label">الاسم الكامل</span>
            <span class="value">${escHtml(order.customer_first_name)} ${escHtml(order.customer_last_name)}</span>
          </div>
          <div class="info-row">
            <span class="label">البريد الإلكتروني</span>
            <span class="value">${escHtml(order.customer_email)}</span>
          </div>
          <div class="info-row">
            <span class="label">رقم الهاتف</span>
            <span class="value">${escHtml(order.customer_phone) || '—'}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">عنوان التوصيل</div>
        <div class="info-grid">
          ${order.street ? `<div class="info-row">
            <span class="label">الشارع / المبنى</span>
            <span class="value">${escHtml(order.street)}</span>
          </div>` : ''}
          ${(order.area || order.state) ? `<div class="info-row">
            <span class="label">المنطقة</span>
            <span class="value">${escHtml(order.area || order.state)}</span>
          </div>` : ''}
          ${(order.governorate || order.city) ? `<div class="info-row">
            <span class="label">المحافظة / المدينة</span>
            <span class="value">${escHtml(order.governorate || order.city)}</span>
          </div>` : ''}
          ${order.country ? `<div class="info-row">
            <span class="label">الدولة</span>
            <span class="value">${escHtml(order.country)}</span>
          </div>` : ''}
          ${order.zip ? `<div class="info-row">
            <span class="label">الرمز البريدي</span>
            <span class="value">${escHtml(order.zip)}</span>
          </div>` : ''}
        </div>
        ${fullAddress ? `<div style="margin-top:8px;padding:7px 10px;background:#fff5f9;border-radius:6px;font-size:12px;color:#444;border:1px solid #ffe0ec;">
          📍 ${escHtml(fullAddress)}
        </div>` : ''}
      </div>
    </div>

    <!-- ── GPS Location ── -->
    ${gpsSection}

    <!-- ── Payment ── -->
    <div class="section">
      <div class="section-title">الدفع</div>
      <div class="payment-row">
        <span class="pay-badge">${paymentLabel(order.payment_method)}</span>
        ${order.payment_status ? `<span class="pay-status-badge">${escHtml(order.payment_status)}</span>` : ''}
      </div>
    </div>

    <!-- ── Products ── -->
    <div class="section">
      <div class="section-title">المنتجات (${items.length})</div>
      <table class="prod-table">
        <thead>
          <tr>
            <th class="center" style="width:52px"></th>
            <th>اسم المنتج</th>
            <th class="center">اللون / الظل</th>
            <th class="center">الكمية</th>
            <th class="right">سعر الوحدة</th>
            <th class="right">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px">لا توجد منتجات</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- ── Totals ── -->
    <div class="totals-wrap">
      <table class="totals-table">
        <tr>
          <td>المجموع الفرعي</td>
          <td>${fmt(subtotal)}</td>
        </tr>
        <tr>
          <td>رسوم الشحن</td>
          <td>${shipping === 0 ? '<span class="free-ship">مجاني</span>' : fmt(shipping)}</td>
        </tr>
        ${discount > 0 ? `<tr>
          <td>خصم / كوبون</td>
          <td style="color:#00C853">− ${fmt(discount)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td>الإجمالي</td>
          <td>${fmt(total)}</td>
        </tr>
      </table>
    </div>

    ${order.notes ? `<div class="section">
      <div class="section-title">ملاحظات الطلب</div>
      <div style="padding:10px;background:#fffde7;border:1px solid #fff9c4;border-radius:6px;font-size:13px;color:#444;">
        ${escHtml(order.notes)}
      </div>
    </div>` : ''}

    <!-- ── Footer ── -->
    <div class="footer">
      <span>طُبع في: ${new Date().toLocaleString('ar-EG')}</span>
      <span>Lazurde · <strong>lazurde.com</strong> · نظام إدارة الطلبات</span>
      <span>رقم الطلب: <strong>#${escHtml(orderId)}</strong></span>
    </div>

  </div>

  <script>
    function triggerPdf() {
      // Instruct user to use browser's Save as PDF
      var original = document.title;
      document.title = 'Lazurde-Order-${escHtml(orderId)}';
      window.print();
      document.title = original;
    }
    // Auto-focus so keyboard shortcuts work immediately
    window.focus();
  </script>
</body>
</html>`;
}

export function printOrder(order: PrintOrder, items: PrintOrderItem[]): void {
  if (typeof window === 'undefined') return;
  const html = buildHtml(order, items);
  const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
  if (!win) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة الطلب');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
