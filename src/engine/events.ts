// What happened, reported by the engine for the UI to show and animate.
import type { Clash, DuelOutcome, DuelRole, LordClass, PlayerId, RegionIndex, SquareIndex } from './state';

export type MatchEvent =
  | { type: 'lordOrderSet'; player: PlayerId; order: LordClass[] }
  | { type: 'turnStarted'; player: PlayerId; lord: LordClass; turnNumber: number; canAct: boolean }
  | { type: 'captainDeployed'; player: PlayerId; captainId: string; lord: LordClass; region: RegionIndex }
  | { type: 'captainResumed'; player: PlayerId; captainId: string; region: RegionIndex }
  | { type: 'knightPlaced'; player: PlayerId; knightId: string; region: RegionIndex; square: SquareIndex }
  | { type: 'duelStarted'; attackerId: string; defenderId: string; region: RegionIndex }
  /** A side has locked in a Sergeant. Which one stays hidden until the clash resolves. */
  | { type: 'sergeantCommitted'; player: PlayerId; role: DuelRole }
  | { type: 'clashResolved'; clash: Clash }
  | { type: 'duelEnded'; outcome: DuelOutcome; attackerId: string; defenderId: string }
  | { type: 'knightMoved'; player: PlayerId; knightId: string; region: RegionIndex; from: SquareIndex; to: SquareIndex }
  | { type: 'knightOrderUndone'; player: PlayerId; knightId: string }
  | { type: 'decisiveStarted'; region: RegionIndex; first: PlayerId }
  | { type: 'dieRolled'; player: PlayerId; value: number; damage: number }
  | {
      type: 'decisiveEnded';
      region: RegionIndex;
      winner: PlayerId | null;
      loserKilled: boolean;
      capturedKnightIds: string[];
      returnedCaptainIds: string[];
      fallenCaptainIds: string[];
    }
  | { type: 'loserChose'; player: PlayerId; knightId: string; retreat: boolean }
  | { type: 'knightReinforced'; player: PlayerId; knightId: string; captainId: string; amount: number }
  | {
      type: 'regionSecured';
      player: PlayerId;
      captainId: string;
      region: RegionIndex;
      capturedKnightIds: string[];
      /** Losing Captains who went back to their Lord, and those who fell (no men left). */
      returnedCaptainIds: string[];
      fallenCaptainIds: string[];
    }
  | { type: 'turnEnded'; player: PlayerId };
