// Display names. Placeholder wording until factions and the Muster screen exist.
import type { Captain, Knight, KnightSubclass, LordClass, PlayerId, RegionIndex, Tactic } from '../engine/state';
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

/**
 * Placeholder Captain names, two per Lord, in Army, Garrison, Raiders order.
 * Player 1's sound like crusaders; the enemy's sound darker.
 */
const CAPTAIN_NAMES: Record<PlayerId, Record<LordClass, [string, string]>> = {
  p1: {
    army: ['Roderic', 'Godfrey'],
    garrison: ['Edmund', 'Baldwin'],
    raiders: ['Tancred', 'Alaric'],
  },
  p2: {
    army: ['Malric', 'Draven'],
    garrison: ['Mordaunt', 'Varek'],
    raiders: ['Corvin', 'Sauvic'],
  },
};

/** A Captain's own name, e.g. "Roderic". */
export function captainPersonalName(captain: Pick<Captain, 'owner' | 'lord' | 'rank'>): string {
  return CAPTAIN_NAMES[captain.owner][captain.lord][captain.rank === 1 ? 0 : 1];
}

/** "Captain Roderic" */
export function captainName(captain: Pick<Captain, 'owner' | 'lord' | 'rank'>): string {
  return `Captain ${captainPersonalName(captain)}`;
}

/** Player 1's Captains share one card; the enemy's share a mirrored crimson one. */
export function captainArt(owner: PlayerId): ArtId {
  return owner === 'p1' ? 'captain' : 'enemyCaptain';
}

export const SUBCLASS_NAMES: Record<KnightSubclass, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  archers: 'Archers',
  gatekeeper: 'Gatekeeper',
  watchman: 'Watchman',
  warden: 'Warden',
  skirmisher: 'Skirmisher',
  ambusher: 'Ambusher',
  saboteur: 'Saboteur',
};

/** Short label for tight spaces. */
export const SUBCLASS_SHORT: Record<KnightSubclass, string> = {
  infantry: 'Inf',
  cavalry: 'Cav',
  archers: 'Arc',
  gatekeeper: 'Gate',
  watchman: 'Watch',
  warden: 'Ward',
  skirmisher: 'Skirm',
  ambusher: 'Amb',
  saboteur: 'Sabo',
};

/** Each Knight type's ability, with a one-line description. */
export const SUBCLASS_ABILITIES: Record<KnightSubclass, { name: string; text: string }> = {
  infantry: { name: 'Regroup', text: 'After a battle it survives, Sergeants that tied a clash recover their lost men.' },
  cavalry: { name: 'Second Pass', text: 'After winning, strikes the retreating enemy for half its remaining HP.' },
  archers: {
    name: 'Cover Retreat',
    text: 'Attacks along its row or column. When adjacent Infantry retreats, blocks Second Pass and strikes the victor.',
  },
  gatekeeper: { name: 'Brace', text: 'Once per game, its first battle doubles its base HP (men drawn from its Captain\u2019s reserve). Only 2 Sergeants.' },
  watchman: {
    name: 'Snipe',
    text: 'Next to a Gatekeeper: when either is attacked, hits the attacker with its strongest Sergeant before battle.',
  },
  warden: { name: 'First Strike', text: 'When attacked, hits the attacker with its strongest Sergeant before battle.' },
  skirmisher: { name: 'Heist', text: 'Wins the first clash it sends a Sergeant into, whatever the tactics.' },
  ambusher: { name: 'Ambush!', text: "Takes the opponent's 2 strongest Sergeants out of the battle. Only 3 Sergeants." },
  saboteur: { name: 'Sabotage', text: 'The opponent loses 1 HP after every clash.' },
};

export const TACTIC_NAMES: Record<Tactic, string> = {
  rush: 'Rush',
  flank: 'Flank',
  counter: 'Counter',
};

/**
 * Placeholder Knight names: 36 per side, one per Knight slot, in
 * Army, Garrison, Raiders order (Captain I's six, then Captain II's six).
 */
const KNIGHT_NAMES: Record<PlayerId, string[]> = {
  p1: [
    'Gareth', 'Percival', 'Tristan', 'Gawain', 'Bedivere', 'Galahad',
    'Bors', 'Lionel', 'Ector', 'Lamorak', 'Pelleas', 'Geraint',
    'Yvain', 'Erec', 'Owain', 'Caradoc', 'Dinadan', 'Elyan',
    'Gaheris', 'Hugh', 'Raymond', 'Bohemond', 'Guy', 'Reynald',
    'Amalric', 'Odo', 'Walter', 'Hubert', 'Giles', 'Aymer',
    'Roland', 'Oliver', 'Turpin', 'Ogier', 'Renaud', 'Thierry',
  ],
  p2: [
    'Vargus', 'Morvane', 'Thrax', 'Dravic', 'Skarn', 'Vorth',
    'Grimald', 'Belzor', 'Kazrik', 'Zoltan', 'Malakai', 'Ravik',
    'Sorn', 'Vex', 'Hargrim', 'Torvald', 'Brakka', 'Drogan',
    'Kael', 'Murdoc', 'Szar', 'Varn', 'Gorvath', 'Rask',
    'Zarek', 'Ostrik', 'Fenrik', 'Haldor', 'Krone', 'Vasko',
    'Grendel', 'Tarvos', 'Mordrek', 'Scathe', 'Ulgar', 'Kresh',
  ],
};

const LORD_ORDER: LordClass[] = ['army', 'garrison', 'raiders'];

/** A Knight's own name, e.g. "Gareth". Captain ids look like "p1-army-1". */
export function knightPersonalName(knight: Pick<Knight, 'owner' | 'captainId' | 'number'>): string {
  const [, lord, rank] = knight.captainId.split('-');
  const index = LORD_ORDER.indexOf(lord as LordClass) * 12 + (Number(rank) - 1) * 6 + (knight.number - 1);
  return KNIGHT_NAMES[knight.owner][index] ?? `Knight ${knight.number}`;
}

/** "Sir Gareth" */
export function knightName(knight: Pick<Knight, 'owner' | 'captainId' | 'number'>): string {
  return `Sir ${knightPersonalName(knight)}`;
}

/** Player 1's Knights share the blue Knight card; the enemy's share a mirrored red one. */
export function knightArt(owner: PlayerId): ArtId {
  return owner === 'p1' ? 'knight' : 'enemyKnight';
}

/** Knight art facing a given direction, for battles where either side may stand on the left. */
export function knightArtFacing(owner: PlayerId, facing: 'left' | 'right'): ArtId {
  if (owner === 'p1') return facing === 'right' ? 'knight' : 'knightFacingLeft';
  return facing === 'left' ? 'enemyKnight' : 'enemyKnightFacingRight';
}

export function formatMilitia(n: number): string {
  return n.toLocaleString('en-US');
}
