import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import {
  Upload,
  X,
  Image as ImageIcon,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  Link,
  Undo2,
} from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { uploadImageToSupabase, validateImageFile, readFileAsDataUrl } from '@/lib/imageUpload';
import ImageEditorModal from '@/components/admin/ImageEditorModal';

export type UploadFolder = 'products' | 'branding' | 'cms' | 'general';

export type Props = {
  value: string;
  onChange: (url: string) => void;
  folder?: UploadFolder;
  label?: string;
  hint?: string;
  previewHeight?: number;
  previewWidth?: number | string;
  containMode?: boolean;
  allowUrl?: boolean;
  compact?: boolean;
  editorPreset?: string;
  /** Pass the previously saved URL so the editor can offer "Restore Original" */
  savedUrl?: string;
};

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

function MobileImagePreview({ value, label, hint }: Pick<Props, 'value' | 'label' | 'hint'>) {
  const [imgErr, setImgErr] = useState(false);
  const hasImage = !!value && !imgErr;
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {hasImage ? (
        <View style={{ borderRadius: Radius.md, overflow: 'hidden', marginBottom: 8, height: 120, backgroundColor: Colors.backgroundSecondary }}>
          <Image
            source={{ uri: value }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        </View>
      ) : (
        <View style={[styles.emptyState, { height: 80 }]}>
          <ImageIcon size={20} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptySub}>No image set</Text>
        </View>
      )}
      <View style={[styles.errorBanner, { backgroundColor: Colors.backgroundCard, borderColor: Colors.border }]}>
        <Text style={[styles.errorText, { color: Colors.textMuted }]}>
          Image upload is available on the web admin dashboard.
        </Text>
      </View>
    </View>
  );
}

