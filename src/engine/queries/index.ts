// Read-only questions about a match. The UI and the computer player use these
// to know what is legal; the rules use them to validate actions.
import {
  REGIONS,
  type Captain,
  type LordClass,
  type MatchState,
  type PlayerId,
  type RegionIndex,
} from '../state';

/** The Lord a player will use on their next turn. Only advances when that player finishes a turn. */
export function nextLordFor(state: MatchState, player: PlayerId): LordClass | null {
  const { lordOrder, turnsTaken } = state.players[player];
  if (!lordOrder) return null;
  return lordOrder[turnsTaken % lordOrder.length] ?? null;
}

export function captainsOf(state: MatchState, player: PlayerId, lord?: LordClass): Captain[] {
  return Object.values(state.captains)
    .filter((c) => c.owner === player && (lord === undefined || c.lord === lord))
    .sort((a, b) => a.rank - b.rank);
}

/** Captains in a Region, at most one per player. */
export function captainsInRegion(state: MatchState, region: RegionIndex): Captain[] {
  return Object.values(state.captains).filter((c) => c.region === region);
}

/** A player may have only one Captain in a Region. The opponent may share it. */
export function regionsOpenTo(state: MatchState, player: PlayerId): RegionIndex[] {
  return REGIONS.filter(
    (region) => !captainsInRegion(state, region).some((c) => c.owner === player),
  );
}

/** Captains the current Lord can still deploy this turn. Empty when nothing can be deployed. */
export function deployableCaptains(state: MatchState): Captain[] {
  const turn = state.turn;
  if (!turn || turn.step !== 'command') return [];
  if (regionsOpenTo(state, turn.player).length === 0) return [];
  return captainsOf(state, turn.player, turn.lord).filter((c) => c.region === null);
}

export function canEndTurn(state: MatchState): boolean {
  const turn = state.turn;
  if (!turn) return false;
  return turn.step === 'end' || deployableCaptains(state).length === 0;
}
