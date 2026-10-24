import { attackTargets, knightAt, legalSquares } from '../../engine/queries';
import { SQUARES, type MatchState, type RegionIndex, type SquareIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, knightName, knightPersonalName } from '../../data/names';
import { KnightSprite } from '../components/KnightSprite';
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
            ? `${knightName(knight)} of ${PLAYER_NAMES[knight.owner]}, ${knight.hp} HP${isTarget ? ', attack' : ''}`
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
              {!knight && isLegal && (
                <span className="route-preview">
                  Sends enemy to
                  <br />
                  {REGION_NAMES[square]}
                </span>
              )}
              {knight && (
                <span className={`board-piece board-piece--${knight.owner}`}>
                  <KnightSprite owner={knight.owner} width={128} animate title={knightName(knight)} />
                  <span className="hp-badge">{knight.hp}</span>
                  <span className="knight-plate">{knightPersonalName(knight)}</span>
                  {isTarget && <span className="attack-marker">Attack</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
