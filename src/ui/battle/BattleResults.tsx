import { normalMaxHp } from '../../engine/queries';
import { type Duel, type DuelRole, type MatchState, type Sergeant } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, captainName, knightArt, knightName } from '../../data/names';
import { Card } from '../components/Card';
import './attackPreview.css';

interface BattleResultsProps {
  match: MatchState;
  duel: Duel;
  /** The human's side in this duel. */
  myRole: DuelRole;
  onReturn: () => void;
}

const men = (sergeants: Sergeant[]) => sergeants.reduce((sum, s) => sum + s.militia, 0);

/** Summary shown in the middle of the battlefield once a battle is decided. */
export function BattleResults({ match, duel, myRole, onReturn }: BattleResultsProps) {
  const outcome = duel.outcome!;
  const title =
    outcome.winner === null ? 'Stand-off' : outcome.winner === myRole ? 'Victory!' : 'Defeat';

  const loserRole: DuelRole | null = outcome.winner === null ? null : outcome.winner === 'attacker' ? 'defender' : 'attacker';
  const loser = loserRole ? match.knights[duel[loserRole].knightId]! : null;
  const verdict = loser
    ? outcome.loserFate === 'killed'
      ? `${PLAYER_NAMES[loser.owner]}’s ${knightName(loser)} has fallen.`
      : `${PLAYER_NAMES[loser.owner]}’s ${knightName(loser)} retreats from the field.`
    : 'Neither Knight gives ground; both keep their squares.';

  const enemyRole: DuelRole = myRole === 'attacker' ? 'defender' : 'attacker';

  return (
    <div className="attack-preview battle-results" role="dialog" aria-modal="true" aria-labelledby="battle-results-title">
      <div className={`attack-preview__window battle-results__window battle-results__window--${title === 'Victory!' ? 'win' : title === 'Defeat' ? 'loss' : 'even'}`}>
        <h2 id="battle-results-title" className="attack-preview__title battle-results__title">
          {title}
        </h2>
        <p className="battle-results__verdict">{verdict}</p>

        <div className="attack-preview__sides">
          {[myRole, enemyRole].map((role, i) => {
            const side = duel[role];
            const knight = match.knights[side.knightId]!;
            // Final state, after every ability (Second Pass, Cover Retreat, Regroup).
            const endHp = knight.hp;
            const endSergeants = knight.sergeants;
            const sergeantsLost = side.startSergeants.length - endSergeants.length;
            const menLost = side.startHp - endHp + (men(side.startSergeants) - men(endSergeants));
            const won = outcome.winner === role;
            return (
              <div key={role} className="battle-results__side-wrap">
                {i === 1 && <span className="attack-preview__versus battle-results__vs">vs</span>}
                <div className={`knight-summary knight-summary--${side.player}${won ? ' battle-results__side--won' : ''}`}>
                  <span className="knight-summary__role">
                    {i === 0 ? 'Your Knight' : 'Enemy Knight'}
                    {won ? ' · winner' : ''}
                  </span>
                  <div className="knight-summary__top">
                    <span className={knight.status === 'dead' ? 'battle-results__fallen' : undefined}>
                      <Card art={knightArt(side.player)} size="company" owner={side.player} />
                    </span>
                    <div className="knight-summary__info">
                      <h3 className="knight-summary__name">{knightName(knight)}</h3>
                      <p className="knight-summary__line">{captainName(match.captains[knight.captainId]!)}</p>
                      <p className="knight-summary__hp">
                        {side.startHp} → {endHp} <span>HP</span>
                      </p>
                      {endHp > normalMaxHp(knight) && (
                        <p className="knight-summary__line hp--over">+{endHp - normalMaxHp(knight)} above max</p>
                      )}
                      <p className="knight-summary__line">Sergeants lost: {sergeantsLost}</p>
                      <p className="knight-summary__line">Militia lost: {menLost}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {duel.aftermath.length + duel.prelude.length > 0 || duel.clashes.some((c) => c.heist || c.sabotaged.length > 0) ? (
          <ul className="battle-results__abilities">
            {duel.prelude.map((e, i) => (
              <li key={`p${i}`}>
                {e.type === 'ambush'
                  ? `Ambush: ${knightName(match.knights[e.knightId]!)} kept ${e.sergeantIds.length} of ${knightName(match.knights[e.targetId]!)}’s Sergeants out of the battle.`
                  : `${e.type === 'snipe' ? 'Snipe' : 'First Strike'}: ${knightName(match.knights[e.knightId]!)} hit ${knightName(match.knights[e.targetId]!)} for ${e.damage} before the battle${e.killed ? ', killing them' : ''}.`}
              </li>
            ))}
            {duel.clashes.some((c) => c.heist) && <li>Heist won a clash outright.</li>}
            {duel.clashes.some((c) => c.sabotaged.length > 0) && (
              <li>Sabotage cost {duel.clashes.reduce((n, c) => n + c.sabotaged.length, 0)} HP over the battle.</li>
            )}
            {duel.aftermath.map((e, i) => {
              const actor = match.knights[e.knightId]!;
              return (
                <li key={i}>
                  {e.type === 'secondPass'
                    ? `Second Pass: ${knightName(actor)} struck the retreating ${knightName(match.knights[e.targetId]!)} for ${e.damage}${e.killed ? ', killing them' : ''}.`
                    : e.type === 'coverRetreat'
                      ? `Cover Retreat: ${knightName(actor)} covered ${knightName(match.knights[e.coveredId]!)}${e.blockedSecondPass ? ', blocked Second Pass,' : ''} and struck ${knightName(match.knights[e.targetId]!)} for ${e.damage}${e.killed ? ', killing them' : ''}.`
                      : `Regroup: ${knightName(actor)} recovered ${e.restored} men.`}
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="attack-preview__actions">
          <button className="btn btn--primary" onClick={onReturn} autoFocus>
            Return to {REGION_NAMES[duel.region]}
          </button>
        </div>
      </div>
    </div>
  );
}
