import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { attackers, canEndTurn, captainCanAct, captainMilitia, decisiveRoller } from '../src/engine/queries';
import { spread } from '../src/engine/rules/decisive';
import type { MatchAction } from '../src/engine/actions';
import type { MatchState, SquareIndex } from '../src/engine/state';

function act(state: MatchState, action: MatchAction): MatchState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function rejected(state: MatchState, action: MatchAction): string {
  const result = applyAction(state, action);
  if (result.ok) throw new Error('expected a rejection');
  return result.reason;
}

const P1 = 'p1-raiders-1';
const P2 = 'p2-garrison-1';

/** Both Captains in the Heartland (Region 4); Player 1 is giving orders. */
function heartland(p1: [string, SquareIndex][], p2: [string, SquareIndex][]): MatchState {
  let s = createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: ['raiders', 'army', 'garrison'] });
  s = act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
  s.captains[P1] = { ...s.captains[P1]!, region: 4 };
  s.captains[P2] = { ...s.captains[P2]!, region: 4 };
  for (const [id, square] of [...p1, ...p2]) {
    s.knights[id] = { ...s.knights[id]!, status: 'fielded', position: { region: 4, square } };
  }
  return { ...s, turn: { ...s.turn!, step: 'orders', captainId: P1 } };
}

/** Player 1's Knight 1 (square 3) beats Player 2's Knight 1 (square 4) in one clash. */
function winQuickly(s: MatchState): MatchState {
  s.knights[`${P1}-k1`] = { ...s.knights[`${P1}-k1`]!, subclass: null, sergeants: [{ id: 'a', tactic: 'rush', militia: 10 }] };
  s.knights[`${P2}-k1`] = { ...s.knights[`${P2}-k1`]!, subclass: null, hp: 5, sergeants: [{ id: 'b', tactic: 'flank', militia: 10 }] };
  s = act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: `${P1}-k1`, targetKnightId: `${P2}-k1` });
  s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: 'b' });
  return act(s, { type: 'commitSergeant', player: 'p1', sergeantId: 'a' });
}

describe('Orders: place and attack in either order', () => {
  it('lets a Knight already on the board attack first, then place', () => {
    let s = heartland([[`${P1}-k1`, 3]], [[`${P2}-k1`, 4]]);
    expect(attackers(s).map((k) => k.id)).toEqual([`${P1}-k1`]);
    expect(canEndTurn(s)).toBe(false);
    expect(rejected(s, { type: 'endTurn', player: 'p1' })).toMatch(/Place a Knight or attack/);
    s = winQuickly(s);
    expect(s.duel!.outcome!.loserFate).toBe('killed');
    expect(s.turn!.step).toBe('orders'); // can still place
    expect(attackers(s)).toEqual([]);
    expect(canEndTurn(s)).toBe(true);
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: `${P1}-k2`, square: 0 });
    expect(s.turn!.step).toBe('end');
    expect(s.route).toBe(0);
  });

  it('allows only one attack and one placement per turn', () => {
    let s = heartland([[`${P1}-k1`, 3]], [[`${P2}-k1`, 4], [`${P2}-k2`, 6]]);
    s = winQuickly(s);
    expect(rejected(s, { type: 'declareAttack', player: 'p1', attackerKnightId: `${P1}-k1`, targetKnightId: `${P2}-k2` })).toMatch(
      /already attacked/,
    );
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: `${P1}-k2`, square: 0 });
    expect(rejected(s, { type: 'placeKnight', player: 'p1', knightId: `${P1}-k3`, square: 2 })).toMatch(/already placed/);
  });

  it('lets a Captain with nobody left to place still act by attacking; that turn routes nobody', () => {
    let s = heartland(
      [[`${P1}-k1`, 3], [`${P1}-k2`, 0], [`${P1}-k3`, 8]],
      [[`${P2}-k1`, 4]],
    );
    s = { ...s, route: 7 };
    expect(captainCanAct(s, s.captains[P1]!)).toBe(true);
    s = winQuickly(s);
    expect(s.turn!.step).toBe('end');
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.route).toBeNull();
  });

  it('only attacks when a target is in reach', () => {
    const s = heartland([[`${P1}-k1`, 0]], [[`${P2}-k1`, 8]]);
    expect(attackers(s)).toEqual([]);
    expect(rejected(s, { type: 'declareAttack', player: 'p1', attackerKnightId: `${P1}-k1`, targetKnightId: `${P2}-k1` })).toMatch(
      /cannot attack/,
    );
  });
});

