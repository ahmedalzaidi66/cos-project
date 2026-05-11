import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldOff, ArrowLeft } from 'lucide-react-native';
import { useAdmin, EMPLOYEE_DEFAULT_ROUTES } from '@/context/AdminContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Props = {
  /** Permission key required to view this section. Omit for auth-only (no specific permission needed). */
  permission?: string;
  children: React.ReactNode;
};

/**
 * Wraps admin pages with two layers of protection:
 *
 * 1. Client-side: checks isAdminAuthenticated and the required permission.
 * 2. Server-side: on every mount re-verifies the Supabase Auth session.
 *    This catches stale localStorage sessions (e.g. after a tab is left open).
 *    For employee accounts it also re-fetches the employee row to confirm
 *    the account is still active. If the check fails the guard redirects to login.
 */
export default function AdminGuard({ permission, children }: Props) {
  const router = useRouter();
  const { isAdminAuthenticated, hydrated, admin, adminLogout } = useAdmin();
  const { hasPermission } = usePermissions();
  const [serverVerified, setServerVerified] = useState(false);
  const [serverChecking, setServerChecking] = useState(true);

  // ── Server-side session re-verification on every mount ──────────────────────
  useEffect(() => {
    if (!hydrated) return;

    if (!isAdminAuthenticated) {
      setServerChecking(false);
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        // Super-admin (hardcoded) has no Supabase Auth session — skip server check.
        if (admin?.id === 'admin-fixed') {
          if (!cancelled) { setServerVerified(true); setServerChecking(false); }
          return;
        }

        // For employee accounts: confirm the Supabase Auth session is still valid.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          if (!cancelled) {
            await adminLogout();
            router.replace('/admin/login');
          }
          return;
        }

        // Confirm the employee row is still active (e.g. admin hasn't deactivated it).
        const { data: empRow, error: empError } = await supabase
          .from('employees')
          .select('id, is_active')
          .eq('auth_user_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!cancelled) {
          if (empError || !empRow) {
            await adminLogout();
            router.replace('/admin/login');
          } else {
            setServerVerified(true);
            setServerChecking(false);
          }
        }
      } catch {
        if (!cancelled) {
          setServerChecking(false);
          setServerVerified(false);
        }
      }
    };

    verify();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isAdminAuthenticated]);

  // ── Redirect unauthenticated users ──────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (!isAdminAuthenticated) {
      router.replace('/admin/login');
    }
  }, [isAdminAuthenticated, hydrated, router]);

  // ── Show spinner while hydrating from localStorage ───────────────────────────
  if (!hydrated || serverChecking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
      </View>
    );
  }

  if (!isAdminAuthenticated) return null;

  // ── Show spinner while server verification is running ───────────────────────
  // (serverVerified=false + serverChecking=false only when verification failed → already redirected)

  // ── Permission check ─────────────────────────────────────────────────────────
  if (permission && !hasPermission(permission)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  const router = useRouter();
  const { hasPermission } = usePermissions();

  const goToSafeRoute = () => {
    const safeRoute = EMPLOYEE_DEFAULT_ROUTES.find((r) => hasPermission(r.permission))?.route;
    if (safeRoute) {
      router.replace(safeRoute as any);
    } else {
      router.replace('/admin/login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <ShieldOff size={52} color={Colors.error} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Access Denied</Text>
      <Text style={styles.subtitle}>
        You don't have permission to view this section.{'\n'}
        Contact your administrator to request access.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={goToSafeRoute}
        activeOpacity={0.8}
      >
        <ArrowLeft size={16} color={Colors.background} strokeWidth={2} />
        <Text style={styles.btnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,68,68,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonBlue,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  btnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
