import { useEffect, useState } from 'react';
import { decisiveRoller } from '../../engine/queries';
import { DECISIVE_DIVISOR, type DecisiveBattle, type MatchState, type PlayerId } from '../../engine/state';
import { PLAYER_NAMES, REGION_NAMES, captainName } from '../../data/names';
import armyBattle from '../../assets/sprites/army-battle-anim.webp';
import enemyArmyBattle from '../../assets/sprites/enemy-army-battle-anim.webp';
import { play } from '../../audio/sound';
import './decisiveView.css';

const HUMAN: PlayerId = 'p1';
const ENEMY: PlayerId = 'p2';
/** Pacing, in milliseconds. */
const INTRO_MS = 1600;
const ROLL_MS = 900;
const CLOSE_MS = 450;

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

interface DecisiveViewProps {
  match: MatchState;
  decisive: DecisiveBattle;
  onRoll: () => void;
  onReturn: () => void;
  /** The human lost a Decisive battle: hold (false) or retreat (true). */
  onChoose: (retreat: boolean) => void;
}

/**
 * Last Stand (the two Captains of a stalemated Region) or Decisive battle (an
 * assault on a neighbouring Region): the Captains fight with all their men. Players take turns rolling a die; each roll costs the other side
 * (roller's men × die) ÷ 10 men. Most men left when the rolls run out wins.
 */
export function DecisiveView({ match, decisive, onRoll, onReturn, onChoose }: DecisiveViewProps) {
  const [intro, setIntro] = useState(true);
  // How many rolls have been shown (each plays a short tumble first).
  const [shown, setShown] = useState(decisive.rolls.length);
  const [tumble, setTumble] = useState(1);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setIntro(false), INTRO_MS);
    return () => window.clearTimeout(t);
  }, []);

  const rolling = shown < decisive.rolls.length;
  useEffect(() => {
    if (!rolling) return;
    const spin = window.setInterval(() => setTumble(1 + Math.floor(Math.random() * 6)), 90);
    play('die-roll');
    const roll = decisive.rolls[shown]!;
    const done = window.setTimeout(() => {
      setShown((n) => n + 1);
      play('die-land');
      if (roll.damage > 0) window.setTimeout(() => play('hit', { volume: Math.min(1, 0.4 + roll.value / 10) }), 120);
    }, ROLL_MS);
    return () => {
      window.clearInterval(spin);
      window.clearTimeout(done);
    };
  }, [rolling, shown]);

  // Men as of the rolls shown so far.
  const men = { ...decisive.startMen };
  decisive.rolls.slice(0, shown).forEach((r) => (men[r.player === 'p1' ? 'p2' : 'p1'] -= r.damage));
  const used = (p: PlayerId) => decisive.rolls.slice(0, shown).filter((r) => r.player === p).length;
  const last = shown > 0 ? decisive.rolls[shown - 1] : undefined;
  const over = !rolling && !intro && decisive.outcome !== null;
  const myRoll = !intro && !rolling && decisiveRoller(match) === HUMAN;
  const enemyRolling = !intro && !over && (rolling ? decisive.rolls[shown]!.player === ENEMY : decisiveRoller(match) === ENEMY);

  const close = () => {
    setClosing(true);
    window.setTimeout(onReturn, CLOSE_MS);
  };

  return (
    <div className={`battle decisive${closing ? ' battle--closing' : ''}`}>
      <header className="battle__header">
        <span className="battle__where">
          {decisive.kind === 'assault' ? 'Decisive battle for' : 'Last Stand in'} {REGION_NAMES[decisive.region]}
        </span>
        <span className="battle__clash">
          {over ? 'Battle over' : `Roll ${Math.min(decisive.rolls.length + (rolling ? 0 : 1), decisive.chances.p1 + decisive.chances.p2)} of ${decisive.chances.p1 + decisive.chances.p2}`}
        </span>
        <span className="decisive__rule">Damage = your men × die ÷ {DECISIVE_DIVISOR}</span>
      </header>

      <Side match={match} decisive={decisive} player={ENEMY} men={men[ENEMY]} rollsLeft={decisive.chances[ENEMY] - used(ENEMY)} hit={last && last.player === HUMAN && !rolling ? last.damage : null} />
      <Side match={match} decisive={decisive} player={HUMAN} men={men[HUMAN]} rollsLeft={decisive.chances[HUMAN] - used(HUMAN)} hit={last && last.player === ENEMY && !rolling ? last.damage : null} />

      <div className="decisive__center">
        {intro ? (
          <p className="decisive__banner">{decisive.kind === 'assault' ? 'Decisive battle!' : 'Stalemate! Last Stand'}</p>
        ) : (
          <>
            <Die value={rolling ? tumble : (last?.value ?? 6)} rolling={rolling} blank={!last && !rolling} />
            <p className="decisive__line">
              {rolling
                ? `${PLAYER_NAMES[decisive.rolls[shown]!.player]} rolls…`
                : last
                  ? `${PLAYER_NAMES[last.player]} rolled ${last.value}: ${last.damage} men fall.`
                  : `${PLAYER_NAMES[decisive.first]} rolls first.`}
            </p>
            {myRoll && (
              <button className="btn btn--primary decisive__roll" onClick={onRoll} autoFocus>
                Roll the die
              </button>
            )}
            {enemyRolling && !rolling && <p className="decisive__wait">The enemy is rolling…</p>}
          </>
        )}
      </div>

      {over && <Results match={match} decisive={decisive} onReturn={close} onChoose={onChoose} />}
    </div>
  );
}

