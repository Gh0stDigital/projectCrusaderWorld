import type { MatchEvent } from '../events';
import { RESOURCES } from '../config';
import { knightMilitia, knightsOf } from '../queries';
import type { MatchState, PlayerId, Wager, WagerSide } from '../state';
import { takeLosses } from './decisive';

/**
 * Resources (experimental, see engine/config.ts). Rules call these at the
 * moment an action happens; with Resources switched off (state.resources null)
 * they change nothing.
 */

/** Who pays men when the pool is empty: a Captain (reserve first) or a Knight. */
export type Payer = { captainId: string } | { knightId: string };

/**
 * Charge `cost` Resources for an action (cost is the number of men in the party
 * acting). With Resources left, the pool pays (down to 0 if it can't cover all
 * of it; the action still happens). With the pool already empty, the acting
 * party loses a share of its men instead (at least one).
 */
export function charge(
  state: MatchState,
  player: PlayerId,
  cost: number,
  payer: Payer,
): { state: MatchState; events: MatchEvent[] } {
  if (!state.resources || cost <= 0) return { state, events: [] };
  const have = state.resources[player];
  if (have > 0) {
    const paid = Math.min(have, cost);
    const left = have - paid;
    const events: MatchEvent[] = [{ type: 'resourcesSpent', player, amount: paid, remaining: left }];
    if (left === 0) events.push({ type: 'resourcesDepleted', player });
    return { state: { ...state, resources: { ...state.resources, [player]: left } }, events };
  }
  const men = Math.max(1, Math.ceil(cost * RESOURCES.shareOfMenWhenOut));
  const after = loseMen(state, payer, men);
  return { state: after, events: [{ type: 'suppliesShort', player, menLost: men }] };
}

/** Take men from a Captain (reserve first, then a Knight) or from a Knight. */
function loseMen(state: MatchState, payer: Payer, men: number): MatchState {
  if ('captainId' in payer) {
    const captain = state.captains[payer.captainId]!;
    if (captain.reserve >= men) {
      return { ...state, captains: { ...state.captains, [captain.id]: { ...captain, reserve: captain.reserve - men } } };
    }
    const knight = knightsOf(state, captain.id).find((k) => knightMilitia(k) > 0);
    return knight ? loseMen(state, { knightId: knight.id }, men) : state;
  }
  // A Knight's action: the Knight pays, unless that would cost its last man;
  // then its Captain's reserve, then another of that Captain's Knights.
  const knight = state.knights[payer.knightId]!;
  const captain = state.captains[knight.captainId]!;
  if (knightMilitia(knight) <= men && captain.reserve >= men) {
    return { ...state, captains: { ...state.captains, [captain.id]: { ...captain, reserve: captain.reserve - men } } };
  }
  const other = knightsOf(state, captain.id).find((k) => k.id !== knight.id && knightMilitia(k) > men);
  const from = knightMilitia(knight) > men ? knight : other;
  return from ? { ...state, knights: { ...state.knights, [from.id]: takeLosses(from, men) } } : state;
}

// --- Wager pools ---

/**
 * The loser of a battle pays Resources equal to the men they lost into a pool
 * between the two sides. Whoever leaves their spot first forfeits it to the
 * other (see settleWagers).
 */
export function openWager(
  state: MatchState,
  loser: WagerSide,
  winner: WagerSide,
  menLost: number,
): { state: MatchState; events: MatchEvent[] } {
  if (!state.resources || menLost <= 0) return { state, events: [] };
  const have = state.resources[loser.player];
  const amount = Math.min(have, menLost);
  if (amount <= 0) return { state, events: [] };
  const wager: Wager = { id: `w${state.turnNumber}-${state.wagers.length}-${loser.player}`, amount, sides: [winner, loser] };
  const events: MatchEvent[] = [{ type: 'wagerPlaced', player: loser.player, amount }];
  if (have - amount === 0) events.push({ type: 'resourcesDepleted', player: loser.player });
  return {
    state: {
      ...state,
      resources: { ...state.resources, [loser.player]: have - amount },
      wagers: [...state.wagers, wager],
    },
    events,
  };
}

/** Whether a side of a wager is still where it was. */
export function holdsSpot(state: MatchState, side: WagerSide): boolean {
  if ('knightId' in side) {
    const k = state.knights[side.knightId];
    return Boolean(k && k.status === 'fielded' && k.position?.region === side.region && k.position.square === side.square);
  }
  const c = state.captains[side.captainId];
  return Boolean(c && !c.fallen && c.region === side.region);
}

/**
 * Pays out every pool where one side has left its spot: the side still there
 * takes it all. If both left at once, each gets half back.
 */
export function settleWagers(state: MatchState): { state: MatchState; events: MatchEvent[] } {
  if (!state.resources || state.wagers.length === 0) return { state, events: [] };
  const resources = { ...state.resources };
  const kept: Wager[] = [];
  const events: MatchEvent[] = [];
  for (const w of state.wagers) {
    const staying = w.sides.filter((s) => holdsSpot(state, s));
    if (staying.length === 2) {
      kept.push(w);
    } else if (staying.length === 1) {
      const p = staying[0]!.player;
      resources[p] += w.amount;
      events.push({ type: 'wagerWon', player: p, amount: w.amount });
    } else {
      const half = Math.floor(w.amount / 2);
      resources[w.sides[0].player] += w.amount - half;
      resources[w.sides[1].player] += half;
      events.push({ type: 'wagerSplit', amount: w.amount });
    }
  }
  if (events.length === 0) return { state, events };
  return { state: { ...state, resources, wagers: kept }, events };
}

/** Starting pools for a new match, or null with Resources switched off. */
export function startingResources(): Record<PlayerId, number> | null {
  return RESOURCES.enabled ? { p1: RESOURCES.startingAmount, p2: RESOURCES.startingAmount } : null;
}
