import { useEffect, useRef, useState } from 'react';
import { RESOURCES } from '../../engine/config';
import { PLAYER_NAMES } from '../../data/names';
import type { MatchState, PlayerId } from '../../engine/state';
import './resourceBars.css';

/**
 * Resources as fighting-game health bars along the top of the bottom bar:
 * yours on the left, the enemy's mirrored on the right. Spending drains the
 * bar, leaving a pale "just lost" stretch that catches up a moment later,
 * with the amount floating off the end.
 */
export function ResourceBars({ match }: { match: MatchState }) {
  if (!match.resources) return null;
  const active = match.phase === 'turns' ? (match.turn?.player ?? null) : null;
  return (
    <div className="resource-bars" aria-label="Resources">
      <ResourceBar player="p1" value={match.resources.p1} active={active === 'p1'} />
      <span className="resource-bars__label">Resources</span>
      <ResourceBar player="p2" value={match.resources.p2} active={active === 'p2'} />
    </div>
  );
}

const CATCH_UP_MS = 700;
const DELTA_MS = 1400;

function ResourceBar({ player, value, active }: { player: PlayerId; value: number; active: boolean }) {
  const max = RESOURCES.startingAmount;
  const share = Math.max(0, Math.min(1, value / max));
  // The pale trail shows what was just spent, then catches up.
  const [trail, setTrail] = useState(value);
  const [delta, setDelta] = useState<{ amount: number; key: number } | null>(null);
  const last = useRef(value);

  useEffect(() => {
    const spent = last.current - value;
    last.current = value;
    if (spent === 0) return;
    if (spent < 0) {
      // A refund (an undo): no trail, the bar just fills back.
      setTrail(value);
      setDelta({ amount: spent, key: Date.now() });
    } else {
      setDelta({ amount: spent, key: Date.now() });
    }
    const catchUp = window.setTimeout(() => setTrail(value), CATCH_UP_MS);
    const clear = window.setTimeout(() => setDelta(null), DELTA_MS);
    return () => {
      window.clearTimeout(catchUp);
      window.clearTimeout(clear);
    };
  }, [value]);

  const level = value <= 0 ? 'out' : share < 0.25 ? 'low' : share < 0.5 ? 'mid' : 'high';
  const trailShare = Math.max(share, Math.min(1, trail / max));
  return (
    <div
      className={`resource-bar resource-bar--${player} resource-bar--${level}${active ? ' resource-bar--active' : ''}`}
      title={`${PLAYER_NAMES[player]}: ${value.toLocaleString('en-US')} of ${max.toLocaleString('en-US')} Resources. Every action costs 1 per man taking part. A battle's loser pays for every man lost into a wager pool; whoever leaves their spot first forfeits it.`}
    >
      <span className="resource-bar__name">{player === 'p1' ? 'You' : 'Enemy'}</span>
      <div className="resource-bar__track">
        <div className="resource-bar__trail" style={{ width: `${trailShare * 100}%` }} />
        <div className="resource-bar__fill" style={{ width: `${share * 100}%` }} />
        {/* Notches every 10%. */}
        <div className="resource-bar__notches" />
        <span className="resource-bar__value">
          {value <= 0 ? 'OUT OF RESOURCES' : value.toLocaleString('en-US')}
        </span>
      </div>
      {delta && (
        <span key={delta.key} className={`resource-bar__delta${delta.amount < 0 ? ' resource-bar__delta--refund' : ''}`}>
          {delta.amount > 0 ? `−${delta.amount.toLocaleString('en-US')}` : `+${(-delta.amount).toLocaleString('en-US')}`}
        </span>
      )}
    </div>
  );
}
