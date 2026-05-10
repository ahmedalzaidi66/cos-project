import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Sun, Moon, Monitor } from 'lucide-react-native';
import { useTheme, UserThemePreference } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';

type Option = {
  value: UserThemePreference;
  labelKey: 'themeLight' | 'themeDark' | 'themeSystem';
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
};

const OPTIONS: Option[] = [
  { value: 'light',  labelKey: 'themeLight',  Icon: Sun },
  { value: 'system', labelKey: 'themeSystem', Icon: Monitor },
  { value: 'dark',   labelKey: 'themeDark',   Icon: Moon },
];

const PINK = '#FF4D8D';

export default function ThemeSelector() {
  const { userPref, setUserPref, C } = useTheme();
  const { t } = useLanguage();

  return (
    <View style={[styles.container, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
      {OPTIONS.map((opt) => {
        const active = userPref === opt.value;
        const label = (t as any)[opt.labelKey] ?? opt.value;
        return (
          <ThemeCard
            key={opt.value}
            option={opt}
            label={label}
            active={active}
            onPress={() => setUserPref(opt.value)}
            C={C}
          />
        );
      })}
    </View>
  );
}

function ThemeCard({
  option,
  label,
  active,
  onPress,
  C,
}: {
  option: Option;
  label: string;
  active: boolean;
  onPress: () => void;
  C: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 20, bounciness: 14 }),
    ]).start();
    onPress();
  };

  const { Icon } = option;

  return (
    <TouchableOpacity
      style={styles.cardTouch}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: active ? 'rgba(255,77,141,0.1)' : C.backgroundCard,
            borderColor: active ? PINK : C.borderLight,
            borderWidth: active ? 1.5 : 1,
          },
          { transform: [{ scale }] },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: active ? 'rgba(255,77,141,0.15)' : C.backgroundSecondary,
            },
          ]}
        >
          <Icon
            size={18}
            color={active ? PINK : C.textMuted}
            strokeWidth={active ? 2.5 : 1.8}
          />
        </View>
        <Text
          style={[
            styles.cardLabel,
            { color: active ? PINK : C.textMuted, fontWeight: active ? '700' : '500' },
          ]}
        >
          {label}
        </Text>
        {active && <View style={styles.activeDot} />}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    gap: 6,
  },
  cardTouch: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PINK,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
});
