import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';

export const SIDEBAR_WIDTH_STORAGE_KEY = 'semcache-sidebar-width';
export const DEFAULT_SIDEBAR_WIDTH = 288;
export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 440;
const KEYBOARD_RESIZE_STEP = 16;

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return DEFAULT_SIDEBAR_WIDTH;
  }
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
}

export function useResizableSidebar() {
  const [storedWidth, setStoredWidth] = useLocalStorage<number>(
    SIDEBAR_WIDTH_STORAGE_KEY,
    DEFAULT_SIDEBAR_WIDTH,
  );
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const clampedStoredWidth = clampSidebarWidth(storedWidth);
  const sidebarWidth = dragWidth ?? clampedStoredWidth;

  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(clampedStoredWidth);
  const latestDragWidthRef = useRef(clampedStoredWidth);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - dragStartXRef.current;
      const nextWidth = clampSidebarWidth(dragStartWidthRef.current + deltaX);
      latestDragWidthRef.current = nextWidth;
      setDragWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      setDragWidth(null);
      setStoredWidth(latestDragWidthRef.current);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isResizing, setStoredWidth]);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      dragStartXRef.current = event.clientX;
      dragStartWidthRef.current = clampedStoredWidth;
      latestDragWidthRef.current = clampedStoredWidth;
      setDragWidth(clampedStoredWidth);
      setIsResizing(true);
    },
    [clampedStoredWidth],
  );

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStoredWidth(clampSidebarWidth(clampedStoredWidth - KEYBOARD_RESIZE_STEP));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setStoredWidth(clampSidebarWidth(clampedStoredWidth + KEYBOARD_RESIZE_STEP));
      }
    },
    [clampedStoredWidth, setStoredWidth],
  );

  return {
    sidebarWidth,
    isResizing,
    handleResizeStart,
    handleResizeKeyDown,
  } as const;
}
