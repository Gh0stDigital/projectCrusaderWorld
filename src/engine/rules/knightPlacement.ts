import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { actingCaptain, knightAt } from '../queries';
import { SQUARES, type MatchState, type PlayerId, type SquareIndex } from '../state';

/**
 * The acting Captain places one of their waiting Knights on an empty square
 * of their Region. One placement per turn. Knights never move afterwards.
 */
export function placeKnight(
  state: MatchState,
  player: PlayerId,
  knightId: string,
  square: SquareIndex,
): EngineResult<MatchState, MatchEvent> {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return reject('Knights can only be placed during a turn.');
  if (turn.player !== player) return reject('It is not your turn.');
  if (turn.step === 'command') return reject('Choose a Captain first.');
  if (turn.step !== 'placement') return reject('You have already placed a Knight this turn.');

  const captain = actingCaptain(state);
  if (!captain || captain.region === null) return reject('Your Captain is not stationed in a Region.');
  const knight = state.knights[knightId];
  if (!knight || knight.captainId !== captain.id) return reject('That Knight does not serve this Captain.');
  if (knight.position !== null) return reject('That Knight is already on the field.');
  if (!SQUARES.includes(square)) return reject('That square does not exist.');
  if (knightAt(state, captain.region, square)) return reject('That square is taken.');

  const region = captain.region;
  return {
    ok: true,
    state: {
      ...state,
      knights: { ...state.knights, [knightId]: { ...knight, position: { region, square } } },
      turn: { ...turn, step: 'end', placedKnightId: knightId },
    },
    events: [{ type: 'knightPlaced', player, knightId, region, square }],
  };
}
