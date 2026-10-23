import type { Knight, MatchState } from '../../engine/state';
import { PLAYER_NAMES, captainName } from '../../data/names';
import { sergeantMilitia } from '../../engine/queries';
import { Card } from '../components/Card';
import { SergeantBox, TacticLegend } from '../components/SergeantBox';
import './attackPreview.css';

interface AttackPreviewProps {
  match: MatchState;
  attacker: Knight;
  defender: Knight;
  onCancel: () => void;
  onCommence: () => void;
}

/** Both Knights side by side before the player commits to an attack. */
export function AttackPreview({ match, attacker, defender, onCancel, onCommence }: AttackPreviewProps) {
  return (
    <div className="attack-preview" role="dialog" aria-modal="true" aria-labelledby="attack-preview-title">
      <div className="attack-preview__window">
        <h2 id="attack-preview-title" className="attack-preview__title">
          Attack?
        </h2>

        <div className="attack-preview__sides">
          <KnightSummary match={match} knight={attacker} role="Your Knight" />
          <span className="attack-preview__versus">vs</span>
          <KnightSummary match={match} knight={defender} role="Enemy Knight" />
        </div>

        <p className="attack-preview__rules">
          Up to five clashes. Each side secretly sends one Sergeant per clash; the winning tactic deals its men as
          damage. The Knight with less HP at the end is driven from the field.
        </p>
        <TacticLegend />

        <div className="attack-preview__actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={onCommence} autoFocus>
            Commence attack
          </button>
        </div>
      </div>
    </div>
  );
}

function KnightSummary({ match, knight, role }: { match: MatchState; knight: Knight; role: string }) {
  const captain = match.captains[knight.captainId]!;
  return (
    <div className={`knight-summary knight-summary--${knight.owner}`}>
      <span className="knight-summary__role">{role}</span>
      <div className="knight-summary__top">
        <Card art="militia" size="roster" owner={knight.owner} />
        <div className="knight-summary__info">
          <h3 className="knight-summary__name">Knight {knight.number}</h3>
          <p className="knight-summary__line">{PLAYER_NAMES[knight.owner]}</p>
          <p className="knight-summary__line">{captainName(captain)}</p>
          <p className="knight-summary__hp">
            {knight.hp} <span>HP</span>
          </p>
          <p className="knight-summary__line">
            {knight.sergeants.length} Sergeants · {sergeantMilitia(knight)} men
          </p>
        </div>
      </div>
      <div className="knight-summary__sergeants">
        {knight.sergeants.length === 0 && <span className="knight-summary__line">No Sergeants left</span>}
        {knight.sergeants.map((s) => (
          <SergeantBox key={s.id} tactic={s.tactic} militia={s.militia} compact />
        ))}
      </div>
    </div>
  );
}
