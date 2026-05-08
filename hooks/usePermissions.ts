import { useCallback } from 'react';
import { useAdmin, ROUTE_PERMISSION } from '@/context/AdminContext';

/**
 * Returns helpers for checking the logged-in admin's permissions.
 *
 * - `hasPermission(key)` — true if the admin holds the given permission key
 * - `canAccess(route)`   — true if the admin may visit the given admin route
 * - `isSuperAdmin`       — true when role is 'super_admin' or 'admin'
 */
export function usePermissions() {
  const { admin } = useAdmin();

  const isSuperAdmin = admin?.role === 'super_admin' || admin?.role === 'admin';

  const hasPermission = useCallback(
    (key: string): boolean => {
      if (!admin) return false;
      if (isSuperAdmin) return true;
      return admin.permissions.includes(key);
    },
    [admin, isSuperAdmin]
  );

  const canAccess = useCallback(
    (route: string): boolean => {
      const required = ROUTE_PERMISSION[route];
      if (!required) return true; // no restriction defined → allow
      return hasPermission(required);
    },
    [hasPermission]
  );

  return { hasPermission, canAccess, isSuperAdmin };
}
