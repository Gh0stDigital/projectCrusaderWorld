import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { captainMilitia, playerMilitia } from '../src/engine/queries';
import { chooseLordOrder, choosePlacement, chooseRetreat, nextComputerAction } from '../src/ai';
import type { MatchAction } from '../src/engine/actions';
import type { MatchState, SquareIndex } from '../src/engine/state';

function act(state: MatchState, action: MatchAction): MatchState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`${action.type}: ${result.reason}`);
  return result.state;
}

/** Small deterministic random number generator so test games repeat exactly. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Computer player', () => {
  it('orders its Lords using each Lord once', () => {
    expect([...chooseLordOrder(seeded(3))].sort()).toEqual(['army', 'garrison', 'raiders']);
  });

  it('completes three in a row when it can', () => {
    let s = createMatch();
    s = act(s, { type: 'setLordOrder', player: 'p1', order: ['raiders', 'army', 'garrison'] });
    s = act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
    s.captains['p1-raiders-1'] = { ...s.captains['p1-raiders-1']!, region: 4 };
    const field = (id: string, square: SquareIndex) => {
      s.knights[id] = { ...s.knights[id]!, status: 'fielded', position: { region: 4, square } };
    };
    field('p1-raiders-1-k1', 3);
    field('p1-raiders-1-k2', 4);
    s = { ...s, turn: { ...s.turn!, step: 'orders', captainId: 'p1-raiders-1' } };
    const action = choosePlacement(s, seeded(1));
    expect(action).toMatchObject({ type: 'placeKnight', square: 5 });
  });

  it('plays a whole computer-vs-computer game without an illegal move or getting stuck', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const random = seeded(seed);
      let s = createMatch();
      let steps = 0;
      while (steps < 2000 && s.turnNumber < 150) {
        const action = nextComputerAction(s, 'p1', random) ?? nextComputerAction(s, 'p2', random);
        expect(action, `seed ${seed}, turn ${s.turnNumber}, step ${s.turn?.step}`).not.toBeNull();
        s = act(s, action!);
        steps++;
        // Militia is only ever lost, never created.
        expect(playerMilitia(s, 'p1')).toBeLessThanOrEqual(3000);
      }
      expect(s.turnNumber).toBeGreaterThan(20);
    }
  });
});

describe('Reinforcements', () => {
  /** Player 2 has attacked Player 1's Knight in the Heartland; no clash yet. */
  function underAttack(): MatchState {
    let s = createMatch();
    s = act(s, { type: 'setLordOrder', player: 'p1', order: ['raiders', 'army', 'garrison'] });
    s = act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 4 });
    s = act(s, { type: 'endTurn', player: 'p1' });
    s = act(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 4 });
    s = act(s, { type: 'placeKnight', player: 'p2', knightId: 'p2-garrison-1-k1', square: 1 });
    return act(s, { type: 'declareAttack', player: 'p2', attackerKnightId: 'p2-garrison-1-k1', targetKnightId: 'p1-raiders-1-k1' });
  }

  it('moves men from the Captain reserve into the defending Knight, above its normal max', () => {
    const before = captainMilitia(underAttack(), 'p1-raiders-1');
    const s = act(underAttack(), { type: 'reinforceKnight', player: 'p1', knightId: 'p1-raiders-1-k1', amount: 30 });
    expect(s.knights['p1-raiders-1-k1']!.hp).toBe(80);
    expect(s.captains['p1-raiders-1']!.reserve).toBe(underAttack().captains['p1-raiders-1']!.reserve - 30);
    expect(s.duel!.defender.startHp).toBe(80);
    expect(captainMilitia(s, 'p1-raiders-1')).toBe(before);
  });

  it('refuses more men than the reserve holds, the attacker, and anything after the first clash', () => {
    const s = underAttack();
    const reserve = s.captains['p1-raiders-1']!.reserve;
    expect(applyAction(s, { type: 'reinforceKnight', player: 'p1', knightId: 'p1-raiders-1-k1', amount: reserve + 1 }).ok).toBe(false);
    expect(applyAction(s, { type: 'reinforceKnight', player: 'p2', knightId: 'p2-garrison-1-k1', amount: 10 }).ok).toBe(false);
    let after = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: s.knights['p2-garrison-1-k1']!.sergeants[0]!.id });
    after = act(after, { type: 'commitSergeant', player: 'p1', sergeantId: s.knights['p1-raiders-1-k1']!.sergeants[0]!.id });
    expect(applyAction(after, { type: 'reinforceKnight', player: 'p1', knightId: 'p1-raiders-1-k1', amount: 10 }).ok).toBe(false);
  });

  it('keeps the extra HP after the battle', () => {
    let s = act(underAttack(), { type: 'reinforceKnight', player: 'p1', knightId: 'p1-raiders-1-k1', amount: 40 });
    // Ties only: each side sends a matching tactic, so no HP is lost.
    const p1 = s.knights['p1-raiders-1-k1']!.sergeants;
    const p2 = s.knights['p2-garrison-1-k1']!.sergeants;
    const used = new Set<string>();
    for (const sg of p2) {
      const match = p1.find((x) => x.tactic === sg.tactic && !used.has(x.id));
      if (!match || !s.duel || s.duel.outcome) break;
      used.add(match.id);
      s = act(s, { type: 'commitSergeant', player: 'p2', sergeantId: sg.id });
      s = act(s, { type: 'commitSergeant', player: 'p1', sergeantId: match.id });
    }
    expect(s.knights['p1-raiders-1-k1']!.hp).toBe(90);
  });
});

describe('Computer: retreat or hold', () => {
  function lost(loserHp: number, winnerHp: number): MatchState {
    const s = createMatch();
    const w = 'p1-army-1-k1';
    const l = 'p2-army-1-k1';
    return {
      ...s,
      knights: { ...s.knights, [w]: { ...s.knights[w]!, hp: winnerHp }, [l]: { ...s.knights[l]!, hp: loserHp } },
      duel: {
        region: 4,
        attacker: { player: 'p1', knightId: w, startHp: 50, startSergeants: [] },
        defender: { player: 'p2', knightId: l, startHp: 50, startSergeants: [] },
        clashes: [],
        outcome: { winner: 'attacker', loserFate: 'deciding' },
        prelude: [],
        blocked: { attacker: [], defender: [] },
        aftermath: [],
      },
    } as unknown as MatchState;
  }

  it('holds when it has at least the winner’s HP left, otherwise retreats', () => {
    expect(chooseRetreat(lost(20, 20), 'p2')).toEqual({ type: 'chooseRetreat', player: 'p2', retreat: false });
    expect(chooseRetreat(lost(19, 20), 'p2')).toEqual({ type: 'chooseRetreat', player: 'p2', retreat: true });
    expect(chooseRetreat(lost(19, 20), 'p1')).toBeNull();
  });
});
