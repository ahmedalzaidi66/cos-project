import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAdmin } from '@/context/AdminContext';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';

export default function AdminIndex() {
  const router = useRouter();
  const { isAdminAuthenticated, hydrated } = useAdmin();

  useEffect(() => {
    if (!hydrated) return;
    console.log('[AdminIndex] hydrated, isAdminAuthenticated =', isAdminAuthenticated);
    if (isAdminAuthenticated) {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/admin/login');
    }
  }, [isAdminAuthenticated, hydrated]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={Colors.neonBlue} />
    </View>
  );
}
