export type TryOnCategory = 'lipstick' | 'blush' | 'concealer' | 'foundation';
export type FinishType    = 'matte' | 'gloss' | 'satin' | 'dewy';

// ─── Data types ───────────────────────────────────────────────────────────────

// Spot state shared by both blush and concealer overlays
export interface OverlaySpot {
  xPct:     number;  // 0–1 fraction of preview width
  yPct:     number;  // 0–1 fraction of preview height
  scale:    number;  // size multiplier 0.3–2.0
  rotation: number;  // degrees
  opacity:  number;  // 0–1
}

export interface OverlayPlacement {
  left:   OverlaySpot;
  right:  OverlaySpot;
  mirror: boolean;
}

// Legacy alias kept so existing imports don't break
export type BlushPlacement = OverlayPlacement;

export const DEFAULT_BLUSH_PLACEMENT: OverlayPlacement = {
  left:  { xPct: 0.35, yPct: 0.54, scale: 1.0, rotation: -15, opacity: 0.65 },
  right: { xPct: 0.65, yPct: 0.54, scale: 1.0, rotation:  15, opacity: 0.65 },
  mirror: true,
};

export const DEFAULT_CONCEALER_PLACEMENT: OverlayPlacement = {
  left:  { xPct: 0.39, yPct: 0.43, scale: 1.0, rotation: -8, opacity: 0.45 },
  right: { xPct: 0.61, yPct: 0.43, scale: 1.0, rotation:  8, opacity: 0.45 },
  mirror: true,
};

// ─── Blush presets ────────────────────────────────────────────────────────────

export type BlushPreset = 'low' | 'mid' | 'high' | 'lifted';

export interface BlushPresetDef {
  label:      string;
  description: string;
  placement:  OverlayPlacement;
}

export const BLUSH_PRESETS: Record<BlushPreset, BlushPresetDef> = {
  low: {
    label: 'Low',
    description: 'Under cheek',
    placement: {
      left:  { xPct: 0.33, yPct: 0.60, scale: 1.0, rotation: -10, opacity: 0.65 },
      right: { xPct: 0.67, yPct: 0.60, scale: 1.0, rotation:  10, opacity: 0.65 },
      mirror: true,
    },
  },
  mid: {
    label: 'Mid',
    description: 'Center cheek',
    placement: {
      left:  { xPct: 0.35, yPct: 0.54, scale: 1.0, rotation: -15, opacity: 0.65 },
      right: { xPct: 0.65, yPct: 0.54, scale: 1.0, rotation:  15, opacity: 0.65 },
      mirror: true,
    },
  },
  high: {
    label: 'High',
    description: 'Lifted cheekbone',
    placement: {
      left:  { xPct: 0.34, yPct: 0.47, scale: 0.95, rotation: -20, opacity: 0.65 },
      right: { xPct: 0.66, yPct: 0.47, scale: 0.95, rotation:  20, opacity: 0.65 },
      mirror: true,
    },
  },
  lifted: {
    label: 'Lifted',
    description: 'Toward temple',
    placement: {
      left:  { xPct: 0.29, yPct: 0.44, scale: 0.90, rotation: -28, opacity: 0.60 },
      right: { xPct: 0.71, yPct: 0.44, scale: 0.90, rotation:  28, opacity: 0.60 },
      mirror: true,
    },
  },
};

export const BLUSH_PRESET_ORDER: BlushPreset[] = ['low', 'mid', 'high', 'lifted'];

// ─── Concealer presets ────────────────────────────────────────────────────────

export type ConcealerPreset = 'natural' | 'brightening' | 'full';

export interface ConcealerPresetDef {
  label:      string;
  description: string;
  placement:  OverlayPlacement;
}

export const CONCEALER_PRESETS: Record<ConcealerPreset, ConcealerPresetDef> = {
  natural: {
    label: 'Natural',
    description: 'Small under eye',
    placement: {
      left:  { xPct: 0.39, yPct: 0.44, scale: 0.80, rotation: -6, opacity: 0.40 },
      right: { xPct: 0.61, yPct: 0.44, scale: 0.80, rotation:  6, opacity: 0.40 },
      mirror: true,
    },
  },
  brightening: {
    label: 'Brightening',
    description: 'Medium triangle',
    placement: {
      left:  { xPct: 0.39, yPct: 0.43, scale: 1.0, rotation: -8, opacity: 0.45 },
      right: { xPct: 0.61, yPct: 0.43, scale: 1.0, rotation:  8, opacity: 0.45 },
      mirror: true,
    },
  },
  full: {
    label: 'Full',
    description: 'Full coverage',
    placement: {
      left:  { xPct: 0.38, yPct: 0.45, scale: 1.30, rotation: -10, opacity: 0.55 },
      right: { xPct: 0.62, yPct: 0.45, scale: 1.30, rotation:  10, opacity: 0.55 },
      mirror: true,
    },
  },
};

export const CONCEALER_PRESET_ORDER: ConcealerPreset[] = ['natural', 'brightening', 'full'];

