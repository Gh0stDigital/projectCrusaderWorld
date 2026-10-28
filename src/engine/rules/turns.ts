import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { actingCaptain, actionableCaptains, canEndTurn, isStalemate, matchWinner, nextLordFor, retreatDecider, stationedOrdersOpen } from '../queries';
import { startDecisive } from './decisive';
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
    turn: { player, lord, step: 'command', captainId: null, placedKnightId: null, attacked: false, movedKnightId: null, stationOrder: false, undo: null, commandUndo: null },
    duel: null,
    decisive: null,
  };
  const canAct = actionableCaptains(next).length > 0;
  return {
    state: next,
    events: [{ type: 'turnStarted', player, lord, turnNumber, canAct }],
  };
}

/** Manual End Turn. Refused until the turn's orders are carried out, unless there is nothing the player can do. */
export function endTurn(state: MatchState, player: PlayerId): EngineResult<MatchState, MatchEvent> {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return reject('There is no turn to end.');
  if (turn.player !== player) return reject('It is not your turn.');
  if (retreatDecider(state)) return reject('The losing Knight must first retreat or hold its square.');
  if (!canEndTurn(state)) {
    const reasons: Record<string, string> = {
      command: 'Choose a Captain before ending your turn.',
      orders: stationedOrdersOpen(state)
        ? 'Give your stationed Captain an order before ending your turn.'
        : 'Place a Knight or attack before ending your turn.',
      decisive: 'Finish the battle first.',
      station: 'Choose a Captain to station in the Region you took.',
      battle: 'Finish the battle before ending your turn.',
    };
    return reject(reasons[turn.step] ?? 'You cannot end your turn yet.');
  }

  // Only a placement (or move) routes the opponent; a turn without one leaves them a free choice.
  const routed: MatchState = turn.placedKnightId || turn.movedKnightId ? state : { ...state, route: null };

  // The Region played in stalemated: its Captains make a Last Stand before the turn passes.
  const region = actingCaptain(routed)?.region ?? null;
  if (region !== null && isStalemate(routed, region)) {
    const fight = startDecisive(routed, region, player);
    return { ok: true, state: fight.state, events: fight.events };
  }

  const passed = passTurn(routed, player);
  return { ok: true, state: passed.state, events: passed.events };
}

/** Hands the turn to the other player, unless someone has secured three Regions in a row: then the match ends. */
export function passTurn(before: MatchState, player: PlayerId): { state: MatchState; events: MatchEvent[] } {
  const state = before;
  const fed = { events: [] as MatchEvent[] };
  const winner = matchWinner(state);
  if (winner) {
    return {
      state: { ...state, phase: 'over', winner, decisive: null, turn: state.turn ? { ...state.turn, step: 'end' } : null },
      events: [...fed.events, { type: 'turnEnded', player }, { type: 'matchWon', player: winner }],
    };
  }
  const players = {
    ...state.players,
    [player]: { ...state.players[player], turnsTaken: state.players[player].turnsTaken + 1 },
  };
  const started = startTurn({ ...state, players }, otherPlayer(player));
  return { state: started.state, events: [...fed.events, { type: 'turnEnded', player }, ...started.events] };
}
