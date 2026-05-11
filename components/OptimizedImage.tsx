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
  source: { uri?: string | null } | null | undefined;
  displayWidth: number;
  style?: ImageStyle | ImageStyle[];
  resizeMode?: ResizeMode;
  alt?: string;
  noVariants?: boolean;
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

  const { src } = useOptimizedImage(noVariants ? null : originalUrl, displayWidth);
  const activeSrc = noVariants ? (originalUrl ?? '') : (src || originalUrl || '');

  const [loaded, setLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const shimmerLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    setLoaded(false);
    fadeAnim.setValue(0);
  }, [activeSrc, fadeAnim]);

  // Start shimmer when not loaded, stop when loaded
  useEffect(() => {
    if (!loaded && activeSrc) {
      shimmerLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      );
      shimmerLoop.current.start();
    } else {
      shimmerLoop.current?.stop();
      shimmerAnim.setValue(0);
    }
    return () => { shimmerLoop.current?.stop(); };
  }, [loaded, activeSrc, shimmerAnim]);

  const handleLoad = () => {
    setLoaded(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.45],
  });

  if (!activeSrc) {
    return <View style={[styles.placeholder, style as ViewStyle, containerStyle]} />;
  }

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

  return (
    <View style={[styles.placeholder, containerStyle]}>
      {/* Skeleton shimmer shown while image loads */}
      {!loaded && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, styles.shimmer, { opacity: shimmerOpacity }]}
        />
      )}
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
  const [shimmerPhase, setShimmerPhase] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setImgSrc(src);
    setVisible(false);
    setShimmerPhase(true);
  }, [src]);

  // CSS shimmer pulse via interval (avoids RN Animated on web)
  useEffect(() => {
    if (visible) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setShimmerPhase(p => !p);
    }, 900);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible]);

  const flatStyle = StyleSheet.flatten(style) ?? {};
  const containerFlat = StyleSheet.flatten(containerStyle) ?? {};

  const objectFit: React.CSSProperties['objectFit'] =
    resizeMode === 'cover'   ? 'cover'   :
    resizeMode === 'contain' ? 'contain' :
    resizeMode === 'stretch' ? 'fill'    : 'none';

  const containerCss: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: shimmerPhase ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
    transition: 'background-color 0.9s ease',
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
    transition: 'opacity 0.2s ease',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  shimmer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
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
