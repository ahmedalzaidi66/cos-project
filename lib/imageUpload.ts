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

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const db = adminSupabase();
  const { data, error } = await db.storage
    .from(BUCKET)
    .upload(filename, file, { contentType: file.type, upsert: false });

  if (error) {
    return { url: null, error: error.message };
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { url: urlData.publicUrl, error: null };
}

export async function deleteImageFromSupabase(url: string): Promise<void> {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split(`/object/public/${BUCKET}/`);
    if (parts.length < 2) return;
    const path = parts[1];
    await adminSupabase().storage.from(BUCKET).remove([path]);
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
