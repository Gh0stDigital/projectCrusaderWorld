// Computer player. Gets the same information as a human, asks the engine what
// is legal, and sends normal actions. Only duel choices exist so far.
import type { MatchAction } from '../engine/actions';
import { availableSergeants, duelRoleOf } from '../engine/queries';
import type { MatchState, PlayerId } from '../engine/state';

/**
 * The computer's Sergeant for the current clash, or null when it has nothing
 * to commit. Picks at random among its own available Sergeants; it never looks
 * at the other side's pending choice.
 */
export function chooseSergeant(state: MatchState, player: PlayerId, random = Math.random): MatchAction | null {
  const duel = state.duel;
  if (!duel || duel.outcome) return null;
  const role = duelRoleOf(duel, player);
  if (!role || duel.pending[role]) return null;
  const options = availableSergeants(state, duel, role);
  if (options.length === 0) return null;
  const pick = options[Math.floor(random() * options.length)]!;
  return { type: 'commitSergeant', player, sergeantId: pick.id };
}
