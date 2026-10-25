import { create } from 'zustand';
import type { MatchAction } from '../engine/actions';
import type { MatchEvent } from '../engine/events';
import { applyAction } from '../engine/match';
import { chooseAttack, chooseCommand, chooseLordOrder, choosePlacement, chooseSergeant } from '../ai';
import { commandSummary } from '../ui/campaign/commandText';
import { actionableCaptains, canEndTurn, reserveKnights } from '../engine/queries';
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
  departure: null,
};

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
    set({ match: result.state, error: null, ...screenUpdatesFor(result.state, result.events) });
    // The computer picks Player 2's Sergeants in a duel, whether attacking or
    // defending. It commits before the human picks and never sees their choice.
    if (result.events.some((e) => e.type === 'duelStarted' || e.type === 'clashResolved')) {
      const duel = result.state.duel;
      if (duel && !duel.outcome) {
        const reply = chooseSergeant(result.state, COMPUTER);
        if (reply) get().dispatch(reply);
      }
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
    const { match, busy, focusedRegion, battleOpen, departure } = get();
    const turn = match.turn;
    if (busy || battleOpen || departure || !turn) return;
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
    const { match, attackPreviewId } = get();
    if (!match.turn || !attackPreviewId) return;
    set({ attackPreviewId: null });
    const before = get().match;
    if (get().dispatch({ type: 'declareAttack', player: match.turn.player, targetKnightId: attackPreviewId })) {
      set({ battleOpen: true, battleSnapshot: before });
    }
  },

  closeBattle: () => {
    // The loser's piece stays on its old square for a moment, then retreats or is destroyed.
    const { match, battleSnapshot } = get();
    const duel = match.duel;
    let departure: Departure | null = null;
    if (duel?.outcome?.winner && duel.outcome.loserFate) {
      const loserRole = duel.outcome.winner === 'attacker' ? 'defender' : 'attacker';
      const loserId = duel[loserRole].knightId;
      const before = (battleSnapshot ?? match).knights[loserId];
      if (before?.position) {
        departure = {
          knightId: loserId,
          owner: before.owner,
          region: before.position.region,
          square: before.position.square,
          fate: duel.outcome.loserFate,
        };
      }
    }
    set({ battleOpen: false, battleSnapshot: null, departure });
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
    set({ match: createMatch(), ...freshScreenState });
  },
}));

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
  const { match, busy, announcement, battleOpen, defensePromptOpen, focusedRegion, departure } = store;
  if (busy || announcement || battleOpen || defensePromptOpen || departure) return;

  if (match.phase === 'lordOrder') {
    if (match.orderingPlayer === COMPUTER) {
      store.dispatch({ type: 'setLordOrder', player: COMPUTER, order: chooseLordOrder() });
    }
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
    case 'placement': {
      const region = turn.captainId ? match.captains[turn.captainId]?.region : null;
      if (region != null && focusedRegion !== region) {
        store.focusRegion(region);
        scheduleComputer();
        return;
      }
      const action = choosePlacement(match);
      if (action) store.dispatch(action);
      return;
    }
    case 'attack': {
      const action = chooseAttack(match);
      if (action && store.dispatch(action)) {
        useMatchStore.setState({ defensePromptOpen: true });
        return;
      }
      store.requestEndTurn();
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
        updates.selectedKnightId = reserveKnights(state, event.captainId)[0]?.id ?? null;
        break;
      case 'knightPlaced':
        updates.selectedKnightId = null;
        break;
    }
  }
  return updates;
}
