import React, { useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleProp, ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

// ─── Web implementation ───────────────────────────────────────────────────────

function AutoScrollRowWeb({ children, contentContainerStyle }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragScrollLeft = useRef(0);
  // Once the gesture direction is determined, lock it for this touch
  const gestureLocked = useRef<'horizontal' | 'vertical' | null>(null);
  const DRAG_THRESHOLD = 6; // px — below this it's a tap, not a drag

  const pause = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    pausedRef.current = true;
    lastTimeRef.current = 0;
  };

  const scheduleResume = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      lastTimeRef.current = 0;
      pausedRef.current = false;
    }, 1000);
  };

  useEffect(() => {
    function animate(time: number) {
      const el = divRef.current;
      if (el && !pausedRef.current) {
        const delta = lastTimeRef.current === 0 ? 0 : time - lastTimeRef.current;
        lastTimeRef.current = time;
        if (delta > 0 && el.scrollWidth > 0) {
          el.scrollLeft += delta * 0.02;
          if (el.scrollLeft >= el.scrollWidth / 2) {
            el.scrollLeft = 0;
          }
        }
      } else {
        lastTimeRef.current = 0;
      }
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      hasDragged.current = false;
      gestureLocked.current = null;
      dragStartX.current = e.clientX;
      dragStartY.current = e.clientY;
      dragScrollLeft.current = el.scrollLeft;
      pause();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;

      const dx = Math.abs(e.clientX - dragStartX.current);
      const dy = Math.abs(e.clientY - dragStartY.current);

      // Determine gesture direction once we have enough movement
      if (gestureLocked.current === null && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
        gestureLocked.current = dy > dx ? 'vertical' : 'horizontal';
      }

      // Vertical gesture — release control so the page can scroll
      if (gestureLocked.current === 'vertical') {
        isDragging.current = false;
        el.style.cursor = 'grab';
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
        scheduleResume();
        return;
      }

      // Horizontal gesture — handle carousel drag
      if (gestureLocked.current === 'horizontal' && dx > DRAG_THRESHOLD) {
        hasDragged.current = true;
        if (!el.hasPointerCapture(e.pointerId)) {
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
        }
        el.style.cursor = 'grabbing';
        e.preventDefault();
        el.scrollLeft = dragScrollLeft.current - (e.clientX - dragStartX.current);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      gestureLocked.current = null;
      el.style.cursor = 'grab';
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      scheduleResume();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  // Convert RN StyleProp to plain CSS gap/padding for the container
  const flat = contentContainerStyle as any;
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    overflowX: 'auto',
    overflowY: 'visible',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
    cursor: 'grab',
    userSelect: 'none',
    // pan-y allows the browser to handle vertical scroll natively while we handle horizontal
    touchAction: 'pan-y',
    overscrollBehaviorX: 'contain',
    gap: flat?.gap ?? undefined,
    paddingLeft: flat?.paddingHorizontal ?? flat?.paddingLeft ?? undefined,
    paddingRight: flat?.paddingHorizontal ?? flat?.paddingRight ?? undefined,
    paddingTop: flat?.paddingVertical ?? flat?.paddingTop ?? undefined,
    paddingBottom: flat?.paddingVertical ?? flat?.paddingBottom ?? (flat?.paddingBottom ?? undefined),
  } as React.CSSProperties;

  return (
    <>
      <style>{`.asr-web::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={divRef}
        className="asr-web"
        style={containerStyle}
        onMouseEnter={() => { if (!isDragging.current) pause(); }}
        onMouseLeave={() => { if (!isDragging.current) scheduleResume(); }}
        onTouchStart={pause}
        onTouchEnd={scheduleResume}
      >
        {children}
        {children}
      </div>
    </>
  );
}

// ─── Native implementation ────────────────────────────────────────────────────

const SPEED = 0.4;

function AutoScrollRowNative({ children, contentContainerStyle }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const xRef = useRef(0);
  const pausedRef = useRef(false);
  const halfRef = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current || halfRef.current === 0) return;
      xRef.current += SPEED;
      if (xRef.current >= halfRef.current) {
        xRef.current = 0;
      }
      scrollRef.current?.scrollTo({ x: xRef.current, animated: false });
    }, 16);
    return () => clearInterval(id);
  }, []);

  const scheduleResume = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      pausedRef.current = false;
    }, 1000);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={true}
      nestedScrollEnabled={true}
      onContentSizeChange={(w) => { halfRef.current = w / 2; }}
      onScroll={(e) => {
        if (pausedRef.current) {
          xRef.current = e.nativeEvent.contentOffset.x;
        }
      }}
      scrollEventThrottle={16}
      onScrollBeginDrag={() => {
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        pausedRef.current = true;
      }}
      onScrollEndDrag={scheduleResume}
      onMomentumScrollEnd={(e) => {
        xRef.current = e.nativeEvent.contentOffset.x;
        scheduleResume();
      }}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
      {children}
    </ScrollView>
  );
}

// ─── Unified export ───────────────────────────────────────────────────────────

export function AutoScrollRow(props: Props) {
  if (Platform.OS === 'web') {
    return <AutoScrollRowWeb {...props} />;
  }
  return <AutoScrollRowNative {...props} />;
}
