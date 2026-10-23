import { captainInRegion, knightAt } from '../../engine/queries';
import { REGIONS, SQUARES, type MatchState, type PlayerId, type RegionIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, captainArt, captainName } from '../../data/names';
import { Portrait } from '../components/Portrait';
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

/**
 * The 3×3 Region board. Each tile shows the Captains stationed there as small
 * portraits, and a large map of its own 3×3 board so occupied squares read
 * at a glance.
 */
export function RegionBoard({ match, clickable, active, choosing, onClickRegion, labelFor }: RegionBoardProps) {
  return (
    <div className={`region-board${choosing ? ' region-board--choosing' : ''}`}>
      {REGIONS.map((region) => {
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
            <span className="region__header">
              <CaptainMarker match={match} region={region} player="p1" />
              <span className="region__name">{REGION_NAMES[region]}</span>
              <CaptainMarker match={match} region={region} player="p2" />
            </span>

            <span className="region__map" aria-hidden="true">
              {SQUARES.map((square) => {
                const knight = knightAt(match, region, square);
                return knight ? (
                  <Portrait key={square} art="militia" size={50} owner={knight.owner} />
                ) : (
                  <span key={square} className="region__map-square" />
                );
              })}
            </span>

            {isClickable && <span className="region__action">{labelFor(region)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function CaptainMarker({ match, region, player }: { match: MatchState; region: RegionIndex; player: PlayerId }) {
  const captain = captainInRegion(match, region, player);
  if (!captain) return <span className={`region__captain-empty region__captain-empty--${player}`} />;
  return (
    <Portrait
      art={captainArt(player)}
      size={38}
      owner={player}
      title={`${PLAYER_NAMES[player]}: ${captainName(captain)}`}
    />
  );
}