/** Every Knight of both Captains is on the Heartland board, no line: a stalemate as Player 1's turn ends. */
function stalemate(): MatchState {
  const s = heartland(
    [[`${P1}-k1`, 0], [`${P1}-k2`, 2], [`${P1}-k3`, 7]],
    [[`${P2}-k1`, 1], [`${P2}-k2`, 3], [`${P2}-k3`, 8]],
  );
  return { ...s, turn: { ...s.turn!, step: 'end', placedKnightId: `${P1}-k3` } };
}

describe('Decisive battle', () => {
  it('starts when the turn ends in a Region where no more Knights can be placed', () => {
    const s = act(stalemate(), { type: 'endTurn', player: 'p1' });
    expect(s.turn).toMatchObject({ player: 'p1', step: 'decisive' });
    expect(s.decisive).toMatchObject({
      region: 4,
      first: 'p1',
      startMen: { p1: 400, p2: 400 },
      chances: { p1: 3, p2: 3 },
      outcome: null,
    });
    expect(decisiveRoller(s)).toBe('p1');
  });

  it('takes turns rolling; each roll costs the other side (men × die) ÷ 10', () => {
    let s = act(stalemate(), { type: 'endTurn', player: 'p1' });
    s = act(s, { type: 'rollDie', player: 'p1', value: 6 });
    expect(s.decisive!.men).toEqual({ p1: 400, p2: 160 });
    expect(rejected(s, { type: 'rollDie', player: 'p1', value: 3 })).toMatch(/not your roll/);
    expect(rejected(s, { type: 'rollDie', player: 'p2', value: 7 })).toMatch(/1 to 6/);
    s = act(s, { type: 'rollDie', player: 'p2', value: 1 });
    expect(s.decisive!.men).toEqual({ p1: 384, p2: 160 });
  });

  it('gives the winner the Region; the loser’s Knights there are captured and its Captain returns', () => {
    let s = act(stalemate(), { type: 'endTurn', player: 'p1' });
    s = act(s, { type: 'rollDie', player: 'p1', value: 6 });
    for (let i = 0; i < 5; i++) s = act(s, { type: 'rollDie', player: decisiveRoller(s)!, value: 1 });
    expect(s.decisive!.men).toEqual({ p1: 364, p2: 85 });
    expect(s.decisive!.outcome).toEqual({ winner: 'p1', loserKilled: false });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.secured[4]).toMatchObject({ player: 'p1', captainId: P1 });
    expect(['k1', 'k2', 'k3'].map((k) => s.knights[`${P2}-${k}`]!.status)).toEqual(['captured', 'captured', 'captured']);
    expect(s.captains[P2]).toMatchObject({ region: null, fallen: false });
    // Losses were spread over each Captain's men.
    expect(captainMilitia(s, P1)).toBe(364);
    expect(s.captains[P2]!.reserve).toBe(Math.round(170 - (170 / 400) * 315));
    expect(s.turn).toMatchObject({ player: 'p2', step: 'command' });
    expect(s.decisive).toBeNull();
  });

  it('kills a Captain whose men are all lost', () => {
    let s = stalemate();
    s.captains[P1] = { ...s.captains[P1]!, reserve: 2000 };
    s = act(s, { type: 'endTurn', player: 'p1' });
    s = act(s, { type: 'rollDie', player: 'p1', value: 6 });
    expect(s.decisive!.outcome).toEqual({ winner: 'p1', loserKilled: true });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.captains[P2]).toMatchObject({ fallen: true, region: null });
    expect(Object.values(s.knights).filter((k) => k.captainId === P2 && k.status !== 'unmanned').every((k) => k.status === 'dead')).toBe(true);
  });

  it('closes the Region when both sides end level', () => {
    let s = stalemate();
    for (const k of ['k1', 'k2', 'k3']) {
      s.knights[`${P1}-${k}`] = { ...s.knights[`${P1}-${k}`]!, status: 'dead', position: null };
      s.knights[`${P2}-${k}`] = { ...s.knights[`${P2}-${k}`]!, status: 'dead', position: null };
    }
    s.captains[P1] = { ...s.captains[P1]!, reserve: 100 };
    s.captains[P2] = { ...s.captains[P2]!, reserve: 100 };
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.decisive!.outcome).toEqual({ winner: null, loserKilled: false });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.closed).toEqual([4]);
    expect(s.secured[4]).toBeUndefined();
    expect([s.captains[P1]!.region, s.captains[P2]!.region]).toEqual([null, null]);
  });

  it('spreads losses in proportion', () => {
    expect(spread([10, 20, 30], 6)).toEqual([1, 2, 3]);
    expect(spread([10, 20, 30], 7).reduce((a, b) => a + b, 0)).toBe(7);
    expect(spread([5, 5], 20)).toEqual([5, 5]);
  });
});

