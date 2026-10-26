import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import {
  assaultTargets,
  captainMilitia,
  knightsOf,
  knightsOnBoard,
  sendTargets,
  sendableKnights,
  stationCandidates,
  stationedOrdersOpen,
} from '../queries';
import {
  otherPlayer,
  type Captain,
  type DecisiveBattle,
  type Knight,
  type MatchState,
  type PlayerId,
  type RegionIndex,
} from '../state';
import { settle } from './decisive';
import { passTurn } from './turns';

/**
 * A Captain holding a secured Region gives one order per turn (chosen on a Free
 * Choice): send reserve or one Knight to one of your Captains deployed in an
 * adjacent, unsecured Region, or assault an adjacent enemy-held Region.
 */
function checkStationed(state: MatchState, player: PlayerId): Captain | string {
  if (state.turn?.player !== player) return 'It is not your turn.';
  const captain = stationedOrdersOpen(state);
  if (!captain) return 'Only a Captain holding a secured Region can give that order, once per turn.';
  return captain;
}

function receiver(state: MatchState, from: Captain, toCaptainId: string): Captain | string {
  const to = sendTargets(state, from).find((c) => c.id === toCaptainId);
  return to ?? 'Men can only go to one of your Captains deployed in an adjacent Region that is not secured.';
}

/** Send reserve militia to a Captain next door; it joins their reserve. */
export function sendReserve(
  state: MatchState,
  player: PlayerId,
  toCaptainId: string,
  amount: number,
): EngineResult<MatchState, MatchEvent> {
  const from = checkStationed(state, player);
  if (typeof from === 'string') return reject(from);
  const to = receiver(state, from, toCaptainId);
  if (typeof to === 'string') return reject(to);
  if (!Number.isInteger(amount) || amount <= 0) return reject('Send at least one man.');
  if (amount > from.reserve) return reject('The Captain does not have that many men in reserve.');
  return {
    ok: true,
    state: {
      ...state,
      captains: {
        ...state.captains,
        [from.id]: { ...from, reserve: from.reserve - amount },
        [to.id]: { ...to, reserve: to.reserve + amount },
      },
      turn: { ...state.turn!, stationOrder: true, step: 'end' },
    },
    events: [{ type: 'reserveSent', player, fromCaptainId: from.id, toCaptainId: to.id, amount }],
  };
}

/** Send one Knight (waiting, or off the secured board) to a Captain next door; it joins them, waiting to be placed. */
export function sendKnight(
  state: MatchState,
  player: PlayerId,
  knightId: string,
  toCaptainId: string,
): EngineResult<MatchState, MatchEvent> {
  const from = checkStationed(state, player);
  if (typeof from === 'string') return reject(from);
  const to = receiver(state, from, toCaptainId);
  if (typeof to === 'string') return reject(to);
  const knight = sendableKnights(state, from).find((k) => k.id === knightId);
  if (!knight) return reject('That Knight cannot be sent.');
  const knights = { ...state.knights };
  if (!joinCaptain(knights, knight.id, to.id)) return reject(`${'That Captain'} has no free Knight slot.`);
  return {
    ok: true,
    state: {
      ...state,
      knights,
      turn: { ...state.turn!, stationOrder: true, step: 'end' },
    },
    events: [{ type: 'knightSent', player, knightId: knight.id, fromCaptainId: from.id, toCaptainId: to.id }],
  };
}

/**
 * Assault an adjacent enemy-held Region: a decisive battle between the two
 * Captains with all their men. Each rolls once per Knight on its own Region's
 * board; the attacker rolls first.
 */
