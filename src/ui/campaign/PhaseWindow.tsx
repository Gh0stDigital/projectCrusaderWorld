import { actingCaptain, actionableCaptains, canEndTurn } from '../../engine/queries';
import type { MatchState, RegionIndex } from '../../engine/state';
import { LORD_NAMES, REGION_NAMES, captainName } from '../../data/names';
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
  focusedRegion: RegionIndex | null;
  busy: boolean;
  error: string | null;
  onEnterRegion: (region: RegionIndex) => void;
  onEndTurn: () => void;
}

export function PhaseWindow({ match, selectedCaptainId, focusedRegion, busy, error, onEnterRegion, onEndTurn }: PhaseWindowProps) {
  const turn = match.turn;
  const captain = actingCaptain(match);
  const enterTarget =
    turn && turn.step !== 'command' && captain?.region != null && focusedRegion !== captain.region ? captain.region : null;

  return (
    <footer className="phase-window">
      <ol className="phase-list">
        {PHASES.map((phase) => (
          <li key={phase.id} className={`phase-list__item${turn?.step === phase.id ? ' phase-list__item--current' : ''}`}>
            {phase.label}
          </li>
        ))}
      </ol>

      <div className="phase-window__orders">
        <p className="phase-window__instruction">
          {busy ? 'Orders complete.' : instructionFor(match, selectedCaptainId, focusedRegion)}
        </p>
        {error && !busy && <p className="phase-window__error">{error}</p>}
      </div>

      {turn && !busy && (
        <div className="phase-window__buttons">
          {enterTarget !== null && (
            <button
              className={`btn${turn.step === 'placement' ? ' btn--primary' : ''}`}
              onClick={() => onEnterRegion(enterTarget)}
            >
              {turn.step === 'placement' ? `Enter ${REGION_NAMES[enterTarget]}` : `Return to ${REGION_NAMES[enterTarget]}`}
            </button>
          )}
          <button className={`btn phase-window__end-turn${canEndTurn(match) ? ' btn--primary' : ''}`} onClick={onEndTurn}>
            End turn
          </button>
        </div>
      )}
    </footer>
  );
}

function instructionFor(match: MatchState, selectedCaptainId: string | null, focusedRegion: RegionIndex | null): string {
  const turn = match.turn;
  if (!turn) return 'Each player places their Lords in turn order.';
  const lordName = LORD_NAMES[turn.lord];

  if (turn.step === 'command') {
    if (actionableCaptains(match).length === 0) return `No ${lordName} Captain can act this turn. Press End turn.`;
    const selected = selectedCaptainId ? match.captains[selectedCaptainId] : undefined;
    if (!selected) return `Choose a ${lordName} Captain.`;
    const name = captainName(selected.lord, selected.rank);
    return selected.region === null
      ? `Choose a Region to deploy ${name}.`
      : `Click ${REGION_NAMES[selected.region]} to give ${name} new orders.`;
  }

  const captain = actingCaptain(match);
  const where = captain?.region != null ? REGION_NAMES[captain.region] : 'the Region';
  if (turn.step === 'placement') {
    return focusedRegion === captain?.region
      ? 'Choose a Knight, then an empty square.'
      : `Enter ${where} to place a Knight.`;
  }
  return 'Knight placed. Press End turn when ready.';
}
