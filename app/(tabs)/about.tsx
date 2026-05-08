import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Instagram,
  Facebook,
  MessageCircle,
  Mail,
  Phone,
  Package,
  RotateCcw,
  ChevronRight,
  Music2,
} from 'lucide-react-native';
import { useLanguage } from '@/context/LanguageContext';
import { useCMS } from '@/context/CMSContext';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionMap = Record<string, string>;
type AboutData = Record<string, SectionMap>;

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchAboutContent(language: string): Promise<AboutData> {
  const [langRes, enRes] = await Promise.all([
    supabase.from('about_content').select('section, key, value').eq('language', language),
    language !== 'en'
      ? supabase.from('about_content').select('section, key, value').eq('language', 'en')
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const build = (rows: any[]): AboutData => {
    const map: AboutData = {};
    for (const row of rows ?? []) {
      if (!map[row.section]) map[row.section] = {};
      if (row.value !== null && row.value !== undefined) map[row.section][row.key] = row.value;
    }
    return map;
  };

  const enData = build((enRes as any).data ?? []);
  const langData = build(langRes.data ?? []);

  // Merge: selected language wins, English fills gaps
  const merged: AboutData = {};
  const allSections = new Set([...Object.keys(enData), ...Object.keys(langData)]);
  allSections.forEach((section) => {
    merged[section] = { ...(enData[section] ?? {}), ...(langData[section] ?? {}) };
  });
  return merged;
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <View style={styles.sectionHeadingIcon}>{icon}</View>
      <Text style={styles.sectionHeadingText}>{title.toUpperCase()}</Text>
    </View>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.policyRow}>
      <Text style={styles.policyLabel}>{label}</Text>
      <Text style={styles.policyValue}>{value}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AboutScreen() {
  const { language, t } = useLanguage();
  const { branding } = useCMS();

  const [data, setData] = useState<AboutData>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAboutContent(language);
    setData(result);
    setLoading(false);
  }, [language]);

  useEffect(() => { load(); }, [load]);

  const brand = data.brand ?? {};
  const social = data.social ?? {};
  const contact = data.contact ?? {};
  const shipping = data.shipping ?? {};
  const ret = data.return ?? {};
  const footer = data.footer ?? {};

  const brandName = brand.name || branding.app_name || 'LAZURDE MAKEUP';
  const brandTagline = brand.tagline || t.aboutTagline;
  const brandDesc = brand.description || '';
  const brandMission = brand.mission || '';

  const whatsappNumber = contact.whatsapp || '';
  const contactEmail = contact.email || '';
  const contactPhone = contact.phone || '';

  const instagramUrl = social.instagram_url || 'https://www.instagram.com';
  const instagramHandle = social.instagram_handle || '@brand';
  const tiktokUrl = social.tiktok_url || 'https://www.tiktok.com';
  const tiktokHandle = social.tiktok_handle || '@brand';
  const facebookUrl = social.facebook_url || 'https://www.facebook.com';
  const facebookHandle = social.facebook_handle || 'Brand';

  const copyright = footer.copyright || `© ${new Date().getFullYear()} ${brandName}`;

  function openUrl(url: string) {
    if (!url) return;
    const full = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(full).catch(() => {});
  }

  function openWhatsApp() {
    if (!whatsappNumber) return;
    const digits = whatsappNumber.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${digits}`).catch(() => {});
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#0A0507', '#100810', '#0A0507']}
        style={StyleSheet.absoluteFill}
      />
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Hero header ───────────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.heroBlobTop} />
          <View style={styles.logoRing}>
            {branding.logo_url ? (
              <Image source={{ uri: branding.logo_url }} style={styles.logo} resizeMode="contain" />
            ) : (
              <Text style={styles.logoFallbackText}>{branding.app_name || 'Lazurde Makeup'}</Text>
            )}
          </View>
          <Text style={styles.heroTitle}>{t.aboutUs.toUpperCase()}</Text>
          <Text style={styles.heroTagline}>{brandTagline}</Text>
          <View style={styles.heroAccentLine} />
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── Brand info ────────────────────────────────────────────── */}
            {(brandDesc || brandMission) ? (
              <SectionCard>
                <Text style={styles.brandName}>{brandName}</Text>
                {brandDesc ? <Text style={styles.brandDesc}>{brandDesc}</Text> : null}
                {brandMission ? (
                  <View style={styles.missionBox}>
                    <Text style={styles.missionLabel}>{t.missionLabel.toUpperCase()}</Text>
                    <Text style={styles.missionText}>{brandMission}</Text>
                  </View>
                ) : null}
              </SectionCard>
            ) : null}

            {/* ── Social links ──────────────────────────────────────────── */}
            <SectionCard>
              <SectionHeading
                icon={<Instagram size={16} color={Colors.neonBlue} strokeWidth={2} />}
                title={t.followUs}
              />
              <Text style={styles.cardSubtitle}>{t.followSub}</Text>

              <SocialButton
                label="Instagram"
                handle={instagramHandle}
                icon={<Instagram size={20} color="#fff" strokeWidth={2} />}
                gradStart="#833AB4"
                gradEnd="#E1306C"
                onPress={() => openUrl(instagramUrl)}
              />
              <SocialButton
                label="TikTok"
                handle={tiktokHandle}
                icon={<Music2 size={20} color="#fff" strokeWidth={2} />}
                gradStart="#010101"
                gradEnd="#69C9D0"
                onPress={() => openUrl(tiktokUrl)}
              />
              <SocialButton
                label="Facebook"
                handle={facebookHandle}
                icon={<Facebook size={20} color="#fff" strokeWidth={2} />}
                gradStart="#1877F2"
                gradEnd="#0D5BBC"
                onPress={() => openUrl(facebookUrl)}
              />
            </SectionCard>

            {/* ── WhatsApp CTA ──────────────────────────────────────────── */}
            {whatsappNumber ? (
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={openWhatsApp}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#128C7E', '#25D366']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.whatsappGradient}
                >
                  <MessageCircle size={24} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.whatsappText}>{t.contactWhatsapp}</Text>
                  <ChevronRight size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            {/* ── Email / Phone ─────────────────────────────────────────── */}
            {(contactEmail || contactPhone) ? (
              <SectionCard>
                {contactEmail ? (
                  <ContactRow
                    icon={<Mail size={18} color={Colors.neonBlue} strokeWidth={2} />}
                    label={t.contactEmail}
                    value={contactEmail}
                    onPress={() => Linking.openURL(`mailto:${contactEmail}`).catch(() => {})}
                  />
                ) : null}
                {contactPhone ? (
                  <ContactRow
                    icon={<Phone size={18} color={Colors.neonBlue} strokeWidth={2} />}
                    label={t.contactPhone}
                    value={contactPhone}
                    onPress={() => Linking.openURL(`tel:${contactPhone}`).catch(() => {})}
                    noBorder
                  />
                ) : null}
              </SectionCard>
            ) : null}

            {/* ── Shipping policy ───────────────────────────────────────── */}
            {(shipping.delivery || shipping.areas || shipping.cost) ? (
              <SectionCard>
                <SectionHeading
                  icon={<Package size={16} color={Colors.neonBlue} strokeWidth={2} />}
                  title={shipping.title || t.shippingPolicy}
                />
                <PolicyRow label={t.deliveryTime} value={shipping.delivery} />
                <PolicyRow label={t.shippingAreas} value={shipping.areas} />
                <PolicyRow label={t.shippingCost} value={shipping.cost} />
              </SectionCard>
            ) : null}

            {/* ── Return policy ─────────────────────────────────────────── */}
            {(ret.days || ret.conditions || ret.refund) ? (
              <SectionCard>
                <SectionHeading
                  icon={<RotateCcw size={16} color={Colors.neonBlue} strokeWidth={2} />}
                  title={ret.title || t.returnPolicy}
                />
                <PolicyRow label={t.returnDays} value={ret.days} />
                <PolicyRow label={t.returnConditions} value={ret.conditions} />
                <PolicyRow label={t.returnRefund} value={ret.refund} />
              </SectionCard>
            ) : null}

            {/* ── Footer ────────────────────────────────────────────────── */}
            <View style={styles.footer}>
              {branding.logo_url ? (
                <Image source={{ uri: branding.logo_url }} style={styles.footerLogo} resizeMode="contain" />
              ) : (
                <Text style={styles.footerLogoText}>{branding.app_name || 'Lazurde Makeup'}</Text>
              )}
              <Text style={styles.footerCopyright}>{copyright}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Social button ────────────────────────────────────────────────────────────

function SocialButton({
  label, handle, icon, gradStart, gradEnd, onPress,
}: {
  label: string;
  handle: string;
  icon: React.ReactNode;
  gradStart: string;
  gradEnd: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.socialBtn}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <LinearGradient
        colors={[gradStart, gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.socialGradient}
      >
        <View style={styles.socialIconCircle}>{icon}</View>
        <View style={styles.socialTextWrap}>
          <Text style={styles.socialLabel}>{label}</Text>
          <Text style={styles.socialHandle}>{handle}</Text>
        </View>
        <ChevronRight size={18} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({
  icon, label, value, onPress, noBorder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress: () => void;
  noBorder?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.contactRow, !noBorder && styles.contactRowBorder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.contactIcon}>{icon}</View>
      <View style={styles.contactTextWrap}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
      <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} />
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0507',
  },
  scroll: {
    paddingBottom: 48,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBlobTop: {
    position: 'absolute',
    top: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,77,141,0.06)',
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 80,
  },
  logoRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(255,77,141,0.5)',
    backgroundColor: '#1A0E14',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
    marginBottom: 18,
    overflow: 'hidden',
  },
  logo: {
    width: 92,
    height: 92,
  },
  logoFallbackText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 5,
    textAlign: 'center',
  },
  heroTagline: {
    color: Colors.neonBlue,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 300,
    opacity: 0.85,
  },
  heroAccentLine: {
    width: 48,
    height: 2,
    backgroundColor: Colors.neonBlue,
    borderRadius: 1,
    marginTop: 16,
    shadowColor: Colors.neonBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: '#140A10',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.12)',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  cardSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 14,
    marginTop: 2,
  },

  // ── Section heading ────────────────────────────────────────────────────────
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeadingIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,77,141,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeadingText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // ── Brand ─────────────────────────────────────────────────────────────────
  brandName: {
    color: Colors.neonBlue,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 10,
    textShadowColor: 'rgba(255,77,141,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  brandDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14,
  },
  missionBox: {
    backgroundColor: 'rgba(255,77,141,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.15)',
    padding: 14,
    gap: 6,
  },
  missionLabel: {
    color: Colors.neonBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  missionText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Social ─────────────────────────────────────────────────────────────────
  socialBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  socialGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 13,
  },
  socialIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialTextWrap: {
    flex: 1,
  },
  socialLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  socialHandle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    marginTop: 1,
  },

  // ── WhatsApp CTA ──────────────────────────────────────────────────────────
  whatsappBtn: {
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  whatsappGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  whatsappText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ── Contact rows ──────────────────────────────────────────────────────────
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  contactRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,77,141,0.08)',
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,77,141,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactTextWrap: {
    flex: 1,
  },
  contactLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  contactValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Policy ────────────────────────────────────────────────────────────────
  policyRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,77,141,0.07)',
    gap: 3,
  },
  policyLabel: {
    color: Colors.neonBlue,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  policyValue: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 8,
    gap: 8,
  },
  footerLogo: {
    width: 48,
    height: 48,
    opacity: 0.4,
  },
  footerLogoText: {
    color: '#503A42',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    opacity: 0.4,
  },
  footerCopyright: {
    color: '#503A42',
    fontSize: 11,
    textAlign: 'center',
  },
});
