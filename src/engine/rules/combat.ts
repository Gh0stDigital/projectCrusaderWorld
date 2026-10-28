import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { adjacentSquares, attackTargets, attackers, availableSergeants, duelKnight, duelRoleOf, knightAt, nextOrdersStep } from '../queries';
import { AMBUSH_COUNT, SABOTAGE_DAMAGE, SECOND_PASS_SHARE } from '../state';
import { knightMilitia } from '../queries';
import { charge, openWager } from './resources';
import type {
  AftermathEffect,
  PreludeEffect,
  Clash,
  ClashPick,
  Duel,
  DuelOutcome,
  DuelRole,
  Knight,
  MatchState,
  PlayerId,
  Sergeant,
  Tactic,
} from '../state';

/** Rush beats Flank, Flank beats Counter, Counter beats Rush. */
export const BEATS: Record<Tactic, Tactic> = {
  rush: 'flank',
  flank: 'counter',
  counter: 'rush',
};

const OTHER: Record<DuelRole, DuelRole> = { attacker: 'defender', defender: 'attacker' };

/** One of the acting Captain's Knights on the board attacks an enemy in reach, starting a duel. Once per turn. */
export function declareAttack(
  state: MatchState,
  player: PlayerId,
  attackerKnightId: string,
  targetKnightId: string,
): EngineResult<MatchState, MatchEvent> {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return reject('Attacks can only be made during a turn.');
  if (turn.player !== player) return reject('It is not your turn.');
  if (turn.attacked) return reject('You have already attacked this turn.');
  if (turn.movedKnightId) return reject('No attack follows a move.');
  if (turn.step !== 'orders') return reject('You cannot attack right now.');
  if (!attackers(state).some((k) => k.id === attackerKnightId)) {
    return reject('That Knight cannot attack: it must be yours, on this board, with an enemy in reach.');
  }
  const target = state.knights[targetKnightId];
  if (!target || !attackTargets(state, attackerKnightId).some((k) => k.id === targetKnightId)) {
    return reject('That Knight is not an enemy in reach.');
  }

  // Resources: the attacking party pays before the battle starts.
  const paid = charge(state, player, knightMilitia(state.knights[attackerKnightId]!), { knightId: attackerKnightId });
  state = paid.state;
  const attacker = state.knights[attackerKnightId]!;
  const duel: Duel = {
    region: attacker.position!.region,
    attacker: {
      knightId: attacker.id,
      player: attacker.owner,
      startHp: attacker.hp,
      startSergeants: attacker.sergeants,
    },
    defender: {
      knightId: target.id,
      player: target.owner,
      startHp: target.hp,
      startSergeants: target.sergeants,
    },
    pending: { attacker: null, defender: null },
    clashes: [],
    outcome: null,
    prelude: [],
    blocked: { attacker: [], defender: [] },
    aftermath: [],
  };

  // Garrison: Snipe and First Strike hit the attacker before the first clash.
  let attackerNow = attacker;
  let targetNow = target;
  const prelude: PreludeEffect[] = [];
  // Gatekeeper Brace: once per game, in its first battle, its men fight with the
  // strength of two: HP doubles with no new militia (each man is now worth 2 HP).
  const brace = (k: Knight, role: 'attacker' | 'defender'): Knight => {
    if (k.subclass !== 'gatekeeper' || k.braced || k.hp <= 0) return k;
    const amount = k.hp;
    duel[role].startHp += amount;
    prelude.push({ type: 'brace', knightId: k.id, amount });
    return { ...k, hp: k.hp + amount, braced: true };
  };
  attackerNow = brace(attackerNow, 'attacker');
  targetNow = brace(targetNow, 'defender');
  const strike = (from: Knight, type: 'snipe' | 'firstStrike') => {
    if (attackerNow.hp <= 0) return;
    const damage = Math.min(maxSergeant(from), attackerNow.hp);
    if (damage <= 0) return;
    attackerNow = { ...attackerNow, hp: attackerNow.hp - damage };
    prelude.push({ type, knightId: from.id, targetId: attacker.id, damage, killed: attackerNow.hp <= 0 });
  };
  if (target.position) {
    const { region, square } = target.position;
    const neighbours = adjacentSquares(square)
      .map((sq) => knightAt(state, region, sq))
      .filter((k): k is Knight => k !== null && k.owner === target.owner);
    // Watchmen next to an attacked Gatekeeper snipe.
    if (target.subclass === 'gatekeeper') {
      neighbours.filter((k) => k.subclass === 'watchman').forEach((w) => strike(w, 'snipe'));
    }
    // An attacked Watchman snipes if it stands next to a Gatekeeper.
    if (target.subclass === 'watchman' && neighbours.some((k) => k.subclass === 'gatekeeper')) strike(target, 'snipe');
    // An attacked Warden strikes first.
    if (target.subclass === 'warden') strike(target, 'firstStrike');
  }
  // Raiders: an Ambusher on either side takes the opponent's strongest Sergeants out of this battle.
  for (const role of ['attacker', 'defender'] as const) {
    const ambusher = role === 'attacker' ? attackerNow : targetNow;
    const victim = role === 'attacker' ? targetNow : attackerNow;
    if (ambusher.subclass !== 'ambusher' || ambusher.hp <= 0) continue;
    const taken = [...victim.sergeants]
      .sort((x, y) => y.militia - x.militia)
      .slice(0, AMBUSH_COUNT)
      .map((sg) => sg.id);
    if (taken.length === 0) continue;
    duel.blocked[OTHER[role]] = taken;
    prelude.push({ type: 'ambush', knightId: ambusher.id, targetId: victim.id, sergeantIds: taken });
  }
  duel.prelude = prelude;

  let next: MatchState = {
    ...state,
    knights: { ...state.knights, [attacker.id]: attackerNow, [target.id]: targetNow },
    duel,
    // An attack locks in this turn's placement: it can no longer be undone.
    turn: { ...turn, step: 'battle', attacked: true, undo: null },
  };
  const events: MatchEvent[] = [
    { type: 'duelStarted', attackerId: attacker.id, defenderId: target.id, region: duel.region },
    ...paid.events,
  ];
  // A duel where neither side has a Sergeant to send ends at once.
  if (isDuelOver(next, duel)) {
    const finished = finishDuel(next);
    next = finished.state;
    events.push(...finished.events);
  }
  return { ok: true, state: next, events };
}

