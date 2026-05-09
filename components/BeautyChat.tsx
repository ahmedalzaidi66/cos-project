import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import {
  X,
  Send,
  ImagePlus,
  Bot,
  User,
  ShoppingBag,
  Star,
  Sparkles,
  MessageCircle,
  Droplets,
  Palette,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react-native';
import { Colors, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';
import { useCart } from '@/context/CartContext';
import { supabase, Product, fetchProductById, fetchProductGallery, fetchProductShades, ProductShade, getProductName, getProductDescription } from '@/lib/supabase';
import { extractSkinTone, SkinToneRGB } from '@/lib/colorExtract';
import ImageViewerModal from '@/components/ImageViewerModal';

// ── Types ───────────────────────────────────────────────────────────────────

type ChatProduct = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  rating: number;
  review_count?: number;
  badge?: string | null;
  reason?: string;
};

type Dialect = 'iraqi' | 'gulf' | 'msa' | 'english';
type RecType = 'skincare' | 'makeup' | 'both';

type SkinConcern = {
  key: string;
  label: string;
  severity: 'mild' | 'moderate' | 'high';
};

type SkinAnalysisData = {
  tone: string;
  undertone: string;
  recommendations: string[];
  concerns?: SkinConcern[];
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products?: ChatProduct[];
  crossSell?: ChatProduct[];
  skinAnalysis?: SkinAnalysisData | null;
  suggestUpload?: boolean;
  showRecTypePicker?: boolean;
  imageUri?: string;
  dialect?: Dialect;
  timestamp: number;
};

const CHAT_STORAGE_KEY = 'lazurde_beauty_chat_history';
const API_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/beauty-chat`;

function loadHistory(): ChatMessage[] {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveHistory(msgs: ChatMessage[]) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const trimmed = msgs.slice(-50);
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

// ── i18n labels ─────────────────────────────────────────────────────────────

const REC_TYPE_LABELS: Record<string, Record<RecType, string>> = {
  en: { skincare: 'Skincare', makeup: 'Makeup', both: 'Both' },
  ar: { skincare: 'عناية بالبشرة', makeup: 'مكياج', both: 'كلاهما' },
  es: { skincare: 'Cuidado de piel', makeup: 'Maquillaje', both: 'Ambos' },
  de: { skincare: 'Hautpflege', makeup: 'Makeup', both: 'Beides' },
  ru: { skincare: 'Уход', makeup: 'Макияж', both: 'Оба' },
};

const UPLOAD_LABEL: Record<string, string> = {
  en: 'Upload a face photo for skin analysis',
  ar: 'ارسلي صورة وجهك لتحليل البشرة',
  es: 'Sube una foto facial para analizar tu piel',
  de: 'Lade ein Gesichtsfoto zur Hautanalyse hoch',
  ru: 'Загрузите фото лица для анализа кожи',
};

const CONCERN_LABELS: Record<string, Record<string, string>> = {
  en: { dryness: 'Dryness', oiliness: 'Oiliness', redness: 'Redness', acne: 'Acne', dark_circles: 'Dark circles', uneven_tone: 'Uneven tone' },
  ar: { dryness: 'جفاف', oiliness: 'دهنية', redness: 'احمرار', acne: 'حب شباب', dark_circles: 'هالات سوداء', uneven_tone: 'تفاوت اللون' },
  es: { dryness: 'Sequedad', oiliness: 'Oleosidad', redness: 'Enrojecimiento', acne: 'Acné', dark_circles: 'Ojeras', uneven_tone: 'Tono desigual' },
  de: { dryness: 'Trockenheit', oiliness: 'Fettigkeit', redness: 'Rötung', acne: 'Akne', dark_circles: 'Augenringe', uneven_tone: 'Ungleichmäßig' },
  ru: { dryness: 'Сухость', oiliness: 'Жирность', redness: 'Покраснение', acne: 'Акне', dark_circles: 'Тёмные круги', uneven_tone: 'Неровный тон' },
};

const SEVERITY_COLORS: Record<string, string> = {
  mild: Colors.success,
  moderate: Colors.warning,
  high: Colors.error,
};

// ── Main Component ──────────────────────────────────────────────────────────

export default function BeautyChat({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { addToCart } = useCart();
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const dialectRef = useRef<Dialect | null>(null);
  const pendingSkinColorsRef = useRef<SkinToneRGB | null>(null);
  const pendingImageRef = useRef<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<ChatProduct | null>(null);

  useEffect(() => {
    if (visible && !initializedRef.current) {
      const history = loadHistory();
      if (history.length > 0) {
        setMessages(history);
      } else {
        const welcomeTexts: Record<string, string> = {
          en: "Welcome to Lazurde Beauty! I'm your AI beauty assistant. Ask me about products, shades, routines, or upload a face photo for personalized skin analysis and recommendations.",
          ar: 'مرحباً بك في لازوردي! أنا مساعدتك الذكية للجمال. اسألي عن المنتجات، الألوان، الروتين، أو ارسلي صورة وجهك لتحليل البشرة.',
          es: 'Bienvenida a Lazurde Beauty! Soy tu asistente de belleza con IA. Pregunta sobre productos, tonos, rutinas, o sube una foto para analizar tu piel.',
          de: 'Willkommen bei Lazurde Beauty! Ich bin deine KI-Beauty-Assistentin. Frag nach Produkten, Farbtönen, Routinen oder lade ein Foto zur Hautanalyse hoch.',
          ru: 'Добро пожаловать в Lazurde Beauty! Я ваш ИИ-ассистент по красоте. Спросите о продуктах, оттенках, рутине или загрузите фото для анализа кожи.',
        };
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          text: welcomeTexts[language] ?? welcomeTexts.en,
          timestamp: Date.now(),
        }]);
      }
      initializedRef.current = true;
    }
  }, [visible, language]);

  useEffect(() => {
    if (messages.length > 0 && initializedRef.current) {
      saveHistory(messages);
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(async (text: string, skinColors?: SkinToneRGB, imageUri?: string, recType?: RecType) => {
    if (!text.trim() && !skinColors) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(36) + '-u',
      role: 'user',
      text: text.trim() || (UPLOAD_LABEL[language] ?? UPLOAD_LABEL.en),
      imageUri,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          skinColors,
          dialect: dialectRef.current,
          recType: recType ?? 'both',
          language,
        }),
      });

      const data = await res.json();
      if (data.dialect) dialectRef.current = data.dialect;

      const assistantMsg: ChatMessage = {
        id: Date.now().toString(36) + '-a',
        role: 'assistant',
        text: data.reply || "I'm sorry, I couldn't process that. Please try again.",
        products: data.products,
        crossSell: data.crossSell,
        skinAnalysis: data.skinAnalysis,
        suggestUpload: data.suggestUpload,
        showRecTypePicker: data.showRecTypePicker,
        dialect: data.dialect,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(36) + '-e',
        role: 'assistant',
        text: "I'm having trouble connecting right now. Please check your internet connection and try again.",
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [scrollToBottom, language]);

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return;
    sendMessage(input);
  }, [input, loading, sendMessage]);

  const handleRecTypeSelect = useCallback((recType: RecType) => {
    const colors = pendingSkinColorsRef.current;
    const img = pendingImageRef.current;
    if (colors) {
      pendingSkinColorsRef.current = null;
      pendingImageRef.current = null;
      sendMessage('', colors, img ?? undefined, recType);
    } else {
      const recTypeMessages: Record<string, Record<RecType, string>> = {
        en: { skincare: 'Show me skincare recommendations', makeup: 'Show me makeup recommendations', both: 'Show me both skincare and makeup' },
        ar: { skincare: 'اريد توصيات للعناية بالبشرة', makeup: 'اريد توصيات مكياج', both: 'اريد توصيات عناية ومكياج' },
        es: { skincare: 'Muéstrame productos de cuidado', makeup: 'Muéstrame maquillaje', both: 'Muéstrame ambos' },
        de: { skincare: 'Zeig mir Hautpflege', makeup: 'Zeig mir Makeup', both: 'Zeig mir beides' },
        ru: { skincare: 'Покажи уход за кожей', makeup: 'Покажи макияж', both: 'Покажи оба' },
      };
      const msgs = recTypeMessages[language] ?? recTypeMessages.en;
      sendMessage(msgs[recType], undefined, undefined, recType);
    }
  }, [sendMessage, language]);

  const handleImageUpload = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp';

    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        setLoading(true);
        const skinTone = await extractSkinTone(dataUrl);

        if (skinTone) {
          pendingSkinColorsRef.current = skinTone;
          pendingImageRef.current = dataUrl;

          const pickLabel: Record<string, string> = {
            en: 'Great photo! What kind of recommendations would you like?',
            ar: 'صورة رائعة! شنو نوع التوصيات اللي تبينها؟',
            es: 'Buena foto! Que tipo de recomendaciones quieres?',
            de: 'Tolles Foto! Welche Art von Empfehlungen mochtest du?',
            ru: 'Отличное фото! Какие рекомендации вы хотите?',
          };

          setMessages(prev => [...prev, {
            id: Date.now().toString(36) + '-u',
            role: 'user',
            text: UPLOAD_LABEL[language] ?? UPLOAD_LABEL.en,
            imageUri: dataUrl,
            timestamp: Date.now(),
          }, {
            id: Date.now().toString(36) + '-pick',
            role: 'assistant',
            text: pickLabel[language] ?? pickLabel.en,
            showRecTypePicker: true,
            timestamp: Date.now(),
          }]);
          setLoading(false);
          scrollToBottom();
        } else {
          const failText: Record<string, string> = {
            en: "I couldn't detect skin tones clearly in that photo. For best results, please upload a well-lit selfie with your face clearly visible, without heavy makeup or filters.",
            ar: 'ما كدرت أحدد لون البشرة من هاي الصورة. حاولي ترسلين صورة واضحة بإضاءة طبيعية بدون فلاتر او مكياج ثقيل.',
            es: 'No pude detectar el tono de piel en esa foto. Sube una selfie bien iluminada sin filtros ni maquillaje pesado.',
            de: 'Ich konnte den Hautton nicht erkennen. Bitte lade ein gut beleuchtetes Foto ohne Filter oder starkes Makeup hoch.',
            ru: 'Не удалось определить тон кожи. Загрузите хорошо освещенное фото без фильтров и тяжелого макияжа.',
          };
          setMessages(prev => [...prev, {
            id: Date.now().toString(36) + '-u',
            role: 'user',
            text: UPLOAD_LABEL[language] ?? UPLOAD_LABEL.en,
            imageUri: dataUrl,
            timestamp: Date.now(),
          }, {
            id: Date.now().toString(36) + '-a',
            role: 'assistant',
            text: failText[language] ?? failText.en,
            dialect: dialectRef.current ?? undefined,
            timestamp: Date.now(),
          }]);
          setLoading(false);
          scrollToBottom();
        }
      };
      reader.readAsDataURL(file);
    };

    fileInput.click();
  }, [scrollToBottom, language]);

  const handleAddToCart = useCallback(async (product: ChatProduct) => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', product.id)
      .maybeSingle();

    if (data) {
      addToCart(data as Product);
      setAddedIds(prev => new Set(prev).add(product.id));
    }
  }, [addToCart]);

  const isWide = width >= 600;

  const quickPrompts: Record<string, string[]> = {
    en: ['Analyze my skin', 'Recommend a lipstick', 'Skincare routine', 'Shade matching help'],
    ar: ['حللي بشرتي', 'رشحيلي روج', 'روتين عناية', 'وش يناسب بشرتي؟'],
    es: ['Analiza mi piel', 'Recomienda un labial', 'Rutina de cuidado', 'Ayuda con tonos'],
    de: ['Analysiere meine Haut', 'Empfehle einen Lippenstift', 'Hautpflege-Routine', 'Farbtonhilfe'],
    ru: ['Анализ кожи', 'Порекомендуй помаду', 'Рутина ухода', 'Подбор оттенка'],
  };
  const prompts = quickPrompts[language] ?? quickPrompts.en;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIcon}>
              <Sparkles size={18} color={Colors.neonBlue} strokeWidth={2} />
            </View>
            <View>
              <Text style={s.headerTitle}>Beauty Assistant</Text>
              <Text style={s.headerSub}>AI-powered advice</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
            <X size={20} color={Colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            style={s.messagesWrap}
            contentContainerStyle={[s.messagesContent, isWide && { maxWidth: 680, alignSelf: 'center' as const, width: '100%' }]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                lang={language}
                onAddToCart={handleAddToCart}
                addedIds={addedIds}
                onUpload={handleImageUpload}
                onRecType={handleRecTypeSelect}
                onProductPress={setQuickViewProduct}
              />
            ))}

            {loading && (
              <View style={s.typingRow}>
                <View style={s.avatarBot}>
                  <Bot size={14} color={Colors.neonBlue} strokeWidth={2} />
                </View>
                <View style={s.typingBubble}>
                  <ActivityIndicator size="small" color={Colors.neonBlue} />
                  <Text style={s.typingText}>Thinking...</Text>
                </View>
              </View>
            )}

            {messages.length <= 1 && !loading && (
              <View style={s.quickPromptsWrap}>
                <Text style={s.quickTitle}>
                  {{ en: 'Try asking:', ar: 'جربي:', es: 'Pregunta:', de: 'Probiere:', ru: 'Попробуйте:' }[language] ?? 'Try asking:'}
                </Text>
                <View style={s.quickRow}>
                  {prompts.map((q) => (
                    <TouchableOpacity key={q} style={s.quickChip} activeOpacity={0.7} onPress={() => sendMessage(q)}>
                      <Text style={s.quickChipText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={s.inputBar}>
            <TouchableOpacity onPress={handleImageUpload} style={s.imageBtn} activeOpacity={0.7} disabled={loading}>
              <ImagePlus size={20} color={loading ? Colors.textMuted : Colors.neonBlue} strokeWidth={2} />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder={{ en: 'Ask me about beauty...', ar: 'اسأليني عن الجمال...', es: 'Pregunta sobre belleza...', de: 'Frag mich...', ru: 'Спросите о красоте...' }[language] ?? 'Ask me about beauty...'}
              placeholderTextColor={Colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!loading}
              multiline={false}
            />
            <TouchableOpacity
              onPress={handleSend}
              style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
              activeOpacity={0.7}
              disabled={!input.trim() || loading}
            >
              <Send size={18} color={!input.trim() || loading ? Colors.textMuted : '#FFFFFF'} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

      {quickViewProduct && (
        <ProductQuickViewModal
          product={quickViewProduct}
          lang={language}
          addedIds={addedIds}
          onAddToCart={async (p) => { await handleAddToCart(p); }}
          onClose={() => setQuickViewProduct(null)}
          onViewFull={() => { setQuickViewProduct(null); onClose(); }}
        />
      )}
    </Modal>
  );
}

// ── Message Bubble ──────────────────────────────────────────────────────────

function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

function MessageBubble({
  msg, lang, onAddToCart, addedIds, onUpload, onRecType, onProductPress,
}: {
  msg: ChatMessage;
  lang: string;
  onAddToCart: (p: ChatProduct) => void;
  addedIds: Set<string>;
  onUpload: () => void;
  onRecType: (t: RecType) => void;
  onProductPress: (p: ChatProduct) => void;
}) {
  const isUser = msg.role === 'user';
  const isRTL = isArabicText(msg.text) || lang === 'ar';
  const isArabicDialect = msg.dialect && msg.dialect !== 'english';
  const effectiveRTL = isRTL || !!isArabicDialect;
  const rtlStyle = effectiveRTL ? { textAlign: 'right' as const, writingDirection: 'rtl' as const } : {};

  const analysisLabels = effectiveRTL
    ? { title: 'تحليل بشرتك', tone: 'اللون', undertone: 'الأندرتون', concerns: 'مخاوف البشرة' }
    : { title: 'Your Skin Analysis', tone: 'Tone', undertone: 'Undertone', concerns: 'Skin Concerns' };

  const concernLabels = CONCERN_LABELS[lang] ?? CONCERN_LABELS.en;
  const recLabels = REC_TYPE_LABELS[lang] ?? REC_TYPE_LABELS.en;

  return (
    <View style={[s.msgRow, isUser && s.msgRowUser]}>
      {!isUser && (
        <View style={s.avatarBot}>
          <Bot size={14} color={Colors.neonBlue} strokeWidth={2} />
        </View>
      )}
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleBot]}>
        {msg.imageUri && (
          <Image source={{ uri: msg.imageUri }} style={s.chatImage} resizeMode="cover" />
        )}
        <Text style={[s.msgText, isUser && s.msgTextUser, rtlStyle]}>{msg.text}</Text>

        {msg.skinAnalysis && (
          <View style={s.analysisCard}>
            <Text style={[s.analysisTitle, rtlStyle]}>{analysisLabels.title}</Text>
            <View style={[s.analysisRow, effectiveRTL && { flexDirection: 'row-reverse' }]}>
              <View style={s.analysisPill}>
                <Text style={[s.analysisPillLabel, rtlStyle]}>{analysisLabels.tone}</Text>
                <Text style={[s.analysisPillValue, rtlStyle]}>{msg.skinAnalysis.tone}</Text>
              </View>
              <View style={s.analysisPill}>
                <Text style={[s.analysisPillLabel, rtlStyle]}>{analysisLabels.undertone}</Text>
                <Text style={[s.analysisPillValue, rtlStyle]}>{msg.skinAnalysis.undertone}</Text>
              </View>
            </View>

            {msg.skinAnalysis.concerns && msg.skinAnalysis.concerns.length > 0 && (
              <View style={s.concernsSection}>
                <Text style={[s.concernsSectionTitle, rtlStyle]}>{analysisLabels.concerns}</Text>
                <View style={[s.concernsRow, effectiveRTL && { flexDirection: 'row-reverse' }]}>
                  {msg.skinAnalysis.concerns.map((c) => (
                    <View key={c.key} style={[s.concernChip, { borderColor: SEVERITY_COLORS[c.severity] + '55' }]}>
                      <View style={[s.concernDot, { backgroundColor: SEVERITY_COLORS[c.severity] }]} />
                      <Text style={[s.concernText, rtlStyle]}>{concernLabels[c.key] ?? c.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {msg.showRecTypePicker && (
          <View style={s.recTypePicker}>
            <RecTypeButton icon={<Droplets size={16} color={Colors.neonBlue} />} label={recLabels.skincare} onPress={() => onRecType('skincare')} />
            <RecTypeButton icon={<Palette size={16} color={Colors.neonBlue} />} label={recLabels.makeup} onPress={() => onRecType('makeup')} />
            <RecTypeButton icon={<Layers size={16} color={Colors.neonBlue} />} label={recLabels.both} onPress={() => onRecType('both')} />
          </View>
        )}

        {msg.products && msg.products.length > 0 && (
          <View style={s.productsWrap}>
            {msg.products.map((p) => (
              <ProductChatCard key={p.id} product={p} onAddToCart={() => onAddToCart(p)} added={addedIds.has(p.id)} onPress={() => onProductPress(p)} />
            ))}
          </View>
        )}

        {msg.crossSell && msg.crossSell.length > 0 && (
          <View style={s.crossSellWrap}>
            <Text style={[s.crossSellTitle, rtlStyle]}>
              {effectiveRTL ? 'كملي لوكك:' : 'Complete your look:'}
            </Text>
            {msg.crossSell.map((p) => (
              <ProductChatCard key={p.id} product={p} onAddToCart={() => onAddToCart(p)} added={addedIds.has(p.id)} compact onPress={() => onProductPress(p)} />
            ))}
          </View>
        )}

        {msg.suggestUpload && (
          <TouchableOpacity style={[s.uploadPrompt, effectiveRTL && { flexDirection: 'row-reverse' }]} onPress={onUpload} activeOpacity={0.7}>
            <ImagePlus size={16} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={s.uploadPromptText}>
              {UPLOAD_LABEL[lang] ?? UPLOAD_LABEL.en}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {isUser && (
        <View style={s.avatarUser}>
          <User size={14} color="#FFFFFF" strokeWidth={2} />
        </View>
      )}
    </View>
  );
}

// ── Rec Type Button ─────────────────────────────────────────────────────────

function RecTypeButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.recTypeBtn} activeOpacity={0.7} onPress={onPress}>
      {icon}
      <Text style={s.recTypeBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Product Card in Chat ────────────────────────────────────────────────────

function ProductChatCard({ product, onAddToCart, added, compact, onPress }: {
  product: ChatProduct; onAddToCart: () => void; added: boolean; compact?: boolean; onPress: () => void;
}) {
  const { language } = useLanguage();
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[s.productCard, compact && s.productCardCompact]}>
      {product.image ? (
        <Image source={{ uri: product.image }} style={[s.productImage, compact && s.productImageCompact]} resizeMode="cover" />
      ) : (
        <View style={[s.productImage, compact && s.productImageCompact, { backgroundColor: Colors.backgroundSecondary }]} />
      )}
      <View style={s.productInfo}>
        <Text style={s.productName} numberOfLines={2}>{product.name}</Text>
        {product.reason ? (
          <Text style={s.productReason} numberOfLines={2}>{product.reason}</Text>
        ) : null}
        <View style={s.productMeta}>
          <Text style={s.productPrice}>{formatPrice(product.price, language)}</Text>
          {product.rating > 0 && (
            <View style={s.ratingRow}>
              <Star size={10} color={Colors.gold} fill={Colors.gold} strokeWidth={1} />
              <Text style={s.ratingText}>{product.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        {product.badge && (
          <View style={s.productBadge}><Text style={s.productBadgeText}>{product.badge}</Text></View>
        )}
        <View style={s.cardActions}>
          <TouchableOpacity style={[s.addCartBtn, added && s.addCartBtnDone, { flex: 1 }]} onPress={(e) => { e.stopPropagation?.(); onAddToCart(); }} activeOpacity={0.7} disabled={added}>
            <ShoppingBag size={12} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={s.addCartText}>{added ? 'ADDED' : 'ADD TO CART'}</Text>
          </TouchableOpacity>
          <View style={s.viewDetailHint}>
            <ExternalLink size={11} color={Colors.textMuted} strokeWidth={2} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Product Quick View Modal ────────────────────────────────────────────────

function ProductQuickViewModal({
  product,
  lang,
  addedIds,
  onAddToCart,
  onClose,
  onViewFull,
}: {
  product: ChatProduct;
  lang: string;
  addedIds: Set<string>;
  onAddToCart: (p: ChatProduct) => Promise<void>;
  onClose: () => void;
  onViewFull: () => void;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const [fullProduct, setFullProduct] = useState<Product | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [shades, setShades] = useState<ProductShade[]>([]);
  const [activeImg, setActiveImg] = useState(0);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [adding, setAdding] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const added = addedIds.has(product.id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProduct(true);
      const [p, g, sh] = await Promise.all([
        fetchProductById(product.id, lang),
        fetchProductGallery(product.id),
        fetchProductShades(product.id),
      ]);
      if (!cancelled) {
        setFullProduct(p);
        const imgs: string[] = [];
        if (p?.main_image) imgs.push(p.main_image);
        else if (p?.image_url) imgs.push(p.image_url);
        g.forEach((url) => { if (!imgs.includes(url)) imgs.push(url); });
        if (imgs.length === 0 && product.image) imgs.push(product.image);
        setGallery(imgs);
        setShades(sh);
        setLoadingProduct(false);
      }
    })();
    return () => { cancelled = true; };
  }, [product.id, lang]);

  const handleAddToCart = async () => {
    setAdding(true);
    await onAddToCart(product);
    setAdding(false);
  };

  const handleViewFull = () => {
    onClose();
    router.push(`/product/${product.id}`);
  };

  const name = fullProduct ? getProductName(fullProduct, lang) : product.name;
  const description = fullProduct ? getProductDescription(fullProduct, lang) : '';
  const specs = fullProduct?.specifications ?? null;
  const ingredients = specs?.ingredients ?? specs?.key_ingredients ?? null;
  const benefits = specs?.benefits ?? specs?.key_benefits ?? null;
  const howToUse = specs?.how_to_use ?? specs?.howToUse ?? null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={qs.overlay}>
        <View style={qs.sheet}>
          {/* Header */}
          <View style={qs.sheetHeader}>
            <Text style={qs.sheetTitle} numberOfLines={2}>{name}</Text>
            <TouchableOpacity style={qs.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color={Colors.textPrimary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView style={qs.scroll} contentContainerStyle={qs.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Image gallery */}
            {loadingProduct ? (
              <View style={qs.imagePlaceholder}>
                <ActivityIndicator color={Colors.neonBlue} />
              </View>
            ) : gallery.length > 0 ? (
              <View>
                <TouchableOpacity activeOpacity={0.92} onPress={() => setImageViewerOpen(true)}>
                  <Image source={{ uri: gallery[activeImg] }} style={qs.mainImage} resizeMode="cover" />
                  <View style={qs.expandHint}>
                    <ExternalLink size={13} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                  </View>
                </TouchableOpacity>
                {gallery.length > 1 && (
                  <View style={qs.thumbRow}>
                    {gallery.map((uri, i) => (
                      <TouchableOpacity key={i} onPress={() => { setActiveImg(i); setImageViewerOpen(true); }} activeOpacity={0.8}
                        style={[qs.thumb, activeImg === i && qs.thumbActive]}>
                        <Image source={{ uri }} style={qs.thumbImg} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {gallery.length > 1 && (
                  <View style={qs.galleryNav}>
                    <TouchableOpacity style={qs.navBtn} onPress={() => setActiveImg(i => Math.max(0, i - 1))} disabled={activeImg === 0}>
                      <ChevronLeft size={16} color={activeImg === 0 ? Colors.textMuted : Colors.textPrimary} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <Text style={qs.navCount}>{activeImg + 1} / {gallery.length}</Text>
                    <TouchableOpacity style={qs.navBtn} onPress={() => setActiveImg(i => Math.min(gallery.length - 1, i + 1))} disabled={activeImg === gallery.length - 1}>
                      <ChevronRight size={16} color={activeImg === gallery.length - 1 ? Colors.textMuted : Colors.textPrimary} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View style={qs.imagePlaceholder} />
            )}

            {/* Price + rating */}
            <View style={qs.metaRow}>
              <Text style={qs.price}>{formatPrice(product.price, language)}</Text>
              {product.rating > 0 && (
                <View style={qs.ratingPill}>
                  <Star size={12} color={Colors.gold} fill={Colors.gold} strokeWidth={1} />
                  <Text style={qs.ratingTxt}>{product.rating.toFixed(1)}</Text>
                  {product.review_count ? <Text style={qs.reviewCount}>({product.review_count})</Text> : null}
                </View>
              )}
              {product.badge && (
                <View style={qs.badge}><Text style={qs.badgeTxt}>{product.badge}</Text></View>
              )}
            </View>

            {/* AI reason */}
            {product.reason ? (
              <View style={qs.reasonBox}>
                <Sparkles size={12} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={qs.reasonText}>{product.reason}</Text>
              </View>
            ) : null}

            {/* Description */}
            {description ? (
              <View style={qs.section}>
                <Text style={qs.sectionTitle}>DESCRIPTION</Text>
                <Text style={qs.sectionBody}>{description}</Text>
              </View>
            ) : null}

            {/* Shades */}
            {shades.length > 0 && (
              <View style={qs.section}>
                <Text style={qs.sectionTitle}>SHADES & COLORS</Text>
                <View style={qs.shadesRow}>
                  {shades.map((sh) => (
                    <View key={sh.id} style={qs.shadeItem}>
                      {sh.color_hex ? (
                        <View style={[qs.shadeCircle, { backgroundColor: sh.color_hex }]} />
                      ) : sh.shade_image ? (
                        <Image source={{ uri: sh.shade_image }} style={qs.shadeCircle} resizeMode="cover" />
                      ) : (
                        <View style={[qs.shadeCircle, { backgroundColor: '#888' }]} />
                      )}
                      <Text style={qs.shadeName} numberOfLines={1}>{sh.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Benefits */}
            {benefits && (Array.isArray(benefits) ? benefits.length > 0 : true) && (
              <View style={qs.section}>
                <Text style={qs.sectionTitle}>KEY BENEFITS</Text>
                {Array.isArray(benefits)
                  ? benefits.map((b: string, i: number) => (
                      <View key={i} style={qs.bulletRow}>
                        <View style={qs.bullet} />
                        <Text style={qs.bulletText}>{b}</Text>
                      </View>
                    ))
                  : <Text style={qs.sectionBody}>{benefits}</Text>
                }
              </View>
            )}

            {/* Ingredients */}
            {ingredients && (Array.isArray(ingredients) ? ingredients.length > 0 : true) && (
              <View style={qs.section}>
                <Text style={qs.sectionTitle}>KEY INGREDIENTS</Text>
                {Array.isArray(ingredients)
                  ? <Text style={qs.sectionBody}>{ingredients.join(' · ')}</Text>
                  : <Text style={qs.sectionBody}>{ingredients}</Text>
                }
              </View>
            )}

            {/* How to use */}
            {howToUse && (
              <View style={qs.section}>
                <Text style={qs.sectionTitle}>HOW TO USE</Text>
                <Text style={qs.sectionBody}>{Array.isArray(howToUse) ? howToUse.join('\n') : howToUse}</Text>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={qs.actions}>
            <TouchableOpacity
              style={[qs.addCartBtn, (added || adding) && qs.addCartBtnDone]}
              onPress={handleAddToCart}
              activeOpacity={0.8}
              disabled={added || adding}
            >
              <ShoppingBag size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={qs.addCartTxt}>
                {adding ? 'ADDING...' : added ? 'ADDED TO CART' : 'ADD TO CART'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={qs.viewFullBtn} onPress={handleViewFull} activeOpacity={0.8}>
              <ExternalLink size={15} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={qs.viewFullTxt}>VIEW FULL PAGE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {gallery.length > 0 && (
        <ImageViewerModal
          visible={imageViewerOpen}
          images={gallery}
          initialIndex={activeImg}
          onClose={() => setImageViewerOpen(false)}
          onIndexChange={setActiveImg}
        />
      )}
    </Modal>
  );
}

// ── Floating Button ─────────────────────────────────────────────────────────

const FAB_LABELS: Record<string, string> = {
  en: 'Ask me about your skin',
  ar: 'اسأليني عن بشرتك',
  es: 'Preguntame sobre tu piel',
  de: 'Frag mich nach deiner Haut',
  ru: 'Спроси меня о коже',
};

export function ChatFloatingButton({ onPress, chatOpen }: { onPress: () => void; chatOpen?: boolean }) {
  const { language } = useLanguage();
  const label = FAB_LABELS[language] ?? FAB_LABELS.en;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Dismissed state persists for the session only (resets on refresh/reopen)
  const [bubbleDismissed, setBubbleDismissed] = useState(false);

  const showBubble = !chatOpen && !bubbleDismissed;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showBubble ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [showBubble, fadeAnim]);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setBubbleDismissed(true));
  };

  return (
    <View style={s.fabRow}>
      {!bubbleDismissed && !chatOpen && (
        <Animated.View style={[s.fabLabel, { opacity: fadeAnim }]}>
          <Text style={s.fabLabelText} numberOfLines={1}>{label}</Text>
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            style={s.fabLabelClose}
          >
            <X size={10} color="rgba(255,77,141,0.7)" strokeWidth={2.5} />
          </TouchableOpacity>
        </Animated.View>
      )}
      <TouchableOpacity style={s.fab} onPress={onPress} activeOpacity={0.85}>
        <View style={s.fabGlow} />
        <MessageCircle size={18} color="#FFFFFF" strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 16 : 54, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.backgroundSecondary,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,77,141,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  headerSub: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },

  messagesWrap: { flex: 1 },
  messagesContent: { padding: 12, paddingBottom: 8, gap: 12 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },

  avatarBot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,77,141,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)', justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  avatarUser: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.neonBlue,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },

  bubble: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleBot: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderTopLeftRadius: 4 },
  bubbleUser: { backgroundColor: 'rgba(255,77,141,0.18)', borderWidth: 1, borderColor: 'rgba(255,77,141,0.3)', borderTopRightRadius: 4 },
  msgText: { color: Colors.textPrimary, fontSize: FontSize.sm, lineHeight: 20 },
  msgTextUser: { color: '#FDE8F0' },

  chatImage: { width: '100%', height: 140, borderRadius: 10, marginBottom: 8 },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundCard,
    borderRadius: 16, borderTopLeftRadius: 4, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10,
  },
  typingText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },

  quickPromptsWrap: { marginTop: 8, gap: 8 },
  quickTitle: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', marginLeft: 36 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 36 },
  quickChip: {
    backgroundColor: 'rgba(255,77,141,0.1)', borderWidth: 1, borderColor: 'rgba(255,77,141,0.2)',
    borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7,
  },
  quickChipText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '700' },

  analysisCard: {
    marginTop: 10, backgroundColor: 'rgba(255,77,141,0.08)', borderRadius: Radius.md,
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.2)', padding: 10, gap: 8,
  },
  analysisTitle: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  analysisRow: { flexDirection: 'row', gap: 8 },
  analysisPill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.sm, padding: 8, alignItems: 'center', gap: 2,
  },
  analysisPillLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  analysisPillValue: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '800', textTransform: 'capitalize' },

  concernsSection: { marginTop: 6, gap: 6 },
  concernsSectionTitle: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  concernsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  concernChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  concernDot: { width: 6, height: 6, borderRadius: 3 },
  concernText: { color: Colors.textPrimary, fontSize: 10, fontWeight: '700' },

  recTypePicker: { flexDirection: 'row', gap: 8, marginTop: 12 },
  recTypeBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,77,141,0.08)', borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)',
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 6,
  },
  recTypeBtnText: { color: Colors.neonBlue, fontSize: 10, fontWeight: '800', textAlign: 'center' },

  productsWrap: { marginTop: 10, gap: 8 },
  crossSellWrap: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,77,141,0.1)', gap: 6 },
  crossSellTitle: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },

  productCard: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: Radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  productCardCompact: { borderRadius: Radius.sm },
  productImage: { width: 72, height: 90 },
  productImageCompact: { width: 52, height: 70 },
  productInfo: { flex: 1, padding: 8, gap: 3 },
  productName: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', lineHeight: 15 },
  productReason: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, fontStyle: 'italic' },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productPrice: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '900' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: Colors.gold, fontSize: 10, fontWeight: '700' },
  productBadge: { alignSelf: 'flex-start', backgroundColor: Colors.neonBlue, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  productBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.3 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  addCartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.full, paddingVertical: 5,
  },
  addCartBtnDone: { backgroundColor: Colors.success },
  addCartText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  viewDetailHint: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
  },

  uploadPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: 'rgba(255,77,141,0.1)', borderWidth: 1, borderColor: 'rgba(255,77,141,0.2)',
    borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  uploadPromptText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '700' },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.backgroundSecondary,
    paddingBottom: Platform.OS === 'web' ? 10 : 30,
  },
  imageBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,77,141,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  input: {
    flex: 1, backgroundColor: Colors.backgroundInput, borderRadius: Radius.full, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 10, color: Colors.textPrimary,
    fontSize: FontSize.sm, maxHeight: 44, textAlign: 'auto',
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neonBlue, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,77,141,0.2)' },

  fabRow: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 90 : 120,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
    gap: 8,
  },
  fabLabel: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(30,30,35,0.92)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)', maxWidth: 200,
  },
  fabLabelText: { color: '#FF4D8D', fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.2, textAlign: 'left' as const, flexShrink: 1 },
  fabLabelClose: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,77,141,0.12)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  fab: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.neonBlue,
    justifyContent: 'center', alignItems: 'center', shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8, overflow: 'hidden',
  },
  fabGlow: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)', top: -9, left: -9,
  },
});

// ── Quick View Modal Styles ──────────────────────────────────────────────────

const qs = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(10,5,7,0.82)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.backgroundCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, maxHeight: '92%',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 12,
  },
  sheetTitle: {
    flex: 1, color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800', lineHeight: 22,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 16 },

  mainImage: {
    width: '100%', height: 260, backgroundColor: Colors.backgroundSecondary,
  },
  expandHint: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(10,5,7,0.55)', borderRadius: 8,
    padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  imagePlaceholder: {
    width: '100%', height: 200, backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  thumbRow: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 10, flexWrap: 'wrap',
  },
  thumb: {
    width: 48, height: 48, borderRadius: Radius.sm, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  thumbActive: { borderColor: Colors.neonBlue },
  thumbImg: { width: '100%', height: '100%' },
  galleryNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 16, paddingTop: 8,
  },
  navBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
  },
  navCount: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14,
  },
  price: { color: Colors.neonBlue, fontSize: FontSize.lg, fontWeight: '900' },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  ratingTxt: { color: Colors.gold, fontSize: 11, fontWeight: '800' },
  reviewCount: { color: Colors.textMuted, fontSize: 10 },
  badge: {
    backgroundColor: Colors.neonBlue, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeTxt: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },

  reasonBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginHorizontal: 16, marginTop: 10, backgroundColor: 'rgba(255,77,141,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.2)', borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  reasonText: { flex: 1, color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', lineHeight: 17 },

  section: { marginHorizontal: 16, marginTop: 16, gap: 6 },
  sectionTitle: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase',
  },
  sectionBody: { color: Colors.textPrimary, fontSize: FontSize.sm, lineHeight: 20 },

  shadesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  shadeItem: { alignItems: 'center', gap: 4, width: 44 },
  shadeCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  shadeName: { color: Colors.textMuted, fontSize: 8, fontWeight: '700', textAlign: 'center' },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.neonBlue, marginTop: 7 },
  bulletText: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm, lineHeight: 20 },

  actions: {
    flexDirection: 'column', gap: 10, paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'web' ? 14 : 30,
  },
  addCartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.full, paddingVertical: 14,
    shadowColor: '#FF4D8D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  addCartBtnDone: { backgroundColor: Colors.success },
  addCartTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },

  viewFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,77,141,0.1)', borderRadius: Radius.full, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.3)',
  },
  viewFullTxt: { color: Colors.neonBlue, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
});
