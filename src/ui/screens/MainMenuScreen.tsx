import { useAppStore } from '../../store/appStore';
import './screens.css';

/**
 * Milestone 1 has one mode: an exhibition match against the computer.
 * Continue, Settings, faction select and the rest arrive in later milestones.
 */
export function MainMenuScreen() {
  const goTo = useAppStore((s) => s.goTo);
  const startMatch = useAppStore((s) => s.startMatch);

  return (
    <div className="main-menu">
      <h1 className="main-menu__name">Crusader World</h1>
      <nav className="main-menu__options">
        <button className="btn btn--primary" autoFocus onClick={startMatch}>
          Exhibition vs computer
        </button>
        <button className="btn" onClick={() => goTo('title')}>
          Back to title
        </button>
      </nav>
    </div>
  );
}
