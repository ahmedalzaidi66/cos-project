/**
 * Universal share utility — works across all platforms:
 *
 *  iOS / Android native  →  React Native Share.share() (native OS sheet)
 *  Web / mobile browser  →  navigator.share() when available
 *  Fallback              →  navigator.clipboard or RN Clipboard copy
 *
 * Returns:
 *   'shared'   — native share sheet opened (or navigator.share succeeded)
 *   'copied'   — text was written to clipboard
 *   'cancelled'— user dismissed the native sheet
 *   'error'    — something went wrong
 */

import { Platform, Share, Clipboard } from 'react-native';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'error';

export type SharePayload = {
  /** Short title (used by navigator.share and as PDF/print subject) */
  title: string;
  /** Human-readable body text */
  text: string;
  /** Full URL to share. Falls back to current page on web if omitted. */
  url?: string;
};

export async function shareContent(payload: SharePayload): Promise<ShareResult> {
  const { title, text } = payload;

  // Resolve URL: explicit > current web page > empty string
  const url = payload.url ?? (
    typeof window !== 'undefined' ? window.location.href : ''
  );

  const fullText = url ? `${text}\n${url}` : text;

  try {
    // ── Native iOS / Android ──────────────────────────────────────────────
    if (Platform.OS !== 'web') {
      const result = await Share.share(
        { message: fullText, url, title },
        { dialogTitle: title }
      );
      // Share.sharedAction means the user actually shared
      // Share.dismissedAction means they cancelled
      return result.action === Share.sharedAction ? 'shared' : 'cancelled';
    }

    // ── Web: navigator.share (mobile browsers, Chrome on Android, Safari) ─
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text, url: url || undefined });
      return 'shared';
    }

    // ── Web fallback: clipboard ───────────────────────────────────────────
    return await copyToClipboard(fullText);
  } catch (err: any) {
    // AbortError = user cancelled navigator.share
    if (err?.name === 'AbortError' || err?.code === 'ENOMEM') return 'cancelled';
    // Last-ditch: try clipboard
    try {
      return await copyToClipboard(fullText);
    } catch {
      return 'error';
    }
  }
}

async function copyToClipboard(text: string): Promise<ShareResult> {
  // Modern browsers
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }

  // React Native Clipboard (older RN or non-web platforms)
  if (Clipboard && typeof Clipboard.setString === 'function') {
    Clipboard.setString(text);
    return 'copied';
  }

  return 'error';
}

/**
 * Build a bilingual share payload for a product.
 * Pass language = 'ar' for an Arabic-first message.
 */
export function buildProductSharePayload(
  name: string,
  price: string,
  productId: string,
  language = 'en'
): SharePayload {
  const url =
    typeof window !== 'undefined'
      ? window.location.href
      : `https://lazurdebeauty.com/product/${productId}`;

  const title = name;

  const text =
    language === 'ar'
      ? `${name} — ${price}\nاكتشف المنتج على لازوردي`
      : `${name} — ${price}\nDiscover it on Lazurde`;

  return { title, text, url };
}
