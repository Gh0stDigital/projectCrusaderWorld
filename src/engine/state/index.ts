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

/**
 * Knight types. Army (after battle): Infantry (Regroup), Cavalry (Second Pass),
 * Archers (ranged attacks, Cover Retreat). Garrison (before battle): Gatekeeper
 * (Brace), Watchman (Snipe), Warden (First Strike). Raiders (during battle):
 * Skirmisher (Heist), Ambusher (Ambush!), Saboteur (Sabotage).
 */
export type KnightSubclass =
  | 'infantry'
  | 'cavalry'
  | 'archers'
  | 'gatekeeper'
  | 'watchman'
  | 'warden'
  | 'skirmisher'
  | 'ambusher'
  | 'saboteur';

/** Ambush takes this many of the opponent's strongest Sergeants out of the battle. */
export const AMBUSH_COUNT = 2;
/** Sabotage costs the opponent this much HP after every clash. */
export const SABOTAGE_DAMAGE = 1;

/** Most Sergeants each Knight type leads. Spare men (versus SERGEANTS_PER_KNIGHT) go to the Captain's reserve. */
export const SUBCLASS_SERGEANTS: Record<KnightSubclass, number> = {
  infantry: 5,
  cavalry: 4,
  archers: 3,
  gatekeeper: 2,
  watchman: 3,
  warden: 3,
  skirmisher: 4,
  ambusher: 3,
  saboteur: 2,
};

/** Base HP for Knight types that differ from KNIGHT_HP (none at the moment). */
export const SUBCLASS_HP: Partial<Record<KnightSubclass, number>> = {};

/** Gatekeeper Brace: once per game, its first battle doubles its base HP (men count double, none added). */
export const BRACE_BONUS = KNIGHT_HP;

/** Cavalry's Second Pass deals this share of its remaining HP to a retreating loser. */
export const SECOND_PASS_SHARE = 0.5;

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
  /** Fell when their Region was lost with no men left to return with. */
  fallen: boolean;
}

/**
 * - unmanned: an empty Knight slot with no men; cannot be placed
 * - ready: staffed and waiting with their Captain
 * - fielded: standing on a square
 * - dead: killed in battle
 * - captured: was standing in a Region when the enemy secured it
 */
export type KnightStatus = 'unmanned' | 'ready' | 'fielded' | 'dead' | 'captured';

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
  /** The Knight's military type, set by their Lord's class. null until that class's types exist. */
  subclass: KnightSubclass | null;
  /** Gatekeeper: Brace has been used (once per game). */
  braced: boolean;
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
export type MatchPhase = 'lordOrder' | 'turns' | 'over';

/**
 * Step within a turn:
 * - command: choose a Captain of the current Lord (deploy a new one or resume a stationed one)
 * - orders: in either order, place one of that Captain's Knights and/or attack
 *   once with one of their Knights on the board (only if it has a target).
 *   Instead of both, one of their Knights on the board may step to an adjacent empty square.
 * - battle: a duel is being fought
 * - decisive: the Region stalemated as the turn ended; its Captains fight a decisive battle
 * - end: orders are done; waiting for End Turn
 */
export type TurnStep = 'command' | 'orders' | 'battle' | 'decisive' | 'station' | 'end';

export interface TurnState {
  player: PlayerId;
  /** The Lord whose turn it is. Fixed when the turn starts. */
  lord: LordClass;
  step: TurnStep;
  /** The Captain acting this turn, once chosen. */
  captainId: string | null;
  /** The Knight placed this turn, if any. */
  placedKnightId: string | null;
  /** Whether this turn's one attack has been used. */
  attacked: boolean;
  /** The Knight moved this turn instead of a placement, if any. */
  movedKnightId: string | null;
  /** A stationed Captain gave its one order this turn (sent men or launched an assault). */
  stationOrder: boolean;
  /** What the board looked like before this turn's placement or move, while it can still be undone. */
  undo: {
    knights: Record<string, Knight>;
    captains: Record<string, Captain>;
    secured: Partial<Record<RegionIndex, SecuredRegion>>;
    route: RegionIndex | null;
  } | null;
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
  /** Skirmisher: this side won the clash by Heist, whatever the tactics. */
  heist?: DuelRole;
  /** Saboteur: sides that lost SABOTAGE_DAMAGE HP after this clash. */
  sabotaged: DuelRole[];
}

