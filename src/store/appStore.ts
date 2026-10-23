import { create } from 'zustand';

/** Which full-canvas screen is showing. Screen state only, never game rules. */
export type Screen = 'title' | 'mainMenu' | 'match';

interface AppState {
  screen: Screen;
  goTo: (screen: Screen) => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: 'title',
  goTo: (screen) => set({ screen }),
}));
