import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { availableSergeants, lordMilitia } from '../src/engine/queries';
import type { MatchAction } from '../src/engine/actions';
import type { KnightSubclass, MatchState, Sergeant, Tactic } from '../src/engine/state';

function act(state: MatchState, action: MatchAction): MatchState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

const ATTACKER = 'p1-army-1-k1';
const DEFENDER = 'p2-garrison-1-k1';

/** A duel between two Knights with the given types and Sergeants (10 men each unless set). */
function duel(
  attacker: { subclass: KnightSubclass | null; tactics: Tactic[]; men?: number[]; hp?: number },
  defender: { subclass: KnightSubclass | null; tactics: Tactic[]; men?: number[]; hp?: number },
): MatchState {
  let s = createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: ['army', 'raiders', 'garrison'] });
  s = act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
  s.captains['p2-garrison-1'] = { ...s.captains['p2-garrison-1']!, region: 4 };
  s.knights[DEFENDER] = { ...s.knights[DEFENDER]!, status: 'fielded', position: { region: 4, square: 4 } };
  s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-army-1', region: 4 });
  s = act(s, { type: 'placeKnight', player: 'p1', knightId: ATTACKER, square: 1 });
  const sg = (id: string, t: Tactic[], men?: number[]): Sergeant[] =>
    t.map((tactic, i) => ({ id: `${id}-s${i + 1}`, tactic, militia: men?.[i] ?? 10 }));
  s.knights[ATTACKER] = { ...s.knights[ATTACKER]!, subclass: attacker.subclass, hp: attacker.hp ?? 50, sergeants: sg(ATTACKER, attacker.tactics, attacker.men) };
  s.knights[DEFENDER] = { ...s.knights[DEFENDER]!, subclass: defender.subclass, hp: defender.hp ?? 50, sergeants: sg(DEFENDER, defender.tactics, defender.men) };
  return act(s, { type: 'declareAttack', player: 'p1', targetKnightId: DEFENDER });
}

function clash(s: MatchState, a: number, d: number): MatchState {
  s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: `${DEFENDER}-s${d}` });
  return act(s, { type: 'commitSergeant', player: 'p1', sergeantId: `${ATTACKER}-s${a}` });
}

describe('Raiders Knight types', () => {
  it('cycle Skirmisher, Ambusher and Saboteur; Sergeants 4 / 3 / 2; still 1,000 per Lord', () => {
    const s = createMatch();
    const k = (n: number) => s.knights[`p1-raiders-1-k${n}`]!;
    expect([k(1).subclass, k(2).subclass, k(3).subclass]).toEqual(['skirmisher', 'ambusher', 'saboteur']);
    expect([k(1).sergeants.length, k(2).sergeants.length, k(3).sergeants.length]).toEqual([4, 3, 2]);
    expect(lordMilitia(s, 'p1', 'raiders')).toBe(1000);
  });
});

describe('Skirmisher: Heist', () => {
  it('wins its first clash whatever the tactics, then fights normally', () => {
    // Rush would lose to Counter, but Heist wins the first clash.
    let s = duel({ subclass: 'skirmisher', tactics: ['rush', 'rush'] }, { subclass: null, tactics: ['counter', 'counter'] });
    s = clash(s, 1, 1);
    expect(s.duel!.clashes[0]).toMatchObject({ winner: 'attacker', heist: 'attacker', damage: 10 });
    s = clash(s, 2, 2);
    expect(s.duel!.clashes[1]).toMatchObject({ winner: 'defender' });
    expect(s.duel!.clashes[1]!.heist).toBeUndefined();
  });

  it('cancels out when both Knights are Skirmishers', () => {
    let s = duel({ subclass: 'skirmisher', tactics: ['rush'] }, { subclass: 'skirmisher', tactics: ['counter'] });
    s = clash(s, 1, 1);
    expect(s.duel!.clashes[0]).toMatchObject({ winner: 'defender' });
    expect(s.duel!.clashes[0]!.heist).toBeUndefined();
  });
});

describe('Ambusher: Ambush!', () => {
  it("keeps the opponent's two strongest Sergeants out of this battle only", () => {
    const s = duel(
      { subclass: 'ambusher', tactics: ['rush', 'flank', 'counter'] },
      { subclass: null, tactics: ['rush', 'flank', 'counter', 'rush'], men: [10, 30, 20, 5] },
    );
    expect(s.duel!.prelude).toEqual([
      { type: 'ambush', knightId: ATTACKER, targetId: DEFENDER, sergeantIds: [`${DEFENDER}-s2`, `${DEFENDER}-s3`] },
    ]);
    expect(availableSergeants(s, s.duel!, 'defender').map((x) => x.id)).toEqual([`${DEFENDER}-s1`, `${DEFENDER}-s4`]);
    expect(applyAction(s, { type: 'commitSergeant', player: 'p2', sergeantId: `${DEFENDER}-s2` }).ok).toBe(false);
    // Not harmed: they are still on the Knight for later battles.
    expect(s.knights[DEFENDER]!.sergeants).toHaveLength(4);
  });

  it('works when defending too', () => {
    const s = duel({ subclass: null, tactics: ['rush', 'flank', 'counter'] }, { subclass: 'ambusher', tactics: ['rush'] });
    expect(s.duel!.blocked.attacker).toHaveLength(2);
  });
});

describe('Saboteur: Sabotage', () => {
  it('costs the opponent 1 HP after every clash, ties included', () => {
    let s = duel({ subclass: 'saboteur', tactics: ['rush', 'rush'] }, { subclass: null, tactics: ['rush', 'flank'] });
    s = clash(s, 1, 1); // tie
    expect(s.duel!.clashes[0]).toMatchObject({ winner: 'tie', sabotaged: ['defender'] });
    expect(s.knights[DEFENDER]!.hp).toBe(49);
    s = clash(s, 2, 2); // Rush beats Flank: 10 + 1
    expect(s.knights[DEFENDER]!.hp).toBe(38);
  });

  it('can finish off a Knight at 1 HP', () => {
    let s = duel({ subclass: 'saboteur', tactics: ['rush', 'rush'] }, { subclass: null, tactics: ['rush', 'rush'], hp: 1 });
    s = clash(s, 1, 1);
    expect(s.duel!.outcome).toEqual({ winner: 'attacker', loserFate: 'killed' });
  });
});