export interface DuelOutcome {
  /** null when both Knights end on equal HP: the defender holds and both stay. */
  winner: DuelRole | null;
  /**
   * What happened to the losing Knight. A surviving loser's owner chooses:
   * 'deciding' until they do, then 'retreated' (back to its Captain) or 'held' (stays on its square).
   */
  loserFate: 'killed' | 'deciding' | 'retreated' | 'held' | null;
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
  /** Abilities that took effect before the first clash, in order. */
  prelude: PreludeEffect[];
  /** Sergeants that cannot fight in this battle (Ambush). They are not harmed. */
  blocked: Record<DuelRole, string[]>;
  /** Abilities that took effect after the duel, in order. */
  aftermath: AftermathEffect[];
}

/** Effects before the first clash: Brace, Garrison strikes on the attacker, and Raider ambushes. */
export type PreludeEffect =
  /** Gatekeeper: doubles its base HP, once per game. */
  | { type: 'brace'; knightId: string; amount: number }
  | { type: 'snipe' | 'firstStrike'; knightId: string; targetId: string; damage: number; killed: boolean }
  /** Ambusher: the target's strongest Sergeants sit out this battle. */
  | { type: 'ambush'; knightId: string; targetId: string; sergeantIds: string[] };

export type AftermathEffect =
  /** Infantry: tied Sergeants recover the men they lost in this duel. */
  | { type: 'regroup'; knightId: string; restored: number; sergeantIds: string[] }
  /** Cavalry: a parting strike on the retreating loser. */
  | { type: 'secondPass'; knightId: string; targetId: string; damage: number; killed: boolean }
  /** Archers: cover a retreating friendly Infantry, blocking Second Pass and striking the victor. */
  | {
      type: 'coverRetreat';
      knightId: string;
      coveredId: string;
      targetId: string;
      damage: number;
      killed: boolean;
      blockedSecondPass: boolean;
    };

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
  /**
   * Ultimate Tic-Tac-Toe routing: the Region the next player is sent to, set by
   * the square of the last Knight placed. null before the first placement.
   */
  route: RegionIndex | null;
  /** Regions won with three Knights in a row (or a decisive battle): who holds each, and through which Captain. */
  secured: Partial<Record<RegionIndex, SecuredRegion>>;
  /** Regions closed by a decisive battle that ended level: nobody holds them and nothing more happens there. */
  closed: RegionIndex[];
  /** The decisive battle being fought, if any. Cleared when the turn passes. */
  decisive: DecisiveBattle | null;
  /** After winning an assault: the Region needs a Captain stationed there (the player picks a Standby one). */
  pendingStation: {
    region: RegionIndex;
    player: PlayerId;
    /** Freed Knights whose own Captain has fallen: they join the Captain stationed there. */
    orphanKnightIds: string[];
    /** Enemy Knights captured in the assault, recorded on the Region once it is held. */
    capturedKnightIds: string[];
  } | null;
  /** Whoever secured three Regions in a row. Set when the match ends. */
  winner: PlayerId | null;
}

/** Each roll does (roller's men × die) ÷ 10 damage, rounded down. */
export const DECISIVE_DIVISOR = 10;

export interface DecisiveRoll {
  player: PlayerId;
  value: number;
  damage: number;
}

/**
 * A stalemated Region's two Captains fight with all their men. Each rolls a
 * six-sided die once per Knight of theirs on that board, taking turns (the player
 * whose turn ended first). Most men left wins; at 0 the Captain dies.
 */
export interface DecisiveBattle {
  /** stalemate: a full Region's two Captains. assault: a stationed Captain attacks an adjacent enemy-held Region. */
  kind: 'stalemate' | 'assault';
  /** The Region fought over (for an assault: the enemy-held one under attack). */
  region: RegionIndex;
  /** For an assault: the attacking Captain's own secured Region. */
  fromRegion: RegionIndex | null;
  /** Who rolls first. */
  first: PlayerId;
  captains: Record<PlayerId, string>;
  startMen: Record<PlayerId, number>;
  men: Record<PlayerId, number>;
  /** Total rolls each side gets. */
  chances: Record<PlayerId, number>;
  rolls: DecisiveRoll[];
  /** Set once every roll is used or a side is wiped out. null winner means level: the Region closes. */
  outcome: { winner: PlayerId | null; loserKilled: boolean } | null;
}

export interface SecuredRegion {
  player: PlayerId;
  captainId: string;
  /** Enemy Knights captured when it was taken; freed if the enemy wins it back. */
  capturedKnightIds: string[];
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}
