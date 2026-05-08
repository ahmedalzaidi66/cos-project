import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react-native';
import { useCart, CartItem, CartShade } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import AppHeader from '@/components/AppHeader';
import GlossyButton from '@/components/GlossyButton';
import QuantitySelector from '@/components/QuantitySelector';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

// Prices are IQD in the database
const SHIPPING_THRESHOLD = 75000;  // ~$50 USD free shipping threshold
const SHIPPING_FEE = 5000;         // ~$3.33 USD flat shipping fee

export default function CartScreen() {
  const router = useRouter();
  const { items, removeFromCart, updateQuantity, subtotal, totalItems } = useCart();
  const { t, language } = useLanguage();

  const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.yourCart} />
        <EmptyCart />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title={t.yourCart} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.shade ? `${item.product.id}::${item.shade.id}` : item.product.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.itemCount}>
            {totalItems} {totalItems === 1 ? t.item : t.items}
          </Text>
        }
        ListFooterComponent={
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{t.orderSummary}</Text>
            <SummaryRow label={t.subtotal} value={formatPrice(subtotal, language)} />
            <SummaryRow
              label={t.shipping}
              value={shipping === 0 ? t.free : formatPrice(shipping, language)}
              highlight={shipping === 0}
            />
            {shipping > 0 && (
              <Text style={styles.shippingHint}>
                {t.addMoreForFreeShipping.replace('{{amount}}', formatPrice(SHIPPING_THRESHOLD - subtotal, language))}
              </Text>
            )}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.total}</Text>
              <Text style={styles.totalValue}>{formatPrice(total, language)}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CartItemCard
            item={item}
            onRemove={() => removeFromCart(item.product.id, item.shade?.id ?? null)}
            onUpdateQty={(qty) => updateQuantity(item.product.id, qty, item.shade?.id ?? null)}
          />
        )}
      />
      <View style={styles.footer}>
        <GlossyButton
          title={t.proceedToCheckout}
          onPress={() => router.push('/checkout')}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

function CartItemCard({
  item,
  onRemove,
  onUpdateQty,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQty: (qty: number) => void;
}) {
  const { language } = useLanguage();
  const lineTotal = item.product.price * item.quantity;
  const displayImage = item.shade?.product_image || item.product.image_url;

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: displayImage }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={2}>
            {item.product.name}
          </Text>
          <TouchableOpacity onPress={onRemove} activeOpacity={0.7} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Trash2 size={16} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        {item.shade ? (
          <View style={styles.shadeRow}>
            <View style={[styles.shadeDot, { backgroundColor: item.shade.color_hex || '#888' }]} />
            <Text style={styles.shadeName} numberOfLines={1}>{item.shade.name}</Text>
          </View>
        ) : (
          <Text style={styles.cardCategory}>
            {item.product.category.toUpperCase()}
          </Text>
        )}
        <View style={styles.cardBottomRow}>
          <QuantitySelector
            value={item.quantity}
            onDecrement={() => onUpdateQty(item.quantity - 1)}
            onIncrement={() => onUpdateQty(item.quantity + 1)}
            min={0}
            max={item.product.stock}
          />
          <Text style={styles.lineTotal}>{formatPrice(lineTotal, language)}</Text>
        </View>
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryHighlight]}>
        {value}
      </Text>
    </View>
  );
}

function EmptyCart() {
  const router = useRouter();
  const { t } = useLanguage();
  return (
    <View style={styles.emptyContainer}>
      <ShoppingBag size={64} color={Colors.textMuted} strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>{t.cartEmpty}</Text>
      <Text style={styles.emptySubtitle}>{t.cartEmptySubtitle}</Text>
      <View style={{ marginTop: Spacing.lg, width: '60%' }}>
        <GlossyButton
          title={t.browseGear}
          onPress={() => router.push('/(tabs)')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  itemCount: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  cardImage: {
    width: 100,
    height: 110,
  },
  cardInfo: {
    flex: 1,
    padding: Spacing.sm,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cardName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  removeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -4,
  },
  cardCategory: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 1,
  },
  shadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  shadeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  shadeName: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineTotal: {
    color: Colors.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  summary: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  summaryTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  summaryValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  summaryHighlight: {
    color: Colors.success,
    fontWeight: '700',
  },
  shippingHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  totalValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl + 4,
    fontWeight: '900',
  },
  footer: {
    padding: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});
