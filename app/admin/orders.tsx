import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
  Linking,
  Clipboard,
  Platform,
} from 'react-native';
import { Search, X, Phone, MessageCircle, Copy, ChevronRight, CircleAlert as AlertCircle, RefreshCw, ShoppingCart, MapPin, Calendar, CreditCard, CircleCheck as CheckCircle, Printer, FileDown, Bell, Check } from 'lucide-react-native';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { supabase, adminSupabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';
import { printOrder, downloadOrderPdf, type PrintOrder, type PrintOrderItem } from '@/components/admin/OrderPrintView';
import { sendOrderStatusUpdate, sendShippingUpdate, sendOrderPushNotification } from '@/lib/email';

const WHATSAPP_NUMBER = '9647XXXXXXXX';

type Order = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  governorate?: string;
  area?: string;
  notes?: string;
  subtotal?: number;
  shipping?: number;
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

type OrderItem = {
  id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  shade_name?: string;
  shade_hex?: string;
};

const STATUS_FLOW = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];

const STATUS_COLORS: Record<string, string> = {
  new: Colors.neonBlue,
  confirmed: '#4ADE80',
  preparing: Colors.warning,
  shipped: '#7C83FF',
  delivered: Colors.success,
  cancelled: Colors.error,
};

const STATUS_LABELS: Record<string, string> = {
  new: 'جديد',
  confirmed: 'مؤكد',
  preparing: 'قيد التحضير',
  shipped: 'مشحون',
  delivered: 'مُسلَّم',
  cancelled: 'ملغى',
};

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? Colors.textMuted;
}

function statusLabel(s: string) {
  return STATUS_LABELS[s] ?? s;
}

function paymentLabel(method?: string) {
  if (!method) return '—';
  if (method === 'cod') return 'COD — الدفع عند الاستلام';
  if (method === 'card') return 'بطاقة ائتمان';
  if (method === 'online') return 'دفع إلكتروني';
  return method.toUpperCase();
}

function buildWhatsAppMessage(order: Order, items: OrderItem[], language: string) {
  const itemsList = items
    .map((i) => `${i.product_name}${i.shade_name ? ` (${i.shade_name})` : ''} x${i.quantity}`)
    .join('، ');
  const address = [order.street, order.city, order.country].filter(Boolean).join('، ');
  return (
    `طلب جديد:\n` +
    `رقم الطلب: ${order.id.slice(0, 8).toUpperCase()}\n` +
    `الاسم: ${order.customer_first_name} ${order.customer_last_name}\n` +
    `الهاتف: ${order.customer_phone ?? '—'}\n` +
    `العنوان: ${address || '—'}\n` +
    `المجموع: ${formatPrice(Number(order.total), language)}\n` +
    `طريقة الدفع: ${paymentLabel(order.payment_method)}\n` +
    `المنتجات: ${itemsList || '—'}`
  );
}

