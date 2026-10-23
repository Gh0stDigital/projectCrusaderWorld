// Every possible player input, as data. The engine validates each one.
import type { LordClass, PlayerId, RegionIndex, SquareIndex } from '../state';

export type MatchAction =
  | { type: 'setLordOrder'; player: PlayerId; order: LordClass[] }
  | { type: 'deployCaptain'; player: PlayerId; captainId: string; region: RegionIndex }
  | { type: 'resumeCaptain'; player: PlayerId; captainId: string }
  | { type: 'placeKnight'; player: PlayerId; knightId: string; square: SquareIndex }
  | { type: 'endTurn'; player: PlayerId };
