import React, { useEffect, useRef, useState } from 'react';
import { useLoyalty, LoyaltyTransaction } from '@/context/LoyaltyContext';
import { getTierFromLifetime, LoyaltyTier } from '@/lib/loyalty';
import { PointsEarnedToast, TierUpgradeToast } from './LoyaltyRewardToast';

/**
 * Mounts invisibly in the app shell and listens for new 'earn' loyalty
 * transactions arriving via realtime. Shows animated toasts accordingly.
 */
export default function LoyaltyToastManager() {
  const { transactions, lifetimePoints, tier } = useLoyalty();

  const [pointsToast, setPointsToast] = useState<{ visible: boolean; points: number }>({
    visible: false,
    points: 0,
  });
  const [tierToast, setTierToast] = useState<{ visible: boolean; tier: LoyaltyTier }>({
    visible: false,
    tier: 'bronze',
  });

  // Track seen transaction IDs to detect new ones
  const seenIds = useRef<Set<string>>(new Set());
  // Track previous tier to detect upgrade
  const prevTier = useRef<LoyaltyTier>(tier);
  // Seed initial IDs on first load so we don't toast old transactions
  const initialized = useRef(false);

  useEffect(() => {
    if (transactions.length === 0) return;

    if (!initialized.current) {
      // On first load, mark all existing transactions as seen (no toast)
      transactions.forEach((tx) => seenIds.current.add(tx.id));
      initialized.current = true;
      return;
    }

    // Find any new earn transactions we haven't seen
    const newEarns = transactions.filter(
      (tx) => !seenIds.current.has(tx.id) && tx.type === 'earn' && tx.status === 'confirmed'
    );

    newEarns.forEach((tx) => seenIds.current.add(tx.id));

    if (newEarns.length > 0) {
      const totalEarned = newEarns.reduce((sum, tx) => sum + tx.points, 0);
      setPointsToast({ visible: true, points: totalEarned });
    }

    // Mark all new transactions as seen (even non-earn)
    transactions.forEach((tx) => seenIds.current.add(tx.id));
  }, [transactions]);

  // Detect tier upgrade
  useEffect(() => {
    if (!initialized.current) return;
    if (tier !== prevTier.current) {
      const tierOrder: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];
      const prev = tierOrder.indexOf(prevTier.current);
      const curr = tierOrder.indexOf(tier);
      if (curr > prev) {
        // Wait a bit so points toast shows first
        setTimeout(() => {
          setTierToast({ visible: true, tier });
        }, 1400);
      }
      prevTier.current = tier;
    }
  }, [tier]);

  return (
    <>
      <PointsEarnedToast
        visible={pointsToast.visible}
        points={pointsToast.points}
        onHide={() => setPointsToast((s) => ({ ...s, visible: false }))}
      />
      <TierUpgradeToast
        visible={tierToast.visible}
        tier={tierToast.tier}
        onHide={() => setTierToast((s) => ({ ...s, visible: false }))}
      />
    </>
  );
}