export function assault(state: MatchState, player: PlayerId, region: RegionIndex): EngineResult<MatchState, MatchEvent> {
  const from = checkStationed(state, player);
  if (typeof from === 'string') return reject(from);
  if (!assaultTargets(state, from).includes(region)) {
    return reject('You can only assault an adjacent Region the enemy holds.');
  }
  const defender = state.captains[state.secured[region]!.captainId]!;
  const enemy = otherPlayer(player);
  const captains = { [player]: from.id, [enemy]: defender.id } as Record<PlayerId, string>;
  const men = { [player]: captainMilitia(state, from.id), [enemy]: captainMilitia(state, defender.id) } as Record<
    PlayerId,
    number
  >;
  const chances = {
    [player]: knightsOnBoard(state, from.region!, player).length,
    [enemy]: knightsOnBoard(state, region, enemy).length,
  } as Record<PlayerId, number>;
  const decisive: DecisiveBattle = settle({
    kind: 'assault',
    fromRegion: from.region,
    region,
    first: player,
    captains,
    startMen: { ...men },
    men,
    chances,
    rolls: [],
    outcome: null,
  });
  return {
    ok: true,
    state: { ...state, decisive, turn: { ...state.turn!, stationOrder: true, step: 'decisive' } },
    events: [{ type: 'decisiveStarted', region, first: player }],
  };
}

/**
 * After an assault (losses already spread over both Captains' men):
 * - Attacker wins: the defender's Knights on that board are captured and their
 *   Captain returns to their Lord (or dies at 0 men). The attacker's Knights the
 *   enemy had captured there are freed. If their own Captain is alive and on
 *   Standby, that Captain takes the Region with them; otherwise the player
 *   stations a Standby Captain who still has a Knight; with none, the Region reopens.
 * - Attacker loses (or level): only men are lost; at 0 men the attacker dies.
 */
export function finishAssault(
  state: MatchState,
  player: PlayerId,
  d: DecisiveBattle,
  knights: Record<string, Knight>,
  captains: Record<string, Captain>,
): EngineResult<MatchState, MatchEvent> {
  const attacker = state.turn!.player;
  const enemy = otherPlayer(attacker);
  const { winner, loserKilled } = d.outcome!;
  const capturedKnightIds: string[] = [];
  const returnedCaptainIds: string[] = [];
  const fallenCaptainIds: string[] = [];
  const events: MatchEvent[] = [
    { type: 'decisiveEnded', region: d.region, winner, loserKilled, capturedKnightIds, returnedCaptainIds, fallenCaptainIds },
  ];
  const kill = (captainId: string) => {
    for (const k of knightsOf(state, captainId)) {
      if (k.status === 'ready' || k.status === 'fielded') {
        knights[k.id] = { ...knights[k.id]!, status: 'dead', position: null, hp: 0, sergeants: [] };
      }
    }
    captains[captainId] = { ...captains[captainId]!, region: null, fallen: true, reserve: 0 };
    fallenCaptainIds.push(captainId);
  };

  let secured = { ...state.secured };
  let pendingStation: MatchState['pendingStation'] = null;

  if (winner === attacker) {
    const defenderId = d.captains[enemy];
    if (loserKilled) {
      kill(defenderId);
    } else {
      for (const k of Object.values(knights)) {
        if (k.status === 'fielded' && k.owner === enemy && k.position?.region === d.region) {
          knights[k.id] = { ...k, status: 'captured', position: null };
          capturedKnightIds.push(k.id);
        }
      }
      const c = captains[defenderId]!;
      const hasMen = c.reserve > 0 || Object.values(knights).some((k) => k.captainId === c.id && k.status === 'ready');
      captains[c.id] = { ...c, region: null, fallen: !hasMen };
      (hasMen ? returnedCaptainIds : fallenCaptainIds).push(c.id);
    }

    // Free our Knights the enemy captured here: back to their own Captain if alive.
    const freed = (state.secured[d.region]?.capturedKnightIds ?? []).filter(
      (id) => knights[id]?.status === 'captured' && knights[id]!.owner === attacker,
    );
    const orphanKnightIds: string[] = [];
    for (const id of freed) {
      const k = knights[id]!;
      if (captains[k.captainId]?.fallen) orphanKnightIds.push(id);
      else knights[id] = { ...k, status: 'ready', position: null };
    }
    // Their Captain, if alive and on Standby, takes the Region with them.
    const previous = freed.map((id) => captains[knights[id]!.captainId]!).find((c) => !c.fallen && c.region === null);
    delete secured[d.region];
    if (previous) {
      captains[previous.id] = { ...previous, region: d.region };
      secured[d.region] = { player: attacker, captainId: previous.id, capturedKnightIds };
      orphanKnightIds.forEach((id) => joinCaptain(knights, id, previous.id));
      events.push({ type: 'regionTaken', player: attacker, region: d.region, captainId: previous.id, rescuedKnightIds: freed });
    } else {
      const next: MatchState = { ...state, knights, captains };
      if (stationCandidates(next, attacker).length > 0) {
        pendingStation = { region: d.region, player: attacker, orphanKnightIds, capturedKnightIds };
      } else {
        events.push({ type: 'regionTaken', player: attacker, region: d.region, captainId: null, rescuedKnightIds: freed });
      }
    }
  } else if (winner === enemy && loserKilled) {
    kill(d.captains[attacker]);
  }

  const after: MatchState = { ...state, knights, captains, secured, decisive: null, pendingStation };
  if (pendingStation) {
    return { ok: true, state: { ...after, turn: { ...after.turn!, step: 'station' } }, events };
  }
  const passed = passTurn(after, player);
  return { ok: true, state: passed.state, events: [...events, ...passed.events] };
}

