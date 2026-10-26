import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { tieLoss } from '../src/engine/rules/combat';
import {
  adjacentSquares,
  attackTargets,
  availableSergeants,
  canEndTurn,
  captainMilitia,
  knightMilitia,
  lordMilitia,
  playerMilitia,
} from '../src/engine/queries';
import { chooseSergeant } from '../src/ai';
import type { MatchAction } from '../src/engine/actions';
import type { MatchState, Sergeant, Tactic } from '../src/engine/state';

function act(state: MatchState, action: MatchAction): MatchState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function rejected(state: MatchState, action: MatchAction): string {
  const result = applyAction(state, action);
  if (result.ok) throw new Error('Expected the action to be rejected');
  return result.reason;
}

/**
 * Turn 3: Player 2's Knight p2-garrison-1-k1 stands on Heartland square 4.
 * Player 1 has just placed p1-army-1-k1 on square 1, next to it, and may attack.
 * (Turn 1: p1 Raiders placed in the North, square 4; turn 2: p2 Garrison routed to the Heartland.)
 */
function readyToAttack(): MatchState {
  let s = createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: ['raiders', 'army', 'garrison'] });
  s = act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
  s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 1 });
  // Square 4 routes Player 2 to the Heartland (Region 4); their square 4 routes Player 1 back there.
  s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 4 });
  s = act(s, { type: 'endTurn', player: 'p1' });
  s = act(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 4 });
  s = act(s, { type: 'placeKnight', player: 'p2', knightId: 'p2-garrison-1-k1', square: 4 });
  s = act(s, { type: 'endTurn', player: 'p2' });
  s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-army-1', region: 4 });
  s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-army-1-k1', square: 1 });
  // These tests cover the basic duel, so both Knights are plain (no Knight type abilities).
  s.knights['p1-army-1-k1'] = { ...s.knights['p1-army-1-k1']!, subclass: null };
  s.knights['p2-garrison-1-k1'] = { ...s.knights['p2-garrison-1-k1']!, subclass: null, hp: 50 };
  return s;
}

/** Give a Knight a specific set of Sergeants, for predictable duels. */
function setSergeants(s: MatchState, knightId: string, tactics: Tactic[], militia = 10): MatchState {
  const sergeants: Sergeant[] = tactics.map((tactic, i) => ({ id: `${knightId}-s${i + 1}`, tactic, militia }));
  return { ...s, knights: { ...s.knights, [knightId]: { ...s.knights[knightId]!, sergeants } } };
}

const ATTACKER = 'p1-army-1-k1';
const DEFENDER = 'p2-garrison-1-k1';

function clash(s: MatchState, attackerSergeant: number, defenderSergeant: number): MatchState {
  s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: `${DEFENDER}-s${defenderSergeant}` });
  return act(s, { type: 'commitSergeant', player: 'p1', sergeantId: `${ATTACKER}-s${attackerSergeant}` });
}

describe('Militia', () => {
  it('gives each Lord 1,000: 200 reserve and two Captains of 400', () => {
    const s = createMatch();
    expect(s.players.p1.lordReserves.army).toBe(200);
    expect(captainMilitia(s, 'p1-army-1')).toBe(400);
    expect(lordMilitia(s, 'p1', 'army')).toBe(1000);
    expect(playerMilitia(s, 'p1')).toBe(3000);
  });

  it('gives each staffed Knight 50 HP and five Sergeants of 10', () => {
    const k = createMatch().knights['p1-army-1-k1']!;
    expect(k.hp).toBe(50);
    expect(k.sergeants.map((s) => s.militia)).toEqual([10, 10, 10, 10, 10]);
    expect(knightMilitia(k)).toBe(100);
  });

  it('mixes tactics two, two and one, differently per Knight', () => {
    const s = createMatch();
    const tactics = (n: number) => s.knights[`p1-army-1-k${n}`]!.sergeants.map((x) => x.tactic);
    expect(tactics(1)).toEqual(['rush', 'flank', 'counter', 'rush', 'flank']);
    expect(tactics(2)).not.toEqual(tactics(1));
  });
});

describe('Adjacency', () => {
  it('counts up, down, left and right, not diagonals', () => {
    expect(adjacentSquares(4).sort()).toEqual([1, 3, 5, 7]);
    expect(adjacentSquares(0).sort()).toEqual([1, 3]);
    expect(adjacentSquares(8).sort()).toEqual([5, 7]);
  });
});

