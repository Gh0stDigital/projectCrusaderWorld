import militia from '../assets/cards/militia.png';

/**
 * Every card image the game knows about. Code refers to art by id, never by
 * file path, so swapping or adding art only means editing this list.
 * Card art is 2:3 portrait with the frame baked in (for now).
 */
export const artCatalog = {
  militia,
} as const;

export type ArtId = keyof typeof artCatalog;
