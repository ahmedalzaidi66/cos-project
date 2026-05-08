import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { setAdminSessionToken } from '@/lib/supabase';

export type AdminRole = 'super_admin' | 'admin' | 'employee' | 'product_manager' | 'order_manager' | 'customer_support' | 'content_editor';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole | string;
  permissions: string[];
};

const ADMIN_EMAIL = 'admin@lazurdemakeup.com';
const ADMIN_PASSWORD = '123456';
const STORAGE_KEY = 'isAdminLoggedIn';
const STORAGE_USER_KEY = 'adminUser';

function storageGet(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.localStorage.getItem(key);
  }
  return null;
}

function storageSet(key: string, value: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(key, value);
  }
}

function storageRemove(key: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.removeItem(key);
  }
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin:      'Super Admin',
  admin:            'Admin',
  employee:         'Employee',
  product_manager:  'Product Manager',
  order_manager:    'Order Manager',
  customer_support: 'Customer Support',
  content_editor:   'Content Editor',
};

// Permission → admin route mapping (used for nav filtering)
export const PERMISSION_ROUTES: Record<string, string> = {
  view_dashboard:      '/admin/dashboard',
  manage_products:     '/admin/products',
  manage_orders:       '/admin/orders',
  manage_customers:    '/admin/customers',
  manage_employees:    '/admin/employees',
  manage_reviews:      '/admin/reviews',
  manage_coupons:      '/admin/coupons',
  manage_cms:          '/admin/content',
  manage_cms_builder:  '/admin/builder',
  manage_layout:       '/admin/layout',
  manage_theme:        '/admin/sizes',
  manage_settings:     '/admin/settings',
  manage_permissions:  '/admin/permissions',
};

// Which permission key is required to access each route
export const ROUTE_PERMISSION: Record<string, string> = {
  '/admin/dashboard':   'view_dashboard',
  '/admin/products':    'manage_products',
  '/admin/orders':      'manage_orders',
  '/admin/customers':   'manage_customers',
  '/admin/employees':   'manage_employees',
  '/admin/reviews':     'manage_reviews',
  '/admin/coupons':     'manage_coupons',
  '/admin/content':     'manage_cms',
  '/admin/builder':     'manage_cms',
  '/admin/layout':      'manage_layout',
  '/admin/sizes':       'manage_layout',
  '/admin/settings':    'manage_settings',
  '/admin/permissions': 'manage_permissions',
};

type AdminContextType = {
  admin: AdminUser | null;
  isAdminAuthenticated: boolean;
  adminLogin: (email: string, password: string) => Promise<boolean>;
  adminLogout: () => void;
  hydrated: boolean;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const ALL_PERMISSIONS = [
  'view_dashboard', 'manage_products', 'manage_orders', 'manage_customers',
  'manage_employees', 'manage_reviews', 'manage_coupons', 'manage_cms',
  'manage_cms_builder', 'manage_layout', 'manage_theme', 'manage_settings',
  'manage_permissions',
];

function buildAdminUser(): AdminUser {
  return {
    id: 'admin-fixed',
    email: ADMIN_EMAIL,
    name: 'Admin',
    role: 'super_admin',
    permissions: ALL_PERMISSIONS,
  };
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    console.log('[AdminContext] Hydrating from localStorage...');
    const stored = storageGet(STORAGE_KEY);
    console.log('[AdminContext] localStorage isAdminLoggedIn =', stored);
    if (stored === 'true') {
      const user = buildAdminUser();
      setAdmin(user);
      setAdminSessionToken('fixed-admin-token');
      console.log('[AdminContext] Restored admin session from localStorage');
    }
    setHydrated(true);
  }, []);

  const adminLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    const emailLower = email.trim().toLowerCase();
    console.log('[AdminContext] Login attempt:', emailLower);

    if (emailLower === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      console.log('[AdminContext] Credentials match. Logging in...');
      const user = buildAdminUser();
      setAdmin(user);
      setAdminSessionToken('fixed-admin-token');
      storageSet(STORAGE_KEY, 'true');
      storageSet(STORAGE_USER_KEY, JSON.stringify(user));
      console.log('[AdminContext] Login successful, localStorage saved');
      return true;
    }

    console.log('[AdminContext] Invalid credentials');
    return false;
  }, []);

  const adminLogout = useCallback(() => {
    console.log('[AdminContext] Logging out...');
    setAdmin(null);
    setAdminSessionToken(null);
    storageRemove(STORAGE_KEY);
    storageRemove(STORAGE_USER_KEY);
    console.log('[AdminContext] Logged out, localStorage cleared');
  }, []);

  return (
    <AdminContext.Provider value={{ admin, isAdminAuthenticated: !!admin, adminLogin, adminLogout, hydrated }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
