import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/match';
import { createMatch } from '../src/engine/setup';
import { commandOptions, decisiveRoller, matchWinner, sendTargets, assaultTargets } from '../src/engine/queries';
import type { MatchAction } from '../src/engine/actions';
import type { MatchState, RegionIndex, SquareIndex } from '../src/engine/state';

function act(state: MatchState, action: MatchAction): MatchState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function rejected(state: MatchState, action: MatchAction): string {
  const result = applyAction(state, action);
  if (result.ok) throw new Error('expected a rejection');
  return result.reason;
}

const HOLDER = 'p1-raiders-1'; // holds the Heartland (4)
const NEIGHBOUR = 'p1-army-1'; // deployed in North (1), unsecured
const ENEMY = 'p2-garrison-1'; // holds East (5)
const LOST = 'p1-raiders-2-k1'; // captured by the enemy in East

/**
 * Player 1 (Raiders' turn) holds the Heartland with Raiders I; Army I is
 * deployed North. The enemy's Garrison I holds East, where it captured one of
 * Raiders II's Knights.
 */
function setup(): MatchState {
  let s = createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: ['raiders', 'army', 'garrison'] });
  s = act(s, { type: 'setLordOrder', player: 'p2', order: ['garrison', 'raiders', 'army'] });
  const field = (id: string, region: RegionIndex, square: SquareIndex) => {
    s.knights[id] = { ...s.knights[id]!, status: 'fielded', position: { region, square } };
  };
  s.captains[HOLDER] = { ...s.captains[HOLDER]!, region: 4 };
  s.captains[NEIGHBOUR] = { ...s.captains[NEIGHBOUR]!, region: 1 };
  s.captains[ENEMY] = { ...s.captains[ENEMY]!, region: 5 };
  field(`${HOLDER}-k1`, 4, 0);
  field(`${HOLDER}-k2`, 4, 1);
  field(`${ENEMY}-k1`, 5, 0);
  field(`${ENEMY}-k2`, 5, 4);
  s.knights[LOST] = { ...s.knights[LOST]!, status: 'captured', position: null };
  s.secured = {
    4: { player: 'p1', captainId: HOLDER, capturedKnightIds: [] },
    5: { player: 'p2', captainId: ENEMY, capturedKnightIds: [LOST] },
  };
  return s;
}

function resumeHolder(s: MatchState): MatchState {
  return act(s, { type: 'resumeCaptain', player: 'p1', captainId: HOLDER });
}

