import type { Tactic } from '../../engine/state';
import { TACTIC_NAMES } from '../../data/names';
import { TacticIcon } from './TacticIcon';
import './tactics.css';

export type SergeantBoxState = 'ready' | 'used' | 'lost' | 'chosen';

interface SergeantBoxProps {
  tactic: Tactic;
  /** Men under the Sergeant: the damage they deal when their tactic wins. */
  militia: number;
  state?: SergeantBoxState;
  onPick?: () => void;
  compact?: boolean;
}

/** One Sergeant: their tactic icon and how many men they lead. */
export function SergeantBox({ tactic, militia, state = 'ready', onPick, compact }: SergeantBoxProps) {
  const classes = [
    'sergeant-box',
    `sergeant-box--${tactic}`,
    `sergeant-box--${state}`,
    onPick && 'sergeant-box--pickable',
    compact && 'sergeant-box--compact',
  ]
    .filter(Boolean)
    .join(' ');
  const label = `${TACTIC_NAMES[tactic]} Sergeant, ${militia} men${state === 'lost' ? ', lost' : state === 'used' ? ', already fought' : ''}`;
  const content = (
    <>
      <TacticIcon tactic={tactic} size={compact ? 20 : 28} />
      <span className="sergeant-box__militia">{state === 'lost' ? '✕' : militia}</span>
      {!compact && <span className="sergeant-box__tactic">{TACTIC_NAMES[tactic]}</span>}
    </>
  );
  return onPick ? (
    <button className={classes} onClick={onPick} aria-label={label}>
      {content}
    </button>
  ) : (
    <span className={classes} aria-label={label} role="img">
      {content}
    </span>
  );
}

/** "Rush › Flank › Counter › Rush": who beats whom. */
export function TacticLegend() {
  return (
    <span className="tactic-legend" aria-label="Rush beats Flank, Flank beats Counter, Counter beats Rush">
      {(['rush', 'flank', 'counter', 'rush'] as Tactic[]).map((t, i) => (
        <span key={i} className="tactic-legend__step">
          {i > 0 && <span className="tactic-legend__beats">beats</span>}
          <span className={`tactic-legend__tactic tactic-legend__tactic--${t}`}>
            <TacticIcon tactic={t} size={18} />
            {TACTIC_NAMES[t]}
          </span>
        </span>
      ))}
    </span>
  );
}
