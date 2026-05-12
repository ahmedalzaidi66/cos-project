import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { Coins, TrendingUp, Users, Gift, ChevronDown, ChevronUp, Plus, Minus, X, Check, Settings2, Crown, Truck, Star, Zap, Percent, PartyPopper, ShieldAlert } from 'lucide-react-native';
import { adminSupabase, supabase } from '@/lib/supabase';
import { useActionPermission } from '@/hooks/useActionPermission';
import { useAdmin } from '@/context/AdminContext';
import { logAdminAction } from '@/lib/auditLog';
import { useLanguage } from '@/context/LanguageContext';
import AdminGuard from '@/components/admin/AdminGuard';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';
import { TIER_COLORS, getTierFromLifetime, LoyaltyTier, TierBenefits, DEFAULT_TIER_BENEFITS } from '@/lib/loyalty';
import { LoyaltySettingsSkeleton } from '@/components/Skeleton';

type LoyaltyMember = {
  id: string;
  user_id: string;
  total_points: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  tier_override_enabled: boolean;
  override_tier: LoyaltyTier | null;
  updated_at: string;
  email?: string;
};

// Nil UUID used when the fixed admin has no real auth.users row
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

type LoyaltySettings = {
  earning_enabled: boolean;
  redeem_enabled: boolean;
  point_conversion_rate: number;
  points_value: number;
  minimum_order_amount: number;
  min_redeem_points: number;
  max_redeem_percentage: number;
};

