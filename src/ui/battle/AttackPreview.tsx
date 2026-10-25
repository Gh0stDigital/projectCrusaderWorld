import { useState } from 'react';
import type { Knight, MatchState } from '../../engine/state';
import { PLAYER_NAMES, SUBCLASS_ABILITIES, SUBCLASS_NAMES, captainName, knightArt, knightName } from '../../data/names';
import { normalMaxHp, sergeantMilitia } from '../../engine/queries';
import { Card } from '../components/Card';
import { SergeantBox, TacticLegend } from '../components/SergeantBox';
import './attackPreview.css';

interface AttackPreviewProps {
  match: MatchState;
  attacker: Knight;
  defender: Knight;
  /** attack: the human is attacking. defend: the human is being attacked and may reinforce. */
  mode?: 'attack' | 'defend';
  onCancel?: () => void;
  /** Called when the battle should begin; in defend mode with the reinforcements chosen. */
  onCommence: (reinforcements: number) => void;
}

const STEP = 10;

/** Both Knights side by side before a battle, with reinforcements when defending. */
export function AttackPreview({ match, attacker, defender, mode = 'attack', onCancel, onCommence }: AttackPreviewProps) {
  const defending = mode === 'defend';
  const reserve = match.captains[defender.captainId]!.reserve;
  const [amount, setAmount] = useState(0);
  // A braced Gatekeeper's men are worth 2 HP each, reinforcements included.
  const newHp = defender.hp + amount * (defender.braced ? 2 : 1);
  const normalMax = normalMaxHp(defender);
  const over = newHp - normalMax;

  return (
    <div className="attack-preview" role="dialog" aria-modal="true" aria-labelledby="attack-preview-title">
      <div className={`attack-preview__window${defending ? ' attack-preview__window--defend' : ''}`}>
        <h2 id="attack-preview-title" className="attack-preview__title">
          {defending ? `${PLAYER_NAMES[attacker.owner]} is attacking you! Deploy reinforcements?` : 'Attack?'}
        </h2>

        <div className="attack-preview__sides">
          <KnightSummary match={match} knight={attacker} role={defending ? 'Enemy Knight' : 'Your Knight'} />
          <span className="attack-preview__versus">vs</span>
          <KnightSummary
            match={match}
            knight={defending ? { ...defender, hp: newHp } : defender}
            role={defending ? 'Your Knight' : 'Enemy Knight'}
          />
        </div>

        {defending && (
          <div className="reinforce">
            <p className="reinforce__line">
              {captainName(match.captains[defender.captainId]!)} has <strong>{reserve}</strong> militia in reserve.
            </p>
            <div className="reinforce__controls">
              <button className="btn reinforce__step" onClick={() => setAmount(0)} disabled={amount === 0}>
                None
              </button>
              <button className="btn reinforce__step" onClick={() => setAmount(Math.max(0, amount - STEP))} disabled={amount === 0}>
                −{STEP}
              </button>
              <span className="reinforce__amount">
                {amount}
                <span className="reinforce__unit">men</span>
              </span>
              <button
                className="btn reinforce__step"
                onClick={() => setAmount(Math.min(reserve, amount + STEP))}
                disabled={amount >= reserve}
              >
                +{STEP}
              </button>
              <button className="btn reinforce__step" onClick={() => setAmount(reserve)} disabled={amount >= reserve}>
                All
              </button>
            </div>
            <p className="reinforce__line">
              {knightName(defender)}: {defender.hp} → <strong>{newHp} HP</strong>
              {over > 0 && (
                <span className="reinforce__over">
                  {' '}
                  ({over} above normal max of {normalMax}; lasts the rest of the game)
                </span>
              )}
            </p>
          </div>
        )}

        <p className="attack-preview__rules">
          Up to five clashes. Each side secretly sends one Sergeant per clash; the winning tactic deals its men as
          damage. The Knight with less HP at the end is driven from the field.
        </p>
        <TacticLegend />

        <div className="attack-preview__actions">
          {defending ? (
            <>
              <button className="btn" onClick={() => onCommence(0)}>
                Fight without reinforcements
              </button>
              <button className="btn btn--primary" onClick={() => onCommence(amount)} disabled={amount === 0} autoFocus>
                Deploy {amount > 0 ? amount : ''} and fight
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={onCancel}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={() => onCommence(0)} autoFocus>
                Commence attack
              </button>
            </>
          )}
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
        <Card art={knightArt(knight.owner)} size="roster" owner={knight.owner} />
        <div className="knight-summary__info">
          <h3 className="knight-summary__name">{knightName(knight)}</h3>
          {knight.subclass && (
            <p className="knight-summary__line knight-summary__type">
              {SUBCLASS_NAMES[knight.subclass]} · {SUBCLASS_ABILITIES[knight.subclass].name}
            </p>
          )}
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
