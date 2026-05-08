import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';
import { Category, getCategoryName } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useUISize } from '@/context/UISizeContext';

type Props = {
  selected: string;
  onSelect: (id: string) => void;
  categories?: Category[];
};

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'skincare', label: 'Skincare' },
  { id: 'haircare', label: 'Haircare' },
  { id: 'fragrances', label: 'Fragrances' },
  { id: 'tools', label: 'Tools' },
];

export default function CategoryFilter({ selected, onSelect, categories }: Props) {
  const { language } = useLanguage();
  const { filterSizes } = useUISize();

  const items = categories && categories.length > 0
    ? [{ id: 'all', label: 'All' }, ...categories.map(c => ({
        id: c.slug,
        label: getCategoryName(c, language),
      }))]
    : CATEGORIES;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled={true}
      contentContainerStyle={styles.container}
    >
      {items.map((cat) => {
        const active = cat.id === selected;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.8}
            style={[styles.chip, active && styles.chipActive, {
              height: filterSizes.buttonHeight,
              paddingHorizontal: filterSizes.paddingH,
              paddingVertical: filterSizes.paddingV,
              borderRadius: filterSizes.borderRadius,
            }]}
          >
            <Text style={[styles.label, active && styles.labelActive, { fontSize: filterSizes.fontSize }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlue,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  labelActive: {
    color: Colors.neonBlue,
  },
});
