import type { LordClass, PlayerId } from '../../engine/state';
import { LORD_NAMES, LORD_PERSONAS } from '../../data/names';
import { Card, type CardSize } from './Card';
import './lordCard.css';

interface LordCardProps {
  lord: LordClass;
  owner: PlayerId;
  size?: CardSize;
  /** Turn-order position (1–3), shown as a badge. */
  position?: number;
  active?: boolean;
  /** Free Captains still waiting with this Lord. */
  captainsLeft?: number;
}

export function LordCard({ lord, owner, size = 'board', position, active, captainsLeft }: LordCardProps) {
  return (
    <div className={`lord-card${active ? ' lord-card--active' : ''}`}>
      <Card art={LORD_PERSONAS[lord].art} size={size} owner={owner} alt={`${LORD_PERSONAS[lord].name}, ${LORD_NAMES[lord]} Lord`}>
        {position !== undefined && <span className="lord-card__position">{position}</span>}
        <span className="lord-card__plate">
          {LORD_PERSONAS[lord].name}
          <span className="lord-card__class">{LORD_NAMES[lord]}</span>
          {captainsLeft !== undefined && (
            <span className="lord-card__captains">
              {captainsLeft === 0 ? 'All Captains in the field' : `${captainsLeft} Captain${captainsLeft === 1 ? '' : 's'} ready`}
            </span>
          )}
        </span>
      </Card>
    </div>
  );
}