/**
 * A side commits a Sergeant for the current clash. Choices stay hidden until
 * both sides are in; then the clash resolves.
 */
export function commitSergeant(
  state: MatchState,
  player: PlayerId,
  sergeantId: string,
): EngineResult<MatchState, MatchEvent> {
  const duel = state.duel;
  if (!duel || duel.outcome) return reject('There is no battle in progress.');
  const role = duelRoleOf(duel, player);
  if (!role) return reject('You are not part of this battle.');
  if (duel.pending[role]) return reject('You have already chosen a Sergeant for this clash.');
  if (!availableSergeants(state, duel, role).some((s) => s.id === sergeantId)) {
    return reject('That Sergeant cannot fight this clash.');
  }

  const committed: Duel = { ...duel, pending: { ...duel.pending, [role]: sergeantId } };
  let next: MatchState = { ...state, duel: committed };
  const events: MatchEvent[] = [{ type: 'sergeantCommitted', player, role }];

  // Resolve once the other side has committed too, or has nobody left to send.
  const other = OTHER[role];
  if (committed.pending[other] || availableSergeants(next, committed, other).length === 0) {
    const resolved = resolveClash(next);
    next = resolved.state;
    events.push(...resolved.events);
  }
  return { ok: true, state: next, events };
}

function pickFor(state: MatchState, duel: Duel, role: DuelRole): ClashPick | null {
  const id = duel.pending[role];
  if (!id) return null;
  const sergeant = duelKnight(state, duel, role).sergeants.find((s) => s.id === id)!;
  return { sergeantId: sergeant.id, tactic: sergeant.tactic, militia: sergeant.militia };
}

