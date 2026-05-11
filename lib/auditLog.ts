import { adminSupabase, supabase } from './supabase';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'status_change'
  | 'send';

export type AuditEntityType =
  | 'product'
  | 'order'
  | 'employee'
  | 'category'
  | 'coupon'
  | 'review'
  | 'settings'
  | 'loyalty'
  | 'content'
  | 'notification'
  | 'customer'
  | 'shipping';

export type AuditLogEntry = {
  id: string;
  admin_user_id: string;
  admin_email: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string | null;
  entity_label: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type LogAuditParams = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  adminUserId: string;
  adminEmail: string;
};

/**
 * Records an admin action to admin_audit_logs.
 * Fire-and-forget — failures are silently swallowed so they never block the actual operation.
 */
export async function logAdminAction(params: LogAuditParams): Promise<void> {
  try {
    const db = adminSupabase();
    await db.from('admin_audit_logs').insert({
      admin_user_id: params.adminUserId,
      admin_email: params.adminEmail,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      entity_label: params.entityLabel ?? null,
      before_data: params.beforeData ?? null,
      after_data: params.afterData ?? null,
      metadata: params.metadata ?? null,
      ip_address: null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch {
    // Audit log failures must never break the primary action
  }
}

export type FetchAuditLogsParams = {
  adminUserId?: string;
  action?: string;
  entityType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  isSuperAdmin?: boolean;
  currentUserId?: string;
  canViewAll?: boolean;
};

export type FetchAuditLogsResult = {
  logs: AuditLogEntry[];
  total: number;
};

export async function fetchAuditLogs(params: FetchAuditLogsParams): Promise<FetchAuditLogsResult> {
  const page = params.page ?? 0;
  const pageSize = params.pageSize ?? 30;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const db = adminSupabase();

  let query = db
    .from('admin_audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  // Super admin or employee with view_audit_logs can see all; otherwise own only
  if (!params.isSuperAdmin && !params.canViewAll && params.currentUserId) {
    query = query.eq('admin_user_id', params.currentUserId);
  }

  if (params.adminUserId) {
    query = query.eq('admin_user_id', params.adminUserId);
  }

  if (params.action && params.action !== 'all') {
    query = query.eq('action', params.action);
  }

  if (params.entityType && params.entityType !== 'all') {
    query = query.eq('entity_type', params.entityType);
  }

  if (params.search) {
    query = query.or(
      `entity_label.ilike.%${params.search}%,admin_email.ilike.%${params.search}%,entity_id.ilike.%${params.search}%`
    );
  }

  if (params.dateFrom) {
    query = query.gte('created_at', params.dateFrom);
  }

  if (params.dateTo) {
    // Include the full end day
    const end = new Date(params.dateTo);
    end.setDate(end.getDate() + 1);
    query = query.lt('created_at', end.toISOString().split('T')[0]);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    logs: (data ?? []) as AuditLogEntry[],
    total: count ?? 0,
  };
}
