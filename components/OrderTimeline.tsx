import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, X, Package, CheckCheck, Truck, ClipboardCheck, Plus } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { useAppColors } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_FLOW: OrderStatus[] = ['new', 'confirmed', 'preparing', 'shipped', 'delivered'];

const STATUS_COLORS: Record<OrderStatus, string> = {
  new:       Colors.neonBlue,
  confirmed: '#4ADE80',
  preparing: Colors.warning,
  shipped:   '#7C83FF',
  delivered: Colors.success,
  cancelled: Colors.error,
};

const STATUS_ICONS: Record<OrderStatus, React.ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  new:       Plus,
  confirmed: ClipboardCheck,
  preparing: Package,
  shipped:   Truck,
  delivered: CheckCheck,
  cancelled: X,
};

function getStatusLabel(status: OrderStatus, t: Record<string, string>): string {
  const map: Record<OrderStatus, string> = {
    new:       t.orderStatusNew       ?? 'New',
    confirmed: t.orderStatusConfirmed ?? 'Confirmed',
    preparing: t.orderStatusPreparing ?? 'Preparing',
    shipped:   t.orderStatusShipped   ?? 'Shipped',
    delivered: t.orderStatusDelivered ?? 'Delivered',
    cancelled: t.orderStatusCancelled ?? 'Cancelled',
  };
  return map[status] ?? status;
}

interface OrderTimelineProps {
  status: OrderStatus | string;
  trackingNumber?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  compact?: boolean;
}

export default function OrderTimeline({
  status,
  trackingNumber,
  completedAt,
  createdAt,
  compact = false,
}: OrderTimelineProps) {
  const C = useAppColors();
  const { t, language } = useLanguage();
  const isRTL = language === 'ar' || language === 'ckb';

  const isCancelled = status === 'cancelled';
  const currentIdx = STATUS_FLOW.indexOf(status as OrderStatus);

  return (
    <View style={styles.container}>
      {/* Cancelled banner */}
      {isCancelled && (
        <View style={[styles.cancelBanner, { backgroundColor: Colors.error + '15', borderColor: Colors.error + '40' }]}>
          <X size={14} color={Colors.error} strokeWidth={2.5} />
          <Text style={[styles.cancelBannerText, { color: Colors.error }]}>
            {t.orderCancelledNote ?? 'This order has been cancelled'}
          </Text>
        </View>
      )}

      {/* Timeline steps */}
      {STATUS_FLOW.map((step, idx) => {
        const isDone   = !isCancelled && currentIdx > idx;
        const isActive = !isCancelled && status === step;
        const color    = isDone || isActive ? STATUS_COLORS[step] : (C.border);
        const isLast   = idx === STATUS_FLOW.length - 1;
        const Icon     = STATUS_ICONS[step];

        return (
          <View key={step} style={[styles.step, isRTL && styles.stepRTL]}>
            {/* Left column: dot + connector */}
            <View style={styles.dotCol}>
              <View
                style={[
                  styles.dot,
                  {
                    borderColor: color,
                    backgroundColor: isActive
                      ? color + '22'
                      : isDone
                      ? color + '18'
                      : C.backgroundCard,
                  },
                ]}
              >
                {isDone ? (
                  <Check size={compact ? 9 : 11} color={STATUS_COLORS[step]} strokeWidth={3} />
                ) : isActive ? (
                  <Icon size={compact ? 9 : 11} color={color} strokeWidth={2.5} />
                ) : (
                  <View style={[styles.dotInner, { backgroundColor: C.border }]} />
                )}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: isDone ? STATUS_COLORS[step] + '80' : C.border + '60' },
                  ]}
                />
              )}
            </View>

            {/* Right column: label + meta */}
            <View style={[styles.labelCol, isLast && styles.labelColLast]}>
              <View style={styles.labelRow}>
                <Text
                  style={[
                    styles.label,
                    {
                      color: isActive
                        ? STATUS_COLORS[step]
                        : isDone
                        ? C.textSecondary
                        : C.textMuted,
                      fontWeight: isActive ? '700' : isDone ? '600' : '400',
                      fontSize: compact ? FontSize.xs : FontSize.sm,
                    },
                  ]}
                >
                  {getStatusLabel(step, t)}
                </Text>
                {isActive && (
                  <View
                    style={[
                      styles.activePill,
                      {
                        backgroundColor: STATUS_COLORS[step] + '20',
                        borderColor: STATUS_COLORS[step] + '50',
                      },
                    ]}
                  >
                    <Text style={[styles.activePillText, { color: STATUS_COLORS[step] }]}>
                      {t.orderCurrentStatus ?? 'Current Status'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Tracking number (only on shipped step) */}
              {isActive && step === 'shipped' && trackingNumber ? (
                <Text style={[styles.meta, { color: C.textMuted }]}>
                  {t.orderTrackingNumber ?? 'Tracking'}: {trackingNumber}
                </Text>
              ) : null}

              {/* Completion date (only on delivered step) */}
              {isActive && step === 'delivered' && completedAt ? (
                <Text style={[styles.meta, { color: C.textMuted }]}>
                  {t.orderCompletedOn ?? 'Delivered on'}{' '}
                  {new Date(completedAt).toLocaleDateString(
                    language === 'ar' ? 'ar-EG' : language === 'ckb' ? 'ku' : 'en-US',
                    { year: 'numeric', month: 'short', day: 'numeric' }
                  )}
                </Text>
              ) : null}

              {/* Show tracking on shipped-done step too */}
              {isDone && step === 'shipped' && trackingNumber ? (
                <Text style={[styles.meta, { color: C.textMuted }]}>
                  {t.orderTrackingNumber ?? 'Tracking'}: {trackingNumber}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}

      {/* Cancelled step (always shown at bottom, highlighted if cancelled) */}
      {!compact && (
        <View style={[styles.step, isRTL && styles.stepRTL]}>
          <View style={styles.dotCol}>
            <View
              style={[
                styles.dot,
                {
                  borderColor: isCancelled ? Colors.error : C.border,
                  backgroundColor: isCancelled ? Colors.error + '18' : C.backgroundCard,
                },
              ]}
            >
              {isCancelled ? (
                <X size={11} color={Colors.error} strokeWidth={2.5} />
              ) : (
                <View style={[styles.dotInner, { backgroundColor: C.border }]} />
              )}
            </View>
          </View>
          <View style={[styles.labelCol, styles.labelColLast]}>
            <Text
              style={[
                styles.label,
                {
                  color: isCancelled ? Colors.error : C.textMuted,
                  fontWeight: isCancelled ? '700' : '400',
                  fontSize: FontSize.sm,
                },
              ]}
            >
              {getStatusLabel('cancelled', t)}
            </Text>
            {isCancelled && (
              <View
                style={[
                  styles.activePill,
                  { backgroundColor: Colors.error + '20', borderColor: Colors.error + '50' },
                ]}
              >
                <Text style={[styles.activePillText, { color: Colors.error }]}>
                  {t.orderCurrentStatus ?? 'Current Status'}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const DOT_SIZE = 28;
const CONNECTOR_WIDTH = 2;

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  cancelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  cancelBannerText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepRTL: {
    flexDirection: 'row-reverse',
  },
  dotCol: {
    alignItems: 'center',
    width: DOT_SIZE,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connector: {
    width: CONNECTOR_WIDTH,
    height: 24,
    borderRadius: 1,
    marginVertical: 2,
  },
  labelCol: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 4,
  },
  labelColLast: {
    paddingBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: {
    fontSize: FontSize.sm,
    letterSpacing: 0.1,
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  meta: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
});
