import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { captainMilitia, knightMilitia } from '../src/engine/queries';
import { RESOURCES } from '../src/engine/config';
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

const lordTroopMen = (s: MatchState, player: 'p1' | 'p2', lord: string) =>
  Object.values(s.knights)
    .filter((k) => k.owner === player && s.captains[k.captainId]!.lord === lord)
    .reduce((n, k) => n + knightMilitia(k), 0);

describe('Resources (experimental)', () => {
  it('start at the configured amount for each player', () => {
    expect(started().resources).toEqual({ p1: RESOURCES.startingAmount, p2: RESOURCES.startingAmount });
  });

  it('charge 1 per man: deploying a Captain (reserve included), placing a Knight, and upkeep at turn end', () => {
    let s = started();
    const company = captainMilitia(s, 'p1-raiders-1');
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(s.resources!.p1).toBe(12000 - company);
    const knightMen = knightMilitia(s.knights['p1-raiders-1-k1']!);
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    expect(s.resources!.p1).toBe(12000 - company - knightMen);
    const upkeep = lordTroopMen(s, 'p1', 'raiders');
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.resources!.p1).toBe(12000 - company - knightMen - upkeep);
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

  it('out of Resources: each action costs 1 man instead', () => {
    let s = started();
    s = { ...s, resources: { p1: 0, p2: 12000 } };
    const reserve = s.captains['p1-raiders-1']!.reserve;
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(s.captains['p1-raiders-1']!.reserve).toBe(reserve - 1);
    const men = knightMilitia(s.knights['p1-raiders-1-k1']!);
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    expect(knightMilitia(s.knights['p1-raiders-1-k1']!)).toBe(men - 1);
    expect(s.resources!.p1).toBe(0);
  });

  it('out of Resources: the Lord’s troops (not reserves) lose 10% at the end of their turn', () => {
    let s = started();
    s = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    s = { ...s, resources: { p1: 0, p2: 12000 } };
    const troops = lordTroopMen(s, 'p1', 'raiders');
    const reserve = s.captains['p1-raiders-1']!.reserve;
    const result = applyAction(s, { type: 'endTurn', player: 'p1' });
    if (!result.ok) throw new Error(result.reason);
    const after = result.state;
    expect(lordTroopMen(after, 'p1', 'raiders')).toBeLessThanOrEqual(troops - Math.floor(troops * 0.1));
    expect(lordTroopMen(after, 'p1', 'raiders')).toBeGreaterThanOrEqual(troops - Math.ceil(troops * 0.1) - 6);
    expect(after.captains['p1-raiders-1']!.reserve).toBe(reserve);
    expect(result.events.some((e) => e.type === 'attrition')).toBe(true);
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
  });
});
