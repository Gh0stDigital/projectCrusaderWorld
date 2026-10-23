import { captainsInRegion, knightAt } from '../../engine/queries';
import { PLAYERS, REGIONS, SQUARES, type MatchState, type RegionIndex } from '../../engine/state';
import { REGION_NAMES, captainName } from '../../data/names';
import { Card } from '../components/Card';
import './regionBoard.css';

export const REGION_TILE = 260;
export const REGION_GAP = 14;
export const REGION_BOARD_SIZE = REGION_TILE * 3 + REGION_GAP * 2;

interface RegionBoardProps {
  match: MatchState;
  /** Regions that can be clicked right now (to deploy, resume, or enter). */
  clickable: ReadonlySet<RegionIndex>;
  /** The Region the current turn is happening in, if any. */
  active: RegionIndex | null;
  /** Whether the player is choosing a Region; dims the ones they can't pick. */
  choosing: boolean;
  onClickRegion: (region: RegionIndex) => void;
  labelFor: (region: RegionIndex) => string;
}

/** The 3×3 Region board. Each Region holds at most one Captain per player and its own 3×3 board. */
export function RegionBoard({ match, clickable, active, choosing, onClickRegion, labelFor }: RegionBoardProps) {
  return (
    <div className={`region-board${choosing ? ' region-board--choosing' : ''}`}>
      {REGIONS.map((region) => {
        const captains = captainsInRegion(match, region);
        const isClickable = clickable.has(region);
        const classes = ['region', isClickable && 'region--open', active === region && 'region--active']
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={region}
            className={classes}
            disabled={!isClickable}
            onClick={() => onClickRegion(region)}
            aria-label={`${REGION_NAMES[region]}${isClickable ? `, ${labelFor(region)}` : ''}`}
          >
            <span className="region__name">{REGION_NAMES[region]}</span>
            <span className="region__body">
              {PLAYERS.map((player) => {
                const captain = captains.find((c) => c.owner === player);
                return (
                  <span key={player} className={`region__slot region__slot--${player}`}>
                    {captain && (
                      <>
                        <Card art="militia" size="panel" owner={player} alt={captainName(captain.lord, captain.rank)} />
                        <span className="region__captain-name">{captainName(captain.lord, captain.rank)}</span>
                      </>
                    )}
                  </span>
                );
              })}
              <span className="region__mini" aria-hidden="true">
                {SQUARES.map((square) => {
                  const knight = knightAt(match, region, square);
                  return <span key={square} className={`region__mini-square${knight ? ` region__mini-square--${knight.owner}` : ''}`} />;
                })}
              </span>
            </span>
            {isClickable && <span className="region__action">{labelFor(region)}</span>}
          </button>
        );
      })}
    </div>
  );
}
