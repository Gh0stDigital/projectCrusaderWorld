// Every possible player input, as data. The engine validates each one.
import type { LordClass, PlayerId, RegionIndex } from '../state';

export type MatchAction =
  | { type: 'setLordOrder'; player: PlayerId; order: LordClass[] }
  | { type: 'deployCaptain'; player: PlayerId; captainId: string; region: RegionIndex }
  | { type: 'endTurn'; player: PlayerId };
