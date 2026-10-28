import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { availableSergeants, canUseAttrition, duelRoleOf, normalMaxHp } from '../../engine/queries';
import { ATTRITION, ATTRITION_SHARE } from '../../engine/state';
import {
  type AftermathEffect,
  type PreludeEffect,
  type Clash,
  type Duel,
  type DuelRole,
  type MatchState,
  type PlayerId,
  type Sergeant,
} from '../../engine/state';
import {
  PLAYER_NAMES,
  REGION_NAMES,
  SUBCLASS_ABILITIES,
  SUBCLASS_NAMES,
  TACTIC_NAMES,
  captainName,
  knightArt,
  knightName,
} from '../../data/names';
import { Card } from '../components/Card';
import { BattleResults } from './BattleResults';
import { play } from '../../audio/sound';
import { BATTLE_SPRITES, SPRITE_WIDTH, battleSprite } from '../components/battleSprites';
const SWORD_HEIGHT = BATTLE_SPRITES.sword.height;
import { SergeantBox, TacticLegend, type SergeantBoxState } from '../components/SergeantBox';
import { TacticIcon } from '../components/TacticIcon';
import './battleView.css';

/** Pacing, in milliseconds, so each clash can be followed. */
const INTRO_MS = 1500;
const REVEAL_MS = 1200;
const RESULT_MS = 1900;
const CLOSE_MS = 450;

type Phase = 'intro' | 'prelude' | 'choose' | 'reveal' | 'result' | 'aftermath' | 'over';

/** How long each after-battle ability is shown. */
const AFTERMATH_MS = 2200;

/** The human always fights as Player 1 (blue); the computer answers for Player 2 (red). */
const HUMAN: PlayerId = 'p1';

interface BattleViewProps {
  match: MatchState;
  duel: Duel;
  onCommit: (sergeantId: string) => void;
  onClose: () => void;
  /** The human's surviving loser retreats (true) or holds its square (false); closes the battle. */
  onChooseRetreat: (retreat: boolean) => void;
}

/**
 * The battlefield. Your blue Knight stands bottom-left facing right; the red
 * enemy stands top-right facing left, whichever side attacked. Each has their
 * Sergeants above them. Clashes are revealed one at a time with pauses, even
 * though the rules resolve them instantly.
 */
