import { supabase, adminSupabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadResult =
  | { url: string; error: null }
  | { url: null; error: string };

export type UploadProgress = {
  /** 0–100 percentage */
  percent: number;
  /** Current stage label */
  stage: 'validating' | 'compressing' | 'uploading' | 'processing' | 'done';
};

export type UploadOptions = {
  folder?: 'products' | 'branding' | 'cms' | 'general';
  onProgress?: (progress: UploadProgress) => void;
  /** Skip client-side WebP conversion (e.g. for SVG/GIF) */
  skipCompression?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET = 'uploads';
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * Supported MIME types and their display names.
 * AVIF is included when the browser supports encoding via OffscreenCanvas.
 */
export const SUPPORTED_TYPES: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/jpg':  'JPG',
  'image/png':  'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/svg+xml': 'SVG',
  'image/gif':  'GIF',
};

/** Types we can compress/convert to WebP */
const COMPRESSIBLE = new Set(['image/jpeg', 'image/jpg', 'image/png']);

/** Types that preserve transparency (never convert to lossy format) */
const TRANSPARENCY_TYPES = new Set(['image/png', 'image/webp', 'image/avif']);

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateImageFile(file: File): string | null {
  if (!file) return 'No file provided.';

  // Type check
  if (!SUPPORTED_TYPES[file.type]) {
    const allowed = Object.values(SUPPORTED_TYPES)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ');
    return `Unsupported file type "${file.type}". Allowed: ${allowed}.`;
  }

  // Size check
  if (file.size > MAX_SIZE_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_SIZE_MB} MB.`;
  }

  // Zero-byte / corrupted file check
  if (file.size === 0) {
    return 'File appears to be empty or corrupted.';
  }

  return null;
}

/**
 * Verify that a file is a readable, decodable image by attempting to
 * create an ImageBitmap from it. Returns error string or null.
 * Only runs on web (OffscreenCanvas/createImageBitmap available).
 */
export async function validateImageIntegrity(file: File): Promise<string | null> {
  if (typeof createImageBitmap === 'undefined') return null;

  // Skip SVG/GIF integrity check — they decode differently
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return null;

  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width === 0 || bitmap.height === 0) {
      bitmap.close();
      return 'Image appears to have no dimensions.';
    }
    bitmap.close();
    return null;
  } catch {
    return 'File could not be decoded. It may be corrupted or in an unsupported format.';
  }
}

// ─── Compression ──────────────────────────────────────────────────────────────

type CompressResult = {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  format: string;
};

/**
 * Compress a JPEG or PNG to WebP using OffscreenCanvas.
 * PNG with transparency stays as PNG.
 * Returns the original file if compression is not beneficial or not supported.
 */
export async function compressImage(
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<CompressResult> {
  const original = { file, originalBytes: file.size, compressedBytes: file.size, format: file.type };

  if (!COMPRESSIBLE.has(file.type)) return original;
  if (typeof OffscreenCanvas === 'undefined') return original;
  if (typeof createImageBitmap === 'undefined') return original;

  onProgress?.({ percent: 15, stage: 'compressing' });

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Hard cap at 4096×4096 to prevent OOM on large uploads
    const MAX_DIM = 4096;
    let outW = width;
    let outH = height;
    if (Math.max(width, height) > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      outW = Math.round(width * scale);
      outH = Math.round(height * scale);
    }

    const canvas = new OffscreenCanvas(outW, outH);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0, outW, outH);
    bitmap.close();

    const isPng = file.type === 'image/png';
    // PNG: check if it actually has transparency before deciding format
    let hasTransparency = false;
    if (isPng) {
      hasTransparency = await detectTransparency(canvas, outW, outH);
    }

    onProgress?.({ percent: 35, stage: 'compressing' });

    if (hasTransparency) {
      // Preserve transparency as PNG (lossless)
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      if (blob.size >= file.size) return original; // not smaller, keep original
      const out = new File([blob], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' });
      return { file: out, originalBytes: file.size, compressedBytes: blob.size, format: 'image/png' };
    }

    // Convert to WebP
    const quality = isPng ? 0.90 : 0.87;
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });

    // Only use compressed version if it's meaningfully smaller (>5% saving)
    if (blob.size > file.size * 0.95) return original;

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const out = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
    return { file: out, originalBytes: file.size, compressedBytes: blob.size, format: 'image/webp' };
  } catch {
    return original;
  }
}

/** Checks if a canvas has any non-opaque pixels (alpha < 255). */
async function detectTransparency(canvas: OffscreenCanvas, w: number, h: number): Promise<boolean> {
  try {
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    // Sample a grid of pixels rather than reading every pixel
    const step = Math.max(1, Math.floor(Math.min(w, h) / 32));
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha < 250) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ─── XHR upload with real progress ───────────────────────────────────────────

/**
 * Upload a file to Supabase Storage with real byte-level progress events.
 * Uses XMLHttpRequest instead of fetch so we get onprogress callbacks.
 */
async function uploadWithProgress(
  file: File,
  path: string,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<{ path: string } | { error: string }> {
  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || '';
  const anonKey =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || '';

  // Fall back to Supabase SDK if XHR isn't available (e.g. native)
  if (typeof XMLHttpRequest === 'undefined' || !supabaseUrl || !anonKey) {
    const db = adminSupabase();
    const { data, error } = await db.storage
      .from(BUCKET)
      .upload(path, file, { contentType, upsert: false });
    if (error) return { error: error.message };
    return { path: data.path };
  }

  return new Promise((resolve) => {
    const url = `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ path });
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          resolve({ error: body.message || body.error || `Upload failed (${xhr.status})` });
        } catch {
          resolve({ error: `Upload failed (${xhr.status})` });
        }
      }
    };

    xhr.onerror = () => resolve({ error: 'Network error during upload.' });
    xhr.ontimeout = () => resolve({ error: 'Upload timed out.' });

    xhr.send(file);
  });
}

