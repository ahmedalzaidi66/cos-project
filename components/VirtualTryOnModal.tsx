/**
 * Virtual Try-On — multi-layer makeup studio
 * Web-only. Returns null on native.
 *
 * STATE ARCHITECTURE:
 *   layers[]            — source of truth for all makeup layers
 *   activeTab           — controls which product list is shown
 *   blushPlacement      — manual placement state for blush overlays
 *   concealerPlacement  — manual placement state for concealer overlays
 *   blushPreset         — active blush preset key
 *   concealerPreset     — active concealer preset key
 *   overlayTab          — which overlay is being edited ('blush' | 'concealer')
 *
 * Overlay is a pure-DOM SVG element over the canvas preview.
 * Canvas render reads placement state and passes it into the paint functions
 * so saved images match the overlay exactly.
 * No drag/pointer-capture logic — placement is driven by presets + sliders.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Modal, useWindowDimensions, ActivityIndicator, ScrollView,
} from 'react-native';
import {
  X, Camera, Eye, EyeOff, ImagePlus, RefreshCw, Sparkles,
  ShoppingCart, Layers, Trash2, Download, Plus, Check,
  TriangleAlert as AlertTriangle, CircleCheck as CircleCheckIcon,
  RotateCcw,
} from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { ProductShade, supabase } from '@/lib/supabase';
import {
  smartRenderLayers, initFaceLandmarker, isFaceLandmarkerReady,
  getTryOnCategory, getDefaultFinish, TRYON_PRODUCTS,
  DEFAULT_BLUSH_PLACEMENT, DEFAULT_CONCEALER_PLACEMENT,
  BLUSH_PRESETS, BLUSH_PRESET_ORDER,
  CONCEALER_PRESETS, CONCEALER_PRESET_ORDER,
  type MakeupLayer, type TryOnCategory, type TryOnProduct, type ShadeOption,
  type OverlayPlacement, type OverlaySpot,
  type BlushPreset, type ConcealerPreset,
} from '@/lib/virtualTryOn';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Layer = {
  id: string;
  type: TryOnCategory;
  productId: string;
  productName: string;
  shade: { id: string; name: string; hex: string };
  intensity: number;
  finish: string;
  visible: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  productName: string;
  productCategory: string;
  tryOnType?: string | null;
  shades: ProductShade[];
  selectedShade: ProductShade;
  onShadeChange: (shade: ProductShade) => void;
  onAddToCart: () => void;
};

type OverlayTab = 'blush' | 'concealer';

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_SIZE = 640;

const CAT_ORDER: TryOnCategory[] = ['lipstick', 'blush', 'concealer', 'foundation'];

const CAT_LABEL: Record<TryOnCategory, string> = {
  lipstick: 'Lipstick', blush: 'Blush',
  concealer: 'Concealer', foundation: 'Foundation',
};

const CAT_ZONE: Record<TryOnCategory, string> = {
  lipstick: 'Lips', blush: 'Cheeks',
  concealer: 'Under eyes', foundation: 'Full face',
};

const CAT_ACCENT: Record<TryOnCategory, string> = {
  lipstick: '#FF4D8D', blush: '#FF8FA3',
  concealer: '#FFB3A7', foundation: '#FFCBA4',
};

// Base radii as fraction of preview width
const BLUSH_RX_PCT     = 0.145;
const BLUSH_ASPECT     = 0.62;
const CONCEALER_RX_PCT = 0.085;
const CONCEALER_ASPECT = 0.62;

// Fine-adjustment offset limits
const MAX_H_OFFSET = 0.15;  // ±15% of width
const MAX_V_OFFSET = 0.15;  // ±15% of height

function uid() { return Math.random().toString(36).slice(2, 9); }

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

// ─── Root export (native guard) ───────────────────────────────────────────────

export default function VirtualTryOnModal(props: Props) {
  if (Platform.OS !== 'web') return null;
  return <TryOnModalWeb {...props} />;
}

// ─── StaticOverlaySpot ────────────────────────────────────────────────────────
// Non-interactive SVG soft-oval rendered with true product color.
// mix-blend-mode: multiply + saturate filter for vibrant color rendering.

interface SpotProps {
  spot:        OverlaySpot;
  hex:         string;
  rxPct:       number;
  aspect:      number;
  previewSize: number;
  spotKey:     'left' | 'right';
}

function StaticOverlaySpot({ spot, hex, rxPct, aspect, previewSize, spotKey }: SpotProps) {
  const rx = previewSize * rxPct * spot.scale;
  const ry = rx * aspect;
  const cx = spot.xPct * previewSize;
  const cy = spot.yPct * previewSize;

  const hx = hex.replace('#', '').padEnd(6, '0');
  const cr = parseInt(hx.slice(0, 2), 16);
  const cg = parseInt(hx.slice(2, 4), 16);
  const cb = parseInt(hx.slice(4, 6), 16);

  const op = spot.opacity;
  const gradId = `ovl-${spotKey}-${hx}`;

  return (
    <svg
      width={previewSize}
      height={previewSize}
      style={{
        position: 'absolute', top: 0, left: 0,
        overflow: 'visible',
        pointerEvents: 'none',
        mixBlendMode: 'multiply' as any,
        filter: 'saturate(1.2)',
      } as React.CSSProperties}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={`rgb(${cr},${cg},${cb})`} stopOpacity={op} />
          <stop offset="30%"  stopColor={`rgb(${cr},${cg},${cb})`} stopOpacity={op * 0.82} />
          <stop offset="60%"  stopColor={`rgb(${cr},${cg},${cb})`} stopOpacity={op * 0.42} />
          <stop offset="82%"  stopColor={`rgb(${cr},${cg},${cb})`} stopOpacity={op * 0.12} />
          <stop offset="100%" stopColor={`rgb(${cr},${cg},${cb})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={`rotate(${spot.rotation},${cx},${cy})`}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${gradId})`} />
      </g>
    </svg>
  );
}

// ─── StaticOverlay ────────────────────────────────────────────────────────────
// Renders two StaticOverlaySpot elements over the canvas. No pointer events.

interface OverlayProps {
  previewSize: number;
  placement:   OverlayPlacement;
  hex:         string;
  overlayType: OverlayTab;
}

function StaticOverlay({ previewSize, placement, hex, overlayType }: OverlayProps) {
  const rxPct  = overlayType === 'blush' ? BLUSH_RX_PCT     : CONCEALER_RX_PCT;
  const aspect = overlayType === 'blush' ? BLUSH_ASPECT      : CONCEALER_ASPECT;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none',
      borderRadius: Radius.lg,
      overflow: 'hidden',
    }}>
      {(['left', 'right'] as const).map(k => (
        <StaticOverlaySpot
          key={k}
          spotKey={k}
          spot={placement[k]}
          hex={hex}
          rxPct={rxPct}
          aspect={aspect}
          previewSize={previewSize}
        />
      ))}
    </div>
  );
}

// ─── CssSlider ────────────────────────────────────────────────────────────────

interface SliderProps {
  label:        string;
  value:        number;
  min:          number;
  max:          number;
  step:         number;
  onChange:     (v: number) => void;
  formatValue?: (v: number) => string;
  color?:       string;
}

function CssSlider({ label, value, min, max, step, onChange, formatValue, color }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const tc  = color ?? Colors.neonBlue;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: Colors.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{label}</span>
        <span style={{ color: tc, fontSize: 10, fontWeight: 800 }}>
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4,
          borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden',
        }}>
          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: tc, borderRadius: 2 }} />
        </div>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 20, margin: 0 }}
        />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 7px)`,
          width: 14, height: 14, borderRadius: 7,
          backgroundColor: tc, border: '2px solid rgba(255,255,255,0.85)',
          boxShadow: `0 0 6px ${tc}88`, pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

// ─── applyMirror ─────────────────────────────────────────────────────────────

function applyMirror(p: OverlayPlacement): OverlayPlacement {
  const src = p.left;
  const mirrored: OverlaySpot = {
    xPct:     1 - src.xPct,
    yPct:     src.yPct,
    scale:    src.scale,
    rotation: -src.rotation,
    opacity:  src.opacity,
  };
  return { ...p, right: mirrored };
}

// Merge preset + H/V offsets → final placement
function buildPlacement(
  base: OverlayPlacement,
  hOffset: number,
  vOffset: number,
  scale: number,
  opacity: number,
): OverlayPlacement {
  const left: OverlaySpot = {
    ...base.left,
    xPct:    clamp(base.left.xPct    - hOffset, 0.04, 0.96),
    yPct:    clamp(base.left.yPct    + vOffset, 0.04, 0.96),
    scale,
    opacity,
  };
  const right: OverlaySpot = {
    ...base.right,
    xPct:    clamp(base.right.xPct   + hOffset, 0.04, 0.96),
    yPct:    clamp(base.right.yPct   + vOffset, 0.04, 0.96),
    scale,
    opacity,
  };
  return { left, right, mirror: true };
}

// ─── Main component ───────────────────────────────────────────────────────────

function TryOnModalWeb({
  visible, onClose, productName, productCategory, tryOnType,
  shades, selectedShade, onShadeChange, onAddToCart,
}: Props) {
  const { width: sw } = useWindowDimensions();
  const narrow   = sw < 740;
  const previewW = Math.min(sw - (narrow ? 32 : 380), CANVAS_SIZE);

  // ── LAYER STATE ───────────────────────────────────────────────────────────
  const [layers, setLayers] = useState<Layer[]>([]);

  // ── TAB STATE (product list) ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TryOnCategory>('lipstick');

  // ── SHADE PICKER per product ───────────────────────────────────────────────
  const [pickedShades, setPickedShades] = useState<Record<string, ShadeOption>>({});

  // ── OVERLAY EDITOR ────────────────────────────────────────────────────────
  const [overlayTab, setOverlayTab] = useState<OverlayTab>('blush');

  // Blush preset + fine adjustments
  const [blushPreset,   setBlushPreset]   = useState<BlushPreset>('mid');
  const [blushHOffset,  setBlushHOffset]  = useState(0);   // ±MAX_H_OFFSET
  const [blushVOffset,  setBlushVOffset]  = useState(0);   // ±MAX_V_OFFSET
  const [blushScale,    setBlushScale]    = useState(1.0);
  const [blushOpacity,  setBlushOpacity]  = useState(0.65);

  // Concealer preset + fine adjustments
  const [concealerPreset,  setConcealerPreset]  = useState<ConcealerPreset>('brightening');
  const [concealerHOffset, setConcealerHOffset] = useState(0);
  const [concealerVOffset, setConcealerVOffset] = useState(0);
  const [concealerScale,   setConcealerScale]   = useState(1.0);
  const [concealerOpacity, setConcealerOpacity] = useState(0.45);

  // Compute final placement objects
  const blushPlacement = useMemo(() =>
    buildPlacement(
      BLUSH_PRESETS[blushPreset].placement,
      blushHOffset, blushVOffset, blushScale, blushOpacity,
    ),
  [blushPreset, blushHOffset, blushVOffset, blushScale, blushOpacity]);

  const concealerPlacement = useMemo(() =>
    buildPlacement(
      CONCEALER_PRESETS[concealerPreset].placement,
      concealerHOffset, concealerVOffset, concealerScale, concealerOpacity,
    ),
  [concealerPreset, concealerHOffset, concealerVOffset, concealerScale, concealerOpacity]);

  // Reset handlers
  const resetBlush = useCallback(() => {
    setBlushPreset('mid');
    setBlushHOffset(0); setBlushVOffset(0);
    setBlushScale(1.0); setBlushOpacity(0.65);
  }, []);

  const resetConcealer = useCallback(() => {
    setConcealerPreset('brightening');
    setConcealerHOffset(0); setConcealerVOffset(0);
    setConcealerScale(1.0); setConcealerOpacity(0.45);
  }, []);

  // Keep refs for async render callbacks (avoids stale closure)
  const blushPlacementRef     = useRef(blushPlacement);
  const concealerPlacementRef = useRef(concealerPlacement);
  const faceModeRef           = useRef(faceMode);
  useEffect(() => { blushPlacementRef.current     = blushPlacement;     }, [blushPlacement]);
  useEffect(() => { concealerPlacementRef.current = concealerPlacement; }, [concealerPlacement]);
  useEffect(() => { faceModeRef.current           = faceMode;           }, [faceMode]);

  // ── PHOTO / CANVAS ─────────────────────────────────────────────────────────
  const [settingsModelUrl, setSettingsModelUrl] = useState<string | null>(null);
  const activeDefault = settingsModelUrl || null;
  const [imageUri,   setImageUri]   = useState<string | null>(null);
  const [faceMode,   setFaceMode]   = useState<'model' | 'upload'>('model');
  const [showBefore, setShowBefore] = useState(false);

  // ── RENDER STATE ───────────────────────────────────────────────────────────
  const [rendering, setRendering] = useState(false);
  const [rendered,  setRendered]  = useState(false);
  const [faceOk,    setFaceOk]    = useState(true);
  const [renderErr, setRenderErr] = useState<string | null>(null);

  // ── MODEL STATE ────────────────────────────────────────────────────────────
  const [modelReady, setModelReady] = useState(isFaceLandmarkerReady());
  const [modelLoad,  setModelLoad]  = useState(false);

  // ── SAVE STATE ─────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<'idle' | 'ok' | 'err'>('idle');

  // ── REFS ───────────────────────────────────────────────────────────────────
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const imgRef     = useRef<HTMLImageElement  | null>(null);
  const fileRef    = useRef<HTMLInputElement  | null>(null);
  const seqRef     = useRef(0);
  const seededRef  = useRef(false);

  const tabProducts = useMemo(
    () => TRYON_PRODUCTS.filter(p => p.category === activeTab),
    [activeTab],
  );

  // ── Load admin model URL from DB (single source of truth) ────────────────
  useEffect(() => {
    if (!visible) return;
    supabase
      .from('site_settings').select('value')
      .eq('key', 'tryon_model_image_url').maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('[VirtualTryOn] model image error:', error); return; }
        const url = data?.value || null;
        setSettingsModelUrl(url);
        // Always seed imageUri from DB when opening in model mode;
        // only preserve a user-uploaded photo (faceMode === 'upload')
        setImageUri(prev => faceMode === 'upload' && prev !== null ? prev : url);
      })
      .catch(err => console.error('[VirtualTryOn] model image fetch error:', err));
  }, [visible]);

  // ── Load face model ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (isFaceLandmarkerReady()) { setModelReady(true); return; }
    setModelLoad(true);
    initFaceLandmarker()
      .then(() => { setModelReady(true); setModelLoad(false); })
      .catch(() => setModelLoad(false));
  }, [visible]);

  // ── Seed layer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) { seededRef.current = false; return; }
    if (seededRef.current) return;
    seededRef.current = true;
    const cat = getTryOnCategory(tryOnType ?? productCategory);
    if (!cat) return;
    setLayers([{
      id: uid(), type: cat, productId: 'seed', productName,
      shade: { id: 'seed-shade', name: selectedShade.name, hex: selectedShade.color_hex },
      intensity: 0.6, finish: getDefaultFinish(cat), visible: true,
    }]);
    setActiveTab(cat);
    if (cat === 'blush' || cat === 'concealer') setOverlayTab(cat);
  }, [visible]);

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const addLayer = useCallback((product: TryOnProduct, shade: ShadeOption) => {
    setLayers(prev => [...prev, {
      id: uid(), type: product.category, productId: product.id, productName: product.name,
      shade: { id: shade.id, name: shade.name, hex: shade.hex },
      intensity: 0.6, finish: product.finish, visible: true,
    }]);
    if (product.category === 'blush' || product.category === 'concealer') {
      setOverlayTab(product.category);
    }
  }, []);

  const removeLayer    = useCallback((id: string) => setLayers(prev => prev.filter(l => l.id !== id)), []);
  const updateLayer    = useCallback((id: string, changes: Partial<Layer>) =>
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l)), []);
  const clearAllLayers = useCallback(() => setLayers([]), []);
  const switchTab      = useCallback((cat: TryOnCategory) => {
    setActiveTab(cat);
    if (cat === 'blush' || cat === 'concealer') setOverlayTab(cat);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER PIPELINE
  // ─────────────────────────────────────────────────────────────────────────

  const doRender = useCallback(async (currentLayers: Layer[]) => {
    if (!canvasRef.current || !imgRef.current?.complete) return;
    const seq = ++seqRef.current;
    setRendering(true); setRenderErr(null);

    const bp = blushPlacementRef.current;
    const cp = concealerPlacementRef.current;
    const applyFaceClamping = faceModeRef.current === 'upload';

    const mkLayers: MakeupLayer[] = currentLayers
      .filter(l => l.visible)
      .map(l => ({
        id: l.id, type: l.type, color: l.shade.hex,
        intensity: l.intensity, finish: l.finish as any,
        visible: true, label: l.shade.name, productName: l.productName,
        // For uploaded images: force auto landmark placement (undefined) so makeup
        // follows the actual detected face boundaries rather than fixed preset coords.
        // For model images: use manual placement as-is.
        blushPlacement:     (!applyFaceClamping && l.type === 'blush')     ? bp : undefined,
        concealerPlacement: (!applyFaceClamping && l.type === 'concealer') ? cp : undefined,
      }));

    try {
      const r = await smartRenderLayers(canvasRef.current, imgRef.current, mkLayers, faceModeRef.current);
      if (seq !== seqRef.current) return;
      if (!r.success) { setRenderErr(r.error ?? 'Render failed'); setFaceOk(false); }
      else { setFaceOk(r.faceDetected); setRendered(true); }
    } catch (e: any) {
      if (seq === seqRef.current) setRenderErr(e?.message ?? 'Unknown error');
    } finally {
      if (seq === seqRef.current) setRendering(false);
    }
  }, []);

  useEffect(() => {
    if (showBefore || !visible || !imgRef.current?.complete) return;
    requestAnimationFrame(() => doRender(layers));
  }, [layers, showBefore, visible]);

  // Re-render on placement change (rAF-debounced)
  const placementTimer = useRef<number>(0);
  useEffect(() => {
    const hasBlush     = layers.some(l => l.type === 'blush'     && l.visible);
    const hasConcealer = layers.some(l => l.type === 'concealer' && l.visible);
    if (!hasBlush && !hasConcealer) return;
    if (showBefore || !visible || !imgRef.current?.complete) return;
    cancelAnimationFrame(placementTimer.current);
    placementTimer.current = requestAnimationFrame(() => doRender(layers));
  }, [blushPlacement, concealerPlacement]);

  // ── Photo controls ────────────────────────────────────────────────────────

  const pickPhoto = useCallback(() => {
    if (!fileRef.current) {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
      document.body.appendChild(inp);
      fileRef.current = inp;
    }
    const inp = fileRef.current!;
    inp.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        setImageUri(URL.createObjectURL(file));
        setFaceMode('upload');
        setShowBefore(false); setRendered(false); setFaceOk(true); setRenderErr(null);
      }
      inp.value = '';
    };
    inp.click();
  }, []);

  const onImgLoad = useCallback(() => {
    if (!imgRef.current || !canvasRef.current) return;
    canvasRef.current.width  = CANVAS_SIZE;
    canvasRef.current.height = CANVAS_SIZE;
    requestAnimationFrame(() => doRender(layers));
  }, [layers, doRender]);

  const resetPhoto = useCallback(() => {
    setImageUri(activeDefault); setFaceMode('model'); setRendered(false);
    setShowBefore(false); setFaceOk(true); setRenderErr(null);
  }, [activeDefault]);

  const toggleBefore = useCallback(() => {
    setShowBefore(prev => {
      if (prev) requestAnimationFrame(() => doRender(layers));
      return !prev;
    });
  }, [layers, doRender]);

  const saveLook = useCallback(() => {
    if (!canvasRef.current) return;
    try {
      const url = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url; a.download = 'lazurde-look.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setSaveState('ok'); setTimeout(() => setSaveState('idle'), 2500);
    } catch { setSaveState('err'); setTimeout(() => setSaveState('idle'), 3000); }
  }, []);

  const addToCart = useCallback(() => { onAddToCart(); onClose(); }, [onAddToCart, onClose]);

  const visCount = layers.filter(l => l.visible).length;

  // Active hex for overlay preview
  const blushLayers     = layers.filter(l => l.type === 'blush'     && l.visible);
  const concealerLayers = layers.filter(l => l.type === 'concealer' && l.visible);
  const activeBlushHex      = blushLayers[blushLayers.length - 1]?.shade.hex     ?? '#E07B8B';
  const activeConcealerHex  = concealerLayers[concealerLayers.length - 1]?.shade.hex ?? '#E8C9A8';

  const showBlushOverlay     = imageUri && !showBefore && blushLayers.length     > 0;
  const showConcealerOverlay = imageUri && !showBefore && concealerLayers.length > 0;
  const showOverlayPanel     = (blushLayers.length > 0 || concealerLayers.length > 0) && imageUri;

  // ─────────────────────────────────────────────────────────────────────────
  // PREVIEW PANE
  // ─────────────────────────────────────────────────────────────────────────

  const PreviewPane = (
    <View style={[pv.root, { width: previewW, height: previewW }]}>

      {imageUri && (
        <img
          ref={el => { imgRef.current = el; }}
          src={imageUri}
          crossOrigin="anonymous"
          onLoad={onImgLoad}
          style={{ display: 'none' } as React.CSSProperties}
        />
      )}

      {!imageUri ? (
        <TouchableOpacity style={pv.uploadArea} onPress={pickPhoto} activeOpacity={0.8}>
          <View style={pv.uploadRing}>
            <Camera size={30} color={Colors.neonBlue} strokeWidth={1.5} />
          </View>
          <Text style={pv.uploadTitle}>Upload your photo</Text>
          <Text style={pv.uploadSub}>Front-facing · Clear lighting</Text>
          <View style={pv.uploadCta}>
            <Text style={pv.uploadCtaText}>Browse files</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <>
          {/* Before */}
          <img
            src={imageUri}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: previewW, height: previewW,
              objectFit: 'cover', borderRadius: Radius.lg,
              display: showBefore ? 'block' : 'none',
            } as React.CSSProperties}
          />

          {/* After canvas */}
          <canvas
            ref={el => { canvasRef.current = el; }}
            width={CANVAS_SIZE} height={CANVAS_SIZE}
            style={{
              width: previewW, height: previewW,
              borderRadius: Radius.lg,
              display: showBefore ? 'none' : 'block',
            } as React.CSSProperties}
          />

          {/* Blush overlay */}
          {showBlushOverlay && (
            <StaticOverlay
              previewSize={previewW}
              placement={blushPlacement}
              hex={activeBlushHex}
              overlayType="blush"
            />
          )}

          {/* Concealer overlay */}
          {showConcealerOverlay && (
            <StaticOverlay
              previewSize={previewW}
              placement={concealerPlacement}
              hex={activeConcealerHex}
              overlayType="concealer"
            />
          )}

          {rendering && (
            <View style={pv.spinnerLayer}>
              <ActivityIndicator size="large" color={Colors.neonBlue} />
              <Text style={pv.spinnerText}>Blending {visCount} layer{visCount !== 1 ? 's' : ''}…</Text>
            </View>
          )}

          {!rendering && rendered && !faceOk && (
            <View style={pv.alertBadge}>
              <AlertTriangle size={11} color={Colors.warning} strokeWidth={2} />
              <Text style={pv.alertText}>Please upload a clear front-facing photo</Text>
            </View>
          )}

          {!rendering && rendered && faceOk && visCount > 0 && (
            <View style={pv.layerBadge}>
              <Layers size={9} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={pv.layerBadgeText}>{visCount} layer{visCount !== 1 ? 's' : ''}</Text>
            </View>
          )}

          {renderErr && !rendering && (
            <View style={pv.errBadge}>
              <Text style={pv.errText} numberOfLines={2}>{renderErr}</Text>
            </View>
          )}

          <View style={pv.baStrip}>
            <TouchableOpacity style={[pv.baChip, !showBefore && pv.baChipOn]} onPress={() => showBefore && toggleBefore()} activeOpacity={0.8}>
              <Text style={[pv.baChipText, !showBefore && pv.baChipTextOn]}>AFTER</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[pv.baChip, showBefore && pv.baChipOn]} onPress={() => !showBefore && toggleBefore()} activeOpacity={0.8}>
              <Text style={[pv.baChipText, showBefore && pv.baChipTextOn]}>BEFORE</Text>
            </TouchableOpacity>
          </View>

          <View style={pv.photoCtrl}>
            <TouchableOpacity style={pv.photoBtn} onPress={pickPhoto} activeOpacity={0.8}>
              <ImagePlus size={12} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={pv.photoBtnText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pv.photoBtnSm} onPress={resetPhoto} activeOpacity={0.8}>
              <RefreshCw size={11} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // OVERLAY CONTROLS PANEL
  // ─────────────────────────────────────────────────────────────────────────

  const accentCol = CAT_ACCENT[overlayTab];

  const BlushControls = (
    <View style={oc.section}>
      {/* Preset buttons */}
      <Text style={oc.sectionLabel}>PLACEMENT PRESET</Text>
      <View style={oc.presetRow}>
        {BLUSH_PRESET_ORDER.map(pk => {
          const on = blushPreset === pk;
          return (
            <TouchableOpacity
              key={pk}
              style={[oc.presetBtn, on && oc.presetBtnOn, on && { borderColor: CAT_ACCENT.blush }]}
              onPress={() => setBlushPreset(pk)}
              activeOpacity={0.8}
            >
              <Text style={[oc.presetBtnLabel, on && { color: CAT_ACCENT.blush }]}>
                {BLUSH_PRESETS[pk].label}
              </Text>
              <Text style={oc.presetBtnSub}>{BLUSH_PRESETS[pk].description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Fine adjustment sliders */}
      <View style={oc.sliders}>
        <CssSlider
          label="HORIZONTAL"
          value={blushHOffset}
          min={-MAX_H_OFFSET} max={MAX_H_OFFSET} step={0.005}
          onChange={setBlushHOffset}
          formatValue={v => v === 0 ? 'Center' : `${v > 0 ? '→' : '←'} ${Math.round(Math.abs(v) * 100)}%`}
          color={CAT_ACCENT.blush}
        />
        <CssSlider
          label="VERTICAL"
          value={blushVOffset}
          min={-MAX_V_OFFSET} max={MAX_V_OFFSET} step={0.005}
          onChange={setBlushVOffset}
          formatValue={v => v === 0 ? 'Center' : `${v > 0 ? '↓' : '↑'} ${Math.round(Math.abs(v) * 100)}%`}
          color={CAT_ACCENT.blush}
        />
        <CssSlider
          label="SIZE"
          value={blushScale}
          min={0.4} max={1.8} step={0.05}
          onChange={setBlushScale}
          formatValue={v => `${Math.round(v * 100)}%`}
          color={CAT_ACCENT.blush}
        />
        <CssSlider
          label="OPACITY"
          value={blushOpacity}
          min={0.1} max={1} step={0.01}
          onChange={setBlushOpacity}
          formatValue={v => `${Math.round(v * 100)}%`}
          color={CAT_ACCENT.blush}
        />
      </View>
    </View>
  );

  const ConcealerControls = (
    <View style={oc.section}>
      <Text style={oc.sectionLabel}>PLACEMENT PRESET</Text>
      <View style={oc.presetRow}>
        {CONCEALER_PRESET_ORDER.map(pk => {
          const on = concealerPreset === pk;
          return (
            <TouchableOpacity
              key={pk}
              style={[oc.presetBtn, on && oc.presetBtnOn, on && { borderColor: CAT_ACCENT.concealer }]}
              onPress={() => setConcealerPreset(pk)}
              activeOpacity={0.8}
            >
              <Text style={[oc.presetBtnLabel, on && { color: CAT_ACCENT.concealer }]}>
                {CONCEALER_PRESETS[pk].label}
              </Text>
              <Text style={oc.presetBtnSub}>{CONCEALER_PRESETS[pk].description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={oc.sliders}>
        <CssSlider
          label="HORIZONTAL"
          value={concealerHOffset}
          min={-MAX_H_OFFSET} max={MAX_H_OFFSET} step={0.005}
          onChange={setConcealerHOffset}
          formatValue={v => v === 0 ? 'Center' : `${v > 0 ? '→' : '←'} ${Math.round(Math.abs(v) * 100)}%`}
          color={CAT_ACCENT.concealer}
        />
        <CssSlider
          label="VERTICAL"
          value={concealerVOffset}
          min={-MAX_V_OFFSET} max={MAX_V_OFFSET} step={0.005}
          onChange={setConcealerVOffset}
          formatValue={v => v === 0 ? 'Center' : `${v > 0 ? '↓' : '↑'} ${Math.round(Math.abs(v) * 100)}%`}
          color={CAT_ACCENT.concealer}
        />
        <CssSlider
          label="SIZE"
          value={concealerScale}
          min={0.4} max={1.8} step={0.05}
          onChange={setConcealerScale}
          formatValue={v => `${Math.round(v * 100)}%`}
          color={CAT_ACCENT.concealer}
        />
        <CssSlider
          label="OPACITY"
          value={concealerOpacity}
          min={0.1} max={1} step={0.01}
          onChange={setConcealerOpacity}
          formatValue={v => `${Math.round(v * 100)}%`}
          color={CAT_ACCENT.concealer}
        />
      </View>
    </View>
  );

  const OverlayControls = showOverlayPanel ? (
    <View style={oc.root}>
      {/* Layer type selector */}
      <View style={oc.typeRow}>
        {(['blush', 'concealer'] as OverlayTab[]).map(t => {
          const hasLayer = t === 'blush' ? blushLayers.length > 0 : concealerLayers.length > 0;
          if (!hasLayer) return null;
          const on = overlayTab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[oc.typeBtn, on && oc.typeBtnOn, on && { borderColor: CAT_ACCENT[t] }]}
              onPress={() => setOverlayTab(t)}
              activeOpacity={0.8}
            >
              <View style={[oc.typeDot, { backgroundColor: t === 'blush' ? activeBlushHex : activeConcealerHex }]} />
              <Text style={[oc.typeBtnText, on && { color: CAT_ACCENT[t] }]}>
                {t === 'blush' ? 'Blush' : 'Concealer'}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={oc.resetBtn}
          onPress={overlayTab === 'blush' ? resetBlush : resetConcealer}
          activeOpacity={0.75}
        >
          <RotateCcw size={10} color={Colors.textMuted} strokeWidth={2} />
          <Text style={oc.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {overlayTab === 'blush' ? BlushControls : ConcealerControls}
    </View>
  ) : null;

  // ─────────────────────────────────────────────────────────────────────────
  // CONTROL PANEL
  // ─────────────────────────────────────────────────────────────────────────

  const ControlPanel = (
    <View style={cp.root}>

      <View style={cp.tabRow}>
        {CAT_ORDER.map(cat => {
          const on = cat === activeTab;
          return (
            <TouchableOpacity key={cat}
              style={[cp.tab, on && cp.tabOn, on && { borderColor: CAT_ACCENT[cat] + '99' }]}
              onPress={() => switchTab(cat)} activeOpacity={0.75}
            >
              <Text style={cp.tabEmoji}>
                {cat === 'lipstick' ? '💄' : cat === 'blush' ? '🌸' : cat === 'concealer' ? '✨' : '🫧'}
              </Text>
              <Text style={[cp.tabLabel, on && { color: CAT_ACCENT[cat] }]}>{CAT_LABEL[cat]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={cp.sep} />

      {OverlayControls}
      {OverlayControls && <View style={cp.sep} />}

      {/* Products */}
      <View style={cp.section}>
        <Text style={cp.sectionHead}>{CAT_LABEL[activeTab].toUpperCase()} — {CAT_ZONE[activeTab]}</Text>

        {tabProducts.length === 0 && (
          <View style={cp.emptyTab}>
            <Text style={cp.emptyTabText}>No products found for this category</Text>
          </View>
        )}

        {tabProducts.map(product => {
          const pickedShade = pickedShades[product.id] ?? product.shades[0];
          return (
            <View key={product.id} style={cp.productCard}>
              <View style={cp.productTop}>
                <View style={[cp.productDot, { backgroundColor: CAT_ACCENT[activeTab] }]} />
                <Text style={cp.productName}>{product.name}</Text>
                <Text style={cp.productPrice}>SAR {product.price}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cp.swatchRow}>
                {product.shades.map(shade => {
                  const on = pickedShade.id === shade.id;
                  return (
                    <TouchableOpacity key={shade.id} style={cp.swatchWrap}
                      onPress={() => setPickedShades(p => ({ ...p, [product.id]: shade }))} activeOpacity={0.8}
                    >
                      <View style={[cp.swatchCircle, { backgroundColor: shade.hex }, on && { borderColor: '#fff', borderWidth: 2.5 }]}>
                        {on && <Check size={10} color="#fff" strokeWidth={3} />}
                      </View>
                      <Text style={[cp.swatchName, on && cp.swatchNameOn]} numberOfLines={1}>{shade.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[cp.applyBtn, { backgroundColor: CAT_ACCENT[activeTab] + '22', borderColor: CAT_ACCENT[activeTab] + '66' }]}
                onPress={() => addLayer(product, pickedShade)} activeOpacity={0.85}
              >
                <Plus size={12} color={CAT_ACCENT[activeTab]} strokeWidth={2.5} />
                <Text style={[cp.applyBtnText, { color: CAT_ACCENT[activeTab] }]}>Apply {pickedShade.name}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={cp.sep} />

      {/* Layer stack */}
      <View style={cp.section}>
        <View style={cp.layerHead}>
          <Layers size={11} color={Colors.textSecondary} strokeWidth={2} />
          <Text style={cp.sectionHead}>ACTIVE LAYERS ({layers.length})</Text>
          <View style={{ flex: 1 }} />
          {layers.length > 0 && (
            <TouchableOpacity style={cp.clearBtn} onPress={clearAllLayers} activeOpacity={0.75}>
              <Trash2 size={9} color={Colors.error} strokeWidth={2} />
              <Text style={cp.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
        {layers.length === 0 ? (
          <View style={cp.emptyStack}>
            <Text style={cp.emptyStackText}>No layers yet — select a shade above and tap Apply</Text>
          </View>
        ) : (
          <View style={cp.layerStack}>
            {layers.map((layer, idx) => (
              <LayerRow key={layer.id} layer={layer} index={idx + 1}
                onToggleVis={() => updateLayer(layer.id, { visible: !layer.visible })}
                onRemove={() => removeLayer(layer.id)}
                onIntensity={v => updateLayer(layer.id, { intensity: v })}
              />
            ))}
          </View>
        )}
      </View>

      <View style={cp.sep} />

      {/* Actions */}
      <View style={cp.actionRow}>
        {imageUri && (
          <TouchableOpacity
            style={[cp.saveBtn, saveState === 'ok' && cp.saveBtnOk, saveState === 'err' && cp.saveBtnErr]}
            onPress={saveLook} activeOpacity={0.85}
          >
            {saveState === 'ok'
              ? <CircleCheckIcon size={13} color="#fff" strokeWidth={2.5} />
              : <Download size={13} color={Colors.neonBlue} strokeWidth={2} />}
            <Text style={[cp.saveBtnText, (saveState === 'ok' || saveState === 'err') && { color: '#fff' }]}>
              {saveState === 'ok' ? 'SAVED!' : saveState === 'err' ? 'FAILED' : 'SAVE LOOK'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[cp.cartBtn, imageUri && cp.cartBtnNarrow]} onPress={addToCart} activeOpacity={0.85}>
          <ShoppingCart size={14} color="#fff" strokeWidth={2.5} />
          <Text style={cp.cartBtnText}>ADD TO CART</Text>
        </TouchableOpacity>
      </View>

      <View style={cp.modelStatus}>
        <View style={[cp.dot, modelReady ? cp.dotGreen : modelLoad ? cp.dotYellow : cp.dotGray]} />
        <Text style={cp.modelText}>
          {modelReady ? 'AI face detection ready' : modelLoad ? 'Loading AI model…' : 'AI model idle'}
        </Text>
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL LAYOUT
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={m.overlay}>
        <View style={[m.sheet, narrow ? m.sheetNarrow : m.sheetWide]}>

          <View style={m.header}>
            <View style={m.headerLeft}>
              <View style={m.sparkle}>
                <Sparkles size={13} color={Colors.neonBlue} strokeWidth={2} />
              </View>
              <View>
                <Text style={m.title}>Virtual Try-On</Text>
                <Text style={m.subtitle}>{productName} · {layers.length} layer{layers.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <TouchableOpacity style={m.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <X size={15} color={Colors.textMuted} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {narrow ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={m.narrowPreview}>{PreviewPane}</View>
              {ControlPanel}
              <View style={{ height: 40 }} />
            </ScrollView>
          ) : (
            <View style={m.wideBody}>
              <View style={m.wideLeft}>{PreviewPane}</View>
              <ScrollView style={m.wideRight} showsVerticalScrollIndicator={false}>
                {ControlPanel}
                <View style={{ height: 32 }} />
              </ScrollView>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

// ─── LayerRow ─────────────────────────────────────────────────────────────────

const INTENSITY_STEPS = [0.2, 0.4, 0.6, 0.8, 1.0];

function LayerRow({ layer, index, onToggleVis, onRemove, onIntensity }: {
  layer: Layer; index: number;
  onToggleVis: () => void; onRemove: () => void; onIntensity: (v: number) => void;
}) {
  const nearestStep = INTENSITY_STEPS.reduce((best, v) =>
    Math.abs(v - layer.intensity) < Math.abs(best - layer.intensity) ? v : best,
  INTENSITY_STEPS[0]);
  const accent = CAT_ACCENT[layer.type];
  return (
    <View style={[lr.row, !layer.visible && lr.rowOff]}>
      <View style={[lr.dot, { backgroundColor: layer.shade.hex }]} />
      <View style={lr.info}>
        <View style={lr.topRow}>
          <Text style={[lr.name, !layer.visible && lr.nameOff]} numberOfLines={1}>{layer.shade.name}</Text>
          <View style={[lr.badge, { backgroundColor: accent + '20', borderColor: accent + '55' }]}>
            <Text style={[lr.badgeText, { color: accent }]}>{CAT_LABEL[layer.type]}</Text>
          </View>
        </View>
        <Text style={lr.meta}>{layer.productName} · {CAT_ZONE[layer.type]}</Text>
        {layer.visible && (
          <View style={lr.intensityRow}>
            <Text style={lr.intLabel}>Intensity</Text>
            <View style={lr.track}>
              {INTENSITY_STEPS.map(v => {
                const active = v === nearestStep;
                return (
                  <TouchableOpacity key={v} onPress={() => onIntensity(v)} activeOpacity={0.75} style={lr.trackHit}>
                    <View style={[lr.trackDot, { backgroundColor: layer.shade.hex, opacity: 0.3 + v * 0.7 }, active && lr.trackDotActive]} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[lr.intVal, { color: accent }]}>{Math.round(nearestStep * 100)}%</Text>
          </View>
        )}
      </View>
      <View style={lr.controls}>
        <TouchableOpacity style={lr.ctrlBtn} onPress={onToggleVis} activeOpacity={0.75}>
          {layer.visible ? <Eye size={12} color={Colors.neonBlue} strokeWidth={2} /> : <EyeOff size={12} color={Colors.textMuted} strokeWidth={2} />}
        </TouchableOpacity>
        <TouchableOpacity style={lr.ctrlBtn} onPress={onRemove} activeOpacity={0.75}>
          <Trash2 size={12} color={Colors.error} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(4,2,3,0.92)', justifyContent: 'center', alignItems: 'center' },
  sheet:        { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, overflow: 'hidden', maxHeight: '96%' },
  sheetNarrow:  { width: '100%', height: '100%', borderRadius: 0 },
  sheetWide:    { width: 980, maxWidth: '97%' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.backgroundSecondary },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sparkle:      { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder, justifyContent: 'center', alignItems: 'center' },
  title:        { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  subtitle:     { color: Colors.textMuted, fontSize: 10, fontWeight: '500', marginTop: 1 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  narrowPreview:{ padding: Spacing.md, alignItems: 'center' },
  wideBody:     { flexDirection: 'row', flex: 1, minHeight: 580 },
  wideLeft:     { padding: Spacing.lg, alignItems: 'center', justifyContent: 'flex-start' },
  wideRight:    { flex: 1, borderLeftWidth: 1, borderLeftColor: Colors.border },
});

const pv = StyleSheet.create({
  root:         { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.backgroundSecondary, borderWidth: 2, borderColor: Colors.neonBlueBorder, position: 'relative', ...Shadow.neonBlue },
  uploadArea:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: Spacing.xl },
  uploadRing:   { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.neonBlueGlow, borderWidth: 2, borderColor: Colors.neonBlueBorder, justifyContent: 'center', alignItems: 'center' },
  uploadTitle:  { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800', marginTop: 6 },
  uploadSub:    { color: Colors.textSecondary, fontSize: FontSize.xs },
  uploadCta:    { marginTop: 10, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: Colors.neonBlueGlow, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.neonBlueBorder },
  uploadCtaText:{ color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '800' },
  spinnerLayer: { position: 'absolute', inset: 0 as any, backgroundColor: 'rgba(4,2,3,0.65)', justifyContent: 'center', alignItems: 'center', gap: 10 },
  spinnerText:  { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' },
  alertBadge:   { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(4,2,3,0.88)', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,179,0,0.4)' },
  alertText:    { color: Colors.warning, fontSize: 9, fontWeight: '700' },
  layerBadge:   { position: 'absolute', bottom: 46, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(4,2,3,0.82)', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.neonBlueBorder },
  layerBadgeText:{ color: Colors.neonBlue, fontSize: 9, fontWeight: '700' },
  errBadge:     { position: 'absolute', top: 10, left: 10, right: 10, backgroundColor: 'rgba(255,68,68,0.12)', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,68,68,0.35)' },
  errText:      { color: Colors.error, fontSize: 9, fontWeight: '600' },
  baStrip:      { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', gap: 3, backgroundColor: 'rgba(4,2,3,0.78)', borderRadius: Radius.full, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  baChip:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  baChipOn:     { backgroundColor: Colors.neonBlue },
  baChipText:   { color: Colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  baChipTextOn: { color: '#fff' },
  photoCtrl:    { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', gap: 5 },
  photoBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(4,2,3,0.82)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.neonBlueBorder },
  photoBtnText: { color: Colors.neonBlue, fontSize: 9, fontWeight: '700' },
  photoBtnSm:   { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(4,2,3,0.82)', borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
});

const oc = StyleSheet.create({
  root:          { backgroundColor: 'rgba(255,143,163,0.05)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(255,143,163,0.18)', padding: 10, gap: 10, marginHorizontal: -Spacing.md + 4 },
  typeRow:       { flexDirection: 'row', gap: 6, alignItems: 'center' },
  typeBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard },
  typeBtnOn:     { backgroundColor: 'rgba(255,143,163,0.15)' },
  typeDot:       { width: 8, height: 8, borderRadius: 4 },
  typeBtnText:   { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  resetBtn:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard },
  resetBtnText:  { color: Colors.textMuted, fontSize: 8, fontWeight: '700' },
  section:       { gap: 8 },
  sectionLabel:  { color: Colors.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  presetRow:     { flexDirection: 'row', gap: 5 },
  presetBtn:     { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard, gap: 2 },
  presetBtnOn:   { backgroundColor: 'rgba(255,143,163,0.12)' },
  presetBtnLabel:{ color: Colors.textSecondary, fontSize: 9, fontWeight: '800' },
  presetBtnSub:  { color: Colors.textMuted, fontSize: 7, fontWeight: '500' },
  sliders:       { gap: 9 },
});

const cp = StyleSheet.create({
  root:         { padding: Spacing.md, gap: 12 },
  sep:          { height: 1, backgroundColor: Colors.border, marginHorizontal: -Spacing.md },
  tabRow:       { flexDirection: 'row', gap: 5 },
  tab:          { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard, gap: 2 },
  tabOn:        { backgroundColor: Colors.neonBlueGlow },
  tabEmoji:     { fontSize: 14 },
  tabLabel:     { color: Colors.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  section:      { gap: 8 },
  sectionHead:  { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  productCard:  { backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 10, gap: 8 },
  productTop:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  productDot:   { width: 7, height: 7, borderRadius: 4 },
  productName:  { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  productPrice: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  swatchRow:    { gap: 8, paddingVertical: 2 },
  swatchWrap:   { alignItems: 'center', gap: 3, width: 46 },
  swatchCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  swatchName:   { color: Colors.textMuted, fontSize: 7, fontWeight: '600', textAlign: 'center' },
  swatchNameOn: { color: Colors.textPrimary, fontWeight: '800' },
  applyBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.full, paddingVertical: 8, borderWidth: 1 },
  applyBtnText: { fontSize: FontSize.xs, fontWeight: '800' },
  layerHead:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  clearBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: 'rgba(255,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.25)' },
  clearBtnText: { color: Colors.error, fontSize: 8, fontWeight: '700' },
  emptyStack:   { paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: Radius.md },
  emptyStackText:{ color: Colors.textMuted, fontSize: FontSize.xs },
  emptyTab:     { paddingVertical: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: Radius.md },
  emptyTabText: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center' },
  layerStack:   { gap: 7 },
  actionRow:    { flexDirection: 'row', gap: 8 },
  saveBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.full, paddingVertical: 12, backgroundColor: Colors.backgroundCard, borderWidth: 1.5, borderColor: Colors.neonBlueBorder },
  saveBtnOk:    { backgroundColor: Colors.successDim, borderColor: Colors.success },
  saveBtnErr:   { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  saveBtnText:  { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '900', letterSpacing: 0.8 },
  cartBtn:      { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: Colors.neonBlue, borderRadius: Radius.full, paddingVertical: 12, ...Shadow.neonBlue },
  cartBtnNarrow:{ flex: 1.4 },
  cartBtnText:  { color: '#fff', fontSize: FontSize.xs, fontWeight: '900', letterSpacing: 0.8 },
  modelStatus:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:          { width: 6, height: 6, borderRadius: 3 },
  dotGreen:     { backgroundColor: Colors.success },
  dotYellow:    { backgroundColor: Colors.warning },
  dotGray:      { backgroundColor: Colors.textMuted },
  modelText:    { color: Colors.textMuted, fontSize: 9, fontWeight: '600' },
});

const lr = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 10 },
  rowOff:        { opacity: 0.38 },
  dot:           { width: 20, height: 20, borderRadius: 10, marginTop: 2, flexShrink: 0, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  info:          { flex: 1, gap: 2 },
  topRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name:          { color: Colors.textPrimary, fontSize: 12, fontWeight: '700', flex: 1 },
  nameOff:       { color: Colors.textMuted },
  badge:         { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1 },
  badgeText:     { fontSize: 8, fontWeight: '800' },
  meta:          { color: Colors.textMuted, fontSize: 9, fontWeight: '500' },
  intensityRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  intLabel:      { color: Colors.textMuted, fontSize: 9, fontWeight: '700', width: 48 },
  intVal:        { fontSize: 9, fontWeight: '800', width: 28, textAlign: 'right' },
  track:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 20 },
  trackHit:      { padding: 3 },
  trackDot:      { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  trackDotActive:{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  controls:      { flexDirection: 'column', gap: 4 },
  ctrlBtn:       { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
});
