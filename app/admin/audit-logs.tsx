import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { ClipboardList, ListFilter as Filter, RefreshCw, Search, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react-native';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminWebLayout from '@/components/admin/AdminWebLayout';
import AdminMobileLayout from '@/components/admin/AdminMobileLayout';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAdmin } from '@/context/AdminContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  fetchAuditLogs,
  type AuditLogEntry,
  type AuditAction,
  type AuditEntityType,
} from '@/lib/auditLog';

const PAGE_SIZE = 30;

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
  { value: 'login', label: 'Logged In' },
  { value: 'logout', label: 'Logged Out' },
  { value: 'status_change', label: 'Status Changed' },
  { value: 'send', label: 'Sent' },
];

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Entities' },
  { value: 'product', label: 'Product' },
  { value: 'order', label: 'Order' },
  { value: 'employee', label: 'Employee' },
  { value: 'category', label: 'Category' },
  { value: 'coupon', label: 'Coupon' },
  { value: 'review', label: 'Review' },
  { value: 'settings', label: 'Settings' },
  { value: 'loyalty', label: 'Loyalty' },
  { value: 'content', label: 'Content' },
  { value: 'notification', label: 'Notification' },
  { value: 'customer', label: 'Customer' },
  { value: 'shipping', label: 'Shipping' },
];

const ACTION_COLORS: Record<string, string> = {
  create: Colors.success,
  update: Colors.neonBlue,
  delete: Colors.error,
  login: '#60CDFF',
  logout: Colors.textMuted,
  status_change: Colors.warning,
  send: '#A78BFA',
};

