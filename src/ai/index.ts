// Computer player. Gets the same information as a human, asks the engine what
// is legal, and sends normal actions. It never looks at the other side's
// hidden Sergeant choice.
import type { MatchAction } from '../engine/actions';
import {
  LINES,
  actingCaptain,
  actionableCaptains,
  attackTargets,
  availableSergeants,
  canEndTurn,
  commandOptions,
  duelRoleOf,
  knightAt,
  knightMilitia,
  legalSquares,
  reserveKnights,
  retreatDecider,
  attackers,
  assaultTargets,
  captainMilitia,
  hasFreeSlot,
  decisiveRoller,
  sendTargets,
  sendableKnights,
  stationCandidates,
  stationedOrdersOpen,
  moveSquares,
  movers,
} from '../engine/queries';
import {
  LORD_CLASSES,
  otherPlayer,
  type Knight,
  type LordClass,
  type MatchState,
  type PlayerId,
  type RegionIndex,
  type SquareIndex,
} from '../engine/state';

type Random = () => number;

/**
 * The computer's Sergeant for the current clash, or null when it has nothing
 * to commit. Picks at random among its own available Sergeants.
 */
export function chooseSergeant(state: MatchState, player: PlayerId, random: Random = Math.random): MatchAction | null {
  const duel = state.duel;
  if (!duel || duel.outcome) return null;
  const role = duelRoleOf(duel, player);
  if (!role || duel.pending[role]) return null;
  const options = availableSergeants(state, duel, role);
  if (options.length === 0) return null;
  const pick = options[Math.floor(random() * options.length)]!;
  return { type: 'commitSergeant', player, sergeantId: pick.id };
}

