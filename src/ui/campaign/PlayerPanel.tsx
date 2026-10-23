import { actionableCaptains, captainsOf, lordMilitia, playerMilitia, reserveKnights } from '../../engine/queries';
import type { LordClass, MatchState, PlayerId, RegionIndex } from '../../engine/state';
import { LORD_TITLES, captainName, lordPersona, PLAYER_NAMES, REGION_NAMES, formatMilitia } from '../../data/names';
import { LordCard } from '../components/LordCard';
import { CompanyView } from './CompanyView';
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
}

/**
 * One player's side: their three Lords in turn order, each card on the left
 * with that Lord's Captains and where they are stationed on the right.
 */
export function PlayerPanel({ match, player, selectedCaptainId, onSelectCaptain, draft, company }: PlayerPanelProps) {
  const order = draft ? draft.order : (match.players[player].lordOrder ?? []);
  const turn = match.turn;
  const isTheirTurn = turn?.player === player;
  const selectable = new Set(isTheirTurn ? actionableCaptains(match).map((c) => c.id) : []);

  return (
    <aside
      className={`player-panel player-panel--${player}${isTheirTurn ? ' player-panel--active' : ''}${
        company ? ' player-panel--company' : ''
      }`}
    >
      <header className="player-panel__header">
        <div>
          <h2 className="player-panel__name">{PLAYER_NAMES[player]}</h2>
          <p className="player-panel__militia">{formatMilitia(playerMilitia(match, player))} militia</p>
        </div>
        <p className="player-panel__status">{statusFor(match, player)}</p>
      </header>

      {company ? (
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
          const card = <LordCard lord={lord} owner={player} size="roster" position={i + 1} />;

          return (
            <li key={lord} className={`lord-row${active ? ' lord-row--active' : ''}`}>
              {draft ? (
                <button className="lord-row__draft" onClick={() => draft.remove(lord)} title="Take this Lord back">
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
                <p className="lord-row__militia">
                  {formatMilitia(lordMilitia(match, player, lord))} militia
                  <span className="lord-row__reserve">
                    {' '}
                    · {formatMilitia(match.players[player].lordReserves[lord])} rsv
                  </span>
                </p>
                {active && <span className="lord-row__badge">Taking this turn</span>}
                {match.phase === 'turns' && (
                  <ul className="lord-row__captains">
                    {captainsOf(match, player, lord).map((captain) => {
                      const label = captainName(captain);
                      const waiting = reserveKnights(match, captain.id).length;
                      const where =
                        captain.region === null
                          ? 'Ready'
                          : `${REGION_NAMES[captain.region]}: ${waiting} ready`;
                      const content = (
                        <>
                          <span>{label}</span>
                          <span className="captain-chip__where">{where}</span>
                        </>
                      );
                      return (
                        <li key={captain.id}>
                          {selectable.has(captain.id) ? (
                            <button
                              className={`captain-chip captain-chip--pickable${
                                selectedCaptainId === captain.id ? ' captain-chip--selected' : ''
                              }`}
                              onClick={() => onSelectCaptain(captain.id)}
                            >
                              {content}
                            </button>
                          ) : (
                            <span className={`captain-chip${captain.region === null ? '' : ' captain-chip--deployed'}`}>
                              {content}
                            </span>
                          )}
                        </li>
                      );
                    })}
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
