import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Radius } from '@/constants/theme';

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

  const [current, setCurrent] = useState(0);
  const [videoFailed, setVideoFailed] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cross-fade animation between slides
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = useCallback((idx: number) => {
    if (allSlides.length <= 1) return;
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCurrent(idx), 260);
  }, [allSlides.length, fadeAnim]);

  const next = useCallback(() => {
    goTo((current + 1) % allSlides.length);
  }, [current, allSlides.length, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + allSlides.length) % allSlides.length);
  }, [current, allSlides.length, goTo]);

  // Auto-play
  useEffect(() => {
    if (allSlides.length <= 1) return;
    timerRef.current = setTimeout(next, AUTO_PLAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, allSlides.length, next]);

  if (allSlides.length === 0) return null;

  const slide = allSlides[Math.min(current, allSlides.length - 1)];
  const overlayColor = `rgba(0,0,0,${(slide.overlay_opacity ?? 0.55).toFixed(2)})`;
  const useVideo = slide.media_type === 'video' && !!slide.video_url && !videoFailed[slide.id];
  const imageUrl = slide.image_url || FALLBACK_IMAGE;

  const handleCta = () => {
    const url = slide.cta_url;
    if (!url) return;
    try { router.push(url as any); } catch { /* ignore */ }
  };

  return (
    <View style={[styles.hero, { height: heroHeight }]}>
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
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', pointerEvents: 'none' }}
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
      <Animated.View style={[styles.heroContent, { opacity: fadeAnim }]}>
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

      {/* ── Dot indicators ──────────────────────────────────────────── */}
      {allSlides.length > 1 && (
        <View style={styles.dots}>
          {allSlides.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <View style={[styles.dot, i === current && styles.dotActive]} />
            </TouchableOpacity>
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
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF4D8D',
  },
});
