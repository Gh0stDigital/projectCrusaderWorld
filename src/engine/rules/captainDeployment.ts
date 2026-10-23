import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { captainsInRegion } from '../queries';
import { REGIONS, type MatchState, type PlayerId, type RegionIndex } from '../state';

/**
 * The current Lord sends one of their Captains to a Region, where the Captain
 * stays for the rest of the match. One deployment per turn.
 */
export function deployCaptain(
  state: MatchState,
  player: PlayerId,
  captainId: string,
  region: RegionIndex,
): EngineResult<MatchState, MatchEvent> {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return reject('Captains can only be deployed during a turn.');
  if (turn.player !== player) return reject('It is not your turn.');
  if (turn.step !== 'command') return reject('You have already deployed a Captain this turn.');
  if (!REGIONS.includes(region)) return reject('That Region does not exist.');

  const captain = state.captains[captainId];
  if (!captain || captain.owner !== player) return reject('That is not one of your Captains.');
  if (captain.lord !== turn.lord) return reject('Only the current Lord’s Captains can deploy this turn.');
  if (captain.region !== null) return reject('That Captain is already stationed in a Region.');
  if (captainsInRegion(state, region).some((c) => c.owner === player)) {
    return reject('You already have a Captain in that Region.');
  }

  return {
    ok: true,
    state: {
      ...state,
      captains: { ...state.captains, [captainId]: { ...captain, region } },
      turn: { ...turn, step: 'end', deployedCaptainId: captainId },
    },
    events: [{ type: 'captainDeployed', player, captainId, lord: captain.lord, region }],
  };
}
