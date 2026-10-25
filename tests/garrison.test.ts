import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { knightHpMen, lordMilitia } from '../src/engine/queries';
import type { MatchAction } from '../src/engine/actions';
import type { KnightSubclass, MatchState, SquareIndex } from '../src/engine/state';

function act(state: MatchState, action: MatchAction): MatchState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

const ATTACKER = 'p1-army-1-k1';

/**
 * Player 1's Knight (plain, 50 HP) has just been placed on Heartland square 1.
 * Player 2's Garrison Knights stand where given; the first is the target on square 4.
 */
function arena(defenders: { id: string; square: SquareIndex; subclass: KnightSubclass; strongest?: number }[], attackerHp = 50) {
  let s = createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: ['army', 'raiders', 'garrison'] });
  s = act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
  s.captains['p2-garrison-1'] = { ...s.captains['p2-garrison-1']!, region: 4 };
  for (const d of defenders) {
    const k = s.knights[d.id]!;
    s.knights[d.id] = {
      ...k,
      subclass: d.subclass,
      status: 'fielded',
      position: { region: 4, square: d.square },
      sergeants: k.sergeants.map((sg, i) => ({ ...sg, militia: i === 0 && d.strongest ? d.strongest : sg.militia })),
    };
  }
  s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-army-1', region: 4 });
  s = act(s, { type: 'placeKnight', player: 'p1', knightId: ATTACKER, square: 1 });
  s.knights[ATTACKER] = { ...s.knights[ATTACKER]!, subclass: null, hp: attackerHp };
  return s;
}

describe('Garrison Knight types', () => {
  it('cycle Gatekeeper, Watchman and Warden, with their Sergeant counts and HP, still 1,000 per Lord', () => {
    const s = createMatch();
    const k = (n: number) => s.knights[`p1-garrison-1-k${n}`]!;
    expect([k(1).subclass, k(2).subclass, k(3).subclass]).toEqual(['gatekeeper', 'watchman', 'warden']);
    expect([k(1).sergeants.length, k(2).sergeants.length, k(3).sergeants.length]).toEqual([2, 3, 3]);
    expect(k(1).hp).toBe(50); // Brace adds 50 in its first battle
    expect(k(2).hp).toBe(50);
    expect(lordMilitia(s, 'p1', 'garrison')).toBe(1000);
  });
});

describe('Warden: First Strike', () => {
  it('hits the attacker with its strongest Sergeant before the first clash', () => {
    let s = arena([{ id: 'p2-garrison-1-k3', square: 4, subclass: 'warden', strongest: 15 }]);
    s = act(s, { type: 'declareAttack', player: 'p1', targetKnightId: 'p2-garrison-1-k3' });
    expect(s.duel!.prelude).toEqual([
      { type: 'firstStrike', knightId: 'p2-garrison-1-k3', targetId: ATTACKER, damage: 15, killed: false },
    ]);
    expect(s.knights[ATTACKER]!.hp).toBe(35);
    expect(s.duel!.attacker.startHp).toBe(50);
    expect(s.duel!.outcome).toBeNull();
  });

  it('can kill the attacker, ending the battle at once', () => {
    let s = arena([{ id: 'p2-garrison-1-k3', square: 4, subclass: 'warden', strongest: 15 }], 12);
    s = act(s, { type: 'declareAttack', player: 'p1', targetKnightId: 'p2-garrison-1-k3' });
    expect(s.duel!.prelude[0]).toMatchObject({ damage: 12, killed: true });
    expect(s.duel!.outcome).toEqual({ winner: 'defender', loserFate: 'killed' });
    expect(s.knights[ATTACKER]!.status).toBe('dead');
  });
});

describe('Watchman: Snipe', () => {
  it('fires when the Gatekeeper next to it is attacked', () => {
    let s = arena([
      { id: 'p2-garrison-1-k1', square: 4, subclass: 'gatekeeper' },
      { id: 'p2-garrison-1-k2', square: 5, subclass: 'watchman', strongest: 20 },
    ]);
    s = act(s, { type: 'declareAttack', player: 'p1', targetKnightId: 'p2-garrison-1-k1' });
    expect(s.duel!.prelude.filter((e) => e.type !== 'brace')).toEqual([
      { type: 'snipe', knightId: 'p2-garrison-1-k2', targetId: ATTACKER, damage: 20, killed: false },
    ]);
  });

  it('fires when the Watchman itself is attacked next to a Gatekeeper, but not alone', () => {
    let s = arena([
      { id: 'p2-garrison-1-k2', square: 4, subclass: 'watchman' },
      { id: 'p2-garrison-1-k1', square: 7, subclass: 'gatekeeper' },
    ]);
    s = act(s, { type: 'declareAttack', player: 'p1', targetKnightId: 'p2-garrison-1-k2' });
    expect(s.duel!.prelude.map((e) => e.type)).toEqual(['snipe']);

    let alone = arena([{ id: 'p2-garrison-1-k2', square: 4, subclass: 'watchman' }]);
    alone = act(alone, { type: 'declareAttack', player: 'p1', targetKnightId: 'p2-garrison-1-k2' });
    expect(alone.duel!.prelude).toEqual([]);
  });

  it('does not fire when a Gatekeeper is attacked with no Watchman beside it', () => {
    let s = arena([{ id: 'p2-garrison-1-k1', square: 4, subclass: 'gatekeeper' }]);
    s = act(s, { type: 'declareAttack', player: 'p1', targetKnightId: 'p2-garrison-1-k1' });
    expect(s.duel!.prelude.filter((e) => e.type !== 'brace')).toEqual([]);
  });
});

describe('Gatekeeper: Brace', () => {
  it('doubles HP in its first battle without adding militia: each man is worth 2 HP', () => {
    let s = arena([{ id: 'p2-garrison-1-k1', square: 4, subclass: 'gatekeeper' }]);
    const reserve = s.captains['p2-garrison-1']!.reserve;
    const total = lordMilitia(s, 'p2', 'garrison');
    s = act(s, { type: 'declareAttack', player: 'p1', targetKnightId: 'p2-garrison-1-k1' });
    expect(s.duel!.prelude[0]).toEqual({ type: 'brace', knightId: 'p2-garrison-1-k1', amount: 50 });
    expect(s.knights['p2-garrison-1-k1']).toMatchObject({ hp: 100, braced: true });
    expect(s.duel!.defender.startHp).toBe(100);
    expect(s.captains['p2-garrison-1']!.reserve).toBe(reserve);
    expect(lordMilitia(s, 'p2', 'garrison')).toBe(total);
    // Men are half the HP, rounded up: 97 HP is 49 men.
    expect(knightHpMen({ hp: 97, braced: true })).toBe(49);
  });

  it('is used only once per game', () => {
    let s = arena([{ id: 'p2-garrison-1-k1', square: 4, subclass: 'gatekeeper' }]);
    s.knights['p2-garrison-1-k1'] = { ...s.knights['p2-garrison-1-k1']!, braced: true };
    s = act(s, { type: 'declareAttack', player: 'p1', targetKnightId: 'p2-garrison-1-k1' });
    expect(s.duel!.prelude).toEqual([]);
    expect(s.knights['p2-garrison-1-k1']!.hp).toBe(50);
  });
});
