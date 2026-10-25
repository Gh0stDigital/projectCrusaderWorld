import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import type { MatchState, PlayerId } from '../state';

/**
 * Before the first clash, the defending player may send militia from the
 * defending Knight's Captain reserve to that Knight. The men join the Knight's
 * HP, which may go above its normal maximum; the extra is permanent (it can be
 * lost in battle, but nothing restores it).
 */
export function reinforceKnight(
  state: MatchState,
  player: PlayerId,
  knightId: string,
  amount: number,
): EngineResult<MatchState, MatchEvent> {
  const duel = state.duel;
  if (!duel || duel.outcome) return reject('There is no battle to reinforce.');
  if (duel.clashes.length > 0) return reject('Reinforcements must arrive before the first clash.');
  if (duel.defender.player !== player || duel.defender.knightId !== knightId) {
    return reject('Only the defending Knight can be reinforced.');
  }
  if (!Number.isInteger(amount) || amount <= 0) return reject('Send at least one man.');
  const knight = state.knights[knightId]!;
  const captain = state.captains[knight.captainId]!;
  if (amount > captain.reserve) return reject('The Captain does not have that many men in reserve.');

  return {
    ok: true,
    state: {
      ...state,
      captains: { ...state.captains, [captain.id]: { ...captain, reserve: captain.reserve - amount } },
      knights: { ...state.knights, [knightId]: { ...knight, hp: knight.hp + amount } },
      duel: { ...duel, defender: { ...duel.defender, startHp: duel.defender.startHp + amount } },
    },
    events: [{ type: 'knightReinforced', player, knightId, captainId: captain.id, amount }],
  };
}
