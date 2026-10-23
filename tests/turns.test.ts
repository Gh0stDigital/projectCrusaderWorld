import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import {
  actionableCaptains,
  canEndTurn,
  emptySquares,
  legalSquares,
  nextLordFor,
  regionsOpenTo,
  reserveKnights,
} from '../src/engine/queries';
import type { MatchAction } from '../src/engine/actions';
import type { LordClass, MatchState, RegionIndex, SquareIndex } from '../src/engine/state';

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

const P1_ORDER: LordClass[] = ['raiders', 'army', 'garrison'];
const P2_ORDER: LordClass[] = ['garrison', 'raiders', 'army'];

function startedMatch(): MatchState {
  let s = createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: P1_ORDER });
  s = act(s, { type: 'setLordOrder', player: 'p2', order: P2_ORDER });
  return s;
}

/**
 * Play a full turn: the current Lord's first usable Captain deploys to `region`
 * (or resumes if already stationed), places its first waiting Knight on the
 * first empty square, and ends the turn.
 */
function playTurn(s: MatchState, region: RegionIndex): MatchState {
  const player = s.turn!.player;
  const captain = actionableCaptains(s)[0];
  if (captain) {
    s =
      captain.region === null
        ? act(s, { type: 'deployCaptain', player, captainId: captain.id, region })
        : act(s, { type: 'resumeCaptain', player, captainId: captain.id });
    const knight = reserveKnights(s, captain.id)[0]!;
    s = act(s, { type: 'placeKnight', player, knightId: knight.id, square: legalSquares(s)[0]! });
  }
  return act(s, { type: 'endTurn', player });
}

describe('Lord order setup', () => {
  it('starts with Player 1 ordering and no turn in progress', () => {
    const s = createMatch();
    expect(s.phase).toBe('lordOrder');
    expect(s.orderingPlayer).toBe('p1');
    expect(s.turn).toBeNull();
  });

  it('gives every Captain six waiting Knights', () => {
    const s = createMatch();
    expect(reserveKnights(s, 'p1-army-1')).toHaveLength(6);
    expect(Object.keys(s.knights)).toHaveLength(2 * 3 * 2 * 6);
  });

  it('requires each Lord exactly once', () => {
    const s = createMatch();
    expect(rejected(s, { type: 'setLordOrder', player: 'p1', order: ['army', 'army', 'raiders'] })).toMatch(/exactly once/);
    expect(rejected(s, { type: 'setLordOrder', player: 'p1', order: ['army', 'garrison'] })).toMatch(/exactly once/);
  });

  it('makes Player 2 wait for Player 1', () => {
    expect(rejected(createMatch(), { type: 'setLordOrder', player: 'p2', order: P2_ORDER })).toMatch(/not your turn/);
  });

  it('starts Player 1’s first turn with their first chosen Lord once both orders are set', () => {
    const s = startedMatch();
    expect(s.phase).toBe('turns');
    expect(s.turnNumber).toBe(1);
    expect(s.turn).toMatchObject({ player: 'p1', lord: 'raiders', step: 'command' });
  });
});

describe('Lord rotation', () => {
  it('follows each player’s own chosen order, advancing only when their turn returns', () => {
    let s = startedMatch();
    const seen: string[] = [];
    for (const region of [0, 1, 2, 3, 4, 5] as RegionIndex[]) {
      seen.push(`${s.turn!.player}:${s.turn!.lord}`);
      s = playTurn(s, region);
    }
    expect(seen).toEqual(['p1:raiders', 'p2:garrison', 'p1:army', 'p2:raiders', 'p1:garrison', 'p2:army']);
  });

  it('does not advance Player 1’s Lord while it is Player 2’s turn', () => {
    const s = playTurn(startedMatch(), 0);
    expect(s.turn!.player).toBe('p2');
    expect(nextLordFor(s, 'p1')).toBe('army');
  });

  it('wraps back to the first Lord after the third', () => {
    let s = startedMatch();
    for (let i = 0; i < 6; i++) s = playTurn(s, i as RegionIndex);
    expect(s.turn).toMatchObject({ player: 'p1', lord: 'raiders' });
  });
});

