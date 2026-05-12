import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import {
  ShieldAlert,
  Users,
  UserCog,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react-native';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import MobileUnsupported from '@/components/admin/MobileUnsupported';
import Toast from '@/components/admin/Toast';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useActionPermission } from '@/hooks/useActionPermission';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import type { Translations } from '@/constants/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

type Permission = {
  key: string;
  label: string;
  description: string;
  section: string;
};

type Role = {
  key: string;
  label: string;
};

type Employee = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  custom_permissions: string[] | null;
};

type Tab = 'roles' | 'employees';

// Roles that cannot have their permissions edited
const LOCKED_ROLES = new Set(['super_admin', 'admin', 'user']);

const SECTION_COLORS: Record<string, string> = {
  general:   Colors.neonBlue,
  catalog:   Colors.warning,
  sales:     Colors.success,
  content:   '#60CDFF',
  admin:     Colors.error,
  marketing: '#F472B6',
};

// ─── i18n helpers ─────────────────────────────────────────────────────────────

// Map permission key → translation key suffix for label
const PERM_LABEL_KEYS: Record<string, keyof Translations> = {
  view_dashboard:       'permLabelViewDashboard',
  manage_analytics:     'permLabelManageAnalytics',
  manage_products:      'permLabelManageProducts',
  manage_categories:    'permLabelManageCategories',
  manage_orders:        'permLabelManageOrders',
  manage_customers:     'permLabelManageCustomers',
  manage_loyalty:       'permLabelManageLoyalty',
  manage_notifications: 'permLabelManageNotifications',
  manage_employees:     'permLabelManageEmployees',
  manage_reviews:       'permLabelManageReviews',
  manage_coupons:       'permLabelManageCoupons',
  manage_shipping:      'permLabelManageShipping',
  manage_sections:      'permLabelManageSections',
  manage_cms:           'permLabelManageCms',
  manage_about:         'permLabelManageAbout',
  manage_cms_builder:   'permLabelManageCmsBuilder',
  manage_layout:        'permLabelManageLayout',
  manage_theme:         'permLabelManageTheme',
  manage_settings:      'permLabelManageSettings',
  manage_permissions:   'permLabelManagePermissions',
  view_audit_logs:      'permLabelViewAuditLogs',
  manage_campaigns:     'permLabelManageCampaigns',
};

const PERM_DESC_KEYS: Record<string, keyof Translations> = {
  view_dashboard:       'permDescViewDashboard',
  manage_analytics:     'permDescManageAnalytics',
  manage_products:      'permDescManageProducts',
  manage_categories:    'permDescManageCategories',
  manage_orders:        'permDescManageOrders',
  manage_customers:     'permDescManageCustomers',
  manage_loyalty:       'permDescManageLoyalty',
  manage_notifications: 'permDescManageNotifications',
  manage_employees:     'permDescManageEmployees',
  manage_reviews:       'permDescManageReviews',
  manage_coupons:       'permDescManageCoupons',
  manage_shipping:      'permDescManageShipping',
  manage_sections:      'permDescManageSections',
  manage_cms:           'permDescManageCms',
  manage_about:         'permDescManageAbout',
  manage_cms_builder:   'permDescManageCmsBuilder',
  manage_layout:        'permDescManageLayout',
  manage_theme:         'permDescManageTheme',
  manage_settings:      'permDescManageSettings',
  manage_permissions:   'permDescManagePermissions',
  view_audit_logs:      'permDescViewAuditLogs',
  manage_campaigns:     'permDescManageCampaigns',
};

const ROLE_LABEL_KEYS: Record<string, keyof Translations> = {
  super_admin:      'roleSuperAdmin',
  admin:            'roleAdmin',
  employee:         'roleEmployee',
  product_manager:  'roleProductManager',
  order_manager:    'roleOrderManager',
  customer_support: 'roleCustomerSupport',
  content_editor:   'roleContentEditor',
};

const SECTION_LABEL_KEYS: Record<string, keyof Translations> = {
  general:   'permGeneral',
  catalog:   'permCatalog',
  sales:     'permSales',
  content:   'permContent',
  admin:     'permAdmin',
  marketing: 'permMarketing',
};

function getPermLabel(t: Translations, key: string, fallback: string): string {
  const tKey = PERM_LABEL_KEYS[key];
  if (tKey && t[tKey]) return t[tKey] as string;
  return fallback;
}

