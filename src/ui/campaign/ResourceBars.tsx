import { useEffect, useRef, useState } from 'react';
import { RESOURCES } from '../../engine/config';
import { playerMilitia } from '../../engine/queries';
import { createMatch } from '../../engine/setup';
import { PLAYER_NAMES } from '../../data/names';
import type { MatchState, PlayerId } from '../../engine/state';
import './resourceBars.css';

/** Each player's troops at the start of a match: a full Troops bar. */
let startingTroops: number | null = null;
function fullTroops(): number {
  startingTroops ??= playerMilitia(createMatch(), 'p1');
  return startingTroops;
}

const RESOURCES_TIP =
  "Every action costs 1 per man taking part. A battle's loser pays for every man lost into a wager pool; whoever leaves their spot first forfeits it.";

/**
 * Troops and Resources as fighting-game health bars along the top of the bottom
 * bar: yours on the left, the enemy's mirrored on the right. Troops is the slimmer
 * row above. Losing drains a bar, leaving a pale "just lost" stretch that catches
 * up a moment later, with the amount floating off the end.
 */
export function ResourceBars({ match }: { match: MatchState }) {
  const active = match.phase === 'turns' ? (match.turn?.player ?? null) : null;
  const troops = { p1: playerMilitia(match, 'p1'), p2: playerMilitia(match, 'p2') };
  const tip = (player: PlayerId) => `${PLAYER_NAMES[player]}: ${troops[player].toLocaleString('en-US')} of ${fullTroops().toLocaleString('en-US')} troops left.`;
  return (
    <>
      <div className="resource-bars resource-bars--troops" aria-label="Troops">
        <ResourceBar player="p1" value={troops.p1} max={fullTroops()} active={active === 'p1'} title={tip('p1')} emptyText="NO TROOPS" />
        <span className="resource-bars__label">Troops</span>
        <ResourceBar player="p2" value={troops.p2} max={fullTroops()} active={active === 'p2'} title={tip('p2')} emptyText="NO TROOPS" />
      </div>
      {match.resources && (
        <div className="resource-bars resource-bars--resources" aria-label="Resources">
          {resourceBar(match, 'p1', active)}
          <span className="resource-bars__label">Resources</span>
          {resourceBar(match, 'p2', active)}
        </div>
      )}
    </>
  );
}

function resourceBar(match: MatchState, player: PlayerId, active: PlayerId | null) {
  const value = match.resources![player];
  const max = RESOURCES.startingAmount;
  return (
    <ResourceBar
      player={player}
      value={value}
      max={max}
      active={active === player}
      title={`${PLAYER_NAMES[player]}: ${value.toLocaleString('en-US')} of ${max.toLocaleString('en-US')} Resources. ${RESOURCES_TIP}`}
      emptyText="OUT OF RESOURCES"
    />
  );
}

const CATCH_UP_MS = 700;
const DELTA_MS = 1400;

interface ResourceBarProps {
  player: PlayerId;
  value: number;
  max: number;
  active: boolean;
  title: string;
  emptyText: string;
}

function ResourceBar({ player, value, max, active, title, emptyText }: ResourceBarProps) {
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
      title={title}
    >
      <span className="resource-bar__name">{player === 'p1' ? 'You' : 'Enemy'}</span>
      <div className="resource-bar__track">
        <div className="resource-bar__trail" style={{ width: `${trailShare * 100}%` }} />
        <div className="resource-bar__fill" style={{ width: `${share * 100}%` }} />
        {/* Notches every 10%. */}
        <div className="resource-bar__notches" />
        <span className="resource-bar__value">
          {value <= 0 ? emptyText : value.toLocaleString('en-US')}
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