function LoyaltyContent() {
  const { t, language } = useLanguage();
  const { isDesktop } = useAdminLayout();
  const { guard: guardAction } = useActionPermission('manage_loyalty');
  const { admin } = useAdmin();
  const DashboardShell = isDesktop ? AdminWebDashboard : AdminMobileDashboard;
  const shellTitle = (t as any).loyaltyAdmin ?? 'Loyalty & Rewards';

  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState<LoyaltySettings>({
    earning_enabled: true,
    redeem_enabled: true,
    point_conversion_rate: 0.001,
    points_value: 1,
    minimum_order_amount: 0,
    min_redeem_points: 100,
    max_redeem_percentage: 50,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Tier benefits
  const [tierBenefits, setTierBenefits] = useState<Record<LoyaltyTier, TierBenefits>>(DEFAULT_TIER_BENEFITS);
  const [tierBenOpen, setTierBenOpen] = useState(false);
  const [tierBenSaving, setTierBenSaving] = useState(false);
  const [tierBenMsg, setTierBenMsg] = useState('');

  // Adjust modal
  const [adjustMember, setAdjustMember] = useState<LoyaltyMember | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustMode, setAdjustMode] = useState<'add' | 'remove'>('add');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState('');
  const [adjustMsgIsError, setAdjustMsgIsError] = useState(false);
  // Tier override within modal
  const [tierOverrideEnabled, setTierOverrideEnabled] = useState(false);
  const [selectedTier, setSelectedTier] = useState<LoyaltyTier>('bronze');
  const [tierOverrideReason, setTierOverrideReason] = useState('');
  const [tierSaving, setTierSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: loyaltyData } = await adminSupabase()
        .from('customer_loyalty')
        .select('id, user_id, total_points, lifetime_points, tier, tier_override_enabled, override_tier, updated_at')
        .order('total_points', { ascending: false });

      const { data: settingsData } = await adminSupabase()
        .from('loyalty_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (settingsData) setSettings(settingsData);

      const { data: tierBenData } = await adminSupabase()
        .from('loyalty_tier_benefits')
        .select('*');

      if (tierBenData && tierBenData.length > 0) {
        const map = { ...DEFAULT_TIER_BENEFITS };
        tierBenData.forEach((row: TierBenefits) => { map[row.tier] = row; });
        setTierBenefits(map);
      }

      if (!loyaltyData) { setLoading(false); return; }

      // Enrich with email from auth users via orders lookup
      const userIds = loyaltyData.map((m: any) => m.user_id);
      const { data: profileData } = await adminSupabase()
        .from('orders')
        .select('user_id, customer_email')
        .in('user_id', userIds);

      const emailMap: Record<string, string> = {};
      (profileData ?? []).forEach((row: any) => {
        if (row.user_id && row.customer_email) emailMap[row.user_id] = row.customer_email;
      });

      setMembers(loyaltyData.map((m: any) => ({
        ...m,
        tier_override_enabled: m.tier_override_enabled ?? false,
        override_tier: m.override_tier ?? null,
        email: emailMap[m.user_id] ?? '—',
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalCirculation = members.reduce((s, m) => s + m.total_points, 0);
  const tierCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.tier] = (acc[m.tier] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = members.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (m.email ?? '').toLowerCase().includes(q) || m.tier.toLowerCase().includes(q);
  });

  const saveSettings = async () => {
    if (!guardAction()) { setSettingsMsg('Permission denied: manage_loyalty required'); setTimeout(() => setSettingsMsg(''), 4000); return; }
    setSettingsSaving(true);
    setSettingsMsg('');
    const payload = {
      id: 1,
      earning_enabled:       settings.earning_enabled,
      redeem_enabled:        settings.redeem_enabled,
      point_conversion_rate: settings.point_conversion_rate,
      points_value:          settings.points_value,
      minimum_order_amount:  settings.minimum_order_amount,
      min_redeem_points:     settings.min_redeem_points,
      max_redeem_percentage: Math.min(100, Math.max(0, settings.max_redeem_percentage)),
      updated_at:            new Date().toISOString(),
    };
    const { error } = await adminSupabase()
      .from('loyalty_settings')
      .upsert(payload, { onConflict: 'id' });
    setSettingsSaving(false);
    if (error) {
      const msg = error.message ?? JSON.stringify(error);
      console.error('[saveSettings] Failed:', msg, error);
      setSettingsMsg(`Save failed: ${msg}`);
    } else {
      setSettingsMsg((t as any).loyaltySettingsSaved ?? 'Settings saved successfully');
      setTimeout(() => setSettingsMsg(''), 3000);
      logAdminAction({ action: 'update', entityType: 'loyalty', entityLabel: 'Loyalty Settings', afterData: payload as any, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
    }
  };

  const saveTierBenefits = async () => {
    if (!guardAction()) { setTierBenMsg('Permission denied: manage_loyalty required'); setTimeout(() => setTierBenMsg(''), 4000); return; }
    setTierBenSaving(true);
    setTierBenMsg('');
    // Build rows — upsert one tier at a time to avoid partial failure masking errors
    const tiers = (['bronze', 'silver', 'gold', 'platinum'] as LoyaltyTier[]);
    let firstError: string | null = null;
    for (const tier of tiers) {
      const b = tierBenefits[tier];
      const row = {
        tier:             b.tier,
        min_points:       b.min_points,
        discount_pct:     b.discount_pct,
        free_shipping:    b.free_shipping,
        bonus_multiplier: b.bonus_multiplier,
        birthday_bonus:   b.birthday_bonus,
        exclusive_offers: b.exclusive_offers,
        early_access:     b.early_access,
        description:      b.description,
        updated_at:       new Date().toISOString(),
      };
      const { error } = await adminSupabase()
        .from('loyalty_tier_benefits')
        .upsert(row, { onConflict: 'tier' });
      if (error && !firstError) {
        firstError = error.message ?? 'Unknown error';
        console.error('[saveTierBenefits]', tier, error);
      }
    }
    setTierBenSaving(false);
    if (firstError) {
      setTierBenMsg(`Save failed: ${firstError}`);
    } else {
      setTierBenMsg('Tier benefits saved successfully');
      setTimeout(() => setTierBenMsg(''), 3000);
    }
  };

  const showAdjustMsg = (msg: string, isError: boolean) => {
    setAdjustMsg(msg);
    setAdjustMsgIsError(isError);
    if (!isError) setTimeout(() => setAdjustMsg(''), 3000);
  };

  const handleAdjust = async () => {
    if (!guardAction()) {
      showAdjustMsg('Permission denied: manage_loyalty required', true);
      return;
    }
    if (!adjustMember) return;

    const pts = parseInt(adjustAmount, 10);
    if (!pts || pts <= 0) {
      showAdjustMsg('Enter a valid point amount greater than 0', true);
      return;
    }
    if (!adjustReason.trim()) {
      showAdjustMsg('A reason is required before saving', true);
      return;
    }

    const delta = adjustMode === 'add' ? pts : -pts;

    // Guard against negative balance on subtract
    if (delta < 0 && Math.abs(delta) > adjustMember.total_points) {
      showAdjustMsg(
        `Cannot subtract ${pts} pts — current balance is only ${adjustMember.total_points} pts`,
        true
      );
      return;
    }

    setAdjusting(true);
    setAdjustMsg('');

    // Use the SECURITY DEFINER RPC — bypasses RLS, works with anon key + admin token
    const adminId = admin?.id && admin.id !== 'admin-fixed' ? admin.id : NIL_UUID;
    const { data, error } = await supabase.rpc('adjust_loyalty_points_admin', {
      p_admin_id: adminId,
      p_user_id:  adjustMember.user_id,
      p_delta:    delta,
      p_reason:   adjustReason.trim(),
    });

    setAdjusting(false);

    if (error || (data as any)?.error) {
      const msg = error?.message ?? (data as any)?.error ?? 'Failed to adjust points';
      console.error('[handleAdjust] RPC error:', msg, error);
      showAdjustMsg(`Failed: ${msg}`, true);
      return;
    }

    const newBalance: number = (data as any)?.new_balance ?? adjustMember.total_points;
    logAdminAction({
      action: 'update',
      entityType: 'loyalty',
      entityId: adjustMember.id,
      entityLabel: adjustMember.email,
      beforeData: { total_points: adjustMember.total_points, tier: adjustMember.tier } as any,
      afterData: { total_points: newBalance, delta, reason: adjustReason.trim() } as any,
      adminUserId: admin?.id ?? '',
      adminEmail: admin?.email ?? '',
      adminName: admin?.name ?? '',
      adminRole: admin?.role ?? '',
    });

    showAdjustMsg(`Done — new balance: ${newBalance.toLocaleString()} pts`, false);
    fetchData();
    setTimeout(() => {
      setAdjustMember(null);
      setAdjustAmount('');
      setAdjustReason('');
      setAdjustMsg('');
    }, 1400);
  };

  const handleTierSave = async () => {
    if (!guardAction()) {
      showAdjustMsg('Permission denied: manage_loyalty required', true);
      return;
    }
    if (!adjustMember) return;
    if (tierOverrideEnabled && !tierOverrideReason.trim()) {
      showAdjustMsg('A reason is required for tier override', true);
      return;
    }

    setTierSaving(true);
    setAdjustMsg('');

    const adminId = admin?.id && admin.id !== 'admin-fixed' ? admin.id : NIL_UUID;
    const { data, error } = await supabase.rpc('admin_set_loyalty_tier', {
      p_admin_id:         adminId,
      p_user_id:          adjustMember.user_id,
      p_tier:             tierOverrideEnabled ? selectedTier : getTierFromLifetime(adjustMember.lifetime_points),
      p_reason:           tierOverrideReason.trim() || null,
      p_override_enabled: tierOverrideEnabled,
    });

    setTierSaving(false);

    if (error || (data as any)?.error) {
      const msg = error?.message ?? (data as any)?.error ?? 'Failed to save tier';
      console.error('[handleTierSave] RPC error:', msg, error);
      showAdjustMsg(`Failed: ${msg}`, true);
      return;
    }

    const finalTier: string = (data as any)?.tier ?? selectedTier;
    logAdminAction({
      action: 'update',
      entityType: 'loyalty',
      entityId: adjustMember.id,
      entityLabel: adjustMember.email,
      beforeData: { tier: adjustMember.tier, tier_override_enabled: adjustMember.tier_override_enabled } as any,
      afterData: { tier: finalTier, tier_override_enabled: tierOverrideEnabled, reason: tierOverrideReason.trim() } as any,
      adminUserId: admin?.id ?? '',
      adminEmail: admin?.email ?? '',
      adminName: admin?.name ?? '',
      adminRole: admin?.role ?? '',
    });

    showAdjustMsg(
      tierOverrideEnabled
        ? `Tier manually set to ${finalTier}`
        : `Tier override removed — auto tier restored`,
      false
    );
    fetchData();
    setTimeout(() => {
      setAdjustMember(null);
      setTierOverrideEnabled(false);
      setTierOverrideReason('');
      setAdjustMsg('');
    }, 1400);
  };

  const content = (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Skeleton while loading */}
      {loading && (
        <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md }}>
          <LoyaltySettingsSkeleton />
        </View>
      )}
      {/* Overview cards */}
      {!loading && <View style={styles.overviewRow}>
        <OverviewCard
          icon={<Users size={20} color={Colors.neonBlue} strokeWidth={1.8} />}
          label={(t as any).loyaltyMembers ?? 'Active Members'}
          value={String(members.length)}
          color={Colors.neonBlue}
        />
        <OverviewCard
          icon={<Coins size={20} color={Colors.gold} strokeWidth={1.8} />}
          label={(t as any).loyaltyCirculation ?? 'Points in Circulation'}
          value={totalCirculation.toLocaleString()}
          color={Colors.gold}
        />
        {(['bronze', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map((tier) => (
          <OverviewCard
            key={tier}
            icon={<Gift size={20} color={TIER_COLORS[tier]} strokeWidth={1.8} />}
            label={(t as any)[`loyaltyTier${tier.charAt(0).toUpperCase() + tier.slice(1)}`] ?? tier}
            value={String(tierCounts[tier] ?? 0)}
            color={TIER_COLORS[tier]}
          />
        ))}
      </View>}

      {!loading && <>
      {/* Settings toggle */}
      <TouchableOpacity
        style={styles.settingsToggle}
        onPress={() => setSettingsOpen(v => !v)}
        activeOpacity={0.8}
      >
        <Settings2 size={16} color={Colors.neonBlue} strokeWidth={2} />
        <Text style={styles.settingsToggleText}>{(t as any).loyaltySettings ?? 'Loyalty Settings'}</Text>
        {settingsOpen
          ? <ChevronUp size={16} color={Colors.textMuted} strokeWidth={2} />
          : <ChevronDown size={16} color={Colors.textMuted} strokeWidth={2} />
        }
      </TouchableOpacity>

      {settingsOpen && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>{(t as any).earningEnabled ?? 'Earning Enabled'}</Text>
            <Switch
              value={settings.earning_enabled}
              onValueChange={(v) => setSettings(s => ({ ...s, earning_enabled: v }))}
              trackColor={{ false: Colors.border, true: Colors.neonBlueDim }}
              thumbColor={settings.earning_enabled ? Colors.neonBlue : Colors.textMuted}
            />
          </View>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>{(t as any).redeemingEnabled ?? 'Redeeming Enabled'}</Text>
            <Switch
              value={settings.redeem_enabled}
              onValueChange={(v) => setSettings(s => ({ ...s, redeem_enabled: v }))}
              trackColor={{ false: Colors.border, true: Colors.neonBlueDim }}
              thumbColor={settings.redeem_enabled ? Colors.neonBlue : Colors.textMuted}
            />
          </View>
          <SettingInput
            label={`${(t as any).earnRate ?? 'Earning Rate'} (pts / IQD)`}
            hint={(t as any).earnRateDesc ?? 'Points earned per 1,000 IQD spent'}
            value={String(settings.point_conversion_rate)}
            onChange={(v) => setSettings(s => ({ ...s, point_conversion_rate: parseFloat(v) || 0 }))}
            keyboardType="decimal-pad"
          />
          <SettingInput
            label={`${(t as any).redeemRate ?? 'Redemption Rate'} (IQD / pt)`}
            hint={(t as any).redeemRateDesc ?? 'IQD value per 1 point'}
            value={String(settings.points_value)}
            onChange={(v) => setSettings(s => ({ ...s, points_value: parseFloat(v) || 0 }))}
            keyboardType="decimal-pad"
          />
          <SettingInput
            label={(t as any).minOrderToEarn ?? 'Min. Order to Earn (IQD)'}
            value={String(settings.minimum_order_amount)}
            onChange={(v) => setSettings(s => ({ ...s, minimum_order_amount: parseInt(v, 10) || 0 }))}
            keyboardType="number-pad"
          />
          <SettingInput
            label={(t as any).minPointsToRedeem ?? 'Min. Points to Redeem'}
            value={String(settings.min_redeem_points)}
            onChange={(v) => setSettings(s => ({ ...s, min_redeem_points: parseInt(v, 10) || 0 }))}
            keyboardType="number-pad"
          />
          <SettingInput
            label={`${(t as any).maxRedeemPercent ?? 'Max Redeem % of Order'} (0-100)`}
            value={String(settings.max_redeem_percentage)}
            onChange={(v) => {
              const n = Math.min(100, Math.max(0, parseInt(v, 10) || 0));
              setSettings(s => ({ ...s, max_redeem_percentage: n }));
            }}
            keyboardType="number-pad"
          />
          {settingsMsg ? (
            <Text style={settingsMsg.toLowerCase().includes('fail') || settingsMsg.toLowerCase().includes('error') ? styles.errorMsg : styles.successMsg}>
              {settingsMsg}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={saveSettings}
            activeOpacity={0.8}
            disabled={settingsSaving}
          >
            {settingsSaving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.saveBtnText}>{(t as any).saveLoyaltySettings ?? 'Save Settings'}</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Tier benefits toggle */}
      <TouchableOpacity
        style={styles.settingsToggle}
        onPress={() => setTierBenOpen(v => !v)}
        activeOpacity={0.8}
      >
        <Crown size={16} color={Colors.gold} strokeWidth={2} />
        <Text style={styles.settingsToggleText}>Tier Benefits</Text>
        {tierBenOpen
          ? <ChevronUp size={16} color={Colors.textMuted} strokeWidth={2} />
          : <ChevronDown size={16} color={Colors.textMuted} strokeWidth={2} />
        }
      </TouchableOpacity>

      {tierBenOpen && (
        <View style={styles.settingsPanel}>
          {(['bronze', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map((tier) => {
            const b = tierBenefits[tier];
            const tierColor = TIER_COLORS[tier];
            return (
              <View key={tier} style={[tierStyles.tierCard, { borderColor: tierColor + '40' }]}>
                {/* Tier header */}
                <View style={[tierStyles.tierHeader, { backgroundColor: tierColor + '12' }]}>
                  <Crown size={15} color={tierColor} strokeWidth={2} />
                  <Text style={[tierStyles.tierName, { color: tierColor }]}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </Text>
                </View>

                <View style={tierStyles.tierBody}>
                  {/* Min points */}
                  <View style={tierStyles.fieldRow}>
                    <Text style={tierStyles.fieldLabel}>Min Lifetime Points</Text>
                    <TextInput
                      style={tierStyles.fieldInput}
                      value={String(b.min_points)}
                      onChangeText={(v) => setTierBenefits(prev => ({ ...prev, [tier]: { ...prev[tier], min_points: parseInt(v, 10) || 0 } }))}
                      keyboardType="number-pad"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  {/* Discount % */}
                  <View style={tierStyles.fieldRow}>
                    <View style={tierStyles.fieldLabelWrap}>
                      <Percent size={12} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={tierStyles.fieldLabel}>Discount %</Text>
                    </View>
                    <TextInput
                      style={tierStyles.fieldInput}
                      value={String(b.discount_pct)}
                      onChangeText={(v) => setTierBenefits(prev => ({ ...prev, [tier]: { ...prev[tier], discount_pct: Math.min(100, parseFloat(v) || 0) } }))}
                      keyboardType="decimal-pad"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  {/* Bonus multiplier */}
                  <View style={tierStyles.fieldRow}>
                    <View style={tierStyles.fieldLabelWrap}>
                      <Zap size={12} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={tierStyles.fieldLabel}>Bonus Multiplier</Text>
                    </View>
                    <TextInput
                      style={tierStyles.fieldInput}
                      value={String(b.bonus_multiplier)}
                      onChangeText={(v) => setTierBenefits(prev => ({ ...prev, [tier]: { ...prev[tier], bonus_multiplier: Math.max(0.1, parseFloat(v) || 1) } }))}
                      keyboardType="decimal-pad"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  {/* Birthday bonus */}
                  <View style={tierStyles.fieldRow}>
                    <View style={tierStyles.fieldLabelWrap}>
                      <PartyPopper size={12} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={tierStyles.fieldLabel}>Birthday Bonus (pts)</Text>
                    </View>
                    <TextInput
                      style={tierStyles.fieldInput}
                      value={String(b.birthday_bonus)}
                      onChangeText={(v) => setTierBenefits(prev => ({ ...prev, [tier]: { ...prev[tier], birthday_bonus: parseInt(v, 10) || 0 } }))}
                      keyboardType="number-pad"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  {/* Toggle: Free Shipping */}
                  <View style={tierStyles.switchRow}>
                    <View style={tierStyles.fieldLabelWrap}>
                      <Truck size={12} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={tierStyles.fieldLabel}>Free Shipping</Text>
                    </View>
                    <Switch
                      value={b.free_shipping}
                      onValueChange={(v) => setTierBenefits(prev => ({ ...prev, [tier]: { ...prev[tier], free_shipping: v } }))}
                      trackColor={{ false: Colors.border, true: Colors.neonBlueDim }}
                      thumbColor={b.free_shipping ? Colors.neonBlue : Colors.textMuted}
                    />
                  </View>

                  {/* Toggle: Exclusive Offers */}
                  <View style={tierStyles.switchRow}>
                    <View style={tierStyles.fieldLabelWrap}>
                      <Star size={12} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={tierStyles.fieldLabel}>Exclusive Offers</Text>
                    </View>
                    <Switch
                      value={b.exclusive_offers}
                      onValueChange={(v) => setTierBenefits(prev => ({ ...prev, [tier]: { ...prev[tier], exclusive_offers: v } }))}
                      trackColor={{ false: Colors.border, true: Colors.neonBlueDim }}
                      thumbColor={b.exclusive_offers ? Colors.neonBlue : Colors.textMuted}
                    />
                  </View>

                  {/* Toggle: Early Access */}
                  <View style={tierStyles.switchRow}>
                    <View style={tierStyles.fieldLabelWrap}>
                      <Zap size={12} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={tierStyles.fieldLabel}>Early Access</Text>
                    </View>
                    <Switch
                      value={b.early_access}
                      onValueChange={(v) => setTierBenefits(prev => ({ ...prev, [tier]: { ...prev[tier], early_access: v } }))}
                      trackColor={{ false: Colors.border, true: Colors.neonBlueDim }}
                      thumbColor={b.early_access ? Colors.neonBlue : Colors.textMuted}
                    />
                  </View>

                  {/* Description */}
                  <View style={{ gap: 4 }}>
                    <Text style={tierStyles.fieldLabel}>Customer Description</Text>
                    <TextInput
                      style={[tierStyles.fieldInput, { minHeight: 56, textAlignVertical: 'top' }]}
                      value={b.description}
                      onChangeText={(v) => setTierBenefits(prev => ({ ...prev, [tier]: { ...prev[tier], description: v } }))}
                      multiline
                      placeholderTextColor={Colors.textMuted}
                      placeholder="Short description shown to customers..."
                    />
                  </View>
                </View>
              </View>
            );
          })}

          {tierBenMsg ? (
            <Text style={tierBenMsg.toLowerCase().includes('fail') || tierBenMsg.toLowerCase().includes('error') ? styles.errorMsg : styles.successMsg}>
              {tierBenMsg}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={saveTierBenefits}
            activeOpacity={0.8}
            disabled={tierBenSaving}
          >
            {tierBenSaving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.saveBtnText}>Save Tier Benefits</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      </>}

      {/* Customer table */}
      <Text style={styles.sectionTitle}>{(t as any).loyaltyCustomerTable ?? 'Customer Balances'}</Text>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder={(t as any).searchCustomers ?? 'Search customers...'}
        placeholderTextColor={Colors.textMuted}
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.neonBlue} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Coins size={36} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyText}>{(t as any).noLoyaltyMembers ?? 'No loyalty members yet'}</Text>
          <Text style={styles.emptySubText}>{(t as any).loyaltyMembersAppear ?? 'Members appear after their first order is delivered'}</Text>
        </View>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, { flex: 2 }]}>{t.email}</Text>
            <Text style={[styles.colHeader, { flex: 1, textAlign: 'right' }]}>{(t as any).colBalance ?? 'Balance'}</Text>
            <Text style={[styles.colHeader, { flex: 1, textAlign: 'right' }]}>{(t as any).colTier ?? 'Tier'}</Text>
            <Text style={[styles.colHeader, { width: 44 }]}>{''}</Text>
          </View>
          {filtered.map((member) => {
            const tierColor = TIER_COLORS[member.tier] ?? Colors.textMuted;
            const tierLabel = (t as any)[`loyaltyTier${member.tier.charAt(0).toUpperCase() + member.tier.slice(1)}`] ?? member.tier;
            return (
              <View key={member.id} style={styles.tableRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
                  <Text style={styles.memberLifetime}>{(member.lifetime_points ?? 0).toLocaleString()} lifetime pts</Text>
                </View>
                <Text style={[styles.memberPoints, { flex: 1, textAlign: 'right' }]}>
                  {member.total_points.toLocaleString()}
                </Text>
                <View style={[styles.tierPill, { flex: 1, alignItems: 'flex-end', flexDirection: 'column', gap: 3 }]}>
                  <View style={[styles.tierPillInner, { backgroundColor: tierColor + '20', borderColor: tierColor + '50' }]}>
                    <Text style={[styles.tierPillText, { color: tierColor }]}>{tierLabel}</Text>
                  </View>
                  {member.tier_override_enabled && (
                    <View style={[styles.tierPillInner, { backgroundColor: 'rgba(255,160,0,0.12)', borderColor: 'rgba(255,160,0,0.4)' }]}>
                      <Text style={[styles.tierPillText, { color: '#FFA000', fontSize: 8 }]}>MANUAL</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.adjustBtn, { width: 32 }]}
                  onPress={() => {
                    setAdjustMember(member);
                    setAdjustMode('add');
                    setAdjustAmount('');
                    setAdjustReason('');
                    setAdjustMsg('');
                    setAdjustMsgIsError(false);
                    setTierOverrideEnabled(member.tier_override_enabled);
                    setSelectedTier((member.override_tier ?? member.tier) as LoyaltyTier);
                    setTierOverrideReason('');
                  }}
                  activeOpacity={0.8}
                >
                  <Coins size={14} color={Colors.gold} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );

  return (
    <DashboardShell title={shellTitle}>
      <View style={styles.container}>
        <View style={styles.pageHeader}>
          <Coins size={20} color={Colors.gold} strokeWidth={2} />
          <Text style={styles.pageTitle}>{(t as any).loyaltyAdmin ?? 'Loyalty & Rewards'}</Text>
        </View>
        {content}
      </View>

      {/* Adjust Modal */}
      <Modal visible={!!adjustMember} transparent animationType="fade" onRequestClose={() => setAdjustMember(null)}>
        <View style={styles.modalOverlay}>
          <ScrollView
            style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}
            contentContainerStyle={styles.modalCard}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{(t as any).adjustPoints ?? 'Adjust Points'}</Text>
              <TouchableOpacity onPress={() => setAdjustMember(null)} style={{ padding: 4 }}>
                <X size={18} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.adjustEmail}>{adjustMember?.email}</Text>
            <Text style={styles.adjustBalance}>
              {(t as any).colBalance ?? 'Balance'}: {(adjustMember?.total_points ?? 0).toLocaleString()} pts
              {adjustMember?.tier_override_enabled && (
                <Text style={{ color: '#FFA000', fontSize: 11 }}> · Manual Tier: {adjustMember.override_tier ?? adjustMember?.tier}</Text>
              )}
            </Text>

            {/* ── Section A: Points Adjustment ── */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>
                <Coins size={13} color={Colors.gold} strokeWidth={2} /> Points Adjustment
              </Text>

              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, adjustMode === 'add' && styles.modeBtnActive]}
                  onPress={() => setAdjustMode('add')}
                  activeOpacity={0.8}
                >
                  <Plus size={14} color={adjustMode === 'add' ? Colors.white : Colors.textMuted} strokeWidth={2.5} />
                  <Text style={[styles.modeBtnText, adjustMode === 'add' && styles.modeBtnTextActive]}>
                    {(t as any).addPoints ?? 'Add Points'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, adjustMode === 'remove' && styles.modeBtnRemove]}
                  onPress={() => setAdjustMode('remove')}
                  activeOpacity={0.8}
                >
                  <Minus size={14} color={adjustMode === 'remove' ? Colors.white : Colors.textMuted} strokeWidth={2.5} />
                  <Text style={[styles.modeBtnText, adjustMode === 'remove' && styles.modeBtnTextActive]}>
                    {(t as any).removePoints ?? 'Subtract Points'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.adjustInput}
                value={adjustAmount}
                onChangeText={(v) => setAdjustAmount(v.replace(/\D/g, ''))}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />
              <View>
                <TextInput
                  style={[styles.adjustInput, styles.adjustNoteInput, !adjustReason.trim() && adjustMsg && adjustMsgIsError ? styles.inputError : undefined]}
                  value={adjustReason}
                  onChangeText={setAdjustReason}
                  placeholder={(t as any).adjustNotePlaceholder ?? 'Reason / Note (required)...'}
                  placeholderTextColor={Colors.textMuted}
                  multiline
                />
                <Text style={styles.fieldRequired}>* Required</Text>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, (adjusting || !adjustAmount) && { opacity: 0.5 }]}
                onPress={handleAdjust}
                activeOpacity={0.8}
                disabled={adjusting || !adjustAmount}
              >
                {adjusting
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.saveBtnText}>{(t as any).save ?? 'Save Points'}</Text>
                }
              </TouchableOpacity>
            </View>

            {/* ── Section B: Tier Override ── */}
            <View style={[styles.modalSection, { borderColor: '#FFA00040' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={13} color="#FFA000" strokeWidth={2} />
                  <Text style={[styles.modalSectionTitle, { color: '#FFA000' }]}>Manual Tier Override</Text>
                </View>
                <Switch
                  value={tierOverrideEnabled}
                  onValueChange={(v) => {
                    setTierOverrideEnabled(v);
                    if (!v) setTierOverrideReason('');
                  }}
                  trackColor={{ false: Colors.border, true: '#FFA00060' }}
                  thumbColor={tierOverrideEnabled ? '#FFA000' : Colors.textMuted}
                />
              </View>

              {!tierOverrideEnabled && (
                <Text style={styles.overrideHint}>
                  Auto: tier calculated from lifetime points
                  {' — '}
                  <Text style={{ color: TIER_COLORS[getTierFromLifetime(adjustMember?.lifetime_points ?? 0)], fontWeight: '700' }}>
                    {getTierFromLifetime(adjustMember?.lifetime_points ?? 0).toUpperCase()}
                  </Text>
                </Text>
              )}

              {tierOverrideEnabled && (
                <>
                  <View style={styles.tierChips}>
                    {(['bronze', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map((tier) => {
                      const tc = TIER_COLORS[tier];
                      const active = selectedTier === tier;
                      return (
                        <TouchableOpacity
                          key={tier}
                          style={[styles.tierChip, active && { backgroundColor: tc + '25', borderColor: tc + '70' }]}
                          onPress={() => setSelectedTier(tier)}
                          activeOpacity={0.8}
                        >
                          <Crown size={11} color={active ? tc : Colors.textMuted} strokeWidth={2} />
                          <Text style={[styles.tierChipText, active && { color: tc }]}>
                            {tier.charAt(0).toUpperCase() + tier.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View>
                    <TextInput
                      style={[styles.adjustInput, styles.adjustNoteInput, !tierOverrideReason.trim() && adjustMsg && adjustMsgIsError ? styles.inputError : undefined]}
                      value={tierOverrideReason}
                      onChangeText={setTierOverrideReason}
                      placeholder="Reason for tier override (required)..."
                      placeholderTextColor={Colors.textMuted}
                      multiline
                    />
                    <Text style={styles.fieldRequired}>* Required</Text>
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#FFA00090' }, tierSaving && { opacity: 0.5 }]}
                onPress={handleTierSave}
                activeOpacity={0.8}
                disabled={tierSaving}
              >
                {tierSaving
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.saveBtnText}>
                      {tierOverrideEnabled ? 'Save Tier Override' : 'Remove Override & Restore Auto Tier'}
                    </Text>
                }
              </TouchableOpacity>
            </View>

            {/* Shared message */}
            {adjustMsg ? (
              <Text style={adjustMsgIsError ? styles.errorMsg : styles.successMsg}>
                {adjustMsg}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </DashboardShell>
  );
}

function OverviewCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <View style={[styles.overviewCard, { borderColor: color + '30' }]}>
      {icon}
      <Text style={[styles.overviewValue, { color }]}>{value}</Text>
      <Text style={styles.overviewLabel}>{label}</Text>
    </View>
  );
}

function SettingInput({
  label, hint, value, onChange, keyboardType,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; keyboardType?: any;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.settingsLabel}>{label}</Text>
      {hint ? <Text style={styles.settingsHint}>{hint}</Text> : null}
      <TextInput
        style={styles.settingInput}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

export default function LoyaltyPage() {
  return (
    <AdminGuard permission="manage_loyalty">
      <LoyaltyContent />
    </AdminGuard>
  );
}

const tierStyles = StyleSheet.create({
  tierCard: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: 2,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  tierName: {
    fontSize: FontSize.md,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tierBody: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
  fieldInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minWidth: 80,
    textAlign: 'right',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  overviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  overviewCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    minWidth: 100,
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  overviewValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  overviewLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  settingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  settingsToggleText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  settingsPanel: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  settingsHint: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '400',
  },
  settingInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  saveBtn: {
    backgroundColor: Colors.neonBlueDim,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  successMsg: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorMsg: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  searchInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
  },
  table: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    gap: Spacing.xs,
  },
  colHeader: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.xs,
  },
  memberEmail: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  memberLifetime: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '400',
    marginTop: 1,
  },
  memberPoints: {
    color: Colors.gold,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  tierPill: {
    flexDirection: 'row',
  },
  tierPillInner: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  adjustBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: Colors.gold + '15',
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  adjustEmail: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  adjustBalance: {
    color: Colors.gold,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  modeBtnActive: {
    backgroundColor: Colors.neonBlueDim,
    borderColor: Colors.neonBlue,
  },
  modeBtnRemove: {
    backgroundColor: 'rgba(255,68,68,0.15)',
    borderColor: Colors.error + '60',
  },
  modeBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  modeBtnTextActive: {
    color: Colors.white,
  },
  adjustInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  adjustNoteInput: {
    fontSize: FontSize.sm,
    fontWeight: '400',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: Colors.error,
  },
  fieldRequired: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'right',
  },
  modalSection: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modalSectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  overrideHint: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  tierChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  tierChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});
