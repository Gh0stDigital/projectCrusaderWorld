import { normalMaxHp } from '../../engine/queries';
import type { MatchState } from '../../engine/state';
import { PLAYER_NAMES, captainName, knightName } from '../../data/names';
import { KnightSprite } from '../components/KnightSprite';
import './attackPreview.css';

export interface EnemyReinforcement {
  knightId: string;
  amount: number;
  /** The Knight's HP before the men arrived. */
  hpBefore: number;
}

/**
 * The human attacked and the computer sent reserve men to its Knight: shown
 * before the battle screen opens, so the odds are known going in.
 */
export function ReinforcementNotice({
  match,
  notice,
  onContinue,
}: {
  match: MatchState;
  notice: EnemyReinforcement;
  onContinue: () => void;
}) {
  const knight = match.knights[notice.knightId]!;
  const captain = match.captains[knight.captainId]!;
  const over = knight.hp - normalMaxHp(knight);
  return (
    <div className="attack-preview" role="dialog" aria-modal="true" aria-labelledby="reinforcement-title">
      <div className="attack-preview__window reinforcement-notice">
        <h2 id="reinforcement-title" className="attack-preview__title">
          Enemy reinforcements!
        </h2>
        <div className="reinforcement-notice__body">
          <KnightSprite owner={knight.owner} width={112} animate />
          <div>
            <p className="reinforcement-notice__amount">+{notice.amount} men</p>
            <p className="attack-preview__rules">
              {PLAYER_NAMES[knight.owner]}&rsquo;s {captainName(captain)} sends {notice.amount} men from reserve to{' '}
              {knightName(knight)}.
            </p>
            <p className="reinforcement-notice__hp">
              HP {notice.hpBefore} → <strong>{knight.hp}</strong>
              {over > 0 && <span className="reinforcement-notice__over"> (+{over} over normal)</span>}
            </p>
          </div>
        </div>
        <div className="attack-preview__actions">
          <button className="btn btn--primary" onClick={onContinue} autoFocus>
            To battle
          </button>
        </div>
      </div>
    </div>
  );
}
