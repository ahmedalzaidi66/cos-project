import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Upload, RefreshCw, Eye, EyeOff, ImagePlus, Sparkles, CircleAlert as AlertCircle, User, FolderOpen, RotateCcw, Heart, ShoppingCart, X, Check } from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import { useLanguage } from '@/context/LanguageContext';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';
import { supabase, type Product, type ProductShade, getProductImage } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import {
  renderTryOn,
  initFaceLandmarker,
  isFaceLandmarkerReady,
  getDefaultFinish,
  type TryOnProduct,
  type ShadeOption,
  type TryOnCategory,
  type FinishType,
  type RenderResult,
} from '@/lib/virtualTryOn';

const CANVAS_SIZE = 500;

type FaceMode = 'model' | 'upload';
type OverlayType = 'blush' | 'concealer';
type BlushPreset = 'low' | 'mid' | 'high' | 'lifted';
type ConcealerPreset = 'natural' | 'brightening' | 'full';

// Base placement configs: left cheek/eye positions as fraction of image.
// Right side is mirrored (xPct = 1 - left.xPct).
const BLUSH_BASES: Record<BlushPreset, { xPct: number; yPct: number; rx: number; ry: number; rotation: number }> = {
  low:    { xPct: 0.33, yPct: 0.60, rx: 0.145, ry: 0.090, rotation: -10 },
  mid:    { xPct: 0.35, yPct: 0.54, rx: 0.145, ry: 0.090, rotation: -15 },
  high:   { xPct: 0.34, yPct: 0.47, rx: 0.138, ry: 0.085, rotation: -20 },
  lifted: { xPct: 0.29, yPct: 0.44, rx: 0.130, ry: 0.080, rotation: -28 },
};

const CONCEALER_BASES: Record<ConcealerPreset, { xPct: number; yPct: number; rx: number; ry: number; rotation: number }> = {
  natural:     { xPct: 0.39, yPct: 0.44, rx: 0.068, ry: 0.042, rotation: -6 },
  brightening: { xPct: 0.39, yPct: 0.43, rx: 0.085, ry: 0.053, rotation: -8 },
  full:        { xPct: 0.38, yPct: 0.45, rx: 0.110, ry: 0.068, rotation: -10 },
};

const BLUSH_PRESET_LABELS: Record<BlushPreset, { label: string; desc: string }> = {
  low:    { label: 'Low',    desc: 'Under cheek' },
  mid:    { label: 'Mid',    desc: 'Center cheek' },
  high:   { label: 'High',   desc: 'Cheekbone' },
  lifted: { label: 'Lifted', desc: 'Temple' },
};

const CONCEALER_PRESET_LABELS: Record<ConcealerPreset, { label: string; desc: string }> = {
  natural:     { label: 'Natural',    desc: 'Small under-eye' },
  brightening: { label: 'Brighten',   desc: 'Med triangle' },
  full:        { label: 'Full',       desc: 'Full coverage' },
};

const BLUSH_PRESET_ORDER: BlushPreset[]     = ['low', 'mid', 'high', 'lifted'];
const CONCEALER_PRESET_ORDER: ConcealerPreset[] = ['natural', 'brightening', 'full'];

const CATEGORY_LABELS: Record<TryOnCategory, string> = {
  lipstick: 'LIPSTICK',
  blush: 'BLUSH',
  concealer: 'CONCEALER',
  foundation: 'FOUNDATION',
};

const CATEGORY_ORDER: TryOnCategory[] = ['lipstick', 'blush', 'concealer', 'foundation'];

const FINISH_LABELS: Record<FinishType, string> = {
  matte: 'Matte',
  gloss: 'Gloss',
  satin: 'Satin',
  dewy: 'Dewy',
};

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padEnd(6, '0');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ─── SVG overlay for a single makeup spot (left or right) ────────────────────

interface OverlaySpotSvgProps {
  cx: number; cy: number;
  rx: number; ry: number;
  rotation: number;
  hex: string;
  opacity: number;
  gradId: string;
}

function OverlaySpotSvg({ cx, cy, rx, ry, rotation, hex, opacity, gradId }: OverlaySpotSvgProps) {
  const [r, g, b] = hexToRgb(hex);
  return (
    <>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={`rgb(${r},${g},${b})`} stopOpacity={opacity} />
          <stop offset="30%"  stopColor={`rgb(${r},${g},${b})`} stopOpacity={opacity * 0.80} />
          <stop offset="60%"  stopColor={`rgb(${r},${g},${b})`} stopOpacity={opacity * 0.40} />
          <stop offset="82%"  stopColor={`rgb(${r},${g},${b})`} stopOpacity={opacity * 0.10} />
          <stop offset="100%" stopColor={`rgb(${r},${g},${b})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={`rotate(${rotation},${cx},${cy})`}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${gradId})`} />
      </g>
    </>
  );
}

// ─── Web-only SVG overlay layer ───────────────────────────────────────────────

interface OverlayLayerProps {
  previewSize: number;
  type: OverlayType;
  blushPreset: BlushPreset;
  concealerPreset: ConcealerPreset;
  hOffset: number;
  vOffset: number;
  size: number;
  opacity: number;
  hex: string;
}

function OverlayLayer({
  previewSize, type,
  blushPreset, concealerPreset,
  hOffset, vOffset, size, opacity, hex,
}: OverlayLayerProps) {
  const base = type === 'blush'
    ? BLUSH_BASES[blushPreset]
    : CONCEALER_BASES[concealerPreset];

  const ps = previewSize;

  // Left position after offset
  const lx = clamp(base.xPct - hOffset, 0.04, 0.96) * ps;
  const ly = clamp(base.yPct + vOffset, 0.04, 0.96) * ps;
  // Right position: mirror X, same Y
  const rx = clamp((1 - base.xPct) + hOffset, 0.04, 0.96) * ps;
  const ry = clamp(base.yPct + vOffset, 0.04, 0.96) * ps;

  const ellRx = base.rx * size * ps;
  const ellRy = base.ry * size * ps;

  return (
    <svg
      width={ps}
      height={ps}
      style={{
        position: 'absolute', top: 0, left: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        mixBlendMode: 'multiply' as any,
        filter: 'saturate(1.25) contrast(1.08)',
      } as React.CSSProperties}
    >
      <OverlaySpotSvg
        cx={lx} cy={ly} rx={ellRx} ry={ellRy}
        rotation={base.rotation}
        hex={hex} opacity={opacity}
        gradId={`ovl-left-${type}`}
      />
      <OverlaySpotSvg
        cx={rx} cy={ry} rx={ellRx} ry={ellRy}
        rotation={-base.rotation}
        hex={hex} opacity={opacity}
        gradId={`ovl-right-${type}`}
      />
    </svg>
  );
}

