// Read-only questions about a match. The UI and the computer player use these
// to know what is legal; the rules use them to validate actions.
import {
  REGIONS,
  SQUARES,
  type Captain,
  type Knight,
  type LordClass,
  type MatchState,
  type PlayerId,
  type RegionIndex,
  type SquareIndex,
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

export function captainInRegion(state: MatchState, region: RegionIndex, player: PlayerId): Captain | null {
  return captainsInRegion(state, region).find((c) => c.owner === player) ?? null;
}

export function knightsOf(state: MatchState, captainId: string): Knight[] {
  return Object.values(state.knights)
    .filter((k) => k.captainId === captainId)
    .sort((a, b) => a.number - b.number);
}

/** Knights still waiting with their Captain. */
export function reserveKnights(state: MatchState, captainId: string): Knight[] {
  return knightsOf(state, captainId).filter((k) => k.position === null);
}

export function knightAt(state: MatchState, region: RegionIndex, square: SquareIndex): Knight | null {
  return (
    Object.values(state.knights).find(
      (k) => k.position?.region === region && k.position.square === square,
    ) ?? null
  );
}

export function emptySquares(state: MatchState, region: RegionIndex): SquareIndex[] {
  return SQUARES.filter((square) => knightAt(state, region, square) === null);
}

/**
 * Regions a player can send a new Captain to: none of their own Captains
 * there yet (the opponent may share it) and room left on its board.
 */
export function regionsOpenTo(state: MatchState, player: PlayerId): RegionIndex[] {
  return REGIONS.filter(
    (region) => captainInRegion(state, region, player) === null && emptySquares(state, region).length > 0,
  );
}

/**
 * Whether a Captain could act this turn: deploy (if Ready) or resume (if stationed),
 * and then actually place a Knight.
 */
export function captainCanAct(state: MatchState, captain: Captain): boolean {
  if (reserveKnights(state, captain.id).length === 0) return false;
  if (captain.region === null) return regionsOpenTo(state, captain.owner).length > 0;
  return emptySquares(state, captain.region).length > 0;
}

/** Captains of the current Lord that can be chosen this turn. Empty when nothing can be done. */
export function actionableCaptains(state: MatchState): Captain[] {
  const turn = state.turn;
  if (!turn || turn.step !== 'command') return [];
  return captainsOf(state, turn.player, turn.lord).filter((c) => captainCanAct(state, c));
}

/** The Captain acting this turn, once chosen. */
export function actingCaptain(state: MatchState): Captain | null {
  const id = state.turn?.captainId;
  return id ? (state.captains[id] ?? null) : null;
}

/** Squares the acting Captain may place a Knight on right now. */
export function legalSquares(state: MatchState): SquareIndex[] {
  const turn = state.turn;
  const captain = actingCaptain(state);
  if (!turn || turn.step !== 'placement' || !captain || captain.region === null) return [];
  return emptySquares(state, captain.region);
}

export function canEndTurn(state: MatchState): boolean {
  const turn = state.turn;
  if (!turn) return false;
  if (turn.step === 'end') return true;
  return turn.step === 'command' && actionableCaptains(state).length === 0;
}
