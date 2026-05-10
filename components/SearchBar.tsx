import React, { useRef } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useUISize } from '@/context/UISizeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useAppColors } from '@/context/ThemeContext';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onSubmit?: () => void;
  /** Make the whole bar a tap target that fires onFocus without opening the keyboard */
  tapOnly?: boolean;
  autoFocus?: boolean;
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  onFocus,
  onSubmit,
  tapOnly = false,
  autoFocus = false,
}: Props) {
  const { searchSizes } = useUISize();
  const { t } = useLanguage();
  const C = useAppColors();
  const inputRef = useRef<RNTextInput>(null);
  const resolvedPlaceholder = placeholder ?? t.searchGear;

  if (tapOnly) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onFocus}
        style={[
          styles.container,
          {
            height: searchSizes.barHeight,
            borderRadius: searchSizes.borderRadius,
            marginTop: searchSizes.marginTop,
            marginBottom: searchSizes.marginBottom,
            backgroundColor: C.backgroundInput,
            borderColor: C.border,
          },
        ]}
      >
        <Search size={searchSizes.iconSize} color={C.textMuted} strokeWidth={2} />
        <View style={styles.tapPlaceholder}>
          <TextInput
            style={[styles.input, { fontSize: searchSizes.fontSize, color: C.textMuted }]}
            value=""
            placeholder={resolvedPlaceholder}
            placeholderTextColor={C.textMuted}
            editable={false}
            pointerEvents="none"
          />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          height: searchSizes.barHeight,
          borderRadius: searchSizes.borderRadius,
          marginTop: searchSizes.marginTop,
          marginBottom: searchSizes.marginBottom,
          backgroundColor: C.backgroundInput,
          borderColor: C.border,
        },
      ]}
    >
      <Search size={searchSizes.iconSize} color={C.textMuted} strokeWidth={2} />
      <TextInput
        ref={inputRef}
        style={[styles.input, { fontSize: searchSizes.fontSize, color: C.textPrimary }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={resolvedPlaceholder}
        placeholderTextColor={C.textMuted}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onSubmitEditing={onSubmit}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <X size={searchSizes.iconSize - 2} color={C.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    padding: 0,
    margin: 0,
  },
  tapPlaceholder: {
    flex: 1,
  },
});
