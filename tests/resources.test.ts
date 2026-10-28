import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { captainMilitia, knightMilitia } from '../src/engine/queries';
import { RESOURCES } from '../src/engine/config';
import type { MatchAction } from '../src/engine/actions';
import type { MatchState, Sergeant, Tactic } from '../src/engine/state';

/** These tests predate Attrition: mark it spent so the battle ends when the Sergeants do. */
function noAttrition(s: MatchState): MatchState {
  return s.duel ? { ...s, duel: { ...s.duel, attritionUsed: { attacker: true, defender: true } } } : s;
}

function act(state: MatchState, action: MatchAction): MatchState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function started(): MatchState {
  let s = createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: ['raiders', 'army', 'garrison'] });
  return act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
}

describe('Resources (experimental)', () => {
  it('start at the configured amount for each player', () => {
    expect(started().resources).toEqual({ p1: RESOURCES.startingAmount, p2: RESOURCES.startingAmount });
  });

  it('charge 1 per man for deploying a Captain (whole company) and placing a Knight; nothing at turn end', () => {
    let s = started();
    const company = captainMilitia(s, 'p1-raiders-1');
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(s.resources!.p1).toBe(12000 - company);
    const knightMen = knightMilitia(s.knights['p1-raiders-1-k1']!);
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    expect(s.resources!.p1).toBe(12000 - company - knightMen);
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.resources!.p1).toBe(12000 - company - knightMen);
    expect(s.resources!.p2).toBe(12000);
  });

  it('refunds a placement that is undone', () => {
    let s = started();
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    const before = s.resources!.p1;
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    s = act(s, { type: 'undoKnight', player: 'p1' });
    expect(s.resources!.p1).toBe(before);
  });

  it('out of Resources: each action costs 1% of the acting party’s men (at least 1)', () => {
    let s = started();
    s = { ...s, resources: { p1: 0, p2: 12000 } };
    const company = captainMilitia(s, 'p1-raiders-1');
    const reserve = s.captains['p1-raiders-1']!.reserve;
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(s.captains['p1-raiders-1']!.reserve).toBe(reserve - Math.ceil(company * 0.01));
    const men = knightMilitia(s.knights['p1-raiders-1-k1']!);
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    expect(knightMilitia(s.knights['p1-raiders-1-k1']!)).toBe(men - Math.max(1, Math.ceil(men * 0.01)));
    expect(s.resources!.p1).toBe(0);
  });

  it('out of Resources: troops no longer waste away at the end of a turn', () => {
    let s = started();
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    s = { ...s, resources: { p1: 0, p2: 12000 } };
    const men = knightMilitia(s.knights['p1-raiders-1-k1']!);
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(knightMilitia(s.knights['p1-raiders-1-k1']!)).toBe(men);
  });

  it('spends down to 0 when the pool cannot cover an action, and says so', () => {
    let s = started();
    s = { ...s, resources: { p1: 10, p2: 12000 } };
    const result = applyAction(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.resources!.p1).toBe(0);
    expect(result.events.some((e) => e.type === 'resourcesDepleted')).toBe(true);
  });

  it('change nothing when switched off', () => {
    let s: MatchState = { ...started(), resources: null };
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.resources).toBeNull();
    expect(s.wagers).toEqual([]);
  });
});

// --- Wager pools ---

const ATTACKER = 'p1-army-1-k1';
const DEFENDER = 'p2-garrison-1-k1';

/** Player 1's p1-army-1-k1 (Heartland square 1) may attack p2-garrison-1-k1 (square 4). Plain Knights. */
function readyToAttack(): MatchState {
  let s = started();
  s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 1 });
  s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 4 });
  s = act(s, { type: 'endTurn', player: 'p1' });
  s = act(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 4 });
  s = act(s, { type: 'placeKnight', player: 'p2', knightId: DEFENDER, square: 4 });
  s = act(s, { type: 'endTurn', player: 'p2' });
  s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-army-1', region: 4 });
  s = act(s, { type: 'placeKnight', player: 'p1', knightId: ATTACKER, square: 1 });
  s.knights[ATTACKER] = { ...s.knights[ATTACKER]!, subclass: null };
  s.knights[DEFENDER] = { ...s.knights[DEFENDER]!, subclass: null, hp: 50 };
  return s;
}

