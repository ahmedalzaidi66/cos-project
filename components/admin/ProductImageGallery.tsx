import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Plus,
  X,
  Star,
  GripVertical,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
} from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { uploadImageToSupabase, validateImageFile, readFileAsDataUrl } from '@/lib/imageUpload';
import ImageEditorModal from '@/components/admin/ImageEditorModal';

type ImageItem = {
  id: string;
  url: string;
  isMain: boolean;
};

type Props = {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
};

type CardStatus = 'idle' | 'uploading' | 'error';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ProductImageGallery({ images, onChange }: Props) {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.mobileFallback}>
        <Text style={styles.mobileFallbackTitle}>Feature not available on mobile</Text>
        <Text style={styles.mobileFallbackText}>
          Image gallery management is available in the web admin dashboard.
        </Text>
      </View>
    );
  }
  const [cardStatus, setCardStatus] = useState<Record<string, CardStatus>>({});
  const [cardError, setCardError] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const addDropRef = useRef<HTMLDivElement | null>(null);
  const [addDragOver, setAddDragOver] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingDataUrl, setPendingDataUrl] = useState('');
  const [pendingReplaceId, setPendingReplaceId] = useState<string | undefined>(undefined);

  const showSuccess = () => {
    setGlobalSuccess(true);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setGlobalSuccess(false), 3000);
  };

  const openEditorForFile = useCallback(async (file: File, replaceId?: string) => {
    const validErr = validateImageFile(file);
    if (validErr) {
      if (replaceId) {
        setCardStatus(s => ({ ...s, [replaceId]: 'error' }));
        setCardError(e => ({ ...e, [replaceId]: validErr }));
      } else {
        setGlobalError(validErr);
      }
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setPendingFile(file);
    setPendingDataUrl(dataUrl);
    setPendingReplaceId(replaceId);
    setEditorVisible(true);
  }, []);

  const handleEditorSave = useCallback(async (editedFile: File, _previewDataUrl?: string) => {
    setEditorVisible(false);
    const replaceId = pendingReplaceId;
    setPendingFile(null);
    setPendingDataUrl('');
    setPendingReplaceId(undefined);

    const tempId = replaceId ?? generateId();
    setCardStatus(s => ({ ...s, [tempId]: 'uploading' }));
    setCardError(e => { const n = { ...e }; delete n[tempId]; return n; });
    setGlobalError('');

    const result = await uploadImageToSupabase(editedFile, 'products');

    if (result.error) {
      setCardStatus(s => ({ ...s, [tempId]: 'error' }));
      setCardError(e => ({ ...e, [tempId]: result.error! }));
      return;
    }

    setCardStatus(s => { const n = { ...s }; delete n[tempId]; return n; });

    if (replaceId) {
      onChange(images.map(img => img.id === replaceId ? { ...img, url: result.url! } : img));
    } else {
      const newImg: ImageItem = {
        id: tempId,
        url: result.url!,
        isMain: images.length === 0,
      };
      onChange([...images, newImg]);
    }

    showSuccess();
  }, [images, onChange, pendingReplaceId]);

  const handleEditorCancel = useCallback(() => {
    setEditorVisible(false);
    setPendingFile(null);
    setPendingDataUrl('');
    setPendingReplaceId(undefined);
  }, []);

  const openPickerForNew = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/svg+xml,image/gif';
    input.multiple = true;
    input.onchange = async (e: Event) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      for (const file of files) await openEditorForFile(file);
    };
    input.click();
  }, [openEditorForFile]);

  const openPickerForReplace = useCallback((id: string) => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/svg+xml,image/gif';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) openEditorForFile(file, id);
    };
    input.click();
  }, [openEditorForFile]);

  const setMainImage = (id: string) => {
    onChange(images.map(img => ({ ...img, isMain: img.id === id })));
  };

  const removeImage = (id: string) => {
    const next = images.filter(img => img.id !== id);
    if (next.length > 0 && !next.some(img => img.isMain)) {
      next[0].isMain = true;
    }
    onChange(next);
  };

  const moveImage = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIdx = images.findIndex(i => i.id === fromId);
    const toIdx = images.findIndex(i => i.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...images];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    onChange(next);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = addDropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setAddDragOver(true); };
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); setAddDragOver(true); };
    const onDragLeave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node)) setAddDragOver(false);
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setAddDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      for (const file of files) await openEditorForFile(file);
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragenter', onDragEnter);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [openEditorForFile]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.label}>Product Images</Text>
          {images.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{images.length}</Text>
            </View>
          )}
        </View>
        <Text style={styles.hint}>Drag cards to reorder. First card = main image. Editor opens before upload.</Text>
      </View>

      {globalSuccess && (
        <View style={styles.successBanner}>
          <CheckCircle size={13} color={Colors.success} strokeWidth={2.5} />
          <Text style={styles.successText}>Image uploaded successfully</Text>
        </View>
      )}

      {globalError !== '' && (
        <View style={styles.errorBanner}>
          <AlertCircle size={13} color={Colors.error} strokeWidth={2.5} />
          <Text style={styles.errorText}>{globalError}</Text>
          <TouchableOpacity onPress={() => setGlobalError('')} style={styles.errorDismiss}>
            <X size={12} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
        {images.map((img, idx) => (
          <ImageCard
            key={img.id}
            img={img}
            index={idx}
            status={cardStatus[img.id] ?? 'idle'}
            error={cardError[img.id]}
            isHovered={hoveredId === img.id}
            isDraggedOver={dragOverId === img.id}
            onHover={(id) => setHoveredId(id)}
            onSetMain={() => setMainImage(img.id)}
            onReplace={() => openPickerForReplace(img.id)}
            onRemove={() => removeImage(img.id)}
            onDragStart={() => setDraggedId(img.id)}
            onDragOver={() => setDragOverId(img.id)}
            onDragEnd={() => {
              if (draggedId && dragOverId && draggedId !== dragOverId) {
                moveImage(draggedId, dragOverId);
              }
              setDraggedId(null);
              setDragOverId(null);
            }}
          />
        ))}

        <div
          ref={addDropRef}
          style={{
            width: 120,
            height: 120,
            borderRadius: Radius.md,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: addDragOver ? Colors.neonBlue : Colors.border,
            backgroundColor: addDragOver ? Colors.neonBlueGlow : Colors.backgroundSecondary,
            display: 'flex',
            flexDirection: 'column' as any,
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            gap: 6,
            transition: 'all 0.15s ease',
            boxShadow: addDragOver ? `0 0 0 2px ${Colors.neonBlue}55` : 'none',
          }}
          onClick={openPickerForNew}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: addDragOver ? Colors.neonBlueGlow : Colors.backgroundCard,
            borderWidth: 1, borderStyle: 'solid',
            borderColor: addDragOver ? Colors.neonBlue : Colors.border,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Plus size={18} color={addDragOver ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
          </div>
          <span style={{ color: addDragOver ? Colors.neonBlue : Colors.textMuted, fontSize: 10, fontWeight: 700, textAlign: 'center' as any }}>
            {addDragOver ? 'Drop here' : 'Add Images'}
          </span>
          <span style={{ color: Colors.textMuted, fontSize: 9, textAlign: 'center' as any }}>
            {addDragOver ? 'Opens editor' : 'Click or drop'}
          </span>
        </div>
      </ScrollView>

      {images.length > 1 && (
        <View style={styles.reorderHint}>
          <GripVertical size={11} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.reorderHintText}>Drag cards to reorder · First card = main image</Text>
        </View>
      )}

      {editorVisible && pendingFile && (
        <ImageEditorModal
          visible={editorVisible}
          sourceDataUrl={pendingDataUrl}
          sourceFile={pendingFile}
          preset="product"
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </View>
  );
}

type CardProps = {
  img: ImageItem;
  index: number;
  status: CardStatus;
  error?: string;
  isHovered: boolean;
  isDraggedOver: boolean;
  onHover: (id: string | null) => void;
  onSetMain: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
};

function ImageCard({
  img, index, status, error, isHovered, isDraggedOver,
  onHover, onSetMain, onReplace, onRemove, onDragStart, onDragOver, onDragEnd,
}: CardProps) {
  const [imgErr, setImgErr] = useState(false);

  const cardStyle: any = {
    width: 120,
    height: 120,
    borderRadius: Radius.md,
    position: 'relative',
    flexShrink: 0,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: img.isMain
      ? Colors.neonBlue
      : isDraggedOver
        ? Colors.warning
        : Colors.border,
    overflow: 'hidden',
    cursor: 'grab',
    transition: 'all 0.15s ease',
    opacity: status === 'uploading' ? 0.7 : 1,
    transform: isDraggedOver ? 'scale(1.03)' : 'scale(1)',
    boxShadow: img.isMain
      ? `0 0 0 1px ${Colors.neonBlue}55, 0 0 16px ${Colors.neonBlue}22`
      : 'none',
  };

  return (
    <div
      style={cardStyle}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => onHover(img.id)}
      onMouseLeave={() => onHover(null)}
    >
      {status === 'uploading' ? (
        <View style={cs.loadingState}>
          <ActivityIndicator color={Colors.neonBlue} size="small" />
          <Text style={cs.loadingText}>Uploading…</Text>
        </View>
      ) : imgErr ? (
        <View style={cs.errorState}>
          <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
          <Text style={cs.errorStateText}>Failed</Text>
        </View>
      ) : (
        <Image
          source={{ uri: img.url }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      )}

      {img.isMain && (
        <View style={cs.mainBadge}>
          <Star size={9} color={Colors.background} fill={Colors.background} strokeWidth={0} />
          <Text style={cs.mainBadgeText}>MAIN</Text>
        </View>
      )}

      <View style={cs.indexBadge}>
        <Text style={cs.indexText}>{index + 1}</Text>
      </View>

      {error && (
        <View style={cs.errorTooltip}>
          <Text style={cs.errorTooltipText} numberOfLines={2}>{error}</Text>
        </View>
      )}

      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(5,10,20,0.75)',
          display: 'flex',
          flexDirection: 'column' as any,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        {!img.isMain && (
          <button
            onClick={(e) => { e.stopPropagation(); onSetMain(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: Colors.neonBlueGlow,
              border: `1px solid ${Colors.neonBlue}`,
              borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
              color: Colors.neonBlue, fontSize: 10, fontWeight: 700,
              width: 96,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Set as Main
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onReplace(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,77,141,0.15)',
            border: `1px solid ${Colors.border}`,
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
            color: Colors.textSecondary, fontSize: 10, fontWeight: 600,
            width: 96,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Replace
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,68,68,0.15)',
            border: `1px solid ${Colors.error}44`,
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
            color: Colors.error, fontSize: 10, fontWeight: 600,
            width: 96,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Remove
        </button>
      </div>
    </div>
  );
}

const cs = StyleSheet.create({
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundSecondary },
  loadingText: { color: Colors.textMuted, fontSize: 9 },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundSecondary },
  errorStateText: { color: Colors.error, fontSize: 9 },
  mainBadge: {
    position: 'absolute', top: 5, left: 5,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  mainBadgeText: { color: Colors.background, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  indexBadge: {
    position: 'absolute', bottom: 5, left: 5,
    backgroundColor: 'rgba(5,10,20,0.75)',
    borderRadius: Radius.full,
    width: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  indexText: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700' },
  errorTooltip: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.errorDim, padding: 4 },
  errorTooltipText: { color: Colors.error, fontSize: 8 },
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  header: { marginBottom: Spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  label: {
    color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1, borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.full,
    minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '800' },
  hint: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 16 },

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

  galleryRow: { flexDirection: 'row', gap: 10, paddingBottom: 4, paddingRight: 4 },

  reorderHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  reorderHintText: { color: Colors.textMuted, fontSize: 10 },
  mobileFallback: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  mobileFallbackTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  mobileFallbackText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
});