function maxSergeant(knight: Knight): number {
  return Math.max(0, ...knight.sergeants.map((s) => s.militia));
}

/** Half a Sergeant's men fall in a tied clash, rounded so at least one is lost. */
export function tieLoss(militia: number): number {
  return Math.ceil(militia / 2);
}

function withSergeant(knight: Knight, id: string, militia: number): Knight {
  const sergeants: Sergeant[] = knight.sergeants
    .map((s) => (s.id === id ? { ...s, militia } : s))
    .filter((s) => s.militia > 0);
  return { ...knight, sergeants };
}

/** Both choices are in: reveal, decide the winner, apply damage and Sergeant losses. */
function resolveClash(state: MatchState): { state: MatchState; events: MatchEvent[] } {
  const duel = state.duel!;
  const picks: Record<DuelRole, ClashPick | null> = {
    attacker: pickFor(state, duel, 'attacker'),
    defender: pickFor(state, duel, 'defender'),
  };
  let knights: Record<DuelRole, Knight> = {
    attacker: duelKnight(state, duel, 'attacker'),
    defender: duelKnight(state, duel, 'defender'),
  };

  let winner: DuelRole | 'tie';
  const a = picks.attacker;
  const d = picks.defender;
  // Skirmisher: the first clash it sends a Sergeant into is won by Heist.
  const heisting = (['attacker', 'defender'] as const).filter(
    (role) =>
      knights[role].subclass === 'skirmisher' &&
      picks[role] !== null &&
      !duel.clashes.some((c) => c[role] !== null),
  );
  let heist: DuelRole | undefined;
  if (a && d && heisting.length === 1) {
    heist = heisting[0]!;
    winner = heist;
  } else if (a && d) {
    if (a.tactic !== d.tactic) winner = BEATS[a.tactic] === d.tactic ? 'attacker' : 'defender';
    // Same tactic: the bigger Sergeant wins; equal numbers tie.
    else winner = a.militia === d.militia ? 'tie' : a.militia > d.militia ? 'attacker' : 'defender';
  } else {
    // Only one side had a Sergeant to send: an unopposed blow.
    winner = a ? 'attacker' : 'defender';
  }

  let damage = 0;
  if (winner === 'tie') {
    for (const role of ['attacker', 'defender'] as const) {
      const pick = picks[role]!;
      knights[role] = withSergeant(knights[role], pick.sergeantId, pick.militia - tieLoss(pick.militia));
    }
  } else {
    const loser = OTHER[winner];
    // Same tactic: only the difference in men lands as damage.
    const sameTactic = a && d && a.tactic === d.tactic && !heist;
    const blow = sameTactic ? picks[winner]!.militia - picks[loser]!.militia : picks[winner]!.militia;
    damage = Math.min(blow, knights[loser].hp);
    knights[loser] = { ...knights[loser], hp: knights[loser].hp - damage };
    const loserPick = picks[loser];
    // The beaten Sergeant and their men are lost.
    if (loserPick) knights[loser] = withSergeant(knights[loser], loserPick.sergeantId, 0);
  }

  // Saboteur: the opponent loses a little HP after every clash.
  const sabotaged: DuelRole[] = [];
  for (const role of ['attacker', 'defender'] as const) {
    const victim = OTHER[role];
    if (knights[role].subclass === 'saboteur' && knights[role].hp > 0 && knights[victim].hp > 0) {
      knights[victim] = { ...knights[victim], hp: Math.max(0, knights[victim].hp - SABOTAGE_DAMAGE) };
      sabotaged.push(victim);
    }
  }

  const clash: Clash = {
    number: duel.clashes.length + 1,
    attacker: a,
    defender: d,
    winner,
    damage,
    hpAfter: { attacker: knights.attacker.hp, defender: knights.defender.hp },
    sergeantsAfter: { attacker: knights.attacker.sergeants, defender: knights.defender.sergeants },
    sabotaged,
    ...(heist ? { heist } : {}),
  };

  let next: MatchState = {
    ...state,
    knights: { ...state.knights, [knights.attacker.id]: knights.attacker, [knights.defender.id]: knights.defender },
    duel: { ...duel, clashes: [...duel.clashes, clash], pending: { attacker: null, defender: null } },
  };
  const events: MatchEvent[] = [{ type: 'clashResolved', clash }];

  if (isDuelOver(next, next.duel!)) {
    const finished = finishDuel(next);
    next = finished.state;
    events.push(...finished.events);
  }
  return { state: next, events };
}

