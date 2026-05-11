import { supabase, adminSupabase } from './supabase';

export type UploadResult =
  | { url: string; error: null }
  | { url: null; error: string };

const BUCKET = 'uploads';
const MAX_SIZE_MB = 10;

export function validateImageFile(file: File): string | null {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return `Invalid file type "${file.type}". Allowed: JPG, PNG, WEBP, SVG, GIF.`;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max size is ${MAX_SIZE_MB} MB.`;
  }
  return null;
}

export async function uploadImageToSupabase(
  file: File,
  folder: 'products' | 'branding' | 'cms' | 'general' = 'general'
): Promise<UploadResult> {
  const validationError = validateImageFile(file);
  if (validationError) return { url: null, error: validationError };

  // Always output WebP for JPEG/PNG uploads (skip SVG/GIF)
  const isOptimizable = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
  let uploadFile = file;
  let ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';

  if (isOptimizable && typeof OffscreenCanvas !== 'undefined') {
    const converted = await convertToWebP(file);
    if (converted) {
      uploadFile = converted;
      ext = 'webp';
    }
  }

  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const db = adminSupabase();
  const { data, error } = await db.storage
    .from(BUCKET)
    .upload(filename, uploadFile, { contentType: uploadFile.type, upsert: false });

  if (error) {
    return { url: null, error: error.message };
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  const publicUrl = urlData.publicUrl;

  // Fire-and-forget: generate optimized size variants via edge function
  if (isOptimizable) {
    triggerOptimization(publicUrl, BUCKET, data.path).catch(() => {});
  }

  return { url: publicUrl, error: null };
}

/**
 * Convert a JPEG/PNG File to WebP using OffscreenCanvas (web only).
 * Returns null if conversion fails or isn't supported.
 */
async function convertToWebP(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // PNG: keep at 0.90 quality to preserve detail; JPEG: 0.87 saves ~30%
    const quality = file.type === 'image/png' ? 0.90 : 0.87;
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });

    // Only use WebP if it's actually smaller or within 5% of original size
    if (blob.size > file.size * 1.05) return null;

    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
  } catch {
    return null;
  }
}

/**
 * Call the image-optimizer edge function to generate thumbnail/small/medium/large variants.
 * Runs asynchronously — upload is not blocked waiting for this.
 */
async function triggerOptimization(
  originalUrl: string,
  bucket: string,
  storagePath: string
): Promise<void> {
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL || '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY || '';

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

export async function deleteImageFromSupabase(url: string): Promise<void> {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split(`/object/public/${BUCKET}/`);
    if (parts.length < 2) return;
    const path = parts[1];
    const db = adminSupabase();
    await db.storage.from(BUCKET).remove([path]);

    // Also clean up any generated variants
    await cleanupVariants(url, BUCKET, path, db);
  } catch {
  }
}

async function cleanupVariants(
  originalUrl: string,
  bucket: string,
  storagePath: string,
  db: ReturnType<typeof adminSupabase>
): Promise<void> {
  try {
    const { data: variants } = await supabase
      .from('image_variants')
      .select('url, storage_path')
      .eq('original_url', originalUrl);

    if (!variants || variants.length === 0) return;

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
  } catch {
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