export interface MakeupLayer {
  id: string;
  type: TryOnCategory;
  color: string;       // hex
  intensity: number;   // 0.1 – 1.0
  finish: FinishType;
  visible: boolean;
  label: string;
  productName: string;
  blushPlacement?:     OverlayPlacement; // for blush layers
  concealerPlacement?: OverlayPlacement; // for concealer layers
}

export type ShadeOption = { id: string; name: string; hex: string; imageUrl: string };

export type TryOnProduct = {
  id: string; name: string; category: TryOnCategory;
  finish: FinishType; imageUrl: string; price: number; shades: ShadeOption[];
};

export type RenderResult = {
  success: boolean; faceDetected: boolean; error?: string;
};

// ─── Category mapping ─────────────────────────────────────────────────────────

const TRYON_CATEGORY_MAP: Record<string, TryOnCategory> = {
  lipstick: 'lipstick', lip: 'lipstick', lips: 'lipstick',
  blush: 'blush', cheek: 'blush', cheeks: 'blush',
  concealer: 'concealer', under_eye: 'concealer', 'under-eye': 'concealer',
  undereye: 'concealer',
  foundation: 'foundation', base: 'foundation', face: 'foundation',
};

export function getTryOnCategory(cat: string): TryOnCategory | null {
  if (!cat) return null;
  const normalized = cat.toLowerCase().trim();
  if (normalized in TRYON_CATEGORY_MAP) return TRYON_CATEGORY_MAP[normalized];
  for (const [key, val] of Object.entries(TRYON_CATEGORY_MAP)) {
    if (normalized.includes(key)) return val;
  }
  return null;
}

export function isTryOnEligible(cat: string, hasShades: boolean): boolean {
  return hasShades && getTryOnCategory(cat) !== null;
}

export function getDefaultFinish(cat: TryOnCategory): FinishType {
  switch (cat) {
    case 'lipstick':  return 'satin';
    case 'blush':     return 'satin';
    case 'concealer': return 'dewy';
    case 'foundation':return 'dewy';
  }
}

// ─── Product catalog ──────────────────────────────────────────────────────────

export const TRYON_PRODUCTS: TryOnProduct[] = [
  {
    id: 'tryon-lip-1', name: 'Velvet Matte Lipstick', category: 'lipstick',
    finish: 'matte',
    imageUrl: 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 24.99,
    shades: [
      { id: 'lip-ruby',  name: 'Ruby Red',    hex: '#B22234', imageUrl: '' },
      { id: 'lip-rose',  name: 'Dusty Rose',  hex: '#C08081', imageUrl: '' },
      { id: 'lip-berry', name: 'Berry Kiss',  hex: '#8E3A59', imageUrl: '' },
      { id: 'lip-coral', name: 'Coral Crush', hex: '#E8734A', imageUrl: '' },
      { id: 'lip-nude',  name: 'Nude Bliss',  hex: '#C9967B', imageUrl: '' },
      { id: 'lip-plum',  name: 'Plum Drama',  hex: '#6B2D5B', imageUrl: '' },
    ],
  },
  {
    id: 'tryon-lip-2', name: 'Silk Gloss Lipstick', category: 'lipstick',
    finish: 'gloss',
    imageUrl: 'https://images.pexels.com/photos/3685530/pexels-photo-3685530.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 18.50,
    shades: [
      { id: 'gloss-pink',   name: 'Pink Shimmer', hex: '#E88BA5', imageUrl: '' },
      { id: 'gloss-peach',  name: 'Peach Glow',   hex: '#F4A980', imageUrl: '' },
      { id: 'gloss-mauve',  name: 'Mauve Silk',   hex: '#A96B8B', imageUrl: '' },
      { id: 'gloss-cherry', name: 'Cherry Pop',   hex: '#D42B4E', imageUrl: '' },
    ],
  },
  {
    id: 'tryon-blush-1', name: 'Satin Blush', category: 'blush',
    finish: 'satin',
    imageUrl: 'https://images.pexels.com/photos/2637820/pexels-photo-2637820.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 32.00,
    shades: [
      { id: 'blush-peach',  name: 'Peach Petal', hex: '#F4A28C', imageUrl: '' },
      { id: 'blush-rose',   name: 'Rose Glow',   hex: '#E07B8B', imageUrl: '' },
      { id: 'blush-berry',  name: 'Berry Flush', hex: '#C06080', imageUrl: '' },
      { id: 'blush-coral',  name: 'Warm Coral',  hex: '#E8916A', imageUrl: '' },
      { id: 'blush-bronze', name: 'Bronze Sun',  hex: '#C48860', imageUrl: '' },
    ],
  },
  {
    id: 'tryon-concealer-1', name: 'Flawless Concealer', category: 'concealer',
    finish: 'dewy',
    imageUrl: 'https://images.pexels.com/photos/3785147/pexels-photo-3785147.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 22.00,
    shades: [
      { id: 'con-fair',   name: 'Fair Ivory',  hex: '#F5DCC8', imageUrl: '' },
      { id: 'con-light',  name: 'Light Beige', hex: '#E8C9A8', imageUrl: '' },
      { id: 'con-medium', name: 'Medium Sand', hex: '#D4A574', imageUrl: '' },
      { id: 'con-tan',    name: 'Warm Tan',    hex: '#C4956A', imageUrl: '' },
      { id: 'con-deep',   name: 'Deep Mocha',  hex: '#8B6B4A', imageUrl: '' },
    ],
  },
  {
    id: 'tryon-foundation-1', name: 'Luminous Foundation', category: 'foundation',
    finish: 'dewy',
    imageUrl: 'https://images.pexels.com/photos/3373716/pexels-photo-3373716.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 38.00,
    shades: [
      { id: 'found-porcelain', name: 'Porcelain', hex: '#FADCC4', imageUrl: '' },
      { id: 'found-ivory',     name: 'Ivory',     hex: '#F0CEB0', imageUrl: '' },
      { id: 'found-sand',      name: 'Sand',      hex: '#D4A878', imageUrl: '' },
      { id: 'found-caramel',   name: 'Caramel',   hex: '#BA8A5C', imageUrl: '' },
      { id: 'found-espresso',  name: 'Espresso',  hex: '#7A5030', imageUrl: '' },
      { id: 'found-mocha',     name: 'Mocha',     hex: '#6B4226', imageUrl: '' },
    ],
  },
  {
    id: 'tryon-foundation-2', name: 'Matte Perfection', category: 'foundation',
    finish: 'matte',
    imageUrl: 'https://images.pexels.com/photos/2113855/pexels-photo-2113855.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 42.00,
    shades: [
      { id: 'mf-fair',   name: 'Fair',   hex: '#F5DBC0', imageUrl: '' },
      { id: 'mf-light',  name: 'Light',  hex: '#E4C198', imageUrl: '' },
      { id: 'mf-medium', name: 'Medium', hex: '#C8A070', imageUrl: '' },
      { id: 'mf-deep',   name: 'Deep',   hex: '#8A6040', imageUrl: '' },
    ],
  },
];

