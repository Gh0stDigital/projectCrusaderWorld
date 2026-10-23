import { LORD_CLASSES, type LordClass, type PlayerId } from '../../engine/state';
import { LORD_TITLES, PLAYER_NAMES } from '../../data/names';
import { LordCard } from '../components/LordCard';
import './lordOrderSetup.css';

interface LordOrderSetupProps {
  player: PlayerId;
  draft: LordClass[];
  onAdd: (lord: LordClass) => void;
  onConfirm: () => void;
  onReset: () => void;
}

/** Shown over the Region board while a player places their Lords in turn order. */
export function LordOrderSetup({ player, draft, onAdd, onConfirm, onReset }: LordOrderSetupProps) {
  const remaining = LORD_CLASSES.filter((lord) => !draft.includes(lord));
  const complete = remaining.length === 0;

  return (
    <div className={`lord-setup lord-setup--${player}`}>
      <h2 className="lord-setup__title">{PLAYER_NAMES[player]}: order your Lords</h2>
      <p className="lord-setup__hint">
        {complete
          ? 'Your Lords will take their turns in this order.'
          : `Choose which Lord takes turn ${draft.length + 1}. Click a placed Lord to take it back.`}
      </p>

      <div className="lord-setup__tray">
        {remaining.map((lord) => (
          <button key={lord} className="lord-setup__choice" onClick={() => onAdd(lord)}>
            <LordCard lord={lord} owner={player} />
            <span className="lord-setup__choice-title">{LORD_TITLES[lord]}</span>
          </button>
        ))}
        {complete && <p className="lord-setup__done">All three Lords are in position.</p>}
      </div>

      <div className="lord-setup__actions">
        <button className="btn" onClick={onReset} disabled={draft.length === 0}>
          Start over
        </button>
        <button className="btn btn--primary" onClick={onConfirm} disabled={!complete}>
          Confirm order
        </button>
      </div>
    </div>
  );
}
