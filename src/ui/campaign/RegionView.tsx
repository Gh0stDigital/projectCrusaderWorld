import { captainInRegion, knightAt, knightsOf, legalSquares } from '../../engine/queries';
import { SQUARES, type Captain, type MatchState, type PlayerId, type RegionIndex, type SquareIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, captainName } from '../../data/names';
import { Card } from '../components/Card';
import './regionView.css';

interface RegionViewProps {
  match: MatchState;
  region: RegionIndex;
  selectedKnightId: string | null;
  onSelectKnight: (id: string) => void;
  onPlaceKnight: (square: SquareIndex) => void;
}

/**
 * Zoomed-in view of one Region: its 3×3 board in the middle, each player's
 * Captain standing on their own side (Player 1 left, Player 2 right) with
 * their Knights below.
 */
export function RegionView({ match, region, selectedKnightId, onSelectKnight, onPlaceKnight }: RegionViewProps) {
  const turn = match.turn;
  const placingHere = turn?.step === 'placement' && turn.captainId !== null && match.captains[turn.captainId]?.region === region;
  const legal = new Set(placingHere ? legalSquares(match) : []);
  const canPlace = placingHere && selectedKnightId !== null;

  return (
    <div className="region-view">
      <CaptainSide
        match={match}
        player="p1"
        captain={captainInRegion(match, region, 'p1')}
        selectedKnightId={selectedKnightId}
        onSelectKnight={onSelectKnight}
      />

      <div className="region-view__center">
        <h2 className="region-view__title">{REGION_NAMES[region]}</h2>
        <div className="inner-board">
          {SQUARES.map((square) => {
            const knight = knightAt(match, region, square);
            const isLegal = canPlace && legal.has(square);
            return (
              <button
                key={square}
                className={`inner-board__square${isLegal ? ' inner-board__square--legal' : ''}`}
                disabled={!isLegal}
                onClick={() => onPlaceKnight(square)}
                aria-label={knight ? `Knight ${knight.number} of ${PLAYER_NAMES[knight.owner]}` : isLegal ? 'Place Knight here' : 'Empty square'}
              >
                {knight && (
                  <Card art="militia" size="board" owner={knight.owner}>
                    <span className="knight-plate">Knight {knight.number}</span>
                  </Card>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <CaptainSide
        match={match}
        player="p2"
        captain={captainInRegion(match, region, 'p2')}
        selectedKnightId={selectedKnightId}
        onSelectKnight={onSelectKnight}
      />
    </div>
  );
}

interface CaptainSideProps {
  match: MatchState;
  player: PlayerId;
  captain: Captain | null;
  selectedKnightId: string | null;
  onSelectKnight: (id: string) => void;
}

/** A Captain's card with their six Knights in two columns of three underneath. */
function CaptainSide({ match, player, captain, selectedKnightId, onSelectKnight }: CaptainSideProps) {
  const turn = match.turn;
  if (!captain) {
    return (
      <div className={`captain-side captain-side--${player} captain-side--empty`}>
        <div className="captain-side__vacant">
          <span>{PLAYER_NAMES[player]}</span>
          <span className="captain-side__vacant-hint">No Captain here</span>
        </div>
      </div>
    );
  }

  const acting = turn?.captainId === captain.id;
  const picking = acting && turn?.step === 'placement';

  return (
    <div className={`captain-side captain-side--${player}${acting ? ' captain-side--acting' : ''}`}>
      <Card art="militia" size="board" owner={player} alt={captainName(captain.lord, captain.rank)}>
        <span className="knight-plate">{captainName(captain.lord, captain.rank)}</span>
      </Card>

      <ul className="captain-side__knights">
        {knightsOf(match, captain.id).map((knight) => {
          const waiting = knight.position === null;
          const selected = selectedKnightId === knight.id;
          const classes = [
            'knight-slot',
            !waiting && 'knight-slot--fielded',
            picking && waiting && 'knight-slot--pickable',
            selected && 'knight-slot--selected',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={knight.id}>
              <button
                className={classes}
                disabled={!(picking && waiting)}
                onClick={() => onSelectKnight(knight.id)}
                aria-label={`Knight ${knight.number}${waiting ? '' : ', on the field'}`}
              >
                <Card art="militia" size="panel" owner={player} />
                <span className="knight-slot__label">{waiting ? `Knight ${knight.number}` : 'In the field'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
