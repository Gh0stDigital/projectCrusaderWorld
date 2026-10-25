import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { actingCaptain, attackTargets, knightAt, winningLine } from '../queries';
import { SQUARES, type MatchState, type PlayerId, type SquareIndex } from '../state';

/**
 * The acting Captain places one of their waiting Knights on an empty square
 * of their Region. One placement per turn. Knights never move afterwards.
 * If an enemy Knight stands next to the new Knight, the turn moves to the Attack step.
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
  if (knight.status === 'unmanned') return reject('That Knight has no men yet.');
  if (knight.status !== 'ready') return reject('That Knight cannot take the field.');
  if (!SQUARES.includes(square)) return reject('That square does not exist.');
  if (knightAt(state, captain.region, square)) return reject('That square is taken.');

  const region = captain.region;
  const placed: MatchState = {
    ...state,
    knights: { ...state.knights, [knightId]: { ...knight, status: 'fielded', position: { region, square } } },
    // The square sends the opponent to the Region in the same position.
    route: square,
    turn: { ...turn, step: 'attack', placedKnightId: knightId },
  };
  const events: MatchEvent[] = [{ type: 'knightPlaced', player, knightId, region, square }];

  // Three in a row secures the Region for this Captain. It is permanent: the
  // board closes and enemy Knights still standing there are captured.
  if (winningLine(placed, region, player)) {
    const knights = { ...placed.knights };
    const capturedKnightIds: string[] = [];
    for (const k of Object.values(knights)) {
      if (k.status === 'fielded' && k.position?.region === region && k.owner !== player) {
        knights[k.id] = { ...k, status: 'captured', position: null };
        capturedKnightIds.push(k.id);
      }
    }
    // A losing Captain stationed there goes back to their Lord with any men they
    // still have (waiting Knights or reserve); with none left they fall.
    const captains = { ...placed.captains };
    const returnedCaptainIds: string[] = [];
    const fallenCaptainIds: string[] = [];
    for (const c of Object.values(captains)) {
      if (c.region !== region || c.owner === player) continue;
      const hasMen =
        c.reserve > 0 || Object.values(knights).some((k) => k.captainId === c.id && k.status === 'ready');
      if (hasMen) {
        captains[c.id] = { ...c, region: null };
        returnedCaptainIds.push(c.id);
      } else {
        captains[c.id] = { ...c, region: null, fallen: true };
        fallenCaptainIds.push(c.id);
      }
    }
    events.push({
      type: 'regionSecured',
      player,
      captainId: captain.id,
      region,
      capturedKnightIds,
      returnedCaptainIds,
      fallenCaptainIds,
    });
    return {
      ok: true,
      state: {
        ...placed,
        knights,
        captains,
        secured: { ...placed.secured, [region]: { player, captainId: captain.id } },
        turn: { ...placed.turn!, step: 'end' },
      },
      events,
    };
  }

  // With no enemy next to the new Knight there is nothing to attack: go straight to End.
  const next: MatchState =
    attackTargets(placed).length > 0 ? placed : { ...placed, turn: { ...placed.turn!, step: 'end' } };
  return { ok: true, state: next, events };
}
