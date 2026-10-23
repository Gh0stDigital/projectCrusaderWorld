import { attackTargets, knightAt, legalSquares } from '../../engine/queries';
import { SQUARES, type MatchState, type RegionIndex, type SquareIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES } from '../../data/names';
import { Card } from '../components/Card';
import './regionView.css';

interface RegionViewProps {
  match: MatchState;
  region: RegionIndex;
  selectedKnightId: string | null;
  onPlaceKnight: (square: SquareIndex) => void;
  onChooseTarget: (knightId: string) => void;
}

/**
 * Zoomed-in view of one Region: its 3×3 board fills the center. The Captains
 * and their Knights appear in the side panels while zoomed in.
 */
export function RegionView({ match, region, selectedKnightId, onPlaceKnight, onChooseTarget }: RegionViewProps) {
  const turn = match.turn;
  const placingHere =
    turn?.step === 'placement' && turn.captainId !== null && match.captains[turn.captainId]?.region === region;
  const legal = new Set(placingHere && selectedKnightId ? legalSquares(match) : []);
  const targets = new Set(attackTargets(match).map((k) => k.id));
  const attackerId = turn?.step === 'attack' ? turn.placedKnightId : null;

  return (
    <div className="region-view">
      <h2 className="region-view__title">{REGION_NAMES[region]}</h2>
      <div className="inner-board">
        {SQUARES.map((square) => {
          const knight = knightAt(match, region, square);
          const isLegal = legal.has(square);
          const isTarget = knight !== null && targets.has(knight.id);
          const isAttacker = knight !== null && knight.id === attackerId;
          const classes = [
            'inner-board__square',
            isLegal && 'inner-board__square--legal',
            isTarget && 'inner-board__square--target',
            isAttacker && 'inner-board__square--attacker',
          ]
            .filter(Boolean)
            .join(' ');
          const label = knight
            ? `Knight ${knight.number} of ${PLAYER_NAMES[knight.owner]}, ${knight.hp} HP${isTarget ? ', attack' : ''}`
            : isLegal
              ? 'Place Knight here'
              : 'Empty square';
          return (
            <button
              key={square}
              className={classes}
              disabled={!isLegal && !isTarget}
              onClick={() => (isTarget ? onChooseTarget(knight.id) : onPlaceKnight(square))}
              aria-label={label}
            >
              {knight && (
                <Card art="militia" size="field" owner={knight.owner}>
                  <span className="hp-badge">{knight.hp}</span>
                  <span className="knight-plate">Knight {knight.number}</span>
                  {isTarget && <span className="attack-marker">Attack</span>}
                </Card>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
