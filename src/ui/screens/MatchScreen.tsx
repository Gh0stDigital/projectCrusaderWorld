import { useAppStore } from '../../store/appStore';
import { Card, type CardOwner } from '../components/Card';
import './match.css';

const GENERALS = ['Army', 'Garrison', 'Raiders'] as const;
const PHASES = ['Command', 'Placement', 'Attack', 'Battle', 'End'] as const;

/** Sample squares to check card sizing on the board. Not real game state. */
const SAMPLE_BOARD: (CardOwner | null)[] = ['p1', null, 'p2', null, 'p1', null, 'p2', null, null];

/**
 * Layout preview of the match screen: the zones are final, the contents are
 * placeholders until the rules engine exists.
 */
export function MatchScreen() {
  const goTo = useAppStore((s) => s.goTo);

  return (
    <div className="match">
      <header className="match__top-bar">
        <button className="top-bar__button" onClick={() => goTo('mainMenu')}>
          Menu
        </button>
        <span className="top-bar__title">Exhibition · layout preview</span>
        <span className="top-bar__turn">Turn —</span>
      </header>

      <PlayerPanel side="p1" name="Player" />

      <main className="match__board-stage">
        <div className="territory-board">
          {SAMPLE_BOARD.map((owner, i) => (
            <div className="territory-board__cell" key={i}>
              {owner && <Card art="militia" size="board" owner={owner} alt="Knight" />}
            </div>
          ))}
        </div>
      </main>

      <PlayerPanel side="p2" name="Computer" />

      <footer className="match__phase-window">
        <ol className="phase-list">
          {PHASES.map((phase) => (
            <li key={phase} className="phase-list__item">
              {phase}
            </li>
          ))}
        </ol>
        <button className="btn btn--primary phase-window__end-turn">End turn</button>
      </footer>
    </div>
  );
}

function PlayerPanel({ side, name }: { side: CardOwner; name: string }) {
  return (
    <aside className={`player-panel player-panel--${side}`}>
      <h2 className="player-panel__name">{name}</h2>
      <p className="player-panel__king">The King's forces</p>
      <ul className="player-panel__generals">
        {GENERALS.map((general) => (
          <li key={general} className="general-row">
            <span className="general-row__name">{general}</span>
            <span className="general-row__militia">— militia</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
