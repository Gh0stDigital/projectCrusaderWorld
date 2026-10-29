import { lordMilitia } from '../../engine/queries';
import { createMatch } from '../../engine/setup';
import { LORD_RESERVE, type LordClass, type MatchState, type PlayerId } from '../../engine/state';
import { formatMilitia } from '../../data/names';
import './lordBars.css';

/** What a Lord starts the match with: a full militia bar. The same for every Lord. */
let startingMilitia: number | null = null;
function fullMilitia(): number {
  startingMilitia ??= lordMilitia(createMatch(), 'p1', 'army');
  return startingMilitia;
}

/** A Lord's militia and reserve as two slim health bars, sized against what they started with. */
export function LordBars({ match, player, lord }: { match: MatchState; player: PlayerId; lord: LordClass }) {
  return (
    <div className="lord-bars">
      <LordBar label="Militia" value={lordMilitia(match, player, lord)} max={fullMilitia()} />
      <LordBar label="Reserve" value={match.players[player].lordReserves[lord]} max={LORD_RESERVE} reserve />
    </div>
  );
}

function LordBar({ label, value, max, reserve = false }: { label: string; value: number; max: number; reserve?: boolean }) {
  const share = Math.max(0, Math.min(1, value / max));
  const level = value <= 0 ? 'out' : share < 0.25 ? 'low' : share < 0.5 ? 'mid' : 'high';
  return (
    <div
      className={`lord-bar lord-bar--${level}${reserve ? ' lord-bar--reserve' : ''}`}
      title={`${label}: ${formatMilitia(value)} of ${formatMilitia(max)} at the start`}
    >
      <span className="lord-bar__label">{label}</span>
      <div className="lord-bar__track">
        <div className="lord-bar__fill" style={{ width: `${share * 100}%` }} />
        <span className="lord-bar__value">{formatMilitia(value)}</span>
      </div>
    </div>
  );
}
