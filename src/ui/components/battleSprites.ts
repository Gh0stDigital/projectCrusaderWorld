// Battle avatars per Knight type: two-frame strips, one per side.
import knightBattle from '../../assets/sprites/knight-battle-anim.webp';
import enemyKnightBattle from '../../assets/sprites/enemy-knight-battle-anim.webp';
import crossbowBattle from '../../assets/sprites/crossbow-battle-anim.webp';
import enemyCrossbowBattle from '../../assets/sprites/enemy-crossbow-battle-anim.webp';
import lanceBattle from '../../assets/sprites/lance-battle-anim.webp';
import enemyLanceBattle from '../../assets/sprites/enemy-lance-battle-anim.webp';
import gatekeeperBattle from '../../assets/sprites/gatekeeper-battle-anim.webp';
import enemyGatekeeperBattle from '../../assets/sprites/enemy-gatekeeper-battle-anim.webp';
import watchmanBattle from '../../assets/sprites/watchman-battle-anim.webp';
import enemyWatchmanBattle from '../../assets/sprites/enemy-watchman-battle-anim.webp';
import wardenBattle from '../../assets/sprites/warden-battle-anim.webp';
import enemyWardenBattle from '../../assets/sprites/enemy-warden-battle-anim.webp';
import skirmisherBattle from '../../assets/sprites/skirmisher-battle-anim.webp';
import enemySkirmisherBattle from '../../assets/sprites/enemy-skirmisher-battle-anim.webp';
import ambusherBattle from '../../assets/sprites/ambusher-battle-anim.webp';
import enemyAmbusherBattle from '../../assets/sprites/enemy-ambusher-battle-anim.webp';
import saboteurBattle from '../../assets/sprites/saboteur-battle-anim.webp';
import enemySaboteurBattle from '../../assets/sprites/enemy-saboteur-battle-anim.webp';

/** Battle avatars: two-frame strips, sized to their frame shape (width 330 unless set, height from the frame). */
export interface BattleSprite {
  p1: string;
  p2: string;
  height: number;
  width?: number;
}
export const BATTLE_SPRITES = {
  sword: { p1: knightBattle, p2: enemyKnightBattle, height: 326 },
  crossbow: { p1: crossbowBattle, p2: enemyCrossbowBattle, height: Math.round((330 * 703) / 989) },
  lance: { p1: lanceBattle, p2: enemyLanceBattle, height: Math.round((330 * 717) / 1000) },
  // A close-up bust: drawn smaller so it matches the others.
  gatekeeper: { p1: gatekeeperBattle, p2: enemyGatekeeperBattle, width: 240, height: Math.round((240 * 734) / 750) },
  watchman: { p1: watchmanBattle, p2: enemyWatchmanBattle, height: Math.round((330 * 750) / 991) },
  warden: { p1: wardenBattle, p2: enemyWardenBattle, height: Math.round((330 * 808) / 982) },
  skirmisher: { p1: skirmisherBattle, p2: enemySkirmisherBattle, height: Math.round((330 * 850) / 919) },
  ambusher: { p1: ambusherBattle, p2: enemyAmbusherBattle, height: Math.round((330 * 952) / 993) },
  saboteur: { p1: saboteurBattle, p2: enemySaboteurBattle, height: Math.round((330 * 676) / 924) },
} satisfies Record<string, BattleSprite>;
export const SPRITE_WIDTH = 330;

/** Battle avatar by Knight type. Garrison and Raiders types have their own; Army uses sword, crossbow and lance rider. */
export function battleSprite(subclass: string | null): BattleSprite {
  if (subclass === 'gatekeeper') return BATTLE_SPRITES.gatekeeper;
  if (subclass === 'watchman') return BATTLE_SPRITES.watchman;
  if (subclass === 'warden') return BATTLE_SPRITES.warden;
  if (subclass === 'skirmisher') return BATTLE_SPRITES.skirmisher;
  if (subclass === 'ambusher') return BATTLE_SPRITES.ambusher;
  if (subclass === 'saboteur') return BATTLE_SPRITES.saboteur;
  if (subclass === 'archers') return BATTLE_SPRITES.crossbow;
  if (subclass === 'cavalry') return BATTLE_SPRITES.lance;
  return BATTLE_SPRITES.sword;
}
