import type { EngineResult } from './engine';
import type { MatchAction } from './actions';
import type { MatchEvent } from './events';
import type { MatchState } from './state';
import {
  chooseRetreat,
  commitSergeant,
  declareAttack,
  deployCaptain,
  endTurn,
  finishDecisive,
  placeKnight,
  reinforceKnight,
  resumeCaptain,
  rollDie,
  setLordOrder,
} from './rules';

/** The single entry point for changing a match. Humans and the computer both go through here. */
export function applyAction(state: MatchState, action: MatchAction): EngineResult<MatchState, MatchEvent> {
  switch (action.type) {
    case 'setLordOrder':
      return setLordOrder(state, action.player, action.order);
    case 'deployCaptain':
      return deployCaptain(state, action.player, action.captainId, action.region);
    case 'resumeCaptain':
      return resumeCaptain(state, action.player, action.captainId);
    case 'placeKnight':
      return placeKnight(state, action.player, action.knightId, action.square);
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
    case 'endTurn':
      return endTurn(state, action.player);
  }
}
