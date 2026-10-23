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

// --- Army structure and starting militia (test values) ---
// Each Lord: 200 reserve + 2 Captains × (100 reserve + 3 staffed Knights × (50 HP + 5 Sergeants × 10)) = 1,000.
export const CAPTAINS_PER_LORD = 2;
export const KNIGHTS_PER_CAPTAIN = 6;
export const STAFFED_KNIGHTS_PER_CAPTAIN = 3;
export const SERGEANTS_PER_KNIGHT = 5;
export const LORD_RESERVE = 200;
export const CAPTAIN_RESERVE = 100;
export const KNIGHT_HP = 50;
export const SERGEANT_MILITIA = 10;

/** Sergeant tactics. Rush beats Flank, Flank beats Counter, Counter beats Rush. */
export type Tactic = 'rush' | 'flank' | 'counter';
export const TACTICS: readonly Tactic[] = ['rush', 'flank', 'counter'];

export interface Sergeant {
  id: string;
  tactic: Tactic;
  /** Men under this Sergeant: the damage they deal when their tactic wins. */
  militia: number;
}

export interface Captain {
  id: string;
  owner: PlayerId;
  lord: LordClass;
  /** 1 or 2: which of the Lord's Captains this is. */
  rank: number;
  /** Where the Captain is stationed, or null while still waiting with their Lord. */
  region: RegionIndex | null;
  /** Militia held back by the Captain, not assigned to any Knight. */
  reserve: number;
}

/**
 * - unmanned: an empty Knight slot with no men; cannot be placed
 * - ready: staffed and waiting with their Captain
 * - fielded: standing on a square
 * - dead: killed in battle
 */
export type KnightStatus = 'unmanned' | 'ready' | 'fielded' | 'dead';

export interface Knight {
  id: string;
  owner: PlayerId;
  captainId: string;
  /** 1–6 within the Captain's company. */
  number: number;
  status: KnightStatus;
  /** Where the Knight stands while fielded. Knights never move once placed. */
  position: { region: RegionIndex; square: SquareIndex } | null;
  /** The Knight's own militia: their hit points. 0 means dead. */
  hp: number;
  /** Surviving Sergeants. A Sergeant whose militia reaches 0 is removed. */
  sergeants: Sergeant[];
}

export interface PlayerState {
  id: PlayerId;
  /** The player's chosen Lord turn order, or null until it is set. */
  lordOrder: LordClass[] | null;
  /** Turns this player has finished. Picks their next Lord from lordOrder. */
  turnsTaken: number;
  /** Militia held in reserve by each Lord. */
  lordReserves: Record<LordClass, number>;
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
 * - attack: the placed Knight may attack an adjacent enemy Knight, or the turn can end
 * - battle: a duel is being fought
 * - end: orders are done; waiting for End Turn
 */
export type TurnStep = 'command' | 'placement' | 'attack' | 'battle' | 'end';

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

export type DuelRole = 'attacker' | 'defender';

export interface DuelSide {
  knightId: string;
  player: PlayerId;
  /** HP and Sergeants when the duel began, for showing the fight from the start. */
  startHp: number;
  startSergeants: Sergeant[];
}

export interface ClashPick {
  sergeantId: string;
  tactic: Tactic;
  militia: number;
}

export interface Clash {
  number: number;
  /** null when that side had no Sergeant left to send. */
  attacker: ClashPick | null;
  defender: ClashPick | null;
  winner: DuelRole | 'tie';
  /** HP the losing Knight lost this clash. */
  damage: number;
  hpAfter: Record<DuelRole, number>;
  sergeantsAfter: Record<DuelRole, Sergeant[]>;
}

export interface DuelOutcome {
  /** null when both Knights end on equal HP: the defender holds and both stay. */
  winner: DuelRole | null;
  /** What happened to the losing Knight. */
  loserFate: 'killed' | 'retreated' | null;
}

export interface Duel {
  region: RegionIndex;
  attacker: DuelSide;
  defender: DuelSide;
  /** Sergeants committed for the current clash, hidden from the other side until both are in. */
  pending: Record<DuelRole, string | null>;
  clashes: Clash[];
  /** Set when the duel is over. */
  outcome: DuelOutcome | null;
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
  /** This turn's duel, kept until the turn ends so its result can be shown. */
  duel: Duel | null;
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}
