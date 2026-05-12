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
  TextInput,
  Platform,
} from 'react-native';
import {
  CalendarDays,
  Bell,
  Check,
  Clock,
  X,
  Zap,
  LayoutTemplate,
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
  Plus,
  Package,
  Percent,
  Tag,
  Send,
  ChevronDown,
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
type CampaignStatus = 'planned' | 'active' | 'completed' | 'dismissed';
type ReminderType = 'in_app' | 'notification_draft' | 'campaign_note';
type ReminderStatus = 'scheduled' | 'sent' | 'dismissed';

interface SavedCampaign {
  id: string;
  occasion_key: string;
  title: string;
  occasion_name: string;
  occasion_date: string | null;
  notes: string;
  status: CampaignStatus;
  admin_email: string;
  created_at: string;
  start_date?: string | null;
  end_date?: string | null;
  auto_activate?: boolean;
  offer_badge?: string;
}

interface CampaignProduct {
  id: string;
  campaign_id: string;
  product_id: string | null;
  category_slug: string;
  is_featured: boolean;
  sort_order: number;
}

interface CampaignDiscount {
  id: string;
  campaign_id: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  coupon_code: string;
  min_order_amount: number;
  max_uses: number | null;
  usage_count: number;
  is_active: boolean;
}

interface CampaignBanner {
  id: string;
  occasion_key: string;
  title: string;
  cta_text: string;
  image_url: string;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  admin_email: string;
  created_at: string;
}

interface CampaignReminder {
  id: string;
  occasion_key: string;
  title_en: string;
  message_en: string;
  reminder_type: ReminderType;
  status: ReminderStatus;
  reminder_date: string | null;
  admin_email: string;
  created_at: string;
}

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
  onCreateCampaign: (occasion: Occasion) => void;
  onCreateBanner: (occasion: Occasion) => void;
  onSendReminder: (occasion: Occasion) => void;
  actionsDone: Set<string>;
}