// ─── Main upload function ─────────────────────────────────────────────────────

export async function uploadImageToSupabase(
  file: File,
  folderOrOptions: 'products' | 'branding' | 'cms' | 'general' | UploadOptions = 'general'
): Promise<UploadResult> {
  const opts: UploadOptions = typeof folderOrOptions === 'string'
    ? { folder: folderOrOptions }
    : folderOrOptions;

  const folder = opts.folder ?? 'general';
  const onProgress = opts.onProgress;

  onProgress?.({ percent: 5, stage: 'validating' });

  // 1. Basic validation
  const validErr = validateImageFile(file);
  if (validErr) return { url: null, error: validErr };

  // 2. Integrity check (async, web only)
  const integrityErr = await validateImageIntegrity(file);
  if (integrityErr) return { url: null, error: integrityErr };

  onProgress?.({ percent: 10, stage: 'compressing' });

  // 3. Compress / convert (skipped for SVG, GIF, already-WebP)
  let uploadFile = file;
  if (!opts.skipCompression) {
    const compressed = await compressImage(file, onProgress);
    uploadFile = compressed.file;
  }

  const ext = uploadFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  onProgress?.({ percent: 40, stage: 'uploading' });

  // 4. Upload with progress tracking
  const result = await uploadWithProgress(
    uploadFile,
    filename,
    uploadFile.type,
    (uploadPercent) => {
      // Map 0-100 upload progress to 40-90 overall
      onProgress?.({ percent: 40 + Math.round(uploadPercent * 0.5), stage: 'uploading' });
    }
  );

  if ('error' in result) {
    return { url: null, error: result.error };
  }

  onProgress?.({ percent: 92, stage: 'processing' });

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  const publicUrl = urlData.publicUrl;

  // 5. Fire-and-forget: generate size variants via edge function
  const isOptimizable = COMPRESSIBLE.has(file.type) || file.type === 'image/webp';
  if (isOptimizable) {
    triggerOptimization(publicUrl, BUCKET, filename).catch(() => {});
  }

  onProgress?.({ percent: 100, stage: 'done' });

  return { url: publicUrl, error: null };
}

// ─── Post-upload optimization ─────────────────────────────────────────────────

async function triggerOptimization(
  originalUrl: string,
  bucket: string,
  storagePath: string
): Promise<void> {
  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || '';
  const anonKey =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || '';

  if (!supabaseUrl || !anonKey) return;

  await fetch(`${supabaseUrl}/functions/v1/image-optimizer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ originalUrl, bucket, storagePath }),
  });
}

// ─── Delete & cleanup ─────────────────────────────────────────────────────────

export async function deleteImageFromSupabase(url: string): Promise<void> {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split(`/object/public/${BUCKET}/`);
    if (parts.length < 2) return;
    const path = parts[1];
    const db = adminSupabase();
    await db.storage.from(BUCKET).remove([path]);
    await cleanupVariants(url, BUCKET, db);
  } catch {}
}

async function cleanupVariants(
  originalUrl: string,
  bucket: string,
  db: ReturnType<typeof adminSupabase>
): Promise<void> {
  try {
    const { data: variants } = await supabase
      .from('image_variants')
      .select('url')
      .eq('original_url', originalUrl);

    if (!variants?.length) return;

    const variantPaths = variants.map((v: any) => {
      try {
        const u = new URL(v.url);
        const parts = u.pathname.split(`/object/public/${bucket}/`);
        return parts.length > 1 ? parts[1] : null;
      } catch { return null; }
    }).filter(Boolean) as string[];

    if (variantPaths.length > 0) {
      await db.storage.from(bucket).remove(variantPaths);
    }
    await db.from('image_variants').delete().eq('original_url', originalUrl);
  } catch {}
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Human-readable file size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
