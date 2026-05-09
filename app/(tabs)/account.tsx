import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { User, Mail, Lock, LogOut, Package, Eye, EyeOff, Heart, ChevronRight, CircleCheck as CheckCircle, Globe, CreditCard, MapPin, KeyRound, Pencil, X, Bell, RefreshCw, Instagram, Facebook, MessageCircle, Phone, Store, SmartphoneNfc, CalendarDays, Cake } from 'lucide-react-native';
import { Music2 } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useRouter } from 'expo-router';
import { supabase, Order } from '@/lib/supabase';
import { useNotifications } from '@/context/NotificationContext';
import { useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import AppHeader from '@/components/AppHeader';
import GlossyButton from '@/components/GlossyButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

export default function AccountScreen() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <AuthView />;
  return <ProfileView />;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

type AuthTab = 'login' | 'register' | 'phone';

function AuthView() {
  const [tab, setTab] = useState<AuthTab>('login');
  const { t } = useLanguage();

  const headerIcon = tab === 'phone'
    ? <SmartphoneNfc size={34} color={Colors.neonBlue} strokeWidth={1.5} />
    : <User size={34} color={Colors.neonBlue} strokeWidth={1.5} />;

  const headerTitle = tab === 'login' ? t.welcomeBack
    : tab === 'register' ? t.createAccount
    : 'Phone Login';

  const headerSubtitle = tab === 'login' ? t.signInSubtitle
    : tab === 'register' ? t.registerSubtitle
    : 'Enter your phone number to receive a verification code';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.account} />
      <ScrollView
        contentContainerStyle={styles.authContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authHeader}>
          {headerIcon}
          <Text style={styles.authTitle}>{headerTitle}</Text>
          <Text style={styles.authSubtitle}>{headerSubtitle}</Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.authTab, tab === 'login' && styles.authTabActive]}
            onPress={() => setTab('login')}
          >
            <Text style={[styles.authTabText, tab === 'login' && styles.authTabTextActive]}>
              {t.login}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authTab, tab === 'register' && styles.authTabActive]}
            onPress={() => setTab('register')}
          >
            <Text style={[styles.authTabText, tab === 'register' && styles.authTabTextActive]}>
              {t.register}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authTab, tab === 'phone' && styles.authTabActive]}
            onPress={() => setTab('phone')}
          >
            <SmartphoneNfc size={11} color={tab === 'phone' ? Colors.white : Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.authTabText, tab === 'phone' && styles.authTabTextActive]}>
              Phone
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'login' ? <LoginForm /> :
         tab === 'register' ? <RegisterForm onSuccess={() => setTab('login')} /> :
         <PhoneLoginForm />}
        <AccountFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LoginForm() {
  const { login, resendVerificationEmail } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !email.includes('@')) { setError(t.invalidEmail); return; }
    if (!password.trim()) { setError(t.passwordRequired); return; }
    setLoading(true);
    setError('');
    setUnverified(false);
    setResendSuccess('');
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      const msg = result.error ?? t.invalidCredentials;
      const isUnverifiedErr = msg.toLowerCase().includes('email not confirmed') ||
        msg.toLowerCase().includes('not confirmed');
      if (isUnverifiedErr) { setUnverified(true); setError(t.emailNotVerified); }
      else setError(msg);
    }
  };

  const handleResend = async () => {
    if (!email.trim() || !email.includes('@')) { setError(t.invalidEmail); return; }
    setResending(true);
    setResendSuccess('');
    const result = await resendVerificationEmail(email);
    setResending(false);
    if (result.success) { setResendSuccess(t.verificationEmailResent); setError(''); }
    else setError(result.error ?? t.tryAgain);
  };

  return (
    <View style={styles.form}>
      {resendSuccess ? <SuccessBanner message={resendSuccess} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {unverified && !resendSuccess ? (
        <GlossyButton
          title={resending ? t.resendingEmail : t.resendVerificationEmail}
          onPress={handleResend}
          loading={resending}
          fullWidth
          size="xs"
          variant="outline"
        />
      ) : null}
      <AuthField
        label={t.email}
        value={email}
        onChange={setEmail}
        icon={<Mail size={13} color={Colors.textMuted} />}
        keyboardType="email-address"
        placeholder={t.emailPlaceholder}
      />
      <AuthField
        label={t.password}
        value={password}
        onChange={setPassword}
        icon={<Lock size={13} color={Colors.textMuted} />}
        secureTextEntry={!showPw}
        placeholder="••••••••"
        right={
          <TouchableOpacity onPress={() => setShowPw(p => !p)}>
            {showPw ? <EyeOff size={13} color={Colors.textMuted} /> : <Eye size={13} color={Colors.textMuted} />}
          </TouchableOpacity>
        }
      />
      <GlossyButton
        title={t.signIn}
        onPress={handleLogin}
        loading={loading}
        fullWidth
        size="xs"
        style={{ marginTop: 4 }}
      />
    </View>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, resendVerificationEmail } = useAuth();
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifyPending, setVerifyPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  const handleRegister = async () => {
    if (!firstName.trim()) { setError(t.firstNameRequired); return; }
    if (!lastName.trim()) { setError(t.lastNameRequired); return; }
    if (!email.trim() || !email.includes('@')) { setError(t.validEmailRequired); return; }
    if (password.length < 6) { setError(t.passwordMinLength); return; }
    if (password !== confirm) { setError(t.passwordsNoMatch); return; }
    setLoading(true);
    setError('');
    const result = await register(firstName, lastName, email, password);
    setLoading(false);
    if (!result.success) { setError(result.error ?? t.validEmailRequired); return; }
    if (result.needsVerification) { setVerifyPending(true); return; }
    onSuccess();
  };

  const handleResend = async () => {
    setResending(true);
    setResendSuccess('');
    const result = await resendVerificationEmail(email);
    setResending(false);
    if (result.success) setResendSuccess(t.verificationEmailResent);
    else setError(result.error ?? t.tryAgain);
  };

  if (verifyPending) {
    return (
      <View style={styles.form}>
        <SuccessBanner message={resendSuccess || t.emailVerificationSent} />
        <GlossyButton
          title={resending ? t.resendingEmail : t.resendVerificationEmail}
          onPress={handleResend}
          loading={resending}
          fullWidth
          size="xs"
          variant="outline"
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.nameRow}>
        <View style={{ flex: 1 }}>
          <AuthField label={t.firstName} value={firstName} onChange={setFirstName} placeholder="John" />
        </View>
        <View style={{ flex: 1 }}>
          <AuthField label={t.lastName} value={lastName} onChange={setLastName} placeholder="Doe" />
        </View>
      </View>
      <AuthField
        label={t.email}
        value={email}
        onChange={setEmail}
        icon={<Mail size={13} color={Colors.textMuted} />}
        keyboardType="email-address"
        placeholder={t.emailPlaceholder}
      />
      <AuthField
        label={t.password}
        value={password}
        onChange={setPassword}
        icon={<Lock size={13} color={Colors.textMuted} />}
        secureTextEntry={!showPw}
        placeholder={t.passwordPlaceholder}
        right={
          <TouchableOpacity onPress={() => setShowPw(p => !p)}>
            {showPw ? <EyeOff size={13} color={Colors.textMuted} /> : <Eye size={13} color={Colors.textMuted} />}
          </TouchableOpacity>
        }
      />
      <AuthField
        label={t.confirmPassword}
        value={confirm}
        onChange={setConfirm}
        icon={<Lock size={13} color={Colors.textMuted} />}
        secureTextEntry={!showPw}
        placeholder={t.confirmPassword}
      />
      <GlossyButton
        title={t.createAccount}
        onPress={handleRegister}
        loading={loading}
        fullWidth
        size="xs"
        style={{ marginTop: 4 }}
      />
    </View>
  );
}

