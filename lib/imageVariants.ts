import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type SizeName = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

/** Max pixel widths for each size bucket (longest side) */
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

// ─── In-memory variant cache ──────────────────────────────────────────────────
// Map<originalUrl → Map<sizeName → variant>>
const variantCache = new Map<string, Map<SizeName, ImageVariant> | null>();
// Tracks in-flight DB requests so we don't double-fetch
const fetchPromises = new Map<string, Promise<Map<SizeName, ImageVariant>>>();

/**
 * Fetch all variants for an original URL.
 * Returns a size map (may be empty if no variants have been generated yet).
 * Results are cached in memory for the session lifetime.
 */
export async function fetchVariants(originalUrl: string): Promise<Map<SizeName, ImageVariant>> {
  if (!originalUrl) return new Map();

  const cached = variantCache.get(originalUrl);
  if (cached !== undefined) return cached ?? new Map();

  // Deduplicate concurrent fetches for the same URL
  const existing = fetchPromises.get(originalUrl);
  if (existing) return existing;

  const promise = (async () => {
    try {
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
    } catch {
      variantCache.set(originalUrl, null);
      return new Map<SizeName, ImageVariant>();
    } finally {
      fetchPromises.delete(originalUrl);
    }
  })();

  fetchPromises.set(originalUrl, promise);
  return promise;
}

/**
 * Invalidate a URL's cache entry (call after re-uploading an image).
 */
export function invalidateVariantCache(originalUrl: string): void {
  variantCache.delete(originalUrl);
  fetchPromises.delete(originalUrl);
}

/**
 * Pick the best size name for a display width in CSS/layout pixels.
 * Applies 2× density multiplier so retina screens get sharp images.
 */
export function pickSize(displayWidth: number): SizeName {
  const needed = displayWidth * 2;
  if (needed <= SIZE_WIDTHS.thumbnail) return 'thumbnail';
  if (needed <= SIZE_WIDTHS.small)     return 'small';
  if (needed <= SIZE_WIDTHS.medium)    return 'medium';
  if (needed <= SIZE_WIDTHS.large)     return 'large';
  return 'original';
}

/**
 * Get a variant URL from an already-loaded variant map.
 * Walks up size tiers if the exact size isn't available.
 */
export function getVariantUrl(
  variants: Map<SizeName, ImageVariant>,
  size: SizeName,
  fallback: string
): string {
  // Exact match
  const exact = variants.get(size);
  if (exact) return exact.url;

  // Walk up to larger sizes (prefer never downscaling)
  const order: SizeName[] = ['thumbnail', 'small', 'medium', 'large', 'original'];
  const idx = order.indexOf(size);
  for (let i = idx + 1; i < order.length; i++) {
    const bigger = variants.get(order[i]);
    if (bigger) return bigger.url;
  }

  return fallback;
}

/**
 * One-shot async helper: given a URL and display width, return best variant URL.
 */
export async function resolveImageUrl(
  originalUrl: string | null | undefined,
  displayWidth: number
): Promise<string> {
  if (!originalUrl) return '';
  const size = pickSize(displayWidth);
  const variants = await fetchVariants(originalUrl);
  return getVariantUrl(variants, size, originalUrl);
}

// ─── Preload API ──────────────────────────────────────────────────────────────

/**
 * Preload an image URL into the browser cache (web only).
 * Call this for above-the-fold images like hero banners.
 */
export function preloadImage(url: string): void {
  if (Platform.OS !== 'web' || !url) return;
  try {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    // Signal WebP support for preload hint
    if (url.endsWith('.webp')) {
      (link as any).type = 'image/webp';
    }
    document.head.appendChild(link);
  } catch {}
}

/**
 * Prefetch variant URLs for a list of image URLs (e.g., product grid).
 * Fires off background fetch so variants are cache-warm when displayed.
 */
export function prefetchVariants(originalUrls: string[]): void {
  for (const url of originalUrls) {
    if (url && !variantCache.has(url)) {
      fetchVariants(url).catch(() => {});
    }
  }
}

// ─── Cache-busting URL ────────────────────────────────────────────────────────

/**
 * Supabase Storage URLs are stable (immutable once uploaded).
 * This helper appends no-op cache params only in dev for forced refresh.
 * In production the URL is returned as-is for CDN caching.
 */
export function cdnUrl(url: string): string {
  return url;
}

// ─── React hook ──────────────────────────────────────────────────────────────

type UseOptimizedImageResult = {
  /** Best available URL — starts as original, upgrades to variant once loaded */
  src: string;
  /** True once a smaller/optimized variant has been resolved */
  isOptimized: boolean;
};

/**
 * React hook that resolves the best variant for an original image URL.
 *
 * - Immediately returns the original URL so nothing blocks rendering.
 * - Asynchronously resolves the variant and updates src.
 * - Results are session-cached so repeated mounts are instant.
 *
 * @param originalUrl - Full public URL of the uploaded image
 * @param displayWidth - Intended render width in layout pixels
 */
export function useOptimizedImage(
  originalUrl: string | null | undefined,
  displayWidth: number
): UseOptimizedImageResult {
  const [src, setSrc] = useState<string>(originalUrl ?? '');
  const [isOptimized, setIsOptimized] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setSrc(originalUrl ?? '');
    setIsOptimized(false);

    if (!originalUrl) return;

    // Check synchronous cache first (avoids flicker on re-render)
    const cached = variantCache.get(originalUrl);
    if (cached) {
      const size = pickSize(displayWidth);
      const variantUrl = getVariantUrl(cached, size, originalUrl);
      if (variantUrl !== originalUrl) {
        setSrc(variantUrl);
        setIsOptimized(true);
      }
      return;
    }

    resolveImageUrl(originalUrl, displayWidth).then((url) => {
      if (cancelledRef.current) return;
      if (url && url !== originalUrl) {
        setSrc(url);
        setIsOptimized(true);
      }
    });

    return () => { cancelledRef.current = true; };
  }, [originalUrl, displayWidth]);

  return { src, isOptimized };
}