// ─── MediaPipe face landmarker ────────────────────────────────────────────────

type NormalizedLandmark = { x: number; y: number; z: number };
type LandmarkList = NormalizedLandmark[];

let landmarkerInstance: any = null;
let landmarkerLoading  = false;
let landmarkerQueue: Array<(lm: any) => void> = [];

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

async function loadLandmarker(): Promise<any> {
  if (landmarkerInstance) return landmarkerInstance;
  if (landmarkerLoading) {
    return new Promise(resolve => { landmarkerQueue.push(resolve); });
  }
  landmarkerLoading = true;
  try {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const wasm = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm',
    );
    landmarkerInstance = await FaceLandmarker.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'IMAGE',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    landmarkerQueue.forEach(cb => cb(landmarkerInstance));
    landmarkerQueue = [];
    return landmarkerInstance;
  } catch (e) {
    landmarkerLoading = false;
    throw e;
  }
}

export async function initFaceLandmarker(): Promise<void> { await loadLandmarker(); }
export function isFaceLandmarkerReady(): boolean { return landmarkerInstance !== null; }

// ─── Landmark index sets (MediaPipe 468-point canonical mesh) ─────────────────

// Lips — outer contour (closed polygon, upper then lower)
const LIP_UPPER_OUT = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LIP_LOWER_OUT = [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];

// Lips — inner contour (mouth opening)
const LIP_UPPER_IN  = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LIP_LOWER_IN  = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

// Under-eye lower arc landmarks (lower eyelid / tear trough region)
const LEFT_UNDER_EYE  = [110, 117, 118, 119, 120, 121, 128, 245, 193, 190, 56, 35];
const RIGHT_UNDER_EYE = [339, 346, 347, 348, 349, 350, 357, 465, 417, 414, 286, 265];

// Face oval
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10,
];

// Eye regions — used to punch cutouts from foundation
const LEFT_EYE  = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];

// Eyebrows — punched out of foundation
const LEFT_BROW  = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const RIGHT_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];

// Cheek apple region: landmarks around the cheekbone / apple of the cheek
// Left cheek: landmarks near outer cheek, below eye outer corner (lm 130 / 243)
// These sit at the high cheekbone / apple position, not the lower jowl
const LEFT_CHEEK_APPLE  = [116, 123, 147, 213, 192, 214, 207, 206, 205, 50, 36];
const RIGHT_CHEEK_APPLE = [345, 352, 376, 433, 416, 434, 427, 426, 425, 280, 266];

// Nose bridge + sides: for concealer nose-side coverage
// lm 6 = nose tip, 4 = nose bridge mid, 168 = nose bridge top, 98/327 = nose sides
const NOSE_BRIDGE = [168, 6, 4, 1, 19, 94, 2];

// Specific anchor points (single landmarks used for positioning)
// lm 94  = philtrum / centre upper-lip area (above vermillion)
// lm 152 = chin centre (bottom of face)
// lm 10  = forehead top
// lm 234 = left face edge, lm 454 = right face edge
// lm 130 = left outer eye corner, lm 359 = right outer eye corner
// lm 159 = left upper lid centre, lm 386 = right upper lid centre
// lm 145 = left lower lid centre, lm 374 = right lower lid centre
// lm 50  = left cheek apple high, lm 280 = right cheek apple high

