import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { actingCaptain, knightAt, knightMilitia, moveSquares, nextOrdersStep, winningLine } from '../queries';
import { charge } from './resources';
import { SQUARES, type MatchState, type PlayerId, type RegionIndex, type SquareIndex } from '../state';

/**
 * The acting Captain places one of their waiting Knights on an empty square
 * of their Region. One placement (or one move) per turn, before or after the
 * turn's attack. It can be undone until an attack is made or the turn ends.
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
  if (turn.placedKnightId) return reject('You have already placed a Knight this turn.');
  if (turn.movedKnightId) return reject('You have already moved a Knight this turn.');
  if (turn.step !== 'orders') return reject('You cannot place a Knight right now.');

  const captain = actingCaptain(state);
  if (!captain || captain.region === null) return reject('Your Captain is not stationed in a Region.');
  const knight = state.knights[knightId];
  if (!knight || knight.captainId !== captain.id) return reject('That Knight does not serve this Captain.');
  if (knight.status === 'unmanned') return reject('That Knight has no men yet.');
  if (knight.status !== 'ready') return reject('That Knight cannot take the field.');
  if (!SQUARES.includes(square)) return reject('That square does not exist.');
  if (knightAt(state, captain.region, square)) return reject('That square is taken.');

  const region = captain.region;
  const paid = charge(state, player, knightMilitia(knight), { knightId });
  const placed: MatchState = {
    ...paid.state,
    knights: { ...paid.state.knights, [knightId]: { ...paid.state.knights[knightId]!, status: 'fielded', position: { region, square } } },
    // The square sends the opponent to the Region in the same position.
    route: square,
    turn: { ...turn, placedKnightId: knightId, undo: snapshot(state) },
  };
  return settleOrder(placed, region, player, captain.id, [{ type: 'knightPlaced', player, knightId, region, square }, ...paid.events]);
}

/**
 * Instead of placing, one of the acting Captain's Knights on the board steps to
 * an empty square directly up, down, left or right. Only if nothing was placed
 * or attacked this turn; no attack follows. It routes the opponent and can
 * secure the Region like a placement, and can be undone until the turn ends.
 */
export function moveKnight(
  state: MatchState,
  player: PlayerId,
  knightId: string,
  square: SquareIndex,
): EngineResult<MatchState, MatchEvent> {
  const turn = state.turn;
  if (state.phase !== 'turns' || !turn) return reject('Knights can only move during a turn.');
  if (turn.player !== player) return reject('It is not your turn.');
  if (turn.placedKnightId) return reject('You cannot move after placing a Knight this turn.');
  if (turn.attacked) return reject('You cannot move after a battle this turn.');
  if (turn.movedKnightId) return reject('You have already moved a Knight this turn.');
  if (!moveSquares(state, knightId).includes(square)) {
    return reject('A Knight can only step to an empty square directly up, down, left or right.');
  }
  const captain = actingCaptain(state)!;
  const knight = state.knights[knightId]!;
  const region = knight.position!.region;
  const from = knight.position!.square;
  const paid = charge(state, player, knightMilitia(knight), { knightId });
  const moved: MatchState = {
    ...paid.state,
    knights: { ...paid.state.knights, [knightId]: { ...paid.state.knights[knightId]!, position: { region, square } } },
    route: square,
    turn: { ...turn, movedKnightId: knightId, undo: snapshot(state) },
  };
  const result = settleOrder(moved, region, player, captain.id, [
    { type: 'knightMoved', player, knightId, region, from, to: square },
    ...paid.events,
  ]);
  // No attack follows a move.
  return result.ok ? { ...result, state: { ...result.state, turn: { ...result.state.turn!, step: 'end' } } } : result;
}

/** Take back this turn's placement or move. Not after an attack made since, or once the turn ends. */
export function undoKnight(state: MatchState, player: PlayerId): EngineResult<MatchState, MatchEvent> {
  const turn = state.turn;
  if (!turn || turn.player !== player) return reject('It is not your turn.');
  if (!turn.undo) return reject('There is nothing to undo.');
  const knightId = turn.placedKnightId ?? turn.movedKnightId!;
  const restored: MatchState = {
    ...state,
    ...turn.undo,
    turn: { ...turn, placedKnightId: null, movedKnightId: null, undo: null },
  };
  return {
    ok: true,
    state: { ...restored, turn: { ...restored.turn!, step: nextOrdersStep(restored) } },
    events: [{ type: 'knightOrderUndone', player, knightId }],
  };
}

/** What a placement or move changes, saved so it can be undone. */
function snapshot(state: MatchState) {
  return { resources: state.resources, wagers: state.wagers, knights: state.knights, captains: state.captains, secured: state.secured, route: state.route };
}

/**
 * After a Knight lands on a square: three in a row secures the Region for this
 * Captain (permanent: the board closes and enemy Knights still standing there
 * are captured). Otherwise more orders if any are still possible.
 */
function settleOrder(
  placed: MatchState,
  region: RegionIndex,
  player: PlayerId,
  captainId: string,
  events: MatchEvent[],
): EngineResult<MatchState, MatchEvent> {
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
      captainId,
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
        secured: { ...placed.secured, [region]: { player, captainId, capturedKnightIds } },
        turn: { ...placed.turn!, step: 'end' },
      },
      events,
    };
  }

  // More orders if the turn's attack is still unused and possible; otherwise End.
  return { ok: true, state: { ...placed, turn: { ...placed.turn!, step: nextOrdersStep(placed) } }, events };
}
