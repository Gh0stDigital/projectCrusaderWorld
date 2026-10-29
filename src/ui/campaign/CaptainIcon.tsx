import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { captainMilitia, knightsOf } from '../../engine/queries';
import type { Captain, MatchState } from '../../engine/state';
import { REGION_NAMES, SUBCLASS_SHORT, captainArt, captainName, captainPersonalName, knightPersonalName, lordPersona } from '../../data/names';
import { FitText } from '../components/FitText';
import { Card } from '../components/Card';
import { Portrait } from '../components/Portrait';
import './captainIcon.css';

export type CaptainStatus = 'standby' | 'deployed' | 'stationed' | 'dead';

const STATUS_LABEL: Record<CaptainStatus, string> = {
  standby: 'Standby',
  deployed: 'Deployed',
  stationed: 'Stationed',
  dead: 'Dead',
};

/**
 * Display status of a Captain:
 * - dead: fell when their Region was lost with no men left, or has no living Knights and no reserve
 * - stationed: holds a Region they secured
 * - deployed: in a Region still being fought over
 * - standby: waiting with their Lord
 */
export function captainStatus(match: MatchState, captain: Captain): CaptainStatus {
  if (captain.fallen) return 'dead';
  const staffed = knightsOf(match, captain.id).filter((k) => k.status !== 'unmanned');
  const noKnights = staffed.length > 0 && staffed.every((k) => k.status === 'dead' || k.status === 'captured');
  if (noKnights && captain.reserve === 0) return 'dead';
  if (captain.region !== null && match.secured[captain.region]?.captainId === captain.id) return 'stationed';
  if (captain.region !== null) return 'deployed';
  return 'standby';
}

const HOLD_MS = 350;

interface CaptainIconProps {
  match: MatchState;
  captain: Captain;
  pickable: boolean;
  selected: boolean;
  onPick: () => void;
}

/**
 * A Captain as a small icon with a status ribbon. Click to choose them (when
 * allowed); press and hold to see their details.
 */
export function CaptainIcon({ match, captain, pickable, selected, onPick }: CaptainIconProps) {
  const status = captainStatus(match, captain);
  const [open, setOpen] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);
  const held = useRef(false);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const start = () => {
    held.current = false;
    clear();
    timer.current = window.setTimeout(() => {
      held.current = true;
      // Place the details next to the icon, in canvas pixels (the canvas may be scaled).
      const root = buttonRef.current?.closest('.match') as HTMLElement | null;
      const btn = buttonRef.current;
      if (!root || !btn) return;
      const r = root.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      const k = root.offsetWidth / r.width;
      const x = captain.owner === 'p1' ? (b.right - r.left) * k + 12 : (b.left - r.left) * k - 12 - 400;
      const y = Math.min((b.top - r.top) * k - 10, root.offsetHeight - 330);
      setOpen({ x, y });
    }, HOLD_MS);
  };
  const end = () => {
    clear();
    setOpen(null);
  };

  const classes = [
    'captain-icon',
    `captain-icon--${status}`,
    `captain-icon--${captain.owner}`,
    pickable && 'captain-icon--pickable',
    selected && 'captain-icon--selected',
    selected && pickable && 'captain-icon--playable',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className="captain-icon__item">
      <button
        ref={buttonRef}
        className={classes}
        onPointerDown={start}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          if (pickable) onPick();
        }}
        aria-label={`${captainName(captain)}: ${STATUS_LABEL[status]}. Press and hold for details.`}
      >
        <Portrait art={captainArt(captain.owner, captain.lord)} size={64} owner={captain.owner} />
        <span className="captain-icon__status">{STATUS_LABEL[status]}</span>
      </button>
      <FitText className="captain-icon__name" text={captainPersonalName(captain)} size={10} />
      {open &&
        buttonRef.current?.closest('.match') &&
        createPortal(
          <CaptainDetails match={match} captain={captain} status={status} at={open} />,
          buttonRef.current.closest('.match')!,
        )}
    </li>
  );
}

function CaptainDetails({
  match,
  captain,
  status,
  at,
}: {
  match: MatchState;
  captain: Captain;
  status: CaptainStatus;
  at: { x: number; y: number };
}) {
  const knights = knightsOf(match, captain.id).filter((k) => k.status !== 'unmanned');
  return (
    <div className={`captain-details captain-details--${captain.owner}`} role="tooltip" style={{ left: at.x, top: at.y }}>
      <Card art={captainArt(captain.owner, captain.lord)} size="roster" owner={captain.owner} />
      <div className="captain-details__info">
        <h3 className="captain-details__name">{captainName(captain)}</h3>
        <p className="captain-details__line">Serves {lordPersona(captain.owner, captain.lord).name}</p>
        <p className={`captain-details__status captain-details__status--${status}`}>{STATUS_LABEL[status]}</p>
        <p className="captain-details__line">
          {captain.region !== null ? REGION_NAMES[captain.region] : 'With their Lord'}
        </p>
        <p className="captain-details__line">Troops {captainMilitia(match, captain.id)}</p>
        <p className="captain-details__line">Reserve {captain.reserve}</p>
        <ul className="captain-details__knights">
          {knights.map((k) => (
            <li key={k.id} className={`captain-details__knight captain-details__knight--${k.status}`}>
              <span>
                {knightPersonalName(k)}
                {k.subclass ? ` (${SUBCLASS_SHORT[k.subclass]})` : ''}
              </span>
              <span>{k.status === 'dead' ? 'Fallen' : k.status === 'captured' ? 'Captured' : `${k.hp} HP`}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
