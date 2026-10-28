import { ResourceBars } from './ResourceBars';
import { actingCaptain, actionableCaptains, canEndTurn, attackers, canPlaceNow, canUndoCommand, canUndoKnight, commandOptions, movers, decisiveRoller, isStationed, moveType, retreatDecider } from '../../engine/queries';
import { MOVE_TYPE_NAMES, commandSummary } from './commandText';
import type { MatchState, RegionIndex } from '../../engine/state';
import { LORD_NAMES, REGION_NAMES, captainName } from '../../data/names';
import './phaseWindow.css';

const PHASES = [
  { id: 'command', label: 'Command' },
  { id: 'placement', label: 'Placement' },
  { id: 'attack', label: 'Attack' },
  { id: 'battle', label: 'Battle' },
  { id: 'end', label: 'End' },
] as const;

interface PhaseWindowProps {
  match: MatchState;
  selectedCaptainId: string | null;
  focusedRegion: RegionIndex | null;
  busy: boolean;
  battleOpen: boolean;
  /** A defeated Knight is leaving the board; End turn waits for it. */
  departing?: boolean;
  error: string | null;
  onEnterRegion: (region: RegionIndex) => void;
  onEndTurn: () => void;
  /** Take back this turn's placement or move. */
  onUndo: () => void;
  /** Take back this turn's Captain deployment (or Captain choice). */
  onUndoCommand: () => void;
}

export function PhaseWindow({
  match,
  selectedCaptainId,
  focusedRegion,
  busy,
  battleOpen,
  departing = false,
  error,
  onEnterRegion,
  onEndTurn,
  onUndo,
  onUndoCommand,
}: PhaseWindowProps) {
  const turn = match.turn;
  const captain = actingCaptain(match);
  // A stationed Captain's orders window has its own cancel button.
  const isStationedTurn = captain !== null && isStationed(match, captain);
  const enterTarget =
    turn && turn.step !== 'command' && !battleOpen && captain?.region != null && focusedRegion !== captain.region
      ? captain.region
      : null;
  // During orders, light up whichever of Placement and Attack is still available.
  const lit = new Set<string>(
    battleOpen || turn?.step === 'battle' || turn?.step === 'decisive'
      ? ['battle']
      : turn?.step === 'orders'
        ? [...(canPlaceNow(match) ? ['placement'] : []), ...(attackers(match).length > 0 ? ['attack'] : [])]
        : turn
          ? [turn.step]
          : [],
  );

  return (
    <footer className="phase-window">
      <ResourceBars match={match} />
      <ol className="phase-list">
        {PHASES.map((phase) => (
          <li
            key={phase.id}
            className={`phase-list__item phase-list__item--${phase.id}${lit.has(phase.id) ? ' phase-list__item--current' : ''}`}
          >
            {phase.id === 'end' && turn && turn.player === 'p1' && !busy && !battleOpen && !departing ? (
              <button className="phase-list__end" onClick={onEndTurn} title="End turn">
                {phase.label}
              </button>
            ) : (
              phase.label
            )}
          </li>
        ))}
      </ol>

      <div className="phase-window__orders">
        {!busy && !battleOpen && moveType(match) && (
          <span className={`move-type move-type--${moveType(match)}`}>{MOVE_TYPE_NAMES[moveType(match)!]}</span>
        )}
        <p className="phase-window__instruction">
          {busy
            ? 'Orders complete.'
            : match.decisive
              ? decisiveRoller(match) === 'p1'
                ? `${battleName(match)}: roll the die.`
                : match.decisive.outcome
                  ? `The ${battleName(match)} is over.`
                  : `${battleName(match)}!`
            : turn && turn.player !== 'p1' && !battleOpen
              ? 'The enemy is taking their turn…'
            : battleOpen
              ? match.duel?.outcome
                ? retreatDecider(match) === 'p1'
                  ? 'Your Knight lost but survives: retreat or hold its square.'
                  : 'The battle is over. Return to the Region.'
                : 'Battle! Choose a Sergeant for each clash.'
              : instructionFor(match, selectedCaptainId, focusedRegion)}
        </p>
        {error && !busy && <p className="phase-window__error">{error}</p>}
      </div>

      {turn && turn.player === 'p1' && !busy && !battleOpen && !departing && (
        <div className="phase-window__buttons">
          {canUndoKnight(match) && (
            <button className="btn" onClick={onUndo}>
              {turn.movedKnightId ? 'Undo move' : 'Undo placement'}
            </button>
          )}
          {canUndoCommand(match) && !isStationedTurn && (
            <button className="btn" data-sound="cancel" onClick={onUndoCommand}>
              {turn.commandUndo ? 'Undo deployment' : 'Choose another Captain'}
            </button>
          )}
          {enterTarget !== null && (
            <button
              className={`btn${turn.step === 'orders' && !canEndTurn(match) ? ' btn--primary' : ''}`}
              onClick={() => onEnterRegion(enterTarget)}
            >
              {turn.step === 'orders' && !canEndTurn(match) ? `Enter ${REGION_NAMES[enterTarget]}` : `Return to ${REGION_NAMES[enterTarget]}`}
            </button>
          )}
          <button className={`btn phase-window__end-turn${canEndTurn(match) ? ' btn--primary' : ''}`} onClick={onEndTurn}>
            End turn
          </button>
        </div>
      )}
    </footer>
  );
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