describe('Undo a placement', () => {
  it('takes the Knight back until an attack is made', () => {
    let s = heartland([[`${P1}-k1`, 3]], [[`${P2}-k1`, 4]]);
    const before = s;
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: `${P1}-k2`, square: 0 });
    expect(s.route).toBe(0);
    s = act(s, { type: 'undoKnight', player: 'p1' });
    expect(s.knights[`${P1}-k2`]).toMatchObject({ status: 'ready', position: null });
    expect(s.route).toBe(before.route);
    expect(s.turn).toMatchObject({ step: 'orders', placedKnightId: null });
    // Place again, then attack: the placement is locked in.
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: `${P1}-k2`, square: 6 });
    s = winQuickly(s);
    expect(rejected(s, { type: 'undoKnight', player: 'p1' })).toMatch(/nothing to undo/);
  });

  it('undoes a placement that secured the Region, freeing the captured Knights', () => {
    let s = heartland([[`${P1}-k1`, 0], [`${P1}-k2`, 1]], [[`${P2}-k1`, 4]]);
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: `${P1}-k3`, square: 2 });
    expect(s.secured[4]).toBeDefined();
    expect(s.knights[`${P2}-k1`]!.status).toBe('captured');
    s = act(s, { type: 'undoKnight', player: 'p1' });
    expect(s.secured[4]).toBeUndefined();
    expect(s.knights[`${P2}-k1`]!.status).toBe('fielded');
    expect(s.captains[P2]!.region).toBe(4);
  });
});

describe('Moving a Knight', () => {
  it('steps one square up, down, left or right instead of placing; no attack follows', () => {
    let s = heartland([[`${P1}-k1`, 0]], [[`${P2}-k1`, 4]]);
    expect(rejected(s, { type: 'moveKnight', player: 'p1', knightId: `${P1}-k1`, square: 2 })).toMatch(/directly up, down/);
    s = act(s, { type: 'moveKnight', player: 'p1', knightId: `${P1}-k1`, square: 1 });
    expect(s.knights[`${P1}-k1`]!.position).toEqual({ region: 4, square: 1 });
    expect(s.route).toBe(1);
    expect(s.turn!.step).toBe('end');
    expect(attackers(s)).toEqual([]);
    expect(rejected(s, { type: 'placeKnight', player: 'p1', knightId: `${P1}-k2`, square: 0 })).toMatch(/already moved/);
    s = act(s, { type: 'undoKnight', player: 'p1' });
    expect(s.knights[`${P1}-k1`]!.position).toEqual({ region: 4, square: 0 });
    expect(s.turn).toMatchObject({ step: 'orders', movedKnightId: null });
  });

  it('is not allowed after placing or after a battle', () => {
    let s = heartland([[`${P1}-k1`, 3]], [[`${P2}-k1`, 4]]);
    const placed = act(s, { type: 'placeKnight', player: 'p1', knightId: `${P1}-k2`, square: 8 });
    expect(rejected(placed, { type: 'moveKnight', player: 'p1', knightId: `${P1}-k1`, square: 0 })).toMatch(/after placing/);
    s = winQuickly(s);
    expect(rejected(s, { type: 'moveKnight', player: 'p1', knightId: `${P1}-k1`, square: 0 })).toMatch(/after a battle/);
  });

  it('lets a Captain with nothing to place or attack still act by moving', () => {
    const s = heartland([[`${P1}-k1`, 0], [`${P1}-k2`, 8], [`${P1}-k3`, 6]], [[`${P2}-k1`, 2]]);
    expect(attackers(s)).toEqual([]);
    expect(captainCanAct(s, s.captains[P1]!)).toBe(true);
  });
});
