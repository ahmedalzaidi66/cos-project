import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Pencil, Trash2, Search, X, UserCog, Calendar, Eye, EyeOff, Lock } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import MobileUnsupported from '@/components/admin/MobileUnsupported';
import Toast from '@/components/admin/Toast';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { supabase, adminSupabase, getAdminToken, Employee, EMPLOYEE_ROLES, EMPLOYEE_PERMISSIONS } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  role: 'admin',
  permissions: [] as string[],
  is_active: true,
  join_date: new Date().toISOString().split('T')[0],
  password: '',
  confirm_password: '',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: Colors.gold,
  admin: Colors.neonBlue,
  product_manager: Colors.success,
  order_manager: Colors.warning,
  customer_support: '#7C83FF',
  content_editor: '#FF6B9D',
};

// Calls the manage-employee-auth edge function with the current admin session token
async function callEmployeeAuthFn(
  action: 'create' | 'update_password' | 'delete',
  payload: Record<string, string>
): Promise<{ data?: Record<string, string>; error?: string }> {
  const token = getAdminToken();
  if (!token) return { error: 'Not authenticated as admin' };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-employee-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-admin-token': token,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Request failed' };
    return { data: json };
  } catch (e: any) {
    return { error: e?.message ?? 'Network error' };
  }
}

