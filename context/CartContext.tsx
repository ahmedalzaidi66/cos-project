import React, { createContext, useContext, useState, useCallback } from 'react';
import { Product } from '@/lib/supabase';

export type CartShade = {
  id: string;
  name: string;
  color_hex: string;
  shade_image: string;
  product_image: string;
} | null;

export type CartItem = {
  product: Product;
  quantity: number;
  shade: CartShade;
};

function cartKey(productId: string, shade: CartShade): string {
  return shade ? `${productId}::${shade.id}` : productId;
}

type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, shade?: CartShade) => void;
  removeFromCart: (productId: string, shadeId?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, shadeId?: string | null) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = useCallback((product: Product, quantity: number = 1, shade: CartShade = null) => {
    setItems((prev) => {
      const key = cartKey(product.id, shade);
      const existing = prev.find(
        (i) => cartKey(i.product.id, i.shade) === key
      );
      if (existing) {
        return prev.map((i) =>
          cartKey(i.product.id, i.shade) === key
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { product, quantity, shade }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string, shadeId?: string | null) => {
    setItems((prev) =>
      prev.filter((i) => {
        if (i.product.id !== productId) return true;
        if (shadeId !== undefined) {
          return (i.shade?.id ?? null) !== (shadeId ?? null);
        }
        return false;
      })
    );
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, shadeId?: string | null) => {
    if (quantity <= 0) {
      removeFromCart(productId, shadeId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.product.id !== productId) return i;
        if (shadeId !== undefined && (i.shade?.id ?? null) !== (shadeId ?? null)) return i;
        return { ...i, quantity };
      })
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
