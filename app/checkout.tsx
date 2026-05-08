import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CreditCard, Smartphone, Globe, Banknote, CircleCheck as CheckCircle, ArrowLeft, MapPin, User, Phone, Mail, Truck, CircleAlert as AlertCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import GlossyButton from '@/components/GlossyButton';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

const WHATSAPP_NUMBER = '9647XXXXXXXX';

type ShippingRule = {
  id: string;
  continent: string;
  country: string;
  governorate: string;
  area: string;
  shipping_fee: number;
  free_shipping_minimum: number;
  is_active: boolean;
};

type ShippingState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'free'; fee: 0 }
  | { status: 'paid'; fee: number }
  | { status: 'unavailable' };

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  country: string;
  governorate: string;
  area: string;
  paymentMethod: 'cod' | 'card' | 'paypal' | 'apple';
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const PAYMENT_METHOD_IDS = ['cod', 'card', 'paypal', 'apple'] as const;

// Values that mean "applies to everything at this level"
const WILDCARD_VALUES = new Set(['all', '*', 'الكل']);

function isWild(val: string): boolean {
  return val.trim() === '' || WILDCARD_VALUES.has(val.trim().toLowerCase());
}

function matches(ruleVal: string, inputVal: string): boolean {
  if (isWild(ruleVal)) return true;
  return ruleVal.trim().toLowerCase() === inputVal.trim().toLowerCase();
}