describe('A Captain holding a secured Region', () => {
  it('can be chosen on a Free Choice', () => {
    const s = setup();
    expect(commandOptions(s).mode).toBe('free');
    expect(commandOptions(s).resumeCaptainIds).toContain(HOLDER);
    const routed = { ...s, route: 7 as RegionIndex };
    expect(commandOptions(routed).mode).toBe('routed');
    expect(commandOptions(routed).resumeCaptainIds).not.toContain(HOLDER);
  });

  it('sends reserve to a Captain in an adjacent unsecured Region; that is the turn', () => {
    let s = resumeHolder(setup());
    expect(sendTargets(s, s.captains[HOLDER]!).map((c) => c.id)).toEqual([NEIGHBOUR]);
    expect(rejected(s, { type: 'sendReserve', player: 'p1', toCaptainId: NEIGHBOUR, amount: 999 })).toMatch(/that many/);
    const before = { from: s.captains[HOLDER]!.reserve, to: s.captains[NEIGHBOUR]!.reserve };
    s = act(s, { type: 'sendReserve', player: 'p1', toCaptainId: NEIGHBOUR, amount: 50 });
    expect(s.captains[HOLDER]!.reserve).toBe(before.from - 50);
    expect(s.captains[NEIGHBOUR]!.reserve).toBe(before.to + 50);
    expect(s.turn!.step).toBe('end');
    expect(rejected(s, { type: 'sendReserve', player: 'p1', toCaptainId: NEIGHBOUR, amount: 10 })).toMatch(/once per turn/);
  });

  it('sends one Knight, which joins the other Captain waiting to be placed', () => {
    let s = resumeHolder(setup());
    s = act(s, { type: 'sendKnight', player: 'p1', knightId: `${HOLDER}-k1`, toCaptainId: NEIGHBOUR });
    expect(s.knights[`${HOLDER}-k1`]).toMatchObject({ captainId: NEIGHBOUR, status: 'ready', position: null });
    expect(s.secured[4]?.player).toBe('p1');
  });

  it('assaults an adjacent enemy-held Region: a Decisive battle, attacker first, a roll per Knight on each board plus the Captain', () => {
    let s = resumeHolder(setup());
    expect(assaultTargets(s, s.captains[HOLDER]!)).toEqual([5]);
    s = act(s, { type: 'assault', player: 'p1', region: 5 });
    expect(s.turn!.step).toBe('decisive');
    expect(s.decisive).toMatchObject({ kind: 'assault', region: 5, fromRegion: 4, first: 'p1', chances: { p1: 3, p2: 3 } });
    expect(decisiveRoller(s)).toBe('p1');
  });

  it('winning frees the captured Knights; their Captain takes the Region with them', () => {
    let s = setup();
    s.captains[HOLDER] = { ...s.captains[HOLDER]!, reserve: 5000 };
    s = resumeHolder(s);
    s = act(s, { type: 'assault', player: 'p1', region: 5 });
    s = act(s, { type: 'rollDie', player: 'p1', value: 6 });
    expect(s.decisive!.outcome).toEqual({ winner: 'p1', loserKilled: true });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.captains[ENEMY]).toMatchObject({ fallen: true, region: null });
    expect(s.knights[LOST]).toMatchObject({ status: 'ready', captainId: 'p1-raiders-2' });
    expect(s.captains['p1-raiders-2']!.region).toBe(5);
    expect(s.secured[5]).toMatchObject({ player: 'p1', captainId: 'p1-raiders-2' });
    expect(s.turn!.player).toBe('p2');
  });

  it('when the freed Knights’ Captain has fallen, the player stations a Standby Captain who takes them', () => {
    let s = setup();
    s.captains[HOLDER] = { ...s.captains[HOLDER]!, reserve: 5000 };
    s.captains['p1-raiders-2'] = { ...s.captains['p1-raiders-2']!, fallen: true };
    s = resumeHolder(s);
    s = act(s, { type: 'assault', player: 'p1', region: 5 });
    s = act(s, { type: 'rollDie', player: 'p1', value: 6 });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.turn!.step).toBe('station');
    expect(s.secured[5]).toBeUndefined();
    expect(rejected(s, { type: 'endTurn', player: 'p1' })).toMatch(/station/i);
    s = act(s, { type: 'stationCaptain', player: 'p1', captainId: 'p1-army-2' });
    expect(s.secured[5]).toMatchObject({ player: 'p1', captainId: 'p1-army-2' });
    expect(s.knights[LOST]).toMatchObject({ status: 'ready', captainId: 'p1-army-2' });
    expect(s.turn!.player).toBe('p2');
  });

  it('losing only costs men', () => {
    let s = setup();
    s.captains[ENEMY] = { ...s.captains[ENEMY]!, reserve: 5000 };
    s = resumeHolder(s);
    s = act(s, { type: 'assault', player: 'p1', region: 5 });
    while (decisiveRoller(s)) s = act(s, { type: 'rollDie', player: decisiveRoller(s)!, value: 1 });
    expect(s.decisive!.outcome!.winner).toBe('p2');
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.secured[4]).toMatchObject({ player: 'p1', captainId: HOLDER });
    expect(s.secured[5]).toMatchObject({ player: 'p2', captainId: ENEMY });
    expect(s.knights[LOST]!.status).toBe('captured');
  });
});

