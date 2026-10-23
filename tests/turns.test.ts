import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { canEndTurn, deployableCaptains, nextLordFor } from '../src/engine/queries';
import type { MatchAction } from '../src/engine/actions';
import type { LordClass, MatchState, RegionIndex } from '../src/engine/state';

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

/** Deploy the current Lord's first free Captain to `region`, then end the turn. */
function playTurn(s: MatchState, region: RegionIndex): MatchState {
  const player = s.turn!.player;
  const captain = deployableCaptains(s)[0];
  if (captain) s = act(s, { type: 'deployCaptain', player, captainId: captain.id, region });
  return act(s, { type: 'endTurn', player });
}

describe('Lord order setup', () => {
  it('starts with Player 1 ordering and no turn in progress', () => {
    const s = createMatch();
    expect(s.phase).toBe('lordOrder');
    expect(s.orderingPlayer).toBe('p1');
    expect(s.turn).toBeNull();
  });

  it('requires each Lord exactly once', () => {
    const s = createMatch();
    expect(rejected(s, { type: 'setLordOrder', player: 'p1', order: ['army', 'army', 'raiders'] })).toMatch(
      /exactly once/,
    );
    expect(rejected(s, { type: 'setLordOrder', player: 'p1', order: ['army', 'garrison'] })).toMatch(/exactly once/);
  });

  it('makes Player 2 wait for Player 1', () => {
    const s = createMatch();
    expect(rejected(s, { type: 'setLordOrder', player: 'p2', order: P2_ORDER })).toMatch(/not your turn/);
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
    const regions: RegionIndex[] = [0, 1, 2, 3, 4, 5];
    for (const region of regions) {
      seen.push(`${s.turn!.player}:${s.turn!.lord}`);
      s = playTurn(s, region);
    }
    expect(seen).toEqual([
      'p1:raiders',
      'p2:garrison',
      'p1:army',
      'p2:raiders',
      'p1:garrison',
      'p2:army',
    ]);
  });

  it('does not advance Player 1’s Lord while it is Player 2’s turn', () => {
    let s = startedMatch();
    s = playTurn(s, 0);
    expect(s.turn!.player).toBe('p2');
    expect(nextLordFor(s, 'p1')).toBe('army');
    expect(s.players.p1.turnsTaken).toBe(1);
  });

  it('wraps back to the first Lord after the third', () => {
    let s = startedMatch();
    for (let i = 0; i < 6; i++) s = playTurn(s, i as RegionIndex);
    expect(s.turn).toMatchObject({ player: 'p1', lord: 'raiders' });
  });
});

describe('Captain deployment', () => {
  it('lets the current Lord deploy one of their Captains to a Region', () => {
    const s = act(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(s.captains['p1-raiders-1']!.region).toBe(4);
    expect(s.turn!.step).toBe('end');
  });

  it('refuses a Captain belonging to a different Lord', () => {
    expect(
      rejected(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-army-1', region: 4 }),
    ).toMatch(/current Lord/);
  });

  it('refuses the opponent’s Captains and acting out of turn', () => {
    const s = startedMatch();
    expect(rejected(s, { type: 'deployCaptain', player: 'p1', captainId: 'p2-raiders-1', region: 4 })).toMatch(
      /not one of your/,
    );
    expect(rejected(s, { type: 'deployCaptain', player: 'p2', captainId: 'p2-garrison-1', region: 4 })).toMatch(
      /not your turn/,
    );
  });

  it('allows only one deployment per turn', () => {
    const s = act(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(rejected(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-2', region: 5 })).toMatch(
      /already deployed/,
    );
  });

  it('allows only one of your Captains per Region, but the opponent can share it', () => {
    let s = startedMatch();
    s = playTurn(s, 4); // p1 raiders-1 -> 4
    s = playTurn(s, 4); // p2 garrison-1 -> 4, sharing with p1
    expect(s.captains['p2-garrison-1']!.region).toBe(4);

    s = playTurn(s, 0); // p1 army-1 -> 0
    s = playTurn(s, 0); // p2 raiders-1 -> 0
    s = playTurn(s, 1); // p1 garrison-1 -> 1
    s = playTurn(s, 1); // p2 army-1 -> 1
    // p1 raiders again: region 4 already holds p1-raiders-1
    expect(rejected(s, { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-2', region: 4 })).toMatch(
      /already have a Captain/,
    );
  });
});

describe('End Turn', () => {
  it('is required: deploying does not switch players', () => {
    const s = act(startedMatch(), { type: 'deployCaptain', player: 'p1', captainId: 'p1-raiders-1', region: 4 });
    expect(s.turn!.player).toBe('p1');
  });

  it('is refused before deploying when a Captain is available', () => {
    const s = startedMatch();
    expect(canEndTurn(s)).toBe(false);
    expect(rejected(s, { type: 'endTurn', player: 'p1' })).toMatch(/Deploy a Captain/);
  });

  it('is allowed without deploying once the current Lord has no Captains left', () => {
    let s = startedMatch();
    for (let i = 0; i < 12; i++) s = playTurn(s, (i % 9) as RegionIndex);
    // Turn 13: p1 raiders, both Captains already deployed.
    expect(s.turn).toMatchObject({ player: 'p1', lord: 'raiders' });
    expect(deployableCaptains(s)).toEqual([]);
    expect(canEndTurn(s)).toBe(true);
    s = act(s, { type: 'endTurn', player: 'p1' });
    expect(s.turn!.player).toBe('p2');
  });

  it('reports whether the incoming turn can deploy', () => {
    let s = startedMatch();
    for (let i = 0; i < 11; i++) s = playTurn(s, (i % 9) as RegionIndex);
    const player = s.turn!.player;
    const captain = deployableCaptains(s)[0]!;
    s = act(s, { type: 'deployCaptain', player, captainId: captain.id, region: 8 });
    const result = applyAction(s, { type: 'endTurn', player });
    expect(result.ok && result.events.at(-1)).toMatchObject({ type: 'turnStarted', canDeploy: false });
  });
});
