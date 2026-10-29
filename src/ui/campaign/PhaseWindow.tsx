import { ResourceBars } from './ResourceBars';
import { canEndTurn } from '../../engine/queries';
import type { MatchState } from '../../engine/state';
import hudAvatar from '../../assets/ui/hud-avatar.webp';
import enemyHudAvatar from '../../assets/ui/enemy-hud-avatar.webp';
import './phaseWindow.css';

interface PhaseWindowProps {
  match: MatchState;
  busy: boolean;
  battleOpen: boolean;
  /** A defeated Knight is leaving the board; End turn waits for it. */
  departing?: boolean;
  onEndTurn: () => void;
}

export function PhaseWindow({
  match,
  busy,
  battleOpen,
  departing = false,
  onEndTurn,
}: PhaseWindowProps) {
  const turn = match.turn;
  return (
    <footer className="phase-window">
      {/* Each side's god sits behind its end of the bars, rising a little above the bar. */}
      <img className="hud-avatar hud-avatar--p1" src={hudAvatar} alt="" aria-hidden="true" />
      <img className="hud-avatar hud-avatar--p2" src={enemyHudAvatar} alt="" aria-hidden="true" />
      <ResourceBars match={match} />

      {turn && turn.player === 'p1' && !busy && !battleOpen && !departing && (
        <div className="phase-window__buttons">
          {/* Only once the turn can end: the End step is lit in the turn strip. */}
          {canEndTurn(match) && (
            <button className="btn phase-window__end-turn btn--primary" onClick={onEndTurn}>
              End turn
            </button>
          )}
        </div>
      )}
    </footer>
  );
}