describe('Decisive battle: the loser holds or retreats', () => {
  const rollOut = (s: MatchState) => {
    while (decisiveRoller(s)) s = act(s, { type: 'rollDie', player: decisiveRoller(s)!, value: 1 });
    return s;
  };
  const defenderLoses = () => {
    let s = setup();
    s.captains[HOLDER] = { ...s.captains[HOLDER]!, reserve: 1000 };
    s = act(resumeHolder(s), { type: 'assault', player: 'p1', region: 5 });
    s = rollOut(s);
    expect(s.decisive!.outcome).toEqual({ winner: 'p1', loserKilled: false, loserChoice: 'deciding' });
    return s;
  };
  const attackerLoses = () => {
    let s = setup();
    s.captains[ENEMY] = { ...s.captains[ENEMY]!, reserve: 600 };
    s = act(resumeHolder(s), { type: 'assault', player: 'p1', region: 5 });
    s = rollOut(s);
    expect(s.decisive!.outcome).toEqual({ winner: 'p2', loserKilled: false, loserChoice: 'deciding' });
    return s;
  };

  it('waits for the loser’s choice before the battle can close', () => {
    const s = defenderLoses();
    expect(rejected(s, { type: 'finishDecisive', player: 'p1' })).toMatch(/hold their ground or retreat/);
    expect(rejected(s, { type: 'decisiveChoice', player: 'p1', retreat: true })).toMatch(/losing side/);
  });

  it('a defender who holds keeps the Region; only men were lost', () => {
    let s = act(defenderLoses(), { type: 'decisiveChoice', player: 'p2', retreat: false });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.secured[5]).toMatchObject({ player: 'p2', captainId: ENEMY });
    expect(s.knights[`${ENEMY}-k1`]!.status).toBe('fielded');
    expect(s.knights[LOST]!.status).toBe('captured');
  });

  it('a defender who retreats keeps every living Knight and gives up the Region', () => {
    let s = act(defenderLoses(), { type: 'decisiveChoice', player: 'p2', retreat: true });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.captains[ENEMY]).toMatchObject({ region: null, fallen: false });
    expect([`${ENEMY}-k1`, `${ENEMY}-k2`].map((id) => s.knights[id]!.status)).toEqual(['ready', 'ready']);
    // The attacker takes it: the freed Knight's Captain moves in.
    expect(s.secured[5]).toMatchObject({ player: 'p1', captainId: 'p1-raiders-2' });
    expect(s.knights[LOST]!.status).toBe('ready');
  });

  it('a beaten attacker who retreats gives up their own Region; the winner stations a Captain there', () => {
    let s = act(attackerLoses(), { type: 'decisiveChoice', player: 'p1', retreat: true });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.captains[HOLDER]).toMatchObject({ region: null, fallen: false });
    expect([`${HOLDER}-k1`, `${HOLDER}-k2`].map((id) => s.knights[id]!.status)).toEqual(['ready', 'ready']);
    expect(s.secured[4]).toBeUndefined();
    expect(s.pendingStation).toMatchObject({ region: 4, player: 'p2' });
    s = act(s, { type: 'stationCaptain', player: 'p2', captainId: 'p2-army-1' });
    expect(s.secured[4]).toMatchObject({ player: 'p2', captainId: 'p2-army-1' });
    expect(s.turn!.player).toBe('p2');
  });

  it('the loser pays Resources for every man lost into a pool; retreating hands it to the winner', () => {
    let s = defenderLoses();
    const lost = s.decisive!.startMen.p2 - s.decisive!.men.p2;
    const p1 = s.resources!.p1;
    const p2 = s.resources!.p2;
    s = act(s, { type: 'decisiveChoice', player: 'p2', retreat: true });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.resources!.p2).toBe(p2 - lost);
    expect(s.resources!.p1).toBe(p1 + lost);
    expect(s.wagers).toEqual([]);
  });

  it('a defender who holds pays for holding, and the pool stays between the two Captains', () => {
    let s = defenderLoses();
    const lost = s.decisive!.startMen.p2 - s.decisive!.men.p2;
    s = act(s, { type: 'decisiveChoice', player: 'p2', retreat: false });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.wagers).toHaveLength(1);
    expect(s.wagers[0]).toMatchObject({ amount: lost, sides: [{ captainId: HOLDER, region: 4 }, { captainId: ENEMY, region: 5 }] });
  });

  it('a beaten attacker who holds keeps their Region', () => {
    let s = act(attackerLoses(), { type: 'decisiveChoice', player: 'p1', retreat: false });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.secured[4]).toMatchObject({ player: 'p1', captainId: HOLDER });
    expect(s.secured[5]).toMatchObject({ player: 'p2', captainId: ENEMY });
  });
});

