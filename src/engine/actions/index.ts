// Every possible player input, as data. The engine validates each one.
import type { LordClass, PlayerId, RegionIndex, SquareIndex } from '../state';

export type MatchAction =
  | { type: 'setLordOrder'; player: PlayerId; order: LordClass[] }
  | { type: 'deployCaptain'; player: PlayerId; captainId: string; region: RegionIndex }
  | { type: 'resumeCaptain'; player: PlayerId; captainId: string }
  | { type: 'placeKnight'; player: PlayerId; knightId: string; square: SquareIndex }
  | { type: 'moveKnight'; player: PlayerId; knightId: string; square: SquareIndex }
  | { type: 'undoKnight'; player: PlayerId }
  | { type: 'declareAttack'; player: PlayerId; attackerKnightId: string; targetKnightId: string }
  | { type: 'reinforceKnight'; player: PlayerId; knightId: string; amount: number }
  | { type: 'commitSergeant'; player: PlayerId; sergeantId: string }
  | { type: 'chooseRetreat'; player: PlayerId; retreat: boolean }
  | { type: 'rollDie'; player: PlayerId; value: number }
  | { type: 'finishDecisive'; player: PlayerId }
  | { type: 'sendReserve'; player: PlayerId; toCaptainId: string; amount: number }
  | { type: 'sendKnight'; player: PlayerId; knightId: string; toCaptainId: string }
  | { type: 'assault'; player: PlayerId; region: RegionIndex }
  | { type: 'cancelStationOrders'; player: PlayerId }
  | { type: 'stationCaptain'; player: PlayerId; captainId: string | null }
  | { type: 'endTurn'; player: PlayerId };
