import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import type { MatchAction } from '../src/engine/actions';
import type { KnightSubclass, MatchState, Sergeant, Tactic } from '../src/engine/state';

/** These tests predate Attrition: mark it spent so the battle ends when the Sergeants do. */
function noAttrition(s: MatchState): MatchState {
  return s.duel ? { ...s, duel: { ...s.duel, attritionUsed: { attacker: true, defender: true } } } : s;
}

function act(state: MatchState, action: MatchAction): MatchState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

const ATTACKER = 'p1-army-1-k1';
const DEFENDER = 'p2-garrison-1-k1';

/** Player 1's Army Knight has just been placed next to Player 2's Knight in the Heartland. */
function readyToAttack(): MatchState {
  let s = createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: ['raiders', 'army', 'garrison'] });
  s = act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
  s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 1 });
  s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 4 });
  s = act(s, { type: 'endTurn', player: 'p1' });
  s = act(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 4 });
  s = act(s, { type: 'placeKnight', player: 'p2', knightId: DEFENDER, square: 4 });
  s = act(s, { type: 'endTurn', player: 'p2' });
  s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-army-1', region: 4 });
  s = act(s, { type: 'placeKnight', player: 'p1', knightId: ATTACKER, square: 1 });
  // The opponent is a plain Knight here, so only Army abilities apply.
  s.knights[DEFENDER] = { ...s.knights[DEFENDER]!, subclass: null, hp: 50 };
  return s;
}

function setup(
  attacker: { tactics: Tactic[]; subclass: KnightSubclass | null; hp?: number },
  defender: { tactics: Tactic[]; hp?: number },
): MatchState {
  let s = readyToAttack();
  const sg = (id: string, tactics: Tactic[]): Sergeant[] => tactics.map((tactic, i) => ({ id: `${id}-s${i + 1}`, tactic, militia: 10 }));
  s = {
    ...s,
    knights: {
      ...s.knights,
      [ATTACKER]: { ...s.knights[ATTACKER]!, subclass: attacker.subclass, sergeants: sg(ATTACKER, attacker.tactics), hp: attacker.hp ?? 50 },
      [DEFENDER]: { ...s.knights[DEFENDER]!, sergeants: sg(DEFENDER, defender.tactics), hp: defender.hp ?? 50 },
    },
  };
  return noAttrition(act(s, { type: 'declareAttack', player: 'p1', attackerKnightId: ATTACKER, targetKnightId: DEFENDER }));
}

function clash(s: MatchState, a: number, d: number): MatchState {
  s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: `${DEFENDER}-s${d}` });
  return act(s, { type: 'commitSergeant', player: 'p1', sergeantId: `${ATTACKER}-s${a}` });
}

describe('Army Knight types', () => {
  it('lead 5, 4 and 3 Sergeants (Infantry, Cavalry, Archers)', () => {
    const s = createMatch();
    expect([1, 2, 3].map((n) => s.knights[`p1-army-1-k${n}`]!.sergeants.length)).toEqual([5, 4, 3]);
  });

  it('cycles Infantry, Cavalry and Archers for Army Knights only', () => {
    const s = createMatch();
    expect(s.knights['p1-army-1-k1']!.subclass).toBe('infantry');
    expect(s.knights['p1-army-1-k2']!.subclass).toBe('cavalry');
    expect(s.knights['p1-army-2-k3']!.subclass).toBe('archers');
    expect(s.knights['p1-army-2-k4']!.subclass).toBe('infantry');
    expect(s.knights['p1-garrison-1-k1']!.subclass).toBe('gatekeeper');
    expect(s.knights['p2-raiders-1-k2']!.subclass).toBe('ambusher');
  });
});

describe('Infantry: Regroup', () => {
  it('restores Sergeants that tied a clash back to their starting men', () => {
    // Tie (both lose 5), then a win: attacker wins on HP and survives.
    let s = setup({ tactics: ['rush', 'rush'], subclass: 'infantry' }, { tactics: ['rush', 'flank'] });
    s = clash(s, 1, 1);
    expect(s.knights[ATTACKER]!.sergeants[0]!.militia).toBe(5);
    s = clash(s, 2, 2);
    expect(s.duel!.outcome!.winner).toBe('attacker');
    expect(s.knights[ATTACKER]!.sergeants[0]!.militia).toBe(10);
    expect(s.duel!.aftermath).toEqual([{ type: 'regroup', knightId: ATTACKER, restored: 5, sergeantIds: [`${ATTACKER}-s1`] }]);
  });

  it('also works when the Infantry loses but survives, and not for beaten Sergeants', () => {
    let s = setup({ tactics: ['rush', 'rush'], subclass: 'infantry' }, { tactics: ['rush', 'counter'] });
    s = clash(s, 1, 1); // tie
    s = clash(s, 2, 2); // Counter beats Rush: attacker loses its 2nd Sergeant and 10 HP
    expect(s.duel!.outcome).toEqual({ winner: 'defender', loserFate: 'deciding' });
    const sergeants = s.knights[ATTACKER]!.sergeants;
    expect(sergeants.map((x) => [x.id, x.militia])).toEqual([[`${ATTACKER}-s1`, 10]]);
  });

  it('does nothing for a Knight that does not survive', () => {
    let s = setup({ tactics: ['rush', 'rush'], subclass: 'infantry', hp: 10 }, { tactics: ['rush', 'counter'] });
    s = clash(s, 1, 1);
    s = clash(s, 2, 2);
    expect(s.knights[ATTACKER]!.status).toBe('dead');
    expect(s.duel!.aftermath).toEqual([]);
  });
});

