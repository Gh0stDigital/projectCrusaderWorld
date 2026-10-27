import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { canUndoCommand, captainMilitia, commandOptions, reserveKnights } from '../queries';
import { charge } from './resources';
import { REGIONS, type Captain, type MatchState, type PlayerId, type RegionIndex } from '../state';

/** Shared checks: it's this player's Command step and the Captain is theirs. */
function checkCommand(state: MatchState, player: PlayerId, captainId: string): Captain | string {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return 'Captains can only act during a turn.';
  if (turn.player !== player) return 'It is not your turn.';
  if (turn.step !== 'command') return 'You have already chosen a Captain this turn.';
  const captain = state.captains[captainId];
  if (!captain || captain.owner !== player) return 'That is not one of your Captains.';
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
  if (captain.lord !== state.turn!.lord) return reject('Only the current Lord’s Captains can deploy this turn.');
  if (captain.region !== null) return reject('That Captain is already stationed in a Region.');
  if (reserveKnights(state, captain.id).length === 0) return reject('That Captain has no Knights left to place.');
  const options = commandOptions(state);
  if (!options.deployRegions.includes(region)) {
    if (options.deployRegions.length === 0) return reject('This turn you must give orders to a stationed Captain.');
    if (options.mode === 'routed') return reject('You must play in the Region your opponent sent you to.');
    return reject('You cannot deploy to that Region.');
  }

  const paid = charge(state, player, captainMilitia(state, captain.id), { captainId });
  return {
    ok: true,
    state: {
      ...paid.state,
      captains: { ...paid.state.captains, [captainId]: { ...paid.state.captains[captainId]!, region } },
      turn: {
        ...state.turn!,
        step: 'orders',
        captainId,
        commandUndo: { resources: state.resources, knights: state.knights, captains: state.captains },
      },
    },
    events: [{ type: 'captainDeployed', player, captainId, lord: captain.lord, region }, ...paid.events],
  };
}

/**
 * Take back this turn's Captain choice (a deployment or giving orders to a
 * deployed Captain) while that Captain has done nothing yet. A placement or
 * move must be undone first; an attack or a stationed order makes it final.
 */
export function undoCommand(state: MatchState, player: PlayerId): EngineResult<MatchState, MatchEvent> {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return reject('There is no turn in progress.');
  if (turn.player !== player) return reject('It is not your turn.');
  if (!canUndoCommand(state)) {
    if (turn.placedKnightId || turn.movedKnightId) return reject('Undo the Knight first.');
    return reject('That Captain has already acted this turn.');
  }
  const captainId = turn.captainId!;
  const restored = turn.commandUndo ?? {};
  return {
    ok: true,
    state: { ...state, ...restored, turn: { ...turn, step: 'command', captainId: null, commandUndo: null } },
    events: [{ type: 'commandCancelled', player, captainId }],
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
  const options = commandOptions(state);
  if (!options.resumeCaptainIds.includes(captainId)) {
    if (options.mode === 'routed') return reject('You must play in the Region your opponent sent you to.');
    if (options.mode === 'lordCaptains') return reject('Only the current Lord’s stationed Captains can act this turn.');
    return reject('Deploy a Ready Captain this turn; you cannot revisit a Region yet.');
  }

  return {
    ok: true,
    state: { ...state, turn: { ...state.turn!, step: 'orders', captainId } },
    events: [{ type: 'captainResumed', player, captainId, region: captain.region }],
  };
}