function getPermDesc(t: Translations, key: string, fallback: string): string {
  const tKey = PERM_DESC_KEYS[key];
  if (tKey && t[tKey]) return t[tKey] as string;
  return fallback;
}

function getRoleLabel(t: Translations, key: string): string {
  const tKey = ROLE_LABEL_KEYS[key];
  if (tKey && t[tKey]) return t[tKey] as string;
  return key.replace(/_/g, ' ');
}

function getSectionLabel(t: Translations, section: string): string {
  const tKey = SECTION_LABEL_KEYS[section];
  if (tKey && t[tKey]) return t[tKey] as string;
  return section.charAt(0).toUpperCase() + section.slice(1);
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

function PermissionsScreen() {
  const { isMobile } = useAdminLayout();
  const { t, isRTL } = useLanguage();
  const { guard: guardAction } = useActionPermission('manage_permissions');
  const [tab, setTab] = useState<Tab>('roles');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePermMap, setRolePermMap] = useState<Record<string, Set<string>>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [permsRes, rolesRes, rolePermsRes, empRes] = await Promise.all([
      supabase.from('permissions').select('key, label, description, section').order('section').order('key'),
      supabase.from('roles').select('key, label').order('key'),
      supabase.from('role_permissions').select('role_key, permission_key'),
      supabase.from('employees').select('id, full_name, email, role, is_active, custom_permissions').eq('is_active', true).order('full_name'),
    ]);

    setPermissions(permsRes.data ?? []);
    setRoles((rolesRes.data ?? []).filter((r: Role) => !LOCKED_ROLES.has(r.key)));

    const map: Record<string, Set<string>> = {};
    for (const row of (rolePermsRes.data ?? []) as { role_key: string; permission_key: string }[]) {
      if (!map[row.role_key]) map[row.role_key] = new Set();
      map[row.role_key].add(row.permission_key);
    }
    setRolePermMap(map);
    setEmployees(empRes.data ?? []);
    setLoading(false);
  };

  const toggleRolePerm = (roleKey: string, permKey: string) => {
    setRolePermMap((prev) => {
      const next = { ...prev };
      const set = new Set(next[roleKey] ?? []);
      if (set.has(permKey)) set.delete(permKey);
      else set.add(permKey);
      next[roleKey] = set;
      return next;
    });
  };

  const saveRolePerms = useCallback(async (roleKey: string) => {
    if (!guardAction()) { showToast('Permission denied: manage_permissions required', 'error'); return; }
    setSaving(roleKey);
    const perms = Array.from(rolePermMap[roleKey] ?? []);
    const { error } = await adminSupabase().rpc('update_role_permissions', {
      p_role_key: roleKey,
      p_permissions: perms,
    });

    if (error) showToast((t.saveFailed ?? 'Failed to save') + ': ' + error.message, 'error');
    else showToast((t.saveRolePermissions ?? 'Saved') + ' — ' + getRoleLabel(t, roleKey));
    setSaving(null);
  }, [rolePermMap, guardAction, t]);

  const toggleEmployeeCustom = (emp: Employee, permKey: string) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== emp.id) return e;
        const base = e.custom_permissions ?? Array.from(rolePermMap[e.role] ?? []);
        const set = new Set(base);
        if (set.has(permKey)) set.delete(permKey);
        else set.add(permKey);
        return { ...e, custom_permissions: Array.from(set) };
      })
    );
  };

  const saveEmployeePerms = useCallback(async (emp: Employee) => {
    if (!guardAction()) { showToast('Permission denied: manage_permissions required', 'error'); return; }
    setSaving(emp.id);
    const perms = emp.custom_permissions ?? Array.from(rolePermMap[emp.role] ?? []);
    const { error } = await adminSupabase().rpc('update_employee_permissions', {
      p_email: emp.email,
      p_permissions: perms,
    });

    if (error) showToast((t.saveFailed ?? 'Failed to save') + ': ' + error.message, 'error');
    else showToast((t.savePermissions ?? 'Saved') + ' — ' + emp.full_name);
    setSaving(null);
  }, [rolePermMap, guardAction, t]);

  const resetEmployeeToRole = (emp: Employee) => {
    setEmployees((prev) =>
      prev.map((e) => e.id === emp.id ? { ...e, custom_permissions: null } : e)
    );
  };

  const sectionedPerms = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.section]) acc[p.section] = [];
    acc[p.section].push(p);
    return acc;
  }, {});

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.permissions} showBack>
        <MobileUnsupported featureName={t.permissions} />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.permissions}>
      <View style={[styles.container, isRTL && styles.containerRtl]}>
        {/* Tab bar */}
        <View style={[styles.tabBar, isRTL && styles.tabBarRtl]}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'roles' && styles.tabBtnActive]}
            onPress={() => setTab('roles')}
            activeOpacity={0.7}
          >
            <ShieldAlert size={16} color={tab === 'roles' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.tabLabel, tab === 'roles' && styles.tabLabelActive]}>{t.roleDefaults}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'employees' && styles.tabBtnActive]}
            onPress={() => setTab('employees')}
            activeOpacity={0.7}
          >
            <Users size={16} color={tab === 'employees' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.tabLabel, tab === 'employees' && styles.tabLabelActive]}>{t.employeeOverrides}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.neonBlue} size="large" />
          </View>
        ) : tab === 'roles' ? (
          <RolesTab
            roles={roles}
            rolePermMap={rolePermMap}
            sectionedPerms={sectionedPerms}
            expandedRole={expandedRole}
            setExpandedRole={setExpandedRole}
            toggleRolePerm={toggleRolePerm}
            saveRolePerms={saveRolePerms}
            saving={saving}
            isRTL={isRTL}
          />
        ) : (
          <EmployeesTab
            employees={employees}
            rolePermMap={rolePermMap}
            sectionedPerms={sectionedPerms}
            expandedEmployee={expandedEmployee}
            setExpandedEmployee={setExpandedEmployee}
            toggleEmployeeCustom={toggleEmployeeCustom}
            saveEmployeePerms={saveEmployeePerms}
            resetEmployeeToRole={resetEmployeeToRole}
            saving={saving}
            isRTL={isRTL}
          />
        )}
      </View>

      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type} />
    </AdminWebDashboard>
  );
}