describe('Routing into a conquered Region', () => {
  it('is no longer mandatory: a Free Choice', () => {
    const s = { ...setup(), route: 4 as RegionIndex };
    expect(commandOptions(s).mode).toBe('free');
    expect(commandOptions(s).deployRegions.length).toBeGreaterThan(0);
  });

  it('never lets the Lord command another Lord’s Captain stationed there', () => {
    const s = setup();
    // Army I holds North instead; it is the Raiders' turn and they are routed there.
    s.secured = { ...s.secured, 1: { player: 'p1', captainId: NEIGHBOUR, capturedKnightIds: [] } };
    s.knights[`${NEIGHBOUR}-k1`] = { ...s.knights[`${NEIGHBOUR}-k1`]!, status: 'fielded', position: { region: 1, square: 0 } };
    const routed = { ...s, route: 1 as RegionIndex };
    expect(commandOptions(routed).mode).toBe('free');
    expect(commandOptions(routed).resumeCaptainIds).not.toContain(NEIGHBOUR);
  });
});

describe('Winning the match', () => {
  it('goes to whoever holds three Regions in a row; the match ends when that turn passes', () => {
    let s = setup();
    s.secured = { ...s.secured, 3: { player: 'p1', captainId: 'p1-garrison-1', capturedKnightIds: [] } };
    expect(matchWinner(s)).toBeNull();
    s.captains[HOLDER] = { ...s.captains[HOLDER]!, reserve: 5000 };
    s = resumeHolder(s);
    s = act(s, { type: 'assault', player: 'p1', region: 5 });
    s = act(s, { type: 'rollDie', player: 'p1', value: 6 });
    s = act(s, { type: 'finishDecisive', player: 'p1' });
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('p1');
  });
});

describe('Sending a Knight and cancelling', () => {
  it('fills one of the receiver’s empty slots instead of adding one; both keep six', () => {
    let s = resumeHolder(setup());
    const count = (captainId: string) => Object.values(s.knights).filter((k) => k.captainId === captainId).length;
    s = act(s, { type: 'sendKnight', player: 'p1', knightId: `${HOLDER}-k1`, toCaptainId: NEIGHBOUR });
    expect(s.knights[`${HOLDER}-k1`]).toMatchObject({ captainId: NEIGHBOUR, number: 4 });
    expect([count(HOLDER), count(NEIGHBOUR)]).toEqual([6, 6]);
    expect(Object.values(s.knights).find((k) => k.captainId === HOLDER && k.number === 1)!.status).toBe('unmanned');
  });

  it('refuses when the receiver has no free slot', () => {
    let s = setup();
    for (const n of [4, 5, 6]) s.knights[`${NEIGHBOUR}-k${n}`] = { ...s.knights[`${NEIGHBOUR}-k${n}`]!, status: 'dead' };
    s = resumeHolder(s);
    expect(rejected(s, { type: 'sendKnight', player: 'p1', knightId: `${HOLDER}-k1`, toCaptainId: NEIGHBOUR })).toMatch(/no free/);
  });

  it('can be cancelled before giving the order: choose a Captain again', () => {
    let s = resumeHolder(setup());
    s = act(s, { type: 'cancelStationOrders', player: 'p1' });
    expect(s.turn).toMatchObject({ step: 'command', captainId: null });
  });
});
