import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { availableSergeants, duelRoleOf } from '../../engine/queries';
import { KNIGHT_HP, type Clash, type Duel, type DuelRole, type MatchState, type PlayerId, type Sergeant } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, TACTIC_NAMES, captainName, knightArt, knightName } from '../../data/names';
import { Card } from '../components/Card';
import knightBattle from '../../assets/sprites/knight-battle-anim.png';
import enemyKnightBattle from '../../assets/sprites/enemy-knight-battle-anim.png';
import { SergeantBox, TacticLegend, type SergeantBoxState } from '../components/SergeantBox';
import { TacticIcon } from '../components/TacticIcon';
import './battleView.css';

/** Pacing, in milliseconds, so each clash can be followed. */
const INTRO_MS = 1500;
const REVEAL_MS = 1200;
const RESULT_MS = 1900;
const CLOSE_MS = 450;

type Phase = 'intro' | 'choose' | 'reveal' | 'result' | 'over';

/** The human always fights as Player 1 (blue); the computer answers for Player 2 (red). */
const HUMAN: PlayerId = 'p1';

interface BattleViewProps {
  match: MatchState;
  duel: Duel;
  onCommit: (sergeantId: string) => void;
  onClose: () => void;
}

/**
 * The battlefield. Your blue Knight stands bottom-left facing right; the red
 * enemy stands top-right facing left, whichever side attacked. Each has their
 * Sergeants above them. Clashes are revealed one at a time with pauses, even
 * though the rules resolve them instantly.
 */
