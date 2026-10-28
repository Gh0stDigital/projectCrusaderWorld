import { create } from 'zustand';
import type { MatchAction } from '../engine/actions';
import type { MatchEvent } from '../engine/events';
import { applyAction } from '../engine/match';
import { chooseCommand, chooseDecisiveFate, chooseLordOrder, chooseOrders, chooseReinforcement, chooseSergeant, chooseRetreat as chooseComputerRetreat, chooseStation } from '../ai';
import { commandSummary } from '../ui/campaign/commandText';
import { reportsFor, type Report } from '../ui/campaign/reports';
import { play } from '../audio/sound';
import {
  actingCaptain,
  actionableCaptains,
  attackers,
  canEndTurn,
  canPlaceNow,
  decisiveRoller,
  reserveKnights,
  retreatDecider,
} from '../engine/queries';
import { createMatch } from '../engine/setup';
import type { LordClass, MatchState, PlayerId, RegionIndex, SquareIndex } from '../engine/state';

export interface TurnAnnouncement {
  player: PlayerId;
  lord: LordClass;
  turnNumber: number;
  canAct: boolean;
  /** Where the player must (or may) play this turn. */
  task: string;
}

/** A defeated Knight's piece leaving the board after a battle: shown, then animated away. */
export interface Departure {
  knightId: string;
  owner: PlayerId;
  region: RegionIndex;
  square: SquareIndex;
  fate: 'killed' | 'retreated';
}

/** How long the loser's piece lingers and then plays its exit, in milliseconds. */
export const DEPART_MS = 2000;

/** The computer plays Player 2. */
export const COMPUTER: PlayerId = 'p2';
/** Pause between the computer's steps, so its turn can be followed. */
const COMPUTER_STEP_MS = 900;

/** Timing of the end-of-turn sequence, in milliseconds. */
export const CONFIRM_MS = 1000;
export const ZOOM_MS = 600;
export const PAUSE_MS = 1000;

interface MatchStore {
  /** Game state: owned by the engine, only changed through dispatch. */
  match: MatchState;

  /** Screen state below: selection, camera, messages. Never affects the rules. */
  selectedCaptainId: string | null;
  selectedKnightId: string | null;
  /** The Region the camera is zoomed into, or null for the Region board. */
  focusedRegion: RegionIndex | null;
  /** True while the end-of-turn sequence plays; player input is ignored. */
  busy: boolean;
  /** Enemy Knight being looked at before committing to an attack. */
  attackPreviewId: string | null;
  /** Whether the battle screen is showing. Stays open after the duel ends until the player returns. */
  battleOpen: boolean;
  /**
   * The match as it stood when the battle began. Side panels show this while the
   * battle plays, so they don't reveal results before the battle screen does.
   */
  battleSnapshot: MatchState | null;
  /** The loser of the last battle leaving the board; End turn waits for it. */
  departure: Departure | null;
  /** The computer has attacked the human: the pre-battle window offers reinforcements. */
  defensePromptOpen: boolean;
  /** The decisive battle screen is showing (from its start until the player returns). */
  decisiveOpen: boolean;
  /** The pre-battle window for the decisive battle has been closed; rolling can start. */
  decisiveBegun: boolean;
  /** Player 1 is looking at an assault before launching it (the Region to assault). */
  assaultPreview: RegionIndex | null;
  /** Pop-up reports waiting to be read (Regions lost or won, men sent). The computer waits for them. */
  reports: Report[];
  /** "Orders complete" confirmation shown at the end of a turn. */
  notice: { player: PlayerId } | null;
  error: string | null;
  announcement: TurnAnnouncement | null;

  dispatch: (action: MatchAction) => boolean;
  selectCaptain: (id: string | null) => void;
  selectKnight: (id: string | null) => void;
  focusRegion: (region: RegionIndex | null) => void;
  requestEndTurn: () => void;
  openAttackPreview: (knightId: string | null) => void;
  commenceAttack: () => void;
  closeBattle: () => void;
  /** The human's surviving loser retreats to its Captain (true) or holds its square (false); then the battle closes. */
  chooseRetreat: (retreat: boolean) => void;
  /** The human rolls their die in the decisive battle. */
  rollDecisive: () => void;
  /** Leave the finished decisive battle: its results apply and the turn passes. */
  closeDecisive: () => void;
  /** Close the decisive pre-battle window and start rolling. */
  beginDecisive: () => void;
  /** Open (region) or cancel (null) the preview of an assault Player 1 is considering. */
  previewAssault: (region: RegionIndex | null) => void;
  /** Launch the previewed assault; its pre-battle window has already been seen. */
  launchAssault: () => void;
  /** Close the report on top. */
  dismissReport: () => void;
  /** The human, under attack, sends `amount` reserve militia (0 for none) and the battle begins. */
  confirmDefense: (amount: number) => void;
  dismissAnnouncement: () => void;
  newMatch: () => void;
}

