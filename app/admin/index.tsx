import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAdmin, EMPLOYEE_DEFAULT_ROUTES } from '@/context/AdminContext';
import { usePermissions } from '@/hooks/usePermissions';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';

export default function AdminIndex() {
  const router = useRouter();
  const { isAdminAuthenticated, hydrated } = useAdmin();
  const { hasPermission } = usePermissions();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAdminAuthenticated) {
      router.replace('/admin/login');
      return;
    }
    // Redirect to the first route the user is permitted to access
    const destination = EMPLOYEE_DEFAULT_ROUTES.find((r) => hasPermission(r.permission))?.route;
    router.replace((destination ?? '/admin/login') as any);
  }, [isAdminAuthenticated, hydrated, hasPermission]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={Colors.neonBlue} />
    </View>
  );
}
