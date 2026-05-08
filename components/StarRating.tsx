import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { Colors, FontSize } from '@/constants/theme';

type Props = {
  rating: number;
  reviewCount?: number;
  size?: number;
  showCount?: boolean;
};

export default function StarRating({
  rating,
  reviewCount,
  size = 14,
  showCount = true,
}: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          color={star <= Math.round(rating) ? Colors.gold : Colors.textMuted}
          fill={star <= Math.round(rating) ? Colors.gold : 'transparent'}
          strokeWidth={1.5}
          style={{ marginRight: 1 }}
        />
      ))}
      <Text style={[styles.score, { fontSize: size - 1 }]}>
        {rating.toFixed(1)}
      </Text>
      {showCount && reviewCount !== undefined && (
        <Text style={[styles.count, { fontSize: size - 1 }]}>
          ({reviewCount})
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  score: {
    color: Colors.gold,
    fontWeight: '600',
    marginLeft: 4,
  },
  count: {
    color: Colors.textMuted,
    marginLeft: 2,
  },
});
