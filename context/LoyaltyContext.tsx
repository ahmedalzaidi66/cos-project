import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { getTierFromLifetime, TIER_COLORS, type LoyaltyTier } from '@/lib/loyalty';

type LoyaltyTransaction = {
  id: string;
  type: 'earn' | 'redeem' | 'adjust' | 'expire';
  points: number;
  balance_after: number;
  note: string | null;
  order_id: string | null;
  created_at: string;
};

type LoyaltyState = {
  totalPoints: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  tierColor: string;
  transactions: LoyaltyTransaction[];
  loading: boolean;
  refresh: () => void;
};

const LoyaltyContext = createContext<LoyaltyState>({
  totalPoints: 0,
  lifetimePoints: 0,
  tier: 'bronze',
  tierColor: TIER_COLORS.bronze,
  transactions: [],
  loading: false,
  refresh: () => {},
});

export function LoyaltyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [totalPoints, setTotalPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLoyalty = useCallback(async () => {
    if (!user?.id) {
      setTotalPoints(0);
      setLifetimePoints(0);
      setTransactions([]);
      return;
    }

    setLoading(true);
    try {
      const [loyaltyRes, txnRes] = await Promise.all([
        supabase
          .from('customer_loyalty')
          .select('total_points, lifetime_points, tier')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('loyalty_transactions')
          .select('id, type, points, balance_after, note, order_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (loyaltyRes.data) {
        setTotalPoints(loyaltyRes.data.total_points ?? 0);
        setLifetimePoints(loyaltyRes.data.lifetime_points ?? 0);
      } else {
        setTotalPoints(0);
        setLifetimePoints(0);
      }

      setTransactions((txnRes.data ?? []) as LoyaltyTransaction[]);
    } catch (err) {
      console.warn('[Loyalty] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLoyalty();
  }, [fetchLoyalty]);

  // Realtime: re-fetch when loyalty row changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`loyalty:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_loyalty',
          filter: `user_id=eq.${user.id}`,
        },
        () => { fetchLoyalty(); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [user?.id, fetchLoyalty]);

  const tier = getTierFromLifetime(lifetimePoints);

  return (
    <LoyaltyContext.Provider
      value={{
        totalPoints,
        lifetimePoints,
        tier,
        tierColor: TIER_COLORS[tier],
        transactions,
        loading,
        refresh: fetchLoyalty,
      }}
    >
      {children}
    </LoyaltyContext.Provider>
  );
}

export function useLoyalty() {
  return useContext(LoyaltyContext);
}