describe('Cavalry: Second Pass', () => {
  it('strikes the surviving loser for half its remaining HP, before it chooses to retreat or hold', () => {
    let s = setup({ tactics: ['rush'], subclass: 'cavalry' }, { tactics: ['flank'], hp: 50 });
    s = clash(s, 1, 1); // attacker 50 HP, defender 40 HP: defender retreats
    expect(s.duel!.aftermath).toEqual([{ type: 'secondPass', knightId: ATTACKER, targetId: DEFENDER, damage: 25, killed: false }]);
    expect(s.knights[DEFENDER]).toMatchObject({ hp: 15, status: 'fielded' });
    expect(s.duel!.outcome!.loserFate).toBe('deciding');
  });

  it('can kill the retreating Knight', () => {
    let s = setup({ tactics: ['rush'], subclass: 'cavalry' }, { tactics: ['flank'], hp: 30 });
    s = clash(s, 1, 1); // defender 20 HP, Second Pass for 25
    expect(s.duel!.aftermath[0]).toMatchObject({ type: 'secondPass', damage: 20, killed: true });
    expect(s.knights[DEFENDER]!.status).toBe('dead');
    expect(s.duel!.outcome!.loserFate).toBe('killed');
  });

  it('only triggers when the Cavalry wins', () => {
    let s = setup({ tactics: ['rush'], subclass: 'cavalry', hp: 30 }, { tactics: ['counter'] });
    s = clash(s, 1, 1); // attacker loses
    expect(s.duel!.aftermath).toEqual([]);
  });
});

describe('Archers', () => {
  it('lead three Sergeants, with the spare men in the Captain reserve (still 1,000 per Lord)', async () => {
    const { lordMilitia } = await import('../src/engine/queries');
    const s = createMatch();
    expect(s.knights['p1-army-1-k3']!.sergeants).toHaveLength(3);
    expect(s.captains['p1-army-1']!.reserve).toBe(130); // 100 + 10 (Cavalry) + 20 (Archers)
    expect(lordMilitia(s, 'p1', 'army')).toBe(1000);
  });

  it('can attack along their row or column at any distance', async () => {
    const { attackTargets } = await import('../src/engine/queries');
    let s = readyToAttack();
    // Turn Player 1's placed Knight into an Archer on square 1, with the enemy on 7 (same column, not adjacent).
    s.knights[DEFENDER] = { ...s.knights[DEFENDER]!, position: { region: 4, square: 7 } };
    s.knights[ATTACKER] = { ...s.knights[ATTACKER]!, subclass: 'archers' };
    expect(attackTargets(s, ATTACKER).map((k) => k.id)).toEqual([DEFENDER]);
    s.knights[ATTACKER] = { ...s.knights[ATTACKER]!, subclass: 'infantry' };
    expect(attackTargets(s, ATTACKER)).toEqual([]);
  });

  /** Player 2's Cavalry attacks Player 1's Infantry, which has an Archer next to it. */
  function coverSetup(defenderHp: number, archerMen: number, infantryHp = 50): MatchState {
    let s = readyToAttack();
    s = act(s, { type: 'endTurn', player: 'p1' });
    const p1Inf = ATTACKER; // on Region 4, square 1
    const archer = 'p1-army-1-k3';
    const cav = DEFENDER; // on Region 4, square 4
    s.knights[archer] = {
      ...s.knights[archer]!,
      status: 'fielded',
      position: { region: 4, square: 0 },
      sergeants: [{ id: `${archer}-s1`, tactic: 'rush', militia: archerMen }],
    };
    s.knights[p1Inf] = { ...s.knights[p1Inf]!, subclass: 'infantry', hp: infantryHp, sergeants: [{ id: `${p1Inf}-s1`, tactic: 'flank', militia: 10 }] };
    s.knights[cav] = {
      ...s.knights[cav]!,
      subclass: 'cavalry',
      hp: defenderHp,
      sergeants: [{ id: `${cav}-s1`, tactic: 'rush', militia: 10 }],
    };
    // Player 2's turn: pretend their Knight was just placed and attacks.
    s = { ...s, turn: { ...s.turn!, step: 'orders', attacked: false, placedKnightId: cav, captainId: 'p2-garrison-1' } };
    s = noAttrition(act(s, { type: 'declareAttack', player: 'p2', attackerKnightId: cav, targetKnightId: p1Inf }));
    s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: `${cav}-s1` });
    return act(s, { type: 'commitSergeant', player: 'p1', sergeantId: `${p1Inf}-s1` });
  }

  it('Cover Retreat blocks Second Pass and strikes the victor with the strongest Sergeant', () => {
    const s = coverSetup(50, 15);
    expect(s.duel!.outcome).toEqual({ winner: 'attacker', loserFate: 'deciding' });
    expect(s.duel!.aftermath[0]).toMatchObject({
      type: 'coverRetreat',
      knightId: 'p1-army-1-k3',
      coveredId: ATTACKER,
      targetId: DEFENDER,
      damage: 15,
      killed: false,
      blockedSecondPass: true,
    });
    expect(s.duel!.aftermath.some((e) => e.type === 'secondPass')).toBe(false);
    expect(s.knights[DEFENDER]!.hp).toBe(35);
    expect(s.knights[ATTACKER]!.hp).toBe(40); // no Second Pass damage
  });

  it('Cover Retreat can kill the victor', () => {
    const s = coverSetup(12, 15, 15); // Infantry ends at 5 HP and retreats
    expect(s.duel!.aftermath[0]).toMatchObject({ type: 'coverRetreat', damage: 12, killed: true });
    expect(s.knights[DEFENDER]).toMatchObject({ status: 'dead', position: null });
  });
});
