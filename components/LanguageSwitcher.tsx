import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Globe, Check } from 'lucide-react-native';
import { useLanguage } from '@/context/LanguageContext';
import { LANGUAGES, Language } from '@/constants/i18n';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [visible, setVisible] = useState(false);

  const current = LANGUAGES.find((l) => l.code === language);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Globe size={12} color={Colors.neonBlue} strokeWidth={2} />
        <Text style={styles.triggerText}>{current?.code.toUpperCase()}</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t.selectLanguage}</Text>
            {LANGUAGES.map((lang) => {
              const active = lang.code === language;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langItem, active && styles.langItemActive]}
                  onPress={() => {
                    setLanguage(lang.code as Language);
                    setVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.langInfo}>
                    <Text style={[styles.langNative, active && styles.langNativeActive]}>
                      {lang.nativeLabel}
                    </Text>
                    <Text style={styles.langLabel}>{lang.label}</Text>
                  </View>
                  {active && <Check size={16} color={Colors.neonBlue} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  triggerText: {
    color: Colors.neonBlue,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: 40,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  langItemActive: {
    backgroundColor: Colors.neonBlueGlow,
  },
  langInfo: {
    gap: 2,
  },
  langNative: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  langNativeActive: {
    color: Colors.neonBlue,
    fontWeight: '700',
  },
  langLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
});
