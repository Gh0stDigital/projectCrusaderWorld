import { captainsOf, deployableCaptains } from '../../engine/queries';
import type { MatchState, PlayerId } from '../../engine/state';
import { LORD_NAMES, PLAYER_NAMES, REGION_NAMES } from '../../data/names';
import './playerPanel.css';

interface PlayerPanelProps {
  match: MatchState;
  player: PlayerId;
  selectedCaptainId: string | null;
  onSelectCaptain: (id: string) => void;
}

/** One player's side: their Lords in turn order and where each Captain is. */
export function PlayerPanel({ match, player, selectedCaptainId, onSelectCaptain }: PlayerPanelProps) {
  const order = match.players[player].lordOrder;
  const isTheirTurn = match.turn?.player === player;
  const selectable = new Set(isTheirTurn ? deployableCaptains(match).map((c) => c.id) : []);

  return (
    <aside className={`player-panel player-panel--${player}${isTheirTurn ? ' player-panel--active' : ''}`}>
      <h2 className="player-panel__name">{PLAYER_NAMES[player]}</h2>
      <p className="player-panel__status">
        {match.phase === 'lordOrder'
          ? match.orderingPlayer === player
            ? 'Ordering Lords'
            : order
              ? 'Lords in position'
              : 'Waiting to order Lords'
          : isTheirTurn
            ? 'Taking their turn'
            : 'Waiting'}
      </p>

      {order && (
        <ol className="player-panel__lords">
          {order.map((lord, i) => {
            const active = isTheirTurn && match.turn?.lord === lord;
            return (
              <li key={lord} className={`lord-row${active ? ' lord-row--active' : ''}`}>
                <div className="lord-row__header">
                  <span className="lord-row__position">{i + 1}</span>
                  <span className="lord-row__name">{LORD_NAMES[lord]}</span>
                </div>
                <ul className="lord-row__captains">
                  {captainsOf(match, player, lord).map((captain) => {
                    const canPick = selectable.has(captain.id);
                    const where = captain.region === null ? 'Ready' : REGION_NAMES[captain.region];
                    const label = `Captain ${captain.rank === 1 ? 'I' : 'II'}`;
                    return (
                      <li key={captain.id}>
                        {canPick ? (
                          <button
                            className={`captain-chip captain-chip--pickable${
                              selectedCaptainId === captain.id ? ' captain-chip--selected' : ''
                            }`}
                            onClick={() => onSelectCaptain(captain.id)}
                          >
                            <span>{label}</span>
                            <span className="captain-chip__where">{where}</span>
                          </button>
                        ) : (
                          <span className={`captain-chip${captain.region === null ? '' : ' captain-chip--deployed'}`}>
                            <span>{label}</span>
                            <span className="captain-chip__where">{where}</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
