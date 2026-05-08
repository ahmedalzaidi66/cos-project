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
} from 'react-native';
import { User, Mail, Lock, LogOut, Package, Eye, EyeOff, Heart, ChevronRight, CircleCheck as CheckCircle, Globe, CreditCard, MapPin, KeyRound, Pencil, X } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useRouter } from 'expo-router';
import { supabase, Order } from '@/lib/supabase';
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

function AuthView() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const { t } = useLanguage();

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
          <User size={34} color={Colors.neonBlue} strokeWidth={1.5} />
          <Text style={styles.authTitle}>
            {tab === 'login' ? t.welcomeBack : t.createAccount}
          </Text>
          <Text style={styles.authSubtitle}>
            {tab === 'login' ? t.signInSubtitle : t.registerSubtitle}
          </Text>
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
        </View>

        {tab === 'login' ? <LoginForm /> : <RegisterForm onSuccess={() => setTab('login')} />}
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

// ─── Profile ──────────────────────────────────────────────────────────────────

function ProfileView() {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const { count: wishlistCount } = useWishlist();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(false);

  useEffect(() => {
    if (!user?.email) { setLoadingOrders(false); return; }
    supabase
      .from('orders')
      .select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setOrders(data);
        setLoadingOrders(false);
      })
      .catch((err) => {
        console.error('[Account] orders fetch error:', err?.message ?? err);
        setLoadingOrders(false);
      });
  }, [user]);

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
            <Text style={styles.heroName}>{user?.firstName} {user?.lastName}</Text>

            <View style={styles.heroBadgeRow}>
              {user?.emailVerified ? (
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

            <Text style={styles.heroEmail}>{user?.email}</Text>
          </View>

          <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.8}>
            <LogOut size={16} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>

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
            icon={<MapPin size={18} color={Colors.textSecondary} strokeWidth={1.8} />}
            label="Addresses"
            onPress={() => {}}
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
            <Text style={styles.sectionTitle}>{t.orderHistory}</Text>
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

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <EditProfileModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        currentFirst={user?.firstName ?? ''}
        currentLast={user?.lastName ?? ''}
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
  const statusColor =
    order.status === 'confirmed' ? Colors.success :
    order.status === 'pending' ? Colors.warning : Colors.textMuted;

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTopRow}>
        <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : '—'}
          </Text>
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
  open, onClose, currentFirst, currentLast,
}: {
  open: boolean;
  onClose: () => void;
  currentFirst: string;
  currentLast: string;
}) {
  const [firstName, setFirstName] = useState(currentFirst);
  const [lastName, setLastName] = useState(currentLast);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open) { setFirstName(currentFirst); setLastName(currentLast); setError(''); setSuccess(''); }
  }, [open]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError('Name fields are required.'); return; }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    });
    setSaving(false);
    if (err) setError(err.message);
    else { setSuccess('Profile updated.'); setTimeout(onClose, 800); }
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
          <AuthField label="First Name" value={firstName} onChange={setFirstName} placeholder="First name" />
          <AuthField label="Last Name" value={lastName} onChange={setLastName} placeholder="Last name" />
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
    alignItems: 'center',
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
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
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