// ─── Geometry utilities ───────────────────────────────────────────────────────

function lmPx(lm: NormalizedLandmark, w: number, h: number): [number, number] {
  return [lm.x * w, lm.y * h];
}

function poly(lms: LandmarkList, idx: number[], w: number, h: number): Array<[number, number]> {
  return idx.map(i => lmPx(lms[i], w, h));
}

// Smooth closed polygon using quadratic Bezier midpoints — avoids hard corners
function tracePath(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, closed = true) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
  for (let i = 1; i < pts.length; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    ctx.quadraticCurveTo(curr[0], curr[1], (curr[0] + next[0]) / 2, (curr[1] + next[1]) / 2);
  }
  if (closed) ctx.closePath();
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function centroid(pts: Array<[number, number]>): [number, number] {
  let x = 0, y = 0;
  for (const [px, py] of pts) { x += px; y += py; }
  return [x / pts.length, y / pts.length];
}

function bbox(pts: Array<[number, number]>) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (y < y0) y0 = y;
    if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

const BLUSH_RENDER_CONFIG = {
  opacity: 0.28,
  gradientMid: 0.25,
  gradientSoftEdge: 1,
  scaleX: 0.85,
  scaleY: 0.55,
  yShift: 0.04,
};

const CONCEALER_RENDER_CONFIG = {
  opacity: 0.22,
  gradientMid: 0.35,
  gradientSoftEdge: 1,
  scaleX: 0.75,
  scaleY: 0.42,
  yShift: 0.035,
};

