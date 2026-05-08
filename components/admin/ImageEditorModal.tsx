import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { X, RotateCw, ZoomIn, ZoomOut, RefreshCw, Crop, Check, Sun, Contrast, Droplets, Eye, Upload, Undo2, FlipHorizontal, Lock, Clock as Unlock } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Presets ──────────────────────────────────────────────────────────────────

export type ImagePreset = {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  hint: string;
  aspectRatio: number;
};

export const IMAGE_PRESETS: ImagePreset[] = [
  { id: 'product',     label: 'Product',     ratio: '1:1',     width: 800,  height: 800,  hint: '800 × 800 px',   aspectRatio: 1 },
  { id: 'hero',        label: 'Hero',         ratio: '8:3',     width: 1920, height: 720,  hint: '1920 × 720 px',  aspectRatio: 1920 / 720 },
  { id: 'logo',        label: 'Logo',         ratio: '1:1',     width: 400,  height: 400,  hint: '400 × 400 px',   aspectRatio: 1 },
  { id: 'banner',      label: 'Banner',       ratio: '3:1',     width: 1200, height: 400,  hint: '1200 × 400 px',  aspectRatio: 3 },
  { id: 'category',    label: 'Category',     ratio: '3:2',     width: 600,  height: 400,  hint: '600 × 400 px',   aspectRatio: 1.5 },
  { id: 'testimonial', label: 'Avatar',       ratio: '1:1',     width: 200,  height: 200,  hint: '200 × 200 px',   aspectRatio: 1 },
  { id: 'portrait',    label: 'Portrait',     ratio: '3:4',     width: 600,  height: 800,  hint: '600 × 800 px',   aspectRatio: 0.75 },
  { id: 'custom',      label: 'Free',         ratio: 'free',    width: 0,    height: 0,    hint: 'Free crop',       aspectRatio: 0 },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

type Adjustments = { brightness: number; contrast: number; saturation: number };
const DEFAULT_ADJ: Adjustments = { brightness: 100, contrast: 100, saturation: 100 };

type CropBox = { x: number; y: number; w: number; h: number };
type Pan     = { x: number; y: number };

const TABS = ['crop', 'adjust', 'resize'] as const;
type Tab = typeof TABS[number];

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type Props = {
  visible: boolean;
  sourceDataUrl: string;
  sourceFile: File;
  /** Existing saved URL — if provided, shows Restore Original option */
  existingUrl?: string;
  preset?: string;
  onSave: (file: File, previewDataUrl: string) => void;
  onCancel: () => void;
  onReplace?: () => void;
};

// ─── Canvas constants ──────────────────────────────────────────────────────────

const CANVAS_W = 700;
const CANVAS_H = 460;
const HANDLE_R = 6;
const HANDLE_HIT = 14;
const MIN_CROP_FRAC = 0.04;
const OVERLAY_COLOR = 'rgba(5,10,20,0.62)';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildFilter(a: Adjustments) {
  return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%)`;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function getHandles(cx: number, cy: number, cw: number, ch: number): { id: HandleId; x: number; y: number }[] {
  return [
    { id: 'nw', x: cx,       y: cy },
    { id: 'n',  x: cx+cw/2,  y: cy },
    { id: 'ne', x: cx+cw,    y: cy },
    { id: 'e',  x: cx+cw,    y: cy+ch/2 },
    { id: 'se', x: cx+cw,    y: cy+ch },
    { id: 's',  x: cx+cw/2,  y: cy+ch },
    { id: 'sw', x: cx,       y: cy+ch },
    { id: 'w',  x: cx,       y: cy+ch/2 },
  ];
}

function cursorForHandle(id: HandleId | null, inCrop: boolean): string {
  if (!id) return inCrop ? 'move' : 'default';
  const map: Record<HandleId, string> = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
    e: 'e-resize', se: 'se-resize', s: 's-resize',
    sw: 'sw-resize', w: 'w-resize',
  };
  return map[id];
}

function applyHandleResize(
  id: HandleId,
  startBox: CropBox,
  dx: number,
  dy: number,
  aspectRatio: number,
  lockAspect: boolean,
): CropBox {
  let { x, y, w, h } = startBox;

  switch (id) {
    case 'nw': x += dx; y += dy; w -= dx; h -= dy; break;
    case 'n':  y += dy; h -= dy; break;
    case 'ne': w += dx; y += dy; h -= dy; break;
    case 'e':  w += dx; break;
    case 'se': w += dx; h += dy; break;
    case 's':  h += dy; break;
    case 'sw': x += dx; w -= dx; h += dy; break;
    case 'w':  x += dx; w -= dx; break;
  }

  if (lockAspect && aspectRatio > 0) {
    const isHorizontalHandle = ['e', 'w'].includes(id);
    const isCorner = ['nw', 'ne', 'se', 'sw'].includes(id);
    if (isHorizontalHandle || isCorner) {
      h = w / aspectRatio;
      if (['nw', 'ne'].includes(id)) y = startBox.y + startBox.h - h;
    } else {
      w = h * aspectRatio;
      if (['nw', 'sw'].includes(id)) x = startBox.x + startBox.w - w;
    }
  }

  w = Math.max(MIN_CROP_FRAC, w);
  h = Math.max(MIN_CROP_FRAC, h);
  x = clamp(x, 0, 1 - w);
  y = clamp(y, 0, 1 - h);
  return { x, y, w, h };
}

function calcPresetCrop(presetId: string, imgW: number, imgH: number): CropBox {
  const p = IMAGE_PRESETS.find(x => x.id === presetId);
  if (!p || p.aspectRatio === 0) return { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  const targetAR = p.aspectRatio;
  const imgAR = imgW / imgH;
  let cw: number, ch: number;
  if (imgAR > targetAR) { ch = 0.88; cw = ch * targetAR * imgH / imgW; }
  else                   { cw = 0.88; ch = cw * imgW / (targetAR * imgH); }
  cw = clamp(cw, MIN_CROP_FRAC, 1);
  ch = clamp(ch, MIN_CROP_FRAC, 1);
  return { x: (1 - cw) / 2, y: (1 - ch) / 2, w: cw, h: ch };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ImageEditorModal({
  visible, sourceDataUrl, sourceFile, existingUrl, preset = 'product', onSave, onCancel, onReplace,
}: Props) {
  if (Platform.OS !== 'web') {
    return null;
  }
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef  = useRef<HTMLImageElement | null>(null);
  const rafRef    = useRef<number>(0);

  // Editor state
  const [activeTab, setActiveTab] = useState<Tab>('crop');
  const [activePreset, setActivePreset] = useState(preset);
  const [zoom, setZoom]         = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan]           = useState<Pan>({ x: 0, y: 0 });
  const [adj, setAdj]           = useState<Adjustments>({ ...DEFAULT_ADJ });
  const [cropBox, setCropBox]   = useState<CropBox>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [lockAspect, setLockAspect] = useState(true);
  const [customW, setCustomW]   = useState('800');
  const [customH, setCustomH]   = useState('800');
  const [processing, setProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 });
  const [canvasCursor, setCanvasCursor] = useState('default');
  const [isDraggingActive, setIsDraggingActive] = useState(false);

  // Refs for interaction (avoid stale closures)
  const cropBoxRef    = useRef(cropBox);
  const panRef        = useRef(pan);
  const zoomRef       = useRef(zoom);
  const rotationRef   = useRef(rotation);
  const adjRef        = useRef(adj);
  const lockRef       = useRef(lockAspect);
  const activePresetRef = useRef(activePreset);

  useEffect(() => { cropBoxRef.current    = cropBox; }, [cropBox]);
  useEffect(() => { panRef.current        = pan; }, [pan]);
  useEffect(() => { zoomRef.current       = zoom; }, [zoom]);
  useEffect(() => { rotationRef.current   = rotation; }, [rotation]);
  useEffect(() => { adjRef.current        = adj; }, [adj]);
  useEffect(() => { lockRef.current       = lockAspect; }, [lockAspect]);
  useEffect(() => { activePresetRef.current = activePreset; }, [activePreset]);

  const selectedPreset = IMAGE_PRESETS.find(p => p.id === activePreset) ?? IMAGE_PRESETS[0];

  // Load image on open
  useEffect(() => {
    if (!visible || !sourceDataUrl) return;
    const img = new window.Image();
    img.onload = () => {
      imageRef.current = img;
      const dims = { w: img.naturalWidth, h: img.naturalHeight };
      setImageDims(dims);
      const box = calcPresetCrop(activePreset, dims.w, dims.h);
      setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); setAdj({ ...DEFAULT_ADJ });
      setCropBox(box);
      const p = IMAGE_PRESETS.find(x => x.id === activePreset);
      if (p && p.id !== 'custom') { setCustomW(String(p.width)); setCustomH(String(p.height)); }
    };
    img.src = sourceDataUrl;
  }, [visible, sourceDataUrl]);

  // ── Render loop ──────────────────────────────────────────────────────────────

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      const crop = cropBoxRef.current;
      const p = panRef.current;
      const z = zoomRef.current;
      const rot = rotationRef.current;
      const a = adjRef.current;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#060D1A';
      ctx.fillRect(0, 0, W, H);

      // Draw image with rotation + pan + zoom
      const scaledW = img.naturalWidth * z;
      const scaledH = img.naturalHeight * z;
      ctx.save();
      ctx.translate(W / 2 + p.x, H / 2 + p.y);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.filter = buildFilter(a);
      ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
      ctx.filter = 'none';
      ctx.restore();

      // Crop overlay
      const cx = crop.x * W, cy = crop.y * H;
      const cw = crop.w * W, ch = crop.h * H;

      ctx.fillStyle = OVERLAY_COLOR;
      ctx.fillRect(0,       0,        W,        cy);
      ctx.fillRect(0,       cy + ch,  W,        H - cy - ch);
      ctx.fillRect(0,       cy,       cx,       ch);
      ctx.fillRect(cx + cw, cy,       W - cx - cw, ch);

      // Crop border
      ctx.strokeStyle = 'rgba(255,77,141,0.95)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(cx, cy, cw, ch);

      // Rule-of-thirds grid
      ctx.strokeStyle = 'rgba(255,77,141,0.25)';
      ctx.lineWidth = 0.75;
      ctx.setLineDash([]);
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(cx + cw * i / 3, cy); ctx.lineTo(cx + cw * i / 3, cy + ch); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy + ch * i / 3); ctx.lineTo(cx + cw, cy + ch * i / 3); ctx.stroke();
      }

      // Handles — L-shaped corner handles + mid-edge dots
      const handles = getHandles(cx, cy, cw, ch);
      const isCorner = (id: string) => ['nw','ne','se','sw'].includes(id);
      const L = 10; // corner arm length

      handles.forEach(h => {
        if (isCorner(h.id)) {
          const isLeft  = h.id.includes('w');
          const isTop   = h.id.includes('n');
          ctx.strokeStyle = '#FF4D8D';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(h.x + (isLeft ? L : -L), h.y);
          ctx.lineTo(h.x, h.y);
          ctx.lineTo(h.x, h.y + (isTop ? L : -L));
          ctx.stroke();
        } else {
          ctx.fillStyle = '#FF4D8D';
          ctx.beginPath();
          ctx.arc(h.x, h.y, HANDLE_R - 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0A0507';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    });
  }, []);

  useEffect(() => {
    scheduleRender();
  }, [zoom, rotation, pan, adj, cropBox, scheduleRender]);

  // ── Mouse interaction ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;

    let dragging = false;
    let mode: 'pan' | 'movecrop' | HandleId | null = null;
    let startX = 0, startY = 0;
    let startCrop: CropBox = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    let startPan: Pan = { x: 0, y: 0 };

    const toCanvas = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (canvas.width  / r.width),
        y: (e.clientY - r.top)  * (canvas.height / r.height),
      };
    };

    const hitHandle = (px: number, py: number): HandleId | null => {
      const crop = cropBoxRef.current;
      const W = canvas.width, H = canvas.height;
      const cx = crop.x * W, cy = crop.y * H, cw = crop.w * W, ch = crop.h * H;
      for (const h of getHandles(cx, cy, cw, ch)) {
        if (Math.hypot(px - h.x, py - h.y) < HANDLE_HIT) return h.id;
      }
      return null;
    };

    const inCrop = (px: number, py: number): boolean => {
      const crop = cropBoxRef.current;
      const W = canvas.width, H = canvas.height;
      return px > crop.x * W && px < (crop.x + crop.w) * W &&
             py > crop.y * H && py < (crop.y + crop.h) * H;
    };

    const onMouseMove = (e: MouseEvent) => {
      const { x, y } = toCanvas(e);
      const handle = hitHandle(x, y);
      const inside = inCrop(x, y);
      setCanvasCursor(dragging ? (mode === 'pan' ? 'grabbing' : cursorForHandle(handle, inside)) : cursorForHandle(handle, inside));

      if (!dragging) return;
      const dx = x - startX;
      const dy = y - startY;
      const W = canvas.width, H = canvas.height;

      if (mode === 'pan') {
        setPan({ x: startPan.x + dx, y: startPan.y + dy });
      } else if (mode === 'movecrop') {
        setCropBox({
          ...startCrop,
          x: clamp(startCrop.x + dx / W, 0, 1 - startCrop.w),
          y: clamp(startCrop.y + dy / H, 0, 1 - startCrop.h),
        });
      } else if (mode) {
        const p = IMAGE_PRESETS.find(x => x.id === activePresetRef.current) ?? IMAGE_PRESETS[0];
        setCropBox(applyHandleResize(mode as HandleId, startCrop, dx / W, dy / H, p.aspectRatio, lockRef.current));
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const { x, y } = toCanvas(e);
      const handle = hitHandle(x, y);
      dragging = true;
      startX = x; startY = y;
      startCrop = { ...cropBoxRef.current };
      startPan  = { ...panRef.current };

      if (handle)       { mode = handle; }
      else if (inCrop(x, y)) { mode = 'movecrop'; }
      else               { mode = 'pan'; }

      setIsDraggingActive(true);
    };

    const onMouseUp = () => { dragging = false; mode = null; setIsDraggingActive(false); };

    // Wheel to zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom(z => clamp(z + delta, 0.1, 8));
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [visible, scheduleRender]);

  // ── Preset change ─────────────────────────────────────────────────────────────

  const handlePresetChange = useCallback((id: string) => {
    setActivePreset(id);
    const p = IMAGE_PRESETS.find(x => x.id === id);
    if (p && p.id !== 'custom') { setCustomW(String(p.width)); setCustomH(String(p.height)); }
    if (imageRef.current) setCropBox(calcPresetCrop(id, imageRef.current.naturalWidth, imageRef.current.naturalHeight));
    if (id !== 'custom') setLockAspect(true);
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); setAdj({ ...DEFAULT_ADJ });
    if (imageRef.current) setCropBox(calcPresetCrop(activePreset, imageRef.current.naturalWidth, imageRef.current.naturalHeight));
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setProcessing(true);

    const p = selectedPreset;
    const outW = p.id === 'custom' ? (parseInt(customW) || 800) : p.width;
    const outH = p.id === 'custom' ? (parseInt(customH) || 800) : p.height;

    const offscreen = document.createElement('canvas');
    offscreen.width = outW;
    offscreen.height = outH;
    const ctx = offscreen.getContext('2d')!;

    // We need to map the crop region (in canvas-display coords) back to image-source coords.
    // The image is drawn: center=(W/2+pan.x, H/2+pan.y), scale=zoom, rotate=rotation.
    // Crop rect in canvas px:
    const W = canvas.width, H = canvas.height;
    const cropPxX = cropBox.x * W;
    const cropPxY = cropBox.y * H;
    const cropPxW = cropBox.w * W;
    const cropPxH = cropBox.h * H;

    // Centre of crop in canvas space:
    const cropCX = cropPxX + cropPxW / 2;
    const cropCY = cropPxY + cropPxH / 2;

    // Offset from image centre:
    const pivotX = W / 2 + pan.x;
    const pivotY = H / 2 + pan.y;
    const relX = cropCX - pivotX;
    const relY = cropCY - pivotY;

    // Un-rotate:
    const rad = -(rotation * Math.PI) / 180;
    const srcCX = img.naturalWidth  / 2 + (relX * Math.cos(rad) - relY * Math.sin(rad)) / zoom;
    const srcCY = img.naturalHeight / 2 + (relX * Math.sin(rad) + relY * Math.cos(rad)) / zoom;
    const srcW  = cropPxW / zoom;
    const srcH  = cropPxH / zoom;
    const srcX  = srcCX - srcW / 2;
    const srcY  = srcCY - srcH / 2;

    ctx.filter = buildFilter(adj);

    if (rotation !== 0) {
      // Render rotated source to temp canvas first, then crop from it
      const tmp = document.createElement('canvas');
      tmp.width  = img.naturalWidth;
      tmp.height = img.naturalHeight;
      const tc = tmp.getContext('2d')!;
      tc.translate(img.naturalWidth / 2, img.naturalHeight / 2);
      tc.rotate((rotation * Math.PI) / 180);
      tc.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.drawImage(tmp, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
    } else {
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
    }
    ctx.filter = 'none';

    const isPng = sourceFile.name.toLowerCase().endsWith('.png');
    const mime  = isPng ? 'image/png' : 'image/jpeg';

    offscreen.toBlob((blob) => {
      if (!blob) { setProcessing(false); return; }
      const file = new File([blob], `edited-${Date.now()}.${isPng ? 'png' : 'jpg'}`, { type: mime });
      const reader = new FileReader();
      reader.onload = (ev) => {
        setProcessing(false);
        onSave(file, ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }, mime, 0.92);
  };

  // ── Open file picker (replace) ────────────────────────────────────────────────

  const handleReplace = useCallback(() => {
    if (onReplace) { onReplace(); return; }
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/gif';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          imageRef.current = img;
          setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
          setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); setAdj({ ...DEFAULT_ADJ });
          setCropBox(calcPresetCrop(activePreset, img.naturalWidth, img.naturalHeight));
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [onReplace, activePreset]);

  if (!visible) return null;

  const fileKb = sourceFile ? (sourceFile.size / 1024).toFixed(0) : '—';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.shell}>

          {/* ── Top bar ─────────────────────────────────────────────────────── */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <View style={styles.badge}>
                <Crop size={12} color={Colors.neonBlue} strokeWidth={2.5} />
                <Text style={styles.badgeText}>Image Editor</Text>
              </View>
              <Text style={styles.topBarMeta}>
                {imageDims.w > 0 ? `${imageDims.w} × ${imageDims.h} px  ·  ${fileKb} KB` : 'Loading…'}
              </Text>
            </View>
            <View style={styles.topBarRight}>
              <TopBtn
                label={showOriginal ? 'Show Edited' : 'Original'}
                icon={<Eye size={13} color={showOriginal ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />}
                active={showOriginal}
                onPress={() => setShowOriginal(v => !v)}
              />
              <TopBtn label="Replace" icon={<Upload size={13} color={Colors.textMuted} strokeWidth={2} />} onPress={handleReplace} />
              <TopBtn label="Reset All" icon={<RefreshCw size={13} color={Colors.textMuted} strokeWidth={2} />} onPress={handleReset} />
              <TouchableOpacity style={styles.closeBtn} onPress={onCancel} activeOpacity={0.7}>
                <X size={15} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <View style={styles.body}>

            {/* Canvas area */}
            <View style={styles.canvasWrap}>
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                style={{
                  width: '100%', height: '100%',
                  display: showOriginal ? 'none' : 'block',
                  cursor: canvasCursor,
                  userSelect: 'none',
                }}
              />
              {showOriginal && (
                <img
                  src={sourceDataUrl}
                  alt="Original"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              )}

              {showOriginal && (
                <View style={styles.origBadge}>
                  <Text style={styles.origBadgeText}>ORIGINAL</Text>
                </View>
              )}

              {/* Floating zoom controls */}
              <View style={styles.zoomBar}>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoom(z => clamp(z - 0.12, 0.1, 8))} activeOpacity={0.8}>
                  <ZoomOut size={13} color={Colors.textPrimary} strokeWidth={2} />
                </TouchableOpacity>
                <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoom(z => clamp(z + 0.12, 0.1, 8))} activeOpacity={0.8}>
                  <ZoomIn size={13} color={Colors.textPrimary} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Floating rotate controls */}
              <View style={styles.rotateBar}>
                <TouchableOpacity style={styles.rotBtn} onPress={() => setRotation(r => (r - 90 + 360) % 360)} activeOpacity={0.8}>
                  <FlipHorizontal size={13} color={Colors.textPrimary} strokeWidth={2} />
                </TouchableOpacity>
                <Text style={styles.rotLabel}>{rotation}°</Text>
                <TouchableOpacity style={styles.rotBtn} onPress={() => setRotation(r => (r + 90) % 360)} activeOpacity={0.8}>
                  <RotateCw size={13} color={Colors.textPrimary} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Wheel hint */}
              {!isDraggingActive && (
                <View style={styles.wheelHint}>
                  <Text style={styles.wheelHintText}>Scroll to zoom · Drag image to pan · Drag handles to crop</Text>
                </View>
              )}
            </View>

            {/* Sidebar */}
            <View style={styles.sidebar}>
              {/* Aspect ratio presets */}
              <View style={styles.presetSection}>
                <Text style={styles.sectionLabel}>Crop Preset</Text>
                <View style={styles.presetGrid}>
                  {IMAGE_PRESETS.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.presetCard, activePreset === p.id && styles.presetCardActive]}
                      onPress={() => handlePresetChange(p.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetRatio, activePreset === p.id && styles.presetRatioActive]}>
                        {p.ratio}
                      </Text>
                      <Text style={[styles.presetCardLabel, activePreset === p.id && styles.presetCardLabelActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.presetHint}>
                  {selectedPreset.id !== 'custom'
                    ? `Output: ${selectedPreset.hint}  ·  Ratio ${selectedPreset.ratio}`
                    : 'Free crop — set any output dimensions in Resize tab'}
                </Text>
              </View>

              {/* Tabs */}
              <View style={styles.tabRow}>
                {TABS.map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => setActiveTab(tab)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={styles.tabBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* CROP tab */}
                {activeTab === 'crop' && (
                  <View style={styles.tabContent}>
                    <SliderRow
                      label="Zoom"
                      value={zoom} min={0.1} max={5} step={0.01}
                      display={`${Math.round(zoom * 100)}%`}
                      onChange={setZoom}
                    />
                    <SliderRow
                      label="Rotate"
                      value={rotation} min={-180} max={180} step={1}
                      display={`${rotation > 0 ? '+' : ''}${rotation}°`}
                      onChange={setRotation}
                    />
                    <View style={styles.lockRow}>
                      <Text style={styles.lockLabel}>Lock aspect ratio</Text>
                      <TouchableOpacity
                        style={[styles.lockToggle, lockAspect && styles.lockToggleActive]}
                        onPress={() => setLockAspect(v => !v)}
                        activeOpacity={0.8}
                      >
                        {lockAspect
                          ? <Lock size={12} color={Colors.neonBlue} strokeWidth={2.5} />
                          : <Unlock size={12} color={Colors.textMuted} strokeWidth={2} />}
                        <Text style={[styles.lockToggleText, lockAspect && styles.lockToggleTextActive]}>
                          {lockAspect ? 'Locked' : 'Unlocked'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.cropInfoBox}>
                      <Text style={styles.cropInfoTitle}>Crop area</Text>
                      <View style={styles.cropInfoRow}>
                        <CropStat label="X" value={`${(cropBox.x * 100).toFixed(0)}%`} />
                        <CropStat label="Y" value={`${(cropBox.y * 100).toFixed(0)}%`} />
                        <CropStat label="W" value={`${(cropBox.w * 100).toFixed(0)}%`} />
                        <CropStat label="H" value={`${(cropBox.h * 100).toFixed(0)}%`} />
                      </View>
                    </View>
                  </View>
                )}

                {/* ADJUST tab */}
                {activeTab === 'adjust' && (
                  <View style={styles.tabContent}>
                    <SliderRow label="Brightness" value={adj.brightness} min={0} max={200} step={1}
                      display={adjDisplay(adj.brightness)} onChange={v => setAdj(a => ({ ...a, brightness: v }))}
                      icon={<Sun size={12} color={Colors.textMuted} strokeWidth={2} />} />
                    <SliderRow label="Contrast" value={adj.contrast} min={0} max={200} step={1}
                      display={adjDisplay(adj.contrast)} onChange={v => setAdj(a => ({ ...a, contrast: v }))}
                      icon={<Contrast size={12} color={Colors.textMuted} strokeWidth={2} />} />
                    <SliderRow label="Saturation" value={adj.saturation} min={0} max={200} step={1}
                      display={adjDisplay(adj.saturation)} onChange={v => setAdj(a => ({ ...a, saturation: v }))}
                      icon={<Droplets size={12} color={Colors.textMuted} strokeWidth={2} />} />
                    <TouchableOpacity style={styles.resetAdjBtn} onPress={() => setAdj({ ...DEFAULT_ADJ })} activeOpacity={0.8}>
                      <Undo2 size={12} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={styles.resetAdjText}>Reset Adjustments</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* RESIZE tab */}
                {activeTab === 'resize' && (
                  <View style={styles.tabContent}>
                    {selectedPreset.id !== 'custom' && (
                      <View style={styles.recBox}>
                        <Text style={styles.recLabel}>Recommended output</Text>
                        <Text style={styles.recValue}>{selectedPreset.width} × {selectedPreset.height} px</Text>
                      </View>
                    )}
                    <Text style={styles.tabDesc}>Custom output dimensions for the saved file:</Text>
                    <View style={styles.dimRow}>
                      <View style={styles.dimField}>
                        <Text style={styles.dimLabel}>Width px</Text>
                        <TextInput
                          style={styles.dimInput}
                          value={customW}
                          onChangeText={v => {
                            setCustomW(v);
                            if (lockAspect && imageRef.current && imageDims.h > 0) {
                              const ar = imageDims.w / imageDims.h;
                              setCustomH(String(Math.round((parseInt(v) || 0) / ar) || ''));
                            }
                          }}
                          keyboardType="number-pad"
                          placeholderTextColor={Colors.textMuted}
                          selectTextOnFocus
                        />
                      </View>
                      <Text style={styles.dimSep}>×</Text>
                      <View style={styles.dimField}>
                        <Text style={styles.dimLabel}>Height px</Text>
                        <TextInput
                          style={styles.dimInput}
                          value={customH}
                          onChangeText={v => {
                            setCustomH(v);
                            if (lockAspect && imageRef.current && imageDims.w > 0) {
                              const ar = imageDims.w / imageDims.h;
                              setCustomW(String(Math.round((parseInt(v) || 0) * ar) || ''));
                            }
                          }}
                          keyboardType="number-pad"
                          placeholderTextColor={Colors.textMuted}
                          selectTextOnFocus
                        />
                      </View>
                    </View>
                    <View style={styles.lockRow}>
                      <Text style={styles.lockLabel}>Lock aspect ratio</Text>
                      <TouchableOpacity
                        style={[styles.lockToggle, lockAspect && styles.lockToggleActive]}
                        onPress={() => setLockAspect(v => !v)}
                        activeOpacity={0.8}
                      >
                        {lockAspect
                          ? <Lock size={12} color={Colors.neonBlue} strokeWidth={2.5} />
                          : <Unlock size={12} color={Colors.textMuted} strokeWidth={2} />}
                        <Text style={[styles.lockToggleText, lockAspect && styles.lockToggleTextActive]}>
                          {lockAspect ? 'Locked' : 'Unlocked'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.sectionLabel} style={{ marginTop: 4, marginBottom: 8 }}>Quick presets</Text>
                    {IMAGE_PRESETS.filter(p => p.id !== 'custom').map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.presetListRow, activePreset === p.id && styles.presetListRowActive]}
                        onPress={() => handlePresetChange(p.id)}
                        activeOpacity={0.7}
                      >
                        <View>
                          <Text style={[styles.presetListName, activePreset === p.id && { color: Colors.neonBlue }]}>{p.label}</Text>
                          <Text style={styles.presetListHint}>{p.hint}  ·  {p.ratio}</Text>
                        </View>
                        {activePreset === p.id && <Check size={13} color={Colors.neonBlue} strokeWidth={2.5} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

              </ScrollView>

              {/* Footer buttons */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, processing && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={processing}
                  activeOpacity={0.8}
                >
                  {processing
                    ? <ActivityIndicator color={Colors.background} size="small" />
                    : <>
                        <Check size={14} color={Colors.background} strokeWidth={2.5} />
                        <Text style={styles.saveText}>Apply & Save</Text>
                      </>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function adjDisplay(v: number): string {
  const d = v - 100;
  return d === 0 ? '0' : (d > 0 ? `+${d}` : String(d));
}

function TopBtn({ label, icon, onPress, active }: { label: string; icon: React.ReactNode; onPress: () => void; active?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.topBtn, active && styles.topBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={[styles.topBtnText, active && styles.topBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CropStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cropStat}>
      <Text style={styles.cropStatLabel}>{label}</Text>
      <Text style={styles.cropStatValue}>{value}</Text>
    </View>
  );
}

type SliderRowProps = {
  label: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void; icon?: React.ReactNode;
};
function SliderRow({ label, value, min, max, step, display, onChange, icon }: SliderRowProps) {
  return (
    <View style={sr.wrap}>
      <View style={sr.row}>
        {icon && <View style={sr.icon}>{icon}</View>}
        <Text style={sr.label}>{label}</Text>
        <Text style={sr.val}>{display}</Text>
      </View>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: Colors.neonBlue, height: 3, cursor: 'pointer', margin: '2px 0' }}
      />
    </View>
  );
}

const sr = StyleSheet.create({
  wrap:  { marginBottom: 14 },
  row:   { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  icon:  { marginRight: 5 },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', flex: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  val:   { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '800', minWidth: 36, textAlign: 'right' },
});

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3,7,14,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  shell: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 1080,
    maxHeight: '96%',
    overflow: 'hidden',
  },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  topBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3,
  },
  badgeText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 0.4 },
  topBarMeta: { color: Colors.textMuted, fontSize: FontSize.xs },
  topBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 9, paddingVertical: 6,
  },
  topBtnActive: { borderColor: Colors.neonBlueBorder, backgroundColor: Colors.neonBlueGlow },
  topBtnText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  topBtnTextActive: { color: Colors.neonBlue },
  closeBtn: {
    width: 30, height: 30, justifyContent: 'center', alignItems: 'center',
    borderRadius: Radius.sm, backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.border, marginLeft: 2,
  },

  body: { flexDirection: 'row', flex: 1, minHeight: 420 },

  // Canvas
  canvasWrap: {
    flex: 1, backgroundColor: '#060D1A', position: 'relative',
  },
  origBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(255,179,0,0.9)',
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  origBadgeText: { color: '#060D1A', fontSize: FontSize.xs, fontWeight: '900', letterSpacing: 0.5 },

  zoomBar: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(10,22,40,0.9)', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 3,
  },
  zoomBtn: {
    width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
    borderRadius: Radius.sm, backgroundColor: Colors.backgroundSecondary,
  },
  zoomLabel: {
    color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '700',
    minWidth: 38, textAlign: 'center',
  },

  rotateBar: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(10,22,40,0.9)', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 3,
  },
  rotBtn: {
    width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
    borderRadius: Radius.sm, backgroundColor: Colors.backgroundSecondary,
  },
  rotLabel: {
    color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '700',
    minWidth: 32, textAlign: 'center',
  },

  wheelHint: {
    position: 'absolute', bottom: 12, left: '50%',
    transform: [{ translateX: -140 }],
    backgroundColor: 'rgba(10,22,40,0.75)',
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  wheelHintText: { color: Colors.textMuted, fontSize: 9, fontWeight: '600' },

  // Sidebar
  sidebar: {
    width: 292,
    borderLeftWidth: 1, borderLeftColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    flexDirection: 'column',
  },

  presetSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectionLabel: {
    color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  presetGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 7,
  },
  presetCard: {
    alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    minWidth: 52,
  },
  presetCardActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlue },
  presetRatio: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.3, marginBottom: 1 },
  presetRatioActive: { color: Colors.neonBlue },
  presetCardLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '600' },
  presetCardLabelActive: { color: Colors.neonBlue },
  presetHint: { color: Colors.textMuted, fontSize: 9, lineHeight: 13 },

  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.neonBlue },
  tabText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  tabTextActive: { color: Colors.neonBlue },

  tabBody: { flex: 1 },
  tabContent: { padding: Spacing.md },
  tabDesc: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 16, marginBottom: Spacing.sm },

  lockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 2 },
  lockLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  lockToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5,
  },
  lockToggleActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder },
  lockToggleText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  lockToggleTextActive: { color: Colors.neonBlue },

  cropInfoBox: {
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.sm, marginTop: 4,
  },
  cropInfoTitle: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 },
  cropInfoRow: { flexDirection: 'row', gap: 6 },
  cropStat: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.sm, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border,
  },
  cropStatLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  cropStatValue: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '800' },

  recBox: {
    backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  recLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  recValue: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '800', marginTop: 2 },

  dimRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: Spacing.sm },
  dimField: { flex: 1 },
  dimLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 4 },
  dimInput: {
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 7,
    color: Colors.textPrimary, fontSize: FontSize.sm, textAlign: 'center',
  },
  dimSep: { color: Colors.textMuted, fontSize: FontSize.md, fontWeight: '700', paddingBottom: 7 },

  presetListRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm, marginBottom: 2,
    borderWidth: 1, borderColor: 'transparent',
  },
  presetListRowActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder },
  presetListName: { color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '700' },
  presetListHint: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },

  resetAdjBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingVertical: 8, marginTop: Spacing.sm,
  },
  resetAdjText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },

  footer: {
    flexDirection: 'row', gap: 7, padding: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cancelBtn: {
    flex: 1, height: 40, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: {
    flex: 2, height: 40, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.md,
  },
  saveText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
});
