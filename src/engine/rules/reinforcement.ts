import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import type { MatchState, PlayerId } from '../state';
import { charge } from './resources';

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
  if (duel.reinforced) return reject('This Knight has already been reinforced.');
  if (duel.defender.player !== player || duel.defender.knightId !== knightId) {
    return reject('Only the defending Knight can be reinforced.');
  }
  if (!Number.isInteger(amount) || amount <= 0) return reject('Send at least one man.');
  const knight = state.knights[knightId]!;
  const captain = state.captains[knight.captainId]!;
  if (amount > captain.reserve) return reject('The Captain does not have that many men in reserve.');

  // Resources: the men sent cost 1 each (or, with none left, the reserve loses 1 more man).
  const paid = charge(state, player, amount, { captainId: captain.id });
  const payer = paid.state.captains[captain.id]!;
  const sent = Math.min(amount, payer.reserve);
  return {
    ok: true,
    state: {
      ...paid.state,
      captains: { ...paid.state.captains, [captain.id]: { ...payer, reserve: payer.reserve - sent } },
      // A braced Gatekeeper's men are worth 2 HP each, reinforcements included.
      knights: { ...paid.state.knights, [knightId]: { ...knight, hp: knight.hp + sent * (knight.braced ? 2 : 1) } },
      duel: {
        ...duel,
        reinforced: sent,
        defender: { ...duel.defender, startHp: duel.defender.startHp + sent * (knight.braced ? 2 : 1) },
      },
    },
    events: [{ type: 'knightReinforced', player, knightId, captainId: captain.id, amount: sent }, ...paid.events],
  };
}