function EmployeesScreen() {
  const { isMobile } = useAdminLayout();
  const { isAdminAuthenticated } = useAdmin();
  const { t } = useLanguage();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!isAdminAuthenticated) { router.replace('/admin/login'); return; }
    fetchEmployees();
  }, [isAdminAuthenticated]);

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
    setEmployees(data ?? []);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingEmployee(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setShowConfirm(false);
    setChangePassword(false);
    setError('');
    setModalVisible(true);
  };

  const openEdit = (e: Employee) => {
    setEditingEmployee(e);
    setForm({
      full_name: e.full_name,
      email: e.email,
      phone: e.phone ?? '',
      role: e.role,
      permissions: e.permissions ?? [],
      is_active: e.is_active,
      join_date: e.join_date ?? new Date().toISOString().split('T')[0],
      password: '',
      confirm_password: '',
    });
    setShowPassword(false);
    setShowConfirm(false);
    setChangePassword(false);
    setError('');
    setModalVisible(true);
  };

  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const validate = (): string | null => {
    if (!form.full_name.trim()) return 'Full name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.';
    if (!editingEmployee) {
      if (!form.password) return 'Password is required.';
      if (form.password.length < 6) return 'Password must be at least 6 characters.';
      if (form.password !== form.confirm_password) return 'Passwords do not match.';
    } else if (changePassword) {
      if (!form.password) return 'Enter a new password or cancel the password change.';
      if (form.password.length < 6) return 'Password must be at least 6 characters.';
      if (form.password !== form.confirm_password) return 'Passwords do not match.';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError('');
    setSaving(true);

    const emailLower = form.email.trim().toLowerCase();
    const payload = {
      full_name: form.full_name.trim(),
      email: emailLower,
      phone: form.phone.trim(),
      role: form.role,
      permissions: form.permissions,
      is_active: form.is_active,
      join_date: form.join_date || null,
      updated_at: new Date().toISOString(),
    };

    const db = adminSupabase();

    if (editingEmployee) {
      // 1. Update employee record (name, phone, role, permissions, status, etc.)
      const { error: updateErr } = await db
        .from('employees')
        .update(payload)
        .eq('id', editingEmployee.id);

      if (updateErr) {
        setError('Failed to update employee: ' + updateErr.message);
        setSaving(false);
        return;
      }

      // 2. Update password only if the change-password section was opened and filled
      if (changePassword && form.password) {
        if (!editingEmployee.auth_user_id) {
          // Employee has no linked auth account — warn but don't block
          setSaving(false);
          setModalVisible(false);
          await fetchEmployees();
          showToast('Profile updated. Password not changed — this employee has no linked login account.', 'error');
          return;
        }

        const { error: pwErr } = await callEmployeeAuthFn('update_password', {
          auth_user_id: editingEmployee.auth_user_id,
          password: form.password,
        });

        if (pwErr) {
          setSaving(false);
          setModalVisible(false);
          await fetchEmployees();
          showToast('Profile updated but password change failed: ' + pwErr, 'error');
          return;
        }
      }

      setSaving(false);
      setModalVisible(false);
      await fetchEmployees();
      const pwMsg = changePassword && form.password ? ' and password changed' : '';
      showToast('Employee updated' + pwMsg);
    } else {
      // Create Supabase Auth account first
      const { data: authData, error: authErr } = await callEmployeeAuthFn('create', {
        email: emailLower,
        password: form.password,
        full_name: form.full_name.trim(),
      });

      if (authErr) {
        setError(authErr);
        setSaving(false);
        return;
      }

      const { error: insertErr } = await db.from('employees').insert({
        ...payload,
        auth_user_id: authData?.auth_user_id ?? null,
        password_hash: null,
      });

      if (insertErr) {
        setError('Auth account created but employee record failed: ' + insertErr.message);
        setSaving(false);
        return;
      }

      setSaving(false);
      setModalVisible(false);
      await fetchEmployees();
      showToast('Employee created — they can now log in with their email and password');
    }
  };

  const handleDelete = async (id: string) => {
    const emp = employees.find((e) => e.id === id);
    await adminSupabase().from('employees').delete().eq('id', id);

    // Also delete the Supabase Auth account if linked
    if (emp?.auth_user_id) {
      await callEmployeeAuthFn('delete', { auth_user_id: emp.auth_user_id });
    }

    setDeleteId(null);
    await fetchEmployees();
    showToast(t.deleted ?? 'Employee removed');
  };

  const filtered = employees.filter((e) =>
    search.trim() === '' ||
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase())
  );

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.employees} showBack>
        <MobileUnsupported featureName="Employee Management" />
      </AdminMobileDashboard>
    );
  }

  if (loading) {
    return (
      <AdminWebDashboard title={t.employees}>
        <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 60 }} />
      </AdminWebDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.employees}>
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchEmployees}
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Plus size={16} color={Colors.background} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>{t.addEmployee}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.countText}>{filtered.length} {t.employeesCount}</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>{t.employees}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colRole}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colHireDate}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colStatus}</Text>
          <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>{t.colActions}</Text>
        </View>

        {filtered.map((emp) => {
          const roleLabel = EMPLOYEE_ROLES.find((r) => r.value === emp.role)?.label ?? emp.role;
          const roleColor = ROLE_COLORS[emp.role] ?? Colors.textMuted;
          return (
            <View key={emp.id} style={styles.tableRow}>
              <View style={[styles.avatarRow, { flex: 2 }]}>
                <View style={[styles.avatar, { backgroundColor: roleColor }]}>
                  <Text style={styles.avatarText}>{emp.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.empName} numberOfLines={1}>{emp.full_name}</Text>
                    {emp.auth_user_id && (
                      <View style={styles.authBadge}>
                        <Text style={styles.authBadgeText}>{t.authBadge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.empEmail} numberOfLines={1}>{emp.email}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.roleBadge, { borderColor: roleColor + '44', backgroundColor: roleColor + '18' }]}>
                  <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.joinDate}>
                  {emp.join_date ? new Date(emp.join_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.statusDot, { backgroundColor: emp.is_active ? Colors.success + '22' : Colors.error + '22', borderColor: emp.is_active ? Colors.success + '44' : Colors.error + '44' }]}>
                  <View style={[styles.dot, { backgroundColor: emp.is_active ? Colors.success : Colors.error }]} />
                  <Text style={[styles.statusText, { color: emp.is_active ? Colors.success : Colors.error }]}>{emp.is_active ? t.activeEmployee : t.inactive}</Text>
                </View>
              </View>
              <View style={[styles.actions, { width: 100 }]}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(emp)} activeOpacity={0.7}>
                  <Pencil size={14} color={Colors.neonBlue} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteId(emp.id)} activeOpacity={0.7}>
                  <Trash2 size={14} color={Colors.error} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <UserCog size={48} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{t.noEmployeesYet}</Text>
            <Text style={styles.emptySubtitle}>{t.addFirstEmployee}</Text>
          </View>
        )}
      </View>

      {/* Add / Edit modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingEmployee ? t.editEmployee : t.addEmployee}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <FieldLabel label={t.fullName + ' *'} />
              <TextInput style={styles.input} value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} placeholder="Jane Doe" placeholderTextColor={Colors.textMuted} />

              <FieldLabel label={t.email + ' *'} />
              <TextInput
                style={[styles.input, !!editingEmployee && styles.inputDisabled]}
                value={form.email}
                onChangeText={(v) => setForm({ ...form, email: v })}
                placeholder="jane@example.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!editingEmployee}
              />
              {editingEmployee && (
                <Text style={styles.hintText}>{t.emailCannotChange}</Text>
              )}

              <FieldLabel label={t.phone} />
              <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="+1 (555) 000-0000" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />

              <FieldLabel label={t.hireDate} />
              <View style={styles.inputRow}>
                <Calendar size={16} color={Colors.textMuted} strokeWidth={2} />
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent' }]}
                  value={form.join_date}
                  onChangeText={(v) => setForm({ ...form, join_date: v })}
                  placeholder={t.datePlaceholder}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Password section */}
              {editingEmployee ? (
                <>
                  <TouchableOpacity
                    style={[styles.sectionDivider, styles.sectionDividerBtn]}
                    onPress={() => {
                      setChangePassword((v) => !v);
                      setForm((f) => ({ ...f, password: '', confirm_password: '' }));
                      setShowPassword(false);
                      setShowConfirm(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Lock size={13} color={changePassword ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
                    <Text style={[styles.sectionTitle, changePassword && { color: Colors.neonBlue }]}>
                      {changePassword ? t.cancelPwdChange : t.changePwd}
                    </Text>
                  </TouchableOpacity>

                  {changePassword && (
                    <>
                      <FieldLabel label={t.newPassword} />
                      <View style={styles.passwordRow}>
                        <TextInput
                          style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent' }]}
                          value={form.password}
                          onChangeText={(v) => setForm({ ...form, password: v })}
                          placeholder="Min. 6 characters"
                          placeholderTextColor={Colors.textMuted}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoFocus
                        />
                        <TouchableOpacity onPress={() => setShowPassword((p) => !p)} style={styles.eyeBtn}>
                          {showPassword ? <EyeOff size={16} color={Colors.textMuted} strokeWidth={2} /> : <Eye size={16} color={Colors.textMuted} strokeWidth={2} />}
                        </TouchableOpacity>
                      </View>

                      <FieldLabel label={t.confirmNewPassword} />
                      <View style={styles.passwordRow}>
                        <TextInput
                          style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent' }]}
                          value={form.confirm_password}
                          onChangeText={(v) => setForm({ ...form, confirm_password: v })}
                          placeholder={t.reenterNewPassword}
                          placeholderTextColor={Colors.textMuted}
                          secureTextEntry={!showConfirm}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TouchableOpacity onPress={() => setShowConfirm((p) => !p)} style={styles.eyeBtn}>
                          {showConfirm ? <EyeOff size={16} color={Colors.textMuted} strokeWidth={2} /> : <Eye size={16} color={Colors.textMuted} strokeWidth={2} />}
                        </TouchableOpacity>
                      </View>

                      {!editingEmployee?.auth_user_id && (
                        <Text style={styles.warnText}>
                          {t.noLinkedAccount}
                        </Text>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.sectionDivider}>
                    <Lock size={13} color={Colors.textMuted} strokeWidth={2} />
                    <Text style={styles.sectionTitle}>{t.loginPassword}</Text>
                  </View>

                  <FieldLabel label="Password" />
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent' }]}
                      value={form.password}
                      onChangeText={(v) => setForm({ ...form, password: v })}
                      placeholder="Min. 6 characters"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => setShowPassword((p) => !p)} style={styles.eyeBtn}>
                      {showPassword ? <EyeOff size={16} color={Colors.textMuted} strokeWidth={2} /> : <Eye size={16} color={Colors.textMuted} strokeWidth={2} />}
                    </TouchableOpacity>
                  </View>

                  <FieldLabel label="Confirm Password" />
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent' }]}
                      value={form.confirm_password}
                      onChangeText={(v) => setForm({ ...form, confirm_password: v })}
                      placeholder="Re-enter password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => setShowConfirm((p) => !p)} style={styles.eyeBtn}>
                      {showConfirm ? <EyeOff size={16} color={Colors.textMuted} strokeWidth={2} /> : <Eye size={16} color={Colors.textMuted} strokeWidth={2} />}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <FieldLabel label={t.role + ' *'} />
              <View style={styles.chipGrid}>
                {EMPLOYEE_ROLES.map((r) => {
                  const color = ROLE_COLORS[r.value] ?? Colors.neonBlue;
                  const active = form.role === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.chip, active && { backgroundColor: color + '22', borderColor: color + '66' }]}
                      onPress={() => setForm({ ...form, role: r.value })}
                    >
                      <Text style={[styles.chipText, active && { color }]}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <FieldLabel label={t.permissions ?? 'Permissions'} />
              <View style={styles.permissionsGrid}>
                {EMPLOYEE_PERMISSIONS.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.permChip, form.permissions.includes(p.value) && styles.permChipActive]}
                    onPress={() => togglePermission(p.value)}
                  >
                    <View style={[styles.checkbox, form.permissions.includes(p.value) && styles.checkboxActive]}>
                      {form.permissions.includes(p.value) && <View style={styles.checkboxInner} />}
                    </View>
                    <Text style={[styles.permChipText, form.permissions.includes(p.value) && styles.permChipTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t.activeEmployee}</Text>
                <Switch
                  value={form.is_active}
                  onValueChange={(v) => setForm({ ...form, is_active: v })}
                  trackColor={{ true: Colors.success, false: Colors.border }}
                  thumbColor={Colors.white}
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={Colors.background} size="small" />
                  : <Text style={styles.saveBtnText}>{editingEmployee ? t.editEmployee : t.addEmployee}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete confirm modal */}
      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <Text style={[styles.modalTitle, { padding: Spacing.lg }]}>{t.deleteEmployee}</Text>
            <Text style={[styles.errorText, { paddingHorizontal: Spacing.lg }]}>
              {t.cannotBeUndone}{'\n'}This will also delete the employee's login account.
            </Text>
            <View style={[styles.modalFooter, { borderTopWidth: 1, borderTopColor: Colors.border }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteId(null)}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.error }]} onPress={() => deleteId && handleDelete(deleteId)}>
                <Text style={styles.saveBtnText}>{t.delete}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type} />
    </AdminWebDashboard>
  );
}

export default function EmployeesScreenGuarded() {
  return (
    <AdminGuard permission="manage_employees">
      <EmployeesScreen />
    </AdminGuard>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.neonBlue, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44 },
  addBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },
  countText: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.sm, marginBottom: 2 },
  th: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, marginBottom: 4, borderWidth: 1, borderColor: Colors.border },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600' },
  authBadge: { paddingHorizontal: 5, paddingVertical: 1, backgroundColor: Colors.success + '22', borderRadius: 4, borderWidth: 1, borderColor: Colors.success + '44' },
  authBadgeText: { color: Colors.success, fontSize: 9, fontWeight: '700' },
  empEmail: { color: Colors.textMuted, fontSize: FontSize.xs },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  roleBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  joinDate: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '500' },
  statusDot: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  editBtn: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.neonBlueGlow, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.errorDim, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  modalCard: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xl, width: '100%', maxWidth: 560, maxHeight: '90%', borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  modalBody: { padding: Spacing.lg, maxHeight: 520 },
  modalFooter: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg },
  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary, fontSize: FontSize.md, marginBottom: 2 },
  inputDisabled: { opacity: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, marginBottom: 2 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, marginBottom: 2 },
  eyeBtn: { padding: 8 },
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.lg, marginBottom: 4, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  sectionDividerBtn: { borderRadius: Radius.sm, paddingVertical: 2 },
  sectionTitle: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  hintText: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 4, marginTop: 2 },
  warnText: { color: Colors.warning, fontSize: FontSize.xs, marginTop: 6, marginBottom: 2 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full },
  chipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  permissionsGrid: { gap: 8, marginBottom: 4 },
  permChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  permChipActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { borderColor: Colors.neonBlue },
  checkboxInner: { width: 9, height: 9, borderRadius: 2, backgroundColor: Colors.neonBlue },
  permChipText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600', flex: 1 },
  permChipTextActive: { color: Colors.neonBlue },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  switchLabel: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
  cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  saveBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.neonBlue, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '800' },
  errorText: { color: Colors.error, fontSize: FontSize.sm, marginBottom: Spacing.sm },
  white: { color: Colors.white },
});
