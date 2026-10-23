import { useEffect } from 'react';
import type { TurnAnnouncement as Announcement } from '../../store/matchStore';
import { LORD_TITLES, PLAYER_NAMES } from '../../data/names';
import './turnAnnouncement.css';

const SHOW_FOR_MS = 1800;

/** Slides into the center of the board stage when a turn starts. Click to dismiss early. */
export function TurnAnnouncement({ announcement, onDone }: { announcement: Announcement; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, SHOW_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [announcement, onDone]);

  const { player, lord, turnNumber, canDeploy } = announcement;

  return (
    <button className="turn-announcement" onClick={onDone}>
      <div className={`turn-announcement__banner turn-announcement__banner--${player}`}>
        <span className="turn-announcement__turn">Turn {turnNumber}</span>
        <span className="turn-announcement__player">{PLAYER_NAMES[player]}</span>
        <span className="turn-announcement__lord">{LORD_TITLES[lord]}</span>
        <span className="turn-announcement__task">
          {canDeploy ? 'Deploy a Captain to any Region' : 'All of this Lord’s Captains are in the field'}
        </span>
      </div>
    </button>
  );
}
