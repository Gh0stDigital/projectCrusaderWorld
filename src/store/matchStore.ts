import { create } from 'zustand';
import type { MatchAction } from '../engine/actions';
import type { MatchEvent } from '../engine/events';
import { applyAction } from '../engine/match';
import { actionableCaptains, canEndTurn, reserveKnights } from '../engine/queries';
import { createMatch } from '../engine/setup';
import type { LordClass, MatchState, PlayerId, RegionIndex } from '../engine/state';

export interface TurnAnnouncement {
  player: PlayerId;
  lord: LordClass;
  turnNumber: number;
  canAct: boolean;
}

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
  /** "Orders complete" confirmation shown at the end of a turn. */
  notice: { player: PlayerId } | null;
  error: string | null;
  announcement: TurnAnnouncement | null;

  dispatch: (action: MatchAction) => boolean;
  selectCaptain: (id: string | null) => void;
  selectKnight: (id: string | null) => void;
  focusRegion: (region: RegionIndex | null) => void;
  requestEndTurn: () => void;
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
};

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
    const { match, busy, focusedRegion } = get();
    const turn = match.turn;
    if (busy || !turn) return;
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

  dismissAnnouncement: () => set({ announcement: null }),
  newMatch: () => {
    clearSequence();
    set({ match: createMatch(), ...freshScreenState });
  },
}));

function screenUpdatesFor(state: MatchState, events: MatchEvent[]): Partial<MatchStore> {
  const updates: Partial<MatchStore> = {};
  for (const event of events) {
    switch (event.type) {
      case 'turnStarted': {
        const { type: _type, ...announcement } = event;
        updates.announcement = announcement;
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
