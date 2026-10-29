import { actionableCaptains, captainsOf, playerMilitia } from '../../engine/queries';
import type { LordClass, MatchState, PlayerId, RegionIndex } from '../../engine/state';
import { LORD_TITLES, lordPersona, PLAYER_NAMES, formatMilitia } from '../../data/names';
import { LordCard } from '../components/LordCard';
import { CaptainIcon } from './CaptainIcon';
import { CompanyView } from './CompanyView';
import { LordBars } from './LordBars';
import './playerPanel.css';

interface PlayerPanelProps {
  match: MatchState;
  player: PlayerId;
  selectedCaptainId: string | null;
  onSelectCaptain: (id: string) => void;
  /** While this player is ordering their Lords: their unconfirmed order, and how to take a Lord back. */
  draft?: { order: LordClass[]; remove: (lord: LordClass) => void };
  /** While zoomed into a Region: show this player's Captain and Knights there instead of their Lords. */
  company?: { region: RegionIndex; selectedKnightId: string | null; onSelectKnight: (id: string) => void };
  /** During a battle the panel shows this player's fighting Knight instead (filled in by the battle screen). */
  battleHud?: boolean;
}

/**
 * One player's side: their three Lords in turn order, each card on the left
 * with that Lord's Captains and where they are stationed on the right.
 */
export function PlayerPanel({
  match,
  player,
  selectedCaptainId,
  onSelectCaptain,
  draft,
  company,
  battleHud,
}: PlayerPanelProps) {
  const order = draft ? draft.order : (match.players[player].lordOrder ?? []);
  const turn = match.turn;
  const isTheirTurn = turn?.player === player;
  // Next up: the Lord after the current one for whoever is playing; otherwise the Lord they play next.
  const { lordOrder, turnsTaken } = match.players[player];
  const nextLord = lordOrder ? lordOrder[(turnsTaken + (isTheirTurn ? 1 : 0)) % lordOrder.length] : undefined;
  const selectable = new Set(isTheirTurn ? actionableCaptains(match).map((c) => c.id) : []);

  return (
    <aside
      className={`player-panel player-panel--${player}${isTheirTurn ? ' player-panel--active' : ''}${
        company ? ' player-panel--company' : ''
      }${battleHud ? ' player-panel--battle' : ''
      }`}
    >
      <header className="player-panel__header">
        <div>
          <h2 className="player-panel__name">{PLAYER_NAMES[player]}</h2>
          <p className="player-panel__militia">
            {formatMilitia(playerMilitia(match, player))} troops
          </p>
        </div>
        <p className="player-panel__status">{statusFor(match, player)}</p>
      </header>

      {battleHud ? (
        <div className="battle-hud-host" id={`battle-hud-${player}`} />
      ) : company ? (
        <CompanyView
          match={match}
          player={player}
          region={company.region}
          selectedKnightId={company.selectedKnightId}
          onSelectKnight={company.onSelectKnight}
        />
      ) : (
      <ol className="player-panel__lords">
        {[0, 1, 2].map((i) => {
          const lord = order[i];
          if (!lord) {
            return (
              <li key={i} className="lord-row lord-row--empty">
                <div className="lord-row__slot">
                  <span className="lord-row__slot-number">{i + 1}</span>
                </div>
                <p className="lord-row__empty-hint">{draft ? 'Choose a Lord' : 'Not placed'}</p>
              </li>
            );
          }

          const active = isTheirTurn && turn?.lord === lord;
          // The Lord this player uses on their next turn (after the one being played now).
          const upNext = match.phase === 'turns' && turn !== null && nextLord === lord;
          const card = <LordCard lord={lord} owner={player} size="roster" position={i + 1} />;

          return (
            <li key={lord} className={`lord-row${active ? ' lord-row--active' : match.phase === 'turns' && turn ? ' lord-row--resting' : ''}`}>
              {draft ? (
                <button className="lord-row__draft" data-sound="cancel" onClick={() => draft.remove(lord)} title="Take this Lord back">
                  {card}
                </button>
              ) : (
                card
              )}

              <div className="lord-row__info">
                <h3 className="lord-row__title">
                  {lordPersona(player, lord).name}
                  <span className="lord-row__class">{LORD_TITLES[lord]}</span>
                </h3>
                <LordBars match={match} player={player} lord={lord} />
                {active && <span className="lord-row__badge">Taking this turn</span>}
                {upNext && !active && <span className="lord-row__badge lord-row__badge--next">Next</span>}
                {match.phase === 'turns' && (
                  <ul className="lord-row__captains">
                    {captainsOf(match, player, lord).map((captain) => (
                      <CaptainIcon
                        key={captain.id}
                        match={match}
                        captain={captain}
                        pickable={selectable.has(captain.id)}
                        selected={selectedCaptainId === captain.id}
                        onPick={() => onSelectCaptain(captain.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      )}
    </aside>
  );
}

function statusFor(match: MatchState, player: PlayerId): string {
  if (match.phase === 'lordOrder') {
    if (match.orderingPlayer === player) return 'Ordering';
    return match.players[player].lordOrder ? 'Ready' : 'Waiting';
  }
  return match.turn?.player === player ? 'Your turn' : 'Waiting';
}