const freshScreenState = {
  selectedCaptainId: null,
  selectedKnightId: null,
  focusedRegion: null,
  busy: false,
  notice: null,
  error: null,
  announcement: null,
  attackPreviewId: null,
  battleOpen: false,
  battleSnapshot: null,
  defensePromptOpen: false,
  decisiveOpen: false,
  decisiveBegun: false,
  assaultPreview: null,
  reports: [],
  departure: null,
};

/** Pause between dice rolls in the decisive battle, so each can be followed. */
export const DECISIVE_ROLL_MS = 1800;
let decisiveTimer: number | null = null;

let departureTimer: number | null = null;

let computerTimer: number | null = null;
function clearComputer() {
  if (computerTimer !== null) window.clearTimeout(computerTimer);
  computerTimer = null;
}

let sequenceTimers: number[] = [];
function clearSequence() {
  sequenceTimers.forEach((t) => window.clearTimeout(t));
  sequenceTimers = [];
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  match: createMatch(),
  ...freshScreenState,

  dispatch: (action) => {
    const result = applyAction(get().match, action);
    if (!result.ok) {
      set({ error: result.reason });
      return false;
    }
    playEventSounds(result.events);
    set({
      match: result.state,
      error: null,
      ...screenUpdatesFor(result.state, result.events),
      reports: [...get().reports, ...reportsFor(result.state, result.events)],
    });
    // The computer picks Player 2's Sergeants in a duel, whether attacking or
    // defending. It commits before the human picks and never sees their choice.
    if (result.events.some((e) => e.type === 'duelStarted' || e.type === 'clashResolved')) {
      const duel = result.state.duel;
      if (duel && !duel.outcome) {
        // Attacked: the computer may first send reserve men to its Knight.
        const reinforce = chooseReinforcement(result.state, COMPUTER);
        if (reinforce) get().dispatch(reinforce);
        const reply = chooseSergeant(get().match, COMPUTER);
        if (reply) get().dispatch(reply);
      }
    }
    // A Decisive battle the computer lost: it holds or retreats at once.
    const fate = chooseDecisiveFate(result.state, COMPUTER);
    if (fate) get().dispatch(fate);
    scheduleComputerRoll();
    // The computer decides at once whether its surviving loser retreats or holds.
    if (retreatDecider(result.state) === COMPUTER) {
      const choice = chooseComputerRetreat(result.state, COMPUTER);
      if (choice) get().dispatch(choice);
    }
    scheduleComputer();
    return true;
  },

  selectCaptain: (id) => set({ selectedCaptainId: id, error: null }),
  selectKnight: (id) => set({ selectedKnightId: id, error: null }),
  focusRegion: (region) => set({ focusedRegion: region, error: null }),

  /**
   * End Turn: confirm the player's orders, zoom back out to the Region board,
   * pause, then hand over to the next player.
   */
  requestEndTurn: () => {
    const { match, busy, focusedRegion, battleOpen, departure, decisiveOpen } = get();
    const turn = match.turn;
    if (busy || battleOpen || departure || decisiveOpen || !turn) return;
    if (!canEndTurn(match)) {
      // Let the engine explain why.
      get().dispatch({ type: 'endTurn', player: turn.player });
      return;
    }

    clearSequence();
    set({ busy: true, notice: { player: turn.player }, error: null });
    const zoomTime = focusedRegion === null ? 0 : ZOOM_MS;
    sequenceTimers.push(
      window.setTimeout(() => set({ notice: null, focusedRegion: null }), CONFIRM_MS),
      window.setTimeout(() => {
        set({ busy: false });
        get().dispatch({ type: 'endTurn', player: turn.player });
      }, CONFIRM_MS + zoomTime + PAUSE_MS),
    );
  },

  openAttackPreview: (knightId) => set({ attackPreviewId: knightId, error: null }),

  /** Confirm the attack from the preview: start the duel and open the battle screen. */
  commenceAttack: () => {
    const { match, attackPreviewId, selectedKnightId } = get();
    if (!match.turn || !attackPreviewId || !selectedKnightId) return;
    set({ attackPreviewId: null });
    const before = get().match;
    const action = {
      type: 'declareAttack',
      player: match.turn.player,
      attackerKnightId: selectedKnightId,
      targetKnightId: attackPreviewId,
    } as const;
    if (get().dispatch(action)) {
      set({ battleOpen: true, battleSnapshot: before });
    }
  },

  beginDecisive: () => {
    set({ decisiveBegun: true });
    scheduleComputerRoll();
  },

  previewAssault: (region) => set({ assaultPreview: region, error: null }),

  launchAssault: () => {
    const region = get().assaultPreview;
    set({ assaultPreview: null });
    if (region === null) return;
    if (get().dispatch({ type: 'assault', player: 'p1', region })) set({ decisiveBegun: true });
    scheduleComputerRoll();
  },

  dismissReport: () => {
    set({ reports: get().reports.slice(1) });
    scheduleComputer();
  },

  rollDecisive: () => {
    if (decisiveRoller(get().match) !== 'p1') return;
    get().dispatch({ type: 'rollDie', player: 'p1', value: 1 + Math.floor(Math.random() * 6) });
  },

  closeDecisive: () => {
    const { match } = get();
    if (!match.decisive?.outcome || !match.turn) return;
    set({ decisiveOpen: false });
    get().dispatch({ type: 'finishDecisive', player: match.turn.player });
  },

  chooseRetreat: (retreat) => {
    const player = retreatDecider(get().match);
    if (player && get().dispatch({ type: 'chooseRetreat', player, retreat })) get().closeBattle();
  },

  closeBattle: () => {
    // The loser's piece stays on its old square for a moment, then retreats or is destroyed.
    const { match, battleSnapshot } = get();
    const duel = match.duel;
    let departure: Departure | null = null;
    const fate = duel?.outcome?.loserFate;
    if (duel?.outcome?.winner && (fate === 'killed' || fate === 'retreated')) {
      const loserRole = duel.outcome.winner === 'attacker' ? 'defender' : 'attacker';
      const loserId = duel[loserRole].knightId;
      const before = (battleSnapshot ?? match).knights[loserId];
      if (before?.position) {
        departure = {
          knightId: loserId,
          owner: before.owner,
          region: before.position.region,
          square: before.position.square,
          fate,
        };
      }
    }
    // Still able to place after the battle: have a waiting Knight ready to go.
    const acting = actingCaptain(match);
    const nextKnight = acting && canPlaceNow(match) ? (reserveKnights(match, acting.id)[0]?.id ?? null) : null;
    set({ battleOpen: false, battleSnapshot: null, departure, selectedKnightId: nextKnight });
    if (departure) window.setTimeout(() => play(departure!.fate === 'killed' ? 'kill' : 'retreat'), DEPART_MS / 2);
    if (departure) {
      if (departureTimer !== null) window.clearTimeout(departureTimer);
      departureTimer = window.setTimeout(() => {
        departureTimer = null;
        set({ departure: null });
        scheduleComputer();
      }, DEPART_MS);
    } else {
      scheduleComputer();
    }
  },

  confirmDefense: (amount) => {
    const duel = get().match.duel;
    if (!duel) return;
    if (amount > 0) {
      get().dispatch({ type: 'reinforceKnight', player: duel.defender.player, knightId: duel.defender.knightId, amount });
    }
    set({ defensePromptOpen: false, battleOpen: true, battleSnapshot: get().match });
  },

  dismissAnnouncement: () => {
    set({ announcement: null });
    scheduleComputer();
  },
  newMatch: () => {
    clearSequence();
    clearComputer();
    if (departureTimer !== null) window.clearTimeout(departureTimer);
    departureTimer = null;
    if (decisiveTimer !== null) window.clearTimeout(decisiveTimer);
    decisiveTimer = null;
    set({ match: createMatch(), ...freshScreenState });
  },
}));

