import { captainInRegion, canPlaceNow, captainMilitia, knightsOf } from '../../engine/queries';
import type { Knight, MatchState, PlayerId, RegionIndex } from '../../engine/state';
import {
  REGION_NAMES,
  captainArt,
  captainName,
  captainPersonalName,
  formatMilitia,
  knightName,
  knightPersonalName,
  lordPersona,
  SUBCLASS_SHORT,
} from '../../data/names';
import { Card } from '../components/Card';
import { KnightDetails } from '../components/KnightDetails';
import { useHoldPopover } from '../components/useHoldPopover';
import type { ReactNode } from 'react';
import { KnightSprite } from '../components/KnightSprite';
import './companyView.css';

interface CompanyViewProps {
  match: MatchState;
  player: PlayerId;
  region: RegionIndex;
  selectedKnightId: string | null;
  onSelectKnight: (id: string) => void;
}

const STATUS_LABEL: Record<Knight['status'], string> = {
  ready: 'Ready',
  fielded: 'In the field',
  unmanned: 'Unmanned',
  dead: 'Fallen',
  captured: 'Captured',
};

/**
 * Shown in a player's side panel while zoomed into a Region: their Captain
 * stationed there as a large portrait, and their six Knights as simple tokens.
 * Knight cards only appear on the Region's board itself.
 */
export function CompanyView({ match, player, region, selectedKnightId, onSelectKnight }: CompanyViewProps) {
  const captain = captainInRegion(match, region, player);
  const turn = match.turn;

  if (!captain) {
    return (
      <div className="company company--empty">
        <p className="company__where">In {REGION_NAMES[region]}</p>
        <div className={`company__vacant company__vacant--${player}`}>No Captain stationed here</div>
      </div>
    );
  }

  const acting = turn?.captainId === captain.id;
  const picking = acting && canPlaceNow(match);

  return (
    <div className="company">
      <p className="company__where">In {REGION_NAMES[region]}</p>

      <div className={`company__captain${acting ? ' company__captain--acting' : ''}`}>
        <Card art={captainArt(player, captain.lord)} size="detail" owner={player} alt={captainName(captain)} />
        <div className="company__captain-info">
          <h3 className="company__captain-name">{captainPersonalName(captain)}</h3>
          <p className="company__captain-lord">{lordPersona(player, captain.lord).name}</p>
          {acting && <span className="company__badge">{picking ? 'Choose a Knight' : 'Orders given'}</span>}
          <dl className="company__stats">
            <dt>Militia</dt>
            <dd>{formatMilitia(captainMilitia(match, captain.id))}</dd>
            <dt>Reserve</dt>
            <dd>{formatMilitia(captain.reserve)}</dd>
          </dl>
        </div>
      </div>

      <ul className="company__knights">
        {knightsOf(match, captain.id).map((knight) => {
          const pickable = picking && knight.status === 'ready';
          const alive = knight.status === 'ready' || knight.status === 'fielded';
          const classes = [
            'knight-token',
            `knight-token--${knight.status}`,
            `knight-token--${player}`,
            pickable && 'knight-token--pickable',
            selectedKnightId === knight.id && 'knight-token--selected',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <HoldableToken
              key={knight.id}
              match={match}
              knight={knight}
              className={classes}
              pickable={pickable}
              onPick={() => onSelectKnight(knight.id)}
              label={`${knightName(knight)}: ${STATUS_LABEL[knight.status]}${alive ? `, ${knight.hp} HP` : ''}. Press and hold for details.`}
            >
                <span className="knight-token__icon">
                  <KnightSprite owner={player} width={44} />
                  <span className="knight-token__number">{knight.number}</span>
                </span>
                <span className="knight-token__text">
                  <span className="knight-token__name">
                    {knight.status === 'unmanned' ? 'Empty slot' : knightPersonalName(knight)}
                  </span>
                  <span className="knight-token__detail">
                    {alive
                      ? `${knight.hp} HP${knight.subclass ? ` · ${SUBCLASS_SHORT[knight.subclass]}` : knight.status === 'fielded' ? ' · fld' : ''}`
                      : STATUS_LABEL[knight.status]}
                  </span>
                </span>
            </HoldableToken>
          );
        })}
      </ul>
    </div>
  );
}

/** A Knight token: click to choose (when allowed), press and hold for details. */
function HoldableToken({
  match,
  knight,
  className,
  pickable,
  onPick,
  label,
  children,
}: {
  match: MatchState;
  knight: Knight;
  className: string;
  pickable: boolean;
  onPick: () => void;
  label: string;
  children: ReactNode;
}) {
  const hold = useHoldPopover<HTMLButtonElement>();
  return (
    <li>
      <button
        ref={hold.ref}
        className={className}
        aria-disabled={!pickable}
        onClick={() => pickable && onPick()}
        onClickCapture={hold.guardClick}
        aria-label={label}
        {...hold.handlers}
      >
        {children}
      </button>
      <KnightDetails match={match} knight={knight} at={hold.at} root={hold.root()} />
    </li>
  );
}
