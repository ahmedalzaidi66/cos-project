import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { CircleCheck as CheckCircle, CircleAlert as AlertCircle, Info } from 'lucide-react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

export type ToastType = 'success' | 'error' | 'info';

type Props = {
  visible: boolean;
  message: string;
  type?: ToastType;
};

export default function Toast({ visible, message, type = 'success' }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const color = type === 'success' ? Colors.success : type === 'error' ? Colors.error : Colors.neonBlue;
  const bgColor = type === 'success' ? Colors.success + '18' : type === 'error' ? Colors.error + '18' : Colors.neonBlueGlow;
  const borderColor = type === 'success' ? Colors.success + '44' : type === 'error' ? Colors.error + '44' : Colors.neonBlueBorder;

  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity, transform: [{ translateY }], backgroundColor: bgColor, borderColor },
      ]}
      pointerEvents="none"
    >
      <Icon size={16} color={color} strokeWidth={2} />
      <Text style={[styles.message, { color }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    zIndex: 999,
    maxWidth: 360,
  },
  message: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
});
