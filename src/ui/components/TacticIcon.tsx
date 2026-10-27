import type { ReactNode } from 'react';
import type { Tactic } from '../../engine/state';
import { TACTIC_NAMES } from '../../data/names';
import './tactics.css';

/**
 * Rock, paper, scissors, matching who beats whom:
 * Rush (rock) beats Flank (scissors), Flank beats Counter (paper), Counter beats Rush.
 */
const SHAPES: Record<Tactic, ReactNode> = {
  // Rock: a faceted stone.
  rush: (
    <>
      <path d="M2.5 16.5l2.5-8 6-5 6.5 1.5 4.5 6.5-1 7-6 3.5h-7.5z" fill="currentColor" />
      <path d="M11 3.5l-.5 6 4 2.5 6-1.5M10.5 9.5L5 8.5M14.5 12l-1.5 8.5" stroke="var(--tactic-ink)" strokeWidth={1.3} />
    </>
  ),
  // Scissors: two handles and crossed blades.
  flank: (
    <>
      <circle cx={7} cy={17.5} r={3} />
      <circle cx={17} cy={17.5} r={3} />
      <path d="M9.2 15.4L18 3.5M14.8 15.4L6 3.5" />
    </>
  ),
  // Paper: a sheet with a folded corner and writing.
  counter: (
    <>
      <path d="M5.5 2.5h9l4 4v15h-13z" fill="currentColor" fillOpacity={0.25} />
      <path d="M14.5 2.5v4h4M8.5 11h7M8.5 14.5h7M8.5 18h4.5" />
    </>
  ),
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
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={TACTIC_NAMES[tactic]}
    >
      {SHAPES[tactic]}
    </svg>
  );
}
