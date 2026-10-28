// Computer player. Gets the same information as a human, asks the engine what
// is legal, and sends normal actions. It never looks at the other side's
// hidden Sergeant choice: it sees what a human sees (both rosters, the boards,
// the Regions held) and judges attacks by playing them out in its head.
import type { MatchAction } from '../engine/actions';
import { applyAction } from '../engine/match';
import { BEATS } from '../engine/rules/combat';
import {
  LINES,
  actingCaptain,
  actionableCaptains,
  assaultTargets,
  attackTargets,
  attackers,
  availableSergeants,
  canUseAttrition,
  canEndTurn,
  captainMilitia,
  commandOptions,
  decisiveRoller,
  duelRoleOf,
  hasFreeSlot,
  isStationed,
  knightAt,
  knightMilitia,
  knightsOnBoard,
  legalSquares,
  moveSquares,
  movers,
  reserveKnights,
  retreatDecider,
  sendTargets,
  sendableKnights,
  stationCandidates,
  stationedOrdersOpen,
} from '../engine/queries';
import {
  ATTRITION,
  LORD_CLASSES,
  REGIONS,
  otherPlayer,
  type Captain,
  type Knight,
  type LordClass,
  type MatchState,
  type PlayerId,
  type RegionIndex,
  type Sergeant,
  type SquareIndex,
} from '../engine/state';

type Random = () => number;

// --- Battles ---

/**
 * How good sending `mine` into the next clash looks, against each Sergeant the
 * other side could still send (assumed equally likely). Winning deals my men as
 * damage; losing costs the Sergeant and takes their men as damage; a tie costs
 * both sides half.
 */
function sergeantValue(mine: Sergeant, theirs: Sergeant[], myHp: number, theirHp: number): number {
  if (theirs.length === 0) return Math.min(mine.militia, theirHp);
  let total = 0;
  for (const other of theirs) {
    if (mine.tactic === other.tactic) {
      // Same tactic: the bigger Sergeant wins by the difference; equal ties.
      const diff = mine.militia - other.militia;
      if (diff > 0) total += Math.min(diff, theirHp) + other.militia * 0.25;
      else if (diff < 0) total -= Math.min(-diff, myHp) + mine.militia;
      else total += 0;
    }
    else if (BEATS[mine.tactic] === other.tactic) total += Math.min(mine.militia, theirHp) + other.militia * 0.25;
    else total -= Math.min(other.militia, myHp) + mine.militia;
  }
  return total / theirs.length;
}

/**
 * The computer's Sergeant for the current clash, or null when it has nothing
 * to commit. Leans towards the Sergeant with the best expected trade, with
 * enough chance in it that it can't be read.
 */
export function chooseSergeant(state: MatchState, player: PlayerId, random: Random = Math.random): MatchAction | null {
  const duel = state.duel;
  if (!duel || duel.outcome) return null;
  const role = duelRoleOf(duel, player);
  if (!role || duel.pending[role]) return null;
  const options = availableSergeants(state, duel, role);
  if (options.length === 0) {
    // Every Sergeant has fallen: Attrition is the last resort (once per battle).
    return canUseAttrition(state, duel, role) ? { type: 'commitSergeant', player, sergeantId: ATTRITION } : null;
  }
  const otherRole = role === 'attacker' ? 'defender' : 'attacker';
  const theirs = availableSergeants(state, duel, otherRole);
  const me = state.knights[duel[role].knightId]!;
  const them = state.knights[duel[otherRole].knightId]!;
  const scored = options.map((s) => ({ s, v: sergeantValue(s, theirs, me.hp, them.hp) }));
  // Weighted pick: better trades are likelier, never certain.
  const best = Math.max(...scored.map((x) => x.v));
  const spread = Math.max(10, Math.abs(best) * 0.5);
  const weights = scored.map((x) => Math.exp((x.v - best) / spread));
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  let pick = scored[0]!.s;
  for (let i = 0; i < scored.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) {
      pick = scored[i]!.s;
      break;
    }
  }
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

/** Lines through `square` where `player` would then hold two with the third empty. */
function threatsMade(board: (PlayerId | null)[], square: number, player: PlayerId): number {
  return LINES.filter((line) => {
    if (!line.includes(square as SquareIndex)) return false;
    const others = line.filter((sq) => sq !== square);
    const own = others.filter((sq) => board[sq] === player).length;
    const empty = others.filter((sq) => board[sq] === null).length;
    return own === 1 && empty === 1;
  }).length;
}

