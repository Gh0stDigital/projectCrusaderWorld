import {
  CAPTAINS_PER_LORD,
  LORD_CLASSES,
  PLAYERS,
  type Captain,
  type MatchState,
  type PlayerId,
} from './state';

export function captainId(owner: PlayerId, lord: string, rank: number): string {
  return `${owner}-${lord}-${rank}`;
}

/** A fresh match: both players still need to set their Lord order, Player 1 first. */
export function createMatch(): MatchState {
  const captains: Record<string, Captain> = {};
  for (const owner of PLAYERS) {
    for (const lord of LORD_CLASSES) {
      for (let rank = 1; rank <= CAPTAINS_PER_LORD; rank++) {
        const id = captainId(owner, lord, rank);
        captains[id] = { id, owner, lord, rank, region: null };
      }
    }
  }

  return {
    phase: 'lordOrder',
    orderingPlayer: 'p1',
    turnNumber: 0,
    turn: null,
    players: {
      p1: { id: 'p1', lordOrder: null, turnsTaken: 0 },
      p2: { id: 'p2', lordOrder: null, turnsTaken: 0 },
    },
    captains,
  };
}
