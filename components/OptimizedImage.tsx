/**
 * OptimizedImage
 *
 * Drop-in replacement for React Native <Image> that:
 *  1. Serves the correct size variant (thumbnail/small/medium/large) based on display width
 *  2. Shows a lightweight placeholder while the image loads
 *  3. Fades in once loaded to eliminate layout shifts
 *  4. On web: uses <img> with WebP + lazy loading for CDN caching
 *  5. Falls back to original URL if no variant exists yet
 *
 * Usage:
 *   <OptimizedImage source={{ uri: product.image_url }} displayWidth={100} style={styles.img} />
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Image,
  ImageStyle,
  StyleSheet,
  View,
  ViewStyle,
  Animated,
  Platform,
} from 'react-native';
import { useOptimizedImage } from '@/lib/imageVariants';

type ResizeMode = 'cover' | 'contain' | 'stretch' | 'center';

type Props = {
  /** { uri: string } — same interface as RN Image source */
  source: { uri?: string | null } | null | undefined;
  /** Intended render width in layout pixels — used to pick the right variant */
  displayWidth: number;
  style?: ImageStyle | ImageStyle[];
  resizeMode?: ResizeMode;
  /** Accessible label */
  alt?: string;
  /** Whether to skip variant resolution (e.g., for shade swatches < 32px) */
  noVariants?: boolean;
  /** Extra container style */
  containerStyle?: ViewStyle;
};

export default function OptimizedImage({
  source,
  displayWidth,
  style,
  resizeMode = 'cover',
  alt = '',
  noVariants = false,
  containerStyle,
}: Props) {
  const originalUrl = source?.uri ?? null;

  // Resolve best variant (or use original if noVariants)
  const { src } = useOptimizedImage(noVariants ? null : originalUrl, displayWidth);
  const activeSrc = noVariants ? (originalUrl ?? '') : (src || originalUrl || '');

  const [loaded, setLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset when image URL changes
    setLoaded(false);
    fadeAnim.setValue(0);
  }, [activeSrc, fadeAnim]);

  const handleLoad = () => {
    setLoaded(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  if (!activeSrc) {
    return <View style={[styles.placeholder, style as ViewStyle, containerStyle]} />;
  }

  // ── Web: use native <img> for best CDN cache + lazy loading ──────────────
  if (Platform.OS === 'web') {
    return (
      <WebOptimizedImage
        src={activeSrc}
        originalSrc={originalUrl ?? ''}
        resizeMode={resizeMode}
        alt={alt}
        style={style}
        containerStyle={containerStyle}
      />
    );
  }

  // ── Native: Animated.Image with fade-in ──────────────────────────────────
  return (
    <View style={[styles.placeholder, containerStyle]}>
      <Animated.Image
        source={{ uri: activeSrc }}
        style={[styles.fill, style, { opacity: fadeAnim }]}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        fadeDuration={0}
      />
    </View>
  );
}

// ─── Web implementation ───────────────────────────────────────────────────────

type WebProps = {
  src: string;
  originalSrc: string;
  resizeMode: ResizeMode;
  alt: string;
  style?: ImageStyle | ImageStyle[];
  containerStyle?: ViewStyle;
};

function WebOptimizedImage({ src, originalSrc, resizeMode, alt, style, containerStyle }: WebProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setVisible(false);
  }, [src]);

  const flatStyle = StyleSheet.flatten(style) ?? {};
  const containerFlat = StyleSheet.flatten(containerStyle) ?? {};

  const objectFit: React.CSSProperties['objectFit'] =
    resizeMode === 'cover'   ? 'cover'   :
    resizeMode === 'contain' ? 'contain' :
    resizeMode === 'stretch' ? 'fill'    : 'none';

  const containerCss: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 15, 24, 0.4)',
    ...(containerFlat as any),
    ...(flatStyle as any),
  };

  const imgCss: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit,
    objectPosition: 'center',
    transition: 'opacity 0.18s ease',
    opacity: visible ? 1 : 0,
    userSelect: 'none',
  };

  return (
    // @ts-ignore — web-only div
    <div style={containerCss}>
      {/* @ts-ignore */}
      <img
        src={imgSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={imgCss}
        onLoad={() => setVisible(true)}
        onError={() => {
          // Fallback to original if variant fails
          if (imgSrc !== originalSrc && originalSrc) {
            setImgSrc(originalSrc);
          }
        }}
      />
    </div>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'rgba(30, 15, 24, 0.4)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
});
