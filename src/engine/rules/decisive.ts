import { reject, type EngineResult } from '../engine';
import type { MatchEvent } from '../events';
import { captainInRegion, captainMilitia, decisiveRoller, knightHpMen, knightsOf, knightsOnBoard } from '../queries';
import {
  DECISIVE_DIVISOR,
  otherPlayer,
  type DecisiveBattle,
  type Knight,
  type MatchState,
  type PlayerId,
  type RegionIndex,
} from '../state';
import { passTurn } from './turns';

/**
 * The Region stalemated as `first`'s turn ended: its two Captains fight a
 * decisive battle with every man they have. Each side rolls once per Knight of
 * theirs on that board.
 */
export function startDecisive(
  state: MatchState,
  region: RegionIndex,
  first: PlayerId,
): { state: MatchState; events: MatchEvent[] } {
  const a = captainInRegion(state, region, 'p1')!;
  const b = captainInRegion(state, region, 'p2')!;
  const men = { p1: captainMilitia(state, a.id), p2: captainMilitia(state, b.id) };
  const decisive: DecisiveBattle = settle({
    region,
    first,
    captains: { p1: a.id, p2: b.id },
    startMen: { ...men },
    men,
    chances: { p1: knightsOnBoard(state, region, 'p1').length, p2: knightsOnBoard(state, region, 'p2').length },
    rolls: [],
    outcome: null,
  });
  return {
    state: { ...state, decisive, turn: { ...state.turn!, step: 'decisive' } },
    events: [{ type: 'decisiveStarted', region, first }],
  };
}

/** Sets the outcome once a side is wiped out or every roll is used. */
function settle(d: DecisiveBattle): DecisiveBattle {
  if (d.outcome) return d;
  for (const p of ['p1', 'p2'] as const) {
    if (d.men[p] <= 0) return { ...d, outcome: { winner: otherPlayer(p), loserKilled: true } };
  }
  if (decisiveRoller({ decisive: d } as MatchState) !== null) return d;
  const winner = d.men.p1 === d.men.p2 ? null : d.men.p1 > d.men.p2 ? 'p1' : 'p2';
  return { ...d, outcome: { winner, loserKilled: false } };
}

/** One roll of the die: the opponent loses (roller's men × die) ÷ 10 men, rounded down. */
export function rollDie(state: MatchState, player: PlayerId, value: number): EngineResult<MatchState, MatchEvent> {
  const d = state.decisive;
  if (!d || d.outcome) return reject('There is no decisive battle to roll in.');
  if (decisiveRoller(state) !== player) return reject('It is not your roll.');
  if (!Number.isInteger(value) || value < 1 || value > 6) return reject('A die shows 1 to 6.');
  const target = otherPlayer(player);
  const damage = Math.min(Math.floor((d.men[player] * value) / DECISIVE_DIVISOR), d.men[target]);
  const next = settle({
    ...d,
    men: { ...d.men, [target]: d.men[target] - damage },
    rolls: [...d.rolls, { player, value, damage }],
  });
  return {
    ok: true,
    state: { ...state, decisive: next },
    events: [{ type: 'dieRolled', player, value, damage }],
  };
}

/**
 * After the decisive battle: losses are spread evenly over each Captain's men.
 * The winner secures the Region; the loser's Knights on its board are captured
 * and the loser's Captain returns to their Lord with the Knights they never
 * deployed (or dies, wiped out). Level: nobody secures it, the Region closes and
 * both Captains return. Then the turn passes.
 */
