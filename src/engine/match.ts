import type { EngineResult } from './engine';
import type { MatchAction } from './actions';
import type { MatchEvent } from './events';
import type { MatchState } from './state';
import { deployCaptain, endTurn, setLordOrder } from './rules';

/** The single entry point for changing a match. Humans and the computer both go through here. */
export function applyAction(state: MatchState, action: MatchAction): EngineResult<MatchState, MatchEvent> {
  switch (action.type) {
    case 'setLordOrder':
      return setLordOrder(state, action.player, action.order);
    case 'deployCaptain':
      return deployCaptain(state, action.player, action.captainId, action.region);
    case 'endTurn':
      return endTurn(state, action.player);
  }
}
