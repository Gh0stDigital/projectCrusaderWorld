import { actionableCaptains, captainsOf, reserveKnights } from '../../engine/queries';
import type { LordClass, MatchState, PlayerId } from '../../engine/state';
import { LORD_TITLES, PLAYER_NAMES, REGION_NAMES } from '../../data/names';
import { LordCard } from '../components/LordCard';
import './playerPanel.css';

interface PlayerPanelProps {
  match: MatchState;
  player: PlayerId;
  selectedCaptainId: string | null;
  onSelectCaptain: (id: string) => void;
  /** While this player is ordering their Lords: their unconfirmed order, and how to take a Lord back. */
  draft?: { order: LordClass[]; remove: (lord: LordClass) => void };
}

/**
 * One player's side: their three Lords in turn order, each card on the left
 * with that Lord's Captains and where they are stationed on the right.
 */
export function PlayerPanel({ match, player, selectedCaptainId, onSelectCaptain, draft }: PlayerPanelProps) {
  const order = draft ? draft.order : (match.players[player].lordOrder ?? []);
  const turn = match.turn;
  const isTheirTurn = turn?.player === player;
  const selectable = new Set(isTheirTurn ? actionableCaptains(match).map((c) => c.id) : []);

  return (
    <aside className={`player-panel player-panel--${player}${isTheirTurn ? ' player-panel--active' : ''}`}>
      <header className="player-panel__header">
        <h2 className="player-panel__name">{PLAYER_NAMES[player]}</h2>
        <p className="player-panel__status">{statusFor(match, player)}</p>
      </header>

      <ol className="player-panel__lords">
        {[0, 1, 2].map((i) => {
          const lord = order[i];
          if (!lord) {
            return (
              <li key={i} className="lord-row lord-row--empty">
                <div className="lord-row__slot">
                  <span className="lord-row__slot-number">{i + 1}</span>
                </div>
                <p className="lord-row__empty-hint">{draft ? `Turn ${i + 1}: choose a Lord` : 'Not yet placed'}</p>
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
                <h3 className="lord-row__title">{LORD_TITLES[lord]}</h3>
                {active && <span className="lord-row__badge">Taking this turn</span>}
                {match.phase === 'turns' && (
                  <ul className="lord-row__captains">
                    {captainsOf(match, player, lord).map((captain) => {
                      const label = `Captain ${captain.rank === 1 ? 'I' : 'II'}`;
                      const waiting = reserveKnights(match, captain.id).length;
                      const where =
                        captain.region === null
                          ? 'Ready'
                          : `${REGION_NAMES[captain.region]} · ${waiting} Knight${waiting === 1 ? '' : 's'} waiting`;
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
    </aside>
  );
}

function statusFor(match: MatchState, player: PlayerId): string {
  if (match.phase === 'lordOrder') {
    if (match.orderingPlayer === player) return 'Ordering Lords';
    return match.players[player].lordOrder ? 'Lords in position' : 'Waiting to order Lords';
  }
  return match.turn?.player === player ? 'Taking their turn' : 'Waiting';
}
