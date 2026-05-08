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
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import { Search, Star, CircleCheck as CheckCircle, X, Trash2, MessageSquare, Clock, CircleX as XCircle } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import { supabase, adminSupabase, Review } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_CONFIG = {
  pending: { color: Colors.warning, icon: Clock },
  approved: { color: Colors.success, icon: CheckCircle },
  rejected: { color: Colors.error, icon: XCircle },
};

function ReviewsScreen() {
  const { isAdminAuthenticated } = useAdmin();
  const { t } = useLanguage();
  const router = useRouter();
  const { isMobile } = useAdminLayout();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!isAdminAuthenticated) { router.replace('/admin/login'); return; }
    fetchReviews();
  }, [isAdminAuthenticated]);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
    setReviews(data ?? []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: Review['status']) => {
    const { error: err } = await adminSupabase().from('reviews').update({ status }).eq('id', id);
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    if (selectedReview?.id === id) {
      setSelectedReview((prev) => prev ? { ...prev, status } : null);
    }
    if (err) {
      showToast(t.reviewUpdateFailed, 'error');
    } else {
      showToast(status === 'approved' ? t.reviewApprovedMsg : t.reviewRejectedMsg);
    }
  };

  const handleDelete = async (id: string) => {
    await adminSupabase().from('reviews').delete().eq('id', id);
    setDeleteId(null);
    setSelectedReview(null);
    setReviews((prev) => prev.filter((r) => r.id !== id));
    showToast(t.reviewDeletedMsg);
  };

  const filtered = reviews.filter((r) => {
    const matchSearch = search.trim() === '' ||
      r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_email.toLowerCase().includes(search.toLowerCase()) ||
      r.body.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: reviews.length,
    pending: reviews.filter((r) => r.status === 'pending').length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
  };

  const Shell = isMobile ? AdminMobileDashboard : AdminWebDashboard;

  if (loading) {
    return (
      <Shell title={t.reviews}>
        <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 60 }} />
      </Shell>
    );
  }

  return (
    <Shell title={t.reviews}>
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchReviews}
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => {
            const cfg = s === 'all' ? null : STATUS_CONFIG[s];
            const active = statusFilter === s;
            const color = cfg?.color ?? Colors.neonBlue;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.filterBtn, active && { backgroundColor: color + '22', borderColor: color + '55' }]}
                onPress={() => setStatusFilter(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterBtnText, active && { color }]}>
                  {s === 'all' ? t.all : s === 'pending' ? t.reviewPending : s === 'approved' ? t.reviewApproved : t.reviewRejected} ({counts[s]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.countText}>{filtered.length} {filtered.length === 1 ? t.reviewCountSingular : t.reviewCountPlural}</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>{t.reviewerCol}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.rating}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colStatus}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colDate2}</Text>
          <Text style={[styles.th, { width: 120, textAlign: 'center' }]}>{t.colActions}</Text>
        </View>

        {filtered.map((review) => {
          const cfg = STATUS_CONFIG[review.status];
          return (
            <TouchableOpacity
              key={review.id}
              style={styles.tableRow}
              onPress={() => setSelectedReview(review)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 2 }}>
                <Text style={styles.customerName} numberOfLines={1}>{review.customer_name}</Text>
                <Text style={styles.customerEmail} numberOfLines={1}>{review.customer_email}</Text>
              </View>
              <View style={[styles.ratingRow, { flex: 1 }]}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={11}
                    color={i < review.rating ? Colors.gold : Colors.border}
                    fill={i < review.rating ? Colors.gold : 'transparent'}
                    strokeWidth={1.5}
                  />
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.statusBadge, { backgroundColor: cfg.color + '1A', borderColor: cfg.color + '44' }]}>
                  <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
                    {review.status === 'pending' ? t.reviewPending : review.status === 'approved' ? t.reviewApproved : t.reviewRejected}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateText}>
                  {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                </Text>
              </View>
              <View style={styles.actions}>
                {review.status !== 'approved' && (
                  <TouchableOpacity style={styles.approveBtn} onPress={(e) => { e.stopPropagation?.(); updateStatus(review.id, 'approved'); }} activeOpacity={0.7}>
                    <CheckCircle size={14} color={Colors.success} strokeWidth={2} />
                  </TouchableOpacity>
                )}
                {review.status !== 'rejected' && (
                  <TouchableOpacity style={styles.rejectBtn} onPress={(e) => { e.stopPropagation?.(); updateStatus(review.id, 'rejected'); }} activeOpacity={0.7}>
                    <XCircle size={14} color={Colors.error} strokeWidth={2} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.deleteBtn} onPress={(e) => { e.stopPropagation?.(); setDeleteId(review.id); }} activeOpacity={0.7}>
                  <Trash2 size={14} color={Colors.error} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <MessageSquare size={48} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{t.noReviewsYet}</Text>
            <Text style={styles.emptySubtitle}>{t.reviewsAppearWhenSubmitted}</Text>
          </View>
        )}
      </View>

      <Modal visible={!!selectedReview} transparent animationType="fade" onRequestClose={() => setSelectedReview(null)}>
        {selectedReview && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.reviewDetailsTitle}</Text>
                <TouchableOpacity onPress={() => setSelectedReview(null)}>
                  <X size={20} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                <View style={styles.reviewCustomerRow}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{selectedReview.customer_name?.[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewCustomerName}>{selectedReview.customer_name}</Text>
                    <Text style={styles.reviewCustomerEmail}>{selectedReview.customer_email}</Text>
                  </View>
                  <View style={styles.ratingRow}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} color={i < selectedReview.rating ? Colors.gold : Colors.border} fill={i < selectedReview.rating ? Colors.gold : 'transparent'} strokeWidth={1.5} />
                    ))}
                  </View>
                </View>

                <Text style={styles.reviewBody}>{selectedReview.body}</Text>

                <Text style={styles.reviewDate}>
                  {t.submitted} {new Date(selectedReview.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>

                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.success + '22', borderColor: Colors.success + '44' }, selectedReview.status === 'approved' && { opacity: 0.5 }]}
                    onPress={() => updateStatus(selectedReview.id, 'approved')}
                    disabled={selectedReview.status === 'approved'}
                    activeOpacity={0.7}
                  >
                    <CheckCircle size={15} color={Colors.success} strokeWidth={2} />
                    <Text style={[styles.actionBtnText, { color: Colors.success }]}>{t.approve}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.error + '22', borderColor: Colors.error + '44' }, selectedReview.status === 'rejected' && { opacity: 0.5 }]}
                    onPress={() => updateStatus(selectedReview.id, 'rejected')}
                    disabled={selectedReview.status === 'rejected'}
                    activeOpacity={0.7}
                  >
                    <XCircle size={15} color={Colors.error} strokeWidth={2} />
                    <Text style={[styles.actionBtnText, { color: Colors.error }]}>{t.reject}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.errorDim, borderColor: Colors.error + '33' }]}
                    onPress={() => setDeleteId(selectedReview.id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={15} color={Colors.error} strokeWidth={2} />
                    <Text style={[styles.actionBtnText, { color: Colors.error }]}>{t.delete}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <Text style={[styles.modalTitle, { padding: Spacing.lg }]}>{t.deleteReview}</Text>
            <Text style={[styles.errorText, { paddingHorizontal: Spacing.lg }]}>This action cannot be undone.</Text>
            <View style={styles.modalFooter}>
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
    </Shell>
  );
}

