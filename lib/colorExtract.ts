import { Platform } from 'react-native';

type RGB = [number, number, number];

export type SkinToneRGB = { r: number; g: number; b: number };

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function isIgnored(r: number, g: number, b: number, a: number): boolean {
  if (a < 30) return true;
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  if (brightness > 240) return true;
  if (brightness < 8) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 8 && brightness > 200) return true;
  return false;
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export async function extractDominantColor(imageUrl: string): Promise<string | null> {
  if (Platform.OS !== 'web') return null;

  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => resolve(null), 8000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { resolve(null); return; }

        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        const buckets = new Map<string, { count: number; rSum: number; gSum: number; bSum: number }>();
        const step = 24;
        let validPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (isIgnored(r, g, b, a)) continue;
          validPixels++;

          const qr = quantize(r, step);
          const qg = quantize(g, step);
          const qb = quantize(b, step);
          const key = `${qr},${qg},${qb}`;

          const bucket = buckets.get(key);
          if (bucket) {
            bucket.count++;
            bucket.rSum += r;
            bucket.gSum += g;
            bucket.bSum += b;
          } else {
            buckets.set(key, { count: 1, rSum: r, gSum: g, bSum: b });
          }
        }

        if (validPixels < 10 || buckets.size === 0) {
          resolve(null);
          return;
        }

        let best: { count: number; rSum: number; gSum: number; bSum: number } | null = null;
        for (const bucket of buckets.values()) {
          if (!best || bucket.count > best.count) best = bucket;
        }

        if (!best) { resolve(null); return; }

        const avgR = Math.round(best.rSum / best.count);
        const avgG = Math.round(best.gSum / best.count);
        const avgB = Math.round(best.bSum / best.count);

        resolve(rgbToHex(avgR, avgG, avgB));
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    img.src = imageUrl;
  });
}

function isSkinTone(r: number, g: number, b: number): boolean {
  if (r < 50 || g < 30) return false;
  if (r <= g || r <= b) return false;
  const diff = r - g;
  if (diff < 5 || diff > 120) return false;
  if (b > r) return false;
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness > 40 && brightness < 230;
}

export async function extractSkinTone(dataUrl: string): Promise<SkinToneRGB | null> {
  if (Platform.OS !== 'web') return null;

  return new Promise((resolve) => {
    const img = new window.Image();
    const timeout = setTimeout(() => resolve(null), 8000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { resolve(null); return; }

        ctx.drawImage(img, 0, 0, size, size);
        const cx = Math.floor(size * 0.3);
        const cy = Math.floor(size * 0.25);
        const w = Math.floor(size * 0.4);
        const h = Math.floor(size * 0.35);
        const data = ctx.getImageData(cx, cy, w, h).data;

        let rSum = 0, gSum = 0, bSum = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          if (!isSkinTone(r, g, b)) continue;
          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }

        if (count < 20) { resolve(null); return; }
        resolve({
          r: Math.round(rSum / count),
          g: Math.round(gSum / count),
          b: Math.round(bSum / count),
        });
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = dataUrl;
  });
}
