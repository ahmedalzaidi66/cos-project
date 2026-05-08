import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';
import { useUISize } from '@/context/UISizeContext';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder,
}: Props) {
  const { searchSizes } = useUISize();
  const { t } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t.searchGear;

  return (
    <View style={[styles.container, {
      height: searchSizes.barHeight,
      borderRadius: searchSizes.borderRadius,
      marginTop: searchSizes.marginTop,
      marginBottom: searchSizes.marginBottom,
    }]}>
      <Search size={searchSizes.iconSize} color={Colors.textMuted} strokeWidth={2} />
      <TextInput
        style={[styles.input, { fontSize: searchSizes.fontSize }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={resolvedPlaceholder}
        placeholderTextColor={Colors.textMuted}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} activeOpacity={0.7}>
          <X size={searchSizes.iconSize - 2} color={Colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    padding: 0,
    margin: 0,
  },
});
