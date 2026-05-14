import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions, Animated, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Radius } from '@/constants/theme';

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=1200';

const AUTO_PLAY_MS = 5000;
const SWIPE_THRESHOLD = 50;

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
  heroContent?: Record<string, any>;
};

// Animated pill dot
function AnimatedDot({ active, onPress }: { active: boolean; onPress: () => void }) {
  const widthAnim = useRef(new Animated.Value(active ? 22 : 7)).current;
  const opacityAnim = useRef(new Animated.Value(active ? 1 : 0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(widthAnim, {
        toValue: active ? 22 : 7,
        useNativeDriver: false,
        speed: 18,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: active ? 1 : 0.4,
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
            backgroundColor: active ? '#FF4D8D' : 'rgba(255,255,255,0.55)',
          },
        ]}
      />
    </TouchableOpacity>
  );
}

export default function HeroSlider({ slides, heroContent }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const heroHeight = Math.max(360, Math.round(width * 0.87));

  const activeSlides = slides.filter(s => s.is_active);

  const legacySlide: HeroSlide | null = activeSlides.length === 0 && heroContent
    ? {
        id: 'legacy',
        sort_order: 0,
        is_active: true,
        media_type: 'image',
        image_url: heroContent.image_url || FALLBACK_IMAGE,
        video_url: '',
        badge_text: heroContent.badge_text || '',
        title: heroContent.title || '',
        subtitle: heroContent.subtitle || '',
        cta_text: heroContent.cta_primary || '',
        cta_url: '/(tabs)/products',
        overlay_opacity: 0.55,
      }
    : null;

  const allSlides = activeSlides.length > 0 ? activeSlides : legacySlide ? [legacySlide] : [];

  const [current, setCurrent] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const contentFade = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPaused = useRef(false);

  const goTo = useCallback((idx: number) => {
    if (allSlides.length <= 1) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(contentFade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setCurrent(idx);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(contentFade, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]).start();
    });
  }, [allSlides.length, fadeAnim, contentFade]);

  const next = useCallback(() => goTo((current + 1) % allSlides.length), [current, allSlides.length, goTo]);
  const prev = useCallback(() => goTo((current - 1 + allSlides.length) % allSlides.length), [current, allSlides.length, goTo]);

  // Auto-play
  useEffect(() => {
    if (allSlides.length <= 1 || isPaused.current) return;
    timerRef.current = setTimeout(next, AUTO_PLAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, allSlides.length, next]);

  // Swipe via PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => {
        isPaused.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
      },
      onPanResponderRelease: (_, gs) => {
        isPaused.current = false;
        if (gs.dx < -SWIPE_THRESHOLD) {
          // lazily call next via a ref so we always have fresh value
          nextRef.current();
        } else if (gs.dx > SWIPE_THRESHOLD) {
          prevRef.current();
        } else {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => nextRef.current(), AUTO_PLAY_MS);
        }
      },
      onPanResponderTerminate: () => {
        isPaused.current = false;
      },
    })
  ).current;

  // Keep stable refs for pan responder closures
  const nextRef = useRef(next);
  const prevRef = useRef(prev);
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { prevRef.current = prev; }, [prev]);

  if (allSlides.length === 0) return null;

  const slide = allSlides[Math.min(current, allSlides.length - 1)];
  const overlayColor = `rgba(0,0,0,${(slide.overlay_opacity ?? 0.55).toFixed(2)})`;
  const imageUrl = slide.image_url || FALLBACK_IMAGE;

  const handleCta = () => {
    const url = slide.cta_url;
    if (!url) return;
    try { router.push(url as any); } catch { /* ignore */ }
  };

  return (
    <View style={[styles.hero, { height: heroHeight }]} {...panResponder.panHandlers}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </Animated.View>

      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.15)', 'rgba(5,3,4,0.72)', 'rgba(5,3,4,0.97)']}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View style={[styles.heroContent, { opacity: contentFade }]}>
        {!!slide.badge_text && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{slide.badge_text.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.heroTitle}>{slide.title}</Text>
        {!!slide.subtitle && <Text style={styles.heroSubtitle}>{slide.subtitle}</Text>}
        {!!slide.cta_text && (
          <TouchableOpacity style={styles.heroCtaBtn} activeOpacity={0.82} onPress={handleCta}>
            <Text style={styles.heroCtaText}>{slide.cta_text.toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {allSlides.length > 1 && (
        <>
          <TouchableOpacity style={[styles.arrow, styles.arrowLeft]} onPress={prev} activeOpacity={0.75}>
            <ChevronLeft size={18} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.arrow, styles.arrowRight]} onPress={next} activeOpacity={0.75}>
            <ChevronRight size={18} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.dots}>
            {allSlides.map((_, i) => (
              <AnimatedDot key={i} active={i === current} onPress={() => goTo(i)} />
            ))}
          </View>
        </>
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
    paddingHorizontal: 20,
    paddingBottom: 72,
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
    backgroundColor: 'rgba(255,77,141,0.08)',
  },
  badgeText: {
    color: '#FF4D8D',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: 0.2,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 12,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroCtaBtn: {
    backgroundColor: '#FF4D8D',
    borderRadius: Radius.full,
    paddingHorizontal: 52,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.75,
    shadowRadius: 18,
    elevation: 10,
  },
  heroCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
  arrow: {
    position: 'absolute',
    top: '40%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  dots: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
