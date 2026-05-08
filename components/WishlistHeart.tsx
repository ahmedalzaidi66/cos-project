import React, { useRef, useCallback, useEffect } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  View,
  GestureResponderEvent,
} from 'react-native';
import { Heart } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useWishlistToast } from '@/context/WishlistToastContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Product } from '@/lib/supabase';

type Props = {
  product: Product;
  size?: number;
  onLoginRequired?: () => void;
  onToggle?: (added: boolean) => void;
  variant?: 'card' | 'detail';
  wrapStyle?: object;
  innerStyle?: object;
};

// Particle angles for the burst (8 directions)
const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function useParticleBurst(count: number) {
  return Array.from({ length: count }, () => ({
    translate: useRef(new Animated.ValueXY({ x: 0, y: 0 })).current,
    opacity: useRef(new Animated.Value(0)).current,
    scale: useRef(new Animated.Value(0)).current,
  }));
}

export default function WishlistHeart({
  product,
  size = 18,
  onLoginRequired,
  onToggle,
  variant = 'card',
  wrapStyle,
  innerStyle,
}: Props) {
  const { isAuthenticated } = useAuth();
  const { isWishlisted, toggle } = useWishlist();
  const { showWishlistToast } = useWishlistToast();
  const { t } = useLanguage();
  const saved = isWishlisted(product.id);

  // Core scale for the heart icon
  const scale = useRef(new Animated.Value(1)).current;
  // Ripple ring that expands and fades on add
  const rippleScale = useRef(new Animated.Value(0.6)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  // Particles
  const particles = useParticleBurst(PARTICLE_ANGLES.length);

  const burstParticles = useCallback((radius: number) => {
    const animations = particles.map((p, i) => {
      const angleDeg = PARTICLE_ANGLES[i];
      const angleRad = (angleDeg * Math.PI) / 180;
      const tx = Math.cos(angleRad) * radius;
      const ty = Math.sin(angleRad) * radius;

      p.translate.setValue({ x: 0, y: 0 });
      p.opacity.setValue(1);
      p.scale.setValue(0.4);

      return Animated.parallel([
        Animated.timing(p.translate, {
          toValue: { x: tx, y: ty },
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(p.scale, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(p.scale, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(100),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });
    Animated.parallel(animations).start();
  }, [particles]);

  const playAddAnimation = useCallback(() => {
    // Reset ripple
    rippleScale.setValue(0.6);
    rippleOpacity.setValue(0.7);

    Animated.parallel([
      // Heart: quick pop then settle with bounce
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 0.75,
          useNativeDriver: true,
          speed: 80,
          bounciness: 0,
        }),
        Animated.spring(scale, {
          toValue: 1.5,
          useNativeDriver: true,
          speed: 40,
          bounciness: 0,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 14,
          bounciness: 18,
        }),
      ]),
      // Ripple ring expands and fades
      Animated.parallel([
        Animated.timing(rippleScale, {
          toValue: 2.2,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0,
          duration: 480,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    burstParticles(variant === 'detail' ? 22 : 16);
  }, [scale, rippleScale, rippleOpacity, burstParticles, variant]);

  const playRemoveAnimation = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.2,
        useNativeDriver: true,
        speed: 60,
        bounciness: 0,
      }),
      Animated.spring(scale, {
        toValue: 0.85,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 8,
      }),
    ]).start();
  }, [scale]);

  const handlePress = useCallback(async () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      showWishlistToast(false, t.signInToSave ?? 'Sign in to save favorites');
      return;
    }

    const { added } = await toggle(product);

    if (added) {
      playAddAnimation();
    } else {
      playRemoveAnimation();
    }

    const msg = added
      ? (t.addedToWishlist ?? 'Added to favorites')
      : (t.removedFromWishlist ?? 'Removed from favorites');
    showWishlistToast(added, msg);
    onToggle?.(added);
  }, [isAuthenticated, product, toggle, onLoginRequired, onToggle,
      playAddAnimation, playRemoveAnimation, showWishlistToast, t]);

  const handlePressWithStop = useCallback((e: GestureResponderEvent) => {
    // Stop DOM event bubbling on web so parent TouchableOpacity doesn't navigate
    if (Platform.OS === 'web') {
      const nativeEv = e.nativeEvent as any;
      if (nativeEv?.stopPropagation) nativeEv.stopPropagation();
      if (nativeEv?.preventDefault) nativeEv.preventDefault();
    }
    handlePress();
  }, [handlePress]);

  const iconColor = saved ? '#FF4D6D' : 'rgba(255,255,255,0.85)';
  const fillColor = saved ? '#FF4D6D' : 'transparent';
  const particleSize = Math.max(4, Math.round(size * 0.32));

  const heartNode = (
    <Heart size={size} color={iconColor} fill={fillColor} strokeWidth={2} />
  );

  if (variant === 'detail') {
    return (
      <TouchableOpacity
        style={styles.detailBtn}
        onPress={handlePress}
        activeOpacity={0.75}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {/* Ripple ring */}
        <Animated.View
          style={[
            styles.ripple,
            {
              width: size * 2.8,
              height: size * 2.8,
              borderRadius: size * 1.4,
              transform: [{ scale: rippleScale }],
              opacity: rippleOpacity,
            },
          ]}
          pointerEvents="none"
        />
        {/* Particles */}
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                width: particleSize,
                height: particleSize,
                borderRadius: particleSize / 2,
                transform: [
                  { translateX: p.translate.x },
                  { translateY: p.translate.y },
                  { scale: p.scale },
                ],
                opacity: p.opacity,
              },
            ]}
            pointerEvents="none"
          />
        ))}
        <Animated.View style={{ transform: [{ scale }] }}>
          {heartNode}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  // 'card' variant — wrapped in a View that captures the responder on native
  // so the parent TouchableOpacity card never handles this touch.
  const btnSize = 26;
  const halfBtn = btnSize / 2;

  return (
    <View
      style={[styles.cardBtnWrap, wrapStyle]}
      onStartShouldSetResponder={() => true}
      onTouchEnd={(e) => {
        if (Platform.OS !== 'web') e.stopPropagation();
      }}
    >
      <TouchableOpacity
        style={styles.cardBtn}
        onPress={handlePressWithStop}
        activeOpacity={0.75}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {/* Ripple ring — centered on the button */}
        <Animated.View
          style={[
            styles.ripple,
            {
              width: size * 2.8,
              height: size * 2.8,
              borderRadius: size * 1.4,
              marginLeft: -(size * 2.8) / 2 + halfBtn,
              marginTop: -(size * 2.8) / 2 + halfBtn,
              transform: [{ scale: rippleScale }],
              opacity: rippleOpacity,
            },
          ]}
          pointerEvents="none"
        />
        {/* Particles — centered on the button */}
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                width: particleSize,
                height: particleSize,
                borderRadius: particleSize / 2,
                marginLeft: -particleSize / 2 + halfBtn,
                marginTop: -particleSize / 2 + halfBtn,
                transform: [
                  { translateX: p.translate.x },
                  { translateY: p.translate.y },
                  { scale: p.scale },
                ],
                opacity: p.opacity,
              },
            ]}
            pointerEvents="none"
          />
        ))}
        <Animated.View style={[styles.cardInner, innerStyle, { transform: [{ scale }] }]}>
          {heartNode}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardBtnWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 26,
    height: 26,
    overflow: 'visible' as any,
  },
  cardBtn: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible' as any,
  },
  cardInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(8,4,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.18)',
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(8px)' }
      : {}),
  },
  detailBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,77,109,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  ripple: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#FF4D6D',
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#FF4D6D',
  },
});
