import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const SLIDE_MS = 220;

interface SlideInCardProps {
  /** What the card is about (a Captain or Knight id), or null to slide it away. */
  id: string | null;
  /** Finds the element (a Captain icon, a Knight token) the card lines up with. */
  anchorSelector: (id: string) => string;
  /** Lowest the card's top may sit, in canvas pixels. */
  maxTop: number;
  /** Draws the card for an id, at a position, with the slide classes. */
  render: (id: string, at: { x: number; y: number }, className: string) => ReactNode;
}

/**
 * A details card that slides out from the right edge of Player 1's panel, level
 * with the thing it describes, and slides back when there is nothing to show.
 * Rendered inside the match canvas.
 */
export function SlideInCard({ id, anchorSelector, maxTop, render }: SlideInCardProps) {
  // Keep the last card on screen while it slides back out.
  const [shown, setShown] = useState<string | null>(id);
  const [leaving, setLeaving] = useState(false);
  const [top, setTop] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (id) {
      setShown(id);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    setLeaving(true);
    const t = window.setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, SLIDE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Line the card up with its anchor (canvas pixels; the canvas may be scaled).
  useLayoutEffect(() => {
    if (!shown) return;
    const root = ref.current?.closest('.match') as HTMLElement | null;
    const anchor = root?.querySelector(anchorSelector(shown)) as HTMLElement | null;
    if (!root || !anchor) return;
    const r = root.getBoundingClientRect();
    const b = anchor.getBoundingClientRect();
    const k = root.offsetWidth / r.width;
    setTop(Math.max(76, Math.min((b.top - r.top) * k - 20, maxTop)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, maxTop]);

  // The card lets clicks through, so it can't see the mouse itself: watch the pointer
  // and fade the card out while it is over it, to show the map underneath.
  useEffect(() => {
    if (!shown) return;
    const onMove = (e: PointerEvent) => {
      const card = ref.current?.firstElementChild as HTMLElement | null;
      if (!card) return;
      const b = card.getBoundingClientRect();
      const over = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
      card.classList.toggle('details--peek', over);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [shown]);

  return (
    <div ref={ref} className="slide-in-host">
      {shown && top !== null && render(shown, { x: 404, y: top }, `details--slide${leaving ? ' details--leaving' : ''}`)}
    </div>
  );
}
