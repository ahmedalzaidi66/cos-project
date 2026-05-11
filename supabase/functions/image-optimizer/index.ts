import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Size presets in pixels (longest side)
const SIZE_PRESETS: Record<string, number> = {
  thumbnail: 200,
  small: 400,
  medium: 800,
  large: 1200,
};

// Quality by size (smaller = more aggressive compression)
const QUALITY_MAP: Record<string, number> = {
  thumbnail: 0.75,
  small: 0.80,
  medium: 0.85,
  large: 0.88,
};

type OptimizeRequest = {
  /** Full public URL of the original uploaded image */
  originalUrl: string;
  /** Storage bucket */
  bucket: string;
  /** Path inside bucket (e.g. products/1234-abc.jpg) */
  storagePath: string;
  /** Which sizes to generate (default: all) */
  sizes?: Array<keyof typeof SIZE_PRESETS>;
  /** Whether to preserve PNG transparency (default: auto-detect) */
  preserveTransparency?: boolean;
};

type VariantResult = {
  size: string;
  width: number;
  height: number;
  url: string;
  bytes: number;
  format: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const body: OptimizeRequest = await req.json();
    const { originalUrl, bucket, storagePath, preserveTransparency } = body;
    const requestedSizes = body.sizes ?? Object.keys(SIZE_PRESETS);

    if (!originalUrl || !bucket || !storagePath) {
      return new Response(
        JSON.stringify({ error: "originalUrl, bucket, storagePath are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch original image bytes
    const imgResp = await fetch(originalUrl);
    if (!imgResp.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch original image: ${imgResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const originalBytes = await imgResp.arrayBuffer();
    const originalSize = originalBytes.byteLength;
    const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";

    // Detect if image has transparency (PNG/WebP source)
    const isPng = contentType.includes("png") || storagePath.toLowerCase().endsWith(".png");
    const isGif = contentType.includes("gif") || storagePath.toLowerCase().endsWith(".gif");
    const needsTransparency = preserveTransparency ?? isPng;

    // Output format: WebP for all (PNG preserved only when explicitly needed)
    const outputFormat = needsTransparency ? "image/png" : "image/webp";
    const outputExt = needsTransparency ? "png" : "webp";

    // GIFs are not resized (animated GIF support is complex)
    if (isGif) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "GIF images are not optimized" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base path for variants
    // e.g., products/1234-abc.jpg → products/1234-abc
    const lastDot = storagePath.lastIndexOf(".");
    const basePath = lastDot > -1 ? storagePath.slice(0, lastDot) : storagePath;

    // Use OffscreenCanvas (available in Deno/Edge runtime via canvas polyfill)
    // Deno doesn't have a native canvas — use the @cf/img/transform-style approach
    // Instead, we'll use ImageMagick via Deno's Wasm or use the createImageBitmap API.
    // Supabase Edge Runtime supports createImageBitmap + OffscreenCanvas natively.

    let imageBitmap: ImageBitmap;
    try {
      imageBitmap = await createImageBitmap(new Blob([originalBytes], { type: contentType }));
    } catch (e) {
      return new Response(
        JSON.stringify({ error: `Failed to decode image: ${String(e)}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const srcWidth = imageBitmap.width;
    const srcHeight = imageBitmap.height;

    const variants: VariantResult[] = [];

    for (const sizeName of requestedSizes) {
      const maxPx = SIZE_PRESETS[sizeName];
      if (!maxPx) continue;

      // Skip upscaling — never make image bigger than original
      if (maxPx >= Math.max(srcWidth, srcHeight)) {
        continue;
      }

      // Compute output dimensions preserving aspect ratio
      const scale = maxPx / Math.max(srcWidth, srcHeight);
      const outW = Math.round(srcWidth * scale);
      const outH = Math.round(srcHeight * scale);

      const canvas = new OffscreenCanvas(outW, outH);
      const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(imageBitmap, 0, 0, outW, outH);

      const quality = QUALITY_MAP[sizeName] ?? 0.85;
      const blob = await canvas.convertToBlob({ type: outputFormat, quality });
      const variantBytes = await blob.arrayBuffer();

      // Upload path: products/1234-abc__thumbnail.webp
      const variantPath = `${basePath}__${sizeName}.${outputExt}`;

      const { error: uploadErr } = await db.storage
        .from(bucket)
        .upload(variantPath, variantBytes, {
          contentType: outputFormat,
          upsert: true,
          // 1-year immutable cache: variants never change once generated
          cacheControl: "public, max-age=31536000, immutable",
        });

      if (uploadErr) {
        console.error(`Failed to upload ${sizeName} variant:`, uploadErr.message);
        continue;
      }

      const { data: urlData } = db.storage.from(bucket).getPublicUrl(variantPath);

      variants.push({
        size: sizeName,
        width: outW,
        height: outH,
        url: urlData.publicUrl,
        bytes: blob.size,
        format: outputExt,
      });
    }

    // Also store a WebP-converted "original" if source wasn't already WebP
    const isAlreadyWebp = contentType.includes("webp") || storagePath.toLowerCase().endsWith(".webp");
    let optimizedOriginalUrl: string | null = null;

    if (!isAlreadyWebp && !needsTransparency) {
      const canvas = new OffscreenCanvas(srcWidth, srcHeight);
      const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(imageBitmap, 0, 0, srcWidth, srcHeight);
      const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.90 });
      const variantBytes = await blob.arrayBuffer();

      const originalWebpPath = `${basePath}__original.webp`;
      const { error: uploadErr } = await db.storage
        .from(bucket)
        .upload(originalWebpPath, variantBytes, {
          contentType: "image/webp",
          upsert: true,
        });

      if (!uploadErr) {
        const { data: urlData } = db.storage.from(bucket).getPublicUrl(originalWebpPath);
        optimizedOriginalUrl = urlData.publicUrl;
        variants.push({
          size: "original",
          width: srcWidth,
          height: srcHeight,
          url: urlData.publicUrl,
          bytes: blob.size,
          format: "webp",
        });
      }
    }

    imageBitmap.close();

    // Persist variants to image_variants table
    if (variants.length > 0) {
      const rows = variants.map((v) => ({
        original_url: originalUrl,
        bucket,
        storage_path: storagePath,
        size_name: v.size,
        width: v.width,
        height: v.height,
        url: v.url,
        bytes: v.bytes,
        format: v.format,
      }));

      await db.from("image_variants").upsert(rows, {
        onConflict: "original_url,size_name",
        ignoreDuplicates: false,
      });
    }

    const savedBytes = variants.reduce((acc, v) => acc + v.bytes, 0);
    const compressionRatio = originalSize > 0 ? (1 - savedBytes / variants.length / originalSize) * 100 : 0;

    return new Response(
      JSON.stringify({
        success: true,
        original: { url: originalUrl, bytes: originalSize, width: srcWidth, height: srcHeight },
        optimized_original_url: optimizedOriginalUrl,
        variants,
        stats: {
          variants_generated: variants.length,
          avg_compression_pct: Math.round(compressionRatio),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("image-optimizer error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