/** Sounds for what just happened on the board (battles and dice play their own, in step with the screen). */
function playEventSounds(events: MatchEvent[]) {
  for (const e of events) {
    switch (e.type) {
      case 'captainDeployed':
        play('captain');
        break;
      case 'regionTaken':
        play(e.player === 'p1' ? 'secure' : 'retreat');
        if (e.captainId) window.setTimeout(() => play('captain'), 500);
        break;
      case 'captainResumed':
      case 'reserveSent':
      case 'knightSent':
        play('select');
        break;
      case 'knightPlaced':
      case 'knightMoved':
        play('place');
        break;
      case 'duelStarted':
        play('clash');
        break;
      case 'knightReinforced':
        play('heal');
        break;
      case 'turnStarted':
        play('turn-change');
        break;
      case 'regionSecured':
        play(e.player === 'p1' ? 'secure' : 'retreat');
        break;
      case 'matchWon':
        play(e.player === 'p1' ? 'victory' : 'defeat');
        break;
    }
  }
}

/** The computer rolls its own dice, one roll at a time, once the pre-battle window is closed. */
function scheduleComputerRoll() {
  if (decisiveTimer !== null) return;
  const { match, decisiveBegun } = useMatchStore.getState();
  if (!decisiveBegun || decisiveRoller(match) !== COMPUTER) return;
  decisiveTimer = window.setTimeout(() => {
    decisiveTimer = null;
    const store = useMatchStore.getState();
    if (store.decisiveBegun && decisiveRoller(store.match) === COMPUTER) {
      store.dispatch({ type: 'rollDie', player: COMPUTER, value: 1 + Math.floor(Math.random() * 6) });
    }
  }, DECISIVE_ROLL_MS);
}