function OccasionCardView({ card, language, onDismiss, onSnooze, onComplete, onAction, onCreateCampaign, onCreateBanner, onSendReminder, actionsDone }: CardProps) {
  const { occasion, date, status, daysUntil: days, reminderState } = card;
  const [showSnooze, setShowSnooze] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isRtl = language === 'ar' || language === 'ckb';

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }).start();
  }, []);

  const name = language === 'ar' ? occasion.nameAr : language === 'ckb' ? occasion.nameCkb : occasion.nameEn;
  const campaign = language === 'ar' ? occasion.campaignTypeAr : language === 'ckb' ? occasion.campaignTypeCkb : occasion.campaignType;
  const dateStr = formatDate(date, language);
  const urgency = days <= 3 ? Colors.error : days <= 7 ? Colors.warning : occasion.color;

  if (reminderState === 'dismissed') return null;
  if (reminderState === 'snoozed' && card.snoozedUntil && card.snoozedUntil > new Date()) return null;

  const Icon = occasion.icon;

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

          {/* 4 explicit action buttons */}
          <View style={[cardStyles.actionButtonsRow, isRtl && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity
              style={[cardStyles.actionBtn, { borderColor: Colors.neonBlue + '66' }]}
              onPress={() => onCreateCampaign(occasion)}
              activeOpacity={0.75}
            >
              <Plus size={12} color={Colors.neonBlue} strokeWidth={2.5} />
              <Text style={[cardStyles.actionBtnText, { color: Colors.neonBlue }]}>
                {language === 'ar' ? 'إنشاء حملة' : language === 'ckb' ? 'دروستکردنی کامپەین' : 'Create Campaign'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[cardStyles.actionBtn, { borderColor: Colors.warning + '66' }]}
              onPress={() => onCreateBanner(occasion)}
              activeOpacity={0.75}
            >
              <LayoutTemplate size={12} color={Colors.warning} strokeWidth={2} />
              <Text style={[cardStyles.actionBtnText, { color: Colors.warning }]}>
                {language === 'ar' ? 'إنشاء بانر' : language === 'ckb' ? 'دروستکردنی بانەر' : 'Create Banner'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[cardStyles.actionBtn, { borderColor: Colors.success + '66' }]}
              onPress={() => onSendReminder(occasion)}
              activeOpacity={0.75}
            >
              <Bell size={12} color={Colors.success} strokeWidth={2} />
              <Text style={[cardStyles.actionBtnText, { color: Colors.success }]}>
                {language === 'ar' ? 'إرسال تذكير' : language === 'ckb' ? 'ناردنی بیرخستنەوە' : 'Send Reminder'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[cardStyles.actionBtn, cardStyles.actionBtnDone]}
              onPress={() => onComplete(card.occasion.key)}
              activeOpacity={0.75}
            >
              <Check size={12} color={Colors.success} strokeWidth={2.5} />
              <Text style={[cardStyles.actionBtnText, { color: Colors.success }]}>
                {language === 'ar' ? 'تم' : language === 'ckb' ? 'تەواو' : 'Mark Done'}
              </Text>
            </TouchableOpacity>
          </View>

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
  actionButtonsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnDone: { borderColor: Colors.success + '44', backgroundColor: Colors.success + '10' },
  actionBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
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

// ─── Create Campaign Modal ────────────────────────────────────────────────────

const STATUS_OPTIONS: CampaignStatus[] = ['planned', 'active', 'completed', 'dismissed'];

const STATUS_COLORS: Record<CampaignStatus, string> = {
  planned: Colors.neonBlue,
  active: Colors.success,
  completed: Colors.textMuted,
  dismissed: Colors.error,
};

function statusLabel(s: CampaignStatus, lang: string): string {
  const map: Record<CampaignStatus, { en: string; ar: string; ckb: string }> = {
    planned:   { en: 'Planned',   ar: 'مخطط',    ckb: 'پلاندراو'      },
    active:    { en: 'Active',    ar: 'نشط',      ckb: 'چالاک'         },
    completed: { en: 'Completed', ar: 'مكتمل',    ckb: 'تەواوکراو'     },
    dismissed: { en: 'Dismissed', ar: 'مرفوض',    ckb: 'ڕەتکراوەتەوە' },
  };
  return lang === 'ar' ? map[s].ar : lang === 'ckb' ? map[s].ckb : map[s].en;
}

interface CreateCampaignModalProps {
  visible: boolean;
  occasion: Occasion | null;
  language: string;
  adminEmail: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

function CreateCampaignModal({ visible, occasion, language, adminEmail, onClose, onSaved, onError }: CreateCampaignModalProps) {
  const isRtl = language === 'ar' || language === 'ckb';
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CampaignStatus>('planned');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && occasion) {
      const name = language === 'ar' ? occasion.nameAr : language === 'ckb' ? occasion.nameCkb : occasion.nameEn;
      const type = language === 'ar' ? occasion.campaignTypeAr : language === 'ckb' ? occasion.campaignTypeCkb : occasion.campaignType;
      setTitle(`${name} — ${type}`);
      setNotes('');
      setStatus('planned');
    }
  }, [visible, occasion, language]);

  if (!occasion) return null;

  const occasionName = language === 'ar' ? occasion.nameAr : language === 'ckb' ? occasion.nameCkb : occasion.nameEn;
  const occasionDate = getOccasionDate(occasion);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const db = adminSupabase();
      const { error } = await db.from('saved_campaigns').insert({
        occasion_key: occasion.key,
        title: title.trim(),
        occasion_name: occasionName,
        occasion_date: occasionDate ? occasionDate.toISOString().split('T')[0] : null,
        notes: notes.trim(),
        status,
        admin_email: adminEmail,
      });
      if (error) throw error;
      onSaved(language === 'ar' ? 'تم حفظ الحملة بنجاح' : language === 'ckb' ? 'کامپەین بە سەرکەوتوویی پاشەکەوت کرا' : 'Campaign saved successfully');
      onClose();
    } catch (e: any) {
      onError(language === 'ar' ? 'فشل في حفظ الحملة' : language === 'ckb' ? 'شکستی هێنا لە پاشەکەوتکردنی کامپەین' : 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ccm.overlay}>
        <View style={ccm.sheet}>
          {/* Header */}
          <View style={[ccm.header, isRtl && { flexDirection: 'row-reverse' }]}>
            <View style={ccm.headerLeft}>
              <View style={[ccm.iconWrap, { backgroundColor: occasion.color + '22' }]}>
                {React.createElement(occasion.icon, { size: 18, color: occasion.color, strokeWidth: 2 })}
              </View>
              <View>
                <Text style={[ccm.headerTitle, isRtl && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'إنشاء حملة' : language === 'ckb' ? 'دروستکردنی کامپەین' : 'Create Campaign'}
                </Text>
                <Text style={[ccm.headerSub, isRtl && { textAlign: 'right' }]}>{occasionName}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={ccm.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={ccm.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Occasion date chip */}
            {occasionDate && (
              <View style={[ccm.dateChip, isRtl && { flexDirection: 'row-reverse' }]}>
                <CalendarDays size={13} color={occasion.color} strokeWidth={2} />
                <Text style={[ccm.dateChipText, { color: occasion.color }]}>
                  {formatDate(occasionDate, language)}
                </Text>
                <View style={[ccm.daysChip, { backgroundColor: occasion.color + '22', borderColor: occasion.color + '55' }]}>
                  <Text style={[ccm.daysChipText, { color: occasion.color }]}>
                    {daysUntil(occasionDate) === 0
                      ? (language === 'ar' ? 'اليوم' : language === 'ckb' ? 'ئەمڕۆ' : 'Today')
                      : (language === 'ar' ? `${daysUntil(occasionDate)} يوم` : language === 'ckb' ? `${daysUntil(occasionDate)} ڕۆژ` : `${daysUntil(occasionDate)} days`)
                    }
                  </Text>
                </View>
              </View>
            )}

            {/* Campaign title */}
            <View style={ccm.fieldWrap}>
              <Text style={[ccm.label, isRtl && { textAlign: 'right' }]}>
                {language === 'ar' ? 'عنوان الحملة' : language === 'ckb' ? 'سەردێڕی کامپەین' : 'Campaign Title'}
              </Text>
              <TextInput
                style={[ccm.input, isRtl && { textAlign: 'right' }]}
                value={title}
                onChangeText={setTitle}
                placeholder={language === 'ar' ? 'أدخل عنوان الحملة' : language === 'ckb' ? 'سەردێڕی کامپەین بنووسە' : 'Enter campaign title'}
                placeholderTextColor={Colors.textMuted}
                maxLength={120}
              />
            </View>

            {/* Status selector */}
            <View style={ccm.fieldWrap}>
              <Text style={[ccm.label, isRtl && { textAlign: 'right' }]}>
                {language === 'ar' ? 'الحالة' : language === 'ckb' ? 'دۆخ' : 'Status'}
              </Text>
              <View style={[ccm.statusRow, isRtl && { flexDirection: 'row-reverse' }]}>
                {STATUS_OPTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      ccm.statusChip,
                      status === s && { backgroundColor: STATUS_COLORS[s] + '22', borderColor: STATUS_COLORS[s] + '66' },
                    ]}
                    onPress={() => setStatus(s)}
                    activeOpacity={0.75}
                  >
                    <Text style={[ccm.statusChipText, status === s && { color: STATUS_COLORS[s], fontWeight: '800' }]}>
                      {statusLabel(s, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={ccm.fieldWrap}>
              <Text style={[ccm.label, isRtl && { textAlign: 'right' }]}>
                {language === 'ar' ? 'ملاحظات' : language === 'ckb' ? 'تێبینیەکان' : 'Notes'}
              </Text>
              <TextInput
                style={[ccm.textarea, isRtl && { textAlign: 'right' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={language === 'ar' ? 'أضف ملاحظاتك هنا...' : language === 'ckb' ? 'تێبینیەکانت لێرە زیاد بکە...' : 'Add your notes here...'}
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[ccm.footer, isRtl && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={ccm.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={ccm.cancelText}>{language === 'ar' ? 'إلغاء' : language === 'ckb' ? 'پاشگەزبوونەوە' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ccm.saveBtn, (!title.trim() || saving) && ccm.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!title.trim() || saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.background} />
                : <Check size={15} color={Colors.background} strokeWidth={2.5} />
              }
              <Text style={ccm.saveText}>{language === 'ar' ? 'حفظ الحملة' : language === 'ckb' ? 'پاشەکەوتکردنی کامپەین' : 'Save Campaign'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const ccm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  headerSub: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: Radius.sm, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  body: { padding: Spacing.lg },
  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  dateChipText: { fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  daysChip: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: Radius.full, borderWidth: 1,
  },
  daysChipText: { fontSize: FontSize.xs, fontWeight: '800' },
  fieldWrap: { marginBottom: Spacing.md, gap: 6 },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
  },
  textarea: {
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  statusRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  statusChipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  footer: {
    flexDirection: 'row', gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cancelBtn: {
    flex: 1, height: 46, borderRadius: Radius.md,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: {
    flex: 2, height: 46, borderRadius: Radius.md,
    backgroundColor: Colors.neonBlue,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 6,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
});

// ─── Active Campaigns Section ────────────────────────────────────────────────

interface ActiveCampaignsSectionProps {
  campaigns: SavedCampaign[];
  language: string;
  onStatusChange: (id: string, status: CampaignStatus) => void;
  onLinkProducts: (campaign: SavedCampaign) => void;
  onAddDiscount: (campaign: SavedCampaign) => void;
  onNotify: (campaign: SavedCampaign) => void;
}

function ActiveCampaignsSection({ campaigns, language, onStatusChange, onLinkProducts, onAddDiscount, onNotify }: ActiveCampaignsSectionProps) {
  const isRtl = language === 'ar' || language === 'ckb';
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  if (campaigns.length === 0) return null;

  return (
    <Animated.View style={{ opacity: slideAnim }}>
      <SectionHeader
        title={language === 'ar' ? 'الحملات النشطة' : language === 'ckb' ? 'کامپەینە چالاکەکان' : 'Active Campaigns'}
        count={campaigns.length}
        color={Colors.success}
      />
      {campaigns.map((c) => {
        const color = STATUS_COLORS[c.status];
        return (
          <View key={c.id} style={[acs.card, isRtl && { flexDirection: 'row-reverse' }]}>
            <View style={[acs.statusBar, { backgroundColor: color }]} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={[acs.topRow, isRtl && { flexDirection: 'row-reverse' }]}>
                <Text style={[acs.title, isRtl && { textAlign: 'right' }]} numberOfLines={1}>{c.title}</Text>
                <View style={[acs.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                  <Text style={[acs.badgeText, { color }]}>{statusLabel(c.status, language).toUpperCase()}</Text>
                </View>
              </View>
              <View style={[acs.metaRow, isRtl && { flexDirection: 'row-reverse' }]}>
                <Text style={acs.meta}>{c.occasion_name}</Text>
                {c.occasion_date && <Text style={acs.meta}>{c.occasion_date}</Text>}
              </View>
              {c.notes ? <Text style={[acs.notes, isRtl && { textAlign: 'right' }]} numberOfLines={2}>{c.notes}</Text> : null}
              {/* Status action row */}
              <View style={[acs.actionRow, isRtl && { flexDirection: 'row-reverse' }]}>
                {c.status !== 'active' && (
                  <TouchableOpacity style={[acs.actionChip, { borderColor: Colors.success + '66' }]} onPress={() => onStatusChange(c.id, 'active')} activeOpacity={0.75}>
                    <Zap size={10} color={Colors.success} strokeWidth={2.5} />
                    <Text style={[acs.actionChipText, { color: Colors.success }]}>
                      {language === 'ar' ? 'تفعيل' : language === 'ckb' ? 'چالاک' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                )}
                {c.status !== 'completed' && (
                  <TouchableOpacity style={[acs.actionChip, { borderColor: Colors.neonBlue + '66' }]} onPress={() => onStatusChange(c.id, 'completed')} activeOpacity={0.75}>
                    <Check size={10} color={Colors.neonBlue} strokeWidth={2.5} />
                    <Text style={[acs.actionChipText, { color: Colors.neonBlue }]}>
                      {language === 'ar' ? 'مكتمل' : language === 'ckb' ? 'تەواو' : 'Complete'}
                    </Text>
                  </TouchableOpacity>
                )}
                {c.status !== 'dismissed' && (
                  <TouchableOpacity style={[acs.actionChip, { borderColor: Colors.error + '55' }]} onPress={() => onStatusChange(c.id, 'dismissed')} activeOpacity={0.75}>
                    <X size={10} color={Colors.error} strokeWidth={2.5} />
                    <Text style={[acs.actionChipText, { color: Colors.error }]}>
                      {language === 'ar' ? 'رفض' : language === 'ckb' ? 'ڕەت' : 'Dismiss'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[acs.actionChip, { borderColor: Colors.neonBlue + '55' }]} onPress={() => onLinkProducts(c)} activeOpacity={0.75}>
                  <Package size={10} color={Colors.neonBlue} strokeWidth={2.5} />
                  <Text style={[acs.actionChipText, { color: Colors.neonBlue }]}>
                    {language === 'ar' ? 'منتجات' : language === 'ckb' ? 'بەرهەمەکان' : 'Products'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[acs.actionChip, { borderColor: Colors.warning + '55' }]} onPress={() => onAddDiscount(c)} activeOpacity={0.75}>
                  <Percent size={10} color={Colors.warning} strokeWidth={2.5} />
                  <Text style={[acs.actionChipText, { color: Colors.warning }]}>
                    {language === 'ar' ? 'خصم' : language === 'ckb' ? 'داشکاندن' : 'Discount'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[acs.actionChip, { borderColor: Colors.success + '55' }]} onPress={() => onNotify(c)} activeOpacity={0.75}>
                  <Send size={10} color={Colors.success} strokeWidth={2.5} />
                  <Text style={[acs.actionChipText, { color: Colors.success }]}>
                    {language === 'ar' ? 'إشعار' : language === 'ckb' ? 'ئاگادارکردنەوە' : 'Notify'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </Animated.View>
  );
}

const acs = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  statusBar: { width: 4, alignSelf: 'stretch' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: Spacing.md, paddingBottom: 4 },
  title: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '800', flex: 1 },
  badge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.full, borderWidth: 1, flexShrink: 0,
  },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.md },
  meta: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  notes: { color: Colors.textSecondary, fontSize: FontSize.xs, paddingHorizontal: Spacing.md },
  actionRow: {
    flexDirection: 'row', gap: 6, flexWrap: 'wrap',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, paddingTop: 4,
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  actionChipText: { fontSize: 10, fontWeight: '700' },
});

// ─── Create Banner Modal ──────────────────────────────────────────────────────

interface CreateBannerModalProps {
  visible: boolean;
  occasion: Occasion | null;
  language: string;
  adminEmail: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

function CreateBannerModal({ visible, occasion, language, adminEmail, onClose, onSaved, onError }: CreateBannerModalProps) {
  const isRtl = language === 'ar' || language === 'ckb';
  const [title, setTitle] = useState('');
  const [cta, setCta] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && occasion) {
      const name = language === 'ar' ? occasion.nameAr : language === 'ckb' ? occasion.nameCkb : occasion.nameEn;
      const type = language === 'ar' ? occasion.campaignTypeAr : language === 'ckb' ? occasion.campaignTypeCkb : occasion.campaignType;
      setTitle(`${name} — ${type}`);
      setCta(language === 'ar' ? 'تسوق الآن' : language === 'ckb' ? 'ئێستا بکڕە' : 'Shop Now');
      setImageUrl('');
      setNotes('');
      const oDate = getOccasionDate(occasion);
      if (oDate) {
        const start = new Date(oDate);
        start.setDate(start.getDate() - 7);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(oDate.toISOString().split('T')[0]);
      } else {
        setStartDate('');
        setEndDate('');
      }
    }
  }, [visible, occasion, language]);

  if (!occasion) return null;

  const occasionName = language === 'ar' ? occasion.nameAr : language === 'ckb' ? occasion.nameCkb : occasion.nameEn;

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { error } = await adminSupabase().from('campaign_banners').insert({
        occasion_key: occasion.key,
        title: title.trim(),
        cta_text: cta.trim(),
        image_url: imageUrl.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes.trim(),
        admin_email: adminEmail,
      });
      if (error) throw error;
      onSaved(language === 'ar' ? 'تم حفظ البانر بنجاح' : language === 'ckb' ? 'بانەر بە سەرکەوتوویی پاشەکەوت کرا' : 'Banner saved successfully');
      onClose();
    } catch {
      onError(language === 'ar' ? 'فشل في حفظ البانر' : language === 'ckb' ? 'شکستی هێنا لە پاشەکەوتکردنی بانەر' : 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const L = {
    header:     language === 'ar' ? 'إنشاء بانر'              : language === 'ckb' ? 'دروستکردنی بانەر'              : 'Create Banner',
    titleLbl:   language === 'ar' ? 'عنوان البانر'            : language === 'ckb' ? 'سەردێڕی بانەر'                : 'Banner Title',
    ctaLbl:     language === 'ar' ? 'نص زر الدعوة'           : language === 'ckb' ? 'دەقی دوگمەی کارەکان'          : 'CTA Button Text',
    imgLbl:     language === 'ar' ? 'رابط الصورة (اختياري)'  : language === 'ckb' ? 'بەستەری وێنە (ئارەزوومەندانە)' : 'Image URL (optional)',
    startLbl:   language === 'ar' ? 'تاريخ البداية'          : language === 'ckb' ? 'بەرواری دەستپێکردن'            : 'Start Date',
    endLbl:     language === 'ar' ? 'تاريخ الانتهاء'         : language === 'ckb' ? 'بەرواری کۆتایی'               : 'End Date',
    notesLbl:   language === 'ar' ? 'ملاحظات'                : language === 'ckb' ? 'تێبینیەکان'                    : 'Notes',
    saveBtn:    language === 'ar' ? 'حفظ البانر'              : language === 'ckb' ? 'پاشەکەوتکردنی بانەر'           : 'Save Banner',
    cancelBtn:  language === 'ar' ? 'إلغاء'                   : language === 'ckb' ? 'پاشگەزبوونەوە'                 : 'Cancel',
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={bm.overlay}>
        <View style={bm.sheet}>
          <View style={[bm.header, isRtl && { flexDirection: 'row-reverse' }]}>
            <View style={bm.headerLeft}>
              <View style={[bm.iconWrap, { backgroundColor: Colors.warning + '22' }]}>
                <LayoutTemplate size={18} color={Colors.warning} strokeWidth={2} />
              </View>
              <View>
                <Text style={[bm.headerTitle, isRtl && { textAlign: 'right' }]}>{L.header}</Text>
                <Text style={[bm.headerSub, isRtl && { textAlign: 'right' }]}>{occasionName}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={bm.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={bm.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={bm.fieldWrap}>
              <Text style={[bm.label, isRtl && { textAlign: 'right' }]}>{L.titleLbl}</Text>
              <TextInput style={[bm.input, isRtl && { textAlign: 'right' }]} value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} placeholder={L.titleLbl} maxLength={120} />
            </View>
            <View style={bm.fieldWrap}>
              <Text style={[bm.label, isRtl && { textAlign: 'right' }]}>{L.ctaLbl}</Text>
              <TextInput style={[bm.input, isRtl && { textAlign: 'right' }]} value={cta} onChangeText={setCta} placeholderTextColor={Colors.textMuted} placeholder={L.ctaLbl} maxLength={60} />
            </View>
            <View style={bm.fieldWrap}>
              <Text style={[bm.label, isRtl && { textAlign: 'right' }]}>{L.imgLbl}</Text>
              <TextInput style={[bm.input, isRtl && { textAlign: 'right' }]} value={imageUrl} onChangeText={setImageUrl} placeholderTextColor={Colors.textMuted} placeholder="https://..." autoCapitalize="none" autoCorrect={false} />
            </View>
            <View style={[bm.row2, isRtl && { flexDirection: 'row-reverse' }]}>
              <View style={[bm.fieldWrap, { flex: 1 }]}>
                <Text style={[bm.label, isRtl && { textAlign: 'right' }]}>{L.startLbl}</Text>
                <TextInput style={[bm.input, isRtl && { textAlign: 'right' }]} value={startDate} onChangeText={setStartDate} placeholderTextColor={Colors.textMuted} placeholder="YYYY-MM-DD" />
              </View>
              <View style={[bm.fieldWrap, { flex: 1 }]}>
                <Text style={[bm.label, isRtl && { textAlign: 'right' }]}>{L.endLbl}</Text>
                <TextInput style={[bm.input, isRtl && { textAlign: 'right' }]} value={endDate} onChangeText={setEndDate} placeholderTextColor={Colors.textMuted} placeholder="YYYY-MM-DD" />
              </View>
            </View>
            <View style={bm.fieldWrap}>
              <Text style={[bm.label, isRtl && { textAlign: 'right' }]}>{L.notesLbl}</Text>
              <TextInput style={[bm.textarea, isRtl && { textAlign: 'right' }]} value={notes} onChangeText={setNotes} placeholderTextColor={Colors.textMuted} placeholder={L.notesLbl} multiline numberOfLines={3} maxLength={400} />
            </View>
          </ScrollView>

          <View style={[bm.footer, isRtl && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={bm.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={bm.cancelText}>{L.cancelBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[bm.saveBtn, (!title.trim() || saving) && bm.saveBtnDisabled]} onPress={handleSave} disabled={!title.trim() || saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator size="small" color={Colors.background} /> : <Check size={15} color={Colors.background} strokeWidth={2.5} />}
              <Text style={bm.saveText}>{L.saveBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const bm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  headerSub: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: Radius.sm, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  body: { padding: Spacing.lg },
  fieldWrap: { marginBottom: Spacing.md, gap: 6 },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: FontSize.sm },
  textarea: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: FontSize.sm, minHeight: 72, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: Spacing.md },
  footer: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: { flex: 2, height: 46, borderRadius: Radius.md, backgroundColor: Colors.warning, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
});

// ─── Send Reminder Modal ──────────────────────────────────────────────────────

const REMINDER_TYPES: ReminderType[] = ['in_app', 'notification_draft', 'campaign_note'];

function reminderTypeLabel(t: ReminderType, lang: string): string {
  const map: Record<ReminderType, { en: string; ar: string; ckb: string }> = {
    in_app:              { en: 'In-App Reminder',    ar: 'تذكير داخلي',           ckb: 'بیرخستنەوەی ناوەکی'       },
    notification_draft:  { en: 'Notification Draft', ar: 'مسودة إشعار',           ckb: 'پێشنووسی ئاگادارکردنەوە' },
    campaign_note:       { en: 'Campaign Note',      ar: 'ملاحظة حملة',           ckb: 'تێبینی کامپەین'           },
  };
  return lang === 'ar' ? map[t].ar : lang === 'ckb' ? map[t].ckb : map[t].en;
}

const REMINDER_TYPE_COLORS: Record<ReminderType, string> = {
  in_app: Colors.neonBlue,
  notification_draft: Colors.warning,
  campaign_note: Colors.success,
};

const REMINDER_STATUS_COLORS: Record<ReminderStatus, string> = {
  scheduled: Colors.neonBlue,
  sent: Colors.success,
  dismissed: Colors.textMuted,
};

function reminderStatusLabel(s: ReminderStatus, lang: string): string {
  const map: Record<ReminderStatus, { en: string; ar: string; ckb: string }> = {
    scheduled: { en: 'Scheduled', ar: 'مجدول',    ckb: 'کاتبەندیکراو'     },
    sent:      { en: 'Sent',      ar: 'مُرسل',    ckb: 'نێردراو'           },
    dismissed: { en: 'Dismissed', ar: 'مرفوض',    ckb: 'ڕەتکراوەتەوە'     },
  };
  return lang === 'ar' ? map[s].ar : lang === 'ckb' ? map[s].ckb : map[s].en;
}

interface SendReminderModalProps {
  visible: boolean;
  occasion: Occasion | null;
  language: string;
  adminEmail: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

function SendReminderModal({ visible, occasion, language, adminEmail, onClose, onSaved, onError }: SendReminderModalProps) {
  const isRtl = language === 'ar' || language === 'ckb';
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [reminderType, setReminderType] = useState<ReminderType>('in_app');
  const [reminderDate, setReminderDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && occasion) {
      const name = language === 'ar' ? occasion.nameAr : language === 'ckb' ? occasion.nameCkb : occasion.nameEn;
      setTitle(language === 'ar' ? `تذكير: ${name}` : language === 'ckb' ? `بیرخستنەوە: ${name}` : `Reminder: ${name}`);
      setMessage(
        language === 'ar'
          ? `تذكير بمناسبة ${name}. قم بتجهيز حملتك التسويقية.`
          : language === 'ckb'
          ? `بیرخستنەوەی ئۆکازیۆنی ${name}. کامپەینی مارکتینگت ئامادە بکە.`
          : `Reminder for ${name}. Prepare your marketing campaign.`
      );
      setReminderType('in_app');
      const oDate = getOccasionDate(occasion);
      if (oDate) {
        const remind = new Date(oDate);
        remind.setDate(remind.getDate() - 3);
        setReminderDate(remind.toISOString().split('T')[0]);
      } else {
        setReminderDate('');
      }
    }
  }, [visible, occasion, language]);

  if (!occasion) return null;

  const occasionName = language === 'ar' ? occasion.nameAr : language === 'ckb' ? occasion.nameCkb : occasion.nameEn;

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { error } = await adminSupabase().from('campaign_reminders').insert({
        occasion_key: occasion.key,
        event_key: occasion.key,
        title_en: title.trim(),
        message_en: message.trim(),
        body_en: message.trim(),
        reminder_type: reminderType,
        status: 'scheduled',
        reminder_date: reminderDate ? new Date(reminderDate).toISOString() : null,
        admin_email: adminEmail,
        created_by_email: adminEmail,
        is_active: true,
      });
      if (error) throw error;
      onSaved(language === 'ar' ? 'تم جدولة التذكير' : language === 'ckb' ? 'بیرخستنەوە کاتبەندی کرا' : 'Reminder scheduled');
      onClose();
    } catch {
      onError(language === 'ar' ? 'فشل في حفظ التذكير' : language === 'ckb' ? 'شکستی هێنا لە پاشەکەوتکردنی بیرخستنەوە' : 'Failed to save reminder');
    } finally {
      setSaving(false);
    }
  };

  const L = {
    header:    language === 'ar' ? 'إرسال تذكير'        : language === 'ckb' ? 'ناردنی بیرخستنەوە'   : 'Send Reminder',
    titleLbl:  language === 'ar' ? 'عنوان التذكير'      : language === 'ckb' ? 'سەردێڕی بیرخستنەوە' : 'Reminder Title',
    msgLbl:    language === 'ar' ? 'الرسالة'            : language === 'ckb' ? 'پەیام'               : 'Message',
    typeLbl:   language === 'ar' ? 'نوع التذكير'        : language === 'ckb' ? 'جۆری بیرخستنەوە'    : 'Reminder Type',
    dateLbl:   language === 'ar' ? 'تاريخ التذكير'      : language === 'ckb' ? 'بەرواری بیرخستنەوە' : 'Remind On',
    saveBtn:   language === 'ar' ? 'جدولة التذكير'      : language === 'ckb' ? 'کاتبەندی بیرخستنەوە': 'Schedule Reminder',
    cancelBtn: language === 'ar' ? 'إلغاء'               : language === 'ckb' ? 'پاشگەزبوونەوە'      : 'Cancel',
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={rm.sheet}>
          <View style={[rm.header, isRtl && { flexDirection: 'row-reverse' }]}>
            <View style={rm.headerLeft}>
              <View style={[rm.iconWrap, { backgroundColor: Colors.success + '22' }]}>
                <Bell size={18} color={Colors.success} strokeWidth={2} />
              </View>
              <View>
                <Text style={[rm.headerTitle, isRtl && { textAlign: 'right' }]}>{L.header}</Text>
                <Text style={[rm.headerSub, isRtl && { textAlign: 'right' }]}>{occasionName}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={rm.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={rm.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={rm.fieldWrap}>
              <Text style={[rm.label, isRtl && { textAlign: 'right' }]}>{L.titleLbl}</Text>
              <TextInput style={[rm.input, isRtl && { textAlign: 'right' }]} value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} placeholder={L.titleLbl} maxLength={120} />
            </View>

            <View style={rm.fieldWrap}>
              <Text style={[rm.label, isRtl && { textAlign: 'right' }]}>{L.typeLbl}</Text>
              <View style={[rm.typeRow, isRtl && { flexDirection: 'row-reverse' }]}>
                {REMINDER_TYPES.map((t) => {
                  const active = reminderType === t;
                  const color = REMINDER_TYPE_COLORS[t];
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[rm.typeChip, active && { backgroundColor: color + '22', borderColor: color + '66' }]}
                      onPress={() => setReminderType(t)}
                      activeOpacity={0.75}
                    >
                      <Text style={[rm.typeChipText, active && { color, fontWeight: '800' }]}>
                        {reminderTypeLabel(t, language)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={rm.fieldWrap}>
              <Text style={[rm.label, isRtl && { textAlign: 'right' }]}>{L.dateLbl}</Text>
              <TextInput style={[rm.input, isRtl && { textAlign: 'right' }]} value={reminderDate} onChangeText={setReminderDate} placeholderTextColor={Colors.textMuted} placeholder="YYYY-MM-DD" />
            </View>

            <View style={rm.fieldWrap}>
              <Text style={[rm.label, isRtl && { textAlign: 'right' }]}>{L.msgLbl}</Text>
              <TextInput style={[rm.textarea, isRtl && { textAlign: 'right' }]} value={message} onChangeText={setMessage} placeholderTextColor={Colors.textMuted} placeholder={L.msgLbl} multiline numberOfLines={4} maxLength={500} />
            </View>
          </ScrollView>

          <View style={[rm.footer, isRtl && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={rm.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={rm.cancelText}>{L.cancelBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[rm.saveBtn, (!title.trim() || saving) && rm.saveBtnDisabled]} onPress={handleSave} disabled={!title.trim() || saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator size="small" color={Colors.background} /> : <Bell size={15} color={Colors.background} strokeWidth={2.5} />}
              <Text style={rm.saveText}>{L.saveBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  headerSub: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: Radius.sm, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  body: { padding: Spacing.lg },
  fieldWrap: { marginBottom: Spacing.md, gap: 6 },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: FontSize.sm },
  textarea: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: FontSize.sm, minHeight: 90, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: 'transparent' },
  typeChipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: { flex: 2, height: 46, borderRadius: Radius.md, backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
});

// ─── Reminders Section ────────────────────────────────────────────────────────

interface RemindersSectionProps {
  reminders: CampaignReminder[];
  language: string;
  onStatusChange: (id: string, status: ReminderStatus) => void;
}

function RemindersSection({ reminders, language, onStatusChange }: RemindersSectionProps) {
  const isRtl = language === 'ar' || language === 'ckb';
  const [tab, setTab] = useState<'scheduled' | 'sent' | 'dismissed'>('scheduled');

  if (reminders.length === 0) return null;

  const filtered = reminders.filter(r => r.status === tab);
  const tabColor = tab === 'scheduled' ? Colors.neonBlue : tab === 'sent' ? Colors.success : Colors.textMuted;

  const tabs: { key: ReminderStatus; label: string }[] = [
    { key: 'scheduled', label: language === 'ar' ? 'مجدول' : language === 'ckb' ? 'کاتبەندیکراو' : 'Scheduled' },
    { key: 'sent',      label: language === 'ar' ? 'مُرسل'  : language === 'ckb' ? 'نێردراو'       : 'Sent'       },
    { key: 'dismissed', label: language === 'ar' ? 'مرفوض'  : language === 'ckb' ? 'ڕەتکراوەتەوە' : 'Dismissed'  },
  ];

  const scheduledCount = reminders.filter(r => r.status === 'scheduled').length;

  return (
    <View>
      <SectionHeader
        title={language === 'ar' ? 'التذكيرات المجدولة' : language === 'ckb' ? 'بیرخستنەوەی کاتبەندیکراو' : 'Scheduled Reminders'}
        count={scheduledCount > 0 ? scheduledCount : undefined}
        color={Colors.neonBlue}
      />

      {/* Tabs */}
      <View style={[rs.tabs, isRtl && { flexDirection: 'row-reverse' }]}>
        {tabs.map((t) => {
          const active = tab === t.key;
          const color = REMINDER_STATUS_COLORS[t.key];
          return (
            <TouchableOpacity
              key={t.key}
              style={[rs.tab, active && { borderBottomColor: color, borderBottomWidth: 2 }]}
              onPress={() => setTab(t.key as typeof tab)}
              activeOpacity={0.8}
            >
              <Text style={[rs.tabText, active && { color, fontWeight: '800' }]}>{t.label}</Text>
              <View style={rs.tabCount}>
                <Text style={rs.tabCountText}>{reminders.filter(r => r.status === t.key).length}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <View style={rs.empty}>
          <Bell size={28} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={rs.emptyText}>{language === 'ar' ? 'لا توجد تذكيرات' : language === 'ckb' ? 'هیچ بیرخستنەوەیەک نییە' : 'No reminders here'}</Text>
        </View>
      ) : (
        filtered.map((r) => {
          const color = REMINDER_STATUS_COLORS[r.status];
          const typeColor = REMINDER_TYPE_COLORS[r.reminder_type] ?? Colors.textMuted;
          return (
            <View key={r.id} style={[rs.card, isRtl && { flexDirection: 'row-reverse' }]}>
              <View style={[rs.statusBar, { backgroundColor: color }]} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={[rs.topRow, isRtl && { flexDirection: 'row-reverse' }]}>
                  <Text style={[rs.title, isRtl && { textAlign: 'right' }]} numberOfLines={1}>{r.title_en}</Text>
                  <View style={[rs.typeBadge, { backgroundColor: typeColor + '22', borderColor: typeColor + '55' }]}>
                    <Text style={[rs.typeBadgeText, { color: typeColor }]}>{reminderTypeLabel(r.reminder_type, language).toUpperCase()}</Text>
                  </View>
                </View>
                {r.message_en ? <Text style={[rs.msg, isRtl && { textAlign: 'right' }]} numberOfLines={2}>{r.message_en}</Text> : null}
                <View style={[rs.metaRow, isRtl && { flexDirection: 'row-reverse' }]}>
                  {r.reminder_date && (
                    <View style={rs.dateChip}>
                      <Clock size={10} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={rs.dateText}>{r.reminder_date.split('T')[0]}</Text>
                    </View>
                  )}
                  <Text style={rs.adminText}>{r.admin_email}</Text>
                </View>
                {r.status !== 'sent' && r.status !== 'dismissed' && (
                  <View style={[rs.actions, isRtl && { flexDirection: 'row-reverse' }]}>
                    <TouchableOpacity style={[rs.actionChip, { borderColor: Colors.success + '66' }]} onPress={() => onStatusChange(r.id, 'sent')} activeOpacity={0.75}>
                      <Check size={10} color={Colors.success} strokeWidth={2.5} />
                      <Text style={[rs.actionChipText, { color: Colors.success }]}>
                        {language === 'ar' ? 'تحديد كمُرسل' : language === 'ckb' ? 'نیشانەکردن وەکو نێردراو' : 'Mark Sent'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[rs.actionChip, { borderColor: Colors.error + '55' }]} onPress={() => onStatusChange(r.id, 'dismissed')} activeOpacity={0.75}>
                      <X size={10} color={Colors.error} strokeWidth={2.5} />
                      <Text style={[rs.actionChipText, { color: Colors.error }]}>
                        {language === 'ar' ? 'رفض' : language === 'ckb' ? 'ڕەت' : 'Dismiss'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const rs = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tabText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  tabCount: { backgroundColor: Colors.backgroundCard, borderRadius: Radius.full, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: Colors.border },
  tabCountText: { color: Colors.textMuted, fontSize: 9, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm },
  card: { flexDirection: 'row', backgroundColor: Colors.backgroundCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: Spacing.sm },
  statusBar: { width: 4, alignSelf: 'stretch' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: Spacing.md, paddingBottom: 4 },
  title: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1, flexShrink: 0 },
  typeBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  msg: { color: Colors.textSecondary, fontSize: FontSize.xs, paddingHorizontal: Spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dateText: { color: Colors.textMuted, fontSize: FontSize.xs },
  adminText: { color: Colors.textMuted, fontSize: FontSize.xs, flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, paddingTop: 4 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundSecondary },
  actionChipText: { fontSize: 10, fontWeight: '700' },
});

// ─── Campaign Products Modal ──────────────────────────────────────────────────

interface CampaignProductsModalProps {
  visible: boolean;
  campaign: SavedCampaign | null;
  language: string;
  adminEmail: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

function CampaignProductsModal({ visible, campaign, language, adminEmail, onClose, onSaved, onError }: CampaignProductsModalProps) {
  const isRtl = language === 'ar' || language === 'ckb';
  const [rows, setRows] = useState<{ product_id: string; category_slug: string; is_featured: boolean }[]>([
    { product_id: '', category_slug: '', is_featured: false },
  ]);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    if (visible && campaign) {
      setLoadingExisting(true);
      adminSupabase()
        .from('campaign_products')
        .select('id,product_id,category_slug,is_featured')
        .eq('campaign_id', campaign.id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setRows(data.map((r: any) => ({ product_id: r.product_id ?? '', category_slug: r.category_slug ?? '', is_featured: r.is_featured ?? false })));
            setExistingIds(data.map((r: any) => r.id));
          } else {
            setRows([{ product_id: '', category_slug: '', is_featured: false }]);
            setExistingIds([]);
          }
          setLoadingExisting(false);
        });
    }
  }, [visible, campaign]);

  if (!campaign) return null;

  const addRow = () => setRows(prev => [...prev, { product_id: '', category_slug: '', is_featured: false }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, val: any) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const handleSave = async () => {
    setSaving(true);
    try {
      const db = adminSupabase();
      // Delete existing rows for this campaign then re-insert
      if (existingIds.length > 0) {
        await db.from('campaign_products').delete().in('id', existingIds);
      }
      const validRows = rows.filter(r => r.product_id.trim() || r.category_slug.trim());
      if (validRows.length > 0) {
        const inserts = validRows.map((r, i) => ({
          campaign_id: campaign.id,
          product_id: r.product_id.trim() || null,
          category_slug: r.category_slug.trim(),
          is_featured: r.is_featured,
          sort_order: i,
          admin_email: adminEmail,
        }));
        const { error } = await db.from('campaign_products').insert(inserts);
        if (error) throw error;
      }
      onSaved(language === 'ar' ? 'تم حفظ المنتجات' : language === 'ckb' ? 'بەرهەمەکان پاشەکەوت کران' : 'Products saved');
      onClose();
    } catch {
      onError(language === 'ar' ? 'فشل في حفظ المنتجات' : language === 'ckb' ? 'شکستی هێنا لە پاشەکەوتکردنی بەرهەمەکان' : 'Failed to save products');
    } finally {
      setSaving(false);
    }
  };

  const L = {
    header:    language === 'ar' ? 'منتجات الحملة'     : language === 'ckb' ? 'بەرهەمەکانی کامپەین'   : 'Campaign Products',
    productId: language === 'ar' ? 'ID المنتج'         : language === 'ckb' ? 'ناسنامەی بەرهەم'       : 'Product ID',
    category:  language === 'ar' ? 'الفئة'             : language === 'ckb' ? 'پۆل'                   : 'Category Slug',
    featured:  language === 'ar' ? 'مميز'              : language === 'ckb' ? 'تایبەت'                : 'Featured',
    addBtn:    language === 'ar' ? 'إضافة منتج'        : language === 'ckb' ? 'زیادکردنی بەرهەم'      : 'Add Row',
    saveBtn:   language === 'ar' ? 'حفظ المنتجات'      : language === 'ckb' ? 'پاشەکەوتکردنی بەرهەم'  : 'Save Products',
    cancelBtn: language === 'ar' ? 'إلغاء'              : language === 'ckb' ? 'پاشگەزبوونەوە'         : 'Cancel',
    hint:      language === 'ar' ? 'اترك ID فارغاً لربط فئة كاملة' : language === 'ckb' ? 'ناسنامە بەتاڵ بهێڵە بۆ بەستنی هەموو پۆلێک' : 'Leave Product ID empty to link an entire category',
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={[pm.header, isRtl && { flexDirection: 'row-reverse' }]}>
            <View style={pm.headerLeft}>
              <View style={pm.iconWrap}>
                <Package size={18} color={Colors.neonBlue} strokeWidth={2} />
              </View>
              <View>
                <Text style={[pm.headerTitle, isRtl && { textAlign: 'right' }]}>{L.header}</Text>
                <Text style={[pm.headerSub, isRtl && { textAlign: 'right' }]} numberOfLines={1}>{campaign.title}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={pm.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={pm.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[pm.hint, isRtl && { textAlign: 'right' }]}>{L.hint}</Text>

            {loadingExisting ? (
              <ActivityIndicator size="small" color={Colors.neonBlue} style={{ marginVertical: 20 }} />
            ) : (
              rows.map((row, i) => (
                <View key={i} style={pm.rowWrap}>
                  <View style={[pm.rowFields, isRtl && { flexDirection: 'row-reverse' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[pm.label, isRtl && { textAlign: 'right' }]}>{L.productId}</Text>
                      <TextInput
                        style={[pm.input, isRtl && { textAlign: 'right' }]}
                        value={row.product_id}
                        onChangeText={v => updateRow(i, 'product_id', v)}
                        placeholder="uuid"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[pm.label, isRtl && { textAlign: 'right' }]}>{L.category}</Text>
                      <TextInput
                        style={[pm.input, isRtl && { textAlign: 'right' }]}
                        value={row.category_slug}
                        onChangeText={v => updateRow(i, 'category_slug', v)}
                        placeholder="makeup"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                  <View style={[pm.rowMeta, isRtl && { flexDirection: 'row-reverse' }]}>
                    <TouchableOpacity
                      style={[pm.featuredChip, row.is_featured && pm.featuredChipActive]}
                      onPress={() => updateRow(i, 'is_featured', !row.is_featured)}
                      activeOpacity={0.75}
                    >
                      <Star size={11} color={row.is_featured ? Colors.gold : Colors.textMuted} strokeWidth={row.is_featured ? 3 : 2} />
                      <Text style={[pm.featuredChipText, row.is_featured && { color: Colors.gold }]}>{L.featured}</Text>
                    </TouchableOpacity>
                    {rows.length > 1 && (
                      <TouchableOpacity style={pm.removeBtn} onPress={() => removeRow(i)} activeOpacity={0.75}>
                        <X size={13} color={Colors.error} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity style={pm.addRowBtn} onPress={addRow} activeOpacity={0.75}>
              <Plus size={13} color={Colors.neonBlue} strokeWidth={2.5} />
              <Text style={pm.addRowText}>{L.addBtn}</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[pm.footer, isRtl && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={pm.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={pm.cancelText}>{L.cancelBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[pm.saveBtn, saving && pm.saveBtnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator size="small" color={Colors.background} /> : <Check size={15} color={Colors.background} strokeWidth={2.5} />}
              <Text style={pm.saveText}>{L.saveBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neonBlue + '20', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  headerSub: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', marginTop: 2, maxWidth: 220 },
  closeBtn: { padding: 6, borderRadius: Radius.sm, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  body: { padding: Spacing.lg },
  hint: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: Spacing.md, lineHeight: 16 },
  rowWrap: { backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.sm, gap: 8 },
  rowFields: { flexDirection: 'row', gap: Spacing.sm },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  input: { backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, color: Colors.textPrimary, fontSize: FontSize.xs },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featuredChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: 'transparent' },
  featuredChipActive: { borderColor: Colors.gold + '66', backgroundColor: Colors.gold + '15' },
  featuredChipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  removeBtn: { marginLeft: 'auto' as any, padding: 4 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, marginTop: 4 },
  addRowText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: { flex: 2, height: 46, borderRadius: Radius.md, backgroundColor: Colors.neonBlue, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
});

// ─── Campaign Discount Modal ───────────────────────────────────────────────────

interface CampaignDiscountModalProps {
  visible: boolean;
  campaign: SavedCampaign | null;
  language: string;
  adminEmail: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

function CampaignDiscountModal({ visible, campaign, language, adminEmail, onClose, onSaved, onError }: CampaignDiscountModalProps) {
  const isRtl = language === 'ar' || language === 'ckb';
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoActivate, setAutoActivate] = useState(true);
  const [offerBadge, setOfferBadge] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && campaign) {
      setDiscountType('percentage');
      setDiscountValue('');
      setCouponCode('');
      setMinOrder('');
      setMaxUses('');
      setStartDate(campaign.start_date ?? '');
      setEndDate(campaign.end_date ?? '');
      setAutoActivate(campaign.auto_activate ?? true);
      setOfferBadge(campaign.offer_badge ?? '');
      setIsActive(true);
      setExistingId(null);
      // Load existing discount if any
      adminSupabase()
        .from('campaign_discounts')
        .select('*')
        .eq('campaign_id', campaign.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setExistingId(data.id);
            setDiscountType(data.discount_type);
            setDiscountValue(String(data.discount_value));
            setCouponCode(data.coupon_code);
            setMinOrder(data.min_order_amount ? String(data.min_order_amount) : '');
            setMaxUses(data.max_uses ? String(data.max_uses) : '');
            setIsActive(data.is_active);
          }
        });
    }
  }, [visible, campaign]);

  if (!campaign) return null;

  const handleSave = async () => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    try {
      const db = adminSupabase();
      const payload = {
        campaign_id: campaign.id,
        discount_type: discountType,
        discount_value: val,
        coupon_code: couponCode.trim().toUpperCase(),
        min_order_amount: parseFloat(minOrder) || 0,
        max_uses: maxUses ? parseInt(maxUses) : null,
        is_active: isActive,
        admin_email: adminEmail,
        updated_at: new Date().toISOString(),
      };
      let discError;
      if (existingId) {
        ({ error: discError } = await db.from('campaign_discounts').update(payload).eq('id', existingId));
      } else {
        ({ error: discError } = await db.from('campaign_discounts').insert(payload));
      }
      if (discError) throw discError;

      // Also update campaign start/end/auto_activate/offer_badge
      await db.from('saved_campaigns').update({
        start_date: startDate || null,
        end_date: endDate || null,
        auto_activate: autoActivate,
        offer_badge: offerBadge.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaign.id);

      // Propagate offer_badge to linked products
      if (offerBadge.trim()) {
        const { data: linked } = await db.from('campaign_products').select('product_id').eq('campaign_id', campaign.id).not('product_id', 'is', null);
        if (linked && linked.length > 0) {
          const ids = linked.map((r: any) => r.product_id).filter(Boolean);
          if (ids.length > 0) {
            await db.from('products').update({ badge: offerBadge.trim() }).in('id', ids);
          }
        }
      }

      onSaved(language === 'ar' ? 'تم حفظ الخصم' : language === 'ckb' ? 'داشکاندن پاشەکەوت کرا' : 'Discount saved');
      onClose();
    } catch {
      onError(language === 'ar' ? 'فشل في حفظ الخصم' : language === 'ckb' ? 'شکستی هێنا لە پاشەکەوتکردنی داشکاندن' : 'Failed to save discount');
    } finally {
      setSaving(false);
    }
  };

  const L = {
    header:      language === 'ar' ? 'خصم الحملة'                 : language === 'ckb' ? 'داشکاندنی کامپەین'                : 'Campaign Discount',
    typeLbl:     language === 'ar' ? 'نوع الخصم'                  : language === 'ckb' ? 'جۆری داشکاندن'                    : 'Discount Type',
    valueLbl:    language === 'ar' ? 'قيمة الخصم'                 : language === 'ckb' ? 'بەهای داشکاندن'                   : 'Discount Value',
    couponLbl:   language === 'ar' ? 'كود الكوبون'                : language === 'ckb' ? 'کۆدی کووپۆن'                      : 'Coupon Code',
    minLbl:      language === 'ar' ? 'الحد الأدنى للطلب'          : language === 'ckb' ? 'کەمترین داواکاری'                 : 'Min Order (IQD)',
    maxLbl:      language === 'ar' ? 'الحد الأقصى للاستخدام'      : language === 'ckb' ? 'زۆرترین بەکارهێنان'               : 'Max Uses',
    startLbl:    language === 'ar' ? 'تاريخ البداية'               : language === 'ckb' ? 'بەرواری دەستپێکردن'               : 'Start Date',
    endLbl:      language === 'ar' ? 'تاريخ الانتهاء'              : language === 'ckb' ? 'بەرواری کۆتایی'                   : 'End Date',
    autoLbl:     language === 'ar' ? 'تفعيل تلقائي'               : language === 'ckb' ? 'خودکار چالاک'                     : 'Auto-activate',
    badgeLbl:    language === 'ar' ? 'نص شارة العرض'              : language === 'ckb' ? 'دەقی نیشانەی پێشکەش'              : 'Offer Badge Text',
    activeLbl:   language === 'ar' ? 'الخصم نشط'                  : language === 'ckb' ? 'داشکاندن چالاکە'                  : 'Discount Active',
    saveBtn:     language === 'ar' ? 'حفظ الخصم'                  : language === 'ckb' ? 'پاشەکەوتکردنی داشکاندن'           : 'Save Discount',
    cancelBtn:   language === 'ar' ? 'إلغاء'                       : language === 'ckb' ? 'پاشگەزبوونەوە'                    : 'Cancel',
    pctLabel:    language === 'ar' ? 'نسبة %'                      : language === 'ckb' ? '٪ ڕێژە'                           : '% Percentage',
    fixedLabel:  language === 'ar' ? 'مبلغ ثابت'                  : language === 'ckb' ? 'بڕی دیاریکراو'                    : 'Fixed Amount',
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dm2.overlay}>
        <View style={dm2.sheet}>
          <View style={[dm2.header, isRtl && { flexDirection: 'row-reverse' }]}>
            <View style={dm2.headerLeft}>
              <View style={dm2.iconWrap}>
                <Percent size={18} color={Colors.warning} strokeWidth={2} />
              </View>
              <View>
                <Text style={[dm2.headerTitle, isRtl && { textAlign: 'right' }]}>{L.header}</Text>
                <Text style={[dm2.headerSub, isRtl && { textAlign: 'right' }]} numberOfLines={1}>{campaign.title}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={dm2.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={dm2.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Discount type */}
            <View style={dm2.fieldWrap}>
              <Text style={[dm2.label, isRtl && { textAlign: 'right' }]}>{L.typeLbl}</Text>
              <View style={[dm2.typeRow, isRtl && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity
                  style={[dm2.typeChip, discountType === 'percentage' && { backgroundColor: Colors.warning + '22', borderColor: Colors.warning + '66' }]}
                  onPress={() => setDiscountType('percentage')} activeOpacity={0.75}
                >
                  <Percent size={12} color={discountType === 'percentage' ? Colors.warning : Colors.textMuted} strokeWidth={2} />
                  <Text style={[dm2.typeChipText, discountType === 'percentage' && { color: Colors.warning, fontWeight: '800' }]}>{L.pctLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[dm2.typeChip, discountType === 'fixed' && { backgroundColor: Colors.success + '22', borderColor: Colors.success + '66' }]}
                  onPress={() => setDiscountType('fixed')} activeOpacity={0.75}
                >
                  <Tag size={12} color={discountType === 'fixed' ? Colors.success : Colors.textMuted} strokeWidth={2} />
                  <Text style={[dm2.typeChipText, discountType === 'fixed' && { color: Colors.success, fontWeight: '800' }]}>{L.fixedLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Value + Coupon */}
            <View style={[dm2.row2, isRtl && { flexDirection: 'row-reverse' }]}>
              <View style={[dm2.fieldWrap, { flex: 1 }]}>
                <Text style={[dm2.label, isRtl && { textAlign: 'right' }]}>{L.valueLbl}</Text>
                <TextInput
                  style={[dm2.input, isRtl && { textAlign: 'right' }]}
                  value={discountValue} onChangeText={setDiscountValue}
                  keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted}
                  placeholder={discountType === 'percentage' ? '10' : '5000'}
                />
              </View>
              <View style={[dm2.fieldWrap, { flex: 1 }]}>
                <Text style={[dm2.label, isRtl && { textAlign: 'right' }]}>{L.couponLbl}</Text>
                <TextInput
                  style={[dm2.input, isRtl && { textAlign: 'right' }]}
                  value={couponCode} onChangeText={v => setCouponCode(v.toUpperCase())}
                  placeholder="EID2026" placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters" autoCorrect={false}
                />
              </View>
            </View>

            {/* Min order + Max uses */}
            <View style={[dm2.row2, isRtl && { flexDirection: 'row-reverse' }]}>
              <View style={[dm2.fieldWrap, { flex: 1 }]}>
                <Text style={[dm2.label, isRtl && { textAlign: 'right' }]}>{L.minLbl}</Text>
                <TextInput style={[dm2.input, isRtl && { textAlign: 'right' }]} value={minOrder} onChangeText={setMinOrder} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={[dm2.fieldWrap, { flex: 1 }]}>
                <Text style={[dm2.label, isRtl && { textAlign: 'right' }]}>{L.maxLbl}</Text>
                <TextInput style={[dm2.input, isRtl && { textAlign: 'right' }]} value={maxUses} onChangeText={setMaxUses} keyboardType="number-pad" placeholder="∞" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>

            {/* Start + End dates */}
            <View style={[dm2.row2, isRtl && { flexDirection: 'row-reverse' }]}>
              <View style={[dm2.fieldWrap, { flex: 1 }]}>
                <Text style={[dm2.label, isRtl && { textAlign: 'right' }]}>{L.startLbl}</Text>
                <TextInput style={[dm2.input, isRtl && { textAlign: 'right' }]} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={[dm2.fieldWrap, { flex: 1 }]}>
                <Text style={[dm2.label, isRtl && { textAlign: 'right' }]}>{L.endLbl}</Text>
                <TextInput style={[dm2.input, isRtl && { textAlign: 'right' }]} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>

            {/* Offer badge */}
            <View style={dm2.fieldWrap}>
              <Text style={[dm2.label, isRtl && { textAlign: 'right' }]}>{L.badgeLbl}</Text>
              <TextInput style={[dm2.input, isRtl && { textAlign: 'right' }]} value={offerBadge} onChangeText={setOfferBadge} placeholder="SALE • 10% OFF" placeholderTextColor={Colors.textMuted} maxLength={30} />
            </View>

            {/* Toggles */}
            <View style={[dm2.toggleRow, isRtl && { flexDirection: 'row-reverse' }]}>
              <TouchableOpacity
                style={[dm2.toggleChip, autoActivate && { borderColor: Colors.success + '66', backgroundColor: Colors.success + '15' }]}
                onPress={() => setAutoActivate(v => !v)} activeOpacity={0.75}
              >
                <Zap size={12} color={autoActivate ? Colors.success : Colors.textMuted} strokeWidth={2.5} />
                <Text style={[dm2.toggleChipText, autoActivate && { color: Colors.success }]}>{L.autoLbl}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dm2.toggleChip, isActive && { borderColor: Colors.neonBlue + '66', backgroundColor: Colors.neonBlue + '15' }]}
                onPress={() => setIsActive(v => !v)} activeOpacity={0.75}
              >
                <Check size={12} color={isActive ? Colors.neonBlue : Colors.textMuted} strokeWidth={2.5} />
                <Text style={[dm2.toggleChipText, isActive && { color: Colors.neonBlue }]}>{L.activeLbl}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[dm2.footer, isRtl && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={dm2.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={dm2.cancelText}>{L.cancelBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dm2.saveBtn, (saving || !discountValue) && dm2.saveBtnDisabled]}
              onPress={handleSave} disabled={saving || !discountValue} activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator size="small" color={Colors.background} /> : <Check size={15} color={Colors.background} strokeWidth={2.5} />}
              <Text style={dm2.saveText}>{L.saveBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dm2 = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.warning + '20', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  headerSub: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', marginTop: 2, maxWidth: 220 },
  closeBtn: { padding: 6, borderRadius: Radius.sm, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  body: { padding: Spacing.lg },
  fieldWrap: { marginBottom: Spacing.md, gap: 6 },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: FontSize.sm },
  row2: { flexDirection: 'row', gap: Spacing.md },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: 'transparent' },
  typeChipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  toggleChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: 'transparent' },
  toggleChipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: { flex: 2, height: 46, borderRadius: Radius.md, backgroundColor: Colors.warning, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
});

// ─── Campaign Notification Modal ───────────────────────────────────────────────

interface CampaignNotifyModalProps {
  visible: boolean;
  campaign: SavedCampaign | null;
  language: string;
  adminEmail: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

function CampaignNotifyModal({ visible, campaign, language, adminEmail, onClose, onSaved, onError }: CampaignNotifyModalProps) {
  const isRtl = language === 'ar' || language === 'ckb';
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notifyType, setNotifyType] = useState<'in_app' | 'email_draft'>('in_app');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && campaign) {
      setTitle(campaign.title);
      setBody(
        language === 'ar'
          ? `حملة ${campaign.occasion_name} متاحة الآن. استفد من العروض الحصرية.`
          : language === 'ckb'
          ? `کامپەینی ${campaign.occasion_name} ئێستا بەردەستە. سوود لە پێشکەشکردنەکان وەربگرە.`
          : `${campaign.occasion_name} campaign is now live. Take advantage of exclusive offers.`
      );
      setNotifyType('in_app');
    }
  }, [visible, campaign, language]);

  if (!campaign) return null;

  const handleSend = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      // Save as a campaign reminder with type notification_draft
      const { error } = await adminSupabase().from('campaign_reminders').insert({
        occasion_key: campaign.occasion_key,
        event_key: campaign.occasion_key,
        title_en: title.trim(),
        message_en: body.trim(),
        body_en: body.trim(),
        reminder_type: notifyType === 'in_app' ? 'in_app' : 'notification_draft',
        status: 'scheduled',
        admin_email: adminEmail,
        created_by_email: adminEmail,
        is_active: true,
        campaign_id: campaign.id,
      });
      if (error) throw error;
      onSaved(language === 'ar' ? 'تم إرسال الإشعار' : language === 'ckb' ? 'ئاگادارکردنەوە نێردرا' : 'Notification sent');
      onClose();
    } catch {
      onError(language === 'ar' ? 'فشل في الإرسال' : language === 'ckb' ? 'شکستی هێنا لە ناردن' : 'Failed to send notification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={nm.overlay}>
        <View style={nm.sheet}>
          <View style={[nm.header, isRtl && { flexDirection: 'row-reverse' }]}>
            <View style={nm.headerLeft}>
              <View style={nm.iconWrap}>
                <Send size={18} color={Colors.success} strokeWidth={2} />
              </View>
              <View>
                <Text style={[nm.headerTitle, isRtl && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'إرسال إشعار' : language === 'ckb' ? 'ناردنی ئاگادارکردنەوە' : 'Send Notification'}
                </Text>
                <Text style={[nm.headerSub, isRtl && { textAlign: 'right' }]} numberOfLines={1}>{campaign.title}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={nm.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={nm.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Type */}
            <View style={nm.fieldWrap}>
              <Text style={[nm.label, isRtl && { textAlign: 'right' }]}>
                {language === 'ar' ? 'طريقة الإرسال' : language === 'ckb' ? 'ڕێگای ناردن' : 'Delivery Method'}
              </Text>
              <View style={[nm.typeRow, isRtl && { flexDirection: 'row-reverse' }]}>
                {(['in_app', 'email_draft'] as const).map((t) => {
                  const active = notifyType === t;
                  const label = t === 'in_app'
                    ? (language === 'ar' ? 'داخل التطبيق' : language === 'ckb' ? 'ناوەکی' : 'In-App')
                    : (language === 'ar' ? 'مسودة بريد' : language === 'ckb' ? 'پێشنووسی ئیمەیل' : 'Email Draft');
                  return (
                    <TouchableOpacity key={t} style={[nm.typeChip, active && { borderColor: Colors.success + '66', backgroundColor: Colors.success + '15' }]} onPress={() => setNotifyType(t)} activeOpacity={0.75}>
                      <Text style={[nm.typeChipText, active && { color: Colors.success, fontWeight: '800' }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={nm.fieldWrap}>
              <Text style={[nm.label, isRtl && { textAlign: 'right' }]}>
                {language === 'ar' ? 'عنوان الإشعار' : language === 'ckb' ? 'سەردێڕی ئاگادارکردنەوە' : 'Title'}
              </Text>
              <TextInput style={[nm.input, isRtl && { textAlign: 'right' }]} value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} placeholder="..." maxLength={120} />
            </View>

            <View style={nm.fieldWrap}>
              <Text style={[nm.label, isRtl && { textAlign: 'right' }]}>
                {language === 'ar' ? 'نص الإشعار' : language === 'ckb' ? 'دەقی ئاگادارکردنەوە' : 'Message Body'}
              </Text>
              <TextInput style={[nm.textarea, isRtl && { textAlign: 'right' }]} value={body} onChangeText={setBody} placeholderTextColor={Colors.textMuted} placeholder="..." multiline numberOfLines={4} maxLength={400} />
            </View>
          </ScrollView>

          <View style={[nm.footer, isRtl && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={nm.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={nm.cancelText}>{language === 'ar' ? 'إلغاء' : language === 'ckb' ? 'پاشگەزبوونەوە' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[nm.sendBtn, (!title.trim() || saving) && nm.sendBtnDisabled]} onPress={handleSend} disabled={!title.trim() || saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator size="small" color={Colors.background} /> : <Send size={15} color={Colors.background} strokeWidth={2.5} />}
              <Text style={nm.sendText}>{language === 'ar' ? 'إرسال' : language === 'ckb' ? 'بنێرە' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const nm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border, maxHeight: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.success + '20', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  headerSub: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', marginTop: 2, maxWidth: 220 },
  closeBtn: { padding: 6, borderRadius: Radius.sm, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  body: { padding: Spacing.lg },
  fieldWrap: { marginBottom: Spacing.md, gap: 6 },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: FontSize.sm },
  textarea: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: FontSize.sm, minHeight: 90, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  typeChipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  sendBtn: { flex: 2, height: 46, borderRadius: Radius.md, backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  sendBtnDisabled: { opacity: 0.45 },
  sendText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
});

// ─── Calendar Modal ───────────────────────────────────────────────────────────

interface CalendarModalProps {
  visible: boolean;
  language: string;
  cards: OccasionCard[];
  onClose: () => void;
  onCreateCampaign: (occ: Occasion) => void;
  onCreateBanner: (occ: Occasion) => void;
  onSendReminder: (occ: Occasion) => void;
  onMarkDone: (key: string) => void;
}

function CalendarModal({ visible, language, cards, onClose, onCreateCampaign, onCreateBanner, onSendReminder, onMarkDone }: CalendarModalProps) {
  const isRtl = language === 'ar' || language === 'ckb';
  const [selectedCard, setSelectedCard] = useState<OccasionCard | null>(null);

  const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const MONTH_NAMES_CKB = ['کانوونی دووەم','شوبات','ئازار','نیسان','ئایار','حوزەیران','تەمووز','ئاب','ئەیلوول','تشرینی یەکەم','تشرینی دووەم','کانوونی یەکەم'];

  const monthNames = language === 'ar' ? MONTH_NAMES_AR : language === 'ckb' ? MONTH_NAMES_CKB : MONTH_NAMES_EN;

  // Group cards by month
  const byMonth: Record<number, OccasionCard[]> = {};
  cards.forEach(c => {
    const m = c.date.getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(c);
  });

  // Sort months, putting future/current first, past at end
  const now = new Date();
  const currentMonth = now.getMonth();
  const months = Object.keys(byMonth)
    .map(Number)
    .sort((a, b) => {
      const aNorm = a >= currentMonth ? a : a + 12;
      const bNorm = b >= currentMonth ? b : b + 12;
      return aNorm - bNorm;
    });

  const statusColor = (c: OccasionCard) => {
    if (c.reminderState === 'dismissed') return Colors.textMuted;
    if (c.reminderState === 'completed') return Colors.success;
    if (c.daysUntil === 0) return Colors.success;
    if (c.daysUntil > 0 && c.daysUntil <= 7) return Colors.warning;
    if (c.daysUntil > 7) return Colors.neonBlue;
    return Colors.textMuted;
  };

  const countdownLabel = (c: OccasionCard) => {
    if (c.daysUntil === 0) return language === 'ar' ? 'اليوم' : language === 'ckb' ? 'ئەمڕۆ' : 'Today';
    if (c.daysUntil > 0) return language === 'ar' ? `${c.daysUntil} يوم` : language === 'ckb' ? `${c.daysUntil} ڕۆژ` : `${c.daysUntil}d`;
    return language === 'ar' ? 'انتهى' : language === 'ckb' ? 'تەواوبو' : 'Past';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cal.overlay}>
        <View style={cal.sheet}>
          {/* Header */}
          <View style={[cal.header, isRtl && { flexDirection: 'row-reverse' }]}>
            <View style={[cal.headerLeft, isRtl && { flexDirection: 'row-reverse' }]}>
              <View style={cal.headerIcon}>
                <CalendarDays size={20} color={Colors.neonBlue} strokeWidth={2} />
              </View>
              <View>
                <Text style={[cal.headerTitle, isRtl && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'تقويم المناسبات' : language === 'ckb' ? 'ڕۆژمێری ئۆکازیۆنەکان' : 'Occasions Calendar'}
                </Text>
                <Text style={[cal.headerSub, isRtl && { textAlign: 'right' }]}>
                  {cards.length} {language === 'ar' ? 'مناسبة' : language === 'ckb' ? 'ئۆکازیۆن' : 'occasions'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={cal.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Calendar body */}
          <ScrollView style={cal.body} showsVerticalScrollIndicator={false}>
            {months.map(month => (
              <View key={month} style={cal.monthSection}>
                <View style={[cal.monthHeader, isRtl && { flexDirection: 'row-reverse' }]}>
                  <Text style={[cal.monthName, isRtl && { textAlign: 'right' }]}>{monthNames[month]}</Text>
                  <View style={cal.monthDivider} />
                </View>
                {byMonth[month].sort((a, b) => a.date.getDate() - b.date.getDate()).map(c => {
                  const Icon = c.occasion.icon;
                  const name = language === 'ar' ? c.occasion.nameAr : language === 'ckb' ? c.occasion.nameCkb : c.occasion.nameEn;
                  const color = statusColor(c);
                  const isSelected = selectedCard?.occasion.key === c.occasion.key;
                  return (
                    <View key={c.occasion.key}>
                      <TouchableOpacity
                        style={[cal.eventRow, isRtl && { flexDirection: 'row-reverse' }, isSelected && cal.eventRowSelected]}
                        onPress={() => setSelectedCard(isSelected ? null : c)}
                        activeOpacity={0.75}
                      >
                        <View style={[cal.dayCircle, { backgroundColor: c.occasion.color + '22' }]}>
                          <Text style={[cal.dayNum, { color: c.occasion.color }]}>{c.date.getDate()}</Text>
                        </View>
                        <View style={[cal.iconCircle, { backgroundColor: c.occasion.color + '18' }]}>
                          <Icon size={14} color={c.occasion.color} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[cal.eventName, isRtl && { textAlign: 'right' }]} numberOfLines={1}>{name}</Text>
                          <Text style={[cal.eventType, isRtl && { textAlign: 'right' }]} numberOfLines={1}>
                            {language === 'ar' ? c.occasion.campaignTypeAr : language === 'ckb' ? c.occasion.campaignTypeCkb : c.occasion.campaignType}
                          </Text>
                        </View>
                        <View style={[cal.countdownBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                          <Text style={[cal.countdownText, { color }]}>{countdownLabel(c)}</Text>
                        </View>
                        <View style={[cal.chevron, isSelected && cal.chevronOpen]}>
                          <ChevronDown size={14} color={Colors.textMuted} strokeWidth={2} />
                        </View>
                      </TouchableOpacity>

                      {/* Expanded action panel */}
                      {isSelected && (
                        <View style={[cal.actionPanel, isRtl && { flexDirection: 'row-reverse' }]}>
                          <TouchableOpacity style={cal.actionBtn} onPress={() => { onCreateCampaign(c.occasion); onClose(); }} activeOpacity={0.75}>
                            <Zap size={13} color={Colors.neonBlue} strokeWidth={2.5} />
                            <Text style={[cal.actionBtnText, { color: Colors.neonBlue }]}>
                              {language === 'ar' ? 'حملة' : language === 'ckb' ? 'کامپەین' : 'Campaign'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={cal.actionBtn} onPress={() => { onCreateBanner(c.occasion); onClose(); }} activeOpacity={0.75}>
                            <LayoutTemplate size={13} color={Colors.warning} strokeWidth={2.5} />
                            <Text style={[cal.actionBtnText, { color: Colors.warning }]}>
                              {language === 'ar' ? 'بانر' : language === 'ckb' ? 'بانەر' : 'Banner'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={cal.actionBtn} onPress={() => { onSendReminder(c.occasion); onClose(); }} activeOpacity={0.75}>
                            <Bell size={13} color={Colors.neonBlue} strokeWidth={2.5} />
                            <Text style={[cal.actionBtnText, { color: Colors.neonBlue }]}>
                              {language === 'ar' ? 'تذكير' : language === 'ckb' ? 'بیرخستنەوە' : 'Reminder'}
                            </Text>
                          </TouchableOpacity>
                          {c.reminderState !== 'completed' && (
                            <TouchableOpacity style={cal.actionBtn} onPress={() => { onMarkDone(c.occasion.key); setSelectedCard(null); }} activeOpacity={0.75}>
                              <Check size={13} color={Colors.success} strokeWidth={2.5} />
                              <Text style={[cal.actionBtnText, { color: Colors.success }]}>
                                {language === 'ar' ? 'تم' : language === 'ckb' ? 'تەواو' : 'Done'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const cal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neonBlue + '20', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  headerSub: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: Radius.sm, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  body: { padding: Spacing.lg },
  monthSection: { marginBottom: Spacing.lg },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.sm },
  monthName: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 },
  monthDivider: { flex: 1, height: 1, backgroundColor: Colors.border },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, marginBottom: 2 },
  eventRowSelected: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.neonBlue + '33' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  dayNum: { fontSize: FontSize.md, fontWeight: '800' },
  iconCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  eventName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },
  eventType: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 1 },
  countdownBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, flexShrink: 0 },
  countdownText: { fontSize: 10, fontWeight: '800' },
  chevron: { flexShrink: 0 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  actionPanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: Spacing.sm, paddingBottom: 10, paddingTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundSecondary },
  actionBtnText: { fontSize: 11, fontWeight: '700' },
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
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [reminders, setReminders] = useState<CampaignReminder[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionModal, setActionModal] = useState<{ key: string; type: ActionType } | null>(null);
  const [createModalOccasion, setCreateModalOccasion] = useState<Occasion | null>(null);
  const [bannerModalOccasion, setBannerModalOccasion] = useState<Occasion | null>(null);
  const [reminderModalOccasion, setReminderModalOccasion] = useState<Occasion | null>(null);
  const [productsModalCampaign, setProductsModalCampaign] = useState<SavedCampaign | null>(null);
  const [discountModalCampaign, setDiscountModalCampaign] = useState<SavedCampaign | null>(null);
  const [notifyModalCampaign, setNotifyModalCampaign] = useState<SavedCampaign | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarOccasion, setCalendarOccasion] = useState<Occasion | null>(null);
  type OccasionFilter = 'all' | 'active' | 'urgent' | 'upcoming' | 'completed';
  const [occasionFilter, setOccasionFilter] = useState<OccasionFilter>('all');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const db = adminSupabase();
    const [ovRes, acRes, scRes, remRes] = await Promise.all([
      db.from('campaign_occasion_overrides').select('occasion_key,status,snoozed_until'),
      db.from('campaign_actions').select('occasion_key,action_type,created_at').order('created_at', { ascending: false }),
      db.from('saved_campaigns').select('*').not('status', 'eq', 'dismissed').order('created_at', { ascending: false }),
      db.from('campaign_reminders').select('id,occasion_key,title_en,message_en,reminder_type,status,reminder_date,admin_email,created_at').order('created_at', { ascending: false }),
    ]);
    setOverrides(ovRes.data ?? []);
    setActionRecords(acRes.data ?? []);

    // Auto-activate / auto-expire campaigns based on dates
    const campaigns: SavedCampaign[] = scRes.data ?? [];
    const today = new Date().toISOString().split('T')[0];
    const autoActivate = campaigns.filter(c => c.auto_activate && c.status === 'planned' && c.start_date && c.start_date <= today);
    const autoExpire = campaigns.filter(c => c.status === 'active' && c.end_date && c.end_date < today);
    if (autoActivate.length > 0 || autoExpire.length > 0) {
      const dbAuto = adminSupabase();
      await Promise.all([
        ...autoActivate.map(c => dbAuto.from('saved_campaigns').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', c.id)),
        ...autoExpire.map(c => dbAuto.from('saved_campaigns').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', c.id)),
      ]);
      // Reload after auto-update
      const { data: refreshed } = await dbAuto.from('saved_campaigns').select('*').not('status', 'eq', 'dismissed').order('created_at', { ascending: false });
      setSavedCampaigns(refreshed ?? []);
    } else {
      setSavedCampaigns(campaigns);
    }

    setReminders((remRes.data ?? []).map((r: any) => ({
      ...r,
      reminder_type: r.reminder_type ?? 'in_app',
      status: r.status ?? 'scheduled',
    })));
    setLoading(false);
  };

  const handleCampaignStatusChange = async (id: string, status: CampaignStatus) => {
    const db = adminSupabase();
    const { error } = await db.from('saved_campaigns').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      showToast(language === 'ar' ? 'فشل تحديث الحالة' : 'Failed to update status', 'error');
    } else {
      showToast(
        status === 'completed'
          ? (language === 'ar' ? 'تم تحديد الحملة كمكتملة' : language === 'ckb' ? 'کامپەین وەکو تەواوکراو نیشانەکرا' : 'Campaign marked as completed')
          : (language === 'ar' ? 'تم تحديث الحالة' : language === 'ckb' ? 'دۆخ نوێکرایەوە' : 'Status updated')
      );
      await load();
    }
  };

  const handleReminderStatusChange = async (id: string, status: ReminderStatus) => {
    const update: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (status === 'sent') update.sent_at = new Date().toISOString();
    const { error } = await adminSupabase().from('campaign_reminders').update(update).eq('id', id);
    if (error) {
      showToast(language === 'ar' ? 'فشل تحديث التذكير' : 'Failed to update reminder', 'error');
    } else {
      showToast(
        status === 'sent'
          ? (language === 'ar' ? 'تم تحديد التذكير كمُرسل' : language === 'ckb' ? 'بیرخستنەوە وەکو نێردراو نیشانەکرا' : 'Reminder marked as sent')
          : (language === 'ar' ? 'تم رفض التذكير' : language === 'ckb' ? 'بیرخستنەوە ڕەتکرایەوە' : 'Reminder dismissed')
      );
      await load();
    }
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
  const upcomingCards = cards.filter(c => c.daysUntil > 7 && c.reminderState !== 'dismissed');
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
    logAdminAction({ action: 'update', entityType: 'settings', entityLabel: `Campaign dismiss: ${key}`, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
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
    logAdminAction({ action: 'update', entityType: 'settings', entityLabel: `Campaign complete: ${key}`, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
  };

  const handleAction = async (key: string, type: ActionType) => {
    try {
      await adminSupabase().from('campaign_actions').insert({
        occasion_key: key,
        action_type: type,
        admin_email: admin?.email ?? '',
      });
      logAdminAction({ action: 'create', entityType: 'settings', entityLabel: `Campaign action: ${key} / ${type}`, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });

      if (type === 'notification') {
        showToast(language === 'ar' ? 'تم تسجيل التذكير' : language === 'ckb' ? 'بیرخستنەوە تۆمارکرا' : 'Reminder logged');
      } else if (type === 'banner') {
        showToast(language === 'ar' ? 'تم تسجيل إجراء البانر' : language === 'ckb' ? 'کاری بانەر تۆمارکرا' : 'Banner action logged');
        setActionModal({ key, type });
      } else {
        setActionModal({ key, type });
      }
      await load();
    } catch {
      showToast(language === 'ar' ? 'حدث خطأ' : 'An error occurred', 'error');
    }
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
      <CreateCampaignModal
        visible={!!createModalOccasion}
        occasion={createModalOccasion}
        language={language}
        adminEmail={admin?.email ?? ''}
        onClose={() => setCreateModalOccasion(null)}
        onSaved={async (msg) => { showToast(msg, 'success'); await load(); }}
        onError={(msg) => showToast(msg, 'error')}
      />
      <CreateBannerModal
        visible={!!bannerModalOccasion}
        occasion={bannerModalOccasion}
        language={language}
        adminEmail={admin?.email ?? ''}
        onClose={() => setBannerModalOccasion(null)}
        onSaved={async (msg) => { showToast(msg, 'success'); await load(); }}
        onError={(msg) => showToast(msg, 'error')}
      />
      <SendReminderModal
        visible={!!reminderModalOccasion}
        occasion={reminderModalOccasion}
        language={language}
        adminEmail={admin?.email ?? ''}
        onClose={() => setReminderModalOccasion(null)}
        onSaved={async (msg) => { showToast(msg, 'success'); await load(); }}
        onError={(msg) => showToast(msg, 'error')}
      />
      <CampaignProductsModal
        visible={!!productsModalCampaign}
        campaign={productsModalCampaign}
        language={language}
        adminEmail={admin?.email ?? ''}
        onClose={() => setProductsModalCampaign(null)}
        onSaved={async (msg) => { showToast(msg, 'success'); await load(); }}
        onError={(msg) => showToast(msg, 'error')}
      />
      <CampaignDiscountModal
        visible={!!discountModalCampaign}
        campaign={discountModalCampaign}
        language={language}
        adminEmail={admin?.email ?? ''}
        onClose={() => setDiscountModalCampaign(null)}
        onSaved={async (msg) => { showToast(msg, 'success'); await load(); }}
        onError={(msg) => showToast(msg, 'error')}
      />
      <CampaignNotifyModal
        visible={!!notifyModalCampaign}
        campaign={notifyModalCampaign}
        language={language}
        adminEmail={admin?.email ?? ''}
        onClose={() => setNotifyModalCampaign(null)}
        onSaved={async (msg) => { showToast(msg, 'success'); await load(); }}
        onError={(msg) => showToast(msg, 'error')}
      />
      <CalendarModal
        visible={calendarVisible}
        language={language}
        cards={cards}
        onClose={() => setCalendarVisible(false)}
        onCreateCampaign={(occ) => { setCalendarVisible(false); setCreateModalOccasion(occ); }}
        onCreateBanner={(occ) => { setCalendarVisible(false); setBannerModalOccasion(occ); }}
        onSendReminder={(occ) => { setCalendarVisible(false); setReminderModalOccasion(occ); }}
        onMarkDone={(key) => handleComplete(key)}
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
          <TouchableOpacity
            style={main.calBtn}
            onPress={() => setCalendarVisible(true)}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <CalendarDays size={18} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={main.calBtnText}>
              {language === 'ar' ? 'التقويم' : language === 'ckb' ? 'ڕۆژمێر' : 'Calendar'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <CampaignSkeleton />
        ) : (
          <>
            {/* Stats */}
            <StatsWidget cards={cards} />

            {/* Filter tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[main.filterRow, isRtl && { flexDirection: 'row-reverse' }]}
              style={{ marginBottom: Spacing.md }}
            >
              {([
                { key: 'all', en: 'All', ar: 'الكل', ckb: 'هەمووی', color: Colors.textSecondary },
                { key: 'active', en: 'Active', ar: 'نشط', ckb: 'چالاک', color: Colors.success },
                { key: 'urgent', en: 'Urgent', ar: 'عاجل', ckb: 'بەپەلە', color: Colors.warning },
                { key: 'upcoming', en: 'Upcoming', ar: 'قادم', ckb: 'داهاتوو', color: Colors.neonBlue },
                { key: 'completed', en: 'Completed', ar: 'مكتمل', ckb: 'تەواو', color: Colors.textMuted },
              ] as const).map(tab => {
                const active = occasionFilter === tab.key;
                const label = language === 'ar' ? tab.ar : language === 'ckb' ? tab.ckb : tab.en;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      main.filterTab,
                      active && { backgroundColor: tab.color + '20', borderColor: tab.color + '66' },
                    ]}
                    onPress={() => setOccasionFilter(tab.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[main.filterTabText, active && { color: tab.color, fontWeight: '800' }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Saved/Active Campaigns from DB */}
            <ActiveCampaignsSection
              campaigns={savedCampaigns}
              language={language}
              onStatusChange={handleCampaignStatusChange}
              onLinkProducts={setProductsModalCampaign}
              onAddDiscount={setDiscountModalCampaign}
              onNotify={setNotifyModalCampaign}
            />

            {/* Reminders section */}
            <RemindersSection
              reminders={reminders}
              language={language}
              onStatusChange={handleReminderStatusChange}
            />

            {/* Active today */}
            {(occasionFilter === 'all' || occasionFilter === 'active') && activeCards.length > 0 && (
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
                    onCreateCampaign={setCreateModalOccasion}
                    onCreateBanner={setBannerModalOccasion}
                    onSendReminder={setReminderModalOccasion}
                    actionsDone={actionsDone}
                  />
                ))}
              </>
            )}

            {/* Urgent (≤7 days) */}
            {(occasionFilter === 'all' || occasionFilter === 'urgent') && urgentCards.length > 0 && (
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
                    onCreateCampaign={setCreateModalOccasion}
                    onCreateBanner={setBannerModalOccasion}
                    onSendReminder={setReminderModalOccasion}
                    actionsDone={actionsDone}
                  />
                ))}
              </>
            )}

            {/* Upcoming (>7 days) */}
            {(occasionFilter === 'all' || occasionFilter === 'upcoming') && upcomingCards.length > 0 && (
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
                    onCreateCampaign={setCreateModalOccasion}
                    onCreateBanner={setBannerModalOccasion}
                    onSendReminder={setReminderModalOccasion}
                    actionsDone={actionsDone}
                  />
                ))}
              </>
            )}

            {/* Dismissed */}
            {(occasionFilter === 'all' || occasionFilter === 'completed') && dismissedCards.length > 0 && (
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
  calBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlue + '15',
    borderWidth: 1, borderColor: Colors.neonBlue + '44',
    flexShrink: 0,
  },
  calBtnText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2, paddingVertical: 4 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  filterTabText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
});

// ─── Export ───────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  return (
    <AdminGuard permission="manage_campaigns">
      <CampaignsContent />
    </AdminGuard>
  );
}
