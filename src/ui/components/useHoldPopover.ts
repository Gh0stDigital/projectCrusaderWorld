import { useEffect, useRef, useState, type MouseEvent } from 'react';

const HOLD_MS = 350;
const POPOVER_WIDTH = 400;

/**
 * Press-and-hold to show a details popover. Returns a ref for the held element,
 * pointer handlers, a click guard (so a hold doesn't also count as a click), and
 * where to draw the popover in canvas pixels (null while closed).
 */
export function useHoldPopover<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);
  const held = useRef(false);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const start = () => {
    held.current = false;
    clear();
    timer.current = window.setTimeout(() => {
      held.current = true;
      const el = ref.current;
      const root = el?.closest('.match') as HTMLElement | null;
      if (!el || !root) return;
      const r = root.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const k = root.offsetWidth / r.width;
      // Open to the right, or to the left if that would run off the canvas.
      let x = (b.right - r.left) * k + 12;
      if (x + POPOVER_WIDTH > root.offsetWidth) x = (b.left - r.left) * k - 12 - POPOVER_WIDTH;
      const y = Math.max(8, Math.min((b.top - r.top) * k - 10, root.offsetHeight - 360));
      setAt({ x, y });
    }, HOLD_MS);
  };
  const end = () => {
    clear();
    setAt(null);
  };

  return {
    ref,
    at,
    root: () => ref.current?.closest('.match') as HTMLElement | null,
    handlers: {
      onPointerDown: start,
      onPointerUp: end,
      onPointerLeave: end,
      onPointerCancel: end,
      onContextMenu: (e: MouseEvent) => e.preventDefault(),
    },
    /** Use as onClickCapture: swallows the click that ends a hold. */
    guardClick: (e: MouseEvent) => {
      if (held.current) {
        held.current = false;
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };
}
