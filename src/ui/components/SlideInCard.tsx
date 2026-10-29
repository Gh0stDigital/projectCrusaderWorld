import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const SLIDE_MS = 220;

interface SlideInCardProps {
  /** What the card is about (a Captain or Knight id), or null to slide it away. */
  id: string | null;
  /** Finds the element (a Captain icon, a Knight token) the card lines up with. */
  anchorSelector: (id: string) => string;
  /** Lowest the card's top may sit, in canvas pixels. */
  maxTop: number;
  /** The name on the tab the card folds into when hidden. */
  tabLabel: (id: string) => string;
  /** Draws the card for an id, at a position, with the slide classes and its Hide button. */
  render: (id: string, at: { x: number; y: number }, className: string, onHide: () => void) => ReactNode;
}

/**
 * A details card that slides out from the right edge of Player 1's panel, level
 * with the thing it describes, and slides back when there is nothing to show.
 * Its Hide button folds it into a small tab on the panel edge; the tab brings it
 * back. It starts hidden; once open or hidden it stays that way, for whatever is
 * selected, until the player changes it.
 * Rendered inside the match canvas.
 */
export function SlideInCard({ id, anchorSelector, maxTop, tabLabel, render }: SlideInCardProps) {
  // Keep the last card on screen while it slides back out.
  const [shown, setShown] = useState<string | null>(id);
  const [leaving, setLeaving] = useState(false);
  // Starts as a tab; the player opens the card when they want it.
  const [hidden, setHidden] = useState(true);
  const [hiding, setHiding] = useState(false);
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

  const hide = () => {
    setHiding(true);
    window.setTimeout(() => {
      setHidden(true);
      setHiding(false);
    }, SLIDE_MS);
  };

  if (!shown || top === null) return <div ref={ref} className="slide-in-host" />;
  return (
    <div ref={ref} className="slide-in-host">
      {hidden ? (
        !leaving && (
          <button className="details-tab" style={{ top }} onClick={() => setHidden(false)} title="Show the details card">
            <span className="details-tab__label">{tabLabel(shown)}</span>
            <span className="details-tab__arrow" aria-hidden="true">
              ›
            </span>
          </button>
        )
      ) : (
        render(shown, { x: 404, y: top }, `details--slide${leaving || hiding ? ' details--leaving' : ''}`, hide)
      )}
    </div>
  );
}
