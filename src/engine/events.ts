// What happened, reported by the engine for the UI to show and animate.
import type { LordClass, PlayerId, RegionIndex } from './state';

export type MatchEvent =
  | { type: 'lordOrderSet'; player: PlayerId; order: LordClass[] }
  | { type: 'turnStarted'; player: PlayerId; lord: LordClass; turnNumber: number; canDeploy: boolean }
  | { type: 'captainDeployed'; player: PlayerId; captainId: string; lord: LordClass; region: RegionIndex }
  | { type: 'turnEnded'; player: PlayerId };
