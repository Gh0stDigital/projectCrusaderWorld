import { actionableCaptains, commandOptions, type MoveType } from '../../engine/queries';

export const MOVE_TYPE_NAMES: Record<MoveType, string> = { fated: 'Fated Move', control: 'Control Move' };
import type { MatchState } from '../../engine/state';
import { REGION_NAMES, captainName } from '../../data/names';

/** One line describing where the current player must (or may) play this turn. */
export function commandSummary(match: MatchState): string {
  if (actionableCaptains(match).length === 0) return 'This Lord has no orders to give this turn';
  const o = commandOptions(match);
  if (o.mode === 'routed' && o.route !== null) {
    const where = REGION_NAMES[o.route];
    if (o.resumeCaptainIds.length > 0) {
      return `Sent to ${where}: ${captainName(match.captains[o.resumeCaptainIds[0]!]!)} takes command`;
    }
    return `Sent to ${where}: deploy a Captain there`;
  }
  if (o.mode === 'lordCaptains') return 'All this Lord’s Captains are deployed: choose one of their Regions';
  if (o.route !== null && o.resumeCaptainIds.length > 0) {
    const other = match.captains[o.resumeCaptainIds[0]!]!;
    return `Sent to ${REGION_NAMES[o.route]} (${captainName(other)}): deploy anywhere, or command them there`;
  }
  if (o.route !== null) return `${REGION_NAMES[o.route]} is closed: deploy to any open Region`;
  return 'Deploy a Captain to any Region';
}
