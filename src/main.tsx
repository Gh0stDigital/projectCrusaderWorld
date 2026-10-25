import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/theme.css';
import { useMatchStore } from './store/matchStore';

// Development only: lets test scripts inspect and set up match state.
if (import.meta.env.DEV) (window as unknown as { __matchStore: typeof useMatchStore }).__matchStore = useMatchStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
