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
import { charge, openWager } from './resources';
import { finishAssault } from './stationed';

/**
 * The Region stalemated as `first`'s turn ended: its two Captains make a Last
 * Stand with every man they have. Each side rolls once per Knight of theirs on
 * that board, plus once for the Captain.
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
    kind: 'stalemate',
    fromRegion: null,
    region,
    first,
    captains: { p1: a.id, p2: b.id },
    startMen: { ...men },
    men,
    chances: { p1: knightsOnBoard(state, region, 'p1').length + 1, p2: knightsOnBoard(state, region, 'p2').length + 1 },
    rolls: [],
    outcome: null,
  });
  return {
    state: { ...state, decisive, turn: { ...state.turn!, step: 'decisive' } },
    events: [{ type: 'decisiveStarted', region, first }],
  };
}

/** Sets the outcome once a side is wiped out or every roll is used. */
export function settle(d: DecisiveBattle): DecisiveBattle {
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
  const next = withLoserChoice(
    state,
    settle({
      ...d,
      men: { ...d.men, [target]: d.men[target] - damage },
      rolls: [...d.rolls, { player, value, damage }],
    }),
  );
  return {
    ok: true,
    state: { ...state, decisive: next },
    events: [{ type: 'dieRolled', player, value, damage }],
  };
}

/**
 * Decisive battle (assault) lost with men and a living Knight left: the loser
 * gets to choose between holding their ground and retreating.
 */
export function withLoserChoice(state: MatchState, d: DecisiveBattle): DecisiveBattle {
  const o = d.outcome;
  if (d.kind !== 'assault' || !o?.winner || o.loserKilled || o.loserChoice) return d;
  const loserId = d.captains[otherPlayer(o.winner)];
  const alive = knightsOf(state, loserId).some((k) => k.status === 'ready' || k.status === 'fielded');
  return alive ? { ...d, outcome: { ...o, loserChoice: 'deciding' } } : d;
}

/** The loser of a Decisive battle holds their ground or retreats. */
export function chooseDecisiveFate(state: MatchState, player: PlayerId, retreat: boolean): EngineResult<MatchState, MatchEvent> {
  const d = state.decisive;
  const o = d?.outcome;
  if (!d || !o || o.loserChoice !== 'deciding') return reject('There is no choice to make.');
  if (otherPlayer(o.winner!) !== player) return reject('Only the losing side chooses.');
  // Holding their ground costs the Captain's men in Resources.
  const captainId = d.captains[player];
  const held = retreat ? { state, events: [] as MatchEvent[] } : charge(state, player, captainMilitia(state, captainId), { captainId });
  return {
    ok: true,
    state: { ...held.state, decisive: { ...d, outcome: { ...o, loserChoice: retreat ? 'retreat' : 'hold' } } },
    events: [{ type: 'decisiveLoserChose', player, retreat }, ...held.events],
  };
}

/**
 * After the battle: losses are spread evenly over each Captain's men.
 * The winner secures the Region; the loser's Knights on its board are captured
 * and the loser's Captain returns to their Lord with the Knights they never
 * deployed (or dies, wiped out). Level: nobody secures it, the Region closes and
 * both Captains return. Then the turn passes.
 */
export function finishDecisive(state: MatchState, player: PlayerId): EngineResult<MatchState, MatchEvent> {
  const d = state.decisive;
  if (!d?.outcome) return reject('The battle is not over.');
  if (state.turn?.player !== player) return reject('It is not your turn.');
  if (d.outcome.loserChoice === 'deciding') return reject('The losing Captain must first hold their ground or retreat.');

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

  // Resources: the loser pays for every man lost into a pool between the two Captains.
  const wagerEvents: MatchEvent[] = [];
  if (d.outcome.winner) {
    const win = d.outcome.winner;
    const lose = otherPlayer(win);
    const spot = (p: PlayerId) => ({
      player: p,
      captainId: d.captains[p],
      region: d.kind === 'assault' && p === state.turn!.player ? d.fromRegion! : d.region,
    });
    const pool = openWager(state, spot(lose), spot(win), d.startMen[lose] - d.men[lose]);
    state = pool.state;
    wagerEvents.push(...pool.events);
  }

  if (d.kind === 'assault') {
    const done = finishAssault(state, player, d, knights, captains);
    return done.ok ? { ...done, events: [...wagerEvents, ...done.events] } : done;
  }

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
    secured = { ...secured, [d.region]: { player: winner, captainId: d.captains[winner], capturedKnightIds } };
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
      ...wagerEvents,
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
export function takeLosses(knight: Knight, loss: number): Knight {
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
