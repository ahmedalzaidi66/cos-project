import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Radius } from '@/constants/theme';
import { useOptimizedImage, preloadImage } from '@/lib/imageVariants';

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=1200';

const AUTO_PLAY_MS = 5000;

export type HeroSlide = {
  id: string;
  sort_order: number;
  is_active: boolean;
  media_type: 'image' | 'video';
  image_url: string;
  video_url: string;
  badge_text: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_url: string;
  overlay_opacity: number;
};

type Props = {
  slides: HeroSlide[];
  /** Fallback: single heroContent object (legacy CMS path) */
  heroContent?: Record<string, any>;
};

// Animated pill dot component
function AnimatedDot({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const widthAnim = useRef(new Animated.Value(active ? 20 : 6)).current;
  const opacityAnim = useRef(new Animated.Value(active ? 1 : 0.45)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(widthAnim, {
        toValue: active ? 20 : 6,
        useNativeDriver: false,
        speed: 18,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: active ? 1 : 0.45,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [active]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
      <Animated.View
        style={[
          styles.dot,
          {
            width: widthAnim,
            opacity: opacityAnim,
            backgroundColor: active ? '#FF4D8D' : 'rgba(255,255,255,0.6)',
          },
        ]}
      />
    </TouchableOpacity>
  );
}

export default function HeroSlider({ slides, heroContent }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const heroHeight = isMobile
    ? Math.min(260, Math.max(180, Math.round(width * 0.52)))
    : Math.min(340, Math.max(260, Math.round(width * 0.28)));

  const activeSlides = slides.filter(s => s.is_active);

  // If no slides from DB, fall back to legacy single heroContent
  const legacySlide: HeroSlide | null = activeSlides.length === 0 && heroContent
    ? {
        id: 'legacy',
        sort_order: 0,
        is_active: true,
        media_type: heroContent.media_type === 'video' ? 'video' : 'image',
        image_url: heroContent.image_url || FALLBACK_IMAGE,
        video_url: heroContent.video_url || '',
        badge_text: heroContent.badge_text || '',
        title: heroContent.title || '',
        subtitle: heroContent.subtitle || '',
        cta_text: heroContent.cta_primary || '',
        cta_url: '/(tabs)/products',
        overlay_opacity: parseFloat(
          (heroContent.overlay_color || 'rgba(0,0,0,0.55)').match(/[\d.]+\)/)?.[0]?.replace(')', '') || '0.55'
        ),
      }
    : null;

  const allSlides = activeSlides.length > 0 ? activeSlides : legacySlide ? [legacySlide] : [];

  // Preload the first visible hero image for LCP performance
  useEffect(() => {
    const firstImageSlide = allSlides.find(s => s.media_type !== 'video' && s.image_url);
    if (firstImageSlide?.image_url) {
      preloadImage(firstImageSlide.image_url);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [current, setCurrent] = useState(0);
  const [videoFailed, setVideoFailed] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPaused = useRef(false);

  // Cross-fade animation
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const contentFade = useRef(new Animated.Value(1)).current;

  // Swipe tracking
  const dragStartX = useRef<number | null>(null);
  const isDragging = useRef(false);

  const goTo = useCallback((idx: number) => {
    if (allSlides.length <= 1) return;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(contentFade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setCurrent(idx);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    });
  }, [allSlides.length, fadeAnim, contentFade]);

  const next = useCallback(() => {
    goTo((current + 1) % allSlides.length);
  }, [current, allSlides.length, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + allSlides.length) % allSlides.length);
  }, [current, allSlides.length, goTo]);

  // Auto-play — pauses on hover/drag
  useEffect(() => {
    if (allSlides.length <= 1 || isPaused.current) return;
    timerRef.current = setTimeout(next, AUTO_PLAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, allSlides.length, next]);

  const slide = allSlides[Math.min(current, allSlides.length - 1)] ?? null;

  // Resolve optimized hero image (large variant ~ 1200px, falls back to original)
  const rawHeroUrl = slide?.image_url || FALLBACK_IMAGE;
  const { src: optimizedHeroUrl } = useOptimizedImage(rawHeroUrl, width);

  if (allSlides.length === 0) return null;

  const overlayColor = `rgba(0,0,0,${(slide!.overlay_opacity ?? 0.55).toFixed(2)})`;
  const useVideo = slide!.media_type === 'video' && !!slide!.video_url && !videoFailed[slide!.id];
  const imageUrl = optimizedHeroUrl || rawHeroUrl;

  const handleCta = () => {
    const url = slide!.cta_url;
    if (!url) return;
    try { router.push(url as any); } catch { /* ignore */ }
  };

  // Web pointer/touch swipe handlers
  const onPointerDown = (e: any) => {
    dragStartX.current = e.clientX ?? e.touches?.[0]?.clientX ?? null;
    isDragging.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    isPaused.current = true;
  };

  const onPointerMove = (e: any) => {
    if (dragStartX.current === null) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? dragStartX.current;
    if (Math.abs(x - dragStartX.current) > 8) isDragging.current = true;
  };

  const onPointerUp = (e: any) => {
    if (dragStartX.current === null) return;
    const x = e.clientX ?? e.changedTouches?.[0]?.clientX ?? dragStartX.current;
    const delta = x - dragStartX.current;
    dragStartX.current = null;
    isPaused.current = false;
    if (isDragging.current && Math.abs(delta) > 40) {
      delta < 0 ? next() : prev();
    } else {
      // restart timer
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(next, AUTO_PLAY_MS);
    }
    isDragging.current = false;
  };

  const onMouseEnter = () => {
    isPaused.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const onMouseLeave = () => {
    isPaused.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(next, AUTO_PLAY_MS);
  };

  return (
    <View
      style={[styles.hero, { height: heroHeight }]}
      // @ts-ignore web-only events
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
    >
      {/* ── Media layer ─────────────────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        {useVideo ? (
          // @ts-ignore
          <video
            key={`${slide.id}-video`}
            src={slide.video_url}
            autoPlay loop muted playsInline
            onError={() => setVideoFailed(p => ({ ...p, [slide.id]: true }))}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
          />
        ) : (
          <img
            key={`${slide.id}-img`}
            src={imageUrl}
            alt={slide.title || 'hero'}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', pointerEvents: 'none', userSelect: 'none' } as React.CSSProperties}
          />
        )}
      </Animated.View>

      {/* ── Overlays ────────────────────────────────────────────────── */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.15)', 'rgba(5,3,4,0.72)', 'rgba(5,3,4,0.97)']}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Content ─────────────────────────────────────────────────── */}
      <Animated.View style={[styles.heroContent, { opacity: contentFade }]}>
        {!!slide.badge_text && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{slide.badge_text.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.heroTitle}>{slide.title}</Text>
        {!!slide.subtitle && (
          <Text style={styles.heroSubtitle}>{slide.subtitle}</Text>
        )}
        {!!slide.cta_text && (
          <TouchableOpacity style={styles.heroCtaBtn} activeOpacity={0.82} onPress={handleCta}>
            <Text style={styles.heroCtaText}>{slide.cta_text.toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Arrow controls (multi-slide only) ───────────────────────── */}
      {allSlides.length > 1 && (
        <>
          <TouchableOpacity style={[styles.arrow, styles.arrowLeft]} onPress={prev} activeOpacity={0.75}>
            <ChevronLeft size={16} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.arrow, styles.arrowRight]} onPress={next} activeOpacity={0.75}>
            <ChevronRight size={16} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
          </TouchableOpacity>
        </>
      )}

      {/* ── Animated dot indicators ─────────────────────────────────── */}
      {allSlides.length > 1 && (
        <View style={styles.dots}>
          {allSlides.map((_, i) => (
            <AnimatedDot key={i} active={i === current} onPress={() => goTo(i)} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0A0507',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 40,
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.45)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 10,
    backgroundColor: 'rgba(255,77,141,0.08)',
  },
  badgeText: {
    color: '#FF4D8D',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 31,
    letterSpacing: 0.2,
    marginBottom: 7,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 12,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 13,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroCtaBtn: {
    backgroundColor: '#FF4D8D',
    borderRadius: Radius.full,
    paddingHorizontal: 28,
    paddingVertical: 7,
    alignItems: 'center',
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.75,
    shadowRadius: 14,
    elevation: 10,
  },
  heroCtaText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    // @ts-ignore — web-only transform
    transform: [{ translateY: -15 }],
    cursor: 'pointer',
  },
  arrowLeft: { left: 10 },
  arrowRight: { right: 10 },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
});
