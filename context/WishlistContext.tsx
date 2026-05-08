import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Product } from '@/lib/supabase';

type WishlistContextType = {
  wishlistIds: Set<string>;
  wishlistItems: WishlistItem[];
  loading: boolean;
  isWishlisted: (productId: string) => boolean;
  toggle: (product: Product) => Promise<{ added: boolean }>;
  remove: (productId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  count: number;
};

export type WishlistItem = {
  id: string;
  product: Product;
  created_at: string;
};

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Prevent duplicate in-flight requests
  const pendingRef = useRef<Set<string>>(new Set());

  const loadWishlist = useCallback(async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('wishlist')
      .select(`
        id,
        created_at,
        product:products(
          *,
          translation:product_translations!left(*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const items: WishlistItem[] = data
        .filter((row: any) => row.product)
        .map((row: any) => {
          const raw = row.product;
          const translations: any[] = Array.isArray(raw.translation)
            ? raw.translation
            : raw.translation
            ? [raw.translation]
            : [];
          return {
            id: row.id,
            created_at: row.created_at,
            product: { ...raw, translation: translations[0] ?? null },
          };
        });
      setWishlistItems(items);
      setWishlistIds(new Set(items.map((i) => i.product.id)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadWishlist(user.id);
    } else {
      setWishlistIds(new Set());
      setWishlistItems([]);
    }
  }, [isAuthenticated, user?.id]);

  const isWishlisted = useCallback(
    (productId: string) => wishlistIds.has(productId),
    [wishlistIds]
  );

  const toggle = useCallback(
    async (product: Product): Promise<{ added: boolean }> => {
      if (!user) return { added: false };
      if (pendingRef.current.has(product.id)) return { added: wishlistIds.has(product.id) };

      pendingRef.current.add(product.id);
      const alreadyAdded = wishlistIds.has(product.id);

      // Optimistic update
      if (alreadyAdded) {
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
        setWishlistItems((prev) => prev.filter((i) => i.product.id !== product.id));
      } else {
        setWishlistIds((prev) => new Set([...prev, product.id]));
        setWishlistItems((prev) => [
          {
            id: `optimistic-${product.id}`,
            product,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      try {
        if (alreadyAdded) {
          const { error } = await supabase
            .from('wishlist')
            .delete()
            .eq('user_id', user.id)
            .eq('product_id', product.id);
          if (error) console.error('[Wishlist] delete error:', error.message);
        } else {
          const { error } = await supabase
            .from('wishlist')
            .insert({ user_id: user.id, product_id: product.id });
          if (error) console.error('[Wishlist] insert error:', error.message);
        }
        // Reload to get real IDs from DB
        await loadWishlist(user.id);
      } finally {
        pendingRef.current.delete(product.id);
      }

      return { added: !alreadyAdded };
    },
    [user, wishlistIds, loadWishlist]
  );

  const remove = useCallback(
    async (productId: string) => {
      if (!user) return;
      setWishlistIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      setWishlistItems((prev) => prev.filter((i) => i.product.id !== productId));
      await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);
    },
    [user]
  );

  const clearAll = useCallback(async () => {
    if (!user) return;
    setWishlistIds(new Set());
    setWishlistItems([]);
    await supabase.from('wishlist').delete().eq('user_id', user.id);
  }, [user]);

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistItems,
        loading,
        isWishlisted,
        toggle,
        remove,
        clearAll,
        count: wishlistIds.size,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

const FALLBACK: WishlistContextType = {
  wishlistIds: new Set(),
  wishlistItems: [],
  loading: false,
  isWishlisted: () => false,
  toggle: async () => ({ added: false }),
  remove: async () => {},
  clearAll: async () => {},
  count: 0,
};

export function useWishlist() {
  return useContext(WishlistContext) ?? FALLBACK;
}
