import { useCallback, useState } from 'react';
import { usePermissions } from './usePermissions';

/**
 * Provides per-action permission enforcement for admin mutation handlers.
 *
 * Usage:
 *   const { guard } = useActionPermission('manage_products');
 *
 *   const handleDelete = async (id: string) => {
 *     if (!guard()) return;  // blocks and sets error if no permission
 *     // proceed with delete...
 *   };
 *
 * `permissionError` holds the last blocked-action message (clear after display).
 */
export function useActionPermission(permission: string) {
  const { hasPermission } = usePermissions();
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const guard = useCallback(
    (customMessage?: string): boolean => {
      if (hasPermission(permission)) return true;
      setPermissionError(
        customMessage ??
          `You don't have permission to perform this action. Required: ${permission}.`
      );
      return false;
    },
    [hasPermission, permission]
  );

  const clearPermissionError = useCallback(() => setPermissionError(null), []);

  return { guard, permissionError, clearPermissionError };
}