/** Queue the computer's next step, if it isn't already queued. */
function scheduleComputer() {
  if (computerTimer !== null) return;
  computerTimer = window.setTimeout(() => {
    computerTimer = null;
    runComputerStep();
  }, COMPUTER_STEP_MS);
}

/**
 * One step of the computer's turn. It waits while anything is on screen for
 * the human (banner, end-of-turn sequence, battle, reinforcement prompt) and
 * is queued again whenever the game moves on.
 */
function runComputerStep() {
  const store = useMatchStore.getState();
  const { match, busy, announcement, battleOpen, defensePromptOpen, focusedRegion, departure, decisiveOpen, reports } = store;
  if (busy || announcement || battleOpen || defensePromptOpen || departure || decisiveOpen || reports.length > 0) return;

  if (match.phase === 'lordOrder') {
    if (match.orderingPlayer === COMPUTER) {
      store.dispatch({ type: 'setLordOrder', player: COMPUTER, order: chooseLordOrder() });
    }
    return;
  }

  // The computer won a Region on the human's turn (a beaten attacker retreated): station a Captain there.
  if (match.pendingStation?.player === COMPUTER) {
    const action = chooseStation(match, COMPUTER);
    if (action) store.dispatch(action);
    return;
  }

  const turn = match.turn;
  if (!turn || turn.player !== COMPUTER) return;
  if (match.duel && !match.duel.outcome) return;

  switch (turn.step) {
    case 'command': {
      const action = chooseCommand(match);
      if (!action) {
        store.requestEndTurn();
        return;
      }
      if (store.dispatch(action)) {
        const captain = useMatchStore.getState().match.captains[(action as { captainId: string }).captainId];
        if (captain?.region != null) store.focusRegion(captain.region);
      }
      return;
    }
    case 'orders': {
      const region = turn.captainId ? match.captains[turn.captainId]?.region : null;
      if (region != null && focusedRegion !== region) {
        store.focusRegion(region);
        scheduleComputer();
        return;
      }
      const action = chooseOrders(match);
      if (action?.type === 'endTurn') {
        store.requestEndTurn();
        return;
      }
      if (action && store.dispatch(action)) {
        if (action.type !== 'declareAttack') return;
        const state = useMatchStore.getState();
        if (state.match.duel?.outcome) {
          // Snipe or First Strike already decided it: straight to the battlefield.
          useMatchStore.setState({ battleOpen: true, battleSnapshot: state.match });
        } else {
          useMatchStore.setState({ defensePromptOpen: true });
        }
        return;
      }
      store.requestEndTurn();
      return;
    }
    case 'station': {
      const action = chooseStation(match, COMPUTER);
      if (action) store.dispatch(action);
      return;
    }
    case 'end':
      store.requestEndTurn();
      return;
  }
}

function screenUpdatesFor(state: MatchState, events: MatchEvent[]): Partial<MatchStore> {
  const updates: Partial<MatchStore> = {};
  for (const event of events) {
    switch (event.type) {
      case 'turnStarted': {
        const { type: _type, ...rest } = event;
        updates.announcement = { ...rest, task: commandSummary(state) };
        updates.focusedRegion = null;
        updates.selectedKnightId = null;
        // Pre-select the first Captain that can act, so one click on a Region is enough.
        updates.selectedCaptainId = actionableCaptains(state)[0]?.id ?? null;
        break;
      }
      case 'captainDeployed':
      case 'captainResumed':
        updates.selectedCaptainId = null;
        updates.selectedKnightId =
          reserveKnights(state, event.captainId)[0]?.id ?? attackers(state)[0]?.id ?? null;
        break;
      case 'knightPlaced':
        // Ready to attack with the new Knight if it has a target.
        updates.selectedKnightId = attackers(state).some((k) => k.id === event.knightId) ? event.knightId : null;
        break;
      case 'knightMoved':
        updates.selectedKnightId = null;
        break;
      case 'commandCancelled':
        // Back to choosing: out on the Region board with that Captain still picked.
        updates.focusedRegion = null;
        updates.selectedKnightId = null;
        updates.selectedCaptainId = event.captainId;
        break;
      case 'knightOrderUndone': {
        // Ready to try again: the Knight itself if it is waiting again (an undone
        // placement), otherwise a waiting Knight so placement squares show.
        const k = state.knights[event.knightId];
        const acting = actingCaptain(state);
        updates.selectedKnightId =
          k?.status === 'ready' ? k.id : acting ? (reserveKnights(state, acting.id)[0]?.id ?? event.knightId) : event.knightId;
        break;
      }
      case 'decisiveStarted':
        updates.decisiveOpen = true;
        updates.decisiveBegun = false;
        updates.focusedRegion = null;
        break;
    }
  }
  return updates;
}
