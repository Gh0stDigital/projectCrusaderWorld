import { regionPool } from './pools';
import { captainInRegion, knightAt } from '../../engine/queries';
import { REGIONS, SQUARES, type MatchState, type PlayerId, type RegionIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, captainArt, captainName } from '../../data/names';
import { Portrait } from '../components/Portrait';
import { Card } from '../components/Card';
import { useHoldPopover } from '../components/useHoldPopover';
import { SecuredDetails } from './SecuredDetails';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
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
  /** Free Choice with both Captains deployed: the Regions the Lord can play in. */
  playable?: ReadonlySet<RegionIndex>;
  /** Regions that belong to the currently selected Captain (deploy targets or their own Region). */
  selectedRegions?: ReadonlySet<RegionIndex>;
  /** Whether the player is choosing a Region; dims the ones they can't pick. */
  choosing: boolean;
  onClickRegion: (region: RegionIndex) => void;
  labelFor: (region: RegionIndex) => string;
  /** Undo deployment (or Captain choice): a button over that Region's tile, while it's allowed. */
  undo?: { region: RegionIndex; label: string; onUndo: () => void } | null;
}

/**
 * The 3×3 Region board. Each tile shows the Captains stationed there as small
 * portraits, and a large map of its own 3×3 board marked X (Player 1, blue) and
 * O (Player 2, red) so occupied squares read at a glance.
 */
export function RegionBoard({ match, clickable, active, required = null, playable, selectedRegions, choosing, onClickRegion, labelFor, undo }: RegionBoardProps) {
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
          selectedRegions?.has(region) && 'region--selected-choice',
          match.secured[region] && `region--secured region--secured-${match.secured[region]!.player}`,
          match.closed.includes(region) && 'region--closed',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <Fragment key={region}>
          <RegionTile
            match={match}
            region={region}
            className={classes}
            clickable={isClickable}
            onClick={() => onClickRegion(region)}
            label={`${REGION_NAMES[region]}${isClickable ? `, ${labelFor(region)}` : ''}${match.secured[region] ? '. Press and hold for its forces.' : ''}`}
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
            <CapturedBadge match={match} region={region} />
            {regionPool(match, region) > 0 && (
              <span className="region__pool" title="Wager pool between two Captains. Whichever leaves their Region first forfeits it to the other.">
                Pool {regionPool(match, region)}
              </span>
            )}
          </RegionTile>
          {/* Its own button laid over the tile (a button can't sit inside the tile's button). */}
          {undo?.region === region && (
            <button className="btn region__undo" style={cellOf(region)} data-sound="cancel" onClick={undo.onUndo}>
              {undo.label}
            </button>
          )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** A Region's place on the 3×3 grid, so other things can share its cell. */
function cellOf(region: RegionIndex): CSSProperties {
  return { gridRow: Math.floor(region / 3) + 1, gridColumn: (region % 3) + 1 };
}

/** A secured Region: the winning Captain's card, with their side's X or O over it. */
function SecuredMarker({ match, region }: { match: MatchState; region: RegionIndex }) {
  const held = match.secured[region]!;
  const captain = match.captains[held.captainId]!;
  return (
    <span className="region__secured" title={`Secured by ${PLAYER_NAMES[held.player]}: ${captainName(captain)}`}>
      <Card art={captainArt(held.player, captain.lord)} size="company" owner={held.player} />
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
      art={captainArt(player, captain.lord)}
      size={38}
      owner={player}
      title={`${PLAYER_NAMES[player]}: ${captainName(captain)}`}
    />
  );
}

/**
 * One Region tile. Secured Regions stay enabled (but do nothing on click) so
 * they can be pressed and held for the forces holding them.
 */
function RegionTile({
  match,
  region,
  className,
  clickable,
  onClick,
  label,
  children,
}: {
  match: MatchState;
  region: RegionIndex;
  className: string;
  clickable: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  const hold = useHoldPopover<HTMLButtonElement>();
  const held = Boolean(match.secured[region]);
  return (
    <>
      <button
        ref={hold.ref}
        className={className}
        style={cellOf(region)}
        disabled={!clickable && !held}
        aria-disabled={!clickable}
        onClick={() => clickable && onClick()}
        onClickCapture={hold.guardClick}
        aria-label={label}
        {...(held ? hold.handlers : {})}
      >
        {children}
      </button>
      {held && <SecuredDetails match={match} region={region} at={hold.at} root={hold.root()} />}
    </>
  );
}

/** Knights captured in a secured Region and still held: a shackle icon with the count, in the captured side's color. */
function CapturedBadge({ match, region }: { match: MatchState; region: RegionIndex }) {
  const held = match.secured[region];
  if (!held) return null;
  const captured = held.capturedKnightIds.filter((id) => match.knights[id]?.status === 'captured');
  if (captured.length === 0) return null;
  const side = match.knights[captured[0]!]!.owner;
  return (
    <span
      className={`region__captured region__captured--${side}`}
      title={`${captured.length} ${PLAYER_NAMES[side]} Knight${captured.length === 1 ? '' : 's'} captured here`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" strokeWidth="2.5" />
        <rect x="4" y="11" width="16" height="10" rx="2" />
      </svg>
      <span>×{captured.length}</span>
    </span>
  );
}
