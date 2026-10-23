// Display names. Placeholder wording until factions and the Muster screen exist.
import type { LordClass, PlayerId, RegionIndex } from '../engine/state';

export const PLAYER_NAMES: Record<PlayerId, string> = {
  p1: 'Player 1',
  p2: 'Player 2',
};

export const LORD_NAMES: Record<LordClass, string> = {
  army: 'Army',
  garrison: 'Garrison',
  raiders: 'Raiders',
};

export const LORD_TITLES: Record<LordClass, string> = {
  army: 'Lord of the Army',
  garrison: 'Lord of the Garrison',
  raiders: 'Lord of the Raiders',
};

export const REGION_NAMES: Record<RegionIndex, string> = {
  0: 'Northwest',
  1: 'North',
  2: 'Northeast',
  3: 'West',
  4: 'Heartland',
  5: 'East',
  6: 'Southwest',
  7: 'South',
  8: 'Southeast',
};

export function captainName(lord: LordClass, rank: number): string {
  return `${LORD_NAMES[lord]} Captain ${rank === 1 ? 'I' : 'II'}`;
}
