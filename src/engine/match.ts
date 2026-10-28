import type { EngineResult } from './engine';
import type { MatchAction } from './actions';
import type { MatchEvent } from './events';
import type { MatchState } from './state';
import { settleWagers } from './rules/resources';
import {
  assault,
  cancelStationOrders,
  sendKnight,
  sendReserve,
  stationCaptain,
  chooseRetreat,
  commitSergeant,
  declareAttack,
  deployCaptain,
  endTurn,
  finishDecisive,
  chooseDecisiveFate,
  moveKnight,
  placeKnight,
  undoKnight,
  undoCommand,
  reinforceKnight,
  resumeCaptain,
  rollDie,
  setLordOrder,
} from './rules';

/**
 * The single entry point for changing a match. Humans and the computer both go
 * through here. After every action, wager pools whose side left its spot pay out.
 */
export function applyAction(state: MatchState, action: MatchAction): EngineResult<MatchState, MatchEvent> {
  const result = perform(state, action);
  if (!result.ok) return result;
  const settled = settleWagers(result.state);
  return { ok: true, state: settled.state, events: [...result.events, ...settled.events] };
}

function perform(state: MatchState, action: MatchAction): EngineResult<MatchState, MatchEvent> {
  switch (action.type) {
    case 'setLordOrder':
      return setLordOrder(state, action.player, action.order);
    case 'deployCaptain':
      return deployCaptain(state, action.player, action.captainId, action.region);
    case 'resumeCaptain':
      return resumeCaptain(state, action.player, action.captainId);
    case 'placeKnight':
      return placeKnight(state, action.player, action.knightId, action.square);
    case 'moveKnight':
      return moveKnight(state, action.player, action.knightId, action.square);
    case 'undoKnight':
      return undoKnight(state, action.player);
    case 'undoCommand':
      return undoCommand(state, action.player);
    case 'declareAttack':
      return declareAttack(state, action.player, action.attackerKnightId, action.targetKnightId);
    case 'reinforceKnight':
      return reinforceKnight(state, action.player, action.knightId, action.amount);
    case 'commitSergeant':
      return commitSergeant(state, action.player, action.sergeantId);
    case 'chooseRetreat':
      return chooseRetreat(state, action.player, action.retreat);
    case 'rollDie':
      return rollDie(state, action.player, action.value);
    case 'finishDecisive':
      return finishDecisive(state, action.player);
    case 'decisiveChoice':
      return chooseDecisiveFate(state, action.player, action.retreat);
    case 'sendReserve':
      return sendReserve(state, action.player, action.toCaptainId, action.amount);
    case 'sendKnight':
      return sendKnight(state, action.player, action.knightId, action.toCaptainId);
    case 'assault':
      return assault(state, action.player, action.region);
    case 'cancelStationOrders':
      return cancelStationOrders(state, action.player);
    case 'stationCaptain':
      return stationCaptain(state, action.player, action.captainId);
    case 'endTurn':
      return endTurn(state, action.player);
  }
}
