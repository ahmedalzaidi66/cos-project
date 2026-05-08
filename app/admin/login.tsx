import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { adminLogin } = useAdmin();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    console.log('[AdminLogin] Submit pressed, email =', email.trim(), 'password length =', password.length);
    if (!email.trim() || !password.trim()) {
      setError(t.enterEmailAndPassword);
      return;
    }
    setError('');
    setLoading(true);
    const success = await adminLogin(email.trim(), password);
    console.log('[AdminLogin] adminLogin returned:', success);
    setLoading(false);
    if (success) {
      console.log('[AdminLogin] Redirecting to /admin/dashboard');
      router.replace('/admin/dashboard');
    } else {
      console.log('[AdminLogin] Login failed, showing error');
      setError('Invalid email or password');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.iconRing}>
          <ShieldCheck size={36} color={Colors.neonBlue} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>{t.adminDashboard}</Text>
        <Text style={styles.subtitle}>{t.adminSignInSubtitle}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.field}>
          <Mail size={16} color={Colors.textMuted} strokeWidth={2} style={styles.fieldIcon} />
          <TextInput
            style={styles.input}
            placeholder={t.adminEmailPlaceholder}
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Lock size={16} color={Colors.textMuted} strokeWidth={2} style={styles.fieldIcon} />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={t.password}
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
            {showPassword ? (
              <EyeOff size={16} color={Colors.textMuted} strokeWidth={2} />
            ) : (
              <Eye size={16} color={Colors.textMuted} strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.loginBtnText}>{t.signIn}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backLink}>
          <Text style={styles.backLinkText}>{t.backToStore}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1.5,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    width: '100%',
    height: 52,
  },
  fieldIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  eyeBtn: {
    padding: 4,
  },
  loginBtn: {
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: Spacing.sm,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  backLink: {
    marginTop: Spacing.xl,
    padding: Spacing.sm,
  },
  backLinkText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