// Soft ellipse: translate+scale trick gives a true ellipse gradient with no clip edge
function softEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number, ry: number,
  r: number, g: number, b: number,
  peakAlpha: number,
  mode: GlobalCompositeOperation,
) {
  if (!isFinite(cx) || !isFinite(cy) || rx <= 0 || ry <= 0 || peakAlpha <= 0) return;
  const alpha = Math.min(1, Math.max(0, peakAlpha));
  const color = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = BLUSH_RENDER_CONFIG.opacity;
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0,                                  color);
  grad.addColorStop(BLUSH_RENDER_CONFIG.gradientMid,    color);
  grad.addColorStop(BLUSH_RENDER_CONFIG.gradientSoftEdge, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, rx, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Lipstick ─────────────────────────────────────────────────────────────────
// Uses actual lip landmark polygons:
//   Outer polygon → clip region (color is contained inside outer lip boundary)
//   Inner polygon → even-odd cutout (no color inside the mouth opening)
//   Three blend modes layered for natural depth: multiply → overlay → soft-light
//   Gloss/satin finish adds a specular highlight on the upper lip

function applyLipstick(
  ctx: CanvasRenderingContext2D, lms: LandmarkList,
  hex: string, intensity: number, finish: FinishType, w: number, h: number,
) {
  try {
    const outerPts = [...poly(lms, LIP_UPPER_OUT, w, h), ...poly(lms, LIP_LOWER_OUT, w, h).slice(1, -1)];
    const innerPts = [...poly(lms, LIP_UPPER_IN,  w, h), ...poly(lms, LIP_LOWER_IN,  w, h).slice(1, -1)];

    const cx = centroid(outerPts);
    const bb = bbox(outerPts);
    const [r, g, b] = hexRgb(hex);
    const a = intensity * 0.72;

    // Layer 1: multiply stain clipped to outer lip polygon
    // Radial gradient fades well before the polygon edge → no visible clip line
    ctx.save();
    tracePath(ctx, outerPts);
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    const g1 = ctx.createRadialGradient(cx[0], cx[1], 0, cx[0], cx[1], Math.max(bb.w, bb.h) * 0.62);
    g1.addColorStop(0,    `rgba(${r},${g},${b},${(a * 0.85).toFixed(3)})`);
    g1.addColorStop(0.55, `rgba(${r},${g},${b},${(a * 0.65).toFixed(3)})`);
    g1.addColorStop(0.85, `rgba(${r},${g},${b},${(a * 0.28).toFixed(3)})`);
    g1.addColorStop(1,    `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = g1;
    ctx.fillRect(bb.x0, bb.y0, bb.w, bb.h);
    ctx.restore();

    // Layer 2: overlay for hue depth
    ctx.save();
    tracePath(ctx, outerPts);
    ctx.clip();
    ctx.globalCompositeOperation = 'overlay';
    const g2 = ctx.createRadialGradient(cx[0], cx[1], 0, cx[0], cx[1], Math.max(bb.w, bb.h) * 0.58);
    g2.addColorStop(0,    `rgba(${r},${g},${b},${(a * 0.58).toFixed(3)})`);
    g2.addColorStop(0.62, `rgba(${r},${g},${b},${(a * 0.32).toFixed(3)})`);
    g2.addColorStop(1,    `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = g2;
    ctx.fillRect(bb.x0, bb.y0, bb.w, bb.h);
    ctx.restore();

    // Layer 3: soft-light on inner lip for texture depth (clipped to inner polygon)
    ctx.save();
    tracePath(ctx, innerPts);
    ctx.clip();
    ctx.globalCompositeOperation = 'soft-light';
    const g3 = ctx.createRadialGradient(cx[0], cx[1], 0, cx[0], cx[1], Math.max(bb.w, bb.h) * 0.50);
    g3.addColorStop(0,   `rgba(${r},${g},${b},${(a * 0.36).toFixed(3)})`);
    g3.addColorStop(0.7, `rgba(${r},${g},${b},${(a * 0.10).toFixed(3)})`);
    g3.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = g3;
    ctx.fillRect(bb.x0, bb.y0, bb.w, bb.h);
    ctx.restore();

    // Gloss / satin specular highlight on upper lip center
    if (finish !== 'matte') {
      const glossA = finish === 'gloss' ? intensity * 0.44 : intensity * 0.20;
      const hlX = cx[0];
      const hlY = bb.y0 + bb.h * 0.26;
      const hlR = bb.w * 0.26;
      ctx.save();
      tracePath(ctx, outerPts);
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      const hl = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
      hl.addColorStop(0,    `rgba(255,255,255,${glossA.toFixed(3)})`);
      hl.addColorStop(0.45, `rgba(255,255,255,${(glossA * 0.32).toFixed(3)})`);
      hl.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.fillStyle = hl;
      ctx.fillRect(bb.x0, bb.y0, bb.w, bb.h);
      ctx.restore();
    }
  } catch { /* skip on error */ }
}

// ─── Face box helper ──────────────────────────────────────────────────────────

function faceBox(lms: LandmarkList, w: number, h: number) {
  const ovalPts = poly(lms, FACE_OVAL, w, h);
  const bb = bbox(ovalPts);
  return {
    left:   bb.x0,
    top:    bb.y0,
    right:  bb.x1,
    bottom: bb.y1,
    width:  bb.w,
    height: bb.h,
    cx:     (bb.x0 + bb.x1) / 2,
    cy:     (bb.y0 + bb.y1) / 2,
    pts:    ovalPts,
  };
}

// ─── Blush ────────────────────────────────────────────────────────────────────
// When manual BlushPlacement is supplied the positions come from the overlay UI.
// Otherwise falls back to landmark-based auto placement.

function applyBlushAtPoint(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rxBase: number, ryBase: number,
  scale: number, rotDeg: number,
  r: number, g: number, b: number,
  peak: number,
  ovalPts: Array<[number, number]>,
  clipped: boolean,
) {
  const rx = rxBase * BLUSH_RENDER_CONFIG.scaleX;
  const ry = ryBase * BLUSH_RENDER_CONFIG.scaleY;
  if (!clipped) {
    ctx.save();
    tracePath(ctx, ovalPts);
    ctx.clip();
  }
  // Rotate ellipse via canvas transform
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  softEllipse(ctx, cx, cy, rx, ry,       r, g, b, peak,        'multiply');
  softEllipse(ctx, cx, cy, rx, ry,       r, g, b, peak * 0.40, 'soft-light');
  // Temple lift: smaller blob offset outward + up
  const templeOffX = rx * 0.55;
  const templeOffY = -ry * 0.55;
  softEllipse(ctx, cx + templeOffX, cy + templeOffY, rx * 0.55, ry * 0.55, r, g, b, peak * 0.42, 'multiply');
  softEllipse(ctx, cx + templeOffX, cy + templeOffY, rx * 0.55, ry * 0.55, r, g, b, peak * 0.18, 'soft-light');
  ctx.restore();
  if (!clipped) ctx.restore();
}

function applyBlush(
  ctx: CanvasRenderingContext2D, lms: LandmarkList,
  hex: string, intensity: number, w: number, h: number,
  placement?: BlushPlacement,
) {
  try {
    if (!lms || lms.length < 468) return;
    const [r, g, b] = hexRgb(hex);

    const [fx0] = lmPx(lms[234], w, h);
    const [fx1] = lmPx(lms[454], w, h);
    const faceW = Math.abs(fx1 - fx0);
    const [, faceTopY] = lmPx(lms[10],  w, h);
    const [, faceBot]  = lmPx(lms[152], w, h);
    const faceH = faceBot - faceTopY;

    const rxBase = faceW * 0.14;
    const ryBase = faceH * 0.075;
    const peak   = Math.min(0.55, Math.max(0.10, intensity * 0.55));
    const ovalPts = poly(lms, FACE_OVAL, w, h);

    // Clip entire blush to FACE_OVAL
    ctx.save();
    tracePath(ctx, ovalPts);
    ctx.clip();

    const yShift = h * BLUSH_RENDER_CONFIG.yShift;

    if (placement) {
      // Manual placement — positions as fraction of canvas size
      const lp = placement.left;
      const rp = placement.right;
      applyBlushAtPoint(ctx, lp.xPct * w, lp.yPct * h + yShift, rxBase, ryBase, lp.scale, lp.rotation, r, g, b, peak, ovalPts, true);
      applyBlushAtPoint(ctx, rp.xPct * w, rp.yPct * h + yShift, rxBase, ryBase, rp.scale, rp.rotation, r, g, b, peak, ovalPts, true);
    } else {
      // Auto landmark placement
      const [leX, leY] = lmPx(lms[130], w, h);
      const [reX, reY] = lmPx(lms[359], w, h);
      const [, noseY]  = lmPx(lms[1],   w, h);

      const leftApplePts  = poly(lms, LEFT_CHEEK_APPLE,  w, h);
      const rightApplePts = poly(lms, RIGHT_CHEEK_APPLE, w, h);
      const [lAppleCX] = centroid(leftApplePts);
      const [rAppleCX] = centroid(rightApplePts);
      const lAppleCY = leY + (noseY - leY) * 0.40 + yShift;
      const rAppleCY = reY + (noseY - reY) * 0.40 + yShift;

      applyBlushAtPoint(ctx, lAppleCX, lAppleCY, rxBase, ryBase, 1.0, -15, r, g, b, peak, ovalPts, true);
      applyBlushAtPoint(ctx, rAppleCX, rAppleCY, rxBase, ryBase, 1.0,  15, r, g, b, peak, ovalPts, true);
    }

    ctx.restore();
  } catch { /* skip on error */ }
}

// ─── Concealer ────────────────────────────────────────────────────────────────
// Regions covered:
//   1. Under-eye inverted triangle (beneath lower lash line → cheek)
//   2. Inner eye corner / tear duct (lm 243 left, 463 right)
//   3. Nose sides (left lm 129/64, right lm 358/294)
//   4. Philtrum / above upper lip (lm 94)
//   5. Chin centre (lm 152)
// Blend: screen (brightens) + soft-light (warms) — never hard-edge

function softEllipseConcealer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number, ry: number,
  r: number, g: number, b: number,
  mode: GlobalCompositeOperation,
) {
  if (!isFinite(cx) || !isFinite(cy) || rx <= 0 || ry <= 0) return;
  const color = `rgba(${r},${g},${b},${CONCEALER_RENDER_CONFIG.opacity.toFixed(3)})`;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = CONCEALER_RENDER_CONFIG.opacity;
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0,                                      color);
  grad.addColorStop(CONCEALER_RENDER_CONFIG.gradientMid,    color);
  grad.addColorStop(CONCEALER_RENDER_CONFIG.gradientSoftEdge, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, rx, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function applyConcealer(
  ctx: CanvasRenderingContext2D, lms: LandmarkList,
  hex: string, _intensity: number, w: number, h: number,
  placement?: OverlayPlacement,
) {
  try {
    const [r, g, b] = hexRgb(hex);

    const [fx0] = lmPx(lms[234], w, h);
    const [fx1] = lmPx(lms[454], w, h);
    const faceW = Math.abs(fx1 - fx0);

    const yShift = h * CONCEALER_RENDER_CONFIG.yShift;
    const ovalPts = poly(lms, FACE_OVAL, w, h);

    ctx.save();
    tracePath(ctx, ovalPts);
    ctx.clip();

    if (placement) {
      // Manual placement — fixed config overrides all slider-driven values
      for (const sp of [placement.left, placement.right]) {
        const cx = sp.xPct * w;
        const cy = sp.yPct * h + yShift;
        const rxFixed = faceW * 0.085 * CONCEALER_RENDER_CONFIG.scaleX;
        const ryFixed = rxFixed * CONCEALER_RENDER_CONFIG.scaleY;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((sp.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
        softEllipseConcealer(ctx, cx, cy, rxFixed, ryFixed, r, g, b, 'screen');
        softEllipseConcealer(ctx, cx, cy, rxFixed, ryFixed, r, g, b, 'soft-light');
        ctx.restore();
      }
    } else {
      // Auto landmark placement — under-eye only, tight soft oval
      const leftUEPts  = poly(lms, LEFT_UNDER_EYE,  w, h);
      const rightUEPts = poly(lms, RIGHT_UNDER_EYE, w, h);
      const [luCX, luCY_raw] = centroid(leftUEPts);
      const [ruCX, ruCY_raw] = centroid(rightUEPts);
      const luBB = bbox(leftUEPts);
      const ruBB = bbox(rightUEPts);

      const luCY = luCY_raw + yShift;
      const ruCY = ruCY_raw + yShift;

      const ueRX  = luBB.w * CONCEALER_RENDER_CONFIG.scaleX;
      const ueRY  = ueRX   * CONCEALER_RENDER_CONFIG.scaleY;
      const ueRX2 = ruBB.w * CONCEALER_RENDER_CONFIG.scaleX;
      const ueRY2 = ueRX2  * CONCEALER_RENDER_CONFIG.scaleY;

      softEllipseConcealer(ctx, luCX, luCY, ueRX,  ueRY,  r, g, b, 'screen');
      softEllipseConcealer(ctx, luCX, luCY, ueRX,  ueRY,  r, g, b, 'soft-light');
      softEllipseConcealer(ctx, ruCX, ruCY, ueRX2, ueRY2, r, g, b, 'screen');
      softEllipseConcealer(ctx, ruCX, ruCY, ueRX2, ueRY2, r, g, b, 'soft-light');
    }

    ctx.restore();
  } catch { /* skip on error */ }
}

// ─── Foundation ───────────────────────────────────────────────────────────────
// Uniform even layer covering the full face.  Strategy:
//   • Offscreen canvas clipped to FACE_OVAL
//   • Single large radial gradient from face centre covering the full oval
//     + four reinforcing zone ellipses (forehead, nose, cheeks, jaw) to
//     ensure uniform coverage without visible patches
//   • Eyes, brows, and lips punched out with destination-out
//   • Neck/jawline feather: a secondary soft ellipse extends just past the oval
//     bottom for a seamless jaw-to-neck blend
// Opacity deliberately low (0.12–0.20 max) so foundation looks like real skin

const LIP_REGION = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
  375, 321, 405, 314, 17, 84, 181, 91, 146,
];

function applyFoundation(
  ctx: CanvasRenderingContext2D, lms: LandmarkList,
  hex: string, intensity: number, finish: FinishType, w: number, h: number,
) {
  try {
    const [r, g, b] = hexRgb(hex);
    const fb = faceBox(lms, w, h);

    const offscreen = document.createElement('canvas');
    offscreen.width  = w;
    offscreen.height = h;
    const off = offscreen.getContext('2d');
    if (!off) return;

    // ── Clip to face oval ─────────────────────────────────────────────────────
    off.save();
    tracePath(off, fb.pts);
    off.clip();

    // Base alpha — kept intentionally light so it reads as real foundation
    const zA = Math.min(0.20, Math.max(0.06, intensity * 0.16));

    // ── Full-face base: large radial from face centre ─────────────────────────
    // Covers the entire oval uniformly before zone refinement
    const baseGrad = off.createRadialGradient(
      fb.cx, fb.cy, 0,
      fb.cx, fb.cy, Math.max(fb.width, fb.height) * 0.62,
    );
    baseGrad.addColorStop(0,    `rgba(${r},${g},${b},${zA.toFixed(3)})`);
    baseGrad.addColorStop(0.55, `rgba(${r},${g},${b},${(zA * 0.90).toFixed(3)})`);
    baseGrad.addColorStop(0.82, `rgba(${r},${g},${b},${(zA * 0.55).toFixed(3)})`);
    baseGrad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
    off.save();
    off.globalCompositeOperation = 'soft-light';
    off.fillStyle = baseGrad;
    off.fillRect(fb.left - 4, fb.top - 4, fb.width + 8, fb.height + 8);
    off.restore();

    // ── Zone reinforcement ellipses — prevent patchy look ────────────────────
    // These overlap so there is no visible transition between zones
    const zoneA = zA * 0.55; // lighter than base so zones don't over-saturate
    const zones: [number, number, number, number][] = [
      // [cx, cy, rx, ry]
      [fb.cx,                   fb.top  + fb.height * 0.17, fb.width * 0.40, fb.height * 0.20], // forehead
      [fb.cx,                   fb.top  + fb.height * 0.38, fb.width * 0.32, fb.height * 0.22], // nose bridge
      [fb.cx - fb.width * 0.20, fb.top  + fb.height * 0.52, fb.width * 0.28, fb.height * 0.22], // left cheek
      [fb.cx + fb.width * 0.20, fb.top  + fb.height * 0.52, fb.width * 0.28, fb.height * 0.22], // right cheek
      [fb.cx,                   fb.top  + fb.height * 0.72, fb.width * 0.38, fb.height * 0.18], // jaw / chin
    ];

    for (const [zx, zy, zrx, zry] of zones) {
      softEllipse(off, zx, zy, zrx, zry, r, g, b, zoneA,        'soft-light');
      softEllipse(off, zx, zy, zrx, zry, r, g, b, zoneA * 0.35, 'multiply');
    }

    // ── Dewy / satin sheen ────────────────────────────────────────────────────
    if (finish === 'dewy' || finish === 'satin') {
      const hlA = finish === 'dewy' ? intensity * 0.07 : intensity * 0.035;
      const hlY = fb.top + fb.height * 0.22;
      const hg  = off.createRadialGradient(fb.cx, hlY, 0, fb.cx, hlY, fb.width * 0.30);
      hg.addColorStop(0,   `rgba(255,255,255,${hlA.toFixed(3)})`);
      hg.addColorStop(0.5, `rgba(255,255,255,${(hlA * 0.22).toFixed(3)})`);
      hg.addColorStop(1,   'rgba(255,255,255,0)');
      off.save();
      off.globalCompositeOperation = 'screen';
      off.fillStyle = hg;
      off.fillRect(fb.left, fb.top, fb.width, fb.height);
      off.restore();
    }

    off.restore(); // end oval clip

    // ── Punch out eyes, brows, and lips ──────────────────────────────────────
    const cutouts = [
      { idx: LEFT_EYE,   scale: 1.25 },
      { idx: RIGHT_EYE,  scale: 1.25 },
      { idx: LEFT_BROW,  scale: 1.22 },
      { idx: RIGHT_BROW, scale: 1.22 },
      { idx: LIP_REGION, scale: 1.06 },
    ];

    off.globalCompositeOperation = 'destination-out';
    for (const { idx, scale } of cutouts) {
      const region = poly(lms, idx, w, h);
      const [crx, cry] = centroid(region);
      const expanded = region.map(([px, py]) => [
        crx + (px - crx) * scale,
        cry + (py - cry) * scale,
      ] as [number, number]);
      off.save();
      tracePath(off, expanded);
      off.fillStyle = 'rgba(0,0,0,1)';
      off.fill();
      off.restore();
    }

    // ── Composite onto main canvas ────────────────────────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(offscreen, 0, 0);
    ctx.restore();
  } catch { /* skip on error */ }
}

// ─── Render pipeline ──────────────────────────────────────────────────────────

// Canonical paint order: foundation → concealer → blush → lipstick
const LAYER_ORDER: TryOnCategory[] = ['foundation', 'concealer', 'blush', 'lipstick'];

// Draw all visible layers given already-detected landmarks.
// Each layer is isolated in its own try/catch so one failure never blocks others.
function paintLayers(
  ctx: CanvasRenderingContext2D,
  lms: LandmarkList,
  visible: MakeupLayer[],
  w: number, h: number,
) {
  for (const type of LAYER_ORDER) {
    for (const layer of visible) {
      if (layer.type !== type) continue;
      try {
        switch (type) {
          case 'lipstick':   applyLipstick(ctx,   lms, layer.color, layer.intensity, layer.finish, w, h); break;
          case 'blush':      applyBlush(ctx,       lms, layer.color, layer.intensity, w, h, layer.blushPlacement); break;
          case 'concealer':  applyConcealer(ctx,   lms, layer.color, layer.intensity, w, h, layer.concealerPlacement); break;
          case 'foundation': applyFoundation(ctx,  lms, layer.color, layer.intensity, layer.finish, w, h); break;
        }
      } catch { /* layer failed — others continue */ }
    }
  }
}

// Shared landmark detection helper
async function detectLandmarks(
  landmarker: any,
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
): Promise<LandmarkList | null> {
  let result: any;
  try { result = landmarker.detect(img); } catch { /* try canvas fallback */ }
  if (!result?.faceLandmarks?.length) {
    try { result = landmarker.detect(canvas); } catch { /* ignore */ }
  }
  if (!result?.faceLandmarks?.length) return null;
  const lms: LandmarkList = result.faceLandmarks[0];
  // Minimal sanity: need ≥468 landmarks and a non-zero face width
  if (lms.length < 468) return null;
  const [fx0] = lmPx(lms[234], canvas.width, canvas.height);
  const [fx1] = lmPx(lms[454], canvas.width, canvas.height);
  if (Math.abs(fx1 - fx0) < canvas.width * 0.01) return null;
  return lms;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const imgRatio    = img.width / img.height;
  const canvasRatio = canvasWidth / canvasHeight;
  let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
  if (imgRatio > canvasRatio) {
    sWidth = img.height * canvasRatio;
    sx = (img.width - sWidth) / 2;
  } else {
    sHeight = img.width / canvasRatio;
    sy = (img.height - sHeight) / 2;
  }
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);
}

export async function renderLayers(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  layers: MakeupLayer[],
  imageSource: 'model' | 'upload' = 'model',
): Promise<RenderResult> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { success: false, faceDetected: false, error: 'No canvas context' };

  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  if (imageSource === 'upload') {
    drawImageCover(ctx, img, w, h);
  } else {
    ctx.drawImage(img, 0, 0, w, h);
  }

  const visible = layers.filter(l => l.visible);
  if (visible.length === 0) return { success: true, faceDetected: true };

  let landmarker: any;
  try { landmarker = await loadLandmarker(); }
  catch (e: any) { return { success: false, faceDetected: false, error: 'Face model failed to load: ' + (e?.message ?? '') }; }

  const lms = await detectLandmarks(landmarker, img, canvas);
  if (!lms) return { success: true, faceDetected: false, error: 'Please upload a clear front-facing photo' };

  paintLayers(ctx, lms, visible, w, h);
  return { success: true, faceDetected: true };
}

// smartRenderLayers is a drop-in alias — same logic, exported for compatibility
export async function smartRenderLayers(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  layers: MakeupLayer[],
  imageSource: 'model' | 'upload' = 'model',
): Promise<RenderResult> {
  return renderLayers(canvas, img, layers, imageSource);
}

// ─── Legacy single-product helper ────────────────────────────────────────────

export async function renderTryOn(
  canvas: HTMLCanvasElement, img: HTMLImageElement,
  category: TryOnCategory, shadeHex: string, intensity: number, finish: FinishType,
): Promise<RenderResult> {
  return renderLayers(canvas, img, [{
    id: 'legacy', type: category, color: shadeHex, intensity,
    finish, visible: true, label: category, productName: category,
  }]);
}
