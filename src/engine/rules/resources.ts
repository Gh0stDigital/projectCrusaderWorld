import type { MatchEvent } from '../events';
import { RESOURCES } from '../config';
import { captainsOf, knightMilitia, knightsOf } from '../queries';
import type { LordClass, MatchState, PlayerId } from '../state';
import { takeLosses } from './decisive';

/**
 * Resources (experimental, see engine/config.ts). Rules call these at the
 * moment an action happens; with Resources switched off (state.resources null)
 * they change nothing.
 */

/** Who pays men when the pool is empty: a Captain (reserve first) or a Knight. */
export type Payer = { captainId: string } | { knightId: string };

/**
 * Charge `cost` Resources for an action. With Resources left, the pool pays
 * (down to 0 if it can't cover all of it; the action still happens). With the
 * pool already empty, the acting party loses 1 man instead.
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
  const after = loseMen(state, payer, RESOURCES.menPerActionWhenOut);
  return { state: after, events: [{ type: 'suppliesShort', player, menLost: RESOURCES.menPerActionWhenOut }] };
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
  const knight = state.knights[payer.knightId]!;
  return { ...state, knights: { ...state.knights, [knight.id]: takeLosses(knight, men) } };
}

/** A Lord's troops for upkeep: their Captains' Knights (waiting or on the board), not reserves. */
function lordTroops(state: MatchState, player: PlayerId, lord: LordClass) {
  return captainsOf(state, player, lord)
    .flatMap((c) => knightsOf(state, c.id))
    .filter((k) => knightMilitia(k) > 0);
}

/**
 * End of a Lord's turn: their troops cost 1 Resource per man. With the pool
 * already empty, each of those Knights loses a share of their men instead.
 */
export function upkeep(state: MatchState, player: PlayerId, lord: LordClass): { state: MatchState; events: MatchEvent[] } {
  if (!state.resources) return { state, events: [] };
  const troops = lordTroops(state, player, lord);
  const men = troops.reduce((n, k) => n + knightMilitia(k), 0);
  const have = state.resources[player];
  if (have > 0) {
    const paid = Math.min(have, men);
    const left = have - paid;
    const events: MatchEvent[] = [{ type: 'resourcesSpent', player, amount: paid, remaining: left }];
    if (left === 0) events.push({ type: 'resourcesDepleted', player });
    return { state: { ...state, resources: { ...state.resources, [player]: left } }, events };
  }
  // Out of Resources: the Lord's troops waste away.
  const knights = { ...state.knights };
  let lost = 0;
  const fallenKnightIds: string[] = [];
  for (const k of troops) {
    const loss = Math.ceil(knightMilitia(k) * RESOURCES.attritionShare);
    const after = takeLosses(k, loss);
    lost += knightMilitia(k) - knightMilitia(after);
    if (after.status === 'dead') fallenKnightIds.push(k.id);
    knights[k.id] = after;
  }
  return { state: { ...state, knights }, events: [{ type: 'attrition', player, lord, menLost: lost, fallenKnightIds }] };
}

/** Starting pools for a new match, or null with Resources switched off. */
export function startingResources(): Record<PlayerId, number> | null {
  return RESOURCES.enabled ? { p1: RESOURCES.startingAmount, p2: RESOURCES.startingAmount } : null;
}