describe('Declaring an attack', () => {
  it('stays in orders when an enemy is in reach of one of your Knights', () => {
    const s = readyToAttack();
    expect(s.turn!.step).toBe('orders');
    expect(attackTargets(s, ATTACKER).map((k) => k.id)).toEqual([DEFENDER]);
  });

  it('allows ending the turn instead of attacking', () => {
    expect(canEndTurn(readyToAttack())).toBe(true);
  });

  it('starts a duel and blocks End Turn until it is over', () => {
    const s = act(readyToAttack(), { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER });
    expect(s.turn!.step).toBe('battle');
    expect(s.duel).toMatchObject({ attacker: { knightId: ATTACKER }, defender: { knightId: DEFENDER }, clashes: [] });
    expect(rejected(s, { type: 'endTurn', player: 'p1' })).toMatch(/Finish the battle/);
  });

  it('refuses a Knight that is not an adjacent enemy', () => {
    expect(rejected(readyToAttack(), { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: 'p1-raiders-1-k1' })).toMatch(
      /enemy in reach/,
    );
  });
});

describe('Clashes', () => {
  function duel(attacker: Tactic[], defender: Tactic[]): MatchState {
    let s = readyToAttack();
    s = setSergeants(s, ATTACKER, attacker);
    s = setSergeants(s, DEFENDER, defender);
    return act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER });
  }

  it('waits until both sides have committed', () => {
    let s = duel(['rush'], ['flank']);
    s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: `${DEFENDER}-s1` });
    expect(s.duel!.clashes).toHaveLength(0);
    expect(s.duel!.pending.defender).toBe(`${DEFENDER}-s1`);
  });

  it('Rush beats Flank: damage equals the winner’s men, the beaten Sergeant is lost', () => {
    const s = clash(duel(['rush', 'counter'], ['flank', 'counter']), 1, 1);
    const c = s.duel!.clashes[0]!;
    expect(c).toMatchObject({ winner: 'attacker', damage: 10 });
    expect(s.knights[DEFENDER]!.hp).toBe(40);
    expect(s.knights[DEFENDER]!.sergeants.map((x) => x.id)).toEqual([`${DEFENDER}-s2`]);
    expect(s.knights[ATTACKER]!.sergeants[0]!.militia).toBe(10);
  });

  it('Flank beats Counter and Counter beats Rush', () => {
    expect(clash(duel(['flank', 'rush'], ['counter', 'rush']), 1, 1).duel!.clashes[0]!.winner).toBe('attacker');
    expect(clash(duel(['rush', 'flank'], ['counter', 'flank']), 1, 1).duel!.clashes[0]!.winner).toBe('defender');
  });

  it('a tie costs both Sergeants half their men, rounded up, and no HP', () => {
    let s = readyToAttack();
    s = setSergeants(s, ATTACKER, ['rush', 'flank'], 7);
    s = setSergeants(s, DEFENDER, ['rush', 'flank'], 10);
    s = act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER });
    s = clash(s, 1, 1);
    expect(s.duel!.clashes[0]).toMatchObject({ winner: 'tie', damage: 0 });
    expect(s.knights[ATTACKER]!.sergeants[0]!.militia).toBe(3);
    expect(s.knights[DEFENDER]!.sergeants[0]!.militia).toBe(5);
    expect(s.knights[ATTACKER]!.hp).toBe(50);
    expect(tieLoss(1)).toBe(1);
  });

  it('never lets a Sergeant fight twice in one duel', () => {
    let s = clash(duel(['rush', 'rush'], ['rush', 'rush']), 1, 1);
    expect(availableSergeants(s, s.duel!, 'attacker').map((x) => x.id)).toEqual([`${ATTACKER}-s2`]);
    s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: `${DEFENDER}-s2` });
    expect(rejected(s, { type: 'commitSergeant', player: 'p1', sergeantId: `${ATTACKER}-s1` })).toMatch(/cannot fight/);
  });

  it('lands unopposed blows when one side has no Sergeants left', () => {
    let s = duel(['rush', 'rush', 'rush'], ['counter']);
    s = clash(s, 1, 1); // defender's Counter beats Rush: attacker takes 10
    // Defender has nobody left; each attacker pick lands unopposed.
    s = act(s, { type: 'commitSergeant', player: 'p1', sergeantId: `${ATTACKER}-s2` });
    expect(s.duel!.clashes[1]).toMatchObject({ winner: 'attacker', defender: null, damage: 10 });
  });
});

