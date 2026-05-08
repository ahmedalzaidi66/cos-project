import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { Colors, FontSize, Radius } from '@/constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };
const TIMING_CONFIG = { duration: 250 };
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_THRESHOLD = SCREEN_W * 0.25;
const SWIPE_VELOCITY = 500;
const DISMISS_THRESHOLD = SCREEN_H * 0.15;

type Props = {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
};

export default function ImageViewerModal({
  visible,
  images,
  initialIndex,
  onClose,
  onIndexChange,
}: Props) {
  const currentIndex = useSharedValue(initialIndex);
  const [displayIndex, setDisplayIndex] = React.useState(initialIndex);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const swipeTranslateX = useSharedValue(0);
  const dismissTranslateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  const isZoomed = useSharedValue(false);

  useEffect(() => {
    if (visible) {
      currentIndex.value = initialIndex;
      setDisplayIndex(initialIndex);
      resetZoom();
      swipeTranslateX.value = 0;
      dismissTranslateY.value = 0;
      backdropOpacity.value = 1;
    }
  }, [visible, initialIndex]);

  const resetZoom = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, SPRING_CONFIG);
    savedScale.value = 1;
    translateX.value = withSpring(0, SPRING_CONFIG);
    translateY.value = withSpring(0, SPRING_CONFIG);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    isZoomed.value = false;
  }, []);

  const goToImage = useCallback((index: number) => {
    setDisplayIndex(index);
    onIndexChange?.(index);
  }, [onIndexChange]);

  const navigateImage = useCallback((direction: -1 | 1) => {
    'worklet';
    const newIdx = currentIndex.value + direction;
    if (newIdx < 0 || newIdx >= images.length) {
      swipeTranslateX.value = withSpring(0, SPRING_CONFIG);
      return;
    }
    currentIndex.value = newIdx;
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    isZoomed.value = false;
    swipeTranslateX.value = withSpring(0, SPRING_CONFIG);
    runOnJS(goToImage)(newIdx);
  }, [images.length, goToImage]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(newScale, 0.5), MAX_SCALE + 0.5);
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, SPRING_CONFIG);
        savedScale.value = MIN_SCALE;
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        isZoomed.value = false;
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE, SPRING_CONFIG);
        savedScale.value = MAX_SCALE;
        isZoomed.value = true;
      } else {
        savedScale.value = scale.value;
        isZoomed.value = scale.value > 1.1;
      }
    });

  // Double tap gesture
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (isZoomed.value) {
        scale.value = withSpring(1, SPRING_CONFIG);
        savedScale.value = 1;
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        isZoomed.value = false;
      } else {
        const focusX = e.x - SCREEN_W / 2;
        const focusY = e.y - SCREEN_H / 2;
        scale.value = withSpring(DOUBLE_TAP_SCALE, SPRING_CONFIG);
        savedScale.value = DOUBLE_TAP_SCALE;
        translateX.value = withSpring(-focusX * (DOUBLE_TAP_SCALE - 1), SPRING_CONFIG);
        translateY.value = withSpring(-focusY * (DOUBLE_TAP_SCALE - 1), SPRING_CONFIG);
        savedTranslateX.value = -focusX * (DOUBLE_TAP_SCALE - 1);
        savedTranslateY.value = -focusY * (DOUBLE_TAP_SCALE - 1);
        isZoomed.value = true;
      }
    });

  // Pan gesture (handles both zoom-pan, swipe to navigate, and drag-to-dismiss)
  const panGesture = Gesture.Pan()
    .minDistance(5)
    .onUpdate((e) => {
      if (isZoomed.value) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        const absX = Math.abs(e.translationX);
        const absY = Math.abs(e.translationY);
        if (absY > absX && absY > 10) {
          dismissTranslateY.value = e.translationY;
          backdropOpacity.value = interpolate(
            Math.abs(e.translationY),
            [0, SCREEN_H * 0.3],
            [1, 0.3],
            Extrapolation.CLAMP,
          );
        } else {
          swipeTranslateX.value = e.translationX;
        }
      }
    })
    .onEnd((e) => {
      if (isZoomed.value) {
        const maxPanX = (scale.value - 1) * SCREEN_W / 2;
        const maxPanY = (scale.value - 1) * SCREEN_H / 2;
        const clampedX = Math.min(Math.max(translateX.value, -maxPanX), maxPanX);
        const clampedY = Math.min(Math.max(translateY.value, -maxPanY), maxPanY);
        translateX.value = withSpring(clampedX, SPRING_CONFIG);
        translateY.value = withSpring(clampedY, SPRING_CONFIG);
        savedTranslateX.value = clampedX;
        savedTranslateY.value = clampedY;
        return;
      }

      // Drag-to-dismiss (vertical)
      if (Math.abs(dismissTranslateY.value) > DISMISS_THRESHOLD) {
        dismissTranslateY.value = withTiming(
          dismissTranslateY.value > 0 ? SCREEN_H : -SCREEN_H,
          TIMING_CONFIG,
        );
        backdropOpacity.value = withTiming(0, TIMING_CONFIG);
        runOnJS(handleClose)();
        return;
      }
      dismissTranslateY.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withSpring(1, SPRING_CONFIG);

      // Swipe to navigate (horizontal)
      const velocityTriggered = Math.abs(e.velocityX) > SWIPE_VELOCITY;
      const distanceTriggered = Math.abs(swipeTranslateX.value) > SWIPE_THRESHOLD;
      if (velocityTriggered || distanceTriggered) {
        const direction = (e.velocityX < 0 || swipeTranslateX.value < 0) ? 1 : -1;
        navigateImage(direction);
      } else {
        swipeTranslateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Exclusive(doubleTapGesture, panGesture),
  );

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + swipeTranslateX.value },
      { translateY: translateY.value + dismissTranslateY.value },
      { scale: scale.value },
    ],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />

        {/* Close button */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={20} color={Colors.white} strokeWidth={2.5} />
          </TouchableOpacity>
          {images.length > 1 && (
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>
                {displayIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>

        {/* Image */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.imageWrap, imageAnimatedStyle]}>
            <Image
              source={{ uri: images[displayIndex] }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>

        {/* Bottom dots */}
        {images.length > 1 && (
          <View style={styles.dotsRow}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === displayIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 2, 4, 0.96)',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indexBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  indexText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },
  imageWrap: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.75,
  },
  dotsRow: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.neonBlue,
  },
});