function Side({
  match,
  decisive,
  player,
  men,
  rollsLeft,
  hit,
}: {
  match: MatchState;
  decisive: DecisiveBattle;
  player: PlayerId;
  men: number;
  rollsLeft: number;
  hit: number | null;
}) {
  const captain = match.captains[decisive.captains[player]]!;
  const start = decisive.startMen[player];
  const pct = start > 0 ? Math.max(0, (men / start) * 100) : 0;
  return (
    <div className={`decisive__side decisive__side--${player}${men <= 0 ? ' decisive__side--fallen' : ''}`}>
      <span
        className="decisive__sprite"
        style={{ backgroundImage: `url(${player === HUMAN ? armyBattle : enemyArmyBattle})` }}
        role="img"
        aria-label={`${captainName(captain)}'s men`}
      />
      <div className="decisive__info">
        <span className="decisive__who">{PLAYER_NAMES[player]}</span>
        <h3 className="decisive__name">{captainName(captain)}</h3>
        <div className="decisive__bar">
          <span className="decisive__fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="decisive__men">
          {men} / {start} men
        </p>
        <p className="decisive__rolls">Rolls left: {rollsLeft}</p>
      </div>
      {hit !== null && hit > 0 && (
        <span key={`${men}`} className="decisive__hit">
          −{hit}
        </span>
      )}
    </div>
  );
}

function Die({ value, rolling, blank }: { value: number; rolling: boolean; blank: boolean }) {
  return (
    <svg className={`decisive__die${rolling ? ' decisive__die--rolling' : ''}`} viewBox="0 0 90 90" aria-label={blank ? 'Die' : `Die showing ${value}`}>
      <rect x="4" y="4" width="82" height="82" rx="14" />
      {!blank && PIPS[value]!.map(([cx, cy], i) => <circle key={i} cx={22 + cx * 23} cy={22 + cy * 23} r="8" />)}
    </svg>
  );
}

