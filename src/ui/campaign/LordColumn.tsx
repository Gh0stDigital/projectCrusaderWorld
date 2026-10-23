import { captainsOf } from '../../engine/queries';
import type { LordClass, MatchState, PlayerId } from '../../engine/state';
import { LordCard } from '../components/LordCard';
import './lordColumn.css';

interface LordColumnProps {
  match: MatchState;
  player: PlayerId;
  /** While this player is ordering their Lords: their unconfirmed order, and how to remove a Lord from it. */
  draft?: { order: LordClass[]; remove: (lord: LordClass) => void };
}

/** The player's three Lords in turn order, standing beside the Region board. */
export function LordColumn({ match, player, draft }: LordColumnProps) {
  const order = draft ? draft.order : (match.players[player].lordOrder ?? []);
  const turn = match.turn;

  return (
    <div className={`lord-column lord-column--${player}`}>
      {[0, 1, 2].map((i) => {
        const lord = order[i];
        if (!lord) {
          return (
            <div key={i} className="lord-column__slot">
              <span className="lord-column__slot-number">{i + 1}</span>
            </div>
          );
        }
        const captainsLeft = captainsOf(match, player, lord).filter((c) => c.region === null).length;
        const active = turn?.player === player && turn.lord === lord;
        const card = (
          <LordCard
            lord={lord}
            owner={player}
            position={i + 1}
            active={active}
            captainsLeft={match.phase === 'turns' ? captainsLeft : undefined}
          />
        );
        return draft ? (
          <button
            key={i}
            className="lord-column__draft"
            onClick={() => draft.remove(lord)}
            title="Send back to choose again"
          >
            {card}
          </button>
        ) : (
          <div key={i}>{card}</div>
        );
      })}
    </div>
  );
}
