import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Monitor, MousePointerClick, Layers, Move, Maximize2 } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  featureName?: string;
};

export default function MobileUnsupported({ featureName }: Props) {
  const { t } = useLanguage();

  const features = [
    { icon: MousePointerClick, label: t.featureClickSelect },
    { icon: Move, label: t.featureDragResize },
    { icon: Layers, label: t.featureInspector },
    { icon: Maximize2, label: t.featureLivePreview },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Monitor size={36} color={Colors.neonBlue} strokeWidth={1.5} />
        </View>

        <Text style={styles.title}>{t.visualEditorWebOnly}</Text>

        {featureName && (
          <View style={styles.featurePill}>
            <Text style={styles.featurePillText}>{featureName}</Text>
          </View>
        )}

        <Text style={styles.body}>
          {t.visualEditorBody}
        </Text>

        <View style={styles.featureList}>
          {features.map(({ icon: Icon, label }) => (
            <View key={label} style={styles.featureRow}>
              <Icon size={14} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={styles.featureLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.hintRow}>
          <Monitor size={13} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.hintText}>
            {t.visualEditorHint}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 26,
  },
  featurePill: {
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  featurePillText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  featureList: {
    width: '100%',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    width: '100%',
  },
  hintText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
});
