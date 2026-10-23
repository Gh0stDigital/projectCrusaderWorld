// Game state types. Plain data only, so a match can be saved and tested as-is.

export type PlayerId = 'p1' | 'p2';
export const PLAYERS: readonly PlayerId[] = ['p1', 'p2'];

/** The three Lord classes. Each player has exactly one Lord of each. */
export type LordClass = 'army' | 'garrison' | 'raiders';
export const LORD_CLASSES: readonly LordClass[] = ['army', 'garrison', 'raiders'];

/** Squares on a 3×3 board, numbered 0–8 left to right, top to bottom. */
export type BoardIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const BOARD_INDEXES: readonly BoardIndex[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** A Region on the big Region board. */
export type RegionIndex = BoardIndex;
export const REGIONS: readonly RegionIndex[] = BOARD_INDEXES;

/** A square on a Region's own inner board. */
export type SquareIndex = BoardIndex;
export const SQUARES: readonly SquareIndex[] = BOARD_INDEXES;

export const CAPTAINS_PER_LORD = 2;
export const KNIGHTS_PER_CAPTAIN = 6;

export interface Captain {
  id: string;
  owner: PlayerId;
  lord: LordClass;
  /** 1 or 2: which of the Lord's Captains this is. */
  rank: number;
  /** Where the Captain is stationed, or null while still waiting with their Lord. */
  region: RegionIndex | null;
}

export interface Knight {
  id: string;
  owner: PlayerId;
  captainId: string;
  /** 1–6 within the Captain's company. */
  number: number;
  /** Where the Knight stands, or null while waiting with their Captain. Knights never move once placed. */
  position: { region: RegionIndex; square: SquareIndex } | null;
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
 * Step within a turn:
 * - command: choose a Captain of the current Lord (deploy a new one or resume a stationed one)
 * - placement: place one of that Captain's Knights in their Region
 * - end: orders are done; waiting for End Turn
 * Attack and Battle are added with combat.
 */
export type TurnStep = 'command' | 'placement' | 'end';

export interface TurnState {
  player: PlayerId;
  /** The Lord whose turn it is. Fixed when the turn starts. */
  lord: LordClass;
  step: TurnStep;
  /** The Captain acting this turn, once chosen. */
  captainId: string | null;
  /** The Knight placed this turn, if any. */
  placedKnightId: string | null;
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
  knights: Record<string, Knight>;
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}
