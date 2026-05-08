import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, FontSize, Shadow } from '@/constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
};

export default function GlossyButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  fullWidth = false,
}: Props) {
  const heights = { xs: 36, sm: 40, md: 50, lg: 58 };
  const fontSizes = { xs: FontSize.xs, sm: FontSize.sm, md: FontSize.md, lg: FontSize.lg };

  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[
          styles.wrapper,
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        <LinearGradient
          colors={
            isDisabled
              ? ['#2A1520', '#1A0E14']
              : ['#FF4D8D', '#CC3066']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            { height: heights[size] },
            !isDisabled && (size === 'xs' ? Shadow.neonBlueSubtle : Shadow.neonBlue),
          ]}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text
              style={[
                styles.text,
                { fontSize: fontSizes[size] },
                textStyle,
              ]}
            >
              {title}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[
          styles.outlineWrapper,
          { height: heights[size] },
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.neonBlue} size="small" />
        ) : (
          <Text
            style={[
              styles.outlineText,
              { fontSize: fontSizes[size] },
              textStyle,
            ]}
          >
            {title}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        { height: heights[size], justifyContent: 'center', alignItems: 'center' },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.neonBlue} size="small" />
      ) : (
        <Text
          style={[
            styles.ghostText,
            { fontSize: fontSizes[size] },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderRadius: Radius.full,
  },
  text: {
    color: Colors.white,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  outlineWrapper: {
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.neonBlue,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: Colors.neonBlueGlow,
  },
  outlineText: {
    color: Colors.neonBlue,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ghostText: {
    color: Colors.neonBlue,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
