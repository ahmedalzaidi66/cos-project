import { supabase } from './supabase';

export type SizeName = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

/** Pixel widths for each size preset */
export const SIZE_WIDTHS: Record<SizeName, number> = {
  thumbnail: 200,
  small:     400,
  medium:    800,
  large:     1200,
  original:  9999,
};

export type ImageVariant = {
  size_name: SizeName;
  url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
};

/**
 * In-memory cache: originalUrl → variant map.
 * Avoids repeat DB queries during the same session.
 */
const variantCache = new Map<string, Map<SizeName, ImageVariant>>();

/**
 * Fetch all variants for a given original URL and cache them.
 */
export async function fetchVariants(originalUrl: string): Promise<Map<SizeName, ImageVariant>> {
  if (!originalUrl) return new Map();

  const cached = variantCache.get(originalUrl);
  if (cached) return cached;

  const { data } = await supabase
    .from('image_variants')
    .select('size_name, url, width, height, bytes, format')
    .eq('original_url', originalUrl);

  const map = new Map<SizeName, ImageVariant>();
  if (data) {
    for (const row of data) {
      map.set(row.size_name as SizeName, row as ImageVariant);
    }
  }

  variantCache.set(originalUrl, map);
  return map;
}

/**
 * Synchronously get a variant URL from an already-loaded cache entry.
 * Falls back to originalUrl if the variant isn't available yet.
 */
export function getVariantUrl(
  variants: Map<SizeName, ImageVariant>,
  size: SizeName,
  fallback: string
): string {
  return variants.get(size)?.url ?? fallback;
}

/**
 * Pick the best size name for a given display width (in pixels).
 * Always returns the smallest variant that's large enough.
 */
export function pickSize(displayWidth: number): SizeName {
  // Use 2x for density — if card is 200px, we want 400px source
  const needed = displayWidth * 2;
  if (needed <= SIZE_WIDTHS.thumbnail) return 'thumbnail';
  if (needed <= SIZE_WIDTHS.small)     return 'small';
  if (needed <= SIZE_WIDTHS.medium)    return 'medium';
  if (needed <= SIZE_WIDTHS.large)     return 'large';
  return 'original';
}

/**
 * One-shot helper: given an original URL and a target display width,
 * return the best available variant URL (async, with cache).
 *
 * Usage:
 *   const src = await resolveImageUrl(product.main_image, 200);
 */
export async function resolveImageUrl(
  originalUrl: string | null | undefined,
  displayWidth: number
): Promise<string> {
  if (!originalUrl) return '';
  const sizeName = pickSize(displayWidth);
  const variants = await fetchVariants(originalUrl);
  return getVariantUrl(variants, sizeName, originalUrl);
}

/**
 * Hook-friendly: returns { src, loading } for a given image URL + display width.
 * Starts with the original URL and upgrades to the variant once loaded.
 */
import { useState, useEffect } from 'react';

export function useOptimizedImage(
  originalUrl: string | null | undefined,
  displayWidth: number
): { src: string; isOptimized: boolean } {
  const [src, setSrc] = useState<string>(originalUrl ?? '');
  const [isOptimized, setIsOptimized] = useState(false);

  useEffect(() => {
    setSrc(originalUrl ?? '');
    setIsOptimized(false);
    if (!originalUrl) return;

    let cancelled = false;
    resolveImageUrl(originalUrl, displayWidth).then((url) => {
      if (cancelled) return;
      if (url && url !== originalUrl) {
        setSrc(url);
        setIsOptimized(true);
      }
    });

    return () => { cancelled = true; };
  }, [originalUrl, displayWidth]);

  return { src, isOptimized };
}
