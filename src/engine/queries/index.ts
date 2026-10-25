// Read-only questions about a match. The UI and the computer player use these
// to know what is legal; the rules use them to validate actions.
import {
  KNIGHT_HP,
  REGIONS,
  SUBCLASS_HP,
  SQUARES,
  type Captain,
  type Duel,
  type DuelRole,
  type Knight,
  type LordClass,
  type MatchState,
  type PlayerId,
  type RegionIndex,
  type Sergeant,
  type SquareIndex,
} from '../state';

/** The Lord a player will use on their next turn. Only advances when that player finishes a turn. */
export function nextLordFor(state: MatchState, player: PlayerId): LordClass | null {
  const { lordOrder, turnsTaken } = state.players[player];
  if (!lordOrder) return null;
  return lordOrder[turnsTaken % lordOrder.length] ?? null;
}

export function captainsOf(state: MatchState, player: PlayerId, lord?: LordClass): Captain[] {
  return Object.values(state.captains)
    .filter((c) => c.owner === player && (lord === undefined || c.lord === lord))
    .sort((a, b) => a.rank - b.rank);
}

/** Captains in a Region, at most one per player. */
export function captainsInRegion(state: MatchState, region: RegionIndex): Captain[] {
  return Object.values(state.captains).filter((c) => c.region === region);
}

export function captainInRegion(state: MatchState, region: RegionIndex, player: PlayerId): Captain | null {
  return captainsInRegion(state, region).find((c) => c.owner === player) ?? null;
}

export function knightsOf(state: MatchState, captainId: string): Knight[] {
  return Object.values(state.knights)
    .filter((k) => k.captainId === captainId)
    .sort((a, b) => a.number - b.number);
}

/** Staffed Knights waiting with their Captain, ready to be placed. */
export function reserveKnights(state: MatchState, captainId: string): Knight[] {
  return knightsOf(state, captainId).filter((k) => k.status === 'ready');
}

export function knightAt(state: MatchState, region: RegionIndex, square: SquareIndex): Knight | null {
  return (
    Object.values(state.knights).find(
      (k) => k.status === 'fielded' && k.position?.region === region && k.position.square === square,
    ) ?? null
  );
}

/** Empty squares a Knight could still be placed on. A secured Region has none. */
export function emptySquares(state: MatchState, region: RegionIndex): SquareIndex[] {
  if (state.secured[region]) return [];
  return SQUARES.filter((square) => knightAt(state, region, square) === null);
}

/** The eight lines of a 3×3 board: rows, columns and diagonals. */
export const LINES: readonly (readonly [SquareIndex, SquareIndex, SquareIndex])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** The line of three a player's Knights complete in a Region, if any. */
export function winningLine(
  state: MatchState,
  region: RegionIndex,
  player: PlayerId,
): readonly [SquareIndex, SquareIndex, SquareIndex] | null {
  return LINES.find((line) => line.every((sq) => knightAt(state, region, sq)?.owner === player)) ?? null;
}

/**
 * Regions a player can send a new Captain to: none of their own Captains
 * there yet (the opponent may share it) and room left on its board.
 */
export function regionsOpenTo(state: MatchState, player: PlayerId): RegionIndex[] {
  return REGIONS.filter(
    (region) => captainInRegion(state, region, player) === null && emptySquares(state, region).length > 0,
  );
}

/**
 * Whether a Captain could act this turn: deploy (if Ready) or resume (if stationed),
 * and then actually place a Knight.
 */
export function captainCanAct(state: MatchState, captain: Captain): boolean {
  if (reserveKnights(state, captain.id).length === 0) return false;
  if (captain.region === null) return regionsOpenTo(state, captain.owner).length > 0;
  return emptySquares(state, captain.region).length > 0;
}

/**
 * What the player may do in this turn's Command step.
 * - routed: the last placement sends them to `route`. If they already have a
 *   Captain there who can act, that Captain takes the turn; otherwise one of the
 *   current Lord's Ready Captains deploys there.
 * - lordCaptains: the current Lord has no Ready Captain left, so routing is
 *   ignored and they choose one of that Lord's stationed Captains.
 * - free: no route yet, or the routed Region is closed to them; they deploy a
 *   Ready Captain to any open Region (or, if none is open, resume any Captain).
 */
