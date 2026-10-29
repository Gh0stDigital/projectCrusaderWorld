import { ResourceBars } from './ResourceBars';
import { actingCaptain, canEndTurn, canUndoCommand, isStationed } from '../../engine/queries';
import type { MatchState } from '../../engine/state';
import './phaseWindow.css';

interface PhaseWindowProps {
  match: MatchState;
  busy: boolean;
  battleOpen: boolean;
  /** A defeated Knight is leaving the board; End turn waits for it. */
  departing?: boolean;
  onEndTurn: () => void;
  /** Take back this turn's Captain deployment (or Captain choice). */
  onUndoCommand: () => void;
}

export function PhaseWindow({
  match,
  busy,
  battleOpen,
  departing = false,
  onEndTurn,
  onUndoCommand,
}: PhaseWindowProps) {
  const turn = match.turn;
  const captain = actingCaptain(match);
  // A stationed Captain's orders window has its own cancel button.
  const isStationedTurn = captain !== null && isStationed(match, captain);
  return (
    <footer className="phase-window">
      <ResourceBars match={match} />

      {turn && turn.player === 'p1' && !busy && !battleOpen && !departing && (
        <div className="phase-window__buttons">
          {canUndoCommand(match) && !isStationedTurn && (
            <button className="btn" data-sound="cancel" onClick={onUndoCommand}>
              {turn.commandUndo ? 'Undo deployment' : 'Choose another Captain'}
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