/** The duel ends when a Knight falls to 0 HP or neither side has a Sergeant left to send. */
function isDuelOver(state: MatchState, duel: Duel): boolean {
  if (duelKnight(state, duel, 'attacker').hp <= 0 || duelKnight(state, duel, 'defender').hp <= 0) return true;
  return availableSergeants(state, duel, 'attacker').length === 0 && availableSergeants(state, duel, 'defender').length === 0;
}

/**
 * The Knight with more HP left wins and stays on its square. The loser leaves
 * the board: killed at 0 HP, otherwise retreating to their Captain.
 * Equal HP: the defender holds and both stay.
 */
function finishDuel(state: MatchState): { state: MatchState; events: MatchEvent[] } {
  const duel = state.duel!;
  const attacker = duelKnight(state, duel, 'attacker');
  const defender = duelKnight(state, duel, 'defender');

  let outcome: DuelOutcome = { winner: null, loserFate: null };
  const knights = { ...state.knights };
  const aftermath: AftermathEffect[] = [];
  const current: Record<DuelRole, Knight> = { attacker, defender };

  if (attacker.hp !== defender.hp) {
    const winner: DuelRole = attacker.hp > defender.hp ? 'attacker' : 'defender';
    const loserRole: DuelRole = OTHER[winner];
    let loser = current[loserRole];
    let victor = current[winner];

    // Archers: Cover Retreat for a friendly Infantry that lost and is retreating alive.
    let covered = false;
    if (loser.subclass === 'infantry' && loser.hp > 0 && loser.position) {
      const { region, square } = loser.position;
      const archer = adjacentSquares(square)
        .map((sq) => knightAt(state, region, sq))
        .filter((k): k is Knight => k !== null && k.owner === loser.owner && k.subclass === 'archers' && k.sergeants.length > 0)
        .sort((a, b) => maxSergeant(b) - maxSergeant(a))[0];
      if (archer) {
        covered = true;
        const damage = Math.min(maxSergeant(archer), victor.hp);
        victor = { ...victor, hp: victor.hp - damage };
        const victorKilled = victor.hp <= 0;
        if (victorKilled) victor = { ...victor, status: 'dead', position: null, hp: 0, sergeants: [] };
        current[winner] = victor;
        aftermath.push({
          type: 'coverRetreat',
          knightId: archer.id,
          coveredId: loser.id,
          targetId: victor.id,
          damage,
          killed: victorKilled,
          blockedSecondPass: current[winner].subclass === 'cavalry',
        });
      }
    }

    // Cavalry: Second Pass on a loser who is still alive and retreating (unless covered).
    if (!covered && victor.subclass === 'cavalry' && victor.hp > 0 && loser.hp > 0) {
      const damage = Math.min(Math.floor(victor.hp * SECOND_PASS_SHARE), loser.hp);
      if (damage > 0) {
        loser = { ...loser, hp: loser.hp - damage };
        current[loserRole] = loser;
        aftermath.push({ type: 'secondPass', knightId: victor.id, targetId: loser.id, damage, killed: loser.hp <= 0 });
      }
    }

    // A surviving loser stays on its square until its owner chooses to retreat or hold.
    const killed = loser.hp <= 0;
    if (killed) current[loserRole] = { ...loser, status: 'dead', position: null, hp: 0, sergeants: [] };
    outcome = { winner, loserFate: killed ? 'killed' : 'deciding' };
  }

  // Infantry: Regroup. A surviving Knight's Sergeants that tied a clash recover
  // the men they lost, back to what they had when the duel began.
  for (const role of ['attacker', 'defender'] as const) {
    const knight = current[role];
    if (knight.subclass !== 'infantry' || knight.hp <= 0) continue;
    const tiedIds = new Set(
      duel.clashes.filter((c) => c.winner === 'tie').map((c) => c[role]?.sergeantId).filter(Boolean) as string[],
    );
    let restored = 0;
    const sergeantIds: string[] = [];
    const sergeants = knight.sergeants.map((s) => {
      const start = duel[role].startSergeants.find((x) => x.id === s.id);
      if (!tiedIds.has(s.id) || !start || s.militia >= start.militia) return s;
      restored += start.militia - s.militia;
      sergeantIds.push(s.id);
      return { ...s, militia: start.militia };
    });
    if (restored > 0) {
      current[role] = { ...knight, sergeants };
      aftermath.push({ type: 'regroup', knightId: knight.id, restored, sergeantIds });
    }
  }

  knights[attacker.id] = current.attacker;
  knights[defender.id] = current.defender;

  // Back to orders if a Knight can still be placed this turn; otherwise End.
  let after: MatchState = { ...state, knights, duel: { ...duel, outcome, aftermath } };
  const events: MatchEvent[] = [{ type: 'duelEnded', outcome, attackerId: attacker.id, defenderId: defender.id }];

  // Resources: the loser pays for every man lost into a pool on the two squares.
  if (outcome.winner) {
    const loserRole = OTHER[outcome.winner];
    const side = (role: DuelRole) => {
      const k = state.knights[duel[role].knightId]!;
      return { player: duel[role].player, knightId: k.id, region: k.position!.region, square: k.position!.square };
    };
    const startMen = knightMilitia({ ...current[loserRole], status: 'fielded', hp: duel[loserRole].startHp, sergeants: duel[loserRole].startSergeants });
    const endMen = current[loserRole].status === 'dead' ? 0 : knightMilitia(current[loserRole]);
    const pool = openWager(after, side(loserRole), side(outcome.winner), startMen - endMen);
    after = pool.state;
    events.push(...pool.events);
  }
  return {
    state: { ...after, turn: after.turn ? { ...after.turn, step: nextOrdersStep(after) } : null },
    events,
  };
}

