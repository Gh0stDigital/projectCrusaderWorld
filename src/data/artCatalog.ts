import militia from '../assets/cards/militia.png';

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
} satisfies Record<string, ArtEntry>;

export type ArtId = keyof typeof artCatalog;
