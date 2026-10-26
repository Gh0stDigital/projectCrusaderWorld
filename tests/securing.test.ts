import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { commandOptions, emptySquares, knightMilitia, regionsOpenTo, winningLine } from '../src/engine/queries';
import type { MatchAction } from '../src/engine/actions';
import type { MatchState, SquareIndex } from '../src/engine/state';

function act(state: MatchState, action: MatchAction): MatchState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

/**
 * Player 1's Raiders Captain I is in the Heartland (Region 4) with Knights on
 * squares 0 and 1, about to place Knight 3. Player 2 has a Knight on square 4.
 */
function aboutToSecure(): MatchState {
  let s = createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: ['raiders', 'army', 'garrison'] });
  s = act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
  const field = (id: string, square: SquareIndex) => {
    s.knights[id] = { ...s.knights[id]!, status: 'fielded', position: { region: 4, square } };
  };
  s.captains['p1-raiders-1'] = { ...s.captains['p1-raiders-1']!, region: 4 };
  s.captains['p2-garrison-1'] = { ...s.captains['p2-garrison-1']!, region: 4 };
  field('p1-raiders-1-k1', 0);
  field('p1-raiders-1-k2', 1);
  field('p2-garrison-1-k1', 4);
  s = { ...s, turn: { ...s.turn!, step: 'orders', captainId: 'p1-raiders-1' } };
  return s;
}

describe('Securing a Region', () => {
  it('finds rows, columns and diagonals', () => {
    const s = aboutToSecure();
    expect(winningLine(s, 4, 'p1')).toBeNull();
    s.knights['p1-raiders-1-k3'] = { ...s.knights['p1-raiders-1-k3']!, status: 'fielded', position: { region: 4, square: 2 } };
    expect(winningLine(s, 4, 'p1')).toEqual([0, 1, 2]);
  });

  it('secures the Region for the Captain who completes three in a row', () => {
    const result = applyAction(aboutToSecure(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k3', square: 2 });
    if (!result.ok) throw new Error(result.reason);
    const s = result.state;
    expect(s.secured[4]).toMatchObject({ player: 'p1', captainId: 'p1-raiders-1' });
    expect(result.events.some((e) => e.type === 'regionSecured')).toBe(true);
    expect(s.turn!.step).toBe('end');
  });

  it('captures the enemy Knights left inside, out of play and out of the militia count', () => {
    const s = act(aboutToSecure(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k3', square: 2 });
    const captured = s.knights['p2-garrison-1-k1']!;
    expect(captured).toMatchObject({ status: 'captured', position: null });
    expect(knightMilitia(captured)).toBe(0);
    // The winner's Knights stay where they are.
    expect(s.knights['p1-raiders-1-k1']!.position).toEqual({ region: 4, square: 0 });
  });

  it('closes the Region: no placements, no new Captains, and a route there becomes a free choice', () => {
    let s = act(aboutToSecure(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k3', square: 2 });
    expect(emptySquares(s, 4)).toEqual([]);
    expect(regionsOpenTo(s, 'p2')).not.toContain(4);
    s = { ...s, route: 4 };
    s = act(s, { type: 'endTurn', player: 'p1' });
    const o = commandOptions(s);
    expect(o.mode).toBe('free');
    expect(o.deployRegions).not.toContain(4);
  });

  it('sends the losing Captain back to their Lord with their waiting Knights; Knights on the board are captured', () => {
    const s = act(aboutToSecure(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k3', square: 2 });
    expect(s.captains['p2-garrison-1']).toMatchObject({ region: null, fallen: false });
    expect(s.knights['p2-garrison-1-k1']!.status).toBe('captured');
    expect(s.knights['p2-garrison-1-k2']!.status).toBe('ready');
  });

  it('a losing Captain with no men left falls instead', () => {
    let s = aboutToSecure();
    s.captains['p2-garrison-1'] = { ...s.captains['p2-garrison-1']!, reserve: 0 };
    for (const n of [2, 3]) s.knights[`p2-garrison-1-k${n}`] = { ...s.knights[`p2-garrison-1-k${n}`]!, status: 'dead' };
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k3', square: 2 });
    expect(s.captains['p2-garrison-1']).toMatchObject({ region: null, fallen: true });
  });

  it('does not offer an attack after securing', () => {
    const s = act(aboutToSecure(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k3', square: 2 });
    expect(s.turn!.step).toBe('end');
  });
});