export default function ReviewsScreenGuarded() {
  return (
    <AdminGuard permission="manage_reviews">
      <ReviewsScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  filterBtnText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  countText: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.sm, marginBottom: 2 },
  th: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.md, backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, marginBottom: 4, borderWidth: 1, borderColor: Colors.border },
  customerName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600' },
  customerEmail: { color: Colors.textMuted, fontSize: FontSize.xs },
  ratingRow: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  dateText: { color: Colors.textMuted, fontSize: FontSize.xs },
  actions: { width: 120, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  approveBtn: { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.success + '18', justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.error + '12', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.errorDim, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.md, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  modalCard: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xl, width: '100%', maxWidth: 560, maxHeight: '90%', borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  modalBody: { padding: Spacing.lg, maxHeight: 500 },
  modalFooter: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg },
  reviewCustomerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neonBlue, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  reviewAvatarText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '800' },
  reviewCustomerName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  reviewCustomerEmail: { color: Colors.textMuted, fontSize: FontSize.sm },
  reviewBody: { color: Colors.textSecondary, fontSize: FontSize.md, lineHeight: 24, marginBottom: Spacing.md },
  reviewDate: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: Spacing.lg },
  actionButtonsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1 },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  saveBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.neonBlue, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '800' },
  errorText: { color: Colors.error, fontSize: FontSize.sm, marginBottom: Spacing.sm },
});
