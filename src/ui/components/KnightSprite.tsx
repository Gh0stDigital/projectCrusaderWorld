import type { CSSProperties } from 'react';
import type { PlayerId } from '../../engine/state';
import knightSprite from '../../assets/sprites/knight-sprite.png';
import enemyKnightSprite from '../../assets/sprites/enemy-knight-sprite.png';
import knightBoardSprite from '../../assets/sprites/knight-board-sprite.png';
import enemyKnightBoardSprite from '../../assets/sprites/enemy-knight-board-sprite.png';
import './knightSprite.css';

/** The icon sprite sheet is two 176×165 frames side by side. */
const FRAME_RATIO = 165 / 176;
/** The board pieces' own sprite: two 500×501 frames. */
const BOARD_FRAME_RATIO = 501 / 500;

interface KnightSpriteProps {
  owner: PlayerId;
  /** Width in canvas pixels; height follows the frame's shape. */
  width: number;
  /** Idle animation: switches between the two frames once per second. */
  animate?: boolean;
  title?: string;
  /** 'board' for pieces on a Region's board (their own sprite); 'icon' for the Knight list. */
  variant?: 'icon' | 'board';
}

/** Pixel-art Knight piece: blue for Player 1, red (mirrored) for the enemy. */
export function KnightSprite({ owner, width, animate = false, title, variant = 'icon' }: KnightSpriteProps) {
  const board = variant === 'board';
  const style = {
    '--sprite-w': `${width}px`,
    width,
    height: Math.round(width * (board ? BOARD_FRAME_RATIO : FRAME_RATIO)),
    backgroundImage: `url(${board ? (owner === 'p1' ? knightBoardSprite : enemyKnightBoardSprite) : owner === 'p1' ? knightSprite : enemyKnightSprite})`,
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