export function BattleView({ match, duel, onCommit, onClose }: BattleViewProps) {
  // How many clashes have been fully shown so far.
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [closing, setClosing] = useState(false);

  const pendingClash = duel.clashes[shown];

  useEffect(() => {
    if (phase === 'intro') {
      const t = window.setTimeout(() => setPhase('choose'), INTRO_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'choose') {
      if (pendingClash) setPhase('reveal');
      else if (duel.outcome) setPhase('over');
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
  }, [phase, pendingClash, duel.outcome]);

  const close = () => {
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  };

  // What the screen shows: the state after the clashes revealed so far.
  const upTo = phase === 'result' ? shown + 1 : shown;
  const current = phase === 'reveal' || phase === 'result' ? pendingClash : undefined;
  const canChoose = phase === 'choose' && !pendingClash && !duel.outcome;
  const myRole: DuelRole = duelRoleOf(duel, HUMAN) ?? 'attacker';
  const enemyRole: DuelRole = myRole === 'attacker' ? 'defender' : 'attacker';
  const myOptions = new Set(canChoose ? availableSergeants(match, duel, myRole).map((s) => s.id) : []);

  return (
    <div className={`battle${closing ? ' battle--closing' : ''}`}>
      <header className="battle__header">
        <span className="battle__where">Battle in {REGION_NAMES[duel.region]}</span>
        <span className="battle__clash">
          {phase === 'over' ? 'Battle over' : `Clash ${Math.min(shown + 1, 5)}`}
        </span>
        <TacticLegend />
      </header>

      <Combatant match={match} duel={duel} role={enemyRole} position="top" upTo={upTo} current={current} />
      <Combatant
        match={match}
        duel={duel}
        role={myRole}
        position="bottom"
        upTo={upTo}
        current={current}
        options={myOptions}
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
        />
      </div>
    </div>
  );
}

interface CombatantProps {
  match: MatchState;
  duel: Duel;
  role: DuelRole;
  /** Top: the enemy, on the right facing left. Bottom: you, on the left facing right. */
  position: 'top' | 'bottom';
  upTo: number;
  current: Clash | undefined;
  options?: Set<string>;
  onPick?: (sergeantId: string) => void;
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
function Combatant({ match, duel, role, position, upTo, current, options, onPick }: CombatantProps) {
  const side = duel[role];
  const knight = match.knights[side.knightId]!;
  const captain = match.captains[knight.captainId]!;
  const last = upTo > 0 ? duel.clashes[upTo - 1] : undefined;
  const hp = last ? last.hpAfter[role] : side.startHp;
  const alive: Sergeant[] = last ? last.sergeantsAfter[role] : side.startSergeants;
  const used = new Set(duel.clashes.slice(0, upTo).map((c) => c[role]?.sergeantId));
  const chosenId = current?.[role]?.sergeantId;
  const maxHp = Math.max(KNIGHT_HP, side.startHp);
  const tookDamage = current && upTo > 0 && current === last && current.winner !== role && current.winner !== 'tie';
  const struck = current && upTo > 0 && current === last && current.winner === role;
  const hudHost = useHudHost(side.player);
  const picking = (options?.size ?? 0) > 0;

  const hud = (
    <div className={`battle-hud battle-hud--${side.player}${picking ? ' battle-hud--picking' : ''}`}>
      <div className="battle-hud__card">
        <Card art={knightArt(side.player)} size="detail" owner={side.player} alt={knightName(knight)} />
      </div>
      <div className="battle-hud__name">{knightName(knight)}</div>
      <div className="battle-hud__hp">
        <div className="hp-bar" aria-hidden="true">
          <div className="hp-bar__fill" style={{ width: `${(hp / maxHp) * 100}%` }} />
        </div>
        <span>
          {hp} / {maxHp} HP
        </span>
      </div>
      <div className="battle-hud__label">{picking ? 'Choose a Sergeant' : 'Sergeants'}</div>
      <div className="combatant__sergeants">
        {side.startSergeants.map((s) => {
          const now = alive.find((a) => a.id === s.id);
          let state: SergeantBoxState = 'ready';
          if (s.id === chosenId) state = 'chosen';
          else if (!now) state = 'lost';
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
        {side.startSergeants.length === 0 && <span className="combatant__none">No Sergeants</span>}
      </div>
    </div>
  );

  return (
    <div className={`combatant combatant--${position} combatant--${side.player}`}>
      {hudHost && createPortal(hud, hudHost)}

      <div className="combatant__body">
        <div className={`combatant__card${hp <= 0 ? ' combatant__card--fallen' : ''}`}>
          <div
            key={tookDamage ? `hit-${upTo}` : struck ? `strike-${upTo}` : 'idle'}
            className={`combatant__motion${tookDamage ? ' combatant__motion--hit' : ''}${struck ? ' combatant__motion--strike' : ''}`}
          >
            <span
              className="combatant__sprite"
              role="img"
              aria-label={knightName(knight)}
              style={{ backgroundImage: `url(${side.player === 'p1' ? knightBattle : enemyKnightBattle})` }}
            />
            {tookDamage && <span className="combatant__slash" aria-hidden="true" />}
          </div>
        </div>
        <div
          key={struck ? `strike-info-${upTo}` : 'info'}
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
            {hp} / {maxHp} HP
            {tookDamage && <span className="combatant__damage">−{current.damage}</span>}
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
}

function CenterPanel({ match, duel, phase, clash, clashNumber, enemyReady, myRole, onReturn }: CenterPanelProps) {
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
          <RevealedPick label="You" pick={clash[myRole]} winner={phase === 'result' && clash.winner === myRole} />
          <span className="clash-reveal__vs">vs</span>
          <RevealedPick label="Enemy" pick={clash[enemyRole]} winner={phase === 'result' && clash.winner === enemyRole} />
        </div>
        <span className={`battle-msg__small${phase === 'result' ? ' battle-msg__verdict' : ''}`}>
          {phase === 'reveal' ? 'Revealing…' : verdict(clash, knightName(attacker), knightName(defender))}
        </span>
      </div>
    );
  }

  if (phase === 'over' && duel.outcome) {
    const { winner, loserFate } = duel.outcome;
    const winnerKnight = winner === 'attacker' ? attacker : winner === 'defender' ? defender : null;
    const loserKnight = winner === 'attacker' ? defender : winner === 'defender' ? attacker : null;
    const loserSide = winner === 'attacker' ? duel.defender : duel.attacker;
    return (
      <div className="battle-msg battle-msg--over">
        <span className="battle-msg__big">
          {winnerKnight
            ? `${knightName(winnerKnight)} wins!`
            : 'The battle ends even'}
        </span>
        <span className="battle-msg__small">
          {loserKnight
            ? loserFate === 'killed'
              ? `${PLAYER_NAMES[loserSide.player]}’s ${knightName(loserKnight)} has fallen.`
              : `${PLAYER_NAMES[loserSide.player]}’s ${knightName(loserKnight)} retreats with ${loserKnight.hp} HP.`
            : 'The defender holds; both Knights keep their squares.'}
        </span>
        <button className="btn btn--primary" onClick={onReturn} autoFocus>
          Return to {REGION_NAMES[duel.region]}
        </button>
      </div>
    );
  }

  return null;
}

function RevealedPick({ label, pick, winner }: { label: string; pick: Clash['attacker']; winner: boolean }) {
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
  const target = clash.winner === 'attacker' ? defenderName : attackerName;
  if (clash.winner === 'tie') {
    return `Both sent ${TACTIC_NAMES[clash.attacker!.tactic]}: each Sergeant loses half their men.`;
  }
  const win = clash[clash.winner]!;
  const lose = clash.winner === 'attacker' ? clash.defender : clash.attacker;
  if (!lose) return `Unopposed! ${clash.damage} damage to ${target}.`;
  return `${TACTIC_NAMES[win.tactic]} beats ${TACTIC_NAMES[lose.tactic]}! ${clash.damage} damage to ${target}.`;
}
