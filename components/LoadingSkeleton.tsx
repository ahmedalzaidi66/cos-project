import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.md * 2 - Spacing.sm) / 2;

export default function LoadingSkeleton() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  const cards = [1, 2, 3, 4];

  return (
    <View style={styles.grid}>
      {cards.map((k) => (
        <Animated.View key={k} style={[styles.card, { opacity }]}>
          <View style={styles.image} />
          <View style={styles.line} />
          <View style={[styles.line, { width: '60%' }]} />
          <View style={[styles.line, { width: '40%', backgroundColor: Colors.neonBlueDim }]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    padding: Spacing.sm,
  },
  image: {
    width: '100%',
    height: CARD_WIDTH * 0.85,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  line: {
    height: 12,
    backgroundColor: Colors.navyLight,
    borderRadius: Radius.sm,
    marginBottom: 6,
    width: '80%',
  },
});
