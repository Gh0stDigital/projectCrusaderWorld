import {
  CAPTAIN_RESERVE,
  CAPTAINS_PER_LORD,
  KNIGHT_HP,
  KNIGHTS_PER_CAPTAIN,
  LORD_CLASSES,
  LORD_RESERVE,
  PLAYERS,
  SERGEANT_MILITIA,
  SERGEANTS_PER_KNIGHT,
  STAFFED_KNIGHTS_PER_CAPTAIN,
  type Captain,
  type Knight,
  type LordClass,
  type MatchState,
  type PlayerId,
  type Sergeant,
  type Tactic,
} from './state';

export function captainId(owner: PlayerId, lord: string, rank: number): string {
  return `${owner}-${lord}-${rank}`;
}

export function knightId(captain: string, number: number): string {
  return `${captain}-k${number}`;
}

/**
 * Each Knight's five Sergeants mix the three tactics (two, two and one),
 * rotated by Knight number so Knights differ from each other.
 */
const TACTIC_PATTERN: Tactic[] = ['rush', 'flank', 'counter', 'rush', 'flank'];

function startingSergeants(knight: string, number: number): Sergeant[] {
  return Array.from({ length: SERGEANTS_PER_KNIGHT }, (_, i) => ({
    id: `${knight}-s${i + 1}`,
    tactic: TACTIC_PATTERN[(i + number - 1) % TACTIC_PATTERN.length]!,
    militia: SERGEANT_MILITIA,
  }));
}

function lordReserves(): Record<LordClass, number> {
  return { army: LORD_RESERVE, garrison: LORD_RESERVE, raiders: LORD_RESERVE };
}

/** A fresh match: both players still need to set their Lord order, Player 1 first. */
export function createMatch(): MatchState {
  const captains: Record<string, Captain> = {};
  const knights: Record<string, Knight> = {};
  for (const owner of PLAYERS) {
    for (const lord of LORD_CLASSES) {
      for (let rank = 1; rank <= CAPTAINS_PER_LORD; rank++) {
        const id = captainId(owner, lord, rank);
        captains[id] = { id, owner, lord, rank, region: null, reserve: CAPTAIN_RESERVE };
        for (let number = 1; number <= KNIGHTS_PER_CAPTAIN; number++) {
          const kid = knightId(id, number);
          const staffed = number <= STAFFED_KNIGHTS_PER_CAPTAIN;
          knights[kid] = {
            id: kid,
            owner,
            captainId: id,
            number,
            status: staffed ? 'ready' : 'unmanned',
            position: null,
            hp: staffed ? KNIGHT_HP : 0,
            sergeants: staffed ? startingSergeants(kid, number) : [],
          };
        }
      }
    }
  }

  return {
    phase: 'lordOrder',
    orderingPlayer: 'p1',
    turnNumber: 0,
    turn: null,
    players: {
      p1: { id: 'p1', lordOrder: null, turnsTaken: 0, lordReserves: lordReserves() },
      p2: { id: 'p2', lordOrder: null, turnsTaken: 0, lordReserves: lordReserves() },
    },
    captains,
    knights,
    duel: null,
    route: null,
    secured: {},
  };
}
