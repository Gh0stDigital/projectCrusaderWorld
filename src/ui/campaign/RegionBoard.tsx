import { captainsInRegion, regionsOpenTo } from '../../engine/queries';
import { PLAYERS, REGIONS, type MatchState, type RegionIndex } from '../../engine/state';
import { REGION_NAMES, captainName } from '../../data/names';
import { Card } from '../components/Card';
import './regionBoard.css';

interface RegionBoardProps {
  match: MatchState;
  /** Called when the player picks a Region for the selected Captain. Null while nothing can be deployed. */
  onChooseRegion: ((region: RegionIndex) => void) | null;
}

/** The 3×3 Region board. Each Region holds at most one Captain per player. */
export function RegionBoard({ match, onChooseRegion }: RegionBoardProps) {
  const open = onChooseRegion && match.turn ? new Set(regionsOpenTo(match, match.turn.player)) : new Set();

  return (
    <div className={`region-board${onChooseRegion ? ' region-board--choosing' : ''}`}>
      {REGIONS.map((region) => {
        const captains = captainsInRegion(match, region);
        const isOpen = open.has(region);
        return (
          <button
            key={region}
            className={`region${isOpen ? ' region--open' : ''}`}
            disabled={!isOpen}
            onClick={() => onChooseRegion?.(region)}
            aria-label={`${REGION_NAMES[region]}${isOpen ? ', deploy here' : ''}`}
          >
            <span className="region__name">{REGION_NAMES[region]}</span>
            <span className="region__captains">
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
            </span>
          </button>
        );
      })}
    </div>
  );
}
