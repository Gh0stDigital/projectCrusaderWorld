// Read-only questions about a match. The UI and the computer player use these
// to know what is legal; the rules use them to validate actions.
import {
  BRACE_BONUS,
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

/** Empty squares a Knight could still be placed on. A secured or closed Region has none. */
export function emptySquares(state: MatchState, region: RegionIndex): SquareIndex[] {
  if (state.secured[region] || state.closed.includes(region)) return [];
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
  if (captain.fallen) return false;
  if (captain.region === null) {
    return reserveKnights(state, captain.id).length > 0 && regionsOpenTo(state, captain.owner).length > 0;
  }
  if (isStationed(state, captain)) return stationedCanAct(state, captain);
  return captainCanPlace(state, captain) || captainAttackers(state, captain).length > 0 || captainMovers(state, captain).length > 0;
}

/** Empty squares directly up, down, left or right of a Knight on the board (turn-independent). */
function stepSquares(state: MatchState, knight: Knight): SquareIndex[] {
  if (knight.status !== 'fielded' || !knight.position) return [];
  const { region, square } = knight.position;
  if (emptySquares(state, region).length === 0) return [];
  return adjacentSquares(square).filter((s) => knightAt(state, region, s) === null);
}

/** A stationed Captain's Knights on their board that could step to an adjacent empty square. */
export function captainMovers(state: MatchState, captain: Captain): Knight[] {
  if (captain.region === null) return [];
  return knightsOf(state, captain.id).filter((k) => k.position?.region === captain.region && stepSquares(state, k).length > 0);
}

/** Where a Knight may move right now: only before any placement, move or attack this turn. */
export function moveSquares(state: MatchState, knightId: string): SquareIndex[] {
  const turn = state.turn;
  const captain = actingCaptain(state);
  if (!turn || turn.step !== 'orders' || turn.placedKnightId || turn.movedKnightId || turn.attacked || !captain) return [];
  const knight = state.knights[knightId];
  if (!knight || knight.captainId !== captain.id || knight.position?.region !== captain.region) return [];
  return stepSquares(state, knight);
}

/** The acting Captain's Knights that can move right now. */
export function movers(state: MatchState): Knight[] {
  const captain = actingCaptain(state);
  if (!captain) return [];
  return captainMovers(state, captain).filter((k) => moveSquares(state, k.id).length > 0);
}

/** Whether this turn's placement or move can still be undone. */
export function canUndoKnight(state: MatchState): boolean {
  const turn = state.turn;
  return Boolean(turn?.undo) && (turn!.step === 'orders' || turn!.step === 'end');
}

/** A stationed Captain with a waiting Knight and an empty square in their Region. */
export function captainCanPlace(state: MatchState, captain: Captain): boolean {
  return (
    captain.region !== null &&
    reserveKnights(state, captain.id).length > 0 &&
    emptySquares(state, captain.region).length > 0
  );
}

/** A Captain's Knights on their Region's board that have an enemy to attack. */
export function captainAttackers(state: MatchState, captain: Captain): Knight[] {
  if (captain.region === null || state.secured[captain.region] || state.closed.includes(captain.region)) return [];
  return knightsOf(state, captain.id).filter(
    (k) => k.status === 'fielded' && k.position?.region === captain.region && targetsFrom(state, k).length > 0,
  );
}

/**
 * What the player may do in this turn's Command step.
 * - routed: the last placement sends them to `route`. If they already have a
 *   Captain there who can act, that Captain takes the turn; otherwise one of the
 *   current Lord's Ready Captains deploys there.
 * - lordCaptains: the current Lord has no Ready Captain left and none of their
 *   Captains can act in the routed Region, so they choose one of that Lord's
 *   deployed Captains. (One who can act in the routed Region makes it routed.)
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
  const ready = lordCaptains.filter((c) => c.region === null && !c.fallen && reserveKnights(state, c.id).length > 0);
  const route = state.route;

  if (ready.length === 0) {
    // Both Captains deployed: a route into a Region where one of them can act
    // is a Fated Move (that Captain must play there). Otherwise the Lord chooses.
    if (route !== null) {
      const own = lordCaptains.find((c) => c.region === route && captainCanAct(state, c));
      if (own) return { mode: 'routed', route, deployRegions: [], resumeCaptainIds: [own.id] };
    }
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
        return {
          mode: 'free',
          route,
          deployRegions: elsewhere,
          resumeCaptainIds: [stationed.id, ...stationedOf(state, player, turn.lord)],
        };
      }
      return { mode: 'routed', route, deployRegions: [], resumeCaptainIds: [stationed.id] };
    }
    if (!stationed && emptySquares(state, route).length > 0) {
      return { mode: 'routed', route, deployRegions: [route], resumeCaptainIds: [] };
    }
  }

  const open = regionsOpenTo(state, player);
  if (open.length > 0) return { mode: 'free', route, deployRegions: open, resumeCaptainIds: stationedOf(state, player, turn.lord) };
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
          (c) => c.region === null && !c.fallen && reserveKnights(state, c.id).length > 0,
        )
      : [];
  const resumers = options.resumeCaptainIds.map((id) => state.captains[id]!);
  return [...deployers, ...resumers];
}

/**
 * Fated Move: routing forces where the Lord plays this turn.
 * Free Choice: the Lord chooses where to deploy or which deployed Captain to command.
 * Null outside the command step or when the Lord has no orders to give.
 */
export type MoveType = 'fated' | 'control';
export function moveType(state: MatchState): MoveType | null {
  if (actionableCaptains(state).length === 0) return null;
  return commandOptions(state).mode === 'routed' ? 'fated' : 'control';
}

/** With both of the Lord's Captains deployed, the Regions where they can be commanded this turn. */
export function commandableRegions(state: MatchState): RegionIndex[] {
  const options = commandOptions(state);
  if (options.mode !== 'lordCaptains') return [];
  return options.resumeCaptainIds
    .map((id) => state.captains[id]!.region)
    .filter((r): r is RegionIndex => r !== null);
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
  if (!turn || turn.step !== 'orders' || turn.placedKnightId || turn.movedKnightId || !captain || !captainCanPlace(state, captain)) return [];
  return emptySquares(state, captain.region!);
}

/** Whether the acting Captain can still place a Knight this turn. */
export function canPlaceNow(state: MatchState): boolean {
  return legalSquares(state).length > 0;
}

/** The acting Captain's Knights that can attack right now (this turn's attack unused). */
export function attackers(state: MatchState): Knight[] {
  const turn = state.turn;
  const captain = actingCaptain(state);
  if (!turn || turn.step !== 'orders' || turn.attacked || turn.movedKnightId || !captain) return [];
  return captainAttackers(state, captain);
}

/** The step after an order: more orders while a placement or an attack is still possible, else end. */
export function nextOrdersStep(state: MatchState): 'orders' | 'end' {
  const turn = state.turn!;
  const captain = actingCaptain(state);
  if (!captain) return 'end';
  if (turn.movedKnightId) return 'end';
  const canPlace = !turn.placedKnightId && captainCanPlace(state, captain);
  const canAttack = !turn.attacked && captainAttackers(state, captain).length > 0;
  return canPlace || canAttack ? 'orders' : 'end';
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
/** Enemies a Knight on the board this turn could attack (empty unless it is one of the current attackers). */
export function attackTargets(state: MatchState, attackerId: string | null): Knight[] {
  if (!attackerId || !attackers(state).some((k) => k.id === attackerId)) return [];
  return targetsFrom(state, state.knights[attackerId]!);
}

/** Enemies within reach of a Knight on the board, whatever the turn. */
export function targetsFrom(state: MatchState, attacker: Knight): Knight[] {
  if (attacker.status !== 'fielded' || !attacker.position) return [];
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
  if (retreatDecider(state)) return false;
  if (turn.step === 'end') return true;
  if (turn.step === 'orders') return turn.placedKnightId !== null || turn.movedKnightId !== null || turn.attacked || turn.stationOrder;
  return turn.step === 'command' && actionableCaptains(state).length === 0;
}

// --- Duels ---

/** The player who must choose whether their losing Knight retreats or holds, if any. */
export function retreatDecider(state: MatchState): PlayerId | null {
  const outcome = state.duel?.outcome;
  if (!outcome?.winner || outcome.loserFate !== 'deciding') return null;
  return state.duel![outcome.winner === 'attacker' ? 'defender' : 'attacker'].player;
}

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

/** Men behind a Knight's HP. A braced Gatekeeper's men are worth 2 HP each. */
export function knightHpMen(knight: Pick<Knight, 'hp' | 'braced'>): number {
  return knight.braced ? Math.ceil(knight.hp / 2) : knight.hp;
}

/** Living men in a Knight's company: the men behind the Knight's HP plus their Sergeants' men. */
export function knightMilitia(knight: Knight): number {
  if (knight.status !== 'ready' && knight.status !== 'fielded') return 0;
  return knightHpMen(knight) + sergeantMilitia(knight);
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

/** A Knight's normal maximum HP: their type's base HP, plus Brace once a Gatekeeper has used it. */
export function normalMaxHp(knight: Pick<Knight, 'subclass' | 'braced'>): number {
  return ((knight.subclass && SUBCLASS_HP[knight.subclass]) ?? KNIGHT_HP) + (knight.braced ? BRACE_BONUS : 0);
}

// --- Decisive battles ---

/**
 * A Region stalemates when nobody holds it, both players have a Captain there,
 * and no more Knights can be placed (board full, or neither Captain has one left).
 */
export function isStalemate(state: MatchState, region: RegionIndex): boolean {
  if (state.secured[region] || state.closed.includes(region)) return false;
  const a = captainInRegion(state, region, 'p1');
  const b = captainInRegion(state, region, 'p2');
  if (!a || !b || a.fallen || b.fallen) return false;
  if (emptySquares(state, region).length === 0) return true;
  return reserveKnights(state, a.id).length === 0 && reserveKnights(state, b.id).length === 0;
}

/** A player's Knights standing on a Region's board. */
export function knightsOnBoard(state: MatchState, region: RegionIndex, player: PlayerId): Knight[] {
  return Object.values(state.knights).filter(
    (k) => k.status === 'fielded' && k.owner === player && k.position?.region === region,
  );
}

/** Whose roll it is in the decisive battle: alternating from `first`, until each side's chances run out. */
export function decisiveRoller(state: MatchState): PlayerId | null {
  const d = state.decisive;
  if (!d || d.outcome) return null;
  const used = (p: PlayerId) => d.rolls.filter((r) => r.player === p).length;
  const left = (p: PlayerId) => d.chances[p] - used(p);
  const second: PlayerId = d.first === 'p1' ? 'p2' : 'p1';
  const last = d.rolls[d.rolls.length - 1]?.player;
  const preferred = last === undefined ? d.first : last === d.first ? second : d.first;
  if (left(preferred) > 0) return preferred;
  const other: PlayerId = preferred === 'p1' ? 'p2' : 'p1';
  return left(other) > 0 ? other : null;
}

// --- Stationed Captains (holding a secured Region) ---

/** Regions directly up, down, left or right of a Region on the big board. */
export function adjacentRegions(region: RegionIndex): RegionIndex[] {
  return adjacentSquares(region as SquareIndex) as RegionIndex[];
}

/** A Captain holding the secured Region they stand in. */
export function isStationed(state: MatchState, captain: Captain): boolean {
  return captain.region !== null && !captain.fallen && state.secured[captain.region]?.captainId === captain.id;
}

/** The current Lord's stationed Captains that can give an order: offered on a Free Choice. */
function stationedOf(state: MatchState, player: PlayerId, lord: LordClass): string[] {
  return captainsOf(state, player, lord)
    .filter((c) => isStationed(state, c) && stationedCanAct(state, c))
    .map((c) => c.id);
}

/** A stationed Captain's men it could send: its reserve and its Knights (waiting, or on its secured board). */
export function sendableKnights(state: MatchState, captain: Captain): Knight[] {
  return knightsOf(state, captain.id).filter((k) => k.status === 'ready' || k.status === 'fielded');
}

/** Your Captains deployed in adjacent, unsecured Regions: who a stationed Captain can send men to. */
export function sendTargets(state: MatchState, captain: Captain): Captain[] {
  if (!isStationed(state, captain)) return [];
  return adjacentRegions(captain.region!)
    .filter((r) => !state.secured[r] && !state.closed.includes(r))
    .map((r) => captainInRegion(state, r, captain.owner))
    .filter((c): c is Captain => c !== null && !c.fallen);
}

/** Adjacent Regions held by the enemy, with their Captain there: what a stationed Captain can assault. */
export function assaultTargets(state: MatchState, captain: Captain): RegionIndex[] {
  if (!isStationed(state, captain)) return [];
  return adjacentRegions(captain.region!).filter((r) => {
    const held = state.secured[r];
    if (!held || held.player === captain.owner) return false;
    const holder = state.captains[held.captainId];
    return Boolean(holder && !holder.fallen && holder.region === r);
  });
}

/** Whether a stationed Captain has any order to give: send men somewhere, or assault. */
export function stationedCanAct(state: MatchState, captain: Captain): boolean {
  const targets = sendTargets(state, captain);
  const canSendReserve = captain.reserve > 0 && targets.length > 0;
  const canSendKnight = sendableKnights(state, captain).length > 0 && targets.some((c) => hasFreeSlot(state, c.id));
  return canSendReserve || canSendKnight || assaultTargets(state, captain).length > 0;
}

/** The acting Captain, if stationed and still owed its one order this turn. */
export function stationedOrdersOpen(state: MatchState): Captain | null {
  const turn = state.turn;
  const captain = actingCaptain(state);
  if (!turn || turn.step !== 'orders' || turn.stationOrder || !captain || !isStationed(state, captain)) return null;
  return captain;
}

/** Standby Captains of a player who still have a Knight: who can be stationed in a Region just taken. */
export function stationCandidates(state: MatchState, player: PlayerId): Captain[] {
  return Object.values(state.captains).filter(
    (c) => c.owner === player && c.region === null && !c.fallen && reserveKnights(state, c.id).length > 0,
  );
}

/** Whoever holds three secured Regions in a row on the big board, if anyone. */
export function matchWinner(state: MatchState): PlayerId | null {
  for (const player of ['p1', 'p2'] as const) {
    if (LINES.some((line) => line.every((r) => state.secured[r as RegionIndex]?.player === player))) return player;
  }
  return null;
}

/** Whether a Captain has an empty (unmanned) Knight slot another Captain's Knight could join. */
export function hasFreeSlot(state: MatchState, captainId: string): boolean {
  return knightsOf(state, captainId).some((k) => k.status === 'unmanned');
}
