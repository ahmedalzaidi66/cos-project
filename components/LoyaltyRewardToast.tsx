import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Coins, TrendingUp } from 'lucide-react-native';
import { Colors, Radius, FontSize, Spacing } from '@/constants/theme';
import { TIER_COLORS, LoyaltyTier } from '@/lib/loyalty';

// ─── Points earned toast ────────────────────────────────────────────────────

type PointsToastProps = {
  visible: boolean;
  points: number;
  onHide: () => void;
};

export function PointsEarnedToast({ visible, points, onHide }: PointsToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!visible) return;

    // Spring in
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 12 }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 350, useNativeDriver: true }),
      ]).start(() => onHide());
    }, 2800);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
      pointerEvents="none"
    >
      <View style={styles.toastIconWrap}>
        <Coins size={18} color={Colors.gold} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toastTitle}>+{points.toLocaleString()} pts earned!</Text>
        <Text style={styles.toastSub}>Added to your rewards wallet</Text>
      </View>
    </Animated.View>
  );
}

// ─── Tier upgrade toast ─────────────────────────────────────────────────────

type TierToastProps = {
  visible: boolean;
  tier: LoyaltyTier;
  onHide: () => void;
};

export function TierUpgradeToast({ visible, tier, onHide }: TierToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const scale = useRef(new Animated.Value(0.75)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const tierColor = TIER_COLORS[tier] ?? Colors.gold;

  const TIER_LABELS: Record<string, string> = {
    bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum',
  };

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 14 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 16 }),
    ]).start();

    // Shimmer loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: 400, useNativeDriver: true }),
      ]).start(() => onHide());
    }, 4000);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <Animated.View
      style={[
        styles.tierToast,
        { borderColor: tierColor + '60', opacity, transform: [{ translateY }, { scale }] },
      ]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.tierGlow, { backgroundColor: tierColor + '15', opacity: shimmerOpacity }]} />
      <TrendingUp size={20} color={tierColor} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.tierToastTitle, { color: tierColor }]}>
          {TIER_LABELS[tier]} Tier Unlocked!
        </Text>
        <Text style={styles.tierToastSub}>You've reached {TIER_LABELS[tier]} member status</Text>
      </View>
    </Animated.View>
  );
}

// ─── Inline points pulse (used on product card / cart) ─────────────────────

type PointsPulseProps = {
  points: number;
  visible: boolean;
};

export function PointsPulse({ points, visible }: PointsPulseProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || points <= 0) return;
    translateY.setValue(0);
    opacity.setValue(1);

    Animated.parallel([
      Animated.timing(translateY, { toValue: -24, duration: 900, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible, points]);

  if (!visible || points <= 0) return null;

  return (
    <Animated.View
      style={[styles.pulse, { opacity, transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <Coins size={10} color={Colors.gold} strokeWidth={2} />
      <Text style={styles.pulseText}>+{points}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 88 : 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1509',
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.gold + '60',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    zIndex: 9999,
    shadowColor: Colors.gold,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  toastIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gold + '20',
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastTitle: {
    color: Colors.gold,
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  toastSub: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },

  tierToast: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 88 : 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0d0d0d',
    borderRadius: Radius.xl,
    borderWidth: 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    overflow: 'hidden',
    zIndex: 9999,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  tierGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: Radius.xl,
  },
  tierToastTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tierToastSub: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '400',
  },

  pulse: {
    position: 'absolute',
    top: -4,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.gold + '20',
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
    pointerEvents: 'none',
    zIndex: 100,
  },
  pulseText: {
    color: Colors.gold,
    fontSize: 9,
    fontWeight: '800',
  },
});
