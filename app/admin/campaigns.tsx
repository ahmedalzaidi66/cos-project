import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import {
  CalendarDays,
  Bell,
  Check,
  Clock,
  X,
  Zap,
  LayoutTemplate,
  Tag,
  Send,
  Image as ImageIcon,
  ChevronRight,
  Sparkles,
  Gift,
  Star,
  Sun,
  Snowflake,
  Heart,
  Flag,
  Moon,
  ShoppingBag,
} from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import { adminSupabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/auditLog';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { useRouter } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────────────

type OccasionStatus = 'active' | 'upcoming' | 'past';
type ReminderState = 'dismissed' | 'snoozed' | 'completed' | null;
type ActionType = 'banner' | 'discount' | 'notification' | 'coupon' | 'hero_slider';
type SnoozeOption = '1d' | '3d' | '7d';

interface Occasion {
  key: string;
  nameEn: string;
  nameAr: string;
  nameCkb: string;
  icon: React.ComponentType<any>;
  color: string;
  campaignType: string;
  campaignTypeAr: string;
  campaignTypeCkb: string;
  getDate: (year: number) => Date | null;
}

interface OccasionOverride {
  occasion_key: string;
  status: 'dismissed' | 'snoozed' | 'completed';
  snoozed_until: string | null;
}

interface ActionRecord {
  occasion_key: string;
  action_type: ActionType;
  created_at: string;
}

interface OccasionCard {
  occasion: Occasion;
  date: Date;
  status: OccasionStatus;
  daysUntil: number;
  reminderState: ReminderState;
  snoozedUntil: Date | null;
  actionsCount: number;
}

// ─── Occasion definitions ────────────────────────────────────────────────────

const OCCASIONS: Occasion[] = [
  {
    key: 'valentines',
    nameEn: "Valentine's Day",
    nameAr: 'عيد الحب',
    nameCkb: 'ڕۆژی خۆشەویستی',
    icon: Heart,
    color: '#FF4D8D',
    campaignType: 'Romance & Gifting',
    campaignTypeAr: 'الحب والهدايا',
    campaignTypeCkb: 'خۆشەویستی و دیاری',
    getDate: (y) => new Date(y, 1, 14), // Feb 14
  },
  {
    key: 'womens_day',
    nameEn: "Women's Day",
    nameAr: 'يوم المرأة العالمي',
    nameCkb: 'ڕۆژی ئافرەت',
    icon: Star,
    color: '#E040FB',
    campaignType: 'Empowerment & Beauty',
    campaignTypeAr: 'تمكين المرأة والجمال',
    campaignTypeCkb: 'هێزدان و جوانی',
    getDate: (y) => new Date(y, 2, 8), // Mar 8
  },
  {
    key: 'ramadan',
    nameEn: 'Ramadan',
    nameAr: 'رمضان الكريم',
    nameCkb: 'مانگی ڕەمەزان',
    icon: Moon,
    color: '#FFD700',
    campaignType: 'Ramadan Offers',
    campaignTypeAr: 'عروض رمضان',
    campaignTypeCkb: 'پێشکەشکردنەکانی ڕەمەزان',
    // Approximate — shifts yearly; using 2025 start Mar 1
    getDate: (y) => {
      const approx: Record<number, Date> = {
        2025: new Date(2025, 2, 1),
        2026: new Date(2026, 1, 18),
        2027: new Date(2027, 1, 7),
      };
      return approx[y] ?? new Date(y, 2, 1);
    },
  },
  {
    key: 'eid_fitr',
    nameEn: 'Eid al-Fitr',
    nameAr: 'عيد الفطر',
    nameCkb: 'جەژنی ڕەمەزان',
    icon: Gift,
    color: '#FFB300',
    campaignType: 'Eid Celebration',
    campaignTypeAr: 'احتفالات عيد الفطر',
    campaignTypeCkb: 'جەژنی عیدی فیتر',
    getDate: (y) => {
      const approx: Record<number, Date> = {
        2025: new Date(2025, 2, 30),
        2026: new Date(2026, 2, 20),
        2027: new Date(2027, 2, 9),
      };
      return approx[y] ?? new Date(y, 2, 30);
    },
  },
  {
    key: 'eid_adha',
    nameEn: 'Eid al-Adha',
    nameAr: 'عيد الأضحى',
    nameCkb: 'جەژنی قوربان',
    icon: Sparkles,
    color: '#00E676',
    campaignType: 'Eid Celebration',
    campaignTypeAr: 'احتفالات عيد الأضحى',
    campaignTypeCkb: 'جەژنی عیدی ئەزحا',
    getDate: (y) => {
      const approx: Record<number, Date> = {
        2025: new Date(2025, 5, 6),
        2026: new Date(2026, 4, 27),
        2027: new Date(2027, 4, 16),
      };
      return approx[y] ?? new Date(y, 5, 6);
    },
  },
  {
    key: 'iraq_national',
    nameEn: 'Iraqi National Day',
    nameAr: 'اليوم الوطني العراقي',
    nameCkb: 'ڕۆژی نیشتمانی عێراق',
    icon: Flag,
    color: '#4CAF50',
    campaignType: 'National Pride',
    campaignTypeAr: 'الفخر الوطني',
    campaignTypeCkb: 'شانازی نیشتمانی',
    getDate: (y) => new Date(y, 9, 3), // Oct 3
  },
  {
    key: 'mothers_day',
    nameEn: "Mother's Day",
    nameAr: 'عيد الأم',
    nameCkb: 'ڕۆژی دایک',
    icon: Heart,
    color: '#FF80AB',
    campaignType: 'Gifting & Luxury',
    campaignTypeAr: 'الهدايا والرفاهية',
    campaignTypeCkb: 'دیاری و جوانی',
    getDate: (y) => new Date(y, 2, 21), // Mar 21 (Arab world)
  },
  {
    key: 'back_to_school',
    nameEn: 'Back to School',
    nameAr: 'العودة للمدارس',
    nameCkb: 'گەڕانەوە بۆ قوتابخانە',
    icon: Star,
    color: '#42A5F5',
    campaignType: 'Back to School',
    campaignTypeAr: 'تخفيضات العودة للمدرسة',
    campaignTypeCkb: 'داشکاندنەکانی قوتابخانە',
    getDate: (y) => new Date(y, 8, 1), // Sep 1
  },
  {
    key: 'black_friday',
    nameEn: 'Black Friday',
    nameAr: 'الجمعة السوداء',
    nameCkb: 'ئەینی ڕەش',
    icon: ShoppingBag,
    color: '#FF5722',
    campaignType: 'Mega Discount Event',
    campaignTypeAr: 'حدث التخفيضات الكبير',
    campaignTypeCkb: 'ڕووداوی داشکاندنی گەورە',
    getDate: (y) => {
      // 4th Friday of November
      const nov1 = new Date(y, 10, 1);
      const day = nov1.getDay();
      const firstFriday = day <= 5 ? 1 + (5 - day) : 8 - (day - 5);
      return new Date(y, 10, firstFriday + 21);
    },
  },
  {
    key: 'new_year',
    nameEn: 'New Year',
    nameAr: "رأس السنة الجديدة",
    nameCkb: 'ساڵی نوێ',
    icon: Sparkles,
    color: '#FFD700',
    campaignType: 'New Year Celebration',
    campaignTypeAr: 'الاحتفال برأس السنة',
    campaignTypeCkb: 'جەژنی ساڵی نوێ',
    getDate: (y) => new Date(y, 0, 1), // Jan 1
  },
  {
    key: 'summer',
    nameEn: 'Summer Campaign',
    nameAr: 'حملة الصيف',
    nameCkb: 'کامپەینی هاوین',
    icon: Sun,
    color: '#FF9800',
    campaignType: 'Seasonal Collection',
    campaignTypeAr: 'مجموعة الموسم',
    campaignTypeCkb: 'کۆکراوەی وەرزەکە',
    getDate: (y) => new Date(y, 5, 1), // Jun 1
  },
  {
    key: 'winter',
    nameEn: 'Winter Campaign',
    nameAr: 'حملة الشتاء',
    nameCkb: 'کامپەینی زستان',
    icon: Snowflake,
    color: '#90CAF9',
    campaignType: 'Seasonal Collection',
    campaignTypeAr: 'مجموعة الموسم',
    campaignTypeCkb: 'کۆکراوەی وەرزەکە',
    getDate: (y) => new Date(y, 11, 1), // Dec 1
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOccasionDate(occ: Occasion): Date | null {
  const now = new Date();
  const year = now.getFullYear();
  let d = occ.getDate(year);
  if (d && d < now) {
    const next = occ.getDate(year + 1);
    if (next) d = next;
  }
  return d;
}

function daysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function formatCountdown(days: number): string {
  if (days === 0) return 'Today!';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function formatCountdownAr(days: number): string {
  if (days === 0) return 'اليوم!';
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان';
  return `${days} أيام`;
}

function formatCountdownCkb(days: number): string {
  if (days === 0) return 'ئەمڕۆ!';
  if (days === 1) return '١ ڕۆژ';
  return `${days} ڕۆژ`;
}

function formatDate(date: Date, language: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
  const locale = language === 'ar' ? 'ar-IQ' : language === 'ckb' ? 'ku' : 'en-US';
  try { return date.toLocaleDateString(locale, opts); }
  catch { return date.toLocaleDateString('en-US', opts); }
}

// ─── Countdown ring component ────────────────────────────────────────────────

function CountdownRing({ days, color }: { days: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []);
  const urgency = days <= 3 ? Colors.error : days <= 7 ? Colors.warning : color;
  return (
    <View style={ringStyles.wrap}>
      <View style={[ringStyles.ring, { borderColor: urgency + '33' }]}>
        <View style={[ringStyles.innerRing, { borderColor: urgency }]} />
        <View style={ringStyles.center}>
          <Text style={[ringStyles.daysNum, { color: urgency }]}>{days}</Text>
          <Text style={ringStyles.daysLabel}>days</Text>
        </View>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  innerRing: { position: 'absolute', width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderStyle: 'dashed' },
  center: { alignItems: 'center', gap: 1 },
  daysNum: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  daysLabel: { fontSize: 8, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CampaignSkeleton() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] });
  const skeletons = [1, 2, 3];
  return (
    <View style={{ gap: Spacing.md }}>
      {skeletons.map((i) => (
        <Animated.View key={i} style={[sk.card, { opacity }]}>
          <View style={[sk.circle, { width: 44, height: 44 }]} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[sk.line, { width: '60%', height: 14 }]} />
            <View style={[sk.line, { width: '40%', height: 10 }]} />
          </View>
          <View style={[sk.circle, { width: 62, height: 62, borderRadius: 31 }]} />
        </Animated.View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, backgroundColor: Colors.backgroundCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  circle: { borderRadius: 22, backgroundColor: Colors.border },
  line: { borderRadius: 4, backgroundColor: Colors.border },
});

// ─── Quick action button ──────────────────────────────────────────────────────

interface QuickActionProps {
  icon: React.ComponentType<any>;
  label: string;
  color: string;
  onPress: () => void;
  done?: boolean;
}

function QuickActionBtn({ icon: Icon, label, color, onPress, done }: QuickActionProps) {
  return (
    <TouchableOpacity
      style={[qa.btn, done && qa.btnDone]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[qa.iconWrap, { backgroundColor: (done ? Colors.success : color) + '20' }]}>
        {done
          ? <Check size={14} color={Colors.success} strokeWidth={2.5} />
          : <Icon size={14} color={color} strokeWidth={2} />
        }
      </View>
      <Text style={[qa.label, done && { color: Colors.success }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

const qa = StyleSheet.create({
  btn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 70,
  },
  btnDone: { borderColor: Colors.success + '44', backgroundColor: Colors.success + '08' },
  iconWrap: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  label: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 12 },
});

// ─── Occasion Card ────────────────────────────────────────────────────────────

interface CardProps {
  card: OccasionCard;
  language: string;
  onDismiss: (key: string) => void;
  onSnooze: (key: string, opt: SnoozeOption) => void;
  onComplete: (key: string) => void;
  onAction: (key: string, type: ActionType) => void;
  actionsDone: Set<string>;
}

function OccasionCardView({ card, language, onDismiss, onSnooze, onComplete, onAction, actionsDone }: CardProps) {
  const { occasion, date, status, daysUntil: days, reminderState } = card;
  const [expanded, setExpanded] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const isRtl = language === 'ar' || language === 'ckb';

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.timing(expandAnim, { toValue: expanded ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  }, [expanded]);

  const name = language === 'ar' ? occasion.nameAr : language === 'ckb' ? occasion.nameCkb : occasion.nameEn;
  const campaign = language === 'ar' ? occasion.campaignTypeAr : language === 'ckb' ? occasion.campaignTypeCkb : occasion.campaignType;
  const dateStr = formatDate(date, language);
  const urgency = days <= 3 ? Colors.error : days <= 7 ? Colors.warning : occasion.color;

  if (reminderState === 'dismissed') return null;
  if (reminderState === 'snoozed' && card.snoozedUntil && card.snoozedUntil > new Date()) return null;

  const Icon = occasion.icon;

  const expandedHeight = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] });

  const actionItems: { type: ActionType; label: string; labelAr: string; labelCkb: string; icon: React.ComponentType<any>; color: string }[] = [
    { type: 'banner', label: 'Homepage Banner', labelAr: 'بانر الرئيسية', labelCkb: 'بانەری سەرەکی', icon: LayoutTemplate, color: Colors.neonBlue },
    { type: 'discount', label: 'Discount Campaign', labelAr: 'حملة خصم', labelCkb: 'کامپەینی داشکاندن', icon: Tag, color: Colors.warning },
    { type: 'notification', label: 'Send Notification', labelAr: 'إرسال إشعار', labelCkb: 'ناردنی ئاگادارکردن', icon: Send, color: Colors.success },
    { type: 'coupon', label: 'Create Coupon', labelAr: 'إنشاء قسيمة', labelCkb: 'دروستکردنی کووپۆن', icon: Tag, color: '#FF9800' },
    { type: 'hero_slider', label: 'Update Hero Slider', labelAr: 'تحديث السلايدر', labelCkb: 'نوێکردنەوەی سلایدەر', icon: ImageIcon, color: '#42A5F5' },
  ];

  return (
    <Animated.View style={[
      cardStyles.wrapper,
      { opacity: slideAnim, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }
    ]}>
      <View style={[cardStyles.card, reminderState === 'completed' && cardStyles.cardCompleted]}>
        {/* Left accent bar */}
        <View style={[cardStyles.accentBar, { backgroundColor: urgency }]} />

        <View style={{ flex: 1 }}>
          {/* Header row */}
          <View style={[cardStyles.headerRow, isRtl && { flexDirection: 'row-reverse' }]}>
            <View style={[cardStyles.iconWrap, { backgroundColor: occasion.color + '20' }]}>
              <Icon size={20} color={occasion.color} strokeWidth={2} />
            </View>

            <View style={[cardStyles.info, isRtl && { alignItems: 'flex-end' }]}>
              <View style={[cardStyles.nameRow, isRtl && { flexDirection: 'row-reverse' }]}>
                <Text style={[cardStyles.name, isRtl && { textAlign: 'right' }]}>{name}</Text>
                {status === 'active' && (
                  <View style={cardStyles.activeBadge}>
                    <Zap size={9} color={Colors.success} strokeWidth={2.5} />
                    <Text style={cardStyles.activeBadgeText}>LIVE</Text>
                  </View>
                )}
                {reminderState === 'completed' && (
                  <View style={[cardStyles.activeBadge, { backgroundColor: Colors.success + '20', borderColor: Colors.success + '40' }]}>
                    <Check size={9} color={Colors.success} strokeWidth={2.5} />
                    <Text style={[cardStyles.activeBadgeText, { color: Colors.success }]}>DONE</Text>
                  </View>
                )}
              </View>
              <Text style={[cardStyles.dateText, isRtl && { textAlign: 'right' }]}>{dateStr}</Text>
              <Text style={[cardStyles.campaignType, isRtl && { textAlign: 'right' }]}>{campaign}</Text>
            </View>

            {days >= 0 && days <= 90 && <CountdownRing days={days} color={occasion.color} />}
          </View>

          {/* Urgency banner */}
          {days <= 7 && days >= 0 && (
            <View style={[cardStyles.urgencyBanner, { backgroundColor: urgency + '15', borderColor: urgency + '33' }]}>
              <Bell size={11} color={urgency} strokeWidth={2.5} />
              <Text style={[cardStyles.urgencyText, { color: urgency }]}>
                {days === 0
                  ? (language === 'ar' ? 'المناسبة اليوم! ابدأ حملتك الآن' : language === 'ckb' ? 'ئەمڕۆ! کامپەینت دەست پێ بکە' : 'Occasion is today! Launch your campaign now')
                  : days <= 3
                  ? (language === 'ar' ? `متبقي ${formatCountdownAr(days)} فقط — وقت الاستعداد` : language === 'ckb' ? `${formatCountdownCkb(days)} ماوە — ئامادەبە` : `Only ${formatCountdown(days)} left — time to prepare`)
                  : (language === 'ar' ? `تذكير: تبقى ${formatCountdownAr(days)}` : language === 'ckb' ? `بیرخستنەوە: ${formatCountdownCkb(days)} ماوە` : `Reminder: ${formatCountdown(days)} away`)
                }
              </Text>
            </View>
          )}

          {/* Quick actions (expandable) */}
          <TouchableOpacity
            style={[cardStyles.expandTrigger, isRtl && { flexDirection: 'row-reverse' }]}
            onPress={() => setExpanded(!expanded)}
            activeOpacity={0.7}
          >
            <Text style={cardStyles.expandText}>
              {language === 'ar' ? 'إجراءات سريعة' : language === 'ckb' ? 'کارە خێراکان' : 'Quick Actions'}
              {card.actionsCount > 0 && ` (${card.actionsCount})`}
            </Text>
            <ChevronRight
              size={13}
              color={Colors.textMuted}
              strokeWidth={2}
              style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          <Animated.View style={{ maxHeight: expandedHeight, overflow: 'hidden' }}>
            <View style={cardStyles.actionsGrid}>
              {actionItems.map((a) => {
                const doneKey = `${card.occasion.key}:${a.type}`;
                return (
                  <QuickActionBtn
                    key={a.type}
                    icon={a.icon}
                    label={language === 'ar' ? a.labelAr : language === 'ckb' ? a.labelCkb : a.label}
                    color={a.color}
                    done={actionsDone.has(doneKey)}
                    onPress={() => onAction(card.occasion.key, a.type)}
                  />
                );
              })}
            </View>
          </Animated.View>

          {/* Footer buttons */}
          {reminderState !== 'completed' && (
            <View style={[cardStyles.footerRow, isRtl && { flexDirection: 'row-reverse' }]}>
              {showSnooze ? (
                <>
                  {(['1d', '3d', '7d'] as SnoozeOption[]).map((opt) => (
                    <TouchableOpacity key={opt} style={cardStyles.snoozeChip} onPress={() => { onSnooze(occasion.key, opt); setShowSnooze(false); }} activeOpacity={0.75}>
                      <Text style={cardStyles.snoozeChipText}>+{opt}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={cardStyles.ghostBtn} onPress={() => setShowSnooze(false)} activeOpacity={0.75}>
                    <X size={13} color={Colors.textMuted} strokeWidth={2} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={[cardStyles.footerBtn, cardStyles.completeBtn]} onPress={() => onComplete(occasion.key)} activeOpacity={0.75}>
                    <Check size={12} color={Colors.success} strokeWidth={2.5} />
                    <Text style={[cardStyles.footerBtnText, { color: Colors.success }]}>
                      {language === 'ar' ? 'تم' : language === 'ckb' ? 'تەواو' : 'Done'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={cardStyles.footerBtn} onPress={() => setShowSnooze(true)} activeOpacity={0.75}>
                    <Clock size={12} color={Colors.textMuted} strokeWidth={2} />
                    <Text style={cardStyles.footerBtnText}>
                      {language === 'ar' ? 'تأجيل' : language === 'ckb' ? 'درەنگخستن' : 'Snooze'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={cardStyles.footerBtn} onPress={() => onDismiss(occasion.key)} activeOpacity={0.75}>
                    <X size={12} color={Colors.textMuted} strokeWidth={2} />
                    <Text style={cardStyles.footerBtnText}>
                      {language === 'ar' ? 'رفض' : language === 'ckb' ? 'ڕەتکردنەوە' : 'Dismiss'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardCompleted: { opacity: 0.7, borderColor: Colors.success + '33' },
  accentBar: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: Radius.lg, borderBottomLeftRadius: Radius.lg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: Spacing.md, paddingBottom: 8 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: Colors.success + '20', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.success + '40',
  },
  activeBadgeText: { color: Colors.success, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  dateText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  campaignType: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  urgencyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.md, marginBottom: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.sm, borderWidth: 1,
  },
  urgencyText: { fontSize: FontSize.xs, fontWeight: '700', flex: 1 },
  expandTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  expandText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  footerRow: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 8,
  },
  footerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  completeBtn: { borderColor: Colors.success + '44', backgroundColor: Colors.success + '10' },
  footerBtnText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  snoozeChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.warning + '15', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.warning + '44',
  },
  snoozeChipText: { color: Colors.warning, fontSize: FontSize.xs, fontWeight: '800' },
  ghostBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, color }: { title: string; count?: number; color?: string }) {
  return (
    <View style={sh.row}>
      <View style={[sh.dot, { backgroundColor: color ?? Colors.neonBlue }]} />
      <Text style={sh.title}>{title}</Text>
      {count !== undefined && (
        <View style={sh.badge}>
          <Text style={sh.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md, marginTop: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.backgroundCard, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  badgeText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
});

// ─── Stats widget ─────────────────────────────────────────────────────────────

function StatsWidget({ cards }: { cards: OccasionCard[] }) {
  const activeCount = cards.filter(c => c.status === 'active').length;
  const urgentCount = cards.filter(c => c.daysUntil >= 0 && c.daysUntil <= 7 && c.reminderState !== 'dismissed' && c.reminderState !== 'completed').length;
  const completedCount = cards.filter(c => c.reminderState === 'completed').length;
  const upcomingCount = cards.filter(c => c.status === 'upcoming' && c.reminderState !== 'dismissed').length;

  const stats = [
    { label: 'Active', labelAr: 'نشطة', value: activeCount, color: Colors.success },
    { label: 'Urgent', labelAr: 'عاجل', value: urgentCount, color: Colors.error },
    { label: 'Upcoming', labelAr: 'قادمة', value: upcomingCount, color: Colors.warning },
    { label: 'Completed', labelAr: 'مكتمل', value: completedCount, color: Colors.neonBlue },
  ];

  return (
    <View style={sw.row}>
      {stats.map((s) => (
        <View key={s.label} style={sw.card}>
          <Text style={[sw.num, { color: s.color }]}>{s.value}</Text>
          <Text style={sw.label}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const sw = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  card: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', paddingVertical: 12, gap: 4 },
  num: { fontSize: FontSize.xl, fontWeight: '900' },
  label: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ─── Action confirmation modal ────────────────────────────────────────────────

function ActionModal({
  visible,
  occasionKey,
  actionType,
  language,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  occasionKey: string | null;
  actionType: ActionType | null;
  language: string;
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  if (!actionType || !occasionKey) return null;

  const occ = OCCASIONS.find(o => o.key === occasionKey);
  const name = occ ? (language === 'ar' ? occ.nameAr : language === 'ckb' ? occ.nameCkb : occ.nameEn) : '';

  const routeMap: Record<ActionType, string> = {
    banner: '/admin/content',
    discount: '/admin/coupons',
    notification: '/admin/notifications',
    coupon: '/admin/coupons',
    hero_slider: '/admin/sections',
  };

  const titleMap: Record<ActionType, { en: string; ar: string; ckb: string }> = {
    banner: { en: 'Create Homepage Banner', ar: 'إنشاء بانر الرئيسية', ckb: 'دروستکردنی بانەری سەرەکی' },
    discount: { en: 'Create Discount Campaign', ar: 'إنشاء حملة خصم', ckb: 'دروستکردنی کامپەینی داشکاندن' },
    notification: { en: 'Send Notification', ar: 'إرسال إشعار', ckb: 'ناردنی ئاگادارکردن' },
    coupon: { en: 'Create Coupon', ar: 'إنشاء قسيمة', ckb: 'دروستکردنی کووپۆن' },
    hero_slider: { en: 'Update Hero Slider', ar: 'تحديث السلايدر', ckb: 'نوێکردنەوەی سلایدەر' },
  };

  const t = titleMap[actionType];
  const title = language === 'ar' ? t.ar : language === 'ckb' ? t.ckb : t.en;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={am.overlay}>
        <View style={am.card}>
          <View style={am.header}>
            <Text style={am.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <Text style={am.body}>
            {language === 'ar'
              ? `سيتم توجيهك لإنشاء هذا الإجراء لـ "${name}". تم تسجيله كمكتمل.`
              : language === 'ckb'
              ? `دەبرێیت بۆ دروستکردنی ئەم کارە بۆ "${name}". تۆمارکراوە وەکو تەواوکراو.`
              : `You'll be taken to create this action for "${name}". It will be logged as completed.`
            }
          </Text>
          <View style={am.btns}>
            <TouchableOpacity style={am.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={am.cancelText}>{language === 'ar' ? 'إلغاء' : language === 'ckb' ? 'پاشگەزبوونەوە' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={am.goBtn} onPress={() => { onClose(); onNavigate(routeMap[actionType]); }} activeOpacity={0.8}>
              <Text style={am.goText}>{language === 'ar' ? 'انتقل' : language === 'ckb' ? 'بڕۆ' : 'Go'}</Text>
              <ChevronRight size={14} color={Colors.background} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xl, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: Colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800', flex: 1 },
  body: { color: Colors.textSecondary, fontSize: FontSize.sm, padding: Spacing.lg, lineHeight: 20 },
  btns: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, paddingTop: 0 },
  cancelBtn: { flex: 1, height: 44, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  goBtn: { flex: 1, height: 44, borderRadius: Radius.md, backgroundColor: Colors.neonBlue, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 4 },
  goText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
});

// ─── Main screen content ──────────────────────────────────────────────────────

function CampaignsContent() {
  const { admin } = useAdmin();
  const { language } = useLanguage();
  const router = useRouter();
  const { isMobile } = useAdminLayout();
  const isRtl = language === 'ar' || language === 'ckb';

  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<OccasionOverride[]>([]);
  const [actionRecords, setActionRecords] = useState<ActionRecord[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionModal, setActionModal] = useState<{ key: string; type: ActionType } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const db = adminSupabase();
    const [ovRes, acRes] = await Promise.all([
      db.from('campaign_occasion_overrides').select('occasion_key,status,snoozed_until'),
      db.from('campaign_actions').select('occasion_key,action_type,created_at').order('created_at', { ascending: false }),
    ]);
    setOverrides(ovRes.data ?? []);
    setActionRecords(acRes.data ?? []);
    setLoading(false);
  };

  // Build cards from OCCASIONS + DB state
  const cards: OccasionCard[] = React.useMemo(() => {
    const now = new Date();
    return OCCASIONS.map((occ) => {
      const date = getOccasionDate(occ);
      if (!date) return null;
      const days = daysUntil(date);
      const status: OccasionStatus = days === 0 ? 'active' : days > 0 ? 'upcoming' : 'past';
      const override = overrides.find(o => o.occasion_key === occ.key);
      const reminderState: ReminderState = override?.status ?? null;
      const snoozedUntil = override?.snoozed_until ? new Date(override.snoozed_until) : null;
      const actionsCount = actionRecords.filter(a => a.occasion_key === occ.key).length;
      return { occasion: occ, date, status, daysUntil: days, reminderState, snoozedUntil, actionsCount };
    }).filter(Boolean).sort((a, b) => a!.daysUntil - b!.daysUntil) as OccasionCard[];
  }, [overrides, actionRecords]);

  const actionsDone = React.useMemo(() => {
    const s = new Set<string>();
    actionRecords.forEach(a => s.add(`${a.occasion_key}:${a.action_type}`));
    return s;
  }, [actionRecords]);

  const activeCards = cards.filter(c => c.status === 'active' && c.reminderState !== 'dismissed');
  const urgentCards = cards.filter(c => c.daysUntil > 0 && c.daysUntil <= 7 && c.reminderState !== 'dismissed' && c.reminderState !== 'completed');
  const upcomingCards = cards.filter(c => c.daysUntil > 7 && c.daysUntil <= 90 && c.reminderState !== 'dismissed');
  const dismissedCards = cards.filter(c => c.reminderState === 'dismissed');

  const upsertOverride = async (key: string, status: 'dismissed' | 'snoozed' | 'completed', snoozedUntil?: Date) => {
    const db = adminSupabase();
    await db.from('campaign_occasion_overrides').upsert({
      occasion_key: key,
      admin_email: admin?.email ?? '',
      status,
      snoozed_until: snoozedUntil?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'occasion_key,admin_email' });
    await load();
  };

  const handleDismiss = async (key: string) => {
    await upsertOverride(key, 'dismissed');
    showToast(language === 'ar' ? 'تم رفض التذكير' : language === 'ckb' ? 'بیرخستنەوە ڕەتکرایەوە' : 'Reminder dismissed');
    logAdminAction({ action: 'update', entityType: 'settings', entityLabel: `Campaign dismiss: ${key}`, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '' });
  };

  const handleSnooze = async (key: string, opt: SnoozeOption) => {
    const days = opt === '1d' ? 1 : opt === '3d' ? 3 : 7;
    const until = new Date();
    until.setDate(until.getDate() + days);
    await upsertOverride(key, 'snoozed', until);
    showToast(language === 'ar' ? `تم التأجيل لـ ${days} أيام` : language === 'ckb' ? `بۆ ${days} ڕۆژ درەنگخرا` : `Snoozed for ${days} days`);
  };

  const handleComplete = async (key: string) => {
    await upsertOverride(key, 'completed');
    showToast(language === 'ar' ? 'تم تحديده كمكتمل' : language === 'ckb' ? 'وەکو تەواوکراو نیشانەکرا' : 'Marked as completed');
    logAdminAction({ action: 'update', entityType: 'settings', entityLabel: `Campaign complete: ${key}`, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '' });
  };

  const handleAction = async (key: string, type: ActionType) => {
    // Log the action
    await adminSupabase().from('campaign_actions').insert({
      occasion_key: key,
      action_type: type,
      admin_email: admin?.email ?? '',
    });
    logAdminAction({ action: 'create', entityType: 'settings', entityLabel: `Campaign action: ${key} / ${type}`, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '' });
    setActionModal({ key, type });
    await load();
  };

  const titleLabel = language === 'ar' ? 'المناسبات والعروض' : language === 'ckb' ? 'ئۆکازیۆن و کامپەینەکان' : 'Seasonal Campaigns';

  const DashboardShell = isMobile ? AdminMobileDashboard : AdminWebDashboard;

  return (
    <DashboardShell title={titleLabel}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <ActionModal
        visible={!!actionModal}
        occasionKey={actionModal?.key ?? null}
        actionType={actionModal?.type ?? null}
        language={language}
        onClose={() => setActionModal(null)}
        onNavigate={(route) => router.push(route as any)}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[main.scroll, isRtl && { direction: 'rtl' } as any]}>
        {/* Header */}
        <View style={[main.pageHeader, isRtl && { flexDirection: 'row-reverse' }]}>
          <View style={main.headerIcon}>
            <CalendarDays size={22} color={Colors.neonBlue} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[main.pageTitle, isRtl && { textAlign: 'right' }]}>{titleLabel}</Text>
            <Text style={[main.pageSubtitle, isRtl && { textAlign: 'right' }]}>
              {language === 'ar'
                ? 'تتبع المناسبات وإطلاق الحملات التسويقية في الوقت المناسب'
                : language === 'ckb'
                ? 'ئۆکازیۆنەکان شوێن بکەوە و کامپەینەکانی مارکتینگ لە کاتی گونجاودا دەست پێ بکە'
                : 'Track occasions and launch marketing campaigns at the right time'
              }
            </Text>
          </View>
        </View>

        {loading ? (
          <CampaignSkeleton />
        ) : (
          <>
            {/* Stats */}
            <StatsWidget cards={cards} />

            {/* Active today */}
            {activeCards.length > 0 && (
              <>
                <SectionHeader
                  title={language === 'ar' ? 'نشط الآن' : language === 'ckb' ? 'ئێستا چالاکە' : 'Active Now'}
                  count={activeCards.length}
                  color={Colors.success}
                />
                {activeCards.map((c) => (
                  <OccasionCardView
                    key={c.occasion.key}
                    card={c}
                    language={language}
                    onDismiss={handleDismiss}
                    onSnooze={handleSnooze}
                    onComplete={handleComplete}
                    onAction={handleAction}
                    actionsDone={actionsDone}
                  />
                ))}
              </>
            )}

            {/* Urgent (≤7 days) */}
            {urgentCards.length > 0 && (
              <>
                <SectionHeader
                  title={language === 'ar' ? 'تذكيرات عاجلة — أقل من 7 أيام' : language === 'ckb' ? 'بیرخستنەوەی بەپەلە — کەمتر لە ٧ ڕۆژ' : 'Urgent — within 7 days'}
                  count={urgentCards.length}
                  color={Colors.warning}
                />
                {urgentCards.map((c) => (
                  <OccasionCardView
                    key={c.occasion.key}
                    card={c}
                    language={language}
                    onDismiss={handleDismiss}
                    onSnooze={handleSnooze}
                    onComplete={handleComplete}
                    onAction={handleAction}
                    actionsDone={actionsDone}
                  />
                ))}
              </>
            )}

            {/* Upcoming (8–90 days) */}
            {upcomingCards.length > 0 && (
              <>
                <SectionHeader
                  title={language === 'ar' ? 'مناسبات قادمة' : language === 'ckb' ? 'ئۆکازیۆنە داهاتووەکان' : 'Upcoming Occasions'}
                  count={upcomingCards.length}
                  color={Colors.neonBlue}
                />
                {upcomingCards.map((c) => (
                  <OccasionCardView
                    key={c.occasion.key}
                    card={c}
                    language={language}
                    onDismiss={handleDismiss}
                    onSnooze={handleSnooze}
                    onComplete={handleComplete}
                    onAction={handleAction}
                    actionsDone={actionsDone}
                  />
                ))}
              </>
            )}

            {/* Dismissed */}
            {dismissedCards.length > 0 && (
              <>
                <SectionHeader
                  title={language === 'ar' ? 'التذكيرات المرفوضة' : language === 'ckb' ? 'بیرخستنەوەی ڕەتکراوەکان' : 'Dismissed Reminders'}
                  count={dismissedCards.length}
                  color={Colors.textMuted}
                />
                {dismissedCards.map((c) => {
                  const Icon = c.occasion.icon;
                  const name = language === 'ar' ? c.occasion.nameAr : language === 'ckb' ? c.occasion.nameCkb : c.occasion.nameEn;
                  return (
                    <View key={c.occasion.key} style={[main.dismissedRow, isRtl && { flexDirection: 'row-reverse' }]}>
                      <View style={[main.dismissedIcon, { backgroundColor: c.occasion.color + '18' }]}>
                        <Icon size={14} color={c.occasion.color} strokeWidth={2} />
                      </View>
                      <Text style={[main.dismissedName, isRtl && { textAlign: 'right', flex: 1 }]}>{name}</Text>
                      <Text style={main.dismissedDate}>{formatDate(c.date, language)}</Text>
                      <TouchableOpacity
                        style={main.restoreBtn}
                        onPress={async () => {
                          const db = adminSupabase();
                          await db.from('campaign_occasion_overrides').delete().eq('occasion_key', c.occasion.key).eq('admin_email', admin?.email ?? '');
                          await load();
                          showToast(language === 'ar' ? 'تمت الاستعادة' : 'Restored');
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={main.restoreBtnText}>{language === 'ar' ? 'استعادة' : language === 'ckb' ? 'گەڕاندنەوە' : 'Restore'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

            {cards.filter(c => c.reminderState !== 'dismissed').length === 0 && !loading && (
              <View style={main.emptyState}>
                <CalendarDays size={48} color={Colors.textMuted} strokeWidth={1.5} />
                <Text style={main.emptyTitle}>
                  {language === 'ar' ? 'لا توجد مناسبات قريبة' : language === 'ckb' ? 'هیچ ئۆکازیۆنێکی نزیک نییە' : 'No upcoming occasions'}
                </Text>
                <Text style={main.emptySubtitle}>
                  {language === 'ar' ? 'جميع التذكيرات مرفوضة أو مكتملة' : language === 'ckb' ? 'هەموو بیرخستنەوەکان ڕەتکراون یان تەواوکراون' : 'All reminders are dismissed or completed'}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </DashboardShell>
  );
}

const main = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: 60 },
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerIcon: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.neonBlue + '18',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.neonBlue + '33',
  },
  pageTitle: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '900', lineHeight: 26 },
  pageSubtitle: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '500', marginTop: 3, lineHeight: 18 },
  dismissedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 6, opacity: 0.65,
  },
  dismissedIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  dismissedName: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  dismissedDate: { color: Colors.textMuted, fontSize: FontSize.xs, marginLeft: 'auto' as any },
  restoreBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  restoreBtnText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.md },
});

// ─── Export ───────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  return (
    <AdminGuard permission="manage_campaigns">
      <CampaignsContent />
    </AdminGuard>
  );
}
