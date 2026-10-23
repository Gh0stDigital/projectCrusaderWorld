// Display names. Placeholder wording until factions and the Muster screen exist.
import type { LordClass, PlayerId, RegionIndex, Tactic } from '../engine/state';
import type { ArtId } from './artCatalog';

export const PLAYER_NAMES: Record<PlayerId, string> = {
  p1: 'Player 1',
  p2: 'Player 2',
};

export const LORD_NAMES: Record<LordClass, string> = {
  army: 'Army',
  garrison: 'Garrison',
  raiders: 'Raiders',
};

export interface LordPersona {
  name: string;
  art: ArtId;
}

/** Player 1's Lords: named characters with their own card art. */
const PLAYER_LORDS: Record<LordClass, LordPersona> = {
  army: { name: 'Aubrey', art: 'aubrey' },
  garrison: { name: 'Nevadius', art: 'nevadius' },
  raiders: { name: 'Jermaine', art: 'jermaine' },
};

/** The opponent's Lords all share the generic Enemy Lord card. */
const ENEMY_LORD: LordPersona = { name: 'Enemy Lord', art: 'enemyLord' };

/** Who leads a player's Lord class, and their card art. */
export function lordPersona(player: PlayerId, lord: LordClass): LordPersona {
  return player === 'p1' ? PLAYER_LORDS[lord] : ENEMY_LORD;
}

/** "Aubrey, Lord of the Army" or "Enemy Lord of the Army" */
export function lordFullName(player: PlayerId, lord: LordClass): string {
  const { name } = lordPersona(player, lord);
  return player === 'p1' ? `${name}, ${LORD_TITLES[lord]}` : `${name} of the ${LORD_NAMES[lord]}`;
}

export const LORD_TITLES: Record<LordClass, string> = {
  army: 'Lord of the Army',
  garrison: 'Lord of the Garrison',
  raiders: 'Lord of the Raiders',
};

export const REGION_NAMES: Record<RegionIndex, string> = {
  0: 'Northwest',
  1: 'North',
  2: 'Northeast',
  3: 'West',
  4: 'Heartland',
  5: 'East',
  6: 'Southwest',
  7: 'South',
  8: 'Southeast',
};

export function captainName(lord: LordClass, rank: number): string {
  return `${LORD_NAMES[lord]} Captain ${rank === 1 ? 'I' : 'II'}`;
}

export const TACTIC_NAMES: Record<Tactic, string> = {
  rush: 'Rush',
  flank: 'Flank',
  counter: 'Counter',
};

export function knightName(number: number): string {
  return `Knight ${number}`;
}

export function formatMilitia(n: number): string {
  return n.toLocaleString('en-US');
}
