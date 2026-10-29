import { attackTargets, attackers, knightAt, legalSquares, moveSquares, movers, normalMaxHp } from '../../engine/queries';
import { SQUARES, type MatchState, type RegionIndex, type SquareIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, SUBCLASS_NAMES, captainName, knightName, knightPersonalName } from '../../data/names';
import { knightPool } from './pools';
import { KnightSprite } from '../components/KnightSprite';
import { KnightDetails } from '../components/KnightDetails';
import { useHoldPopover } from '../components/useHoldPopover';
import type { ReactNode } from 'react';
import type { Knight } from '../../engine/state';
import type { Departure } from '../../store/matchStore';
import './regionView.css';

interface RegionViewProps {
  match: MatchState;
  region: RegionIndex;
  selectedKnightId: string | null;
  onPlaceKnight: (square: SquareIndex) => void;
  onChooseTarget: (knightId: string) => void;
  /** Pick one of your Knights on the board, to attack with or move. */
  onSelectAttacker: (knightId: string) => void;
  /** Move the selected Knight on the board to this square. */
  onMoveKnight: (square: SquareIndex) => void;
  /** A defeated Knight leaving the board, drawn on its old square while it animates away. */
  departure?: Departure | null;
  /** Take back this turn's placement or move: a button beside the board, while it's allowed. */
  undo?: { label: string; onUndo: () => void } | null;
}

/**
 * Zoomed-in view of one Region: its 3×3 board fills the center. The Captains
 * and their Knights appear in the side panels while zoomed in.
 */
export function RegionView({ match, region, selectedKnightId, onPlaceKnight, onChooseTarget, onSelectAttacker, onMoveKnight, departure, undo }: RegionViewProps) {
  const turn = match.turn;
  const actingHere = turn?.captainId != null && match.captains[turn.captainId]?.region === region;
  const selected = selectedKnightId ? match.knights[selectedKnightId] : undefined;
  // A waiting Knight is selected: show where it can go. One on the board: show who it can attack.
  const legal = new Set(actingHere && selected?.status === 'ready' ? legalSquares(match) : []);
  const canAttack = new Set(actingHere ? attackers(match).map((k) => k.id) : []);
  const canMove = new Set(actingHere ? movers(match).map((k) => k.id) : []);
  const attackerId = selected && canAttack.has(selected.id) ? selected.id : null;
  const targets = new Set(attackTargets(match, attackerId).map((k) => k.id));
  // A Knight on the board that can move: the empty squares it can step to.
  const moveTo = new Set(selected && canMove.has(selected.id) ? moveSquares(match, selected.id) : []);

  return (
    <div className="region-view">
      <h2 className="region-view__title">{REGION_NAMES[region]}</h2>
      {match.secured[region] && (
        <p className={`region-view__secured region-view__secured--${match.secured[region]!.player}`}>
          Secured by {PLAYER_NAMES[match.secured[region]!.player]}:{' '}
          {captainName(match.captains[match.secured[region]!.captainId]!)}
        </p>
      )}
      {undo && actingHere && (
        <button className="btn region-view__undo" onClick={undo.onUndo}>
          {undo.label}
        </button>
      )}
      <div className="inner-board">
        {SQUARES.map((square) => {
          const knight = knightAt(match, region, square);
          const isLegal = legal.has(square);
          const isTarget = knight !== null && targets.has(knight.id);
          const isAttacker = knight !== null && (knight.id === attackerId || (knight.id === selected?.id && canMove.has(knight.id)));
          const mayAttack = knight !== null && (canAttack.has(knight.id) || canMove.has(knight.id)) && !isAttacker;
          const isMove = !knight && moveTo.has(square);
          const classes = [
            'inner-board__square',
            (isLegal || isMove) && 'inner-board__square--legal',
            isMove && 'inner-board__square--move',
            isTarget && 'inner-board__square--target',
            isAttacker && 'inner-board__square--attacker',
            mayAttack && 'inner-board__square--may-attack',
          ]
            .filter(Boolean)
            .join(' ');
          const label = knight
            ? `${knightName(knight)} of ${PLAYER_NAMES[knight.owner]}, ${knight.hp} HP${isTarget ? ', attack' : ''}`
            : isMove
              ? 'Move Knight here'
              : isLegal
              ? 'Place Knight here'
              : 'Empty square';
          return (
            <button
              key={square}
              className={classes}
              disabled={!isLegal && !isMove && !isTarget && !knight}
              aria-disabled={!isLegal && !isMove && !isTarget && !mayAttack}
              onClick={() =>
                isTarget
                  ? onChooseTarget(knight.id)
                  : mayAttack
                    ? onSelectAttacker(knight.id)
                    : isMove
                      ? onMoveKnight(square)
                      : isLegal
                        ? onPlaceKnight(square)
                        : undefined
              }
              aria-label={label}
            >
              {!knight && departure && departure.region === region && departure.square === square && (
                <span
                  className={`board-piece board-piece--${departure.owner} board-piece--departing board-piece--${departure.fate}`}
                  aria-label={departure.fate === 'killed' ? 'Knight destroyed' : 'Knight retreating'}
                >
                  <KnightSprite owner={departure.owner} width={128} variant="board" />
                  <span className="knight-plate">{knightPersonalName(match.knights[departure.knightId]!)}</span>
                  {departure.fate === 'killed' && <span className="board-piece__x" aria-hidden="true">✕</span>}
                  <span className="board-piece__fate">{departure.fate === 'killed' ? 'Destroyed' : 'Retreats'}</span>
                </span>
              )}
              {!knight && (isLegal || isMove) && (
                <span className="route-preview">
                  Sends enemy to
                  <br />
                  {REGION_NAMES[square]}
                </span>
              )}
              {knight && (
                <HoldablePiece match={match} knight={knight} selected={knight.id === selectedKnightId}>
                  <KnightSprite owner={knight.owner} width={128} animate title={knightName(knight)} variant="board" />
                  <span className={`hp-badge${knight.hp > normalMaxHp(knight) ? ' hp-badge--over' : ''}`}>{knight.hp}</span>
                  <span className="knight-plate">{knightPersonalName(knight)}</span>
                  {knight.subclass && <span className={`type-badge type-badge--${knight.subclass}`}>{SUBCLASS_NAMES[knight.subclass]}</span>}
                  {knightPool(match, knight.id) > 0 && (
                    <span className="pool-badge" title="Wager pool: Resources lost in a battle here. Whichever Knight leaves its square first forfeits it to the other.">
                      Pool {knightPool(match, knight.id)}
                    </span>
                  )}
                  {isTarget && <span className="attack-marker">Attack</span>}
                  {mayAttack && (
                    <span className="attack-marker attack-marker--ready">{canAttack.has(knight.id) ? 'Can attack' : 'Can move'}</span>
                  )}
                </HoldablePiece>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A Knight standing on a square; press and hold for its details. */
function HoldablePiece({ match, knight, selected, children }: { match: MatchState; knight: Knight; selected: boolean; children: ReactNode }) {
  // The selected Knight's details are in the slide-in card, so holding it does nothing.
  const hold = useHoldPopover<HTMLSpanElement>(selected);
  return (
    <span
      ref={hold.ref}
      className={`board-piece board-piece--${knight.owner}`}
      onClickCapture={hold.guardClick}
      {...hold.handlers}
    >
      {children}
      <KnightDetails match={match} knight={knight} at={hold.at} root={hold.root()} />
    </span>
  );
}
