import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import WishlistToast from '@/components/WishlistToast';

type ToastVariant = 'wishlist' | 'cart';

type WishlistToastContextType = {
  showWishlistToast: (added: boolean, message: string) => void;
  showCartToast: (message: string) => void;
};

const WishlistToastContext = createContext<WishlistToastContextType | undefined>(undefined);

export function WishlistToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [added, setAdded] = useState(true);
  const [message, setMessage] = useState('');
  const [variant, setVariant] = useState<ToastVariant>('wishlist');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((isAdded: boolean, msg: string, v: ToastVariant) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAdded(isAdded);
    setMessage(msg);
    setVariant(v);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 2000);
  }, []);

  const showWishlistToast = useCallback((isAdded: boolean, msg: string) => {
    show(isAdded, msg, 'wishlist');
  }, [show]);

  const showCartToast = useCallback((msg: string) => {
    show(true, msg, 'cart');
  }, [show]);

  return (
    <WishlistToastContext.Provider value={{ showWishlistToast, showCartToast }}>
      {children}
      <WishlistToast visible={visible} added={added} message={message} variant={variant} />
    </WishlistToastContext.Provider>
  );
}

export function useWishlistToast() {
  const ctx = useContext(WishlistToastContext);
  if (!ctx) throw new Error('useWishlistToast must be inside WishlistToastProvider');
  return ctx;
}
