import { Product } from './supabase';

/** Compute the bonus points a customer earns for a single product purchase. */
export function getProductBonusPoints(product: Product): number {
  if (!product.bonus_enabled) return 0;
  if (product.bonus_percentage != null && product.bonus_percentage > 0) {
    return Math.floor(product.price * product.bonus_percentage / 100);
  }
  return product.bonus_points ?? 0;
}

/** Returns true if the product awards any bonus on purchase. */
export function hasBonusPoints(product: Product): boolean {
  return getProductBonusPoints(product) > 0;
}

/**
 * Returns a display label for the bonus badge.
 * e.g. "Earn 500 pts"  or  "+5% Bonus"
 */
export function getBonusBadgeLabel(
  product: Product,
  t: Record<string, string>
): string {
  if (!product.bonus_enabled) return '';
  if (product.bonus_percentage != null && product.bonus_percentage > 0) {
    const pct = product.bonus_percentage % 1 === 0
      ? String(Math.floor(product.bonus_percentage))
      : String(product.bonus_percentage);
    return (t.loyaltyEarnPercentBadge ?? '+{{n}}% Bonus').replace('{{n}}', pct);
  }
  const pts = product.bonus_points ?? 0;
  return (t.loyaltyEarnBadge ?? 'Earn {{n}} pts').replace('{{n}}', pts.toLocaleString());
}

/** Compute total bonus points earned for an entire cart. */
export function calcCartBonusPoints(
  items: Array<{ product: Product; quantity: number }>
): number {
  return items.reduce((sum, item) => {
    return sum + getProductBonusPoints(item.product) * item.quantity;
  }, 0);
}

/** Tier thresholds (lifetime points). */
export const TIER_THRESHOLDS = {
  bronze:   0,
  silver:   2000,
  gold:     5000,
  platinum: 15000,
} as const;

export type LoyaltyTier = keyof typeof TIER_THRESHOLDS;

export function getTierFromLifetime(lifetime: number): LoyaltyTier {
  if (lifetime >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (lifetime >= TIER_THRESHOLDS.gold)     return 'gold';
  if (lifetime >= TIER_THRESHOLDS.silver)   return 'silver';
  return 'bronze';
}

export const TIER_COLORS: Record<LoyaltyTier, string> = {
  bronze:   '#CD7F32',
  silver:   '#A8A9AD',
  gold:     '#FFD700',
  platinum: '#E5E4E2',
};

// ─── Tier Benefits ────────────────────────────────────────────────────────────

export type TierBenefits = {
  tier: LoyaltyTier;
  min_points: number;
  discount_pct: number;
  free_shipping: boolean;
  bonus_multiplier: number;
  birthday_bonus: number;
  exclusive_offers: boolean;
  early_access: boolean;
  description: string;
};

export const DEFAULT_TIER_BENEFITS: Record<LoyaltyTier, TierBenefits> = {
  bronze:   { tier: 'bronze',   min_points: 0,     discount_pct: 0,  free_shipping: false, bonus_multiplier: 1.0, birthday_bonus: 0,   exclusive_offers: false, early_access: false, description: '' },
  silver:   { tier: 'silver',   min_points: 2000,  discount_pct: 10, free_shipping: false, bonus_multiplier: 1.2, birthday_bonus: 100, exclusive_offers: false, early_access: false, description: '' },
  gold:     { tier: 'gold',     min_points: 5000,  discount_pct: 15, free_shipping: false, bonus_multiplier: 1.5, birthday_bonus: 250, exclusive_offers: true,  early_access: false, description: '' },
  platinum: { tier: 'platinum', min_points: 15000, discount_pct: 20, free_shipping: true,  bonus_multiplier: 2.0, birthday_bonus: 500, exclusive_offers: true,  early_access: true,  description: '' },
};

/** Build a human-readable bullet list of active perks for a tier. */
export function getTierBenefitLines(b: TierBenefits): string[] {
  const lines: string[] = [];
  if (b.discount_pct > 0) lines.push(`${b.discount_pct}% discount on all orders`);
  if (b.free_shipping)     lines.push('Free shipping on all orders');
  if (b.bonus_multiplier > 1) lines.push(`${b.bonus_multiplier}x bonus points on purchases`);
  if (b.birthday_bonus > 0)   lines.push(`${b.birthday_bonus} bonus pts on your birthday`);
  if (b.exclusive_offers)     lines.push('Access to exclusive member offers');
  if (b.early_access)         lines.push('Early access to new launches');
  return lines;
}
