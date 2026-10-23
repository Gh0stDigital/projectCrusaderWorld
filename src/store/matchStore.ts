import { create } from 'zustand';
import type { MatchAction } from '../engine/actions';
import type { MatchEvent } from '../engine/events';
import { applyAction } from '../engine/match';
import { deployableCaptains } from '../engine/queries';
import { createMatch } from '../engine/setup';
import type { LordClass, MatchState, PlayerId } from '../engine/state';

export interface TurnAnnouncement {
  player: PlayerId;
  lord: LordClass;
  turnNumber: number;
  canDeploy: boolean;
}

interface MatchStore {
  /** Game state: owned by the engine, only changed through dispatch. */
  match: MatchState;
  /** Screen state: selection, messages, overlays. Never affects the rules. */
  selectedCaptainId: string | null;
  error: string | null;
  announcement: TurnAnnouncement | null;

  dispatch: (action: MatchAction) => boolean;
  selectCaptain: (id: string | null) => void;
  dismissAnnouncement: () => void;
  newMatch: () => void;
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  match: createMatch(),
  selectedCaptainId: null,
  error: null,
  announcement: null,

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
  dismissAnnouncement: () => set({ announcement: null }),
  newMatch: () => set({ match: createMatch(), selectedCaptainId: null, error: null, announcement: null }),
}));

function screenUpdatesFor(state: MatchState, events: MatchEvent[]): Partial<MatchStore> {
  const updates: Partial<MatchStore> = {};
  for (const event of events) {
    if (event.type === 'captainDeployed') updates.selectedCaptainId = null;
    if (event.type === 'turnStarted') {
      const { type: _type, ...announcement } = event;
      updates.announcement = announcement;
      // Pre-select the first available Captain so a single click on a Region deploys it.
      updates.selectedCaptainId = deployableCaptains(state)[0]?.id ?? null;
    }
  }
  return updates;
}
