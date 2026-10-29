import {
  actingCaptain,
  actionableCaptains,
  attackers,
  canEndTurn,
  canPlaceNow,
  commandOptions,
  decisiveRoller,
  isStationed,
  moveType,
  movers,
  retreatDecider,
} from '../../engine/queries';
import type { MatchState, RegionIndex } from '../../engine/state';
import { LORD_NAMES, REGION_NAMES, captainName } from '../../data/names';
import { MOVE_TYPE_NAMES, commandSummary } from './commandText';
import './turnPhases.css';

const PHASES = [
  { id: 'command', label: 'Command' },
  { id: 'placement', label: 'Placement' },
  { id: 'attack', label: 'Attack' },
  { id: 'battle', label: 'Battle' },
  { id: 'end', label: 'End' },
] as const;

interface TurnPhasesProps {
  match: MatchState;
  selectedCaptainId: string | null;
  focusedRegion: RegionIndex | null;
  busy: boolean;
  battleOpen: boolean;
  /** A defeated Knight is leaving the board; ending the turn waits for it. */
  departing?: boolean;
  /** Why the last action was refused, if it was. */
  error: string | null;
  onEndTurn: () => void;
}

/**
 * A strip across the top of the board: the turn's steps (Command, Placement,
 * Attack, Battle, End) with the current one lit, then the move type (Fated Move /
 * Free Choice) and what to do next. The End step also ends the turn.
 */
export function TurnPhases({
  match,
  selectedCaptainId,
  focusedRegion,
  busy,
  battleOpen,
  departing = false,
  error,
  onEndTurn,
}: TurnPhasesProps) {
  const turn = match.turn;
  // During orders, light up whichever of Placement and Attack is still available.
  // The End step lights whenever the turn can end, the same moment End turn appears.
  const lit = new Set<string>(
    battleOpen || turn?.step === 'battle' || turn?.step === 'decisive'
      ? ['battle']
      : turn?.step === 'orders'
        ? [...(canPlaceNow(match) ? ['placement'] : []), ...(attackers(match).length > 0 ? ['attack'] : [])]
        : turn
          ? [turn.step]
          : [],
  );
  if (!battleOpen && canEndTurn(match)) lit.add('end');
  const canEnd = turn !== null && turn.player === 'p1' && !busy && !battleOpen && !departing;
  const type = !busy && !battleOpen ? moveType(match) : null;
  const showError = error !== null && !busy;
  const text = showError ? error : instruction(match, selectedCaptainId, focusedRegion, busy, battleOpen);

  return (
    <nav className="turn-phases" aria-label="Turn steps">
      <ol className="turn-phases__list">
        {PHASES.map((phase, i) => (
          <li key={phase.id} className="turn-phases__item">
            {i > 0 && (
              <span className="turn-phases__arrow" aria-hidden="true">
                ›
              </span>
            )}
            {phase.id === 'end' && canEnd ? (
              <button
                className={`turn-phases__step turn-phases__step--button${lit.has(phase.id) ? ' turn-phases__step--current' : ''}`}
                onClick={onEndTurn}
                title="End turn"
              >
                {phase.label}
              </button>
            ) : (
              <span
                className={`turn-phases__step${lit.has(phase.id) ? ' turn-phases__step--current' : ''}`}
                aria-current={lit.has(phase.id) ? 'step' : undefined}
              >
                {phase.label}
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="turn-phases__guide" aria-live="polite">
        {type && <span className={`move-type move-type--${type}`}>{MOVE_TYPE_NAMES[type]}</span>}
        <p className={`turn-phases__text${showError ? ' turn-phases__text--error' : ''}`} title={text}>
          {text}
        </p>
      </div>
    </nav>
  );
}

/** What the player should do now. */
function instruction(
  match: MatchState,
  selectedCaptainId: string | null,
  focusedRegion: RegionIndex | null,
  busy: boolean,
  battleOpen: boolean,
): string {
  const turn = match.turn;
  if (busy) return 'Orders complete.';
  if (match.decisive) {
    if (decisiveRoller(match) === 'p1') return `${battleName(match)}: roll the die.`;
    return match.decisive.outcome ? `The ${battleName(match)} is over.` : `${battleName(match)}!`;
  }
  if (turn && turn.player !== 'p1' && !battleOpen) return 'The enemy is taking their turn…';
  if (battleOpen) {
    if (!match.duel?.outcome) return 'Battle! Choose a Sergeant for each clash.';
    return retreatDecider(match) === 'p1'
      ? 'Your Knight lost but survives: retreat or hold its square.'
      : 'The battle is over. Return to the Region.';
  }
  return instructionFor(match, selectedCaptainId, focusedRegion);
}

/** Last Stand (a stalemated Region) or Decisive battle (an assault). */
function battleName(match: MatchState): string {
  return match.decisive?.kind === 'assault' ? 'Decisive battle' : 'Last Stand';
}

function instructionFor(match: MatchState, selectedCaptainId: string | null, focusedRegion: RegionIndex | null): string {
  const turn = match.turn;
  if (!turn) return 'Each player places their Lords in turn order.';
  const lordName = LORD_NAMES[turn.lord];

  if (turn.step === 'command') {
    if (actionableCaptains(match).length === 0) return `No ${lordName} Captain can act this turn. Press End turn.`;
    const selected = selectedCaptainId ? match.captains[selectedCaptainId] : undefined;
    if (!selected) return `${commandSummary(match)}.`;
    const name = captainName(selected);
    const routed = commandOptions(match);
    if (selected.region === null) {
      return routed.mode === 'routed' && routed.route !== null
        ? `Sent to ${REGION_NAMES[routed.route]}: click it to deploy.`
        : `Choose a Region to deploy ${name}.`;
    }
    return `Click ${REGION_NAMES[selected.region]} to give ${name} orders.`;
  }

  const captain = actingCaptain(match);
  const where = captain?.region != null ? REGION_NAMES[captain.region] : 'the Region';
  if (turn.step === 'decisive') return `Stalemate in ${where}: Last Stand!`;
  if (turn.step === 'station') return 'Choose a Captain to station in the Region you took.';
  if (turn.step === 'orders' && captain && isStationed(match, captain) && !turn.stationOrder) {
    return `${captainName(captain)} holds ${where}: give one order.`;
  }
  if (turn.step === 'orders') {
    const place = canPlaceNow(match);
    const attack = attackers(match).length > 0;
    const move = movers(match).length > 0;
    const done = canEndTurn(match) ? ', or End turn' : '';
    if (focusedRegion !== captain?.region) return `Enter ${where} to give orders${done}.`;
    if (place && attack) return `Place a Knight and/or attack${move ? ', or move one' : ''}${done}.`;
    if (place) return `Place a Knight${move ? ', or move one a square' : ''}${done}.`;
    if (move && !attack) return `Pick one of your Knights and move it a square${done}.`;
    return `Pick one of your Knights, then an enemy to attack${done}.`;
  }
  if (match.duel?.outcome) return 'Battle fought. Press End turn when ready.';
  if (captain?.region != null && match.secured[captain.region]?.captainId === captain.id) {
    return `${where} secured! Press End turn.`;
  }
  return `Knight ${turn.movedKnightId ? 'moved' : 'placed'}. Press End turn when ready.`;
}