// ─── Canopy tab → TryOnCategory mapping ──────────────────────────────────────

function nameContains(name: string, ...terms: string[]): boolean {
  const lower = name.toLowerCase();
  return terms.some(t => lower.includes(t));
}

function faceProductToTryOnCategory(name: string): TryOnCategory | null {
  if (nameContains(name, 'blush', 'blusher')) return 'blush';
  if (nameContains(name, 'foundation')) return 'foundation';
  if (nameContains(name, 'concealer')) return 'concealer';
  return null;
}

// ─── DB products hook ─────────────────────────────────────────────────────────

type CanopyProductMap = Record<TryOnCategory, TryOnProduct[]>;

function useCanopyProducts(): { productMap: CanopyProductMap; loading: boolean } {
  const [productMap, setProductMap] = useState<CanopyProductMap>({
    lipstick: [], blush: [], foundation: [], concealer: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Fetch all active makeup products that have a makeup_subcategory
        const { data: dbProducts } = await supabase
          .from('products')
          .select('id, name, category, makeup_subcategory, price, image_url, main_image')
          .eq('category', 'makeup')
          .not('makeup_subcategory', 'is', null)
          .eq('status', 'active');

        if (!dbProducts || dbProducts.length === 0) {
          setLoading(false);
          return;
        }

        const productIds = dbProducts.map((p: any) => p.id);
        const { data: allShades } = await supabase
          .from('product_shades')
          .select('id, product_id, name, color_hex, shade_image, product_image, sort_order')
          .in('product_id', productIds)
          .order('sort_order', { ascending: true });

        const shadesByProduct = new Map<string, ProductShade[]>();
        (allShades ?? []).forEach((s: any) => {
          const list = shadesByProduct.get(s.product_id) ?? [];
          list.push(s);
          shadesByProduct.set(s.product_id, list);
        });

        const map: CanopyProductMap = { lipstick: [], blush: [], foundation: [], concealer: [] };

        for (const p of dbProducts) {
          const pShades = shadesByProduct.get(p.id) ?? [];
          // Products without shades still appear — they just won't have color picks
          let tryOnCat: TryOnCategory | null = null;

          if (p.makeup_subcategory === 'lips') {
            tryOnCat = 'lipstick';
          } else if (p.makeup_subcategory === 'face') {
            tryOnCat = faceProductToTryOnCategory(p.name ?? '');
          }
          // 'eye' and 'nail' are not in scope for try-on tabs — skip
          if (!tryOnCat) continue;

          map[tryOnCat].push({
            id: p.id,
            name: p.name,
            category: tryOnCat,
            finish: getDefaultFinish(tryOnCat),
            imageUrl: p.main_image || p.image_url || '',
            price: p.price,
            shades: pShades.map((s) => ({
              id: s.id,
              name: s.name || 'Shade',
              hex: s.color_hex || '#CC9988',
              imageUrl: s.shade_image || s.product_image || '',
            })),
          });
        }

        setProductMap(map);
      } catch (e) {
        console.error('[Canopy] Failed to load products:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { productMap, loading };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const PLACEHOLDER_SHADE: ShadeOption = { id: '__placeholder__', name: 'No shades', hex: '#CC9988', imageUrl: '' };
const PLACEHOLDER_PRODUCT: TryOnProduct = {
  id: '__placeholder__', name: '', category: 'lipstick', finish: 'matte',
  imageUrl: '', price: 0, shades: [PLACEHOLDER_SHADE],
};

// Bridge TryOnProduct → minimal Product shape required by cart/wishlist contexts
function tryOnToProduct(p: TryOnProduct): Product {
  return {
    id: p.id, name: p.name, slug: null, price: p.price, compare_price: null,
    category: p.category, category_id: null, rating: 0, review_count: 0,
    description: '', image_url: p.imageUrl, main_image: p.imageUrl,
    images: [p.imageUrl], stock: 99, badge: null, is_featured: false,
    featured: null, status: 'active', sku: null, specifications: null,
    try_on_type: p.category, makeup_subcategory: null,
    name_ar: null, name_es: null, name_de: null,
    description_ar: null, description_es: null, description_de: null,
    created_at: '', updated_at: null, translation: null,
  } as any;
}

export default function VirtualTryOnScreen() {
  const { width: screenW } = useWindowDimensions();
  const { productMap, loading: dbLoading } = useCanopyProducts();
  const { addToCart } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const { language } = useLanguage();

  // Quick preview popup
  const [previewProduct, setPreviewProduct] = useState<TryOnProduct | null>(null);
  const [previewShade, setPreviewShade] = useState<ShadeOption | null>(null);

  // In-canopy cart feedback toast
  const [cartToast, setCartToast] = useState<string | null>(null);
  const cartToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCartToast = useCallback((msg: string) => {
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
    setCartToast(msg);
    cartToastTimer.current = setTimeout(() => setCartToast(null), 2200);
  }, []);

  const handleAddToCart = useCallback((product: TryOnProduct, shade?: ShadeOption | null) => {
    const cartShade = shade && shade.id !== '__placeholder__'
      ? { id: shade.id, name: shade.name, color_hex: shade.hex, shade_image: shade.imageUrl, product_image: '' }
      : null;
    addToCart(tryOnToProduct(product), 1, cartShade);
    showCartToast('Added to cart');
  }, [addToCart, showCartToast]);

  const [faceMode, setFaceMode] = useState<FaceMode>('model');
  const [userImageUri, setUserImageUri] = useState<string | null>(null);
  const [savedModelUrl, setSavedModelUrl] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<TryOnProduct>(PLACEHOLDER_PRODUCT);
  const [selectedShade, setSelectedShade] = useState<ShadeOption>(PLACEHOLDER_SHADE);
  const [showOriginal, setShowOriginal] = useState(false);
  const [intensity, setIntensity] = useState(0.5);
  const [hasRendered, setHasRendered] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [modelReady, setModelReady] = useState(isFaceLandmarkerReady());
  const [modelLoading, setModelLoading] = useState(false);
  const [faceDetected, setFaceDetected] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  // ── Overlay placement state ─────────────────────────────────────────────
  const [selectedOverlay, setSelectedOverlay] = useState<OverlayType>('blush');
  const [blushPreset,     setBlushPreset]     = useState<BlushPreset>('mid');
  const [concealerPreset, setConcealerPreset] = useState<ConcealerPreset>('brightening');

  const imageUri = faceMode === 'model' ? savedModelUrl : userImageUri;

  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const imgRef      = useRef<HTMLImageElement  | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const renderIdRef = useRef(0);

  const previewSize = Math.min(screenW - 32, CANVAS_SIZE);

  // Show overlay when applicable category is selected and image is present
  const isBlushCategory     = selectedProduct.category === 'blush';
  const isConcealerCategory = selectedProduct.category === 'concealer';
  const showOverlayPanel    = imageUri && !showOriginal && (isBlushCategory || isConcealerCategory);
  const showBlushOverlay    = imageUri && !showOriginal && isBlushCategory;
  const showConcealerOverlay = imageUri && !showOriginal && isConcealerCategory;

  // Accent color for controls
  const overlayAccent = selectedOverlay === 'blush' ? '#FF8FA3' : '#FFB3A7';

  // ── Init face model ────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isFaceLandmarkerReady()) { setModelReady(true); return; }
    setModelLoading(true);
    initFaceLandmarker()
      .then(() => { setModelReady(true); setModelLoading(false); })
      .catch(() => { setModelLoading(false); });
  }, []);

  // ── Fetch admin model image from DB — re-runs each time screen is focused ─
  useFocusEffect(
    useCallback(() => {
      supabase
        .from('site_settings').select('value')
        .eq('key', 'tryon_model_image_url').maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error('[Canopy] Failed to load model image from site_settings:', error);
            return;
          }
          const url = data?.value || null;
          setSavedModelUrl(url);
        })
        .catch((err) => {
          console.error('[Canopy] Unexpected error loading model image:', err);
        });
    }, [])
  );

  // ── Sync first available product when data loads ───────────────────────
  useEffect(() => {
    const first =
      productMap.lipstick[0] ??
      productMap.blush[0] ??
      productMap.foundation[0] ??
      productMap.concealer[0];
    if (first) {
      setSelectedProduct(first);
      setSelectedShade(first.shades[0] ?? PLACEHOLDER_SHADE);
    }
  }, [productMap]);

  // ── Sync overlay tab to category ──────────────────────────────────────
  useEffect(() => {
    if (selectedProduct.category === 'blush') setSelectedOverlay('blush');
    else if (selectedProduct.category === 'concealer') setSelectedOverlay('concealer');
  }, [selectedProduct.category]);

  // ── Canvas render ──────────────────────────────────────────────────────
  const doRender = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    if (!canvasRef.current || !imgRef.current || !imgRef.current.complete) return;

    const id = ++renderIdRef.current;
    setIsRendering(true);
    setRenderError(null);

    try {
      const result: RenderResult = await renderTryOn(
        canvasRef.current,
        imgRef.current,
        selectedProduct.category,
        selectedShade?.hex || '#CC9988',
        intensity,
        selectedProduct.finish,
      );
      if (id !== renderIdRef.current) return;
      if (!result.success) {
        setRenderError(result.error ?? 'Rendering failed');
        setFaceDetected(false);
      } else {
        setFaceDetected(result.faceDetected);
        setRenderError(null);
        setHasRendered(true);
      }
    } catch (e: any) {
      if (id === renderIdRef.current) setRenderError(e?.message ?? 'Unknown error');
    } finally {
      if (id === renderIdRef.current) {
        setIsRendering(false);
        if (!modelReady && isFaceLandmarkerReady()) {
          setModelReady(true);
          setModelLoading(false);
        }
      }
    }
  }, [selectedProduct, selectedShade, intensity, modelReady]);

  useEffect(() => {
    if (!imageUri || showOriginal) return;
    doRender();
  }, [imageUri, selectedShade, selectedProduct, intensity, showOriginal, doRender]);

  // ── Photo controls ─────────────────────────────────────────────────────
  const handlePickImage = useCallback(() => {
    if (Platform.OS !== 'web') return;
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
      document.body.appendChild(input);
      fileInputRef.current = input;
    }
    const input = fileInputRef.current!;
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        setUserImageUri(URL.createObjectURL(file));
        setFaceMode('upload');
        setShowOriginal(false);
        setHasRendered(false);
        setFaceDetected(true);
        setRenderError(null);
      }
      input.value = '';
    };
    input.click();
  }, []);

  const handleImageLoad = useCallback(() => {
    if (!canvasRef.current || !imgRef.current) return;
    canvasRef.current.width = CANVAS_SIZE;
    canvasRef.current.height = CANVAS_SIZE;
    doRender();
  }, [doRender]);

  const handleSelectProduct = useCallback((product: TryOnProduct) => {
    setSelectedProduct(product);
    setSelectedShade(product.shades[0] ?? PLACEHOLDER_SHADE);
  }, []);

  const handleReset = useCallback(() => {
    setFaceMode('model');
    setUserImageUri(null);
    setHasRendered(false);
    setShowOriginal(false);
    setFaceDetected(true);
    setRenderError(null);
  }, []);

  const handleSwitchMode = useCallback((mode: FaceMode) => {
    if (mode === faceMode) return;
    setFaceMode(mode);
    setShowOriginal(false);
    setHasRendered(false);
    setFaceDetected(true);
    setRenderError(null);
  }, [faceMode]);

  const toggleOriginal = useCallback(() => {
    setShowOriginal(prev => {
      const next = !prev;
      if (!next) requestAnimationFrame(() => { doRender(); });
      return next;
    });
  }, [doRender]);

  // ── Preset change handlers with console log ────────────────────────────
  const handleBlushPreset = useCallback((p: BlushPreset) => {
    setBlushPreset(p);
    console.log('CANOPY OVERLAY UPDATED', 'blush', p);
  }, []);

  const handleConcealerPreset = useCallback((p: ConcealerPreset) => {
    setConcealerPreset(p);
    console.log('CANOPY OVERLAY UPDATED', 'concealer', p);
  }, []);

  const resetBlush = useCallback(() => {
    setBlushPreset('mid');
    console.log('CANOPY OVERLAY UPDATED', 'blush', 'reset');
  }, []);

  const resetConcealer = useCallback(() => {
    setConcealerPreset('brightening');
    console.log('CANOPY OVERLAY UPDATED', 'concealer', 'reset');
  }, []);

  const categoryProducts = (cat: TryOnCategory) => productMap[cat] ?? [];

  // ── Overlay controls panel (web only) ─────────────────────────────────
  const OverlayControls = Platform.OS === 'web' && showOverlayPanel ? (
    <View style={styles.overlayPanel}>
      {/* Type selector */}
      <View style={styles.overlayTypeRow}>
        {isBlushCategory && (
          <TouchableOpacity
            style={[styles.overlayTypeBtn, selectedOverlay === 'blush' && styles.overlayTypeBtnOn, selectedOverlay === 'blush' && { borderColor: '#FF8FA3' }]}
            onPress={() => setSelectedOverlay('blush')}
            activeOpacity={0.8}
          >
            <View style={[styles.overlayTypeDot, { backgroundColor: selectedShade?.hex || '#CC9988' }]} />
            <Text style={[styles.overlayTypeBtnText, selectedOverlay === 'blush' && { color: '#FF8FA3' }]}>Blush</Text>
          </TouchableOpacity>
        )}
        {isConcealerCategory && (
          <TouchableOpacity
            style={[styles.overlayTypeBtn, selectedOverlay === 'concealer' && styles.overlayTypeBtnOn, selectedOverlay === 'concealer' && { borderColor: '#FFB3A7' }]}
            onPress={() => setSelectedOverlay('concealer')}
            activeOpacity={0.8}
          >
            <View style={[styles.overlayTypeDot, { backgroundColor: selectedShade?.hex || '#CC9988' }]} />
            <Text style={[styles.overlayTypeBtnText, selectedOverlay === 'concealer' && { color: '#FFB3A7' }]}>Concealer</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.overlayResetBtn}
          onPress={selectedOverlay === 'blush' ? resetBlush : resetConcealer}
          activeOpacity={0.75}
        >
          <RotateCcw size={11} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.overlayResetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Blush controls */}
      {selectedOverlay === 'blush' && (
        <>
          <Text style={styles.overlaySubLabel}>PLACEMENT PRESET</Text>
          <View style={styles.presetRow}>
            {BLUSH_PRESET_ORDER.map(pk => {
              const on = blushPreset === pk;
              return (
                <TouchableOpacity
                  key={pk}
                  style={[styles.presetBtn, on && styles.presetBtnOn, on && { borderColor: '#FF8FA3' }]}
                  onPress={() => handleBlushPreset(pk)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.presetBtnLabel, on && { color: '#FF8FA3' }]}>
                    {BLUSH_PRESET_LABELS[pk].label}
                  </Text>
                  <Text style={styles.presetBtnSub}>{BLUSH_PRESET_LABELS[pk].desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Concealer controls */}
      {selectedOverlay === 'concealer' && (
        <>
          <Text style={styles.overlaySubLabel}>PLACEMENT PRESET</Text>
          <View style={styles.presetRow}>
            {CONCEALER_PRESET_ORDER.map(pk => {
              const on = concealerPreset === pk;
              return (
                <TouchableOpacity
                  key={pk}
                  style={[styles.presetBtn, on && styles.presetBtnOn, on && { borderColor: '#FFB3A7' }]}
                  onPress={() => handleConcealerPreset(pk)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.presetBtnLabel, on && { color: '#FFB3A7' }]}>
                    {CONCEALER_PRESET_LABELS[pk].label}
                  </Text>
                  <Text style={styles.presetBtnSub}>{CONCEALER_PRESET_LABELS[pk].desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(255,77,141,0.12)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Sparkles size={24} color={Colors.neonBlue} strokeWidth={1.5} />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>Virtual Try-On</Text>
              <Text style={styles.heroSubtitle}>
                Try lipstick, blush, concealer, and foundation shades on your photo
              </Text>
            </View>
          </View>
          {Platform.OS === 'web' && (
            <View style={styles.modelStatus}>
              <View style={[
                styles.modelDot,
                modelReady ? styles.modelDotReady : (modelLoading ? styles.modelDotLoading : styles.modelDotIdle),
              ]} />
              <Text style={styles.modelStatusText}>
                {modelReady ? 'AI Face Detection Ready' : (modelLoading ? 'Loading face model...' : 'Face model idle')}
              </Text>
            </View>
          )}
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggleSection}>
          <TouchableOpacity
            style={[styles.modeToggleBtn, faceMode === 'model' && styles.modeToggleBtnActive]}
            onPress={() => handleSwitchMode('model')}
            activeOpacity={0.8}
          >
            <User size={15} color={faceMode === 'model' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.modeToggleBtnText, faceMode === 'model' && styles.modeToggleBtnTextActive]}>
              Model
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeToggleBtn, faceMode === 'upload' && styles.modeToggleBtnActive]}
            onPress={() => handleSwitchMode('upload')}
            activeOpacity={0.8}
          >
            <FolderOpen size={15} color={faceMode === 'upload' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.modeToggleBtnText, faceMode === 'upload' && styles.modeToggleBtnTextActive]}>
              Upload Image
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photo section */}
        <View style={styles.section}>
          {!imageUri ? (
            <TouchableOpacity style={styles.uploadArea} onPress={handlePickImage} activeOpacity={0.75}>
              <View style={styles.uploadIconCircle}>
                <Camera size={32} color={Colors.neonBlue} strokeWidth={1.5} />
              </View>
              <Text style={styles.uploadText}>
                {faceMode === 'model' ? 'No model image configured' : 'Upload your photo'}
              </Text>
              <Text style={styles.uploadHint}>
                {faceMode === 'model' ? 'Upload a photo to try on makeup' : 'Clear, front-facing, natural lighting'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.previewSection}>
              <View style={styles.previewControls}>
                <TouchableOpacity style={styles.controlBtn} onPress={toggleOriginal} activeOpacity={0.75}>
                  {showOriginal
                    ? <EyeOff size={14} color={Colors.neonBlue} strokeWidth={2} />
                    : <Eye size={14} color={Colors.neonBlue} strokeWidth={2} />}
                  <Text style={styles.controlBtnText}>
                    {showOriginal ? 'Show Try-On' : 'Show Original'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.controlRight}>
                  {faceMode === 'upload' && (
                    <TouchableOpacity style={styles.controlBtn} onPress={handlePickImage} activeOpacity={0.75}>
                      <ImagePlus size={14} color={Colors.neonBlue} strokeWidth={2} />
                      <Text style={styles.controlBtnText}>Change</Text>
                    </TouchableOpacity>
                  )}
                  {faceMode === 'upload' && (
                    <TouchableOpacity style={styles.controlBtn} onPress={handleReset} activeOpacity={0.75}>
                      <RefreshCw size={14} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={styles.controlBtnText}>Reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={[styles.canvasWrap, { width: previewSize, height: previewSize }]}>
                {Platform.OS === 'web' && (
                  <>
                    <img
                      ref={(el) => { imgRef.current = el; }}
                      src={imageUri!}
                      crossOrigin="anonymous"
                      onLoad={handleImageLoad}
                      style={{
                        display: showOriginal ? 'block' : 'none',
                        width: previewSize, height: previewSize,
                        objectFit: 'cover', borderRadius: 16,
                      }}
                    />
                    <canvas
                      ref={(el) => { canvasRef.current = el; }}
                      width={CANVAS_SIZE} height={CANVAS_SIZE}
                      style={{
                        display: showOriginal ? 'none' : 'block',
                        width: previewSize, height: previewSize,
                        borderRadius: 16,
                      }}
                    />

                    {/* Blush SVG overlay — fixed rendering config, no slider influence */}
                    {showBlushOverlay && (
                      <OverlayLayer
                        previewSize={previewSize}
                        type="blush"
                        blushPreset={blushPreset}
                        concealerPreset={concealerPreset}
                        hOffset={0}
                        vOffset={0}
                        size={1.0}
                        opacity={0.28}
                        hex={selectedShade?.hex || '#CC9988'}
                      />
                    )}

                    {/* Concealer SVG overlay — fixed rendering config, no slider influence */}
                    {showConcealerOverlay && (
                      <OverlayLayer
                        previewSize={previewSize}
                        type="concealer"
                        blushPreset={blushPreset}
                        concealerPreset={concealerPreset}
                        hOffset={0}
                        vOffset={0}
                        size={1.0}
                        opacity={0.22}
                        hex={selectedShade?.hex || '#CC9988'}
                      />
                    )}
                  </>
                )}
                {Platform.OS !== 'web' && (
                  <Image
                    source={{ uri: imageUri! }}
                    style={{ width: previewSize, height: previewSize, borderRadius: 16 }}
                    resizeMode="cover"
                  />
                )}

                {isRendering && (
                  <View style={styles.renderingOverlay}>
                    <ActivityIndicator size="small" color={Colors.neonBlue} />
                    <Text style={styles.renderingText}>Applying makeup...</Text>
                  </View>
                )}

                {hasRendered && !faceDetected && !showOriginal && !isRendering && (
                  <View style={styles.alertOverlay}>
                    <AlertCircle size={18} color={Colors.warning} strokeWidth={2} />
                    <Text style={styles.alertText}>No face detected</Text>
                  </View>
                )}

                {renderError && !isRendering && (
                  <View style={styles.alertOverlay}>
                    <AlertCircle size={18} color={Colors.error} strokeWidth={2} />
                    <Text style={[styles.alertText, { color: Colors.error }]}>{renderError}</Text>
                  </View>
                )}

                {hasRendered && faceDetected && !showOriginal && !isRendering && (
                  <View style={styles.shadeIndicator}>
                    <View style={[styles.shadeIndicatorDot, { backgroundColor: selectedShade?.hex || '#CC9988' }]} />
                    <Text style={styles.shadeIndicatorText}>{selectedShade?.name ?? ''}</Text>
                    <View style={styles.finishBadgeSmall}>
                      <Text style={styles.finishBadgeSmallText}>{FINISH_LABELS[selectedProduct.finish]}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.modeLabel}>
                  <Text style={styles.modeLabelText}>
                    {showOriginal ? 'ORIGINAL' : faceMode === 'model' ? 'MODEL' : 'YOUR PHOTO'}
                  </Text>
                </View>
              </View>

              {!showOriginal && (
                <View style={styles.intensityRow}>
                  <Text style={styles.intensityLabel}>Intensity</Text>
                  <View style={styles.intensityTrack}>
                    {[0.25, 0.35, 0.45, 0.55, 0.65, 0.75].map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={[styles.intensityDot, Math.abs(intensity - val) < 0.06 && styles.intensityDotActive]}
                        onPress={() => setIntensity(val)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.intensityDotInner,
                          { opacity: val },
                          Math.abs(intensity - val) < 0.06 && styles.intensityDotInnerActive,
                        ]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Overlay placement controls — shown for blush / concealer */}
              {OverlayControls}
            </View>
          )}
        </View>

        {/* Category tabs */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabsRow}>
            {CATEGORY_ORDER.map((cat) => {
              const active = selectedProduct.category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryTab, active && styles.categoryTabActive]}
                  onPress={() => {
                    const first = categoryProducts(cat)[0];
                    if (first) {
                      handleSelectProduct(first);
                    } else {
                      setSelectedProduct({ ...PLACEHOLDER_PRODUCT, category: cat });
                      setSelectedShade(PLACEHOLDER_SHADE);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Products for active category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{CATEGORY_LABELS[selectedProduct.category]} PRODUCTS</Text>
          {dbLoading ? (
            <ActivityIndicator color={Colors.neonBlue} size="small" style={{ marginTop: 12 }} />
          ) : categoryProducts(selectedProduct.category).length === 0 ? (
            <Text style={styles.emptyTabText}>No products available</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productScrollContent}>
              {categoryProducts(selectedProduct.category).map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  selected={selectedProduct.id === product.id}
                  onPress={() => handleSelectProduct(product)}
                  onPreview={() => { setPreviewProduct(product); setPreviewShade(product.shades[0] ?? PLACEHOLDER_SHADE); }}
                  onAddToCart={() => handleAddToCart(product, product.shades[0])}
                  onToggleWishlist={() => toggleWishlist(tryOnToProduct(product))}
                  wishlisted={isWishlisted(product.id)}
                  language={language}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Shade selector */}
        <View style={styles.section}>
          <View style={styles.shadeSectionHeader}>
            <Text style={styles.sectionLabel}>SELECT SHADE</Text>
            {selectedProduct.id !== '__placeholder__' && (
              <View style={styles.shadeHeaderRight}>
                <Text style={styles.shadeProductName}>{selectedProduct.name}</Text>
                <View style={styles.finishTag}>
                  <Text style={styles.finishTagText}>{FINISH_LABELS[selectedProduct.finish]}</Text>
                </View>
              </View>
            )}
          </View>
          {selectedProduct.id === '__placeholder__' ? (
            <Text style={styles.emptyTabText}>Select a product to see shades</Text>
          ) : (
          <View style={styles.shadesGrid}>
            {selectedProduct.shades.length === 0 ? (
              <Text style={styles.emptyTabText}>No shades available</Text>
            ) : selectedProduct.shades.map((shade) => {
              const isActive = selectedShade?.id === shade.id;
              const shadeHex = shade.hex || '#CC9988';
              return (
                <TouchableOpacity
                  key={shade.id}
                  style={styles.shadeCard}
                  onPress={() => setSelectedShade(shade)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.shadeImageWrap, isActive && styles.shadeImageWrapActive]}>
                    <Image source={{ uri: shade.imageUrl }} style={styles.shadeImage} resizeMode="cover" />
                    <View style={[styles.shadeColorDot, { backgroundColor: shadeHex }]} />
                  </View>
                  <Text style={[styles.shadeName, isActive && styles.shadeNameActive]} numberOfLines={1}>
                    {shade.name}
                  </Text>
                  {isActive && <View style={styles.shadeActiveLine} />}
                </TouchableOpacity>
              );
            })}
          </View>
          )}
        </View>

        {/* Quick color strip */}
        {selectedProduct.id !== '__placeholder__' && selectedProduct.shades.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK COLOR PICK</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorStripContent}>
            {selectedProduct.shades.map((shade) => {
              const isActive = selectedShade.id === shade.id;
              return (
                <TouchableOpacity
                  key={shade.id}
                  style={[styles.colorChip, isActive && styles.colorChipActive]}
                  onPress={() => setSelectedShade(shade)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.colorChipInner, { backgroundColor: shade.hex || '#CC9988' }]} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        )}

        {!imageUri && (
          <View style={styles.ctaSection}>
            <TouchableOpacity style={styles.ctaBtn} onPress={handlePickImage} activeOpacity={0.85}>
              <Upload size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.ctaBtnText}>UPLOAD PHOTO TO TRY ON</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Cart toast */}
      {cartToast && (
        <View style={styles.cartToast} pointerEvents="none">
          <Check size={13} color="#fff" strokeWidth={3} />
          <Text style={styles.cartToastText}>{cartToast}</Text>
        </View>
      )}

      {/* Quick Preview Modal */}
      {previewProduct && (
        <QuickPreviewModal
          product={previewProduct}
          shade={previewShade ?? (previewProduct.shades[0] ?? PLACEHOLDER_SHADE)}
          onShadeChange={setPreviewShade}
          onClose={() => { setPreviewProduct(null); setPreviewShade(null); }}
          onTryShade={(p, s) => {
            handleSelectProduct(p);
            setSelectedShade(s);
            setPreviewProduct(null);
            setPreviewShade(null);
          }}
          onAddToCart={(p, s) => { handleAddToCart(p, s); setPreviewProduct(null); setPreviewShade(null); }}
          onToggleWishlist={(p) => toggleWishlist(tryOnToProduct(p))}
          isWishlisted={isWishlisted(previewProduct.id)}
          language={language}
        />
      )}
    </View>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: TryOnProduct;
  selected: boolean;
  onPress: () => void;
  onPreview: () => void;
  onAddToCart: () => void;
  onToggleWishlist: () => void;
  wishlisted: boolean;
  language: string;
}

function ProductCard({ product, selected, onPress, onPreview, onAddToCart, onToggleWishlist, wishlisted, language }: ProductCardProps) {
  return (
    <View style={[styles.prodCard, selected && styles.prodCardActive]}>
      {/* Tappable image area → select product + open preview */}
      <TouchableOpacity
        style={styles.prodImageWrap}
        onPress={() => { onPress(); onPreview(); }}
        activeOpacity={0.88}
      >
        <Image source={{ uri: product.imageUrl }} style={styles.prodImage} resizeMode="cover" />
        <View style={styles.prodFinishBadge}>
          <Text style={styles.prodFinishText}>{FINISH_LABELS[product.finish]}</Text>
        </View>
        {/* Heart + Cart action buttons */}
        <View style={styles.prodActions}>
          <TouchableOpacity
            style={[styles.prodActionBtn, wishlisted && styles.prodActionBtnActive]}
            onPress={(e) => { e.stopPropagation?.(); onToggleWishlist(); }}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Heart
              size={13}
              color={wishlisted ? '#FF4D8D' : '#FFB3C8'}
              fill={wishlisted ? '#FF4D8D' : 'transparent'}
              strokeWidth={2.5}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.prodActionBtn}
            onPress={(e) => { e.stopPropagation?.(); onAddToCart(); }}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <ShoppingCart size={13} color="#FFB3C8" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { onPress(); onPreview(); }} activeOpacity={0.85}>
        <Text style={[styles.prodName, selected && styles.prodNameActive]} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.prodPrice}>{formatPrice(product.price, language)}</Text>
      </TouchableOpacity>

      <View style={styles.prodShadeRow}>
        {product.shades.slice(0, 4).map(s => (
          <View key={s.id} style={[styles.prodShadeDot, { backgroundColor: s.hex || '#CC9988' }]} />
        ))}
        {product.shades.length > 4 && (
          <Text style={styles.prodShadeMore}>+{product.shades.length - 4}</Text>
        )}
      </View>

      {selected && (
        <View style={styles.prodSelectedBadge}>
          <Text style={styles.prodSelectedText}>SELECTED</Text>
        </View>
      )}
    </View>
  );
}

// ─── QuickPreviewModal ────────────────────────────────────────────────────────

interface QuickPreviewModalProps {
  product: TryOnProduct;
  shade: ShadeOption;
  onShadeChange: (s: ShadeOption) => void;
  onClose: () => void;
  onTryShade: (product: TryOnProduct, shade: ShadeOption) => void;
  onAddToCart: (product: TryOnProduct, shade: ShadeOption) => void;
  onToggleWishlist: (product: TryOnProduct) => void;
  isWishlisted: boolean;
  language: string;
}

function QuickPreviewModal({
  product, shade, onShadeChange, onClose,
  onTryShade, onAddToCart, onToggleWishlist, isWishlisted, language,
}: QuickPreviewModalProps) {
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.previewSheet} onPress={() => {}}>
          {/* Handle bar */}
          <View style={styles.previewHandle} />

          {/* Close button */}
          <TouchableOpacity style={styles.previewClose} onPress={onClose} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={Colors.textMuted} strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Product image */}
          <View style={styles.previewImageWrap}>
            <Image source={{ uri: product.imageUrl }} style={styles.previewImage} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(7,13,26,0.6)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Selected shade pill */}
            <View style={styles.previewShadePill}>
              <View style={[styles.previewShadePillDot, { backgroundColor: shade?.hex || '#CC9988' }]} />
              <Text style={styles.previewShadePillText}>{shade.name}</Text>
            </View>
          </View>

          {/* Name + price */}
          <View style={styles.previewInfo}>
            <Text style={styles.previewName} numberOfLines={2}>{product.name}</Text>
            <Text style={styles.previewPrice}>{formatPrice(product.price, language)}</Text>
          </View>

          {/* Shade circles */}
          {product.shades.length > 0 && (
            <View style={styles.previewShadesSection}>
              <Text style={styles.previewShadesLabel}>SELECT SHADE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewShadesRow}>
                {product.shades.map(s => {
                  const active = shade.id === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.previewShadeBtn, active && styles.previewShadeBtnActive]}
                      onPress={() => onShadeChange(s)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.previewShadeCircle, { backgroundColor: s.hex || '#CC9988' }]} />
                      <Text style={[styles.previewShadeName, active && styles.previewShadeNameActive]} numberOfLines={1}>
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewTryBtn}
              onPress={() => onTryShade(product, shade)}
              activeOpacity={0.85}
            >
              <Sparkles size={15} color="#fff" strokeWidth={2} />
              <Text style={styles.previewTryBtnText}>TRY SHADE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.previewCartBtn}
              onPress={() => onAddToCart(product, shade)}
              activeOpacity={0.85}
            >
              <ShoppingCart size={15} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={styles.previewCartBtnText}>ADD TO CART</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.previewHeartBtn, isWishlisted && styles.previewHeartBtnActive]}
              onPress={() => onToggleWishlist(product)}
              activeOpacity={0.85}
            >
              <Heart
                size={17}
                color={isWishlisted ? '#FF4D8D' : Colors.textMuted}
                fill={isWishlisted ? '#FF4D8D' : 'transparent'}
                strokeWidth={2.5}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  hero: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.neonBlueGlow, borderWidth: 1.5, borderColor: Colors.neonBlueBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  heroTextWrap: { flex: 1 },
  heroTitle: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '900', letterSpacing: -0.5 },
  heroSubtitle: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 2 },

  modelStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  modelDot: { width: 8, height: 8, borderRadius: 4 },
  modelDotReady: { backgroundColor: Colors.success },
  modelDotLoading: { backgroundColor: Colors.warning },
  modelDotIdle: { backgroundColor: Colors.textMuted },
  modelStatusText: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  section: { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  sectionLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 10 },

  uploadArea: {
    borderWidth: 2, borderColor: 'rgba(255,77,141,0.25)', borderStyle: 'dashed',
    borderRadius: Radius.xl, paddingVertical: 40, paddingHorizontal: Spacing.lg,
    alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,77,141,0.04)',
  },
  uploadIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,77,141,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,77,141,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  uploadText: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  uploadHint: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' },

  previewSection: { gap: 12 },
  previewControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,77,141,0.1)', borderWidth: 1, borderColor: 'rgba(255,77,141,0.2)',
  },
  controlBtnText: { color: Colors.neonBlue, fontSize: 11, fontWeight: '700' },
  controlRight: { flexDirection: 'row', gap: 6 },

  canvasWrap: {
    alignSelf: 'center', borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#140A10', borderWidth: 2, borderColor: Colors.neonBlueBorder,
    position: 'relative', ...Shadow.neonBlueSubtle,
  },

  renderingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,5,7,0.5)', justifyContent: 'center',
    alignItems: 'center', gap: 8, borderRadius: 14,
  },
  renderingText: { color: Colors.neonBlue, fontSize: 12, fontWeight: '700' },

  alertOverlay: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(10,5,7,0.85)', borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)',
  },
  alertText: { color: Colors.warning, fontSize: 11, fontWeight: '700' },

  shadeIndicator: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(10,5,7,0.8)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  shadeIndicatorDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  shadeIndicatorText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  finishBadgeSmall: { backgroundColor: 'rgba(255,77,141,0.25)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  finishBadgeSmallText: { color: Colors.neonBlue, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  modeLabel: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(10,5,7,0.7)', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.3)',
  },
  modeLabelText: { color: Colors.neonBlue, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  intensityLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', width: 60 },
  intensityTrack: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intensityDot: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,77,141,0.15)',
  },
  intensityDotActive: { borderColor: Colors.neonBlue, borderWidth: 2 },
  intensityDotInner: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.neonBlue },
  intensityDotInnerActive: { width: 18, height: 18, borderRadius: 9 },

  // ── Overlay panel ──────────────────────────────────────────────────────
  overlayPanel: {
    backgroundColor: 'rgba(255,143,163,0.06)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,143,163,0.20)',
    padding: 12,
    gap: 10,
    marginTop: 4,
  },
  overlayTypeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  overlayTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard,
  },
  overlayTypeBtnOn: { backgroundColor: 'rgba(255,143,163,0.14)' },
  overlayTypeDot: { width: 8, height: 8, borderRadius: 4 },
  overlayTypeBtnText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  overlayResetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard,
  },
  overlayResetBtnText: { color: Colors.textMuted, fontSize: 9, fontWeight: '700' },
  overlaySubLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 1.4 },
  presetRow: { flexDirection: 'row', gap: 5 },
  presetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.backgroundCard, gap: 2,
  },
  presetBtnOn: { backgroundColor: 'rgba(255,143,163,0.12)' },
  presetBtnLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '800' },
  presetBtnSub: { color: Colors.textMuted, fontSize: 7, fontWeight: '500' },

  categoryTabsRow: { gap: 8, paddingRight: 16 },
  categoryTab: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.full,
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border,
  },
  categoryTabActive: { backgroundColor: 'rgba(255,77,141,0.15)', borderColor: Colors.neonBlue },
  categoryTabText: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  categoryTabTextActive: { color: Colors.neonBlue },

  productScrollContent: { gap: 10, paddingRight: 16, paddingBottom: 4 },
  prodCard: {
    width: 140, backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  prodCardActive: { borderColor: Colors.neonBlue, borderWidth: 2, ...Shadow.neonBlueSubtle },
  prodImageWrap: { width: '100%', height: 100, backgroundColor: '#140A10', position: 'relative' },
  prodImage: { width: '100%', height: '100%' },
  prodFinishBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(10,5,7,0.75)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)',
  },
  prodFinishText: { color: Colors.neonBlue, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  prodName: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingTop: 8 },
  prodNameActive: { color: Colors.neonBlue },
  prodPrice: { color: Colors.neonBlue, fontSize: 13, fontWeight: '900', paddingHorizontal: 8, paddingTop: 2, paddingBottom: 6 },
  prodShadeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingBottom: 8 },
  prodShadeDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  prodShadeMore: { color: Colors.textMuted, fontSize: 9, fontWeight: '700' },
  prodSelectedBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: Colors.neonBlue, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  prodSelectedText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  shadeSectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  shadeHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shadeProductName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  finishTag: {
    backgroundColor: 'rgba(255,77,141,0.15)', borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.2)',
  },
  finishTagText: { color: Colors.neonBlue, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  shadesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shadeCard: { width: 80, alignItems: 'center', gap: 4 },
  shadeImageWrap: {
    width: 64, height: 64, borderRadius: 32, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#140A10', position: 'relative',
  },
  shadeImageWrapActive: {
    borderColor: Colors.neonBlue, borderWidth: 3,
    shadowColor: Colors.neonBlue, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 6,
  },
  shadeImage: { width: '100%', height: '100%' },
  shadeColorDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#0A0507',
  },
  shadeName: { color: Colors.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  shadeNameActive: { color: Colors.neonBlue, fontWeight: '800' },
  shadeActiveLine: { width: 20, height: 2, borderRadius: 1, backgroundColor: Colors.neonBlue, marginTop: 2 },

  emptyTabText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },

  colorStripContent: { gap: 8, paddingBottom: 4 },
  colorChip: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)',
  },
  colorChipActive: {
    borderColor: Colors.neonBlue, borderWidth: 2.5,
    shadowColor: Colors.neonBlue, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
  },
  colorChipInner: { width: 26, height: 26, borderRadius: 13 },

  ctaSection: { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.full, paddingVertical: 16,
    ...Shadow.neonBlue,
  },
  ctaBtnText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: '900', letterSpacing: 2 },

  // ── ProductCard action buttons ───────────────────────────────────────
  prodActions: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'column', gap: 5,
  },
  prodActionBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(10,5,7,0.72)',
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.3)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FF4D8D', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 4, elevation: 3,
  },
  prodActionBtnActive: {
    backgroundColor: 'rgba(255,77,141,0.18)',
    borderColor: '#FF4D8D',
  },

  // ── Cart toast ────────────────────────────────────────────────────────
  cartToast: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(10,5,7,0.92)',
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.4)',
    borderRadius: Radius.full,
    paddingHorizontal: 18, paddingVertical: 10,
    shadowColor: '#FF4D8D', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  cartToastText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },

  // ── Quick Preview Modal ───────────────────────────────────────────────
  previewOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  previewSheet: {
    backgroundColor: '#0D0712',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.18)',
    paddingBottom: 32,
    overflow: 'hidden',
  },
  previewHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  previewClose: {
    position: 'absolute', top: 14, right: 16,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 10,
  },
  previewImageWrap: {
    width: '100%', height: 200,
    backgroundColor: '#140A10', position: 'relative', overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  previewShadePill: {
    position: 'absolute', bottom: 10, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(10,5,7,0.82)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)',
  },
  previewShadePillDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  previewShadePillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  previewInfo: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 14, paddingBottom: 4,
  },
  previewName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800', flex: 1, marginRight: 12 },
  previewPrice: { color: Colors.neonBlue, fontSize: FontSize.lg, fontWeight: '900' },
  previewShadesSection: { paddingHorizontal: Spacing.lg, paddingTop: 10, paddingBottom: 6 },
  previewShadesLabel: { color: Colors.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  previewShadesRow: { gap: 10, paddingBottom: 4 },
  previewShadeBtn: {
    alignItems: 'center', gap: 5,
    paddingHorizontal: 4, paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: 'transparent',
    minWidth: 52,
  },
  previewShadeBtnActive: { borderColor: Colors.neonBlue, backgroundColor: 'rgba(255,77,141,0.1)' },
  previewShadeCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  previewShadeName: { color: Colors.textMuted, fontSize: 9, fontWeight: '600', textAlign: 'center', maxWidth: 52 },
  previewShadeNameActive: { color: Colors.neonBlue, fontWeight: '800' },
  previewActions: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 14,
  },
  previewTryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: Colors.neonBlue,
    borderRadius: Radius.full, paddingVertical: 13,
    shadowColor: Colors.neonBlue, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 5,
  },
  previewTryBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '900', letterSpacing: 1 },
  previewCartBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: 'rgba(255,77,141,0.12)',
    borderRadius: Radius.full, paddingVertical: 13,
    borderWidth: 1.5, borderColor: Colors.neonBlueBorder,
  },
  previewCartBtnText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '800' },
  previewHeartBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.backgroundCard, borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  previewHeartBtnActive: {
    backgroundColor: 'rgba(255,77,141,0.15)',
    borderColor: '#FF4D8D',
  },

  modeToggleSection: {
    flexDirection: 'row', marginHorizontal: Spacing.md, marginTop: Spacing.lg,
    backgroundColor: Colors.backgroundCard, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, padding: 4, gap: 4,
  },
  modeToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 10, borderRadius: Radius.full,
  },
  modeToggleBtnActive: {
    backgroundColor: 'rgba(255,77,141,0.15)',
    borderWidth: 1, borderColor: Colors.neonBlueBorder,
  },
  modeToggleBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 0.3 },
  modeToggleBtnTextActive: { color: Colors.neonBlue },
});
