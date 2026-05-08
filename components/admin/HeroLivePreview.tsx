import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, Tablet, Monitor, CircleAlert as AlertCircle, CirclePlay as PlayCircle } from 'lucide-react-native';
import { Colors, Radius, FontSize, Spacing } from '@/constants/theme';

export type HeroPreviewState = {
  mediaType: 'image' | 'video';
  imageUrl: string;
  videoUrl: string;
  overlayOpacity: number;
  badgeText: string;
  title: string;
  subtitle: string;
  ctaPrimary: string;
};

type Viewport = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  mobile: 320,
  tablet: 500,
  desktop: 720,
};

const VIEWPORT_HEIGHTS: Record<Viewport, number> = {
  mobile: 220,
  tablet: 280,
  desktop: 340,
};

type Props = { state: HeroPreviewState };

function HeroLivePreview({ state }: Props) {
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [prevMediaType, setPrevMediaType] = useState(state.mediaType);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { width: screenWidth } = useWindowDimensions();

  // ── Animation refs ────────────────────────────────────────────────────────
  // Media crossfade: old layer fades out, new layer fades in
  const mediaOpacity = useRef(new Animated.Value(1)).current;
  // Text fade-in whenever text fields change
  const textOpacity = useRef(new Animated.Value(1)).current;
  // Frame scale-in when viewport changes
  const frameScale = useRef(new Animated.Value(1)).current;

  const maxContainerWidth = Math.min(screenWidth - 32, 760);
  const previewW = Math.min(VIEWPORT_WIDTHS[viewport], maxContainerWidth);
  const previewH = VIEWPORT_HEIGHTS[viewport];

  // ── Media type crossfade ──────────────────────────────────────────────────
  useEffect(() => {
    if (state.mediaType === prevMediaType) return;
    setPrevMediaType(state.mediaType);
    setMediaLoading(true);

    Animated.sequence([
      Animated.timing(mediaOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(mediaOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    // Show spinner for a moment
    const t = setTimeout(() => setMediaLoading(false), 400);
    return () => clearTimeout(t);
  }, [state.mediaType]);

  // ── Media source change: fade out → in ───────────────────────────────────
  useEffect(() => {
    setVideoError(false);
    setMediaLoading(true);
    Animated.sequence([
      Animated.timing(mediaOpacity, { toValue: 0.2, duration: 150, useNativeDriver: true }),
      Animated.timing(mediaOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setMediaLoading(false), 600);
    return () => clearTimeout(t);
  }, [state.videoUrl]);

  useEffect(() => {
    setImageError(false);
    setMediaLoading(true);
    Animated.sequence([
      Animated.timing(mediaOpacity, { toValue: 0.2, duration: 150, useNativeDriver: true }),
      Animated.timing(mediaOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setMediaLoading(false), 600);
    return () => clearTimeout(t);
  }, [state.imageUrl]);

  // ── Text fade on any text change ─────────────────────────────────────────
  useEffect(() => {
    textOpacity.setValue(0.3);
    Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [state.title, state.subtitle, state.badgeText, state.ctaPrimary]);

  // ── Viewport change: scale pop ────────────────────────────────────────────
  const handleViewportChange = (vp: Viewport) => {
    setViewport(vp);
    Animated.sequence([
      Animated.timing(frameScale, { toValue: 0.96, duration: 100, useNativeDriver: true }),
      Animated.spring(frameScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
    ]).start();
  };

  // ── Video autoplay ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.play().catch(() => setVideoError(true));
  }, [state.videoUrl, state.mediaType]);

  const showVideo = state.mediaType === 'video' && !!state.videoUrl && !videoError;
  const showImage = !showVideo && !!state.imageUrl && !imageError;
  const overlayColor = `rgba(0,0,0,${state.overlayOpacity.toFixed(2)})`;

  return (
    <View style={styles.wrapper}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE PREVIEW</Text>
        </View>

        {/* Viewport toggle */}
        <View style={styles.viewportBtns}>
          {(['mobile', 'tablet', 'desktop'] as Viewport[]).map((vp) => {
            const active = viewport === vp;
            const color = active ? Colors.neonBlue : Colors.textMuted;
            return (
              <TouchableOpacity
                key={vp}
                style={[styles.vpBtn, active && styles.vpBtnActive]}
                onPress={() => handleViewportChange(vp)}
                activeOpacity={0.75}
              >
                {vp === 'mobile'  && <Smartphone size={13} color={color} strokeWidth={2} />}
                {vp === 'tablet'  && <Tablet     size={13} color={color} strokeWidth={2} />}
                {vp === 'desktop' && <Monitor    size={13} color={color} strokeWidth={2} />}
                <Text style={[styles.vpLabel, active && styles.vpLabelActive]}>
                  {VIEWPORT_WIDTHS[vp]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Frame outer ───────────────────────────────────────────────────── */}
      <View style={styles.frameOuter}>
        <Animated.View style={[styles.frame, { width: previewW, transform: [{ scale: frameScale }] }]}>
          {/* Notch */}
          {viewport === 'mobile' && <View style={styles.notch} />}

          {/* Hero */}
          <View style={[styles.hero, { height: previewH }]}>

            {/* ── Media layer (crossfades) ─────────────────────────────── */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: mediaOpacity }]}>
              {/* Video */}
              {state.mediaType === 'video' && !!state.videoUrl && !videoError && Platform.OS === 'web' && (
                // @ts-ignore
                <video
                  ref={videoRef}
                  src={state.videoUrl}
                  autoPlay loop muted playsInline
                  onError={() => setVideoError(true)}
                  onCanPlay={() => setMediaLoading(false)}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                />
              )}

              {/* Image */}
              {!showVideo && showImage && (
                <Image
                  source={{ uri: state.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  onLoad={() => setMediaLoading(false)}
                  onError={() => { setImageError(true); setMediaLoading(false); }}
                />
              )}

              {/* Empty / error placeholder */}
              {!showVideo && !showImage && !mediaLoading && (
                <View style={styles.emptyMedia}>
                  {videoError ? (
                    <>
                      <AlertCircle size={20} color={Colors.textMuted} strokeWidth={1.5} />
                      <Text style={styles.emptyText}>Video failed — using fallback</Text>
                    </>
                  ) : imageError ? (
                    <>
                      <AlertCircle size={20} color={Colors.error} strokeWidth={1.5} />
                      <Text style={[styles.emptyText, { color: Colors.error }]}>Image failed to load</Text>
                    </>
                  ) : (
                    <>
                      <PlayCircle size={20} color={Colors.textMuted} strokeWidth={1.5} />
                      <Text style={styles.emptyText}>No media URL set</Text>
                    </>
                  )}
                </View>
              )}
            </Animated.View>

            {/* ── Loading spinner overlay ───────────────────────────────── */}
            {mediaLoading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <View style={styles.loadingSpinnerWrap}>
                  <ActivityIndicator size="small" color="#FF4D8D" />
                </View>
              </View>
            )}

            {/* ── Dark overlay ─────────────────────────────────────────── */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} pointerEvents="none" />

            {/* ── Gradient ─────────────────────────────────────────────── */}
            <LinearGradient
              colors={['transparent', 'rgba(5,10,20,0.55)', 'rgba(5,10,20,0.93)']}
              locations={[0.2, 0.6, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* ── Text content (fades on change) ───────────────────────── */}
            <Animated.View style={[styles.heroContent, { opacity: textOpacity }]} pointerEvents="none">
              {!!state.badgeText && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{state.badgeText}</Text>
                </View>
              )}
              <Text style={styles.heroTitle} numberOfLines={3}>
                {state.title || 'Hero Title'}
              </Text>
              {!!state.subtitle && (
                <Text style={styles.heroSubtitle} numberOfLines={2}>
                  {state.subtitle}
                </Text>
              )}
              {!!state.ctaPrimary && (
                <View style={styles.ctaBtn}>
                  <Text style={styles.ctaBtnText}>{state.ctaPrimary.toUpperCase()}</Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Simulated page content below hero */}
          <View style={styles.bodyPlaceholder}>
            <View style={styles.bodyLine} />
            <View style={[styles.bodyLine, { width: '60%' }]} />
            <View style={styles.bodyCardRow}>
              <View style={styles.bodyCard} />
              <View style={styles.bodyCard} />
              <View style={styles.bodyCard} />
            </View>
          </View>
        </Animated.View>
      </View>

      {/* ── Info bar ──────────────────────────────────────────────────────── */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          Overlay{' '}
          <Text style={styles.infoValue}>{Math.round(state.overlayOpacity * 100)}%</Text>
          {'  ·  '}
          Media{' '}
          <Text style={styles.infoValue}>{state.mediaType === 'video' ? 'Video' : 'Image'}</Text>
          {'  ·  '}
          <Text style={styles.infoValue}>{VIEWPORT_WIDTHS[viewport]}px</Text>
          {' wide'}
          {mediaLoading && (
            <Text style={[styles.infoValue, { color: '#F59E0B' }]}> · Loading…</Text>
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#070D1A',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.18)',
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,77,141,0.12)',
    backgroundColor: '#040A14',
  },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  liveText: { color: '#22C55E', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },

  viewportBtns: { flexDirection: 'row', gap: 4 },
  vpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  vpBtnActive: {
    borderColor: 'rgba(255,77,141,0.5)',
    backgroundColor: 'rgba(255,77,141,0.1)',
  },
  vpLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '600' },
  vpLabelActive: { color: Colors.neonBlue },

  // ── Frame outer ──────────────────────────────────────────────────────────
  frameOuter: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#050B18',
  },
  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0A0507',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  notch: {
    width: 50, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginVertical: 7,
  },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: { position: 'relative', overflow: 'hidden', backgroundColor: '#0A0507' },

  emptyMedia: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#140A10',
  },
  emptyText: { color: Colors.textMuted, fontSize: 11, textAlign: 'center' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingSpinnerWrap: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.3)',
  },

  heroContent: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 14,
    alignItems: 'flex-start',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.45)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
    backgroundColor: 'rgba(255,77,141,0.08)',
  },
  badgeText: { color: '#FF4D8D', fontSize: 8, fontWeight: '700', letterSpacing: 2 },
  heroTitle: {
    color: '#FFF', fontSize: 18, fontWeight: '900', fontStyle: 'italic',
    lineHeight: 22, marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 10, lineHeight: 14, marginBottom: 10 },
  ctaBtn: {
    backgroundColor: '#FF4D8D',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaBtnText: { color: '#0A0507', fontSize: 9, fontWeight: '900', letterSpacing: 2 },

  // ── Body placeholder ─────────────────────────────────────────────────────
  bodyPlaceholder: { padding: 12, gap: 8, backgroundColor: '#040B18' },
  bodyLine: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', width: '80%' },
  bodyCardRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  bodyCard: { flex: 1, height: 52, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },

  // ── Info bar ─────────────────────────────────────────────────────────────
  infoBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#040A14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  infoText: { color: Colors.textMuted, fontSize: 10, letterSpacing: 0.3 },
  infoValue: { color: '#FF4D8D', fontWeight: '700' },
});


export default HeroLivePreview