import { createPortal } from 'react-dom';
import { normalMaxHp } from '../../engine/queries';
import type { Knight, MatchState } from '../../engine/state';
import {
  PLAYER_NAMES,
  SUBCLASS_ABILITIES,
  SUBCLASS_NAMES,
  TACTIC_NAMES,
  captainName,
  knightArt,
  knightName,
} from '../../data/names';
import { Card } from './Card';
import { TacticIcon } from './TacticIcon';
import '../campaign/captainIcon.css';

const STATUS: Record<Knight['status'], string> = {
  ready: 'Waiting with their Captain',
  fielded: 'On the field',
  unmanned: 'Unmanned slot',
  dead: 'Fallen',
  captured: 'Captured',
};

/**
 * A Knight's details: card, type and ability, HP and Sergeants. As a press-and-hold
 * pop-up it is portaled into `root`; `inline` draws it in place (the slide-in card).
 */
export function KnightDetails({
  match,
  knight,
  at,
  root = null,
  className = '',
  inline = false,
}: {
  match: MatchState;
  knight: Knight;
  at: { x: number; y: number } | null;
  root?: HTMLElement | null;
  className?: string;
  inline?: boolean;
}) {
  if (!at || (!root && !inline)) return null;
  const max = normalMaxHp(knight);
  const ability = knight.subclass ? SUBCLASS_ABILITIES[knight.subclass] : null;
  const card = (
    <div
      className={`captain-details captain-details--${knight.owner} ${className}`}
      role="tooltip"
      style={{ left: at.x, top: at.y }}
    >
      <Card art={knightArt(knight.owner)} size="roster" owner={knight.owner} />
      <div className="captain-details__info">
        <h3 className="captain-details__name">{knightName(knight)}</h3>
        <p className="captain-details__line">
          {PLAYER_NAMES[knight.owner]} · {captainName(match.captains[knight.captainId]!)}
        </p>
        {knight.subclass && ability && (
          <>
            <p className="captain-details__status knight-details__type">
              {SUBCLASS_NAMES[knight.subclass]} · {ability.name}
            </p>
            <p className="captain-details__line knight-details__ability">{ability.text}</p>
          </>
        )}
        <p className="captain-details__line">{STATUS[knight.status]}</p>
        {(knight.status === 'ready' || knight.status === 'fielded') && (
          <>
            <p className="captain-details__line">
              HP {knight.hp} / {max}
              {knight.hp > max ? ` (+${knight.hp - max})` : ''}
              {knight.subclass === 'gatekeeper' ? (knight.braced ? ' · Brace used' : ' · Brace ready') : ''}
            </p>
            <ul className="captain-details__knights">
              {knight.sergeants.map((sg) => (
                <li key={sg.id} className="captain-details__knight">
                  <span>
                    <TacticIcon tactic={sg.tactic} size={12} /> {TACTIC_NAMES[sg.tactic]}
                  </span>
                  <span>{sg.militia} men</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
  return inline ? card : createPortal(card, root!);
}
