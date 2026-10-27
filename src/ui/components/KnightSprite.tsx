import type { CSSProperties } from 'react';
import type { PlayerId } from '../../engine/state';
import knightSprite from '../../assets/sprites/knight-sprite.png';
import enemyKnightSprite from '../../assets/sprites/enemy-knight-sprite.png';
import './knightSprite.css';

/** Each sprite sheet is two 276×261 frames side by side. */
const FRAME_RATIO = 261 / 276;

interface KnightSpriteProps {
  owner: PlayerId;
  /** Width in canvas pixels; height follows the frame's shape. */
  width: number;
  /** Idle animation: switches between the two frames once per second. */
  animate?: boolean;
  title?: string;
}

/** Pixel-art Knight piece: blue for Player 1, red (mirrored) for the enemy. */
export function KnightSprite({ owner, width, animate = false, title }: KnightSpriteProps) {
  const style = {
    '--sprite-w': `${width}px`,
    width,
    height: Math.round(width * FRAME_RATIO),
    backgroundImage: `url(${owner === 'p1' ? knightSprite : enemyKnightSprite})`,
  } as CSSProperties;
  return (
    <span
      className={`knight-sprite${animate ? ' knight-sprite--animate' : ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
