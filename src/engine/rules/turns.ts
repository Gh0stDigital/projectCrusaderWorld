import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { canEndTurn, deployableCaptains, nextLordFor } from '../queries';
import { otherPlayer, type MatchState, type PlayerId } from '../state';

/** Begin a player's turn with their next Lord. The Lord is fixed here, not when the previous turn ends. */
export function startTurn(
  state: MatchState,
  player: PlayerId,
): { state: MatchState; events: MatchEvent[] } {
  const lord = nextLordFor(state, player);
  if (!lord) throw new Error(`Player ${player} has no Lord order.`);

  const turnNumber = state.turnNumber + 1;
  const next: MatchState = {
    ...state,
    turnNumber,
    turn: { player, lord, step: 'command', deployedCaptainId: null },
  };
  const canDeploy = deployableCaptains(next).length > 0;
  return {
    state: next,
    events: [{ type: 'turnStarted', player, lord, turnNumber, canDeploy }],
  };
}

/** Manual End Turn. Refused while the player still has a Captain they must deploy. */
export function endTurn(state: MatchState, player: PlayerId): EngineResult<MatchState, MatchEvent> {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return reject('There is no turn to end.');
  if (turn.player !== player) return reject('It is not your turn.');
  if (!canEndTurn(state)) return reject('Deploy a Captain before ending your turn.');

  const players = {
    ...state.players,
    [player]: { ...state.players[player], turnsTaken: state.players[player].turnsTaken + 1 },
  };
  const started = startTurn({ ...state, players }, otherPlayer(player));
  return {
    ok: true,
    state: started.state,
    events: [{ type: 'turnEnded', player }, ...started.events],
  };
}
