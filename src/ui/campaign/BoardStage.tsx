import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { RegionIndex } from '../../engine/state';
import { REGION_BOARD_SIZE, REGION_GAP, REGION_TILE } from './RegionBoard';
import './boardStage.css';

const STAGE_WIDTH = 1120;
/** The map's own layout height (its art and squares are placed for 1120x834). */
const STAGE_HEIGHT = 834;
/** The board area's height on screen (the middle row of the match grid). */
const AREA_HEIGHT = 854;

interface BoardStageProps {
  /** The Region the camera is zoomed into, or null for the whole Region board. */
  focusedRegion: RegionIndex | null;
  regionBoard: ReactNode;
  /** Renders the zoomed-in view of a Region. */
  renderRegion: (region: RegionIndex) => ReactNode;
  overlays?: ReactNode;
  /** A strip across the top (the turn's steps); the map is scaled down to sit under it. */
  header?: ReactNode;
}

/** Height of the header strip; the map shrinks to fit the rest. */
const HEADER_HEIGHT = 40;
/** Breathing room between the map's bottom row and the bottom bar. */
const BOTTOM_GAP = 24;
const MAP_SCALE = (AREA_HEIGHT - HEADER_HEIGHT - BOTTOM_GAP) / STAGE_HEIGHT;

/**
 * The center of the screen. Zooming in scales the Region board up from the
 * chosen Region while that Region's own board grows into place; zooming out
 * reverses it. Both motions are anchored on the Region's tile.
 */
export function BoardStage({ focusedRegion, regionBoard, renderRegion, overlays, header }: BoardStageProps) {
  // Keep showing the last Region while zooming back out.
  const [shownRegion, setShownRegion] = useState<RegionIndex | null>(focusedRegion);
  useEffect(() => {
    if (focusedRegion !== null) setShownRegion(focusedRegion);
  }, [focusedRegion]);

  const zoomed = focusedRegion !== null;
  const style = {
    '--zoom-origin': originFor(shownRegion),
    '--map-top': `${header ? HEADER_HEIGHT : 0}px`,
    '--map-scale': header ? MAP_SCALE : 1,
  } as CSSProperties;

  return (
    <main className={`board-stage${zoomed ? ' board-stage--zoomed' : ''}`} style={style}>
      {header}
      {/* The map keeps its full-size layout and art, scaled to fit under the header. */}
      <div className="board-stage__map">
        <div className="board-stage__layer board-stage__regions" aria-hidden={zoomed} inert={zoomed}>
          {regionBoard}
        </div>
        <div className="board-stage__layer board-stage__region" aria-hidden={!zoomed} inert={!zoomed}>
          {shownRegion !== null && renderRegion(shownRegion)}
        </div>
      </div>
      {overlays}
    </main>
  );
}

/** Center of a Region's tile, in board-stage pixels. */
function originFor(region: RegionIndex | null): string {
  if (region === null) return '50% 50%';
  const left = (STAGE_WIDTH - REGION_BOARD_SIZE) / 2;
  const top = (STAGE_HEIGHT - REGION_BOARD_SIZE) / 2;
  const col = region % 3;
  const row = Math.floor(region / 3);
  const x = left + col * (REGION_TILE + REGION_GAP) + REGION_TILE / 2;
  const y = top + row * (REGION_TILE + REGION_GAP) + REGION_TILE / 2;
  return `${x}px ${y}px`;
}