// ─── Roles Tab ────────────────────────────────────────────────────────────────

type RolesTabProps = {
  roles: Role[];
  rolePermMap: Record<string, Set<string>>;
  sectionedPerms: Record<string, Permission[]>;
  expandedRole: string | null;
  setExpandedRole: (key: string | null) => void;
  toggleRolePerm: (roleKey: string, permKey: string) => void;
  saveRolePerms: (roleKey: string) => void;
  saving: string | null;
  isRTL: boolean;
};

function RolesTab({ roles, rolePermMap, sectionedPerms, expandedRole, setExpandedRole, toggleRolePerm, saveRolePerms, saving, isRTL }: RolesTabProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.tabContent}>
      <View style={[styles.infoBox, isRTL && styles.infoBoxRtl]}>
        <AlertCircle size={14} color={Colors.warning} strokeWidth={2} />
        <Text style={[styles.infoText, isRTL && styles.textRtl]}>{t.roleDefaultsInfo}</Text>
      </View>

      {roles.map((role) => {
        const perms = rolePermMap[role.key] ?? new Set<string>();
        const totalPerms = Object.values(sectionedPerms).flat().length;
        const isExpanded = expandedRole === role.key;
        const isSaving = saving === role.key;
        const localLabel = getRoleLabel(t, role.key);

        return (
          <View key={role.key} style={styles.card}>
            <TouchableOpacity
              style={[styles.cardHeader, isRTL && styles.rowRtl]}
              onPress={() => setExpandedRole(isExpanded ? null : role.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.cardHeaderLeft, isRTL && styles.rowRtl]}>
                <UserCog size={18} color={Colors.neonBlue} strokeWidth={2} />
                <View>
                  <Text style={[styles.cardTitle, isRTL && styles.textRtl]}>{localLabel}</Text>
                  <Text style={[styles.cardSubtitle, isRTL && styles.textRtl]}>{perms.size} / {totalPerms}</Text>
                </View>
              </View>
              <View style={[styles.cardHeaderRight, isRTL && styles.rowRtl]}>
                <View style={styles.permCountBadge}>
                  <Text style={styles.permCountText}>{perms.size}</Text>
                </View>
                {isExpanded
                  ? <ChevronDown size={18} color={Colors.textMuted} strokeWidth={2} />
                  : <ChevronRight size={18} color={Colors.textMuted} strokeWidth={2} />
                }
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.cardBody}>
                {Object.entries(sectionedPerms).map(([section, sectionPerms]) => (
                  <View key={section} style={styles.section}>
                    <View style={[
                      styles.sectionHeader,
                      isRTL ? { borderRightWidth: 3, borderRightColor: SECTION_COLORS[section] ?? Colors.textMuted, borderLeftWidth: 0, paddingRight: Spacing.sm, paddingLeft: 0 }
                             : { borderLeftColor: SECTION_COLORS[section] ?? Colors.textMuted }
                    ]}>
                      <Text style={[styles.sectionTitle, isRTL && styles.textRtl]}>
                        {getSectionLabel(t, section)}
                      </Text>
                    </View>
                    {sectionPerms.map((perm) => {
                      const label = getPermLabel(t, perm.key, perm.label);
                      const desc = getPermDesc(t, perm.key, perm.description);
                      return (
                        <View key={perm.key} style={[styles.permRow, isRTL && styles.rowRtl]}>
                          <View style={styles.permInfo}>
                            <Text style={[styles.permLabel, isRTL && styles.textRtl]}>{label}</Text>
                            <Text style={[styles.permDesc, isRTL && styles.textRtl]}>{desc}</Text>
                          </View>
                          <Switch
                            value={perms.has(perm.key)}
                            onValueChange={() => toggleRolePerm(role.key, perm.key)}
                            trackColor={{ false: Colors.backgroundCard, true: Colors.neonBlueGlow }}
                            thumbColor={perms.has(perm.key) ? Colors.neonBlue : Colors.textMuted}
                          />
                        </View>
                      );
                    })}
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                  onPress={() => saveRolePerms(role.key)}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  {isSaving
                    ? <ActivityIndicator size="small" color={Colors.background} />
                    : <CheckCircle size={16} color={Colors.background} strokeWidth={2} />
                  }
                  <Text style={styles.saveBtnText}>{isSaving ? t.saving : t.saveRolePermissions}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

type EmployeesTabProps = {
  employees: Employee[];
  rolePermMap: Record<string, Set<string>>;
  sectionedPerms: Record<string, Permission[]>;
  expandedEmployee: string | null;
  setExpandedEmployee: (id: string | null) => void;
  toggleEmployeeCustom: (emp: Employee, permKey: string) => void;
  saveEmployeePerms: (emp: Employee) => void;
  resetEmployeeToRole: (emp: Employee) => void;
  saving: string | null;
  isRTL: boolean;
};

function EmployeesTab({ employees, rolePermMap, sectionedPerms, expandedEmployee, setExpandedEmployee, toggleEmployeeCustom, saveEmployeePerms, resetEmployeeToRole, saving, isRTL }: EmployeesTabProps) {
  const { t } = useLanguage();
  const editableEmployees = employees.filter((e) => !LOCKED_ROLES.has(e.role));

  return (
    <View style={styles.tabContent}>
      <View style={[styles.infoBox, isRTL && styles.infoBoxRtl]}>
        <AlertCircle size={14} color={Colors.warning} strokeWidth={2} />
        <Text style={[styles.infoText, isRTL && styles.textRtl]}>{t.employeeOverridesInfo}</Text>
      </View>

      {editableEmployees.length === 0 && (
        <View style={styles.emptyState}>
          <Users size={40} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyText}>{t.noEmployeesFound}</Text>
        </View>
      )}

      {editableEmployees.map((emp) => {
        const hasCustom = emp.custom_permissions !== null;
        const effectivePerms = new Set(emp.custom_permissions ?? Array.from(rolePermMap[emp.role] ?? []));
        const isExpanded = expandedEmployee === emp.id;
        const isSaving = saving === emp.id;
        const totalPerms = Object.values(sectionedPerms).flat().length;
        const roleLocalLabel = getRoleLabel(t, emp.role);

        return (
          <View key={emp.id} style={styles.card}>
            <TouchableOpacity
              style={[styles.cardHeader, isRTL && styles.rowRtl]}
              onPress={() => setExpandedEmployee(isExpanded ? null : emp.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.cardHeaderLeft, isRTL && styles.rowRtl]}>
                <View style={styles.empAvatar}>
                  <Text style={styles.empAvatarText}>{emp.full_name[0].toUpperCase()}</Text>
                </View>
                <View>
                  <View style={[styles.empNameRow, isRTL && styles.rowRtl]}>
                    <Text style={[styles.cardTitle, isRTL && styles.textRtl]}>{emp.full_name}</Text>
                    {hasCustom && (
                      <View style={styles.customBadge}>
                        <Text style={styles.customBadgeText}>{t.customBadge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.cardSubtitle, isRTL && styles.textRtl]}>
                    {roleLocalLabel} · {effectivePerms.size}/{totalPerms}
                  </Text>
                </View>
              </View>
              <View style={[styles.cardHeaderRight, isRTL && styles.rowRtl]}>
                <View style={styles.permCountBadge}>
                  <Text style={styles.permCountText}>{effectivePerms.size}</Text>
                </View>
                {isExpanded
                  ? <ChevronDown size={18} color={Colors.textMuted} strokeWidth={2} />
                  : <ChevronRight size={18} color={Colors.textMuted} strokeWidth={2} />
                }
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.cardBody}>
                {!hasCustom && (
                  <View style={[styles.roleDefaultNotice, isRTL && styles.infoBoxRtl]}>
                    <Text style={[styles.roleDefaultText, isRTL && styles.textRtl]}>
                      {t.roleDefaultNotice}
                    </Text>
                  </View>
                )}

                {Object.entries(sectionedPerms).map(([section, sectionPerms]) => (
                  <View key={section} style={styles.section}>
                    <View style={[
                      styles.sectionHeader,
                      isRTL ? { borderRightWidth: 3, borderRightColor: SECTION_COLORS[section] ?? Colors.textMuted, borderLeftWidth: 0, paddingRight: Spacing.sm, paddingLeft: 0 }
                             : { borderLeftColor: SECTION_COLORS[section] ?? Colors.textMuted }
                    ]}>
                      <Text style={[styles.sectionTitle, isRTL && styles.textRtl]}>
                        {getSectionLabel(t, section)}
                      </Text>
                    </View>
                    {sectionPerms.map((perm) => {
                      const label = getPermLabel(t, perm.key, perm.label);
                      const desc = getPermDesc(t, perm.key, perm.description);
                      return (
                        <View key={perm.key} style={[styles.permRow, isRTL && styles.rowRtl]}>
                          <View style={styles.permInfo}>
                            <Text style={[styles.permLabel, isRTL && styles.textRtl]}>{label}</Text>
                            <Text style={[styles.permDesc, isRTL && styles.textRtl]}>{desc}</Text>
                          </View>
                          <Switch
                            value={effectivePerms.has(perm.key)}
                            onValueChange={() => toggleEmployeeCustom(emp, perm.key)}
                            trackColor={{ false: Colors.backgroundCard, true: Colors.neonBlueGlow }}
                            thumbColor={effectivePerms.has(perm.key) ? Colors.neonBlue : Colors.textMuted}
                          />
                        </View>
                      );
                    })}
                  </View>
                ))}

                <View style={[styles.actionRow, isRTL && styles.rowRtl]}>
                  {hasCustom && (
                    <TouchableOpacity
                      style={styles.resetBtn}
                      onPress={() => resetEmployeeToRole(emp)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.resetBtnText}>{t.resetToRole}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.saveBtn, styles.saveBtnFlex, isSaving && styles.saveBtnDisabled]}
                    onPress={() => saveEmployeePerms(emp)}
                    disabled={isSaving}
                    activeOpacity={0.8}
                  >
                    {isSaving
                      ? <ActivityIndicator size="small" color={Colors.background} />
                      : <CheckCircle size={16} color={Colors.background} strokeWidth={2} />
                    }
                    <Text style={styles.saveBtnText}>{isSaving ? t.saving : t.savePermissions}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Guard wrapper ────────────────────────────────────────────────────────────

export default function PermissionsScreenGuarded() {
  return (
    <AdminGuard permission="manage_permissions">
      <PermissionsScreen />
    </AdminGuard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
  },
  containerRtl: {
    direction: 'rtl' as any,
  },
  tabBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.lg,
    padding: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBarRtl: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  textRtl: {
    textAlign: 'right',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.md,
  },
  tabBtnActive: {
    backgroundColor: Colors.neonBlueGlow,
  },
  tabLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: Colors.neonBlue,
  },
  tabContent: {
    gap: Spacing.md,
  },
  loadingWrap: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,180,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,0,0.2)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  infoBoxRtl: {
    flexDirection: 'row-reverse',
  },
  infoText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  permCountBadge: {
    minWidth: 28,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  permCountText: {
    color: Colors.neonBlue,
    fontSize: 11,
    fontWeight: '800',
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  section: {
    gap: 2,
  },
  sectionHeader: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  permInfo: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  permLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  permDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.neonBlue,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  saveBtnFlex: {
    flex: 1,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  empAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.neonBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  empNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,200,150,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,150,0.3)',
  },
  customBadgeText: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '700',
  },
  roleDefaultNotice: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleDefaultText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  resetBtn: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
});
