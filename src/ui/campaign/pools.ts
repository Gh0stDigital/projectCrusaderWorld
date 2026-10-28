import type { MatchState, RegionIndex } from '../../engine/state';

/** Resources waiting in wager pools that this Knight is part of. */
export function knightPool(match: MatchState, knightId: string): number {
  return match.wagers
    .filter((w) => w.sides.some((s) => 'knightId' in s && s.knightId === knightId))
    .reduce((n, w) => n + w.amount, 0);
}

/** Resources waiting in wager pools between Captains, where one side holds this Region. */
export function regionPool(match: MatchState, region: RegionIndex): number {
  return match.wagers
    .filter((w) => w.sides.some((s) => 'captainId' in s && s.region === region))
    .reduce((n, w) => n + w.amount, 0);
}