/** Whether a player has two in a line with the third square empty somewhere in a Region. */
function threatens(state: MatchState, region: RegionIndex, player: PlayerId): boolean {
  if (state.secured[region] || state.closed.includes(region)) return false;
  const board = occupancy(state, region);
  return LINES.some(
    (line) => line.filter((sq) => board[sq] === player).length === 2 && line.some((sq) => board[sq] === null),
  );
}

/**
 * What securing a Region is worth to `player` on the big board: lines of
 * Regions it builds towards (a third in a row wins the match), plus lines of
 * the enemy's it would block for good.
 */
function regionWorth(state: MatchState, region: RegionIndex, player: PlayerId): number {
  if (state.secured[region]) return 0;
  const enemy = otherPlayer(player);
  let worth = 0;
  for (const line of LINES) {
    if (!line.includes(region as SquareIndex)) continue;
    const held = line.filter((r) => r !== region).map((r) => state.secured[r as RegionIndex]?.player ?? null);
    const mine = held.filter((p) => p === player).length;
    const theirs = held.filter((p) => p === enemy).length;
    if (theirs === 0) worth += [2, 8, 400][mine]!; // two of mine already: this one wins the match
    if (mine === 0) worth += [0, 5, 150][theirs]!; // two of theirs: this one is the only block
  }
  return worth;
}

/** How much a square's Knight matters to its owner: lines of three it is building or blocking. */
function squareStake(board: (PlayerId | null)[], square: number, owner: PlayerId): number {
  const enemy = otherPlayer(owner);
  let stake = 4;
  for (const line of LINES) {
    if (!line.includes(square as SquareIndex)) continue;
    const others = line.filter((sq) => sq !== square).map((sq) => board[sq]);
    const own = others.filter((p) => p === owner).length;
    const theirs = others.filter((p) => p === enemy).length;
    if (theirs === 0) stake += own === 1 ? 14 : 3; // a threat of two (or the start of one)
    if (theirs === 2) stake += 30; // the only thing stopping the enemy's line
  }
  return stake;
}

/**
 * How good a square is for the computer to land a Knight on. `vacated` is the
 * square a moving Knight leaves, which is empty once it moves.
 */
function scoreSquare(
  state: MatchState,
  region: RegionIndex,
  square: SquareIndex,
  player: PlayerId,
  random: Random,
  vacated: SquareIndex | null = null,
): number {
  const board = occupancy(state, region);
  if (vacated !== null) board[vacated] = null;
  const enemy = otherPlayer(player);
  let score = random() * 2;

  if (completesLine(board, square, player)) score += 100 + 2 * regionWorth(state, region, player); // secure it
  if (completesLine(board, square, enemy)) score += 50 + regionWorth(state, region, enemy); // block their line
  const made = threatsMade(board, square, player);
  score += made * 8 + (made >= 2 ? 12 : 0); // two threats at once can't both be blocked

  // Where this square sends the enemy next turn (the square's number is the Region).
  const next = square as number as RegionIndex;
  if (next !== region) {
    if (state.secured[next] || state.closed.includes(next)) score -= 8; // a free choice for them
    else if (threatens(state, next, enemy)) score -= 25 + Math.min(150, regionWorth(state, next, enemy));
    else if (threatens(state, next, player)) score -= 4; // they'll be there to block us
  } else if (threatens(state, region, enemy) && !completesLine(board, square, enemy)) {
    score -= 20; // back here, with their threat still standing
  }

  if (square === 4) score += 5;
  else if (square % 2 === 0) score += 2; // corners
  return score;
}

function strength(knight: Knight): number {
  return knightMilitia(knight);
}

/** Resources a player can spare: a small penalty on optional actions once they run low. */
function costWeight(state: MatchState, player: PlayerId): number {
  if (!state.resources) return 0;
  const left = state.resources[player];
  return left <= 0 ? 0 : left < 3000 ? 0.04 : 0.005;
}

// --- Attacks ---

interface AttackOdds {
  /** Chance the target leaves its square (killed or retreating). */
  targetGone: number;
  /** Chance the attacker leaves its square. */
  attackerGone: number;
  /** Expected enemy men lost minus our men lost. */
  menEdge: number;
}