export function finishDecisive(state: MatchState, player: PlayerId): EngineResult<MatchState, MatchEvent> {
  const d = state.decisive;
  if (!d?.outcome) return reject('The decisive battle is not over.');
  if (state.turn?.player !== player) return reject('It is not your turn.');

  const knights = { ...state.knights };
  const captains = { ...state.captains };
  for (const p of ['p1', 'p2'] as const) {
    const captain = captains[d.captains[p]]!;
    const loss = d.startMen[p] - d.men[p];
    const units = knightsOf(state, captain.id).filter((k) => k.status === 'ready' || k.status === 'fielded');
    const unitMen = units.map((k) => knightHpMen(k) + k.sergeants.reduce((n, s) => n + s.militia, 0));
    const [reserveLoss, ...knightLosses] = spread([captain.reserve, ...unitMen], loss);
    captains[captain.id] = { ...captain, reserve: captain.reserve - reserveLoss! };
    units.forEach((k, i) => (knights[k.id] = takeLosses(k, knightLosses[i]!)));
  }

  const { winner, loserKilled } = d.outcome;
  const capturedKnightIds: string[] = [];
  const returnedCaptainIds: string[] = [];
  const fallenCaptainIds: string[] = [];
  // A surviving Captain goes back to their Lord; with no men left off the board they fall.
  const sendHome = (p: PlayerId) => {
    const c = captains[d.captains[p]]!;
    const hasMen = c.reserve > 0 || Object.values(knights).some((k) => k.captainId === c.id && k.status === 'ready');
    captains[c.id] = { ...c, region: null, fallen: c.fallen || !hasMen };
    (hasMen ? returnedCaptainIds : fallenCaptainIds).push(c.id);
  };

  let secured = state.secured;
  let closed = state.closed;
  if (winner) {
    const loser = otherPlayer(winner);
    const loserId = d.captains[loser];
    if (loserKilled) {
      for (const k of knightsOf(state, loserId)) {
        if (k.status === 'ready' || k.status === 'fielded') {
          knights[k.id] = { ...knights[k.id]!, status: 'dead', position: null, hp: 0, sergeants: [] };
        }
      }
      captains[loserId] = { ...captains[loserId]!, region: null, fallen: true, reserve: 0 };
      fallenCaptainIds.push(loserId);
    } else {
      for (const k of Object.values(knights)) {
        if (k.status === 'fielded' && k.owner === loser && k.position?.region === d.region) {
          knights[k.id] = { ...k, status: 'captured', position: null };
          capturedKnightIds.push(k.id);
        }
      }
      sendHome(loser);
    }
    secured = { ...secured, [d.region]: { player: winner, captainId: d.captains[winner] } };
  } else {
    closed = [...closed, d.region];
    sendHome('p1');
    sendHome('p2');
  }

  const passed = passTurn({ ...state, knights, captains, secured, closed }, player);
  return {
    ok: true,
    state: passed.state,
    events: [
      {
        type: 'decisiveEnded',
        region: d.region,
        winner,
        loserKilled,
        capturedKnightIds,
        returnedCaptainIds,
        fallenCaptainIds,
      },
      ...passed.events,
    ],
  };
}

/** Splits `loss` over pools in proportion to their size (largest remainder), never more than a pool holds. */
export function spread(pools: number[], loss: number): number[] {
  const total = pools.reduce((a, b) => a + b, 0);
  if (total <= 0 || loss <= 0) return pools.map(() => 0);
  if (loss >= total) return [...pools];
  const exact = pools.map((p) => (p * loss) / total);
  const out = exact.map(Math.floor);
  let left = loss - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (left <= 0) break;
    if (out[i]! < pools[i]!) {
      out[i]!++;
      left--;
    }
  }
  return out;
}

/** Takes `loss` men from a Knight's HP and Sergeants evenly. It only dies if every man is gone. */
function takeLosses(knight: Knight, loss: number): Knight {
  if (loss <= 0) return knight;
  const hpMen = knightHpMen(knight);
  const total = hpMen + knight.sergeants.reduce((n, s) => n + s.militia, 0);
  if (loss >= total) return { ...knight, status: 'dead', position: null, hp: 0, sergeants: [] };
  const parts = spread([hpMen, ...knight.sergeants.map((s) => s.militia)], loss);
  // Keep the Knight standing while it still has men: move one lost HP man onto a Sergeant.
  if (parts[0] === hpMen) {
    const j = parts.findIndex((p, i) => i > 0 && p < knight.sergeants[i - 1]!.militia);
    parts[0]!--;
    parts[j]!++;
  }
  const perMan = knight.braced ? 2 : 1;
  const sergeants = knight.sergeants
    .map((s, i) => ({ ...s, militia: s.militia - parts[i + 1]! }))
    .filter((s) => s.militia > 0);
  return { ...knight, hp: Math.max(1, knight.hp - parts[0]! * perMan), sergeants };
}