function setSergeants(s: MatchState, knightId: string, tactics: Tactic[], militia = 10): MatchState {
  const sergeants: Sergeant[] = tactics.map((tactic, i) => ({ id: `${knightId}-s${i + 1}`, tactic, militia }));
  return { ...s, knights: { ...s.knights, [knightId]: { ...s.knights[knightId]!, sergeants } } };
}

/** The attacker (Rush) beats the defender (Flank) in one clash; the defender survives and must choose. */
function defenderLoses(): MatchState {
  let s = readyToAttack();
  s = setSergeants(s, ATTACKER, ['rush']);
  s = setSergeants(s, DEFENDER, ['flank']);
  s = noAttrition(act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER }));
  s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: `${DEFENDER}-s1` });
  return act(s, { type: 'commitSergeant', player: 'p1', sergeantId: `${ATTACKER}-s1` });
}

describe('Wager pools', () => {
  it('the loser of a Knight battle pays Resources for every man lost into a pool', () => {
    const before = readyToAttack().resources!.p2;
    const s = defenderLoses();
    // The Flank Sergeant (10) is lost and the Knight takes 10 damage: 20 men.
    expect(s.resources!.p2).toBe(before - 20);
    expect(s.wagers).toHaveLength(1);
    expect(s.wagers[0]).toMatchObject({ amount: 20, sides: [{ player: 'p1', knightId: ATTACKER }, { player: 'p2', knightId: DEFENDER }] });
  });

  it('a loser who retreats leaves the square: the winner collects the pool', () => {
    let s = defenderLoses();
    const p1 = s.resources!.p1;
    const result = applyAction(s, { type: 'chooseRetreat', player: 'p2', retreat: true });
    if (!result.ok) throw new Error(result.reason);
    s = result.state;
    expect(s.resources!.p1).toBe(p1 + 20);
    expect(s.wagers).toEqual([]);
    expect(result.events).toContainEqual({ type: 'wagerWon', player: 'p1', amount: 20 });
  });

  it('a loser who holds pays the Knight’s men, and the pool waits until one of them leaves', () => {
    let s = defenderLoses();
    const p2 = s.resources!.p2;
    const men = knightMilitia(s.knights[DEFENDER]!);
    s = act(s, { type: 'chooseRetreat', player: 'p2', retreat: false });
    expect(s.resources!.p2).toBe(p2 - men);
    expect(s.wagers).toHaveLength(1);
    // Later the winner leaves its square (retreats here): the loser who held collects.
    const p2now = s.resources!.p2;
    s = { ...s, knights: { ...s.knights, [ATTACKER]: { ...s.knights[ATTACKER]!, status: 'ready', position: null } } };
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.resources!.p2).toBe(p2now + 20);
    expect(s.wagers).toEqual([]);
  });

  it('an undone move puts the pool back', () => {
    let s = defenderLoses();
    s = act(s, { type: 'chooseRetreat', player: 'p2', retreat: false });
    s = act(s, { type: 'endTurn', player: 'p1' });
    // Player 2's turn: their holding Knight steps away, then takes it back.
    s = { ...s, turn: { ...s.turn!, step: 'orders', captainId: 'p2-garrison-1' } };
    const pooled = s.resources!.p1;
    const square = [3, 5, 7].find((sq) => !Object.values(s.knights).some((k) => k.position?.region === 4 && k.position.square === sq))!;
    s = act(s, { type: 'moveKnight', player: 'p2', knightId: DEFENDER, square: square as 3 | 5 | 7 });
    expect(s.resources!.p1).toBe(pooled + 20);
    s = act(s, { type: 'undoKnight', player: 'p2' });
    expect(s.resources!.p1).toBe(pooled);
    expect(s.wagers).toHaveLength(1);
  });
});