/** Station a Standby Captain in the Region just taken; freed Knights without a Captain join them. Then the turn passes. */
export function stationCaptain(
  state: MatchState,
  player: PlayerId,
  captainId: string | null,
): EngineResult<MatchState, MatchEvent> {
  const pending = state.pendingStation;
  if (!pending || pending.player !== player) return reject('There is no Region waiting for a Captain.');
  const captain = stationCandidates(state, player).find((c) => c.id === captainId);
  if (!captain) return reject('Choose one of your Standby Captains who still has a Knight.');
  const knights = { ...state.knights };
  pending.orphanKnightIds.forEach((id) => joinCaptain(knights, id, captain.id));
  const after: MatchState = {
    ...state,
    knights,
    captains: { ...state.captains, [captain.id]: { ...captain, region: pending.region } },
    secured: {
      ...state.secured,
      [pending.region]: { player, captainId: captain.id, capturedKnightIds: pending.capturedKnightIds },
    },
    pendingStation: null,
  };
  const passed = passTurn(after, state.turn!.player);
  return {
    ok: true,
    state: passed.state,
    events: [
      {
        type: 'regionTaken',
        player,
        region: pending.region,
        captainId: captain.id,
        rescuedKnightIds: pending.orphanKnightIds,
      },
      ...passed.events,
    ],
  };
}

/**
 * A Knight joins another Captain in one of their empty (unmanned) slots: the two
 * swap places, so both Captains keep six slots. Returns false if there is no free slot.
 */
export function joinCaptain(knights: Record<string, Knight>, knightId: string, toCaptainId: string): boolean {
  const knight = knights[knightId]!;
  const slot = Object.values(knights)
    .filter((k) => k.captainId === toCaptainId && k.status === 'unmanned')
    .sort((a, b) => a.number - b.number)[0];
  if (!slot) return false;
  knights[slot.id] = { ...slot, captainId: knight.captainId, number: knight.number };
  knights[knightId] = { ...knight, captainId: toCaptainId, number: slot.number, status: 'ready', position: null };
  return true;
}

/** Back out of a stationed Captain's orders before giving one: choose a Captain again. */
export function cancelStationOrders(state: MatchState, player: PlayerId): EngineResult<MatchState, MatchEvent> {
  const from = checkStationed(state, player);
  if (typeof from === 'string') return reject(from);
  return {
    ok: true,
    state: { ...state, turn: { ...state.turn!, step: 'command', captainId: null } },
    events: [{ type: 'commandCancelled', player, captainId: from.id }],
  };
}
