import React, { useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { AdminProvider } from '@/context/AdminContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { CMSProvider } from '@/context/CMSContext';
import { LayoutProvider } from '@/context/LayoutContext';
import { UISizeProvider } from '@/context/UISizeContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { WishlistToastProvider } from '@/context/WishlistToastContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { NotificationProvider } from '@/context/NotificationContext';
import BeautyChat, { ChatFloatingButton } from '@/components/BeautyChat';

export default function RootLayout() {
  useFrameworkReady();
  const [chatOpen, setChatOpen] = useState(false);
  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  return (
    <ThemeProvider>
    <LanguageProvider>
      <CMSProvider>
      <LayoutProvider>
      <UISizeProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <WishlistToastProvider>
              <NotificationProvider>
              <AdminProvider>
                <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="product/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
                  <Stack.Screen name="checkout" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="admin" options={{ headerShown: false }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <ChatFloatingButton onPress={openChat} chatOpen={chatOpen} />
                <BeautyChat visible={chatOpen} onClose={closeChat} />
                <StatusBar style="light" />
              </AdminProvider>
              </NotificationProvider>
            </WishlistToastProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
      </UISizeProvider>
      </LayoutProvider>
      </CMSProvider>
    </LanguageProvider>
    </ThemeProvider>
  );
}
