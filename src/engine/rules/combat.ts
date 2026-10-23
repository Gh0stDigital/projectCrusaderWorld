import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { attackTargets, availableSergeants, duelKnight, duelRoleOf } from '../queries';
import type {
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

/** The Knight placed this turn attacks an adjacent enemy Knight, starting a duel. */
export function declareAttack(
  state: MatchState,
  player: PlayerId,
  targetKnightId: string,
): EngineResult<MatchState, MatchEvent> {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return reject('Attacks can only be made during a turn.');
  if (turn.player !== player) return reject('It is not your turn.');
  if (turn.step !== 'attack' || !turn.placedKnightId) return reject('Only a Knight placed this turn can attack, once.');
  const target = state.knights[targetKnightId];
  if (!target || !attackTargets(state).some((k) => k.id === targetKnightId)) {
    return reject('That Knight is not an adjacent enemy.');
  }

  const attacker = state.knights[turn.placedKnightId]!;
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
  };

  let next: MatchState = { ...state, duel, turn: { ...turn, step: 'battle' } };
  const events: MatchEvent[] = [
    { type: 'duelStarted', attackerId: attacker.id, defenderId: target.id, region: duel.region },
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
  if (a && d) {
    winner = a.tactic === d.tactic ? 'tie' : BEATS[a.tactic] === d.tactic ? 'attacker' : 'defender';
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
    damage = Math.min(picks[winner]!.militia, knights[loser].hp);
    knights[loser] = { ...knights[loser], hp: knights[loser].hp - damage };
    const loserPick = picks[loser];
    // The beaten Sergeant and their men are lost.
    if (loserPick) knights[loser] = withSergeant(knights[loser], loserPick.sergeantId, 0);
  }

  const clash: Clash = {
    number: duel.clashes.length + 1,
    attacker: a,
    defender: d,
    winner,
    damage,
    hpAfter: { attacker: knights.attacker.hp, defender: knights.defender.hp },
    sergeantsAfter: { attacker: knights.attacker.sergeants, defender: knights.defender.sergeants },
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
  if (attacker.hp !== defender.hp) {
    const winner: DuelRole = attacker.hp > defender.hp ? 'attacker' : 'defender';
    const loser = winner === 'attacker' ? defender : attacker;
    const killed = loser.hp <= 0;
    knights[loser.id] = killed
      ? { ...loser, status: 'dead', position: null, hp: 0, sergeants: [] }
      : { ...loser, status: 'ready', position: null };
    outcome = { winner, loserFate: killed ? 'killed' : 'retreated' };
  }

  return {
    state: {
      ...state,
      knights,
      duel: { ...duel, outcome },
      turn: state.turn ? { ...state.turn, step: 'end' } : null,
    },
    events: [{ type: 'duelEnded', outcome, attackerId: attacker.id, defenderId: defender.id }],
  };
}
