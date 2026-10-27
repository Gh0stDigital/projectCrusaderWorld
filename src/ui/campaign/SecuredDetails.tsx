import { createPortal } from 'react-dom';
import { captainMilitia, knightsOf, normalMaxHp, sergeantMilitia } from '../../engine/queries';
import type { MatchState, RegionIndex } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, SUBCLASS_LORD, SUBCLASS_NAMES, captainArt, captainName, knightPersonalName } from '../../data/names';
import { Card } from '../components/Card';
import './captainIcon.css';
import './securedDetails.css';

/**
 * Press-and-hold details for a secured Region: the Captain holding it, their
 * men, and every Knight they still have, HP first. Also the enemy Knights held
 * captive there.
 */
export function SecuredDetails({
  match,
  region,
  at,
  root,
}: {
  match: MatchState;
  region: RegionIndex;
  at: { x: number; y: number } | null;
  root: HTMLElement | null;
}) {
  const held = match.secured[region];
  if (!at || !root || !held) return null;
  const captain = match.captains[held.captainId]!;
  const knights = knightsOf(match, captain.id).filter((k) => k.status === 'ready' || k.status === 'fielded');
  const captives = held.capturedKnightIds.filter((id) => match.knights[id]?.status === 'captured');
  const here = captain.region === region;

  return createPortal(
    <div
      className={`captain-details secured-details captain-details--${held.player}`}
      role="tooltip"
      style={{ left: Math.min(at.x, root.offsetWidth - 470), top: Math.min(at.y, root.offsetHeight - 520) }}
    >
      <div className="secured-details__head">
        <Card art={captainArt(captain.owner, captain.lord)} size="company" owner={captain.owner} />
        <div className="captain-details__info">
          <h3 className="captain-details__name">{REGION_NAMES[region]}</h3>
          <p className="captain-details__line">
            Secured by {PLAYER_NAMES[held.player]}
          </p>
          <p className="captain-details__line">
            {captainName(captain)}
            {here ? '' : captain.fallen ? ' (fallen)' : ' (away)'}
          </p>
          <p className="secured-details__men">
            {captainMilitia(match, captain.id)} <span>men</span>
          </p>
          <p className="captain-details__line">Reserve {captain.reserve}</p>
        </div>
      </div>

      <ul className="secured-details__knights">
        {knights.map((k) => {
          const max = normalMaxHp(k);
          return (
            <li key={k.id} className="secured-details__knight">
              <div className="secured-details__row">
                <span className="secured-details__name">{knightPersonalName(k)}</span>
                {k.subclass && (
                  <span className={`knight-token__type knight-token__type--${SUBCLASS_LORD[k.subclass]}`}>
                    {SUBCLASS_NAMES[k.subclass]}
                  </span>
                )}
                <span className="secured-details__hp">
                  {k.hp}
                  <small> / {max} HP</small>
                </span>
              </div>
              <div className="hp-bar secured-details__bar">
                <div className="hp-bar__fill" style={{ width: `${Math.min(100, (k.hp / Math.max(1, max)) * 100)}%` }} />
              </div>
              <p className="secured-details__sub">
                {k.sergeants.length} Sergeants · {sergeantMilitia(k)} men ·{' '}
                {k.status === 'fielded' ? `on the board in ${REGION_NAMES[k.position!.region]}` : 'waiting'}
              </p>
            </li>
          );
        })}
        {knights.length === 0 && <li className="secured-details__sub">No Knights left.</li>}
      </ul>

      {captives.length > 0 && (
        <p className="secured-details__captives">
          Holding captive: {captives.map((id) => knightPersonalName(match.knights[id]!)).join(', ')}
        </p>
      )}
    </div>,
    root,
  );
}