/**
 * Plays an attack out several times on a copy of the match, with both sides
 * picking Sergeants as the computer would and the loser deciding to retreat
 * or hold the same way.
 */
function attackOdds(state: MatchState, player: PlayerId, attackerId: string, targetId: string, random: Random, runs = 14): AttackOdds | null {
  const declared = applyAction(state, { type: 'declareAttack', player, attackerKnightId: attackerId, targetKnightId: targetId });
  if (!declared.ok) return null;
  const enemy = otherPlayer(player);
  const menBefore = (s: MatchState, id: string) => knightMilitia(s.knights[id]!);
  const startMine = menBefore(state, attackerId);
  const startTheirs = menBefore(state, targetId);
  const where = (id: string) => state.knights[id]!.position;
  let targetGone = 0;
  let attackerGone = 0;
  let menEdge = 0;
  for (let run = 0; run < runs; run++) {
    let s = declared.state;
    for (let step = 0; step < 40 && s.duel && !s.duel.outcome; step++) {
      const action = chooseSergeant(s, player, random) ?? chooseSergeant(s, enemy, random);
      if (!action) break;
      const r = applyAction(s, action);
      if (!r.ok) break;
      s = r.state;
    }
    const decider = retreatDecider(s);
    if (decider) {
      const choice = chooseRetreat(s, decider);
      const r = choice ? applyAction(s, choice) : null;
      if (r?.ok) s = r.state;
    }
    const stays = (id: string) => {
      const k = s.knights[id]!;
      const p = where(id)!;
      return k.status === 'fielded' && k.position?.region === p.region && k.position.square === p.square;
    };
    if (!stays(targetId)) targetGone++;
    if (!stays(attackerId)) attackerGone++;
    menEdge += startTheirs - menBefore(s, targetId) - (startMine - menBefore(s, attackerId));
  }
  return { targetGone: targetGone / runs, attackerGone: attackerGone / runs, menEdge: menEdge / runs };
}

interface ScoredAttack {
  action: MatchAction;
  value: number;
}

/** Every attack the acting Captain could make now, with how good it looks. */
function scoreAttacks(state: MatchState, random: Random): ScoredAttack[] {
  const turn = state.turn;
  if (!turn) return [];
  const player = turn.player;
  const enemy = otherPlayer(player);
  const result: ScoredAttack[] = [];
  for (const attacker of attackers(state)) {
    const region = attacker.position!.region;
    const board = occupancy(state, region);
    for (const target of attackTargets(state, attacker.id)) {
      const odds = attackOdds(state, player, attacker.id, target.id, random);
      if (!odds) continue;
      const square = target.position!.square;
      // Clearing the square: worth what the Knight there means to them, plus
      // what it opens for us (the third square of our own line).
      const opened = board.slice();
      opened[square] = null;
      const forUs = completesLine(opened, square, player) ? 60 + regionWorth(state, region, player) : threatsMade(opened, square, player) * 5;
      const gain = odds.targetGone * (squareStake(board, square, enemy) + forUs);
      const loss = odds.attackerGone * squareStake(board, attacker.position!.square, player);
      const value = gain - loss + odds.menEdge * 0.12 - knightMilitia(attacker) * costWeight(state, player);
      result.push({
        action: { type: 'declareAttack', player, attackerKnightId: attacker.id, targetKnightId: target.id },
        value,
      });
    }
  }
  return result.sort((a, b) => b.value - a.value);
}

/** The best attack, if it is worth making (or any attack at all with `force`). */
export function chooseAttack(state: MatchState, force = false, random: Random = Math.random): MatchAction | null {
  const best = scoreAttacks(state, random)[0];
  if (!best) return null;
  return force || best.value > 3 ? best.action : null;
}

/**
 * Defending: send reserve men into the Knight under attack when its square
 * matters or it is outmatched. Reinforcements stay with the Knight.
 */