describe('Ending a duel', () => {
  function lostAlive(): MatchState {
    let s = readyToAttack();
    s = setSergeants(s, ATTACKER, ['rush', 'rush']);
    s = setSergeants(s, DEFENDER, ['flank', 'flank']);
    s = act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER });
    s = clash(s, 1, 1);
    return clash(s, 2, 2);
  }

  it('lets a surviving loser’s side choose: until then it stays and the turn cannot end', () => {
    const s = lostAlive();
    expect(s.duel!.outcome).toEqual({ winner: 'attacker', loserFate: 'deciding' });
    expect(s.knights[DEFENDER]).toMatchObject({ status: 'fielded', hp: 30 });
    expect(s.knights[ATTACKER]!.position).toEqual({ region: 4, square: 1 });
    expect(s.turn!.step).toBe('end');
    expect(rejected(s, { type: 'endTurn', player: 'p1' })).toMatch(/retreat or hold/);
    expect(rejected(s, { type: 'chooseRetreat', player: 'p1', retreat: true })).toMatch(/losing Knight/);
  });

  it('retreating sends the loser back to its Captain', () => {
    const s = act(lostAlive(), { type: 'chooseRetreat', player: 'p2', retreat: true });
    expect(s.duel!.outcome!.loserFate).toBe('retreated');
    expect(s.knights[DEFENDER]).toMatchObject({ status: 'ready', position: null, hp: 30, sergeants: [] });
    expect(rejected(s, { type: 'chooseRetreat', player: 'p2', retreat: false })).toMatch(/no retreat/);
    act(s, { type: 'endTurn', player: 'p1' });
  });

  it('holding keeps the loser on its square', () => {
    const before = lostAlive().knights[DEFENDER]!.position;
    const s = act(lostAlive(), { type: 'chooseRetreat', player: 'p2', retreat: false });
    expect(s.duel!.outcome!.loserFate).toBe('held');
    expect(s.knights[DEFENDER]).toMatchObject({ status: 'fielded', position: before, hp: 30 });
    act(s, { type: 'endTurn', player: 'p1' });
  });

  it('decides by HP left, not by damage taken in this duel', () => {
    let s = readyToAttack();
    // The attacker comes in badly wounded: it wins the only clash but still has less HP.
    s = { ...s, knights: { ...s.knights, [ATTACKER]: { ...s.knights[ATTACKER]!, hp: 5 } } };
    s = setSergeants(s, ATTACKER, ['rush']);
    s = setSergeants(s, DEFENDER, ['flank']);
    s = act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER });
    s = clash(s, 1, 1);
    expect(s.knights[DEFENDER]!.hp).toBe(40);
    expect(s.duel!.outcome!.winner).toBe('defender');
    expect(s.duel!.outcome!.loserFate).toBe('deciding');
  });

  it('kills a Knight brought to 0 HP and ends the duel at once', () => {
    let s = readyToAttack();
    s = { ...s, knights: { ...s.knights, [DEFENDER]: { ...s.knights[DEFENDER]!, hp: 10 } } };
    s = setSergeants(s, ATTACKER, ['rush', 'rush']);
    s = setSergeants(s, DEFENDER, ['flank', 'flank']);
    s = act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER });
    s = clash(s, 1, 1);
    expect(s.duel!.clashes).toHaveLength(1);
    expect(s.duel!.outcome).toEqual({ winner: 'attacker', loserFate: 'killed' });
    expect(s.knights[DEFENDER]).toMatchObject({ status: 'dead', position: null, hp: 0 });
    expect(knightMilitia(s.knights[DEFENDER]!)).toBe(0);
  });

  it('keeps both Knights when HP ends equal (the defender holds)', () => {
    let s = readyToAttack();
    s = setSergeants(s, ATTACKER, ['rush']);
    s = setSergeants(s, DEFENDER, ['rush']);
    s = act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER });
    s = clash(s, 1, 1);
    expect(s.duel!.outcome).toEqual({ winner: null, loserFate: null });
    expect(s.knights[DEFENDER]!.status).toBe('fielded');
    expect(s.knights[ATTACKER]!.status).toBe('fielded');
  });

  it('carries losses into later battles and into the militia totals', () => {
    let s = readyToAttack();
    s = setSergeants(s, ATTACKER, ['rush']);
    s = setSergeants(s, DEFENDER, ['flank', 'counter']);
    const before = captainMilitia(s, 'p2-garrison-1');
    s = act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER });
    s = clash(s, 1, 1);
    // The attacker is out of Sergeants; the defender's last one strikes unopposed.
    s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: `${DEFENDER}-s2` });
    expect(s.duel!.outcome).not.toBeNull();
    // Defender lost 10 HP and a 10-man Sergeant; nobody regenerates.
    expect(s.knights[DEFENDER]!.hp).toBe(40);
    expect(s.knights[DEFENDER]!.sergeants).toHaveLength(1);
    expect(captainMilitia(s, 'p2-garrison-1')).toBe(before - 20);
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.duel).toBeNull();
    expect(s.knights[DEFENDER]!.hp).toBe(40);
  });
});

describe('Computer Sergeant choice', () => {
  it('commits one of its own available Sergeants without needing the other side’s pick', () => {
    const s = act(readyToAttack(), { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER });
    const action = chooseSergeant(s, 'p2', () => 0);
    expect(action).toEqual({ type: 'commitSergeant', player: 'p2', sergeantId: `${DEFENDER}-s1` });
  });
});