// ─── Phone Login Form ─────────────────────────────────────────────────────────

function PhoneLoginForm() {
  const { requestOtp, verifyOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'enter_phone' | 'enter_code'>('enter_phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleRequestOtp = async () => {
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    setLoading(true);
    setError('');
    const result = await requestOtp(phone.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to send code');
      if (result.cooldownSeconds) setCooldown(result.cooldownSeconds);
    } else {
      setStep('enter_code');
      setCooldown(60);
    }
  };

  const handleVerifyOtp = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    setError('');
    const result = await verifyOtp(phone.trim(), code.trim());
    setLoading(false);
    if (!result.success) {
      setError(
        result.attemptsLeft !== undefined
          ? `${result.error ?? 'Invalid code'} (${result.attemptsLeft} attempts left)`
          : (result.error ?? 'Verification failed')
      );
    }
    // On success AuthContext sets session → AccountScreen re-renders to ProfileView automatically
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setCode('');
    setError('');
    setLoading(true);
    const result = await requestOtp(phone.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to resend code');
      if (result.cooldownSeconds) setCooldown(result.cooldownSeconds);
    } else {
      setCooldown(60);
    }
  };

  if (step === 'enter_phone') {
    return (
      <View style={styles.form}>
        {error ? <ErrorBanner message={error} /> : null}
        <AuthField
          label="Phone Number"
          value={phone}
          onChange={setPhone}
          icon={<Phone size={13} color={Colors.textMuted} />}
          keyboardType="phone-pad"
          placeholder="+964 770 000 0000"
        />
        <GlossyButton
          title={loading ? 'Sending...' : 'Send Code'}
          onPress={handleRequestOtp}
          loading={loading}
          fullWidth
          size="xs"
          style={{ marginTop: 4 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.phoneHint}>
        <SmartphoneNfc size={13} color={Colors.textSecondary} strokeWidth={2} />
        <Text style={styles.phoneHintText}>Code sent to {phone}</Text>
      </View>
      <AuthField
        label="Verification Code"
        value={code}
        onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
        icon={<Lock size={13} color={Colors.textMuted} />}
        keyboardType="number-pad"
        placeholder="6-digit code"
      />
      <GlossyButton
        title={loading ? 'Verifying...' : 'Verify Code'}
        onPress={handleVerifyOtp}
        loading={loading}
        fullWidth
        size="xs"
        style={{ marginTop: 4 }}
      />
      <TouchableOpacity
        onPress={handleResend}
        disabled={cooldown > 0}
        style={styles.resendRow}
        activeOpacity={0.7}
      >
        <Text style={[styles.resendText, cooldown > 0 && styles.resendTextDim]}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { setStep('enter_phone'); setCode(''); setError(''); }}
        style={styles.resendRow}
        activeOpacity={0.7}
      >
        <Text style={styles.resendText}>Change number</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

const ORDER_STATUS_COLORS: Record<string, string> = {
  new:       Colors.neonBlue,
  confirmed: Colors.success,
  preparing: Colors.warning,
  shipped:   '#7C83FF',
  delivered: Colors.success,
  cancelled: Colors.error,
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  new:       'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  shipped:   'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function ProfileView() {
  const { user, logout, refreshUser } = useAuth();
  const { t, language } = useLanguage();
  const { count: wishlistCount } = useWishlist();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const ordersChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isPhoneUser = user?.isPhoneUser ?? false;
  const profileIncomplete = isPhoneUser && (!user?.firstName || !user?.lastName);

  const fetchOrders = React.useCallback(async (email: string) => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, customer_email, customer_first_name, customer_last_name, customer_phone, street, city, state, zip, country, payment_method, subtotal, shipping, total, status, created_at, updated_at')
        .eq('customer_email', email)
        .order('created_at', { ascending: false });
      if (!error && data) setOrders(data);
    } catch (err: any) {
      console.error('[Account] orders fetch error:', err?.message ?? err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.email) { setLoadingOrders(false); return; }

    fetchOrders(user.email);

    // Realtime: listen for status updates on this customer's orders
    const channel = supabase
      .channel(`customer_orders:${user.email}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `customer_email=eq.${user.email}`,
        },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status, updated_at: updated.updated_at } : o))
          );
        }
      )
      .subscribe();

    ordersChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
      ordersChannelRef.current = null;
    };
  }, [user?.email, fetchOrders]);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'ME';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <View style={styles.container}>
      <AppHeader title={t.account} />
      <ScrollView contentContainerStyle={styles.profileContent} showsVerticalScrollIndicator={false}>

        {/* ── Avatar card ── */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => setEditModalOpen(true)}
              activeOpacity={0.8}
            >
              <Pencil size={11} color={Colors.white} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>
              {(user?.firstName || user?.lastName)
                ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
                : isPhoneUser ? 'Phone User' : ''}
            </Text>

            <View style={styles.heroBadgeRow}>
              {isPhoneUser ? (
                <View style={styles.verifiedBadge}>
                  <SmartphoneNfc size={11} color={Colors.success} strokeWidth={2.5} />
                  <Text style={styles.verifiedText}>Phone Verified</Text>
                </View>
              ) : user?.emailVerified ? (
                <View style={styles.verifiedBadge}>
                  <CheckCircle size={11} color={Colors.success} strokeWidth={2.5} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : (
                <View style={styles.unverifiedBadge}>
                  <Text style={styles.unverifiedText}>Unverified</Text>
                </View>
              )}
              {memberSince ? (
                <Text style={styles.memberSince}>Member since {memberSince}</Text>
              ) : null}
            </View>

            <Text style={styles.heroEmail}>
              {isPhoneUser
                ? (user?.phone ? user.phone : (user?.profileEmail || ''))
                : user?.email}
            </Text>
          </View>

          <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.8}>
            <LogOut size={16} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── Profile completion nudge (phone users only) ── */}
        {profileIncomplete && (
          <TouchableOpacity
            style={styles.completionCard}
            activeOpacity={0.85}
            onPress={() => setEditModalOpen(true)}
          >
            <View style={styles.completionLeft}>
              <Pencil size={14} color={Colors.neonBlue} strokeWidth={2} />
              <View>
                <Text style={styles.completionTitle}>Complete your profile</Text>
                <Text style={styles.completionSub}>Add your name, email and birthday</Text>
              </View>
            </View>
            <ChevronRight size={15} color={Colors.neonBlue} strokeWidth={2} />
          </TouchableOpacity>
        )}

        {/* ── Quick actions row ── */}
        <View style={styles.quickRow}>
          <QuickTile
            icon={<Package size={18} color={Colors.neonBlue} strokeWidth={1.8} />}
            label={t.orders}
            badge={orders.length > 0 ? String(orders.length) : undefined}
            onPress={() => setOrdersExpanded(v => !v)}
          />
          <QuickTile
            icon={<Heart size={18} color="#FF4D6D" strokeWidth={1.8} />}
            label={t.myWishlist ?? 'Wishlist'}
            badge={wishlistCount > 0 ? String(wishlistCount) : undefined}
            onPress={() => router.push('/(tabs)/wishlist' as any)}
          />
          <QuickTile
            icon={<Bell size={18} color={Colors.warning} strokeWidth={1.8} />}
            label="Alerts"
            badge={unreadCount > 0 ? String(unreadCount) : undefined}
            onPress={() => router.push('/(tabs)/notifications' as any)}
          />
          <QuickTile
            icon={<CreditCard size={18} color={Colors.gold} strokeWidth={1.8} />}
            label="Payment"
            onPress={() => {}}
          />
        </View>

        {/* ── Orders (expandable) ── */}
        {ordersExpanded && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t.orderHistory}</Text>
              <TouchableOpacity
                onPress={() => user?.email && fetchOrders(user.email)}
                style={styles.refreshBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <RefreshCw size={13} color={Colors.neonBlue} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            {loadingOrders ? (
              <Text style={styles.dimText}>{t.loadingOrders}</Text>
            ) : orders.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Package size={32} color={Colors.textMuted} strokeWidth={1.5} />
                <Text style={styles.dimText}>{t.noOrdersYet}</Text>
              </View>
            ) : (
              <View style={styles.ordersList}>
                {orders.map(order => <OrderCard key={order.id} order={order} />)}
              </View>
            )}
          </View>
        )}

        {/* ── Settings list ── */}
        <View style={styles.menuCard}>
          <MenuRow
            icon={<Globe size={16} color={Colors.neonBlue} strokeWidth={2} />}
            label={t.language}
            right={<LanguageSwitcher />}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<KeyRound size={16} color={Colors.textSecondary} strokeWidth={2} />}
            label="Change Password"
            onPress={() => setPwModalOpen(true)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<LogOut size={16} color={Colors.error} strokeWidth={2} />}
            label="Sign Out"
            labelColor={Colors.error}
            onPress={logout}
          />
        </View>

        <AccountFooter />
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <EditProfileModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); refreshUser(); }}
        currentFirst={user?.firstName ?? ''}
        currentLast={user?.lastName ?? ''}
        currentProfileEmail={user?.profileEmail ?? ''}
        currentDob={user?.dateOfBirth ?? ''}
        userId={user?.id ?? ''}
        isPhoneUser={isPhoneUser}
      />

      {/* ── Change Password Modal ── */}
      <ChangePasswordModal
        open={pwModalOpen}
        onClose={() => setPwModalOpen(false)}
      />
    </View>
  );
}

// ─── Quick tile ───────────────────────────────────────────────────────────────

function QuickTile({
  icon, label, badge, onPress,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickTile} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.quickTileIcon}>{icon}</View>
      {badge ? (
        <View style={styles.quickTileBadge}>
          <Text style={styles.quickTileBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.quickTileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Menu row ─────────────────────────────────────────────────────────────────

function MenuRow({
  icon, label, labelColor, right, onPress,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const inner = (
    <View style={styles.menuRow}>
      <View style={styles.menuRowLeft}>
        {icon}
        <Text style={[styles.menuRowLabel, labelColor ? { color: labelColor } : undefined]}>
          {label}
        </Text>
      </View>
      {right ?? <ChevronRight size={15} color={Colors.textMuted} strokeWidth={2} />}
    </View>
  );
  if (!onPress) return inner;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      {inner}
    </TouchableOpacity>
  );
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: Order }) {
  const { language } = useLanguage();
  const date = new Date(order.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const sc = ORDER_STATUS_COLORS[order.status] ?? Colors.textMuted;
  const sl = ORDER_STATUS_LABELS[order.status] ?? (order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : '—');

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTopRow}>
        <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
        <View style={[styles.statusBadge, { borderColor: sc, backgroundColor: sc + '18' }]}>
          <Text style={[styles.statusText, { color: sc }]}>{sl}</Text>
        </View>
      </View>
      <View style={styles.orderBottom}>
        <Text style={styles.orderDate}>{date}</Text>
        <Text style={styles.orderTotal}>{formatPrice(order.total, language)}</Text>
      </View>
    </View>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  open, onClose, currentFirst, currentLast, currentProfileEmail, currentDob, userId, isPhoneUser,
}: {
  open: boolean;
  onClose: () => void;
  currentFirst: string;
  currentLast: string;
  currentProfileEmail: string;
  currentDob: string;
  userId: string;
  isPhoneUser: boolean;
}) {
  const [firstName, setFirstName] = useState(currentFirst);
  const [lastName, setLastName] = useState(currentLast);
  const [profileEmail, setProfileEmail] = useState(currentProfileEmail);
  const [dob, setDob] = useState(currentDob);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open) {
      setFirstName(currentFirst);
      setLastName(currentLast);
      setProfileEmail(currentProfileEmail);
      setDob(currentDob);
      setError('');
      setSuccess('');
    }
  }, [open, currentFirst, currentLast, currentProfileEmail, currentDob]);

  // Validate date format YYYY-MM-DD or DD/MM/YYYY
  function normaliseDob(raw: string): string {
    const clean = raw.trim();
    if (!clean) return '';
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    // DD/MM/YYYY or DD-MM-YYYY
    const m = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return clean;
  }

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (profileEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    const normDob = normaliseDob(dob);
    if (normDob && !/^\d{4}-\d{2}-\d{2}$/.test(normDob)) {
      setError('Date of birth format: DD/MM/YYYY');
      return;
    }
    setSaving(true);
    setError('');

    // Always update auth user_metadata for name (works for both user types)
    const { error: authErr } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    });
    if (authErr) { setSaving(false); setError(authErr.message); return; }

    // Upsert customer_profiles with all fields
    if (userId) {
      const upsertData: Record<string, any> = {
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        updated_at: new Date().toISOString(),
      };
      if (profileEmail.trim()) upsertData.email = profileEmail.trim().toLowerCase();
      if (normDob) upsertData.date_of_birth = normDob;

      const { error: cpErr } = await supabase
        .from('customer_profiles')
        .upsert(upsertData, { onConflict: 'id' });
      if (cpErr) { setSaving(false); setError(cpErr.message); return; }
    }

    setSaving(false);
    setSuccess('Profile updated.');
    setTimeout(onClose, 800);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          {success ? <SuccessBanner message={success} /> : null}

          <AuthField
            label="First Name"
            value={firstName}
            onChange={setFirstName}
            placeholder="First name"
          />
          <AuthField
            label="Last Name"
            value={lastName}
            onChange={setLastName}
            placeholder="Last name"
          />

          {/* Email — optional for phone users, shown for all */}
          <AuthField
            label={isPhoneUser ? 'Email (optional)' : 'Email'}
            value={profileEmail}
            onChange={setProfileEmail}
            icon={<Mail size={13} color={Colors.textMuted} />}
            keyboardType="email-address"
            placeholder="your@email.com"
          />

          {/* Date of Birth */}
          <View style={styles.fieldWrapper}>
            <AuthField
              label="Date of Birth"
              value={dob}
              onChange={v => setDob(v)}
              icon={<CalendarDays size={13} color={Colors.textMuted} />}
              placeholder="DD/MM/YYYY"
            />
            <View style={styles.dobHintRow}>
              <Cake size={11} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={styles.dobHintText}>
                ادخل تاريخ ميلادك للحصول على عروض تاريخ الميلاد
              </Text>
            </View>
          </View>

          <GlossyButton
            title={saving ? 'Saving...' : 'Save Changes'}
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="xs"
            style={{ marginTop: 6 }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open) { setNewPw(''); setConfirmPw(''); setError(''); setSuccess(''); }
  }, [open]);

  const handleSave = async () => {
    if (newPw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (err) setError(err.message);
    else { setSuccess('Password updated successfully.'); setTimeout(onClose, 900); }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          {success ? <SuccessBanner message={success} /> : null}
          <AuthField
            label="New Password"
            value={newPw}
            onChange={setNewPw}
            icon={<Lock size={13} color={Colors.textMuted} />}
            secureTextEntry={!showPw}
            placeholder="Min 6 characters"
            right={
              <TouchableOpacity onPress={() => setShowPw(p => !p)}>
                {showPw ? <EyeOff size={13} color={Colors.textMuted} /> : <Eye size={13} color={Colors.textMuted} />}
              </TouchableOpacity>
            }
          />
          <AuthField
            label="Confirm Password"
            value={confirmPw}
            onChange={setConfirmPw}
            icon={<Lock size={13} color={Colors.textMuted} />}
            secureTextEntry={!showPw}
            placeholder="Repeat password"
          />
          <GlossyButton
            title={saving ? 'Saving...' : 'Update Password'}
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="xs"
            style={{ marginTop: 6 }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Account Footer ───────────────────────────────────────────────────────────

type ContactSettings = {
  phone: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
};

function AccountFooter() {
  const router = useRouter();
  const [contact, setContact] = useState<ContactSettings>({
    phone: '', whatsapp: '', instagram: '', facebook: '', tiktok: '',
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['contact_phone', 'social_whatsapp', 'social_instagram', 'social_facebook', 'social_tiktok']);
      if (!data) return;
      const map: Record<string, string> = {};
      data.forEach((row: { key: string; value: string }) => { map[row.key] = row.value; });
      setContact({
        phone:     map['contact_phone']    ?? '',
        whatsapp:  map['social_whatsapp']  ?? '',
        instagram: map['social_instagram'] ?? '',
        facebook:  map['social_facebook']  ?? '',
        tiktok:    map['social_tiktok']    ?? '',
      });
    })();
  }, []);

  function openUrl(url: string) {
    if (!url) return;
    const full = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(full).catch(() => {});
  }

  function openWhatsApp() {
    const num = (contact.whatsapp || contact.phone).replace(/\D/g, '');
    if (!num) return;
    Linking.openURL(`https://wa.me/${num}`).catch(() => {});
  }

  function callPhone() {
    if (!contact.phone) return;
    Linking.openURL(`tel:${contact.phone}`).catch(() => {});
  }

  const hasSocials = contact.instagram || contact.facebook || contact.tiktok;
  const hasPhone   = !!(contact.phone || contact.whatsapp);

  return (
    <View style={footerStyles.root}>
      {/* divider */}
      <View style={footerStyles.divider} />

      {/* ── Quick links row ── */}
      <View style={footerStyles.quickRow}>
        <TouchableOpacity
          style={footerStyles.quickBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/about' as any)}
        >
          <Store size={15} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={footerStyles.quickBtnText}>Stores</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={footerStyles.quickBtn}
          activeOpacity={0.8}
          onPress={openWhatsApp}
        >
          <MessageCircle size={15} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={footerStyles.quickBtnText}>Contact Us</Text>
        </TouchableOpacity>
      </View>

      {/* ── Social icons ── */}
      {hasSocials ? (
        <View style={footerStyles.socialSection}>
          <Text style={footerStyles.sectionLabel}>FOLLOW US</Text>
          <View style={footerStyles.socialRow}>
            {contact.instagram ? (
              <TouchableOpacity
                style={footerStyles.socialBtn}
                activeOpacity={0.8}
                onPress={() => openUrl(contact.instagram)}
              >
                <Instagram size={18} color={Colors.neonBlue} strokeWidth={1.8} />
              </TouchableOpacity>
            ) : null}
            {contact.tiktok ? (
              <TouchableOpacity
                style={footerStyles.socialBtn}
                activeOpacity={0.8}
                onPress={() => openUrl(contact.tiktok)}
              >
                <Music2 size={18} color={Colors.neonBlue} strokeWidth={1.8} />
              </TouchableOpacity>
            ) : null}
            {contact.facebook ? (
              <TouchableOpacity
                style={footerStyles.socialBtn}
                activeOpacity={0.8}
                onPress={() => openUrl(contact.facebook)}
              >
                <Facebook size={18} color={Colors.neonBlue} strokeWidth={1.8} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ── Customer service ── */}
      {hasPhone ? (
        <View style={footerStyles.serviceSection}>
          <Text style={footerStyles.sectionLabel}>CUSTOMER SERVICE</Text>
          {contact.phone ? (
            <TouchableOpacity
              style={footerStyles.phoneRow}
              activeOpacity={0.8}
              onPress={callPhone}
            >
              <Phone size={13} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={footerStyles.phoneText}>{contact.phone}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={footerStyles.waBtn}
            activeOpacity={0.8}
            onPress={openWhatsApp}
          >
            <MessageCircle size={14} color='#25D366' strokeWidth={2} />
            <Text style={footerStyles.waBtnText}>WhatsApp Us</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const footerStyles = StyleSheet.create({
  root: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
  },
  quickBtnText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  socialSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  phoneText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(37,211,102,0.1)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(37,211,102,0.3)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  waBtnText: {
    color: '#25D366',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});

// ─── Shared form helpers ──────────────────────────────────────────────────────

function AuthField({
  label, value, onChange, icon, keyboardType, placeholder, secureTextEntry, right,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  keyboardType?: any;
  placeholder?: string;
  secureTextEntry?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        {icon && <View style={{ marginRight: 5 }}>{icon}</View>}
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {right}
      </View>
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <View style={styles.successBanner}>
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Auth ──
  authContent: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  authHeader: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: Spacing.xs,
  },
  authTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  authSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 15,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
  },
  authTab: {
    flex: 1,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: Radius.full,
  },
  authTabActive: {
    backgroundColor: Colors.neonBlue,
  },
  authTabText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  authTabTextActive: {
    color: Colors.white,
  },
  form: {
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  phoneHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  phoneHintText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  resendRow: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  resendText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  resendTextDim: {
    color: Colors.textMuted,
  },

  // ── Profile completion nudge ──
  completionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  completionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  completionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  completionSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  dobHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  dobHintText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl' as any,
  },

  // ── Profile ──
  profileContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },

  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.neonBlueDim,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.neonBlue,
  },
  avatarText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.neonBlue,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  heroInfo: {
    flex: 1,
    gap: 3,
  },
  heroName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
    lineHeight: 20,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,230,118,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.3)',
  },
  verifiedText: {
    color: Colors.success,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorDim,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
  },
  unverifiedText: {
    color: Colors.error,
    fontSize: 9,
    fontWeight: '700',
  },
  memberSince: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '500',
  },
  heroEmail: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  logoutBtn: {
    width: 34,
    height: 34,
    backgroundColor: Colors.errorDim,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
  },

  // ── Quick tiles ──
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  quickTile: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  quickTileIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickTileBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.neonBlue,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  quickTileBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  quickTileLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // ── Menu card ──
  menuCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  menuRowLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },

  // ── Section ──
  section: {
    gap: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  refreshBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dimText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },

  // ── Orders ──
  ordersList: {
    gap: Spacing.xs,
  },
  orderCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  orderTotal: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
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
    marginBottom: 2,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  modalClose: {
    padding: 4,
  },

  // ── Form helpers ──
  fieldWrapper: {
    gap: 2,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  fieldInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  errorBanner: {
    backgroundColor: Colors.errorDim,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: 'rgba(26,122,69,0.15)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(26,122,69,0.5)',
  },
  successText: {
    color: '#4ade80',
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});
