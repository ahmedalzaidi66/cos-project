import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { getTierFromLifetime, TIER_COLORS, type LoyaltyTier } from '@/lib/loyalty';

export type LoyaltyTransaction = {
  id: string;
  type: 'earn' | 'redeem' | 'adjust' | 'expire';
  status: 'pending' | 'confirmed' | 'cancelled' | 'reversed';
  points: number;
  balance_after: number;
  note: string | null;
  description: string | null;
  order_id: string | null;
  created_at: string;
};

type LoyaltyState = {
  totalPoints: number;
  pendingPoints: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  tierColor: string;
  transactions: LoyaltyTransaction[];
  loading: boolean;
  refresh: () => void;
};

const LoyaltyContext = createContext<LoyaltyState>({
  totalPoints: 0,
  pendingPoints: 0,
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
  const [pendingPoints, setPendingPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const prevTier = useRef<LoyaltyTier>('bronze');

  const fetchLoyalty = useCallback(async () => {
    if (!user?.id) {
      setTotalPoints(0);
      setPendingPoints(0);
      setLifetimePoints(0);
      setTransactions([]);
      return;
    }

    setLoading(true);
    try {
      const [loyaltyRes, txnRes] = await Promise.all([
        supabase
          .from('customer_loyalty')
          .select('total_points, pending_points, lifetime_points, tier')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('loyalty_transactions')
          .select('id, type, status, points, balance_after, note, description, order_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (loyaltyRes.data) {
        setTotalPoints(loyaltyRes.data.total_points ?? 0);
        setPendingPoints(loyaltyRes.data.pending_points ?? 0);
        setLifetimePoints(loyaltyRes.data.lifetime_points ?? 0);
      } else {
        setTotalPoints(0);
        setPendingPoints(0);
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

  // Realtime: re-fetch when loyalty row changes, also listen for new transactions
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'loyalty_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newTx = payload.new as LoyaltyTransaction;
          setTransactions((prev) => [newTx, ...prev.slice(0, 49)]);
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [user?.id, fetchLoyalty]);

  const tier = getTierFromLifetime(lifetimePoints);

  // Track previous tier for tier-up detection
  useEffect(() => {
    prevTier.current = tier;
  }, [tier]);

  return (
    <LoyaltyContext.Provider
      value={{
        totalPoints,
        pendingPoints,
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