const ENTITY_COLORS: Record<string, string> = {
  product: Colors.gold,
  order: Colors.success,
  employee: Colors.neonBlue,
  category: Colors.warning,
  coupon: '#FF9800',
  review: '#60CDFF',
  settings: Colors.textSecondary,
  loyalty: '#FFD700',
  content: '#A78BFA',
  notification: '#FF6B6B',
  customer: Colors.success,
  shipping: '#00BCD4',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? Colors.textMuted;
  return (
    <View style={[bs.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[bs.badgeText, { color }]}>{action.replace('_', ' ').toUpperCase()}</Text>
    </View>
  );
}

function EntityBadge({ entity }: { entity: string }) {
  const color = ENTITY_COLORS[entity] ?? Colors.textMuted;
  return (
    <View style={[bs.badge, { backgroundColor: color + '15', borderColor: color + '40' }]}>
      <Text style={[bs.badgeText, { color }]}>{entity.toUpperCase()}</Text>
    </View>
  );
}

type DetailsModalProps = {
  log: AuditLogEntry | null;
  onClose: () => void;
};

function DetailsModal({ log, onClose }: DetailsModalProps) {
  if (!log) return null;

  const hasBefore = !!log.before_data;
  const hasAfter = !!log.after_data;
  const hasMeta = !!log.metadata;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={dm.overlay}>
        <View style={dm.sheet}>
          <View style={dm.header}>
            <Text style={dm.title}>Change Details</Text>
            <TouchableOpacity onPress={onClose} style={dm.closeBtn}>
              <X size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={dm.body} showsVerticalScrollIndicator={false}>
            <View style={dm.row}>
              <Text style={dm.metaLabel}>Action</Text>
              <ActionBadge action={log.action} />
            </View>
            <View style={dm.row}>
              <Text style={dm.metaLabel}>Entity</Text>
              <EntityBadge entity={log.entity_type} />
            </View>
            {log.entity_label && (
              <View style={dm.row}>
                <Text style={dm.metaLabel}>Label</Text>
                <Text style={dm.metaValue}>{log.entity_label}</Text>
              </View>
            )}
            {log.entity_id && (
              <View style={dm.row}>
                <Text style={dm.metaLabel}>ID</Text>
                <Text style={[dm.metaValue, { fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: FontSize.xs }]}>{log.entity_id}</Text>
              </View>
            )}
            <View style={dm.row}>
              <Text style={dm.metaLabel}>Admin</Text>
              <Text style={dm.metaValue}>{log.admin_email}</Text>
            </View>
            <View style={dm.row}>
              <Text style={dm.metaLabel}>Date</Text>
              <Text style={dm.metaValue}>{formatDate(log.created_at)}</Text>
            </View>

            {(hasBefore || hasAfter) && (
              <View style={dm.diffSection}>
                <Text style={dm.diffTitle}>Data Changes</Text>
                <View style={dm.diffGrid}>
                  {hasBefore && (
                    <View style={dm.diffCol}>
                      <Text style={dm.diffLabel}>Before</Text>
                      <ScrollView style={dm.codeBox} horizontal showsHorizontalScrollIndicator={false}>
                        <Text style={dm.codeText}>{JSON.stringify(log.before_data, null, 2)}</Text>
                      </ScrollView>
                    </View>
                  )}
                  {hasAfter && (
                    <View style={dm.diffCol}>
                      <Text style={dm.diffLabel}>After</Text>
                      <ScrollView style={dm.codeBox} horizontal showsHorizontalScrollIndicator={false}>
                        <Text style={dm.codeText}>{JSON.stringify(log.after_data, null, 2)}</Text>
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            )}

            {hasMeta && (
              <View style={dm.diffSection}>
                <Text style={dm.diffTitle}>Metadata</Text>
                <ScrollView style={dm.codeBox} horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={dm.codeText}>{JSON.stringify(log.metadata, null, 2)}</Text>
                </ScrollView>
              </View>
            )}

            {!hasBefore && !hasAfter && !hasMeta && (
              <Text style={dm.noChanges}>No change data recorded</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <View style={sk.row}>
      <View style={[sk.pill, { width: 70 }]} />
      <View style={[sk.pill, { width: 80 }]} />
      <View style={[sk.line, { flex: 1 }]} />
      <View style={[sk.line, { width: 120 }]} />
      <View style={[sk.line, { width: 90 }]} />
    </View>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────

function AuditLogsContent() {
  const { t } = useLanguage();
  const { admin } = useAdmin();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { width } = useWindowDimensions();

  const canViewAll = isSuperAdmin || hasPermission('view_audit_logs');

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pg: number, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAuditLogs({
        search: q,
        action: filterAction,
        entityType: filterEntity,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: pg,
        pageSize: PAGE_SIZE,
        isSuperAdmin: isSuperAdmin,
        canViewAll,
        currentUserId: admin?.id,
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterEntity, dateFrom, dateTo, isSuperAdmin, canViewAll, admin?.id]);

  useEffect(() => {
    load(0, search);
    setPage(0);
  }, [filterAction, filterEntity, dateFrom, dateTo]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      load(0, search);
      setPage(0);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const goPage = (newPage: number) => {
    setPage(newPage);
    load(newPage, search);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isWeb = width >= 768;

  const clearFilters = () => {
    setFilterAction('all');
    setFilterEntity('all');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  const hasActiveFilters = filterAction !== 'all' || filterEntity !== 'all' || dateFrom || dateTo || search;

  return (
    <View style={s.root}>
      {/* Header bar */}
      <View style={s.topBar}>
        <View style={s.searchWrap}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t.auditLogSearchPlaceholder}
            placeholderTextColor={Colors.textMuted}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[s.filterBtn, hasActiveFilters && s.filterBtnActive]}
          onPress={() => setFiltersOpen(!filtersOpen)}
        >
          <Filter size={16} color={hasActiveFilters ? Colors.neonBlue : Colors.textMuted} />
          {!isWeb && <Text style={[s.filterBtnText, hasActiveFilters && { color: Colors.neonBlue }]}>Filter</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.refreshBtn} onPress={() => load(page, search)}>
          <RefreshCw size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Filters panel */}
      {filtersOpen && (
        <View style={s.filtersPanel}>
          <View style={s.filtersRow}>
            {/* Action filter */}
            <View style={s.filterGroup}>
              <Text style={s.filterLabel}>{t.auditLogFilterAction}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
                {ACTION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.chip, filterAction === opt.value && s.chipActive]}
                    onPress={() => setFilterAction(opt.value)}
                  >
                    <Text style={[s.chipText, filterAction === opt.value && s.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Entity filter */}
            <View style={s.filterGroup}>
              <Text style={s.filterLabel}>{t.auditLogFilterEntity}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
                {ENTITY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.chip, filterEntity === opt.value && s.chipActive]}
                    onPress={() => setFilterEntity(opt.value)}
                  >
                    <Text style={[s.chipText, filterEntity === opt.value && s.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Date range */}
          <View style={s.dateRow}>
            <View style={s.dateField}>
              <Text style={s.filterLabel}>{t.auditLogDateFrom}</Text>
              <TextInput
                style={s.dateInput}
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={s.dateField}>
              <Text style={s.filterLabel}>{t.auditLogDateTo}</Text>
              <TextInput
                style={s.dateInput}
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            {hasActiveFilters && (
              <TouchableOpacity style={s.clearBtn} onPress={clearFilters}>
                <X size={14} color={Colors.error} />
                <Text style={s.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Summary */}
      {!loading && (
        <Text style={s.summary}>
          {total} log{total !== 1 ? 's' : ''}
          {hasActiveFilters ? ' (filtered)' : ''}
        </Text>
      )}

      {/* Error */}
      {error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* Table */}
      {isWeb ? (
        <WebTable logs={logs} loading={loading} onViewDetails={setSelectedLog} />
      ) : (
        <MobileList logs={logs} loading={loading} onViewDetails={setSelectedLog} />
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <View style={s.pagination}>
          <TouchableOpacity
            style={[s.pageBtn, page === 0 && s.pageBtnDisabled]}
            onPress={() => page > 0 && goPage(page - 1)}
            disabled={page === 0}
          >
            <ChevronLeft size={16} color={page === 0 ? Colors.textMuted : Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.pageLabel}>
            {page + 1} / {totalPages}
          </Text>
          <TouchableOpacity
            style={[s.pageBtn, page >= totalPages - 1 && s.pageBtnDisabled]}
            onPress={() => page < totalPages - 1 && goPage(page + 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight size={16} color={page >= totalPages - 1 ? Colors.textMuted : Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      <DetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </View>
  );
}

// ── Web table ─────────────────────────────────────────────────────────────────

type TableProps = {
  logs: AuditLogEntry[];
  loading: boolean;
  onViewDetails: (log: AuditLogEntry) => void;
};

function WebTable({ logs, loading, onViewDetails }: TableProps) {
  return (
    <View style={wt.wrap}>
      {/* Table header */}
      <View style={wt.headerRow}>
        <Text style={[wt.th, { width: 90 }]}>Action</Text>
        <Text style={[wt.th, { width: 90 }]}>Entity</Text>
        <Text style={[wt.th, { flex: 1 }]}>Label / ID</Text>
        <Text style={[wt.th, { width: 180 }]}>Admin</Text>
        <Text style={[wt.th, { width: 150 }]}>Date</Text>
        <Text style={[wt.th, { width: 60 }]}></Text>
      </View>

      <ScrollView style={wt.body} showsVerticalScrollIndicator={false}>
        {loading && [0,1,2,3,4,5,6,7,8,9].map((i) => (
          <View key={i} style={wt.row}><SkeletonRow /></View>
        ))}

        {!loading && logs.length === 0 && (
          <View style={wt.emptyWrap}>
            <ClipboardList size={48} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={wt.emptyTitle}>No activity yet</Text>
            <Text style={wt.emptySub}>Admin actions will appear here as they occur</Text>
          </View>
        )}

        {!loading && logs.map((log) => (
          <View key={log.id} style={wt.row}>
            <View style={{ width: 90 }}>
              <ActionBadge action={log.action} />
            </View>
            <View style={{ width: 90 }}>
              <EntityBadge entity={log.entity_type} />
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              {log.entity_label && (
                <Text style={wt.label} numberOfLines={1}>{log.entity_label}</Text>
              )}
              {log.entity_id && (
                <Text style={wt.subLabel} numberOfLines={1}>{log.entity_id}</Text>
              )}
              {!log.entity_label && !log.entity_id && (
                <Text style={wt.subLabel}>—</Text>
              )}
            </View>
            <View style={{ width: 180 }}>
              <Text style={wt.label} numberOfLines={1}>{log.admin_email}</Text>
            </View>
            <View style={{ width: 150 }}>
              <Text style={wt.subLabel}>{formatDate(log.created_at)}</Text>
            </View>
            <TouchableOpacity
              style={{ width: 60, alignItems: 'center' }}
              onPress={() => onViewDetails(log)}
            >
              <Eye size={16} color={Colors.neonBlue} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Mobile list ───────────────────────────────────────────────────────────────

type MobileListProps = TableProps;

function MobileList({ logs, loading, onViewDetails }: MobileListProps) {
  if (loading) {
    return (
      <View style={ml.wrap}>
        {[0,1,2,3,4].map((i) => (
          <View key={i} style={ml.card}>
            <SkeletonRow />
          </View>
        ))}
      </View>
    );
  }

  if (logs.length === 0) {
    return (
      <View style={ml.empty}>
        <ClipboardList size={48} color={Colors.textMuted} strokeWidth={1.5} />
        <Text style={ml.emptyTitle}>No activity yet</Text>
        <Text style={ml.emptySub}>Admin actions will appear here as they occur</Text>
      </View>
    );
  }

  return (
    <ScrollView style={ml.wrap} showsVerticalScrollIndicator={false}>
      {logs.map((log) => (
        <TouchableOpacity
          key={log.id}
          style={ml.card}
          onPress={() => onViewDetails(log)}
          activeOpacity={0.75}
        >
          <View style={ml.cardTop}>
            <View style={ml.badges}>
              <ActionBadge action={log.action} />
              <EntityBadge entity={log.entity_type} />
            </View>
            <Eye size={16} color={Colors.neonBlue} />
          </View>
          {log.entity_label && (
            <Text style={ml.cardLabel} numberOfLines={1}>{log.entity_label}</Text>
          )}
          <View style={ml.cardMeta}>
            <Text style={ml.cardMetaText}>{log.admin_email}</Text>
            <Text style={ml.cardMetaText}>{formatDate(log.created_at)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { isWeb } = useAdminLayout();
  const { t } = useLanguage();

  const content = (
    <AdminGuard permission="view_audit_logs">
      <AuditLogsContent />
    </AdminGuard>
  );

  if (isWeb) {
    return (
      <AdminWebLayout title={t.activityLogs} noScroll>
        {content}
      </AdminWebLayout>
    );
  }

  return (
    <AdminMobileLayout title={t.activityLogs}>
      {content}
    </AdminMobileLayout>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    borderColor: Colors.neonBlue,
    backgroundColor: Colors.neonBlue + '12',
  },
  filterBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  refreshBtn: {
    padding: Spacing.sm + 2,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filtersPanel: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  filtersRow: {
    gap: Spacing.md,
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
    backgroundColor: 'transparent',
  },
  chipActive: {
    borderColor: Colors.neonBlue,
    backgroundColor: Colors.neonBlue + '20',
  },
  chipText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.neonBlue,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  dateField: {
    gap: 4,
  },
  dateInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    minWidth: 140,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.error + '55',
    backgroundColor: Colors.error + '10',
    marginBottom: 0,
  },
  clearBtnText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  summary: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  errorBanner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.error + '15',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pageBtn: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    minWidth: 60,
    textAlign: 'center',
  },
});

const bs = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

const wt = StyleSheet.create({
  wrap: {
    flex: 1,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  th: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '60',
  },
  label: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
  },
  subLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});

const ml = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMetaText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});

const sk = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  pill: {
    height: 20,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  line: {
    height: 12,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
});

const dm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 640,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
  },
  body: {
    padding: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
  },
  metaLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  metaValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '65%',
  },
  diffSection: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  diffTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  diffGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  diffCol: {
    flex: 1,
    gap: 6,
  },
  diffLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  codeBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    maxHeight: 200,
  },
  codeText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    lineHeight: 18,
  },
  noChanges: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});