export interface CommandOptions {
  mode: 'routed' | 'lordCaptains' | 'free';
  /** The routed Region, when there is one (even if it turned out closed). */
  route: RegionIndex | null;
  /** Regions a Ready Captain of the current Lord may deploy to. */
  deployRegions: RegionIndex[];
  /** Stationed Captains that may be given orders. */
  resumeCaptainIds: string[];
}

export function commandOptions(state: MatchState): CommandOptions {
  const turn = state.turn;
  const none: CommandOptions = { mode: 'free', route: null, deployRegions: [], resumeCaptainIds: [] };
  if (!turn || turn.step !== 'command') return none;
  const player = turn.player;
  const lordCaptains = captainsOf(state, player, turn.lord);
  const ready = lordCaptains.filter((c) => c.region === null && reserveKnights(state, c.id).length > 0);
  const route = state.route;

  if (ready.length === 0) {
    return {
      mode: 'lordCaptains',
      route,
      deployRegions: [],
      resumeCaptainIds: lordCaptains.filter((c) => c.region !== null && captainCanAct(state, c)).map((c) => c.id),
    };
  }

  if (route !== null) {
    const stationed = captainInRegion(state, route, player);
    if (stationed && captainCanAct(state, stationed)) {
      // The current Lord's own Captain is there: they must play it.
      if (stationed.lord === turn.lord) {
        return { mode: 'routed', route, deployRegions: [], resumeCaptainIds: [stationed.id] };
      }
      // Another Lord's Captain is there: not mandatory. Deploy a Ready Captain
      // anywhere open, or command that Captain there. With nowhere else open,
      // it becomes a must-play-here.
      const elsewhere = regionsOpenTo(state, player);
      if (elsewhere.length > 0) {
        return { mode: 'free', route, deployRegions: elsewhere, resumeCaptainIds: [stationed.id] };
      }
      return { mode: 'routed', route, deployRegions: [], resumeCaptainIds: [stationed.id] };
    }
    if (!stationed && emptySquares(state, route).length > 0) {
      return { mode: 'routed', route, deployRegions: [route], resumeCaptainIds: [] };
    }
  }

  const open = regionsOpenTo(state, player);
  if (open.length > 0) return { mode: 'free', route, deployRegions: open, resumeCaptainIds: [] };
  return {
    mode: 'free',
    route,
    deployRegions: [],
    resumeCaptainIds: captainsOf(state, player)
      .filter((c) => c.region !== null && captainCanAct(state, c))
      .map((c) => c.id),
  };
}

/** Captains that can be chosen this turn. Empty when nothing can be done. */
export function actionableCaptains(state: MatchState): Captain[] {
  const turn = state.turn;
  if (!turn || turn.step !== 'command') return [];
  const options = commandOptions(state);
  const deployers =
    options.deployRegions.length > 0
      ? captainsOf(state, turn.player, turn.lord).filter(
          (c) => c.region === null && reserveKnights(state, c.id).length > 0,
        )
      : [];
  const resumers = options.resumeCaptainIds.map((id) => state.captains[id]!);
  return [...deployers, ...resumers];
}

/** The Captain acting this turn, once chosen. */
export function actingCaptain(state: MatchState): Captain | null {
  const id = state.turn?.captainId;
  return id ? (state.captains[id] ?? null) : null;
}

/** Squares the acting Captain may place a Knight on right now. */
export function legalSquares(state: MatchState): SquareIndex[] {
  const turn = state.turn;
  const captain = actingCaptain(state);
  if (!turn || turn.step !== 'placement' || !captain || captain.region === null) return [];
  return emptySquares(state, captain.region);
}

// --- Adjacency and attacks ---

