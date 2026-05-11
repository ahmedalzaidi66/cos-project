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