function OrderDetailModal({
  order,
  visible,
  onClose,
  onStatusUpdated,
}: {
  order: Order;
  visible: boolean;
  onClose: () => void;
  onStatusUpdated: (id: string, status: string) => void;
}) {
  const { language } = useLanguage();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const [successMsg, setSuccessMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCurrentStatus(order.status);
    setSuccessMsg('');
    setCopied(false);
    setLoadingItems(true);
    supabase
      .from('order_items')
      .select('id, product_name, product_image, quantity, unit_price, shade_name, shade_hex')
      .eq('order_id', order.id)
      .then(({ data, error }) => {
        if (error) console.error('[AdminOrders] order_items fetch error:', error.message);
        setItems(data ?? []);
        setLoadingItems(false);
      })
      .catch((err) => {
        console.error('[AdminOrders] order_items unexpected error:', err?.message ?? err);
        setItems([]);
        setLoadingItems(false);
      });
  }, [visible, order.id, order.status]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setUpdatingStatus(true);
    const { error } = await adminSupabase()
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    setUpdatingStatus(false);
    if (!error) {
      setCurrentStatus(newStatus);
      onStatusUpdated(order.id, newStatus);
      setSuccessMsg('تم تحديث الحالة');
      setTimeout(() => setSuccessMsg(''), 2500);

      // Send customer notifications in background (non-blocking)
      const emailOrder = {
        ...order,
        status: newStatus,
        items: items.map((i) => ({
          product_name: i.product_name,
          quantity:     i.quantity,
          unit_price:   i.unit_price,
          shade_name:   i.shade_name,
          shade_hex:    i.shade_hex,
        })),
      };
      if (newStatus === 'shipped' || newStatus === 'delivered') {
        sendShippingUpdate(emailOrder, newStatus);
      } else if (newStatus !== 'new') {
        sendOrderStatusUpdate(emailOrder, newStatus);
      }

      // Send push notification — look up customer's auth_user_id
      if (newStatus !== 'new') {
        supabase
          .from('customers')
          .select('auth_user_id')
          .eq('email', order.customer_email)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.auth_user_id) {
              sendOrderPushNotification(data.auth_user_id, order.id, newStatus);
            }
          })
          .catch(() => {});
      }
    }
  };

  const handleCopy = () => {
    const text = buildWhatsAppMessage(order, items, language);
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(text).catch(() => {});
    } else {
      Clipboard.setString(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const phone = order.customer_phone?.replace(/\D/g, '') ?? WHATSAPP_NUMBER;
    const target = phone.length >= 8 ? phone : WHATSAPP_NUMBER;
    const msg = buildWhatsAppMessage(order, items, language);
    Linking.openURL(`https://wa.me/${target}?text=${encodeURIComponent(msg)}`);
  };

  const buildPrintData = (): { printData: PrintOrder; printItems: PrintOrderItem[] } => {
    const printItems: PrintOrderItem[] = items.map((i) => ({
      id: i.id,
      product_name: i.product_name,
      product_image: i.product_image,
      quantity: i.quantity,
      unit_price: i.unit_price,
      shade_name: i.shade_name,
      shade_hex: i.shade_hex,
    }));
    const printData: PrintOrder = {
      id: order.id,
      customer_first_name: order.customer_first_name,
      customer_last_name: order.customer_last_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      street: order.street,
      city: order.city,
      state: order.state,
      zip: order.zip,
      country: order.country,
      governorate: order.governorate,
      area: order.area,
      notes: order.notes,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      created_at: order.created_at,
      delivery_address_text: order.delivery_address_text,
      delivery_latitude: order.delivery_latitude,
      delivery_longitude: order.delivery_longitude,
      delivery_location_link: order.delivery_location_link,
    };
    return { printData, printItems };
  };

  const handlePrint = () => {
    if (Platform.OS !== 'web') return;
    const { printData, printItems } = buildPrintData();
    printOrder(printData, printItems);
  };

  const handleDownloadPdf = () => {
    if (Platform.OS !== 'web') return;
    const { printData, printItems } = buildPrintData();
    downloadOrderPdf(printData, printItems);
  };

  const address = [order.street, order.city, order.country].filter(Boolean).join('، ');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.root}>
        {/* Header */}
        <View style={modal.header}>
          <View style={{ flex: 1 }}>
            <Text style={modal.title}>
              #{order.id.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={modal.subtitle}>
              {new Date(order.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={modal.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} color={Colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView style={modal.body} showsVerticalScrollIndicator={false}>
          {/* Customer info */}
          <View style={modal.card}>
            <Text style={modal.cardTitle}>معلومات العميل</Text>
            <InfoRow icon={<CheckCircle size={15} color={Colors.neonBlue} strokeWidth={2} />}
              label={`${order.customer_first_name} ${order.customer_last_name}`} />
            {order.customer_phone ? (
              <InfoRow icon={<Phone size={15} color={Colors.success} strokeWidth={2} />}
                label={order.customer_phone} />
            ) : null}
            {address ? (
              <InfoRow icon={<MapPin size={15} color={Colors.warning} strokeWidth={2} />}
                label={address} />
            ) : null}
            <InfoRow icon={<Calendar size={15} color={Colors.textMuted} strokeWidth={2} />}
              label={new Date(order.created_at).toLocaleString('ar-EG')} />
          </View>

          {/* Payment & status */}
          <View style={modal.card}>
            <Text style={modal.cardTitle}>الدفع والحالة</Text>
            <InfoRow icon={<CreditCard size={15} color={Colors.neonBlue} strokeWidth={2} />}
              label={paymentLabel(order.payment_method)} />
            <View style={modal.statusBadgeRow}>
              <View style={[modal.statusBadge, { backgroundColor: statusColor(currentStatus) + '22' }]}>
                <Text style={[modal.statusBadgeText, { color: statusColor(currentStatus) }]}>
                  {statusLabel(currentStatus)}
                </Text>
              </View>
              {order.payment_status ? (
                <View style={modal.payStatusBadge}>
                  <Text style={modal.payStatusText}>{order.payment_status}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Order total */}
          <View style={modal.card}>
            <Text style={modal.cardTitle}>ملخص الطلب</Text>
            {order.subtotal != null && (
              <View style={modal.summaryRow}>
                <Text style={modal.summaryLabel}>المجموع الفرعي</Text>
                <Text style={modal.summaryValue}>{formatPrice(Number(order.subtotal), language)}</Text>
              </View>
            )}
            {order.shipping != null && (
              <View style={modal.summaryRow}>
                <Text style={modal.summaryLabel}>الشحن</Text>
                <Text style={modal.summaryValue}>
                  {Number(order.shipping) === 0 ? 'مجاني' : formatPrice(Number(order.shipping), language)}
                </Text>
              </View>
            )}
            <View style={[modal.summaryRow, { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.sm, marginTop: 2 }]}>
              <Text style={[modal.summaryLabel, { color: Colors.textPrimary, fontWeight: '700' }]}>الإجمالي</Text>
              <Text style={modal.totalValue}>{formatPrice(Number(order.total), language)}</Text>
            </View>
          </View>

          {/* Status timeline + changer */}
          <View style={modal.card}>
            <Text style={modal.cardTitle}>مسار الحالة</Text>
            {successMsg ? (
              <View style={modal.successBanner}>
                <CheckCircle size={14} color={Colors.success} strokeWidth={2} />
                <Text style={modal.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Timeline */}
            <View style={modal.timeline}>
              {STATUS_FLOW.filter((s) => s !== 'cancelled').map((s, idx, arr) => {
                const currentIdx = STATUS_FLOW.indexOf(currentStatus);
                const thisIdx   = STATUS_FLOW.indexOf(s);
                const isDone    = currentStatus !== 'cancelled' && thisIdx < currentIdx;
                const isActive  = s === currentStatus;
                const isLast    = idx === arr.length - 1;
                const color     = isDone || isActive ? statusColor(s) : Colors.border;
                return (
                  <View key={s} style={modal.timelineStep}>
                    <View style={modal.timelineLeft}>
                      <TouchableOpacity
                        onPress={() => handleUpdateStatus(s)}
                        activeOpacity={0.7}
                        disabled={updatingStatus}
                        style={[
                          modal.timelineDot,
                          { borderColor: color, backgroundColor: isActive ? color + '30' : Colors.backgroundSecondary },
                        ]}
                      >
                        {isDone
                          ? <Check size={10} color={statusColor(s)} strokeWidth={3} />
                          : <View style={[modal.timelineDotInner, { backgroundColor: isActive ? color : Colors.border }]} />
                        }
                      </TouchableOpacity>
                      {!isLast && <View style={[modal.timelineConnector, { backgroundColor: isDone ? statusColor(arr[idx]) : Colors.border }]} />}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(s)}
                      activeOpacity={0.7}
                      disabled={updatingStatus}
                      style={modal.timelineLabelWrap}
                    >
                      <Text style={[modal.timelineLabel, { color: isActive ? statusColor(s) : isDone ? Colors.textSecondary : Colors.textMuted, fontWeight: isActive ? '800' : '600' }]}>
                        {statusLabel(s)}
                      </Text>
                      {isActive && (
                        <View style={[modal.timelineActiveBadge, { backgroundColor: statusColor(s) + '20', borderColor: statusColor(s) + '50' }]}>
                          <Text style={[modal.timelineActiveBadgeText, { color: statusColor(s) }]}>الحالة الحالية</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
              {/* Cancelled as separate row */}
              <View style={modal.timelineStep}>
                <View style={modal.timelineLeft}>
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus('cancelled')}
                    activeOpacity={0.7}
                    disabled={updatingStatus}
                    style={[
                      modal.timelineDot,
                      {
                        borderColor: currentStatus === 'cancelled' ? Colors.error : Colors.border,
                        backgroundColor: currentStatus === 'cancelled' ? Colors.error + '20' : Colors.backgroundSecondary,
                      },
                    ]}
                  >
                    <View style={[modal.timelineDotInner, { backgroundColor: currentStatus === 'cancelled' ? Colors.error : Colors.border }]} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => handleUpdateStatus('cancelled')}
                  activeOpacity={0.7}
                  disabled={updatingStatus}
                  style={modal.timelineLabelWrap}
                >
                  <Text style={[modal.timelineLabel, { color: currentStatus === 'cancelled' ? Colors.error : Colors.textMuted, fontWeight: currentStatus === 'cancelled' ? '800' : '600' }]}>
                    {statusLabel('cancelled')}
                  </Text>
                  {currentStatus === 'cancelled' && (
                    <View style={[modal.timelineActiveBadge, { backgroundColor: Colors.error + '20', borderColor: Colors.error + '50' }]}>
                      <Text style={[modal.timelineActiveBadgeText, { color: Colors.error }]}>الحالة الحالية</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {updatingStatus && <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 8 }} />}
          </View>

          {/* Items */}
          <View style={modal.card}>
            <Text style={modal.cardTitle}>المنتجات</Text>
            {loadingItems ? (
              <ActivityIndicator color={Colors.neonBlue} style={{ marginVertical: 16 }} />
            ) : items.length === 0 ? (
              <Text style={modal.emptyText}>لا توجد منتجات</Text>
            ) : (
              items.map((item, idx) => (
                <View key={item.id ?? idx} style={modal.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={modal.itemName} numberOfLines={2}>{item.product_name}</Text>
                    {item.shade_name ? (
                      <View style={modal.shadeRow}>
                        <View style={[modal.shadeDot, { backgroundColor: item.shade_hex || '#888' }]} />
                        <Text style={modal.shadeText}>{item.shade_name}</Text>
                      </View>
                    ) : null}
                    <Text style={modal.itemQty}>الكمية: {item.quantity}</Text>
                  </View>
                  <Text style={modal.itemTotal}>
                    {formatPrice((Number(item.unit_price) || 0) * (Number(item.quantity) || 0), language)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Print / PDF actions (web only) */}
          {Platform.OS === 'web' && (
            <View style={modal.printRow}>
              <TouchableOpacity
                style={modal.printBtn}
                onPress={handlePrint}
                activeOpacity={0.8}
                disabled={loadingItems}
              >
                <Printer size={16} color="#fff" strokeWidth={2} />
                <Text style={modal.printBtnText}>طباعة الطلب</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={modal.pdfBtn}
                onPress={handleDownloadPdf}
                activeOpacity={0.8}
                disabled={loadingItems}
              >
                <FileDown size={16} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={modal.pdfBtnText}>تحميل PDF</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Actions */}
          <View style={modal.actionsRow}>
            <TouchableOpacity style={modal.whatsappBtn} onPress={handleWhatsApp} activeOpacity={0.8}>
              <MessageCircle size={18} color="#fff" strokeWidth={2} />
              <Text style={modal.whatsappBtnText}>واتساب</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.copyBtn, copied && { borderColor: Colors.success }]}
              onPress={handleCopy}
              activeOpacity={0.8}
            >
              <Copy size={16} color={copied ? Colors.success : Colors.neonBlue} strokeWidth={2} />
              <Text style={[modal.copyBtnText, copied && { color: Colors.success }]}>
                {copied ? 'تم النسخ' : 'نسخ التفاصيل'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={modal.infoRow}>
      {icon}
      <Text style={modal.infoText}>{label}</Text>
    </View>
  );
}

function OrdersContent() {
  const { language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const initialLoadDone = useRef(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await adminSupabase()
        .from('orders')
        .select('id, customer_first_name, customer_last_name, customer_email, customer_phone, street, city, state, zip, country, governorate, area, notes, subtotal, shipping, total, status, payment_method, payment_status, created_at, delivery_address_text, delivery_latitude, delivery_longitude, delivery_location_link')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      setOrders(data ?? []);
      initialLoadDone.current = true;
    } catch (e: any) {
      setLoadError(e?.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Realtime subscription for new orders
  useEffect(() => {
    channelRef.current = supabase
      .channel('admin_orders_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          if (!initialLoadDone.current) return;
          const newOrder = payload.new as Order;
          setOrders((prev) => {
            if (prev.some((o) => o.id === newOrder.id)) return prev;
            return [newOrder, ...prev];
          });
          setNewOrderAlert((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  const handleStatusUpdated = (id: string, newStatus: string) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o));
  };

  const filtered = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      q === '' ||
      `${o.customer_first_name} ${o.customer_last_name}`.toLowerCase().includes(q) ||
      o.customer_email.toLowerCase().includes(q) ||
      (o.customer_phone ?? '').includes(q) ||
      o.id.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
        <Text style={styles.loadingText}>جارٍ تحميل الطلبات…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.errorState}>
        <AlertCircle size={36} color={Colors.error} strokeWidth={1.5} />
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchOrders} activeOpacity={0.8}>
          <RefreshCw size={15} color={Colors.background} strokeWidth={2} />
          <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* New order alert */}
      {newOrderAlert > 0 && (
        <TouchableOpacity
          style={styles.newOrderBanner}
          onPress={() => setNewOrderAlert(0)}
          activeOpacity={0.8}
        >
          <Bell size={15} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.newOrderBannerText}>
            {newOrderAlert === 1 ? 'طلب جديد وصل!' : `${newOrderAlert} طلبات جديدة وصلت!`}
          </Text>
          <X size={13} color={Colors.neonBlue} strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="بحث برقم الطلب / الاسم / الهاتف"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {['all', ...STATUS_FLOW].map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.filterChip,
              statusFilter === s && {
                backgroundColor: s === 'all' ? Colors.neonBlueGlow : statusColor(s) + '20',
                borderColor: s === 'all' ? Colors.neonBlueBorder : statusColor(s) + '70',
              },
            ]}
            onPress={() => setStatusFilter(s)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterChipText,
              statusFilter === s && { color: s === 'all' ? Colors.neonBlue : statusColor(s) },
            ]}>
              {s === 'all' ? 'الكل' : statusLabel(s)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <Text style={styles.countText}>
        {filtered.length} {filtered.length === 1 ? 'طلب' : 'طلبات'}
      </Text>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <ShoppingCart size={40} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyText}>لا توجد طلبات</Text>
        </View>
      ) : (
        filtered.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={styles.orderCard}
            onPress={() => openOrder(order)}
            activeOpacity={0.8}
          >
            <View style={styles.orderCardLeft}>
              <Text style={styles.orderName}>
                {order.customer_first_name} {order.customer_last_name}
              </Text>
              <View style={styles.orderMetaRow}>
                {order.payment_method === 'cod' && (
                  <View style={styles.codChip}>
                    <Text style={styles.codChipText}>COD</Text>
                  </View>
                )}
                {order.customer_phone ? (
                  <Text style={styles.orderPhone}>{order.customer_phone}</Text>
                ) : null}
              </View>
              <Text style={styles.orderDate}>
                {new Date(order.created_at).toLocaleDateString('ar-EG')}
                {' · '}
                <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
              </Text>
            </View>
            <View style={styles.orderCardRight}>
              <Text style={styles.orderTotal}>{formatPrice(Number(order.total), language)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(order.status) + '22' }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor(order.status) }]}>
                  {statusLabel(order.status)}
                </Text>
              </View>
              {order.customer_phone && (
                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    const phone = order.customer_phone!.replace(/\D/g, '');
                    Linking.openURL(`https://wa.me/${phone}`);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <MessageCircle size={14} color="#25D366" strokeWidth={2} />
                </TouchableOpacity>
              )}
              <ChevronRight size={14} color={Colors.textMuted} strokeWidth={2} />
            </View>
          </TouchableOpacity>
        ))
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onStatusUpdated={handleStatusUpdated}
        />
      )}
    </View>
  );
}

function OrdersScreen() {
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title="الطلبات" showBack>
        <OrdersContent />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title="الطلبات">
      <OrdersContent />
    </AdminWebDashboard>
  );
}

export default function OrdersScreenGuarded() {
  return (
    <AdminGuard permission="manage_orders">
      <OrdersScreen />
    </AdminGuard>
  );
}

// ── Modal styles ────────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    gap: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  body: {
    flex: 1,
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: 8,
  },
  cardTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  payStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  payStatusText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  summaryValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  totalValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  statusBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  statusBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success + '18',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    marginBottom: 4,
  },
  successText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 8,
  },
  itemName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  shadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  shadeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shadeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  itemQty: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  itemTotal: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '800',
    minWidth: 70,
    textAlign: 'right',
  },
  printRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  printBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#1a1a2e',
    borderRadius: Radius.full,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: '#444',
  },
  printBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  pdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.full,
    paddingVertical: 13,
    backgroundColor: Colors.neonBlueGlow,
  },
  pdfBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    borderRadius: Radius.full,
    paddingVertical: 14,
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.full,
    paddingVertical: 14,
    backgroundColor: Colors.neonBlueGlow,
  },
  copyBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  timeline: {
    gap: 0,
    marginTop: 4,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    minHeight: 44,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 28,
    paddingTop: 2,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    minHeight: 16,
    marginVertical: 2,
    borderRadius: 1,
  },
  timelineLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 5,
    paddingBottom: Spacing.sm,
  },
  timelineLabel: {
    fontSize: FontSize.sm,
  },
  timelineActiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  timelineActiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

// ── List styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centered: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  errorState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.md,
    textAlign: 'center',
    maxWidth: 340,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonBlue,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  retryBtnText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  searchRow: {
    marginBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  filterScroll: {
    marginBottom: Spacing.sm,
  },
  filterRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  countText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  orderCardLeft: {
    flex: 1,
    marginRight: Spacing.sm,
    gap: 3,
  },
  orderCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codChip: {
    backgroundColor: Colors.success + '20',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  codChipText: {
    color: Colors.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  orderPhone: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  orderDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  orderId: {
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  orderTotal: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  waBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#25D36620',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newOrderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  newOrderBannerText: {
    flex: 1,
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