export function chooseReinforcement(state: MatchState, player: PlayerId): MatchAction | null {
  const duel = state.duel;
  if (!duel || duel.outcome || duel.reinforced || duel.clashes.length > 0 || duel.defender.player !== player) return null;
  const defender = state.knights[duel.defender.knightId]!;
  const attacker = state.knights[duel.attacker.knightId]!;
  const captain = state.captains[defender.captainId]!;
  if (captain.reserve <= 0 || !defender.position) return null;
  const board = occupancy(state, defender.position.region);
  const stake = squareStake(board, defender.position.square, player);
  const gap = knightMilitia(attacker) - defender.hp;
  if (stake < 18 && gap < 0) return null;
  // Close the gap with some margin; more for a square that matters. Keep half
  // the reserve back for later.
  const want = Math.max(gap + 20, stake >= 30 ? 40 : 0);
  let amount = Math.min(Math.floor(captain.reserve / 2), Math.ceil(want / 10) * 10);
  if (state.resources && state.resources[player] > 0) amount = Math.min(amount, state.resources[player]);
  return amount > 0 ? { type: 'reinforceKnight', player, knightId: defender.id, amount } : null;
}

// --- Turn decisions ---

/** How promising giving orders in a Region looks for one of our deployed Captains. */
function regionPromise(state: MatchState, captain: Captain, random: Random): number {
  const region = captain.region!;
  const player = captain.owner;
  if (isStationed(state, captain)) {
    const order = stationOrderFor(state, captain);
    return order ? order.value : -50;
  }
  const empty = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((sq) => !knightAt(state, region, sq as SquareIndex)) as SquareIndex[];
  const canPlace = reserveKnights(state, captain.id).length > 0;
  const placeScore = canPlace && empty.length ? Math.max(...empty.map((sq) => scoreSquare(state, region, sq, player, random))) : -20;
  return placeScore + regionWorth(state, region, player) * 0.2;
}

/** Command step: which Captain to deploy (and where) or resume. */
export function chooseCommand(state: MatchState, random: Random = Math.random): MatchAction | null {
  const turn = state.turn;
  if (!turn || turn.step !== 'command') return null;
  const player = turn.player;
  const enemy = otherPlayer(player);
  const options = commandOptions(state);
  const captains = actionableCaptains(state);
  if (captains.length === 0) return null;

  const choices: { action: MatchAction; score: number }[] = [];
  const deployer = captains.find((c) => c.region === null);
  if (deployer) {
    for (const region of options.deployRegions) {
      const board = occupancy(state, region);
      const enemyThere = board.filter((o) => o === enemy).length;
      let score = regionWorth(state, region, player) * 0.5 + regionWorth(state, region, enemy) * 0.4;
      if (threatens(state, region, enemy)) score += 18; // go and block
      score += enemyThere * 2 + (region === 4 ? 3 : 0) + random() * 3;
      choices.push({ action: { type: 'deployCaptain', player, captainId: deployer.id, region }, score });
    }
  }
  for (const id of options.resumeCaptainIds) {
    const captain = state.captains[id]!;
    choices.push({ action: { type: 'resumeCaptain', player, captainId: id }, score: regionPromise(state, captain, random) });
  }
  choices.sort((a, b) => b.score - a.score);
  return choices[0]?.action ?? null;
}