/** A random turn order for the computer's three Lords. */
export function chooseLordOrder(random: Random = Math.random): LordClass[] {
  const order = [...LORD_CLASSES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

// --- Board reading ---

/** Who stands on each square of a Region (null for empty). */
function occupancy(state: MatchState, region: RegionIndex): (PlayerId | null)[] {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((sq) => knightAt(state, region, sq as SquareIndex)?.owner ?? null);
}

/** Whether placing `player` on `square` completes a line of three. */
function completesLine(board: (PlayerId | null)[], square: number, player: PlayerId): boolean {
  return LINES.some(
    (line) => line.includes(square as SquareIndex) && line.every((sq) => sq === square || board[sq] === player),
  );
}

/** Whether a player has two in a line with the third square empty somewhere in a Region. */
function threatens(state: MatchState, region: RegionIndex, player: PlayerId): boolean {
  if (state.secured[region]) return false;
  const board = occupancy(state, region);
  return LINES.some(
    (line) => line.filter((sq) => board[sq] === player).length === 2 && line.some((sq) => board[sq] === null),
  );
}

/** How good a square is for the computer to place on. */
function scoreSquare(state: MatchState, region: RegionIndex, square: SquareIndex, player: PlayerId, random: Random) {
  const board = occupancy(state, region);
  const enemy = otherPlayer(player);
  let score = random() * 2;
  if (completesLine(board, square, player)) score += 100; // win the Region
  if (completesLine(board, square, enemy)) score += 50; // block their win
  // Where this square sends the enemy next turn: avoid Regions they can win.
  if (threatens(state, square, enemy)) score -= 30;
  if (state.secured[square]) score -= 5; // a closed Region gives them a free choice
  if (square === 4) score += 6;
  else if (square % 2 === 0) score += 3; // corners
  return score;
}

function strength(knight: Knight): number {
  return knightMilitia(knight);
}

// --- Turn decisions ---

/** Command step: which Captain to deploy (and where) or resume. */
export function chooseCommand(state: MatchState, random: Random = Math.random): MatchAction | null {
  const turn = state.turn;
  if (!turn || turn.step !== 'command') return null;
  const player = turn.player;
  const options = commandOptions(state);
  const captains = actionableCaptains(state);
  if (captains.length === 0) return null;

  if (options.deployRegions.length > 0) {
    const captain = captains.find((c) => c.region === null)!;
    // Prefer Regions the enemy is contesting, then the center, with some variety.
    const scored = options.deployRegions.map((region) => {
      const enemyThere = occupancy(state, region).filter((o) => o === otherPlayer(player)).length;
      return { region, score: enemyThere * 2 + (region === 4 ? 1.5 : 0) + random() * 2 };
    });
    scored.sort((a, b) => b.score - a.score);
    return { type: 'deployCaptain', player, captainId: captain.id, region: scored[0]!.region };
  }

  // Resume: pick the stationed Captain whose Region offers the best square.
  const resumable = options.resumeCaptainIds.map((id) => state.captains[id]!);
  let best = resumable[0]!;
  let bestScore = -Infinity;
  for (const c of resumable) {
    const squares = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((sq) => !knightAt(state, c.region!, sq as SquareIndex));
    const top = Math.max(...squares.map((sq) => scoreSquare(state, c.region!, sq as SquareIndex, player, random)));
    if (top > bestScore) {
      bestScore = top;
      best = c;
    }
  }
  return { type: 'resumeCaptain', player, captainId: best.id };
}

/** Placement step: the strongest waiting Knight on the best square. */
export function choosePlacement(state: MatchState, random: Random = Math.random): MatchAction | null {
  const turn = state.turn;
  const captain = actingCaptain(state);
  if (!turn || turn.step !== 'orders' || !captain || captain.region === null) return null;
  const squares = legalSquares(state);
  const knights = reserveKnights(state, captain.id);
  if (squares.length === 0 || knights.length === 0) return null;
  const knight = [...knights].sort((a, b) => strength(b) - strength(a))[0]!;
  const region = captain.region;
  const square = [...squares].sort(
    (a, b) => scoreSquare(state, region, b, turn.player, random) - scoreSquare(state, region, a, turn.player, random),
  )[0]!;
  return { type: 'placeKnight', player: turn.player, knightId: knight.id, square };
}

/** Attack: any Knight of the acting Captain on the board may attack the weakest enemy in reach, if the odds look fair. */
/** With `force`, attacks even at bad odds (a Captain that can only attack must). */
export function chooseAttack(state: MatchState, force = false): MatchAction | null {
  const turn = state.turn;
  if (!turn) return null;
  let best: { attacker: string; target: string; edge: number } | null = null;
  for (const attacker of attackers(state)) {
    for (const target of attackTargets(state, attacker.id)) {
      const edge = strength(attacker) / Math.max(1, strength(target));
      if ((force || edge >= 0.9) && (!best || edge > best.edge)) best = { attacker: attacker.id, target: target.id, edge };
    }
  }
  return best
    ? { type: 'declareAttack', player: turn.player, attackerKnightId: best.attacker, targetKnightId: best.target }
    : null;
}

/** Move: only when the Captain has nothing else to do. The best-scoring step for any of its Knights. */
export function chooseMove(state: MatchState, random: Random = Math.random): MatchAction | null {
  const turn = state.turn;
  if (!turn) return null;
  let best: { knightId: string; square: SquareIndex; score: number } | null = null;
  for (const knight of movers(state)) {
    for (const square of moveSquares(state, knight.id)) {
      const score = scoreSquare(state, knight.position!.region, square, turn.player, random);
      if (!best || score > best.score) best = { knightId: knight.id, square, score };
    }
  }
  return best ? { type: 'moveKnight', player: turn.player, knightId: best.knightId, square: best.square } : null;
}

/**
 * A stationed Captain's one order: assault a neighbour when clearly stronger,
 * otherwise send reserve (or a Knight) to a Captain next door. If it can only
 * assault, it does.
 */
export function chooseStationOrder(state: MatchState): MatchAction | null {
  const captain = stationedOrdersOpen(state);
  const turn = state.turn;
  if (!captain || !turn) return null;
  const player = turn.player;
  const mine = captainMilitia(state, captain.id);
  const targets = assaultTargets(state, captain);
  const strongest = targets.find((r) => mine >= captainMilitia(state, state.secured[r]!.captainId) * 1.3);
  if (strongest !== undefined) return { type: 'assault', player, region: strongest };
  const to = sendTargets(state, captain)[0];
  if (to && captain.reserve >= 10) return { type: 'sendReserve', player, toCaptainId: to.id, amount: captain.reserve };
  const knight = sendableKnights(state, captain).sort((a, b) => (a.status === 'ready' ? -1 : 1) - (b.status === 'ready' ? -1 : 1))[0];
  const roomy = sendTargets(state, captain).find((c) => hasFreeSlot(state, c.id));
  if (roomy && knight) return { type: 'sendKnight', player, knightId: knight.id, toCaptainId: roomy.id };
  if (to && captain.reserve > 0) return { type: 'sendReserve', player, toCaptainId: to.id, amount: captain.reserve };
  return targets[0] !== undefined ? { type: 'assault', player, region: targets[0] } : null;
}

/** After winning an assault: station the first Standby Captain who still has a Knight. */
export function chooseStation(state: MatchState, player: PlayerId): MatchAction | null {
  if (state.pendingStation?.player !== player) return null;
  const captain = stationCandidates(state, player)[0];
  return captain ? { type: 'stationCaptain', player, captainId: captain.id } : null;
}

/** Decisive battle: roll when it is this player's roll; the player whose turn it is closes it once it is over. */
export function chooseDecisive(state: MatchState, player: PlayerId, random: Random = Math.random): MatchAction | null {
  const d = state.decisive;
  if (!d) return null;
  if (d.outcome) return state.turn?.player === player ? { type: 'finishDecisive', player } : null;
  return decisiveRoller(state) === player ? { type: 'rollDie', player, value: 1 + Math.floor(random() * 6) } : null;
}

/**
 * The computer's next action as `player`, or null when it is waiting (not its
 * turn, or a battle needs the other side). Ends its own turns.
 */
/**
 * A surviving loser holds its square only if it has at least as much HP left as
 * the Knight that beat it; otherwise it retreats to its Captain.
 */
export function chooseRetreat(state: MatchState, player: PlayerId): MatchAction | null {
  const duel = state.duel;
  if (retreatDecider(state) !== player || !duel?.outcome?.winner) return null;
  const winner = state.knights[duel[duel.outcome.winner].knightId]!;
  const loser = state.knights[duel[duel.outcome.winner === 'attacker' ? 'defender' : 'attacker'].knightId]!;
  return { type: 'chooseRetreat', player, retreat: loser.hp < winner.hp };
}

export function nextComputerAction(state: MatchState, player: PlayerId, random: Random = Math.random): MatchAction | null {
  if (state.phase === 'lordOrder') {
    return state.orderingPlayer === player ? { type: 'setLordOrder', player, order: chooseLordOrder(random) } : null;
  }
  const turn = state.turn;
  if (!turn) return null;
  if (state.duel && !state.duel.outcome) return chooseSergeant(state, player, random);
  if (retreatDecider(state)) return chooseRetreat(state, player);
  if (state.phase === 'over') return null;
  if (state.decisive) return chooseDecisive(state, player, random);
  if (state.pendingStation) return chooseStation(state, player);
  if (turn.player !== player) return null;
  switch (turn.step) {
    case 'command':
      return chooseCommand(state, random) ?? (canEndTurn(state) ? { type: 'endTurn', player } : null);
    case 'orders':
      if (stationedOrdersOpen(state)) return chooseStationOrder(state);
      return (
        choosePlacement(state, random) ??
        chooseAttack(state) ??
        (canEndTurn(state) ? { type: 'endTurn', player } : (chooseAttack(state, true) ?? chooseMove(state, random)))
      );
    case 'end':
      return { type: 'endTurn', player };
    default:
      return null;
  }
}