// Match a shipping rule for the given location.
// Priority (most specific wins):
//   1) country + governorate + area  (exact)
//   2) country + governorate + wildcard area
//   3) country + wildcard governorate + wildcard area
//   4) continent + wildcard country + wildcard governorate + wildcard area
//   5) fully global wildcard
function matchRule(
  rules: ShippingRule[],
  country: string,
  governorate: string,
  area: string
): ShippingRule | null {
  const active = rules.filter((r) => r.is_active);

  // Score a rule: higher = more specific
  function score(r: ShippingRule): number {
    // Rule must match all provided fields
    if (!matches(r.country, country))        return -1;
    if (!matches(r.governorate, governorate)) return -1;
    if (!matches(r.area, area))               return -1;

    let s = 0;
    if (!isWild(r.country))        s += 40;
    if (!isWild(r.governorate))    s += 20;
    if (!isWild(r.area))           s += 10;
    // continent bonus — only relevant for continent-level rules
    if (r.continent && !isWild(r.continent)) s += 5;
    return s;
  }

  let best: ShippingRule | null = null;
  let bestScore = -1;

  for (const r of active) {
    const s = score(r);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }

  return best;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const PAYMENT_METHODS = [
    { id: 'cod',    label: 'الدفع عند الاستلام', sublabel: 'الدفع يتم عند استلام الطلب', icon: Banknote },
    { id: 'card',   label: t.creditCard,           sublabel: null,                          icon: CreditCard },
    { id: 'paypal', label: t.paypal,               sublabel: null,                          icon: Globe },
    { id: 'apple',  label: t.applePay,             sublabel: null,                          icon: Smartphone },
  ] as const;

  const [form, setForm] = useState<FormData>({
    firstName:     user?.firstName ?? '',
    lastName:      user?.lastName ?? '',
    email:         user?.email ?? '',
    phone:         '',
    street:        '',
    country:       '',
    governorate:   '',
    area:          '',
    paymentMethod: 'cod',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{
    id: string;
    isCOD: boolean;
    name: string;
    phone: string;
    address: string;
    total: number;
    itemsList: string;
  } | null>(null);

  // Shipping rules loaded once on mount
  const [allRules, setAllRules] = useState<ShippingRule[]>([]);
  const [shippingState, setShippingState] = useState<ShippingState>({ status: 'idle' });

  useEffect(() => {
    supabase
      .from('shipping_rules')
      .select('id, continent, country, governorate, area, shipping_fee, free_shipping_minimum, is_active')
      .eq('is_active', true)
      .then(({ data }) => setAllRules(data ?? []));
  }, []);

  // Re-evaluate shipping whenever location or subtotal changes
  useEffect(() => {
    const c = form.country.trim();
    const g = form.governorate.trim();
    if (!c || !g) { setShippingState({ status: 'idle' }); return; }

    const rule = matchRule(allRules, c, g, form.area);
    if (!rule) { setShippingState({ status: 'unavailable' }); return; }

    const isFree = rule.free_shipping_minimum > 0 && subtotal >= rule.free_shipping_minimum;
    if (isFree) {
      setShippingState({ status: 'free', fee: 0 });
    } else {
      setShippingState({ status: 'paid', fee: rule.shipping_fee });
    }
  }, [form.country, form.governorate, form.area, subtotal, allRules]);

  const shippingFee: number =
    shippingState.status === 'free' ? 0 :
    shippingState.status === 'paid' ? shippingState.fee : 0;

  const total = subtotal + shippingFee;

  const setField = (key: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const phoneRe = /^[+\d\s\-().]{7,20}$/;

    if (!form.firstName.trim() || form.firstName.trim().length > 60) newErrors.firstName  = t.fieldRequired;
    if (!form.lastName.trim()  || form.lastName.trim().length  > 60) newErrors.lastName   = t.fieldRequired;
    if (!emailRe.test(form.email.trim()))                             newErrors.email      = t.validEmailRequired;
    if (!phoneRe.test(form.phone.trim()))                             newErrors.phone      = t.fieldRequired;
    if (!form.street.trim() || form.street.trim().length > 200)      newErrors.street     = t.fieldRequired;
    if (!form.country.trim() || form.country.trim().length > 100)    newErrors.country    = t.fieldRequired;
    if (!form.governorate.trim() || form.governorate.trim().length > 100) newErrors.governorate = t.fieldRequired;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validate()) return;
    if (shippingState.status === 'unavailable') return;
    if (shippingState.status === 'idle' || shippingState.status === 'loading') return;

    setLoading(true);
    try {
      const isCOD = form.paymentMethod === 'cod';
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_email:      form.email.trim().toLowerCase().slice(0, 254),
          customer_first_name: form.firstName.trim().slice(0, 60),
          customer_last_name:  form.lastName.trim().slice(0, 60),
          customer_phone:      form.phone.trim().slice(0, 20),
          street:              form.street.trim().slice(0, 200),
          city:                form.governorate.trim().slice(0, 100),
          state:               form.area.trim().slice(0, 100),
          zip:                 '',
          country:             form.country.trim().slice(0, 100),
          governorate:         form.governorate.trim().slice(0, 100),
          area:                form.area.trim().slice(0, 100),
          payment_method:      PAYMENT_METHOD_IDS.includes(form.paymentMethod as any) ? form.paymentMethod : 'cod',
          payment_status:      'pending',
          subtotal,
          shipping:            shippingFee,
          total,
          status:              'new',
        })
        .select()
        .maybeSingle();

      if (orderError || !order) {
        setErrors({ email: orderError?.message ?? 'Failed to place order. Please try again.' });
        return;
      }

      const orderItems = items.map((i) => ({
        order_id:            order.id,
        product_id:          i.product.id,
        product_name:        i.product.name,
        product_image:       i.shade?.product_image || i.product.image_url,
        quantity:            i.quantity,
        unit_price:          i.product.price,
        shade_name:          i.shade?.name ?? '',
        shade_hex:           i.shade?.color_hex ?? '',
        shade_image:         i.shade?.shade_image ?? '',
        shade_product_image: i.shade?.product_image ?? '',
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) {
        setErrors({ email: 'Failed to save order items. Please try again.' });
        return;
      }

      const shortId = order.id.slice(0, 8).toUpperCase();
      const itemsList = items
        .map((i) => `${i.product.name}${i.shade ? ` (${i.shade.name})` : ''} x${i.quantity}`)
        .join('، ');
      clearCart();
      setOrderSuccess({
        id:       shortId,
        isCOD,
        name:     `${form.firstName.trim()} ${form.lastName.trim()}`,
        phone:    form.phone.trim(),
        address:  `${form.street.trim()}، ${form.governorate.trim()}، ${form.country.trim()}`,
        total,
        itemsList,
      });
    } catch {
      setErrors({ email: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (orderSuccess) {
    return (
      <OrderSuccessScreen
        orderId={orderSuccess.id}
        isCOD={orderSuccess.isCOD}
        name={orderSuccess.name}
        phone={orderSuccess.phone}
        address={orderSuccess.address}
        total={orderSuccess.total}
        itemsList={orderSuccess.itemsList}
        onContinue={() => router.push('/(tabs)')}
      />
    );
  }

  const canPlaceOrder =
    shippingState.status === 'free' || shippingState.status === 'paid';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.6}>
          <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.checkout}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer info */}
        <SectionLabel title={t.shippingInfo} icon={<User size={16} color={Colors.neonBlue} />} />
        <View style={styles.row}>
          <FormField
            label={t.firstName}
            value={form.firstName}
            onChange={(v) => setField('firstName', v)}
            error={errors.firstName}
            style={{ flex: 1 }}
          />
          <FormField
            label={t.lastName}
            value={form.lastName}
            onChange={(v) => setField('lastName', v)}
            error={errors.lastName}
            style={{ flex: 1 }}
          />
        </View>
        <FormField
          label={t.email}
          value={form.email}
          onChange={(v) => setField('email', v)}
          error={errors.email}
          keyboardType="email-address"
          icon={<Mail size={14} color={Colors.textMuted} />}
        />
        <FormField
          label={t.phone}
          value={form.phone}
          onChange={(v) => setField('phone', v)}
          error={errors.phone}
          keyboardType="phone-pad"
          icon={<Phone size={14} color={Colors.textMuted} />}
        />

        {/* Delivery address */}
        <SectionLabel title={t.address} icon={<MapPin size={16} color={Colors.neonBlue} />} />
        <FormField
          label={t.address}
          value={form.street}
          onChange={(v) => setField('street', v)}
          error={errors.street}
        />
        <LocationFields
          allRules={allRules}
          country={form.country}
          governorate={form.governorate}
          area={form.area}
          countryError={errors.country}
          governorateError={errors.governorate}
          onCountryChange={(v) => {
            setField('country', v);
            setField('governorate', '');
            setField('area', '');
          }}
          onGovernorateChange={(v) => setField('governorate', v)}
          onAreaChange={(v) => setField('area', v)}
        />

        {/* Shipping status banner */}
        <ShippingBanner state={shippingState} subtotal={subtotal} language={language} />

        {/* Payment method */}
        <SectionLabel title={t.paymentMethod} icon={<CreditCard size={16} color={Colors.neonBlue} />} />
        <View style={styles.paymentOptions}>
          {PAYMENT_METHODS.map((method) => {
            const active = form.paymentMethod === method.id;
            const Icon = method.icon;
            return (
              <TouchableOpacity
                key={method.id}
                style={[styles.paymentOption, active && styles.paymentOptionActive]}
                onPress={() => setForm((f) => ({ ...f, paymentMethod: method.id as any }))}
                activeOpacity={0.8}
              >
                <Icon size={22} color={active ? Colors.neonBlue : Colors.textMuted} strokeWidth={1.5} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paymentLabel, active && styles.paymentLabelActive]}>
                    {method.label}
                  </Text>
                  {'sublabel' in method && method.sublabel ? (
                    <Text style={[styles.paymentSublabel, active && styles.paymentSublabelActive]}>
                      {method.sublabel}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.paymentRadio, active && styles.paymentRadioActive]}>
                  {active && <View style={styles.paymentRadioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Order summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.summaryTitle}>{t.orderSummary}</Text>
          {items.map((item) => {
            const key = item.shade ? `${item.product.id}::${item.shade.id}` : item.product.id;
            return (
              <View key={key} style={styles.summaryItem}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.summaryItemName} numberOfLines={1}>
                    {item.product.name} x{item.quantity}
                  </Text>
                  {item.shade && (
                    <View style={styles.summaryShadeRow}>
                      <View style={[styles.summaryShadeCircle, { backgroundColor: item.shade.color_hex || '#888' }]} />
                      <Text style={styles.summaryShadeText} numberOfLines={1}>{item.shade.name}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.summaryItemPrice}>
                  {formatPrice(item.product.price * item.quantity, language)}
                </Text>
              </View>
            );
          })}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.subtotal}</Text>
            <Text style={styles.summaryValue}>{formatPrice(subtotal, language)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>رسوم الشحن</Text>
            <Text style={[
              styles.summaryValue,
              shippingState.status === 'free' && { color: Colors.success },
              shippingState.status === 'unavailable' && { color: Colors.error },
            ]}>
              {shippingState.status === 'idle'     ? '—' :
               shippingState.status === 'loading'  ? '...' :
               shippingState.status === 'free'     ? 'الشحن مجاني' :
               shippingState.status === 'unavailable' ? 'الشحن غير متوفر' :
               formatPrice(shippingState.fee, language)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>{t.total}</Text>
            <Text style={styles.totalValue}>{formatPrice(total, language)}</Text>
          </View>
        </View>

        <GlossyButton
          title={shippingState.status === 'unavailable' ? 'الشحن غير متوفر لهذه المنطقة' : t.placeOrder}
          onPress={handlePlaceOrder}
          loading={loading}
          fullWidth
          size="lg"
          style={{ marginTop: Spacing.md, opacity: canPlaceOrder ? 1 : 0.5 }}
        />
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ShippingBanner({ state, subtotal, language }: { state: ShippingState; subtotal: number; language: string }) {
  if (state.status === 'idle') return null;
  if (state.status === 'loading') {
    return (
      <View style={[bannerStyles.wrap, bannerStyles.neutral]}>
        <ActivityIndicator size="small" color={Colors.neonBlue} />
        <Text style={bannerStyles.neutralText}>جاري حساب رسوم الشحن...</Text>
      </View>
    );
  }
  if (state.status === 'unavailable') {
    return (
      <View style={[bannerStyles.wrap, bannerStyles.error]}>
        <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
        <Text style={bannerStyles.errorText}>الشحن غير متوفر لهذه المنطقة</Text>
      </View>
    );
  }
  if (state.status === 'free') {
    return (
      <View style={[bannerStyles.wrap, bannerStyles.success]}>
        <Truck size={16} color={Colors.success} strokeWidth={2} />
        <Text style={bannerStyles.successText}>الشحن مجاني لهذا الطلب</Text>
      </View>
    );
  }
  return (
    <View style={[bannerStyles.wrap, bannerStyles.info]}>
      <Truck size={16} color={Colors.neonBlue} strokeWidth={2} />
      <Text style={bannerStyles.infoText}>
        رسوم الشحن: {formatPrice(state.fee, language)}
      </Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  neutral: { backgroundColor: Colors.backgroundCard, borderColor: Colors.border },
  neutralText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  error: { backgroundColor: Colors.error + '18', borderColor: Colors.error + '40' },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '700' },
  success: { backgroundColor: Colors.success + '18', borderColor: Colors.success + '40' },
  successText: { color: Colors.success, fontSize: FontSize.sm, fontWeight: '700' },
  info: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder },
  infoText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' },
});

function SectionLabel({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      {icon}
      <Text style={styles.sectionLabelText}>{title}</Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChange,
  error,
  keyboardType,
  icon,
  placeholder,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  keyboardType?: any;
  icon?: React.ReactNode;
  placeholder?: string;
  style?: object;
}) {
  return (
    <View style={[styles.fieldWrapper, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldRow, !!error && styles.fieldRowError]}>
        {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

function LocationFields({
  allRules,
  country,
  governorate,
  area,
  countryError,
  governorateError,
  onCountryChange,
  onGovernorateChange,
  onAreaChange,
}: {
  allRules: ShippingRule[];
  country: string;
  governorate: string;
  area: string;
  countryError?: string;
  governorateError?: string;
  onCountryChange: (v: string) => void;
  onGovernorateChange: (v: string) => void;
  onAreaChange: (v: string) => void;
}) {
  // Derive available countries from rules (exclude wildcard-only country entries)
  const availableCountries = React.useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const r of allRules) {
      const c = r.country.trim();
      if (c && !isWild(c) && !seen.has(c)) {
        seen.add(c);
        result.push(c);
      }
    }
    return result;
  }, [allRules]);

  // Derive specific governorates for the selected country (non-wildcard)
  const availableGovernorates = React.useMemo(() => {
    if (!country) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const r of allRules) {
      if (!matches(r.country, country)) continue;
      const g = r.governorate.trim();
      if (g && !isWild(g) && !seen.has(g)) {
        seen.add(g);
        result.push(g);
      }
    }
    return result;
  }, [allRules, country]);

  // Check if any rule for this country covers all governorates (wildcard)
  const countryHasWildcardGov = React.useMemo(() => {
    if (!country) return false;
    return allRules.some((r) => matches(r.country, country) && isWild(r.governorate));
  }, [allRules, country]);

  return (
    <>
      {/* Country selector */}
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>الدولة *</Text>
        {availableCountries.length > 0 ? (
          <View style={locationStyles.pillRow}>
            {availableCountries.map((c) => {
              const active = country === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[locationStyles.pill, active && locationStyles.pillActive]}
                  onPress={() => onCountryChange(c)}
                  activeOpacity={0.75}
                >
                  <Text style={[locationStyles.pillText, active && locationStyles.pillTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={[styles.fieldRow, !!countryError && styles.fieldRowError]}>
            <TextInput
              style={styles.fieldInput}
              value={country}
              onChangeText={onCountryChange}
              placeholder="مثال: العراق"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        )}
        {countryError && <Text style={styles.fieldError}>{countryError}</Text>}
      </View>

      {/* Governorate */}
      {country ? (
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>المحافظة *</Text>
          {availableGovernorates.length > 0 ? (
            <>
              <View style={locationStyles.pillRow}>
                {availableGovernorates.map((g) => {
                  const active = governorate === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[locationStyles.pill, active && locationStyles.pillActive]}
                      onPress={() => onGovernorateChange(g)}
                      activeOpacity={0.75}
                    >
                      <Text style={[locationStyles.pillText, active && locationStyles.pillTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
                {countryHasWildcardGov && (
                  <View style={[styles.fieldRow, !!governorateError && styles.fieldRowError, { flex: 1, minWidth: 120 }]}>
                    <TextInput
                      style={styles.fieldInput}
                      value={governorate}
                      onChangeText={onGovernorateChange}
                      placeholder="أو اكتب محافظتك"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={[styles.fieldRow, !!governorateError && styles.fieldRowError]}>
              <TextInput
                style={styles.fieldInput}
                value={governorate}
                onChangeText={onGovernorateChange}
                placeholder="مثال: بغداد"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          )}
          {governorateError && <Text style={styles.fieldError}>{governorateError}</Text>}
        </View>
      ) : null}

      {/* Area (optional) — only show after governorate is filled */}
      {country && governorate ? (
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>المنطقة / الحي (اختياري)</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={styles.fieldInput}
              value={area}
              onChangeText={onAreaChange}
              placeholder="مثال: الكرادة"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        </View>
      ) : null}
    </>
  );
}

const locationStyles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlue,
  },
  pillText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  pillTextActive: {
    color: Colors.neonBlue,
  },
});

function OrderSuccessScreen({
  orderId, isCOD, name, phone, address, total, itemsList, onContinue,
}: {
  orderId: string; isCOD: boolean; name: string; phone: string;
  address: string; total: number; itemsList: string; onContinue: () => void;
}) {
  const { t, language } = useLanguage();

  const handleWhatsApp = () => {
    const message =
      `طلب جديد:\n` +
      `رقم الطلب: ${orderId}\n` +
      `الاسم: ${name}\n` +
      `الهاتف: ${phone}\n` +
      `العنوان: ${address}\n` +
      `المجموع: ${formatPrice(total, language)}\n` +
      `المنتجات: ${itemsList}`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.successContainer}>
      <CheckCircle size={80} color={Colors.success} strokeWidth={1.5} />
      <Text style={styles.successTitle}>{t.orderPlaced}</Text>
      {isCOD ? (
        <View style={styles.codBanner}>
          <Banknote size={18} color={Colors.success} strokeWidth={2} />
          <Text style={styles.codBannerText}>تم استلام طلبك، سنتواصل معك قريباً</Text>
        </View>
      ) : (
        <Text style={styles.successSubtitle}>{t.orderPlacedSubtitle}</Text>
      )}
      <View style={styles.orderIdBox}>
        <Text style={styles.orderIdLabel}>Order ID</Text>
        <Text style={styles.orderIdValue}>#{orderId}</Text>
      </View>
      <View style={styles.successActions}>
        <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp} activeOpacity={0.8}>
          <Text style={styles.whatsappBtnText}>التواصل عبر واتساب</Text>
        </TouchableOpacity>
        <GlossyButton title={t.continueShopping} onPress={onContinue} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,224,255,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sectionLabelText: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  fieldWrapper: {
    gap: 4,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  fieldRowError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorDim,
  },
  fieldInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    padding: 0,
  },
  fieldError: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  paymentOptions: {
    gap: Spacing.sm,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  paymentOptionActive: {
    borderColor: Colors.neonBlue,
    backgroundColor: Colors.neonBlueGlow,
  },
  paymentLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  paymentLabelActive: {
    color: Colors.neonBlue,
  },
  paymentSublabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '400',
    marginTop: 2,
    textAlign: 'right',
  },
  paymentSublabelActive: {
    color: Colors.neonBlue,
    opacity: 0.8,
  },
  paymentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentRadioActive: {
    borderColor: Colors.neonBlue,
  },
  paymentRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.neonBlue,
  },
  orderSummary: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  summaryTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryItemName: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  summaryItemPrice: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  summaryShadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  summaryShadeCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  summaryShadeText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  summaryValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 4,
  },
  totalLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  totalValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  successContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  successTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl + 4,
    fontWeight: '900',
    textAlign: 'center',
  },
  successSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  orderIdBox: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  successActions: {
    width: '80%',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    borderRadius: Radius.full,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  codBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.success + '18',
    borderWidth: 1,
    borderColor: Colors.success + '40',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  codBannerText: {
    color: Colors.success,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  orderIdLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  orderIdValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.xxl,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