/** The best placement for the acting Captain: the strongest waiting Knight on the best square. */
function bestPlacement(state: MatchState, random: Random): { action: MatchAction; score: number; secures: boolean } | null {
  const turn = state.turn;
  const captain = actingCaptain(state);
  if (!turn || turn.step !== 'orders' || !captain || captain.region === null) return null;
  const squares = legalSquares(state);
  const knights = reserveKnights(state, captain.id);
  if (squares.length === 0 || knights.length === 0) return null;
  const knight = [...knights].sort((a, b) => strength(b) - strength(a))[0]!;
  const region = captain.region;
  const board = occupancy(state, region);
  const scored = squares.map((sq) => ({ sq, score: scoreSquare(state, region, sq, turn.player, random) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]!;
  return {
    action: { type: 'placeKnight', player: turn.player, knightId: knight.id, square: top.sq },
    score: top.score,
    secures: completesLine(board, top.sq, turn.player),
  };
}

/** Placement step: the strongest waiting Knight on the best square. */
export function choosePlacement(state: MatchState, random: Random = Math.random): MatchAction | null {
  return bestPlacement(state, random)?.action ?? null;
}

/** The best single step for one of the acting Captain's Knights. */
function bestMove(state: MatchState, random: Random): { action: MatchAction; score: number; secures: boolean } | null {
  const turn = state.turn;
  if (!turn) return null;
  let best: { action: MatchAction; score: number; secures: boolean } | null = null;
  for (const knight of movers(state)) {
    const { region, square: from } = knight.position!;
    const board = occupancy(state, region);
    board[from] = null;
    for (const square of moveSquares(state, knight.id)) {
      const score =
        scoreSquare(state, region, square, turn.player, random, from) -
        squareStake(occupancy(state, region), from, turn.player) * 0.5 -
        strength(knight) * costWeight(state, turn.player);
      if (!best || score > best.score) {
        best = {
          action: { type: 'moveKnight', player: turn.player, knightId: knight.id, square },
          score,
          secures: completesLine(board, square, turn.player),
        };
      }
    }
  }
  return best;
}

/** Move: the best-scoring step for any of the acting Captain's Knights. */
export function chooseMove(state: MatchState, random: Random = Math.random): MatchAction | null {
  return bestMove(state, random)?.action ?? null;
}

/**
 * Orders step for a Captain on an open board. Secures a Region whenever it
 * can; attacks first when the attack clears the way or breaks an enemy line;
 * otherwise places, then attacks if the odds are good. Ends the turn once
 * nothing more is worth doing.
 */
export function chooseOrders(state: MatchState, random: Random = Math.random): MatchAction | null {
  const turn = state.turn;
  if (!turn || turn.step !== 'orders') return null;
  if (stationedOrdersOpen(state)) return chooseStationOrder(state);
  const player = turn.player;

  const place = bestPlacement(state, random);
  if (place?.secures) return place.action;
  const move = bestMove(state, random);
  if (move?.secures && !turn.placedKnightId) return move.action;

  const attacks = scoreAttacks(state, random);
  const attack = attacks[0];
  if (attack && attack.value >= 20) return attack.action; // clears a line, or breaks theirs
  if (place) return place.action;
  if (attack && attack.value > 3) return attack.action;
  if (canEndTurn(state)) return { type: 'endTurn', player };
  // Something must be done: the least bad of attacking or moving.
  if (attack && (!move || attack.value >= move.score - 10)) return attack.action;
  return move?.action ?? attack?.action ?? null;
}

/** What a stationed Captain's best order would be, and how good it looks. */
function stationOrderFor(state: MatchState, captain: Captain): { action: MatchAction; value: number } | null {
  const player = captain.owner;
  const enemy = otherPlayer(player);
  const mine = captainMilitia(state, captain.id);
  const myRolls = knightsOnBoard(state, captain.region!, player).length + 1; // + the Captain
  const options: { action: MatchAction; value: number }[] = [];

  for (const region of assaultTargets(state, captain)) {
    const holder = state.secured[region]!.captainId;
    const theirs = captainMilitia(state, holder);
    const theirRolls = knightsOnBoard(state, region, enemy).length + 1;
    // Each roll costs the other side (men × die) ÷ divisor: men × rolls is the punch.
    const edge = (mine * myRolls) / Math.max(1, theirs * theirRolls);
    const prize = 40 + regionWorth({ ...state, secured: { ...state.secured, [region]: undefined } }, region, player);
    const value = edge >= 1.2 ? prize * Math.min(1, (edge - 0.9) / 0.6) : edge >= 1 && prize >= 150 ? prize * 0.4 : -30 + edge * 10;
    options.push({ action: { type: 'assault', player, region }, value });
  }

  // Sending men: to the Captain next door with the most at stake.
  const targets = sendTargets(state, captain);
  const stakeOf = (c: Captain) => regionWorth(state, c.region!, player) + regionWorth(state, c.region!, enemy) + (threatens(state, c.region!, enemy) ? 15 : 0);
  const exposed = assaultTargetsAgainst(state, captain).length > 0;
  if (targets.length && captain.reserve > 0) {
    const to = [...targets].sort((a, b) => stakeOf(b) - stakeOf(a))[0]!;
    // Keep men back if an enemy next door could assault this Region.
    const amount = exposed ? Math.floor(captain.reserve / 2) : captain.reserve;
    if (amount > 0) options.push({ action: { type: 'sendReserve', player, toCaptainId: to.id, amount }, value: 8 + stakeOf(to) * 0.2 + amount * 0.02 });
  }
  const roomy = targets.filter((c) => hasFreeSlot(state, c.id)).sort((a, b) => stakeOf(b) - stakeOf(a))[0];
  const knight = sendableKnights(state, captain).sort((a, b) => (a.status === 'ready' ? -1 : 1) - (b.status === 'ready' ? -1 : 1) || strength(b) - strength(a))[0];
  if (roomy && knight) {
    options.push({
      action: { type: 'sendKnight', player, knightId: knight.id, toCaptainId: roomy.id },
      value: 10 + stakeOf(roomy) * 0.25 - (exposed && knight.status === 'fielded' ? 10 : 0),
    });
  }
  options.sort((a, b) => b.value - a.value);
  return options[0] ?? null;
}

/** Enemy stationed Captains next door who could assault this Captain's Region. */
function assaultTargetsAgainst(state: MatchState, captain: Captain): RegionIndex[] {
  return REGIONS.filter((r) => {
    const held = state.secured[r];
    if (!held || held.player === captain.owner) return false;
    const holder = state.captains[held.captainId];
    return Boolean(holder && isStationed(state, holder) && assaultTargets(state, holder).includes(captain.region!));
  });
}

/**
 * A stationed Captain's one order: assault a neighbour when the odds are
 * good (or the Region would win the match), otherwise send men or a Knight to
 * the neighbouring Captain with the most at stake.
 */
export function chooseStationOrder(state: MatchState): MatchAction | null {
  const captain = stationedOrdersOpen(state);
  if (!captain || !state.turn) return null;
  return stationOrderFor(state, captain)?.action ?? null;
}

/** After winning an assault: station the strongest Standby Captain who still has a Knight. */
export function chooseStation(state: MatchState, player: PlayerId): MatchAction | null {
  if (state.pendingStation?.player !== player) return null;
  const captain = stationCandidates(state, player).sort((a, b) => captainMilitia(state, b.id) - captainMilitia(state, a.id))[0];
  return captain ? { type: 'stationCaptain', player, captainId: captain.id } : null;
}

/**
 * After losing a Decisive battle with men and a Knight left: a beaten defender
 * holds its Region while it still has at least half the winner's men, otherwise
 * retreats to keep its Knights. A beaten attacker keeps its own Region unless it
 * has almost nothing left.
 */
export function chooseDecisiveFate(state: MatchState, player: PlayerId): MatchAction | null {
  const d = state.decisive;
  const o = d?.outcome;
  if (!d || !o?.winner || o.loserChoice !== 'deciding' || otherPlayer(o.winner) !== player) return null;
  const share = d.men[player] / Math.max(1, d.men[o.winner]);
  const defending = d.first !== player;
  return { type: 'decisiveChoice', player, retreat: defending ? share < 0.5 : share < 0.2 };
}

/** Decisive battle: roll when it is this player's roll; the player whose turn it is closes it once it is over. */
export function chooseDecisive(state: MatchState, player: PlayerId, random: Random = Math.random): MatchAction | null {
  const d = state.decisive;
  if (!d) return null;
  if (d.outcome?.loserChoice === 'deciding') {
    return d.outcome.winner && otherPlayer(d.outcome.winner) === player ? chooseDecisiveFate(state, player) : null;
  }
  if (d.outcome) return state.turn?.player === player ? { type: 'finishDecisive', player } : null;
  return decisiveRoller(state) === player ? { type: 'rollDie', player, value: 1 + Math.floor(random() * 6) } : null;
}

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

/**
 * The computer's next action as `player`, or null when it is waiting (not its
 * turn, or a battle needs the other side). Ends its own turns.
 */
export function nextComputerAction(state: MatchState, player: PlayerId, random: Random = Math.random): MatchAction | null {
  if (state.phase === 'lordOrder') {
    return state.orderingPlayer === player ? { type: 'setLordOrder', player, order: chooseLordOrder(random) } : null;
  }
  const turn = state.turn;
  if (!turn) return null;
  if (state.duel && !state.duel.outcome) {
    return chooseReinforcement(state, player) ?? chooseSergeant(state, player, random);
  }
  if (retreatDecider(state)) return chooseRetreat(state, player);
  if (state.phase === 'over') return null;
  if (state.decisive) return chooseDecisive(state, player, random);
  if (state.pendingStation) return chooseStation(state, player);
  if (turn.player !== player) return null;
  switch (turn.step) {
    case 'command':
      return chooseCommand(state, random) ?? (canEndTurn(state) ? { type: 'endTurn', player } : null);
    case 'orders':
      return chooseOrders(state, random);
    case 'end':
      return { type: 'endTurn', player };
    default:
      return null;
  }
}
