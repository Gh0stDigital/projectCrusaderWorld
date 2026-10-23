import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { LORD_CLASSES, otherPlayer, type LordClass, type MatchState, type PlayerId } from '../state';
import { startTurn } from './turns';

/**
 * Each player places their three Lords in the order their turns will go.
 * Player 1 sets theirs first, then Player 2. Then Player 1 takes the first turn.
 */
export function setLordOrder(
  state: MatchState,
  player: PlayerId,
  order: LordClass[],
): EngineResult<MatchState, MatchEvent> {
  if (state.phase !== 'lordOrder') return reject('Lord order is already set.');
  if (state.orderingPlayer !== player) return reject('It is not your turn to order your Lords.');
  const isFullOrder =
    order.length === LORD_CLASSES.length && LORD_CLASSES.every((lord) => order.includes(lord));
  if (!isFullOrder) return reject('Place each of your three Lords exactly once.');

  const players = {
    ...state.players,
    [player]: { ...state.players[player], lordOrder: [...order] },
  };
  const events: MatchEvent[] = [{ type: 'lordOrderSet', player, order: [...order] }];

  const next = otherPlayer(player);
  if (players[next].lordOrder === null) {
    return { ok: true, state: { ...state, players, orderingPlayer: next }, events };
  }

  const started = startTurn({ ...state, players, phase: 'turns', orderingPlayer: null }, 'p1');
  return { ok: true, state: started.state, events: [...events, ...started.events] };
}