/** Squares directly up, down, left and right of a square (no diagonals). */
export function adjacentSquares(square: SquareIndex): SquareIndex[] {
  const row = Math.floor(square / 3);
  const col = square % 3;
  const result: number[] = [];
  if (row > 0) result.push(square - 3);
  if (row < 2) result.push(square + 3);
  if (col > 0) result.push(square - 1);
  if (col < 2) result.push(square + 1);
  return result as SquareIndex[];
}

/** Enemy Knights the Knight placed this turn may attack. */
export function attackTargets(state: MatchState): Knight[] {
  const turn = state.turn;
  if (!turn || turn.step !== 'attack' || !turn.placedKnightId) return [];
  const attacker = state.knights[turn.placedKnightId];
  if (!attacker?.position) return [];
  const { region, square } = attacker.position;
  // Archers shoot along their row or column at any distance; others strike adjacent squares.
  const squares = attacker.subclass === 'archers' ? lineSquares(square) : adjacentSquares(square);
  return squares
    .map((s) => knightAt(state, region, s))
    .filter((k): k is Knight => k !== null && k.owner !== attacker.owner);
}

/** Every other square in the same row or column. */
export function lineSquares(square: SquareIndex): SquareIndex[] {
  const row = Math.floor(square / 3);
  const col = square % 3;
  return SQUARES.filter((s) => s !== square && (Math.floor(s / 3) === row || s % 3 === col));
}

export function canEndTurn(state: MatchState): boolean {
  const turn = state.turn;
  if (!turn) return false;
  if (turn.step === 'end' || turn.step === 'attack') return true;
  return turn.step === 'command' && actionableCaptains(state).length === 0;
}

// --- Duels ---

export function duelKnight(state: MatchState, duel: Duel, role: DuelRole): Knight {
  return state.knights[duel[role].knightId]!;
}

/** Sergeants of a Knight that are still alive and haven't fought yet in this duel. */
export function availableSergeants(state: MatchState, duel: Duel, role: DuelRole): Sergeant[] {
  const used = new Set(duel.clashes.map((c) => c[role]?.sergeantId).filter(Boolean));
  const blocked = new Set(duel.blocked?.[role] ?? []);
  return duelKnight(state, duel, role).sergeants.filter((s) => s.militia > 0 && !used.has(s.id) && !blocked.has(s.id));
}

/** The duel role a player has in the current duel, if any. */
export function duelRoleOf(duel: Duel, player: PlayerId): DuelRole | null {
  if (duel.attacker.player === player) return 'attacker';
  if (duel.defender.player === player) return 'defender';
  return null;
}

// --- Militia ---

export function sergeantMilitia(knight: Knight): number {
  return knight.sergeants.reduce((sum, s) => sum + s.militia, 0);
}

/** Living men in a Knight's company: the Knight's own HP plus their Sergeants' men. */
export function knightMilitia(knight: Knight): number {
  if (knight.status !== 'ready' && knight.status !== 'fielded') return 0;
  return knight.hp + sergeantMilitia(knight);
}

/** A Captain's reserve plus every living Knight under them. */
export function captainMilitia(state: MatchState, captainId: string): number {
  const captain = state.captains[captainId];
  if (!captain) return 0;
  return captain.reserve + knightsOf(state, captainId).reduce((sum, k) => sum + knightMilitia(k), 0);
}

/** A Lord's reserve plus everything under their Captains. */
export function lordMilitia(state: MatchState, player: PlayerId, lord: LordClass): number {
  return (
    state.players[player].lordReserves[lord] +
    captainsOf(state, player, lord).reduce((sum, c) => sum + captainMilitia(state, c.id), 0)
  );
}

export function playerMilitia(state: MatchState, player: PlayerId): number {
  const order = state.players[player].lordOrder ?? (['army', 'garrison', 'raiders'] as LordClass[]);
  return order.reduce((sum, lord) => sum + lordMilitia(state, player, lord), 0);
}

/** A Knight's normal maximum HP: their type's base HP (Gatekeepers Brace to 100), else KNIGHT_HP. */
export function normalMaxHp(knight: Pick<Knight, 'subclass'>): number {
  return (knight.subclass && SUBCLASS_HP[knight.subclass]) ?? KNIGHT_HP;
}
