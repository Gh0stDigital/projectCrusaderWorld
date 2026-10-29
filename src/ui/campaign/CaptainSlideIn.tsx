import { useLayoutEffect, useRef, useState } from 'react';
import type { MatchState } from '../../engine/state';
import { CaptainDetails } from './CaptainIcon';

const SLIDE_MS = 220;
const CARD_HEIGHT = 330;

/**
 * The selected Captain's details as a card that slides out from the right edge of
 * Player 1's panel, level with the Captain's icon, and slides back when the
 * selection clears. Rendered inside the match canvas.
 */
export function CaptainSlideIn({ match, captainId }: { match: MatchState; captainId: string | null }) {
  // Keep the last Captain on screen while the card slides back out.
  const [shown, setShown] = useState<string | null>(captainId);
  const [leaving, setLeaving] = useState(false);
  const [top, setTop] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (captainId) {
      setShown(captainId);
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
  }, [captainId]);

  // Line the card up with the Captain's icon (canvas pixels; the canvas may be scaled).
  useLayoutEffect(() => {
    if (!shown) return;
    const root = ref.current?.closest('.match') as HTMLElement | null;
    const icon = root?.querySelector(`[data-captain-id="${shown}"]`) as HTMLElement | null;
    if (!root || !icon) return;
    const r = root.getBoundingClientRect();
    const b = icon.getBoundingClientRect();
    const k = root.offsetWidth / r.width;
    const y = (b.top - r.top) * k - 20;
    setTop(Math.max(76, Math.min(y, root.offsetHeight - 182 - CARD_HEIGHT)));
  }, [shown]);

  const captain = shown ? match.captains[shown] : undefined;
  return (
    <div ref={ref} className="captain-slide-in-host">
      {captain && top !== null && (
        <CaptainDetails
          key={captain.id}
          match={match}
          captain={captain}
          at={{ x: 404, y: top }}
          className={`captain-details--slide${leaving ? ' captain-details--leaving' : ''}`}
        />
      )}
    </div>
  );
}
