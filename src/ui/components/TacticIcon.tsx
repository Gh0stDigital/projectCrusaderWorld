import type { Tactic } from '../../engine/state';
import { TACTIC_NAMES } from '../../data/names';
import './tactics.css';

/** Simple line icons: Rush is a charge, Flank goes around, Counter is a shield. */
const PATHS: Record<Tactic, string[]> = {
  rush: ['M4 6l6 6-6 6', 'M12 6l6 6-6 6'],
  flank: ['M5 19c0-7.5 4.5-12 11.5-12', 'M13 3.5l4 3.5-4 3.5'],
  counter: ['M12 3l7.5 3v5.5c0 4.8-3.3 8.3-7.5 9.5-4.2-1.2-7.5-4.7-7.5-9.5V6z', 'M12 7.5v9'],
};

export function TacticIcon({ tactic, size = 24 }: { tactic: Tactic; size?: number }) {
  return (
    <svg
      className={`tactic-icon tactic-icon--${tactic}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={TACTIC_NAMES[tactic]}
    >
      {PATHS[tactic].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
