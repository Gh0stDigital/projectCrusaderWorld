import { create } from 'zustand';
import { musicUrl, playMusic } from '../audio/sound';

/** Which full-canvas screen is showing. Screen state only, never game rules. */
export type Screen = 'loading' | 'title' | 'mainMenu' | 'match';

/** Full-screen fade to and from black between screens. */
export type Fade = 'none' | 'out' | 'black' | 'in';

/** Fade timings, in milliseconds. */
export const FADE_MS = 1400;
const HOLD_MS = 1000;

interface AppState {
  screen: Screen;
  fade: Fade;
  goTo: (screen: Screen) => void;
  /**
   * Start a match: fade slowly to black, wait a second, start the battle
   * theme, wait another second, then fade slowly back in on the match.
   */
  startMatch: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'loading',
  fade: 'none',
  goTo: (screen) => set({ screen }),
  startMatch: () => {
    if (get().fade !== 'none') return;
    set({ fade: 'out' });
    window.setTimeout(() => {
      set({ screen: 'match', fade: 'black' });
      window.setTimeout(() => {
        const theme = musicUrl('battle-theme');
        if (theme) playMusic(theme);
        window.setTimeout(() => {
          set({ fade: 'in' });
          window.setTimeout(() => set({ fade: 'none' }), FADE_MS);
        }, HOLD_MS);
      }, HOLD_MS);
    }, FADE_MS);
  },
}));
