import militia from '../assets/cards/militia.png';
import aubrey from '../assets/cards/lords/aubrey.png';
import jermaine from '../assets/cards/lords/jermaine.png';
import nevadius from '../assets/cards/lords/nevadius.png';
import enemyLord from '../assets/cards/lords/enemy-lord.png';
import captain from '../assets/cards/captains/captain.png';
import enemyCaptain from '../assets/cards/captains/enemy-captain.png';
import raidersCaptain from '../assets/cards/captains/raiders-captain.png';
import armyCaptain from '../assets/cards/captains/army-captain.png';
import knight from '../assets/cards/knights/knight.png';
import enemyKnight from '../assets/cards/knights/enemy-knight.png';
import knightFacingLeft from '../assets/cards/knights/knight-facing-left.png';
import enemyKnightFacingRight from '../assets/cards/knights/enemy-knight-facing-right.png';

/**
 * Every card image the game knows about. Code refers to art by id, never by
 * file path, so swapping or adding art only means editing this list.
 * Card art is 2:3 portrait with the frame baked in (for now).
 */
export interface ArtEntry {
  src: string;
  /**
   * Where the face is, for square portraits cropped from the card.
   * x and y are CSS background-position percentages; zoom is how many times
   * wider the image is than the crop.
   */
  face: { x: number; y: number; zoom: number };
}

export const artCatalog = {
  militia: { src: militia, face: { x: 51, y: 19, zoom: 3.4 } },
  aubrey: { src: aubrey, face: { x: 44, y: 32, zoom: 3.4 } },
  jermaine: { src: jermaine, face: { x: 49, y: 34, zoom: 3.4 } },
  nevadius: { src: nevadius, face: { x: 50, y: 32, zoom: 3.4 } },
  /** The opponent's Lords: one portrait, recolored crimson. */
  enemyLord: { src: enemyLord, face: { x: 51, y: 33, zoom: 3.4 } },
  captain: { src: captain, face: { x: 50, y: 40, zoom: 3.4 } },
  /** Recolored crimson and mirrored to face inward from the enemy side. */
  enemyCaptain: { src: enemyCaptain, face: { x: 39, y: 40, zoom: 3.4 } },
  /** Player 1's Raiders Captains: masked, wide-brimmed helmet. */
  raidersCaptain: { src: raidersCaptain, face: { x: 52, y: 26, zoom: 3.4 } },
  /** Player 1's Army Captains: bronze helmet and green scarf, mirrored from the source art. */
  armyCaptain: { src: armyCaptain, face: { x: 51, y: 33, zoom: 3.4 } },
  knight: { src: knight, face: { x: 51, y: 24, zoom: 3.4 } },
  /** Recolored (red armor, crimson frame) and mirrored to face inward from the enemy side. */
  enemyKnight: { src: enemyKnight, face: { x: 49, y: 24, zoom: 3.4 } },
  /** Facing variants, so Knights face each other in battle whichever side attacks. */
  knightFacingLeft: { src: knightFacingLeft, face: { x: 49, y: 24, zoom: 3.4 } },
  enemyKnightFacingRight: { src: enemyKnightFacingRight, face: { x: 51, y: 24, zoom: 3.4 } },
} satisfies Record<string, ArtEntry>;

export type ArtId = keyof typeof artCatalog;