export default function ImageUploader({
  value,
  onChange,
  folder = 'general',
  label,
  hint,
  previewHeight = 140,
  previewWidth = '100%',
  containMode = false,
  allowUrl = true,
  compact = false,
  editorPreset = 'product',
  savedUrl,
}: Props) {
  if (Platform.OS !== 'web') {
    return <MobileImagePreview value={value} label={label} hint={hint} />;
  }

  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [imgErr, setImgErr] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingDataUrl, setPendingDataUrl] = useState('');
  const [originalUrl] = useState(savedUrl ?? value);

  const handleFile = useCallback(async (file: File) => {
    const validErr = validateImageFile(file);
    if (validErr) {
      setStatus('error');
      setErrorMsg(validErr);
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setPendingFile(file);
    setPendingDataUrl(dataUrl);
    setEditorVisible(true);
  }, []);

  const handleEditorSave = useCallback(async (editedFile: File, previewDataUrl: string) => {
    setEditorVisible(false);
    setPendingFile(null);
    setPendingDataUrl('');
    setStatus('uploading');
    setErrorMsg('');
    setImgErr(false);

    const result = await uploadImageToSupabase(editedFile, folder);
    if (result.error) {
      setStatus('error');
      setErrorMsg(result.error);
      return;
    }
    onChange(result.url!);
    setStatus('success');
    setTimeout(() => setStatus('idle'), 3000);
  }, [folder, onChange]);

  const handleRestoreOriginal = useCallback(() => {
    if (!originalUrl) return;
    onChange(originalUrl);
    setImgErr(false);
    setStatus('idle');
    setErrorMsg('');
  }, [originalUrl, onChange]);

  const handleEditorCancel = useCallback(() => {
    setEditorVisible(false);
    setPendingFile(null);
    setPendingDataUrl('');
  }, []);

  const openFilePicker = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/svg+xml,image/gif';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [handleFile]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = dropZoneRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (!el.contains(e.relatedTarget as Node)) setIsDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    };
    const onMouseEnter = () => setIsHovered(true);
    const onMouseLeave = () => setIsHovered(false);

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    el.addEventListener('mouseenter', onMouseEnter);
    el.addEventListener('mouseleave', onMouseLeave);

    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragenter', onDragEnter);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('mouseenter', onMouseEnter);
      el.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [handleFile]);

  const handleUrlApply = () => {
    if (urlDraft.trim()) { onChange(urlDraft.trim()); setImgErr(false); }
    setShowUrlInput(false);
    setUrlDraft('');
  };

  const handleClear = () => {
    onChange('');
    setImgErr(false);
    setStatus('idle');
    setErrorMsg('');
    setDimensions(null);
  };

  const hasImage = !!value && !imgErr;

  const dropZoneStyle: any = {
    borderRadius: Radius.md,
    borderWidth: 2,
    borderStyle: isDragOver ? 'solid' : 'dashed',
    borderColor: isDragOver ? Colors.neonBlue : Colors.border,
    overflow: 'hidden',
    backgroundColor: isDragOver ? Colors.neonBlueGlow : Colors.backgroundSecondary,
    marginBottom: 8,
    position: 'relative',
    height: previewHeight,
    width: previewWidth,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: isDragOver ? `0 0 0 2px ${Colors.neonBlue}55, 0 0 24px ${Colors.neonBlue}22` : 'none',
  };

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      {hint && <Text style={styles.hint}>{hint}</Text>}

      <div
        ref={dropZoneRef}
        style={dropZoneStyle}
        onClick={hasImage ? undefined : openFilePicker}
      >
        {status === 'uploading' ? (
          <View style={styles.uploadingState}>
            <View style={styles.uploadingIconWrap}>
              <ActivityIndicator color={Colors.neonBlue} size="large" />
            </View>
            <Text style={styles.uploadingText}>Uploading…</Text>
            <Text style={styles.uploadingSub}>Please wait</Text>
          </View>
        ) : hasImage ? (
          <>
            <Image
              source={{ uri: value }}
              style={StyleSheet.absoluteFillObject}
              resizeMode={containMode ? 'contain' : 'cover'}
              onError={() => setImgErr(true)}
              onLoad={(e: any) => {
                const s = e.nativeEvent?.source;
                if (s?.width && s?.height) setDimensions({ w: s.width, h: s.height });
              }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(5,10,20,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                flexDirection: 'row' as any,
                opacity: (isHovered || isDragOver) ? 1 : 0,
                transition: 'opacity 0.18s ease',
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); openFilePicker(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,77,141,0.9)', border: 'none',
                  borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Replace
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,68,68,0.9)', border: 'none',
                  borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Remove
              </button>
            </div>
            {dimensions && (
              <View style={styles.dimensionBadge}>
                <Text style={styles.dimensionText}>{dimensions.w}×{dimensions.h}</Text>
              </View>
            )}
            {isDragOver && (
              <View style={styles.dropOverlay}>
                <Upload size={28} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={styles.dropOverlayText}>Drop to replace</Text>
              </View>
            )}
          </>
        ) : (
          <View style={[styles.emptyState, isDragOver && styles.emptyStateDragOver]}>
            <View style={[styles.uploadIconCircle, isDragOver && styles.uploadIconCircleActive]}>
              <Upload
                size={compact ? 16 : 22}
                color={isDragOver ? Colors.neonBlue : Colors.textMuted}
                strokeWidth={1.5}
              />
            </View>
            {!compact && (
              <>
                <Text style={[styles.emptyTitle, isDragOver && styles.emptyTitleActive]}>
                  {isDragOver ? 'Drop image here' : 'Upload Image'}
                </Text>
                <Text style={styles.emptySub}>
                  {isDragOver ? 'Release to upload' : 'Click to browse or drag & drop'}
                </Text>
                <View style={styles.editorBadge}>
                  <Text style={styles.editorBadgeText}>Opens image editor before saving</Text>
                </View>
              </>
            )}
            {compact && <Text style={styles.emptyCompact}>{isDragOver ? 'Drop here' : 'Click or drop'}</Text>}
          </View>
        )}
      </div>

      {status === 'success' && (
        <View style={styles.successBanner}>
          <CheckCircle size={13} color={Colors.success} strokeWidth={2.5} />
          <Text style={styles.successText}>Image uploaded successfully</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.errorBanner}>
          <AlertCircle size={13} color={Colors.error} strokeWidth={2.5} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => setStatus('idle')} style={styles.errorDismiss}>
            <X size={12} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, status === 'uploading' && styles.actionBtnDisabled]}
          onPress={openFilePicker}
          activeOpacity={0.7}
          disabled={status === 'uploading'}
        >
          <Upload size={12} color={Colors.neonBlue} strokeWidth={2.5} />
          <Text style={styles.actionBtnText}>{hasImage ? 'Replace' : 'Upload & Edit'}</Text>
        </TouchableOpacity>

        {allowUrl && (
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={() => { setShowUrlInput(v => !v); setUrlDraft(value ?? ''); }}
            activeOpacity={0.7}
          >
            <Link size={12} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.actionBtnSecondaryText}>Use URL</Text>
          </TouchableOpacity>
        )}

        {hasImage && (
          <TouchableOpacity style={styles.actionBtnDanger} onPress={handleClear} activeOpacity={0.7}>
            <X size={12} color={Colors.error} strokeWidth={2} />
            <Text style={styles.actionBtnDangerText}>Remove</Text>
          </TouchableOpacity>
        )}

        {originalUrl && value && originalUrl !== value && (
          <TouchableOpacity style={styles.actionBtnRestore} onPress={handleRestoreOriginal} activeOpacity={0.7}>
            <Undo2 size={12} color={Colors.warning} strokeWidth={2} />
            <Text style={styles.actionBtnRestoreText}>Restore Original</Text>
          </TouchableOpacity>
        )}
      </View>

      {showUrlInput && allowUrl && (
        <View style={styles.urlPanel}>
          <Text style={styles.urlPanelLabel}>Paste image URL</Text>
          <View style={styles.urlInputRow}>
            <ImageIcon size={13} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              style={styles.urlInput}
              value={urlDraft}
              onChangeText={setUrlDraft}
              placeholder="https://images.pexels.com/..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleUrlApply}
              autoFocus
            />
          </View>
          <View style={styles.urlBtnRow}>
            <TouchableOpacity style={styles.urlApplyBtn} onPress={handleUrlApply} activeOpacity={0.8}>
              <CheckCircle size={13} color={Colors.background} strokeWidth={2.5} />
              <Text style={styles.urlApplyText}>Apply URL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.urlCancelBtn} onPress={() => setShowUrlInput(false)} activeOpacity={0.7}>
              <Text style={styles.urlCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {editorVisible && pendingFile && (
        <ImageEditorModal
          visible={editorVisible}
          sourceDataUrl={pendingDataUrl}
          sourceFile={pendingFile}
          existingUrl={originalUrl || undefined}
          preset={editorPreset}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  hint: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 6, lineHeight: 16 },

  uploadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  uploadingIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1, borderColor: Colors.neonBlueBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  uploadingText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },
  uploadingSub: { color: Colors.textMuted, fontSize: FontSize.xs },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: Spacing.md },
  emptyStateDragOver: { gap: 10 },
  uploadIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  uploadIconCircleActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlue },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },
  emptyTitleActive: { color: Colors.neonBlue },
  emptySub: { color: Colors.textMuted, fontSize: FontSize.xs },
  editorBadge: {
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1, borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  editorBadgeText: { color: Colors.neonBlue, fontSize: 9, fontWeight: '700' },
  emptyCompact: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },

  dimensionBadge: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: 'rgba(5,10,20,0.75)',
    borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dimensionText: { color: Colors.textSecondary, fontSize: 9, fontWeight: '600' },

  dropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,77,141,0.12)',
    justifyContent: 'center', alignItems: 'center', gap: 8,
    borderWidth: 2, borderColor: Colors.neonBlue, borderRadius: Radius.md,
  },
  dropOverlayText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '800', letterSpacing: 0.5 },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,230,118,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.3)',
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8,
  },
  successText: { color: Colors.success, fontSize: FontSize.xs, fontWeight: '600' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.errorDim,
    borderWidth: 1, borderColor: Colors.error + '44',
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8,
  },
  errorText: { color: Colors.error, fontSize: FontSize.xs, flex: 1 },
  errorDismiss: { padding: 2 },

  actionRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1, borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '700' },
  actionBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7,
  },
  actionBtnSecondaryText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  actionBtnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.errorDim,
    borderWidth: 1, borderColor: Colors.error + '33',
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7,
  },
  actionBtnDangerText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '600' },
  actionBtnRestore: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,179,0,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)',
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7,
  },
  actionBtnRestoreText: { color: Colors.warning, fontSize: FontSize.xs, fontWeight: '600' },

  urlPanel: {
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.sm,
    marginTop: 2, marginBottom: 4, gap: 8,
  },
  urlPanelLabel: {
    color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  urlInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 8,
  },
  urlInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  urlBtnRow: { flexDirection: 'row', gap: 8 },
  urlApplyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.sm, paddingVertical: 9,
  },
  urlApplyText: { color: Colors.background, fontSize: FontSize.xs, fontWeight: '800' },
  urlCancelBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center',
  },
  urlCancelText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
});
