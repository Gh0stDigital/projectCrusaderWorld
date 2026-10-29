import { ResourceBars } from './ResourceBars';
import { actingCaptain, canEndTurn, canUndoCommand, canUndoKnight, isStationed } from '../../engine/queries';
import type { MatchState, RegionIndex } from '../../engine/state';
import { REGION_NAMES } from '../../data/names';
import './phaseWindow.css';

interface PhaseWindowProps {
  match: MatchState;
  focusedRegion: RegionIndex | null;
  busy: boolean;
  battleOpen: boolean;
  /** A defeated Knight is leaving the board; End turn waits for it. */
  departing?: boolean;
  onEnterRegion: (region: RegionIndex) => void;
  onEndTurn: () => void;
  /** Take back this turn's placement or move. */
  onUndo: () => void;
  /** Take back this turn's Captain deployment (or Captain choice). */
  onUndoCommand: () => void;
}

export function PhaseWindow({
  match,
  focusedRegion,
  busy,
  battleOpen,
  departing = false,
  onEnterRegion,
  onEndTurn,
  onUndo,
  onUndoCommand,
}: PhaseWindowProps) {
  const turn = match.turn;
  const captain = actingCaptain(match);
  // A stationed Captain's orders window has its own cancel button.
  const isStationedTurn = captain !== null && isStationed(match, captain);
  const enterTarget =
    turn && turn.step !== 'command' && !battleOpen && captain?.region != null && focusedRegion !== captain.region
      ? captain.region
      : null;
  return (
    <footer className="phase-window">
      <ResourceBars match={match} />

      {turn && turn.player === 'p1' && !busy && !battleOpen && !departing && (
        <div className="phase-window__buttons">
          {canUndoKnight(match) && (
            <button className="btn" onClick={onUndo}>
              {turn.movedKnightId ? 'Undo move' : 'Undo placement'}
            </button>
          )}
          {canUndoCommand(match) && !isStationedTurn && (
            <button className="btn" data-sound="cancel" onClick={onUndoCommand}>
              {turn.commandUndo ? 'Undo deployment' : 'Choose another Captain'}
            </button>
          )}
          {enterTarget !== null && (
            <button
              className={`btn${turn.step === 'orders' && !canEndTurn(match) ? ' btn--primary' : ''}`}
              onClick={() => onEnterRegion(enterTarget)}
            >
              {turn.step === 'orders' && !canEndTurn(match) ? `Enter ${REGION_NAMES[enterTarget]}` : `Return to ${REGION_NAMES[enterTarget]}`}
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
