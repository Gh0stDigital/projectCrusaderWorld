import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import {
  actionableCaptains,
  canEndTurn,
  commandOptions,
  commandableRegions,
  emptySquares,
  moveType,
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
 * Play a full turn following the routing rules: the first Captain allowed to act
 * deploys (to the routed Region, or the first open one when free) or resumes,
 * places its first waiting Knight on `square` if free (else the first empty
 * square), and ends the turn.
 */
function playTurn(s: MatchState, square: SquareIndex = 0): MatchState {
  const player = s.turn!.player;
  const captain = actionableCaptains(s)[0];
  if (captain) {
    s =
      captain.region === null
        ? act(s, { type: 'deployCaptain', player, captainId: captain.id, region: commandOptions(s).deployRegions[0]! })
        : act(s, { type: 'resumeCaptain', player, captainId: captain.id });
    const knight = reserveKnights(s, captain.id)[0]!;
    const legal = legalSquares(s);
    s = act(s, { type: 'placeKnight', player, knightId: knight.id, square: legal.includes(square) ? square : legal[0]! });
  }
  return act(s, { type: 'endTurn', player });
}

/** Deploy a Captain to a Region and place one of its Knights on a square, then end the turn. */
function deployAndPlace(s: MatchState, captainId: string, region: RegionIndex, square: SquareIndex): MatchState {
  const player = s.turn!.player;
  s = act(s, { type: 'deployCaptain', player, captainId, region });
  s = act(s, { type: 'placeKnight', player, knightId: reserveKnights(s, captainId)[0]!.id, square });
  return act(s, { type: 'endTurn', player });
}

describe('Lord order setup', () => {
  it('starts with Player 1 ordering and no turn in progress', () => {
    const s = createMatch();
    expect(s.phase).toBe('lordOrder');
    expect(s.orderingPlayer).toBe('p1');
    expect(s.turn).toBeNull();
  });

  it('gives every Captain six Knight slots, three of them staffed', () => {
    const s = createMatch();
    expect(reserveKnights(s, 'p1-army-1').map((k) => k.number)).toEqual([1, 2, 3]);
    expect(s.knights['p1-army-1-k4']!.status).toBe('unmanned');
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
    for (const square of [0, 1, 2, 3, 4, 5] as SquareIndex[]) {
      seen.push(`${s.turn!.player}:${s.turn!.lord}`);
      s = playTurn(s, square);
    }
    expect(seen).toEqual(['p1:raiders', 'p2:garrison', 'p1:army', 'p2:raiders', 'p1:garrison', 'p2:army']);
  });

  it('does not advance Player 1’s Lord while it is Player 2’s turn', () => {
    const s = playTurn(startedMatch());
    expect(s.turn!.player).toBe('p2');
    expect(nextLordFor(s, 'p1')).toBe('army');
  });

  it('wraps back to the first Lord after the third', () => {
    let s = startedMatch();
    for (let i = 0; i < 6; i++) s = playTurn(s, i as SquareIndex);
    expect(s.turn).toMatchObject({ player: 'p1', lord: 'raiders' });
  });
});

describe('Captain deployment', () => {
  it('stations the Captain and moves on to Knight placement', () => {
    const s = act(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(s.captains['p1-raiders-1']!.region).toBe(4);
    expect(s.turn).toMatchObject({ step: 'orders', captainId: 'p1-raiders-1' });
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

  it('lets the opponent share a Region', () => {
    let s = deployAndPlace(startedMatch(), 'p1-raiders-1', 4, 4); // routes p2 to Region 4
    s = deployAndPlace(s, 'p2-garrison-1', 4, 0);
    expect(s.captains['p2-garrison-1']!.region).toBe(4);
    expect(s.captains['p1-raiders-1']!.region).toBe(4);
  });

  it('closes a Region to new Captains once its board is full', () => {
    let s = startedMatch();
    const knights = Object.values(s.knights).filter((k) => k.owner === 'p2').slice(0, 9);
    knights.forEach((k, i) => {
      s.knights[k.id] = { ...k, status: 'fielded', position: { region: 2, square: i as SquareIndex } };
    });
    expect(regionsOpenTo(s, 'p1')).not.toContain(2);
    expect(rejected(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 2 })).toMatch(
      /cannot deploy/,
    );
  });
});

describe('Routing', () => {
  it('gives a free choice of Region on the first turn', () => {
    const o = commandOptions(startedMatch());
    expect(o).toMatchObject({ mode: 'free', route: null });
    expect(o.deployRegions).toHaveLength(9);
    expect(moveType(startedMatch())).toBe('control');
  });

  it('sends the opponent to the Region matching the square played', () => {
    const s = deployAndPlace(startedMatch(), 'p1-raiders-1', 2, 7);
    expect(s.route).toBe(7);
    expect(commandOptions(s)).toMatchObject({ mode: 'routed', route: 7, deployRegions: [7], resumeCaptainIds: [] });
    expect(moveType(s)).toBe('fated');
    expect(rejected(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 3 })).toMatch(
      /sent you to/,
    );
    const next = act(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 7 });
    expect(next.captains['p2-garrison-1']!.region).toBe(7);
  });

  it('is not mandatory when the routed Region holds another Lord\u2019s Captain: deploy elsewhere or command them', () => {
    let s = deployAndPlace(startedMatch(), 'p1-raiders-1', 4, 0); // p2 -> Region 0
    s = deployAndPlace(s, 'p2-garrison-1', 0, 4); // p1 -> Region 4, where Raiders Captain I stands
    expect(s.turn!.lord).toBe('army');
    const o = commandOptions(s);
    expect(o).toMatchObject({ mode: 'free', route: 4, resumeCaptainIds: ['p1-raiders-1'] });
    expect(o.deployRegions).not.toContain(4);
    expect(o.deployRegions).toContain(7);
    // Either choice is allowed.
    const deployed = act(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-army-1', region: 7 });
    expect(deployed.captains['p1-army-1']!.region).toBe(7);
    const resumed = act(s, { type: 'resumeCaptain', player: 'p1', captainId: 'p1-raiders-1' });
    expect(legalSquares(resumed)).toEqual(emptySquares(resumed, 4));
  });

  it('becomes must-play-here when nowhere else is open', () => {
    let s = deployAndPlace(startedMatch(), 'p1-raiders-1', 4, 0);
    s = deployAndPlace(s, 'p2-garrison-1', 0, 4); // p1 Army routed to Region 4
    // Fill every other Region so a Ready Captain has nowhere to go.
    let n = 0;
    const fillers = Object.values(s.knights).filter((k) => k.owner === 'p2' && k.status === 'unmanned');
    for (const region of [0, 1, 2, 3, 5, 6, 7, 8] as RegionIndex[]) {
      for (let sq = 0; sq < 9; sq++) {
        const k = fillers[n++ % fillers.length]!;
        const id = `${k.id}-fill-${region}-${sq}`;
        s.knights[id] = { ...k, id, status: 'fielded', position: { region, square: sq as SquareIndex } };
      }
    }
    s = { ...s, knights: { ...s.knights } };
    const o = commandOptions(s);
    expect(o).toMatchObject({ mode: 'routed', route: 4, deployRegions: [], resumeCaptainIds: ['p1-raiders-1'] });
  });

  it('stays mandatory when the routed Region holds the current Lord\u2019s own Captain', () => {
    let s = startedMatch();
    s.captains['p1-raiders-1'] = { ...s.captains['p1-raiders-1']!, region: 4 };
    s = { ...s, route: 4 };
    const o = commandOptions(s);
    expect(o).toMatchObject({ mode: 'routed', route: 4, deployRegions: [], resumeCaptainIds: ['p1-raiders-1'] });
  });

  it('does not let a Lord with a Ready Captain revisit other Regions', () => {
    let s = deployAndPlace(startedMatch(), 'p1-raiders-1', 2, 0); // p2 -> Region 0
    s = playTurn(s, 1); // p2 -> p1 routed to Region 1
    s = playTurn(s, 3); // p1 Army
    s = playTurn(s, 5); // p2
    s = playTurn(s, 6); // p1 Garrison
    s = playTurn(s, 8); // p2
    // p1 Raiders again: Captain I is stationed in Region 2, Captain II is Ready.
    expect(s.turn!.lord).toBe('raiders');
    expect(commandOptions(s).mode).toBe('routed');
    expect(commandOptions(s).resumeCaptainIds).not.toContain('p1-raiders-1');
    expect(rejected(s, { type: 'resumeCaptain', player: 'p1', captainId: 'p1-raiders-1' })).toMatch(/sent you to/);
  });

  it('makes it a Fated Move when both Captains are deployed and one stands in the routed Region', () => {
    let s = startedMatch();
    s.captains['p1-raiders-1'] = { ...s.captains['p1-raiders-1']!, region: 2 };
    s.captains['p1-raiders-2'] = { ...s.captains['p1-raiders-2']!, region: 6 };
    s = { ...s, route: 6 };
    expect(commandOptions(s)).toMatchObject({ mode: 'routed', route: 6, resumeCaptainIds: ['p1-raiders-2'] });
    expect(moveType(s)).toBe('fated');
    expect(commandableRegions(s)).toEqual([]);
    expect(rejected(s, { type: 'resumeCaptain', player: 'p1', captainId: 'p1-raiders-1' })).toBeTruthy();
  });

  it('otherwise lets a Lord with both Captains deployed choose either of their Regions', () => {
    let s = startedMatch();
    s.captains['p1-raiders-1'] = { ...s.captains['p1-raiders-1']!, region: 2 };
    s.captains['p1-raiders-2'] = { ...s.captains['p1-raiders-2']!, region: 6 };
    s.captains['p1-army-1'] = { ...s.captains['p1-army-1']!, region: 4 };
    s = { ...s, route: 4 };
    const o = commandOptions(s);
    expect(o).toMatchObject({ mode: 'lordCaptains', deployRegions: [] });
    expect(o.resumeCaptainIds.sort()).toEqual(['p1-raiders-1', 'p1-raiders-2']);
    expect(moveType(s)).toBe('control');
    expect(commandableRegions(s).sort()).toEqual([2, 6]);
    expect(rejected(s, { type: 'resumeCaptain', player: 'p1', captainId: 'p1-army-1' })).toMatch(/current Lord/);
    s = act(s, { type: 'resumeCaptain', player: 'p1', captainId: 'p1-raiders-2' });
    expect(legalSquares(s)).toEqual(emptySquares(s, 6));
  });

  it('gives a free choice when the routed Region is closed', () => {
    let s = startedMatch();
    Object.values(s.knights)
      .filter((k) => k.owner === 'p2')
      .slice(0, 9)
      .forEach((k, i) => {
        s.knights[k.id] = { ...k, status: 'fielded', position: { region: 5, square: i as SquareIndex } };
      });
    s = { ...s, route: 5 };
    const o = commandOptions(s);
    expect(o).toMatchObject({ mode: 'free', route: 5 });
    expect(o.deployRegions).not.toContain(5);
    expect(o.deployRegions).toContain(0);
  });

  it('keeps the route set by the placement even after a battle', () => {
    const s = deployAndPlace(startedMatch(), 'p1-raiders-1', 4, 8);
    expect(s.route).toBe(8);
  });
});

describe('Resuming a stationed Captain', () => {
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
    expect(s.knights['p1-raiders-1-k3']).toMatchObject({ status: 'fielded', position: { region: 4, square: 7 } });
    // No enemy next to it, so there is nothing to attack.
    expect(s.turn).toMatchObject({ step: 'end', placedKnightId: 'p1-raiders-1-k3' });
  });

  it('refuses an unmanned Knight', () => {
    expect(rejected(deployed(), { type: 'placeKnight', player: 'p1', knightId: 'p1-raiders-1-k4', square: 0 })).toMatch(
      /no men/,
    );
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
    let s = deployAndPlace(startedMatch(), 'p1-raiders-1', 4, 4); // p1 Knight on Region 4, square 4
    s = act(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 4 });
    expect(rejected(s, { type: 'placeKnight', player: 'p2', knightId: 'p2-garrison-1-k1', square: 4 })).toMatch(/taken/);
    expect(legalSquares(s)).not.toContain(4);
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
    for (const k of Object.values(s.knights).filter((k) => k.captainId.startsWith('p1-raiders') && k.status === 'ready')) {
      s.knights[k.id] = {
        ...k,
        status: 'fielded',
        position: { region: (square % 9) as RegionIndex, square: Math.floor(square / 9) as SquareIndex },
      };
      square++;
    }
    expect(actionableCaptains(s)).toEqual([]);
    expect(canEndTurn(s)).toBe(true);
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.turn!.player).toBe('p2');
  });
});
