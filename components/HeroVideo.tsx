import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Radius } from '@/constants/theme';

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800';

type Props = {
  heroContent: Record<string, any>;
};

export default function HeroVideo({ heroContent }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const heroHeight = Math.max(240, Math.round(width * 0.58));

  const imageUrl: string = heroContent.image_url || FALLBACK_IMAGE;
  const title: string = heroContent.title || '';
  const subtitle: string = heroContent.subtitle || '';
  const badgeText: string = heroContent.badge_text || '';
  const ctaText: string = heroContent.cta_primary || '';
  const overlayColor: string = heroContent.overlay_color || 'rgba(10,5,7,0.55)';

  return (
    <View style={[styles.hero, { height: heroHeight }]}>
      <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.0)',
          'rgba(0,0,0,0.15)',
          'rgba(10,5,7,0.65)',
          'rgba(10,5,7,0.95)',
        ]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.heroContent}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText.toUpperCase()}</Text>
        </View>
        <Text style={styles.heroTitle}>{title}</Text>
        {subtitle.length > 0 && (
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        )}
        <TouchableOpacity
          style={styles.heroCtaBtn}
          activeOpacity={0.82}
          onPress={() => router.push('/(tabs)/products' as any)}
        >
          <Text style={styles.heroCtaText}>{ctaText.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 28,
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
});
