import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/theme.css';
import { useMatchStore } from './store/matchStore';
import { unlockOnFirstInput } from './audio/sound';

unlockOnFirstInput();

// Development only: lets test scripts inspect and set up match state.
if (import.meta.env.DEV) (window as unknown as { __matchStore: typeof useMatchStore }).__matchStore = useMatchStore;

// Built game only: cache every file the game loads so later visits work offline
// and load from disk. (The dev server is left alone so live reloading works.)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
