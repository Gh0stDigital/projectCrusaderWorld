import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { canUndoCommand, knightMilitia } from '../src/engine/queries';
import type { MatchAction } from '../src/engine/actions';
import type { MatchState } from '../src/engine/state';

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

describe('Undoing a Captain deployment', () => {
  it('puts the Captain back on Standby and refunds Resources', () => {
    const before = started();
    let s = act(before, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(canUndoCommand(s)).toBe(true);
    s = act(s, { type: 'undoCommand', player: 'p1' });
    expect(s.captains['p1-raiders-1']!.region).toBeNull();
    expect(s.resources).toEqual(before.resources);
    expect(s.turn!.step).toBe('command');
    // A different Region can be chosen now.
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 0 });
    expect(s.captains['p1-raiders-1']!.region).toBe(0);
  });

  it('needs the placement undone first, and is final after an attack', () => {
    let s = act(started(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    expect(applyAction(s, { type: 'undoCommand', player: 'p1' }).ok).toBe(false);
    s = act(s, { type: 'undoKnight', player: 'p1' });
    s = act(s, { type: 'undoCommand', player: 'p1' });
    expect(s.captains['p1-raiders-1']!.region).toBeNull();
    expect(s.knights['p1-raiders-1-k1']!.status).toBe('ready');

    const attacked = { ...s, turn: { ...s.turn!, step: 'orders' as const, captainId: 'p1-raiders-1', attacked: true } };
    expect(canUndoCommand(attacked)).toBe(false);
  });

  it('only on your own turn', () => {
    const s = act(started(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(applyAction(s, { type: 'undoCommand', player: 'p2' }).ok).toBe(false);
  });
});

describe('Out of Resources', () => {
  it('never starves the acting Knight to death for its own action', () => {
    let s = act(started(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    const k = s.knights['p1-raiders-1-k1']!;
    // A Knight down to its last man, with the Captain's reserve empty.
    s = {
      ...s,
      resources: { p1: 0, p2: 12000 },
      captains: { ...s.captains, 'p1-raiders-1': { ...s.captains['p1-raiders-1']!, reserve: 0 } },
      knights: { ...s.knights, [k.id]: { ...k, hp: 1, sergeants: [] } },
    };
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: k.id, square: 0 });
    expect(s.knights[k.id]!.status).toBe('fielded');
    expect(knightMilitia(s.knights[k.id]!)).toBe(1);
  });
});
