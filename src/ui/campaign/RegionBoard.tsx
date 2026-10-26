import { captainInRegion, knightAt } from '../../engine/queries';
import { REGIONS, SQUARES, type MatchState, type PlayerId, type RegionIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, captainArt, captainName } from '../../data/names';
import { Portrait } from '../components/Portrait';
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
  /** The Region the opponent's last placement sent this player to, if routing applies. */
  required?: RegionIndex | null;
  /** Control Move with both Captains deployed: the Regions the Lord can play in. */
  playable?: ReadonlySet<RegionIndex>;
  /** Whether the player is choosing a Region; dims the ones they can't pick. */
  choosing: boolean;
  onClickRegion: (region: RegionIndex) => void;
  labelFor: (region: RegionIndex) => string;
}

/**
 * The 3×3 Region board. Each tile shows the Captains stationed there as small
 * portraits, and a large map of its own 3×3 board marked X (Player 1, blue) and
 * O (Player 2, red) so occupied squares read at a glance.
 */
export function RegionBoard({ match, clickable, active, required = null, playable, choosing, onClickRegion, labelFor }: RegionBoardProps) {
  return (
    <div className={`region-board${choosing ? ' region-board--choosing' : ''}`}>
      {REGIONS.map((region) => {
        const isClickable = clickable.has(region);
        const classes = [
          'region',
          isClickable && 'region--open',
          active === region && 'region--active',
          required === region && 'region--required',
          playable?.has(region) && 'region--playable',
          match.secured[region] && `region--secured region--secured-${match.secured[region]!.player}`,
          match.closed.includes(region) && 'region--closed',
        ]
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
                return (
                  <span key={square} className="region__map-square">
                    {knight && <Mark player={knight.owner} />}
                  </span>
                );
              })}
            </span>

            {match.secured[region] && <SecuredMarker match={match} region={region} />}
            {match.closed.includes(region) && <span className="region__closed">Stalemate · closed</span>}
            {required === region && <span className="region__required">Fated Move · play here</span>}
            {playable?.has(region) && <span className="region__required region__required--playable">Playable</span>}
            {isClickable && <span className="region__action">{labelFor(region)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A secured Region: the winning Captain's card, with their side's X or O over it. */
function SecuredMarker({ match, region }: { match: MatchState; region: RegionIndex }) {
  const held = match.secured[region]!;
  const captain = match.captains[held.captainId]!;
  return (
    <span className="region__secured" title={`Secured by ${PLAYER_NAMES[held.player]}: ${captainName(captain)}`}>
      <Card art={captainArt(held.player)} size="company" owner={held.player} />
      <span className="region__secured-mark">
        <Mark player={held.player} />
      </span>
    </span>
  );
}

/** Tic-tac-toe mark for a Knight on the Region map: X for Player 1, O for Player 2. */
function Mark({ player }: { player: PlayerId }) {
  return (
    <svg className={`region__mark region__mark--${player}`} viewBox="0 0 40 40" aria-hidden="true">
      {player === 'p1' ? (
        <path d="M9 9 L31 31 M31 9 L9 31" />
      ) : (
        <circle cx="20" cy="20" r="12" />
      )}
    </svg>
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