describe('Captain deployment', () => {
  it('stations the Captain and moves on to Knight placement', () => {
    const s = act(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(s.captains['p1-raiders-1']!.region).toBe(4);
    expect(s.turn).toMatchObject({ step: 'placement', captainId: 'p1-raiders-1' });
  });

  it('refuses a Captain belonging to a different Lord', () => {
    expect(rejected(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-army-1', region: 4 })).toMatch(
      /current Lord/,
    );
  });

  it('refuses the opponent’s Captains and acting out of turn', () => {
    const s = startedMatch();
    expect(rejected(s, { type: 'deployCaptain', player: 'p1', captainId: 'p2-raiders-1', region: 4 })).toMatch(/not one of your/);
    expect(rejected(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 4 })).toMatch(/not your turn/);
  });

  it('allows only one Captain choice per turn', () => {
    const s = act(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(rejected(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-2', region: 5 })).toMatch(/already chosen/);
  });

  it('allows only one of your Captains per Region, but the opponent can share it', () => {
    let s = startedMatch();
    s = playTurn(s, 4); // p1 raiders-1 -> 4
    s = playTurn(s, 4); // p2 garrison-1 -> 4, shared with p1
    expect(s.captains['p2-garrison-1']!.region).toBe(4);
    for (const r of [0, 0, 1, 1] as RegionIndex[]) s = playTurn(s, r);
    // p1 raiders again: region 4 already holds p1-raiders-1
    expect(rejected(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-2', region: 4 })).toMatch(
      /already have a Captain/,
    );
  });

  it('closes a Region to new Captains once its board is full', () => {
    let s = startedMatch();
    const knights = Object.values(s.knights).filter((k) => k.owner === 'p2').slice(0, 9);
    knights.forEach((k, i) => {
      s.knights[k.id] = { ...k, position: { region: 2, square: i as SquareIndex } };
    });
    expect(regionsOpenTo(s, 'p1')).not.toContain(2);
    expect(rejected(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 2 })).toMatch(/no room/);
  });
});

describe('Resuming a stationed Captain', () => {
  it('lets a Lord give orders to a Captain already in the field', () => {
    let s = startedMatch();
    for (let i = 0; i < 6; i++) s = playTurn(s, i as RegionIndex);
    // p1 raiders' turn again; raiders-1 is stationed in region 0
    s = act(s, { type: 'resumeCaptain', player: 'p1', captainId: 'p1-raiders-1' });
    expect(s.turn).toMatchObject({ step: 'placement', captainId: 'p1-raiders-1' });
    expect(legalSquares(s)).toEqual(emptySquares(s, 0));
  });

  it('refuses to resume a Captain who has not been deployed', () => {
    expect(rejected(startedMatch(), { type: 'resumeCaptain', player: 'p1', captainId: 'p1-raiders-1' })).toMatch(
      /not been deployed/,
    );
  });
});

describe('Knight placement', () => {
  function deployed(): MatchState {
    return act(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
  }

  it('places a waiting Knight on an empty square of the Captain’s Region', () => {
    const s = act(deployed(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k3', square: 7 });
    expect(s.knights['p1-raiders-1-k3']!.position).toEqual({ region: 4, square: 7 });
    expect(s.turn).toMatchObject({ step: 'end', placedKnightId: 'p1-raiders-1-k3' });
  });

  it('requires a Captain to be chosen first', () => {
    expect(rejected(startedMatch(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 })).toMatch(
      /Choose a Captain/,
    );
  });

  it('only places Knights of the acting Captain', () => {
    expect(rejected(deployed(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-2-k1', square: 0 })).toMatch(
      /does not serve/,
    );
  });

  it('allows one placement per turn', () => {
    const s = act(deployed(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    expect(rejected(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k2', square: 1 })).toMatch(/already placed/);
  });

  it('refuses a taken square, including one held by the opponent', () => {
    let s = playTurn(startedMatch(), 4); // p1 Knight on region 4, square 0
    s = act(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 4 });
    expect(rejected(s, { type: 'placeKnight', player: 'p2', knightId: 'p2-garrison-1-k1', square: 0 })).toMatch(/taken/);
    expect(legalSquares(s)).not.toContain(0);
  });
});

describe('End Turn', () => {
  it('is required: placing a Knight does not switch players', () => {
    let s = act(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    s = act(s, { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k1', square: 0 });
    expect(s.turn!.player).toBe('p1');
    expect(canEndTurn(s)).toBe(true);
  });

  it('is refused before choosing a Captain', () => {
    expect(rejected(startedMatch(), { type: 'endTurn', player: 'p1' })).toMatch(/Choose a Captain/);
  });

  it('is refused after deploying but before placing a Knight', () => {
    const s = act(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(rejected(s, { type: 'endTurn', player: 'p1' })).toMatch(/Place a Knight/);
  });

  it('is allowed straight away when the current Lord has nothing they can do', () => {
    let s = startedMatch();
    // Put every Knight of p1's Raiders on the field so neither Captain can act.
    let square = 0;
    for (const k of Object.values(s.knights).filter((k) => k.captainId.startsWith('p1-raiders'))) {
      s.knights[k.id] = { ...k, position: { region: (square % 9) as RegionIndex, square: Math.floor(square / 9) as SquareIndex } };
      square++;
    }
    expect(actionableCaptains(s)).toEqual([]);
    expect(canEndTurn(s)).toBe(true);
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.turn!.player).toBe('p2');
  });
});
