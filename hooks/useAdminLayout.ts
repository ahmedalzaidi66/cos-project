import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

const MOBILE_BREAKPOINT = 768;

function getWidth(): number {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth;
  }
  return Infinity;
}

/**
 * Responsive breakpoint hook for admin layout switching.
 *
 * On web: reads window.innerWidth directly and re-evaluates on every resize
 * event. This works correctly inside narrow iframe/browser previews (e.g.
 * bolt.new iPhone frame) where window.innerWidth reflects the frame width.
 *
 * On native: falls back to useWindowDimensions, which is always narrow enough
 * to trigger mobile layout.
 *
 * Breakpoint: width <= 768 → mobile layout.
 */
export function useAdminLayout(): { isMobile: boolean; isDesktop: boolean; width: number } {
  const dims = useWindowDimensions();

  // On web, manage width via window.innerWidth + resize listener for accuracy
  const [webWidth, setWebWidth] = useState<number>(() => getWidth());

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onResize = () => setWebWidth(window.innerWidth);

    window.addEventListener('resize', onResize);
    // Fire once immediately to capture current frame width
    onResize();

    return () => window.removeEventListener('resize', onResize);
  }, []);

  const width = Platform.OS === 'web' ? webWidth : dims.width;
  const isMobile = width <= MOBILE_BREAKPOINT;

  return { isMobile, isDesktop: !isMobile, width };
}


export { useAdminLayout }