import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldOff, ArrowLeft } from 'lucide-react-native';
import { useAdmin, EMPLOYEE_DEFAULT_ROUTES } from '@/context/AdminContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

type Props = {
  /** Permission key required to view this section. Omit for auth-only (no specific permission needed). */
  permission?: string;
  children: React.ReactNode;
};

export default function AdminGuard({ permission, children }: Props) {
  const router = useRouter();
  const { isAdminAuthenticated, hydrated } = useAdmin();
  const { hasPermission } = usePermissions();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAdminAuthenticated) {
      router.replace('/admin/login');
    }
  }, [isAdminAuthenticated, hydrated]);

  if (!hydrated) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
      </View>
    );
  }

  if (!isAdminAuthenticated) return null;

  if (permission && !hasPermission(permission)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  const router = useRouter();
  const { hasPermission } = usePermissions();

  const goToSafeRoute = () => {
    // Find the first route this user is allowed to access
    const safeRoute = EMPLOYEE_DEFAULT_ROUTES.find((r) => hasPermission(r.permission))?.route;
    if (safeRoute) {
      router.replace(safeRoute as any);
    } else {
      // No permitted routes at all — log out to login
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
