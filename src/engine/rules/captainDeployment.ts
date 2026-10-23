import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { captainCanAct, captainInRegion, emptySquares, reserveKnights } from '../queries';
import { REGIONS, type Captain, type MatchState, type PlayerId, type RegionIndex } from '../state';

/** Shared checks: it's this player's Command step and the Captain belongs to the current Lord. */
function checkCommand(state: MatchState, player: PlayerId, captainId: string): Captain | string {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return 'Captains can only act during a turn.';
  if (turn.player !== player) return 'It is not your turn.';
  if (turn.step !== 'command') return 'You have already chosen a Captain this turn.';
  const captain = state.captains[captainId];
  if (!captain || captain.owner !== player) return 'That is not one of your Captains.';
  if (captain.lord !== turn.lord) return 'Only the current Lord’s Captains can act this turn.';
  return captain;
}

/**
 * The current Lord sends a Ready Captain to a Region, where the Captain stays
 * for the rest of the match. That Captain then places a Knight there.
 */
export function deployCaptain(
  state: MatchState,
  player: PlayerId,
  captainId: string,
  region: RegionIndex,
): EngineResult<MatchState, MatchEvent> {
  const captain = checkCommand(state, player, captainId);
  if (typeof captain === 'string') return reject(captain);
  if (!REGIONS.includes(region)) return reject('That Region does not exist.');
  if (captain.region !== null) return reject('That Captain is already stationed in a Region.');
  if (captainInRegion(state, region, player)) return reject('You already have a Captain in that Region.');
  if (emptySquares(state, region).length === 0) return reject('That Region has no room left.');
  if (reserveKnights(state, captain.id).length === 0) return reject('That Captain has no Knights left to place.');

  return {
    ok: true,
    state: {
      ...state,
      captains: { ...state.captains, [captainId]: { ...captain, region } },
      turn: { ...state.turn!, step: 'placement', captainId },
    },
    events: [{ type: 'captainDeployed', player, captainId, lord: captain.lord, region }],
  };
}

/** The current Lord gives orders to a Captain already stationed in a Region. */
export function resumeCaptain(
  state: MatchState,
  player: PlayerId,
  captainId: string,
): EngineResult<MatchState, MatchEvent> {
  const captain = checkCommand(state, player, captainId);
  if (typeof captain === 'string') return reject(captain);
  if (captain.region === null) return reject('That Captain has not been deployed yet.');
  if (!captainCanAct(state, captain)) return reject('That Captain has no Knight they can place.');

  return {
    ok: true,
    state: { ...state, turn: { ...state.turn!, step: 'placement', captainId } },
    events: [{ type: 'captainResumed', player, captainId, region: captain.region }],
  };
}
