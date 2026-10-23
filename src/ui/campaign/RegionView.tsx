import { knightAt, legalSquares } from '../../engine/queries';
import { SQUARES, type MatchState, type RegionIndex, type SquareIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES } from '../../data/names';
import { Card } from '../components/Card';
import './regionView.css';

interface RegionViewProps {
  match: MatchState;
  region: RegionIndex;
  selectedKnightId: string | null;
  onPlaceKnight: (square: SquareIndex) => void;
}

/**
 * Zoomed-in view of one Region: its 3×3 board fills the center. The Captains
 * and their Knights appear in the side panels while zoomed in.
 */
export function RegionView({ match, region, selectedKnightId, onPlaceKnight }: RegionViewProps) {
  const turn = match.turn;
  const placingHere =
    turn?.step === 'placement' && turn.captainId !== null && match.captains[turn.captainId]?.region === region;
  const legal = new Set(placingHere && selectedKnightId ? legalSquares(match) : []);

  return (
    <div className="region-view">
      <h2 className="region-view__title">{REGION_NAMES[region]}</h2>
      <div className="inner-board">
        {SQUARES.map((square) => {
          const knight = knightAt(match, region, square);
          const isLegal = legal.has(square);
          return (
            <button
              key={square}
              className={`inner-board__square${isLegal ? ' inner-board__square--legal' : ''}`}
              disabled={!isLegal}
              onClick={() => onPlaceKnight(square)}
              aria-label={
                knight
                  ? `Knight ${knight.number} of ${PLAYER_NAMES[knight.owner]}`
                  : isLegal
                    ? 'Place Knight here'
                    : 'Empty square'
              }
            >
              {knight && (
                <Card art="militia" size="field" owner={knight.owner}>
                  <span className="knight-plate">Knight {knight.number}</span>
                </Card>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
