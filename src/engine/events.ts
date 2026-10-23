// What happened, reported by the engine for the UI to show and animate.
import type { LordClass, PlayerId, RegionIndex, SquareIndex } from './state';

export type MatchEvent =
  | { type: 'lordOrderSet'; player: PlayerId; order: LordClass[] }
  | { type: 'turnStarted'; player: PlayerId; lord: LordClass; turnNumber: number; canAct: boolean }
  | { type: 'captainDeployed'; player: PlayerId; captainId: string; lord: LordClass; region: RegionIndex }
  | { type: 'captainResumed'; player: PlayerId; captainId: string; region: RegionIndex }
  | { type: 'knightPlaced'; player: PlayerId; knightId: string; region: RegionIndex; square: SquareIndex }
  | { type: 'turnEnded'; player: PlayerId };