function Results({
  match,
  decisive,
  onReturn,
  onChoose,
}: {
  match: MatchState;
  decisive: DecisiveBattle;
  onReturn: () => void;
  onChoose: (retreat: boolean) => void;
}) {
  const { winner, loserKilled, loserChoice } = decisive.outcome!;
  const where = REGION_NAMES[decisive.region];
  const loser: PlayerId | null = winner === null ? null : winner === 'p1' ? 'p2' : 'p1';
  const attacker = decisive.first;
  const defender: PlayerId = attacker === 'p1' ? 'p2' : 'p1';
  const name = (p: PlayerId) => captainName(match.captains[decisive.captains[p]]!);
  const home = decisive.fromRegion !== null ? REGION_NAMES[decisive.fromRegion] : 'their Region';
  const deciding = loserChoice === 'deciding';
  const myChoice = deciding && loser === HUMAN;
  const title = myChoice
    ? 'Defeat: hold or retreat?'
    : winner === null
      ? 'Stalemate holds'
      : winner === HUMAN
        ? 'Victory!'
        : 'Defeat';

  const assaultLines =
    winner === null
      ? [`Neither side breaks. ${where} stays as it was.`]
      : deciding
        ? [
            `${name(loser!)} is beaten but still has men and Knights.`,
            loser === HUMAN
              ? loser === defender
                ? `Hold ${where} (only men are lost), or retreat with every living Knight and give ${where} up.`
                : `Hold ${home} (only men are lost), or retreat with every living Knight and give ${home} to the enemy.`
              : `${PLAYER_NAMES[loser!]} is choosing whether to hold or retreat…`,
          ]
        : winner === attacker
          ? loserChoice === 'hold'
            ? [`${name(defender)} holds ${where} despite the defeat. Only men were lost.`]
            : loserChoice === 'retreat'
              ? [
                  `${name(defender)} retreats with every living Knight.`,
                  `${PLAYER_NAMES[attacker]} takes ${where}. Any of their Knights captured there are freed.`,
                ]
              : [
                  `${PLAYER_NAMES[attacker]} takes ${where}. Any of their Knights captured there are freed.`,
                  loserKilled
                    ? `${name(defender)} has fallen with all their men.`
                    : `${PLAYER_NAMES[defender]}'s Knights there are captured; ${name(defender)} returns to their Lord.`,
                ]
          : loserChoice === 'retreat'
            ? [
                `${name(defender)} holds ${where}.`,
                `${name(attacker)} retreats with every living Knight and gives up ${home}; ${PLAYER_NAMES[defender]} takes it.`,
              ]
            : [
                `${name(defender)} holds ${where}. The attackers fall back with their losses.`,
                ...(loserKilled ? [`${name(attacker)} has fallen with all their men.`] : []),
              ];
  const lines =
    decisive.kind === 'assault'
      ? assaultLines
      : winner === null || loser === null
        ? [`Both sides end with ${decisive.men.p1} men. Nobody holds ${where}; it closes and both Captains return to their Lords.`]
        : [
            `${PLAYER_NAMES[loser]} has fewer men left and loses the Last Stand. ${PLAYER_NAMES[winner]}'s ${name(winner)} secures ${where}.`,
            loserKilled
              ? `${name(loser)} has fallen with all their men.`
              : `${PLAYER_NAMES[loser]}'s Knights on the board are captured; ${name(loser)} retreats to their Lord with the Knights never deployed.`,
          ];
  return (
    <div className="attack-preview battle-results" role="dialog" aria-modal="true" aria-labelledby="decisive-results-title">
      <div className={`attack-preview__window battle-results__window battle-results__window--${winner === null ? 'even' : winner === HUMAN ? 'win' : 'loss'}`}>
        <h2 id="decisive-results-title" className="attack-preview__title battle-results__title">
          {title}
        </h2>
        {lines.map((l) => (
          <p key={l} className="battle-results__verdict">
            {l}
          </p>
        ))}
        <p className="battle-results__verdict">
          Men lost: {PLAYER_NAMES.p1} {decisive.startMen.p1 - decisive.men.p1} · {PLAYER_NAMES.p2}{' '}
          {decisive.startMen.p2 - decisive.men.p2} (spread over each Captain's men)
        </p>
        <div className="attack-preview__actions">
          {myChoice ? (
            <>
              <button className="btn" onClick={() => onChoose(true)}>
                Retreat
              </button>
              <button className="btn btn--primary" onClick={() => onChoose(false)} autoFocus>
                Hold your ground
              </button>
            </>
          ) : (
            !deciding && (
              <button className="btn btn--primary" onClick={onReturn} autoFocus>
                Return to the Region board
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
