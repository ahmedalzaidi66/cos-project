import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { setAdminSessionToken, supabase } from '@/lib/supabase';

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

/** Ordered list used to pick the first permitted route after employee login. */
export const EMPLOYEE_DEFAULT_ROUTES: { permission: string; route: string }[] = [
  { permission: 'view_dashboard',   route: '/admin/dashboard' },
  { permission: 'manage_products',  route: '/admin/products' },
  { permission: 'manage_orders',    route: '/admin/orders' },
  { permission: 'manage_customers', route: '/admin/customers' },
  { permission: 'manage_employees', route: '/admin/employees' },
  { permission: 'manage_reviews',   route: '/admin/reviews' },
  { permission: 'manage_coupons',   route: '/admin/coupons' },
  { permission: 'manage_cms',       route: '/admin/content' },
  { permission: 'manage_settings',  route: '/admin/settings' },
];

type AdminContextType = {
  admin: AdminUser | null;
  isAdminAuthenticated: boolean;
  /** Returns the route to redirect to on success, '' if no permitted route, null on auth failure. */
  adminLogin: (email: string, password: string) => Promise<string | null>;
  adminLogout: () => void | Promise<void>;
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
    const storedUser = storageGet(STORAGE_USER_KEY);
    console.log('[AdminContext] localStorage isAdminLoggedIn =', stored);
    if (stored === 'true' && storedUser) {
      try {
        const user: AdminUser = JSON.parse(storedUser);
        setAdmin(user);
        setAdminSessionToken('fixed-admin-token');
        console.log('[AdminContext] Restored session for:', user.email, 'role:', user.role);
      } catch {
        storageRemove(STORAGE_KEY);
        storageRemove(STORAGE_USER_KEY);
      }
    }
    setHydrated(true);
  }, []);

  const adminLogin = useCallback(async (email: string, password: string): Promise<string | null> => {
    const emailLower = email.trim().toLowerCase();
    console.log('[AdminContext] Login attempt:', emailLower);

    // ── Path 1: hardcoded super-admin ──────────────────────────────────────────
    if (emailLower === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      console.log('[AdminContext] Hardcoded super-admin match');
      const user = buildAdminUser();
      setAdmin(user);
      setAdminSessionToken('fixed-admin-token');
      storageSet(STORAGE_KEY, 'true');
      storageSet(STORAGE_USER_KEY, JSON.stringify(user));
      return '/admin/dashboard';
    }

    // ── Path 2: Supabase Auth employee account ─────────────────────────────────
    console.log('[AdminContext] Trying Supabase Auth sign-in...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password,
    });

    if (authError || !authData.user) {
      console.log('[AdminContext] Supabase Auth failed:', authError?.message);
      return null;
    }

    // Look up the employees row linked to this auth user
    const { data: empRow, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, email, role, permissions, is_active, custom_permissions')
      .eq('auth_user_id', authData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (empError || !empRow) {
      console.log('[AdminContext] No active employee row for auth user:', authData.user.id, empError?.message);
      await supabase.auth.signOut();
      return null;
    }

    console.log('[AdminContext] Employee found:', empRow.email, 'role:', empRow.role);

    // Only the hardcoded super_admin role gets all permissions automatically.
    // Every other role — including 'admin' — uses only the permissions explicitly
    // stored in their employee row, so the admin UI can restrict access.
    const permissions: string[] =
      empRow.role === 'super_admin'
        ? ALL_PERMISSIONS
        : Array.isArray(empRow.permissions)
        ? empRow.permissions.filter((p: string) => ALL_PERMISSIONS.includes(p))
        : [];

    const user: AdminUser = {
      id: empRow.id,
      email: empRow.email,
      name: empRow.full_name,
      role: empRow.role as AdminRole,
      permissions,
    };

    setAdmin(user);
    setAdminSessionToken('fixed-admin-token');
    storageSet(STORAGE_KEY, 'true');
    storageSet(STORAGE_USER_KEY, JSON.stringify(user));

    // Pick the first route the employee is permitted to access.
    // Returns '' (empty string) if authenticated but no permitted route exists.
    const destination =
      EMPLOYEE_DEFAULT_ROUTES.find((r) => permissions.includes(r.permission))?.route ?? '';
    console.log('[AdminContext] Employee login successful, destination:', destination || '(none)');
    return destination;
  }, []);

  const adminLogout = useCallback(async () => {
    console.log('[AdminContext] Logging out...');
    setAdmin(null);
    setAdminSessionToken(null);
    storageRemove(STORAGE_KEY);
    storageRemove(STORAGE_USER_KEY);
    await supabase.auth.signOut();
    console.log('[AdminContext] Logged out');
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