/**
 * After losing a battle and surviving, the loser's owner chooses: retreat to its
 * Captain (it can be placed again later) or hold its square.
 */
export function chooseRetreat(state: MatchState, player: PlayerId, retreat: boolean): EngineResult<MatchState, MatchEvent> {
  const duel = state.duel;
  if (!duel?.outcome || duel.outcome.loserFate !== 'deciding' || !duel.outcome.winner) {
    return reject('There is no retreat to decide.');
  }
  const loserRole: DuelRole = OTHER[duel.outcome.winner];
  if (duel[loserRole].player !== player) return reject('Only the losing Knight’s side decides whether it retreats.');
  // Holding the square costs the Knight's men in Resources, like any other action.
  const loserId = duel[loserRole].knightId;
  const held = retreat ? { state, events: [] as MatchEvent[] } : charge(state, player, knightMilitia(state.knights[loserId]!), { knightId: loserId });
  state = held.state;
  const knight = state.knights[loserId]!;
  const after: MatchState = {
    ...state,
    knights: retreat ? { ...state.knights, [knight.id]: { ...knight, status: 'ready', position: null } } : state.knights,
    duel: { ...duel, outcome: { ...duel.outcome, loserFate: retreat ? 'retreated' : 'held' } },
  };
  // A retreating Knight of the side whose turn it is can be placed again this turn.
  const turn = after.turn;
  return {
    ok: true,
    state: turn && (turn.step === 'orders' || turn.step === 'end') ? { ...after, turn: { ...turn, step: nextOrdersStep(after) } } : after,
    events: [{ type: 'loserChose', player, knightId: knight.id, retreat }, ...held.events],
  };
}
