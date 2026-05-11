import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

const WEB_ANIMATION = 'fade' as const;
const MOBILE_ANIMATION = 'slide_from_right' as const;

export default function AdminLayout() {
  const animation = Platform.OS === 'web' ? WEB_ANIMATION : MOBILE_ANIMATION;

  return (
    <Stack screenOptions={{ headerShown: false, animation }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="products" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="customers" />
      <Stack.Screen name="employees" />
      <Stack.Screen name="reviews" />
      <Stack.Screen name="coupons" />
      <Stack.Screen name="content" />
      <Stack.Screen name="about" />
      <Stack.Screen name="builder" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="layout" />
      <Stack.Screen name="sizes" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="shipping" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="sections" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="loyalty" />
      <Stack.Screen name="audit-logs" />
    </Stack>
  );
}
