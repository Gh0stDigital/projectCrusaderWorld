// Game state types. Plain data only, so a match can be saved and tested as-is.

export type PlayerId = 'p1' | 'p2';
export const PLAYERS: readonly PlayerId[] = ['p1', 'p2'];

/** The three Lord classes. Each player has exactly one Lord of each. */
export type LordClass = 'army' | 'garrison' | 'raiders';
export const LORD_CLASSES: readonly LordClass[] = ['army', 'garrison', 'raiders'];

/** Region squares on the 3×3 Region board, numbered 0–8 left to right, top to bottom. */
export type RegionIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const REGIONS: readonly RegionIndex[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export const CAPTAINS_PER_LORD = 2;

export interface Captain {
  id: string;
  owner: PlayerId;
  lord: LordClass;
  /** 1 or 2: which of the Lord's Captains this is. */
  rank: number;
  /** Where the Captain is stationed, or null while still waiting with their Lord. */
  region: RegionIndex | null;
}

export interface PlayerState {
  id: PlayerId;
  /** The player's chosen Lord turn order, or null until it is set. */
  lordOrder: LordClass[] | null;
  /** Turns this player has finished. Picks their next Lord from lordOrder. */
  turnsTaken: number;
}

/**
 * - lordOrder: players are placing their Lords in turn order, one player at a time.
 * - turns: normal alternating turns.
 */
export type MatchPhase = 'lordOrder' | 'turns';

/**
 * Step within a turn. Only Command and End exist so far; Placement, Attack and
 * Battle are added with Knights.
 */
export type TurnStep = 'command' | 'end';

export interface TurnState {
  player: PlayerId;
  /** The Lord whose turn it is. Fixed when the turn starts. */
  lord: LordClass;
  step: TurnStep;
  /** Captain deployed this turn, if any. */
  deployedCaptainId: string | null;
}

export interface MatchState {
  phase: MatchPhase;
  /** During lordOrder: whose order is being placed. */
  orderingPlayer: PlayerId | null;
  /** Counts every turn from 1. 0 before the first turn. */
  turnNumber: number;
  /** The turn in progress, or null during setup. */
  turn: TurnState | null;
  players: Record<PlayerId, PlayerState>;
  captains: Record<string, Captain>;
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}
