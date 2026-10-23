import type { ReactNode } from 'react';
import { artCatalog, type ArtId } from '../../data/artCatalog';
import './card.css';
import './tactics.css';

/**
 * Every card size in the game. All are 2:3: cards change size between views,
 * never shape.
 */
export const CARD_SIZES = {
  panel: { width: 80, height: 120 },
  company: { width: 96, height: 144 },
  roster: { width: 144, height: 216 },
  slot: { width: 148, height: 222 },
  board: { width: 160, height: 240 },
  field: { width: 168, height: 252 },
  detail: { width: 200, height: 300 },
  battle: { width: 320, height: 480 },
  inspect: { width: 400, height: 600 },
} as const;

export type CardSize = keyof typeof CARD_SIZES;
export type CardOwner = 'p1' | 'p2';

interface CardProps {
  art: ArtId;
  size: CardSize;
  /** Faction border and banner pin, since the frame color is baked into the art. */
  owner?: CardOwner;
  /** Game info drawn on top of the art: HP badges, highlights, states. */
  children?: ReactNode;
  alt?: string;
}

/**
 * The one way the game shows a card. When frames become modular later,
 * only this component changes.
 */
export function Card({ art, size, owner, children, alt = '' }: CardProps) {
  const { width, height } = CARD_SIZES[size];
  const classes = ['card', `card--${size}`, owner && `card--${owner}`].filter(Boolean).join(' ');

  return (
    <div className={classes} style={{ width, height }}>
      <img className="card__art" src={artCatalog[art].src} alt={alt} draggable={false} />
      {owner && <span className="card__pin" aria-hidden="true" />}
      {children && <div className="card__overlay">{children}</div>}
    </div>
  );
}
