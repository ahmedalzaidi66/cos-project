import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Colors, Radius, FontSize } from '@/constants/theme';

type Props = {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
};

export default function QuantitySelector({
  value,
  onDecrement,
  onIncrement,
  min = 1,
  max = 99,
}: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onDecrement}
        disabled={value <= min}
        style={[styles.btn, value <= min && styles.btnDisabled]}
        activeOpacity={0.8}
      >
        <Minus size={16} color={value <= min ? Colors.textMuted : Colors.neonBlue} strokeWidth={2.5} />
      </TouchableOpacity>
      <Text style={styles.value}>{value}</Text>
      <TouchableOpacity
        onPress={onIncrement}
        disabled={value >= max}
        style={[styles.btn, value >= max && styles.btnDisabled]}
        activeOpacity={0.8}
      >
        <Plus size={16} color={value >= max ? Colors.textMuted : Colors.neonBlue} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  btn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
});