export function BattleView({ match, duel, onCommit, onClose, onChooseRetreat }: BattleViewProps) {
  // How many clashes have been fully shown so far.
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [closing, setClosing] = useState(false);
  const [effectIndex, setEffectIndex] = useState(0);
  const [preludeIndex, setPreludeIndex] = useState(0);

  const pendingClash = duel.clashes[shown];

  // Sounds follow what the screen shows, not the rules (which resolve instantly).
  useEffect(() => {
    // Both sides' Sergeant picks flip open.
    if (phase === 'reveal' && pendingClash) play('card-flip');
    if (phase === 'result' && pendingClash) {
      // Skirmisher: Heist wins the clash outright.
      if (pendingClash.heist) play('heist');
      if (pendingClash.winner === 'tie') {
        play('clash');
      } else {
        play('slash');
        window.setTimeout(() => play(pendingClash.hpAfter[pendingClash.winner === 'attacker' ? 'defender' : 'attacker'] <= 0 ? 'kill' : 'hit'), 140);
      }
      // Saboteur: Sabotage chips away after the clash.
      if (pendingClash.sabotaged.length > 0) window.setTimeout(() => play('sabotage'), 500);
    }
  }, [phase, pendingClash]);
  useEffect(() => {
    if (phase !== 'prelude') return;
    const effect = duel.prelude[preludeIndex];
    if (!effect) return;
    if (effect.type === 'brace') play('heal');
    else if (effect.type === 'ambush') play('turn');
    else {
      play('slash');
      window.setTimeout(() => play(effect.killed ? 'kill' : 'hit'), 140);
    }
  }, [phase, preludeIndex, duel.prelude]);
  useEffect(() => {
    if (phase !== 'aftermath') return;
    const effect = duel.aftermath[effectIndex];
    if (!effect) return;
    if (effect.type === 'regroup') play('heal');
    else {
      // Archers' Cover Retreat and Cavalry's Second Pass have their own sounds.
      play(effect.type === 'coverRetreat' ? 'archer' : 'second-pass');
      window.setTimeout(() => play(effect.killed ? 'kill' : 'hit'), 450);
    }
  }, [phase, effectIndex, duel.aftermath]);

  useEffect(() => {
    if (phase === 'intro') {
      const t = window.setTimeout(() => setPhase(duel.prelude.length > 0 ? 'prelude' : 'choose'), INTRO_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'prelude') {
      const t = window.setTimeout(() => {
        if (preludeIndex + 1 < duel.prelude.length) setPreludeIndex(preludeIndex + 1);
        else setPhase('choose');
      }, AFTERMATH_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'choose') {
      if (pendingClash) setPhase('reveal');
      else if (duel.outcome) setPhase(duel.aftermath.length > 0 ? 'aftermath' : 'over');
    }
    if (phase === 'aftermath') {
      const t = window.setTimeout(() => {
        if (effectIndex + 1 < duel.aftermath.length) setEffectIndex(effectIndex + 1);
        else setPhase('over');
      }, AFTERMATH_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'reveal') {
      const t = window.setTimeout(() => setPhase('result'), REVEAL_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'result') {
      const t = window.setTimeout(() => {
        setShown((n) => n + 1);
        setPhase('choose');
      }, RESULT_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase, pendingClash, duel.outcome, duel.aftermath.length, effectIndex, duel.prelude.length, preludeIndex]);

  const close = () => {
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  };
  const chooseRetreat = (retreat: boolean) => {
    setClosing(true);
    window.setTimeout(() => onChooseRetreat(retreat), CLOSE_MS);
  };

  // What the screen shows: the state after the clashes revealed so far.
  const upTo = phase === 'result' ? shown + 1 : shown;
  const current = phase === 'reveal' || phase === 'result' ? pendingClash : undefined;
  const canChoose = phase === 'choose' && !pendingClash && !duel.outcome;
  const myRole: DuelRole = duelRoleOf(duel, HUMAN) ?? 'attacker';
  const enemyRole: DuelRole = myRole === 'attacker' ? 'defender' : 'attacker';
  const myOptions = new Set(canChoose ? availableSergeants(match, duel, myRole).map((s) => s.id) : []);
  // After-battle abilities shown so far, and the one playing now.
  const effects =
    phase === 'over' ? duel.aftermath : phase === 'aftermath' ? duel.aftermath.slice(0, effectIndex + 1) : [];
  const activeEffect = phase === 'aftermath' ? duel.aftermath[effectIndex] : undefined;
  // Pre-battle strikes shown so far, and the one playing now.
  const preludes = phase === 'intro' ? [] : phase === 'prelude' ? duel.prelude.slice(0, preludeIndex + 1) : duel.prelude;
  const activePrelude = phase === 'prelude' ? duel.prelude[preludeIndex] : undefined;

  return (
    <div className={`battle${closing ? ' battle--closing' : ''}`}>
      <header className="battle__header">
        <span className="battle__where">Battle in {REGION_NAMES[duel.region]}</span>
        {duel.reinforced ? (
          <span className="battle__reinforced">
            {enemyRole === 'defender' ? 'Enemy' : 'You'} reinforced +{duel.reinforced} men
          </span>
        ) : null}
        <span className="battle__clash">
          {phase === 'over' || phase === 'aftermath' ? 'Battle over' : `Clash ${Math.min(shown + 1, 5)}`}
        </span>
        <TacticLegend />
      </header>

      <Combatant
        match={match}
        duel={duel}
        role={enemyRole}
        position="top"
        upTo={upTo}
        current={current}
        effects={effects}
        activeEffect={activeEffect}
        preludes={preludes}
        activePrelude={activePrelude}
      />
      <Combatant
        match={match}
        duel={duel}
        role={myRole}
        position="bottom"
        upTo={upTo}
        current={current}
        effects={effects}
        activeEffect={activeEffect}
        preludes={preludes}
        activePrelude={activePrelude}
        options={myOptions}
        attritionOpen={canChoose && canUseAttrition(match, duel, myRole)}
        onPick={onCommit}
      />

      <div className="battle__center">
        <CenterPanel
          match={match}
          duel={duel}
          phase={phase}
          clash={current}
          clashNumber={shown + 1}
          enemyReady={duel.pending[enemyRole] !== null}
          myRole={myRole}
          onReturn={close}
          effect={activeEffect}
          prelude={activePrelude}
        />
      </div>

      {phase === 'over' && duel.outcome && (
        <BattleResults match={match} duel={duel} myRole={myRole} onReturn={close} onChooseRetreat={chooseRetreat} />
      )}
    </div>
  );
}

interface CombatantProps {
  match: MatchState;
  duel: Duel;
  role: DuelRole;
  /** Every Sergeant has fallen and Attrition can be used this clash. */
  attritionOpen?: boolean;
  /** Top: the enemy, on the right facing left. Bottom: you, on the left facing right. */
  position: 'top' | 'bottom';
  upTo: number;
  current: Clash | undefined;
  options?: Set<string>;
  onPick?: (sergeantId: string) => void;
  /** After-battle abilities already shown (their HP and Sergeant changes apply). */
  effects?: AftermathEffect[];
  /** The ability playing right now, if any. */
  activeEffect?: AftermathEffect;
  /** Pre-battle strikes already shown, and the one playing now. */
  preludes?: PreludeEffect[];
  activePrelude?: PreludeEffect;
}

/** The element a side panel provides for that player's battle HUD, once it exists. */
function useHudHost(player: PlayerId): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setHost(document.getElementById(`battle-hud-${player}`));
  }, [player]);
  return host;
}

/**
 * One Knight in the battle: the sprite and HP box on the field, and in that
 * player's side panel their Knight card with the Sergeants listed below it.
 */
function Combatant({
  match,
  duel,
  role,
  position,
  upTo,
  current,
  options,
  attritionOpen = false,
  onPick,
  effects = [],
  activeEffect,
  preludes = [],
  activePrelude,
}: CombatantProps) {
  const side = duel[role];
  const knight = match.knights[side.knightId]!;
  const captain = match.captains[knight.captainId]!;
  const last = upTo > 0 ? duel.clashes[upTo - 1] : undefined;
  let hp = last ? last.hpAfter[role] : side.startHp;
  let alive: Sergeant[] = last ? last.sergeantsAfter[role] : side.startSergeants;
  // Before any clash is shown, apply the pre-battle strikes revealed so far.
  if (!last) {
    for (const p of preludes) if ('damage' in p && p.targetId === side.knightId) hp = Math.max(0, hp - p.damage);
    // Brace already counts in the starting HP; hold it back until it has been shown.
    for (const p of duel.prelude) {
      if (p.type === 'brace' && p.knightId === side.knightId && !preludes.includes(p)) hp -= p.amount;
    }
  }
  // Ambushed Sergeants sit out this battle once the Ambush has been shown.
  const ambushed = new Set(
    preludes.flatMap((p) => (p.type === 'ambush' && p.targetId === side.knightId ? p.sergeantIds : [])),
  );
  for (const e of effects) {
    if ((e.type === 'secondPass' || e.type === 'coverRetreat') && e.targetId === side.knightId) hp = Math.max(0, hp - e.damage);
    if (e.type === 'regroup' && e.knightId === side.knightId) {
      alive = alive.map((s) =>
        e.sergeantIds.includes(s.id) ? { ...s, militia: side.startSergeants.find((x) => x.id === s.id)!.militia } : s,
      );
    }
  }
  const preludeTarget = !!activePrelude && 'damage' in activePrelude && activePrelude.targetId === side.knightId;
  const bracing = activePrelude?.type === 'brace' && activePrelude.knightId === side.knightId;
  const passTarget =
    preludeTarget ||
    ((activeEffect?.type === 'secondPass' || activeEffect?.type === 'coverRetreat') && activeEffect.targetId === side.knightId);
  const passStriker = activeEffect?.type === 'secondPass' && activeEffect.knightId === side.knightId;
  const regrouping = activeEffect?.type === 'regroup' && activeEffect.knightId === side.knightId;
  const used = new Set(duel.clashes.slice(0, upTo).map((c) => c[role]?.sergeantId));
  const chosenId = current?.[role]?.sergeantId;
  const normalMax = normalMaxHp(knight);
  const maxHp = Math.max(normalMax, side.startHp);
  const tookDamage =
    passTarget || (current && upTo > 0 && current === last && current.winner !== role && current.winner !== 'tie');
  const struck = (activePrelude?.type !== 'brace' && activePrelude?.knightId === side.knightId) || passStriker || (current && upTo > 0 && current === last && current.winner === role);
  const hitKey = preludeTarget ? `pre-${activePrelude?.knightId}` : passTarget ? 'pass' : `${upTo}`;
  const hudHost = useHudHost(side.player);
  const picking = (options?.size ?? 0) > 0;

  const hud = (
    <div className={`battle-hud battle-hud--${side.player}${picking ? ' battle-hud--picking' : ''}`}>
      <div className="battle-hud__card">
        <Card art={knightArt(side.player)} size="detail" owner={side.player} alt={knightName(knight)} />
      </div>
      <div className="battle-hud__name">{knightName(knight)}</div>
      {knight.subclass && (
        <div className="battle-hud__type" title={SUBCLASS_ABILITIES[knight.subclass].text}>
          {SUBCLASS_NAMES[knight.subclass]} · {SUBCLASS_ABILITIES[knight.subclass].name}
        </div>
      )}
      <div className="battle-hud__hp">
        <div className="hp-bar" aria-hidden="true">
          <div className="hp-bar__fill" style={{ width: `${(hp / maxHp) * 100}%` }} />
        </div>
        <span className={hp > normalMax ? 'hp--over' : undefined}>
          {hp} / {normalMax} HP{hp > normalMax ? ` (+${hp - normalMax})` : ''}
        </span>
      </div>
      <div className="battle-hud__label">{picking ? 'Choose a Sergeant' : 'Sergeants'}</div>
      <div className="combatant__sergeants">
        {side.startSergeants.map((s) => {
          const now = alive.find((a) => a.id === s.id);
          let state: SergeantBoxState = 'ready';
          if (s.id === chosenId) state = 'chosen';
          else if (!now) state = 'lost';
          else if (ambushed.has(s.id)) state = 'ambushed';
          else if (used.has(s.id)) state = 'used';
          const pickable = options?.has(s.id) && onPick;
          return (
            <SergeantBox
              key={s.id}
              tactic={s.tactic}
              militia={now?.militia ?? s.militia}
              state={state}
              onPick={pickable ? () => onPick(s.id) : undefined}
            />
          );
        })}
        {side.startSergeants.length === 0 && !attritionOpen && <span className="combatant__none">No Sergeants</span>}
        {attritionOpen && onPick && (
          <button
            className="sergeant-box sergeant-box--attrition sergeant-box--pickable"
            onClick={() => onPick(ATTRITION)}
            title="Every Sergeant has fallen. Attrition can't be beaten: it costs 10% of this Knight's HP and deals the same to the enemy. Once per battle."
          >
            <span className="sergeant-box__militia">Attrition</span>
            <span className="sergeant-box__tactic">−{Math.max(1, Math.ceil(hp * ATTRITION_SHARE))} HP · {Math.max(1, Math.ceil(hp * ATTRITION_SHARE))} dmg</span>
          </button>
        )}
        {duel.attritionUsed?.[role] && upTo >= duel.clashes.findIndex((c) => c.attrition?.[role]) + 1 && (
          <span className="combatant__none">Attrition used</span>
        )}
      </div>
    </div>
  );

  return (
    <div className={`combatant combatant--${position} combatant--${side.player}`}>
      {hudHost && createPortal(hud, hudHost)}

      <div className="combatant__body">
        <div className={`combatant__card${hp <= 0 ? ' combatant__card--fallen' : ''}`}>
          <div
            key={tookDamage ? `hit-${hitKey}` : struck ? `strike-${hitKey}` : 'idle'}
            className={`combatant__motion${tookDamage ? ' combatant__motion--hit' : ''}${struck ? ' combatant__motion--strike' : ''}${regrouping || bracing ? ' combatant__motion--regroup' : ''}`}
          >
            <span
              className="combatant__sprite"
              role="img"
              aria-label={knightName(knight)}
              style={{
                backgroundImage: `url(${battleSprite(knight.subclass)[side.player]})`,
                height: battleSprite(knight.subclass).height,
                width: battleSprite(knight.subclass).width ?? SPRITE_WIDTH,
                backgroundSize: `${2 * (battleSprite(knight.subclass).width ?? SPRITE_WIDTH)}px 100%`,
                // Shorter avatars keep their feet level with the info box; narrower ones stay centered.
                marginTop: SWORD_HEIGHT - battleSprite(knight.subclass).height,
                marginLeft: (SPRITE_WIDTH - (battleSprite(knight.subclass).width ?? SPRITE_WIDTH)) / 2,
              }}
            />
            {tookDamage && <span className="combatant__slash" aria-hidden="true" />}
          </div>
        </div>
        <div
          key={struck ? `strike-info-${hitKey}` : 'info'}
          className={`combatant__info${struck ? ' combatant__info--strike' : ''}`}
        >
          <span className="combatant__name">{knightName(knight)}</span>
          <span className="combatant__sub">
            {PLAYER_NAMES[side.player]} · {captainName(captain)}
          </span>
          <div className="hp-bar" aria-label={`${hp} of ${maxHp} HP`}>
            <div className="hp-bar__fill" style={{ width: `${(hp / maxHp) * 100}%` }} />
          </div>
          <span className="combatant__hp">
            <span className={hp > normalMax ? 'hp--over' : undefined}>
              {hp} / {normalMax} HP{hp > normalMax ? ` (+${hp - normalMax})` : ''}
            </span>
            {tookDamage && (
              <span className="combatant__damage">
                −
                {preludeTarget && activePrelude && 'damage' in activePrelude
                  ? activePrelude.damage
                  : passTarget && activeEffect && 'damage' in activeEffect
                    ? activeEffect.damage
                    : current?.damage}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

interface CenterPanelProps {
  match: MatchState;
  duel: Duel;
  phase: Phase;
  clash: Clash | undefined;
  clashNumber: number;
  enemyReady: boolean;
  myRole: DuelRole;
  onReturn: () => void;
  effect?: AftermathEffect;
  prelude?: PreludeEffect;
}

function CenterPanel({ match, duel, phase, clash, clashNumber, enemyReady, myRole, effect, prelude }: CenterPanelProps) {
  if (phase === 'prelude' && prelude) {
    const actor = match.knights[prelude.knightId]!;
    if (prelude.type === 'brace') {
      return (
        <div className="battle-msg battle-msg--ability">
          <span className="battle-msg__ability">Gatekeeper · Brace!</span>
          <span className="battle-msg__small battle-msg__verdict">
            {knightName(actor)} braces behind the gate: +{prelude.amount} HP (once per game).
          </span>
        </div>
      );
    }
    const target = match.knights[prelude.targetId]!;
    if (prelude.type === 'ambush') {
      return (
        <div className="battle-msg battle-msg--ability">
          <span className="battle-msg__ability">Ambusher · Ambush!</span>
          <span className="battle-msg__small battle-msg__verdict">
            {knightName(actor)} springs an ambush: {prelude.sergeantIds.length} of {knightName(target)}&rsquo;s strongest
            Sergeants are cut off for this battle.
          </span>
        </div>
      );
    }
    return (
      <div className="battle-msg battle-msg--ability">
        <span className="battle-msg__ability">
          {prelude.type === 'snipe' ? 'Watchman · Snipe!' : 'Warden · First Strike!'}
        </span>
        <span className="battle-msg__small battle-msg__verdict">
          {knightName(actor)} {prelude.type === 'snipe' ? 'snipes' : 'strikes first at'} {knightName(target)} for{' '}
          {prelude.damage}
          {prelude.killed ? `. ${knightName(target)} falls before the battle begins!` : '.'}
        </span>
      </div>
    );
  }

  if (phase === 'aftermath' && effect) {
    const actor = match.knights[effect.knightId]!;
    if (effect.type === 'secondPass') {
      const target = match.knights[effect.targetId]!;
      return (
        <div className="battle-msg battle-msg--ability">
          <span className="battle-msg__ability">Cavalry · Second Pass!</span>
          <span className="battle-msg__small battle-msg__verdict">
            {knightName(actor)} rides down the retreating {knightName(target)} for {effect.damage} damage
            {effect.killed ? `. ${knightName(target)} falls!` : '.'}
          </span>
        </div>
      );
    }
    if (effect.type === 'coverRetreat') {
      const target = match.knights[effect.targetId]!;
      const covered = match.knights[effect.coveredId]!;
      return (
        <div className="battle-msg battle-msg--ability">
          <span className="battle-msg__ability">Archers · Cover Retreat!</span>
          <span className="battle-msg__small battle-msg__verdict">
            {knightName(actor)} covers {knightName(covered)}&rsquo;s retreat
            {effect.blockedSecondPass ? ', blocking Second Pass,' : ''} and looses on {knightName(target)} for {effect.damage}
            {effect.killed ? `. ${knightName(target)} falls!` : '.'}
          </span>
        </div>
      );
    }
    return (
      <div className="battle-msg battle-msg--ability">
        <span className="battle-msg__ability">Infantry · Regroup</span>
        <span className="battle-msg__small battle-msg__verdict">
          {knightName(actor)} rallies {effect.restored} men back to {effect.sergeantIds.length === 1 ? 'a Sergeant' : 'their Sergeants'}.
        </span>
      </div>
    );
  }

  const enemyRole: DuelRole = myRole === 'attacker' ? 'defender' : 'attacker';
  const attacker = match.knights[duel.attacker.knightId]!;
  const defender = match.knights[duel.defender.knightId]!;

  if (phase === 'intro') {
    return (
      <div className="battle-msg battle-msg--intro">
        <span className="battle-msg__big">
          {knightName(attacker)} attacks {knightName(defender)}!
        </span>
        <span className="battle-msg__small">
          {PLAYER_NAMES[duel.attacker.player]} against {PLAYER_NAMES[duel.defender.player]}
        </span>
      </div>
    );
  }

  if (phase === 'choose') {
    return (
      <div className="battle-msg">
        <span className="battle-msg__big">Clash {clashNumber}: choose a Sergeant</span>
        <span className="battle-msg__small">
          {enemyReady ? 'The enemy has chosen in secret.' : 'Waiting for the enemy…'}
        </span>
      </div>
    );
  }

  if ((phase === 'reveal' || phase === 'result') && clash) {
    return (
      <div className="battle-msg">
        <div className="clash-reveal">
          <RevealedPick label="You" pick={clash[myRole]} attrition={clash.attrition?.[myRole]} winner={phase === 'result' && clash.winner === myRole} />
          <span className="clash-reveal__vs">vs</span>
          <RevealedPick label="Enemy" pick={clash[enemyRole]} attrition={clash.attrition?.[enemyRole]} winner={phase === 'result' && clash.winner === enemyRole} />
        </div>
        <span className={`battle-msg__small${phase === 'result' ? ' battle-msg__verdict' : ''}`}>
          {phase === 'reveal' ? 'Revealing…' : verdict(clash, knightName(attacker), knightName(defender))}
        </span>
      </div>
    );
  }

  if (phase === 'over') return null;

  return null;
}

function RevealedPick({ label, pick, attrition, winner }: { label: string; pick: Clash['attacker']; attrition?: number; winner: boolean }) {
  if (attrition) {
    return (
      <span className="revealed revealed--attrition">
        <span className="revealed__who">{label}</span>
        <span className="revealed__name">Attrition</span>
        <span className="revealed__men">−{attrition} HP · {attrition} dmg</span>
      </span>
    );
  }
  if (!pick) {
    return (
      <span className="revealed revealed--none">
        <span className="revealed__who">{label}</span>
        <span className="revealed__name">No Sergeant</span>
      </span>
    );
  }
  return (
    <span className={`revealed revealed--${pick.tactic}${winner ? ' revealed--winner' : ''}`}>
      <span className="revealed__who">{label}</span>
      <TacticIcon tactic={pick.tactic} size={34} />
      <span className="revealed__name">{TACTIC_NAMES[pick.tactic]}</span>
      <span className="revealed__men">{pick.militia} men</span>
    </span>
  );
}

function verdict(clash: Clash, attackerName: string, defenderName: string): string {
  const base = baseVerdict(clash, attackerName, defenderName);
  const sabo = clash.sabotaged.map((r) => `Sabotage: -1 HP to ${r === 'attacker' ? attackerName : defenderName}.`);
  return [base, ...sabo].join(' ');
}

function baseVerdict(clash: Clash, attackerName: string, defenderName: string): string {
  const target = clash.winner === 'attacker' ? defenderName : attackerName;
  if (clash.attrition) {
    const name = (r: 'attacker' | 'defender') => (r === 'attacker' ? attackerName : defenderName);
    const lines = (['attacker', 'defender'] as const)
      .filter((r) => clash.attrition![r])
      .map((r) => `${name(r)} fights on with Attrition: pays ${clash.attrition![r]} HP and deals ${clash.attrition![r]}.`);
    for (const r of ['attacker', 'defender'] as const) {
      const pick = clash[r];
      if (pick) lines.push(`${TACTIC_NAMES[pick.tactic]} strikes unopposed: ${clash.damage} damage to ${name(r === 'attacker' ? 'defender' : 'attacker')}.`);
    }
    return lines.join(' ');
  }
  if (clash.heist) {
    const thief = clash.heist === 'attacker' ? attackerName : defenderName;
    return `Heist! ${thief} wins the clash outright: ${clash.damage} damage to ${target}.`;
  }
  if (clash.winner === 'tie') {
    return `Both sent ${TACTIC_NAMES[clash.attacker!.tactic]} with ${clash.attacker!.militia} men: each Sergeant loses half.`;
  }
  const win = clash[clash.winner]!;
  const lose = clash.winner === 'attacker' ? clash.defender : clash.attacker;
  if (!lose) return `Unopposed! ${clash.damage} damage to ${target}.`;
  if (win.tactic === lose.tactic) {
    return `Both sent ${TACTIC_NAMES[win.tactic]}: ${win.militia} men beat ${lose.militia}! ${clash.damage} damage to ${target}.`;
  }
  return `${TACTIC_NAMES[win.tactic]} beats ${TACTIC_NAMES[lose.tactic]}! ${clash.damage} damage to ${target}.`;
}
