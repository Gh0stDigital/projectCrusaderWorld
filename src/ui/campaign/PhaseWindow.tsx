import { canEndTurn, deployableCaptains } from '../../engine/queries';
import type { MatchState } from '../../engine/state';
import { LORD_NAMES, captainName } from '../../data/names';
import './phaseWindow.css';

const PHASES = [
  { id: 'command', label: 'Command' },
  { id: 'placement', label: 'Placement' },
  { id: 'attack', label: 'Attack' },
  { id: 'battle', label: 'Battle' },
  { id: 'end', label: 'End' },
] as const;

interface PhaseWindowProps {
  match: MatchState;
  selectedCaptainId: string | null;
  error: string | null;
  onEndTurn: () => void;
}

export function PhaseWindow({ match, selectedCaptainId, error, onEndTurn }: PhaseWindowProps) {
  const turn = match.turn;
  const current = turn?.step ?? null;

  return (
    <footer className="phase-window">
      <ol className="phase-list">
        {PHASES.map((phase) => (
          <li key={phase.id} className={`phase-list__item${current === phase.id ? ' phase-list__item--current' : ''}`}>
            {phase.label}
          </li>
        ))}
      </ol>

      <div className="phase-window__orders">
        <p className="phase-window__instruction">{instructionFor(match, selectedCaptainId)}</p>
        {error && <p className="phase-window__error">{error}</p>}
      </div>

      {turn && (
        <button
          className={`btn phase-window__end-turn${canEndTurn(match) ? ' btn--primary' : ''}`}
          onClick={onEndTurn}
        >
          End turn
        </button>
      )}
    </footer>
  );
}

function instructionFor(match: MatchState, selectedCaptainId: string | null): string {
  const turn = match.turn;
  if (!turn) return 'Each player places their Lords in turn order.';
  if (turn.step === 'end') return 'Captain deployed. Press End turn when ready.';
  if (deployableCaptains(match).length === 0) {
    return `Both ${LORD_NAMES[turn.lord]} Captains are already in the field. Press End turn.`;
  }
  const selected = selectedCaptainId ? match.captains[selectedCaptainId] : undefined;
  if (!selected) return `Choose a ${LORD_NAMES[turn.lord]} Captain to deploy.`;
  return `Choose a Region for ${captainName(selected.lord, selected.rank)}.`;
}
