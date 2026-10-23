import { artCatalog, type ArtId } from '../../data/artCatalog';
import type { CardOwner } from './Card';
import './portrait.css';

interface PortraitProps {
  art: ArtId;
  /** Square edge length in canvas pixels. */
  size: number;
  owner?: CardOwner;
  title?: string;
}

/** A square face crop of a card's art, for small markers where a whole card won't fit. */
export function Portrait({ art, size, owner, title }: PortraitProps) {
  const { src, face } = artCatalog[art];
  return (
    <span
      className={`portrait${owner ? ` portrait--${owner}` : ''}`}
      title={title}
      role={title ? 'img' : undefined}
      aria-label={title}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${src})`,
        backgroundSize: `${face.zoom * 100}% auto`,
        backgroundPosition: `${face.x}% ${face.y}%`,
      }}
    />
  );
}
