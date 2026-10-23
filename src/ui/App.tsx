import { useAppStore } from '../store/appStore';
import { Stage } from './stage/Stage';
import { TitleScreen } from './screens/TitleScreen';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { MatchScreen } from './screens/MatchScreen';

export function App() {
  const screen = useAppStore((s) => s.screen);

  return (
    <Stage>
      {screen === 'title' && <TitleScreen />}
      {screen === 'mainMenu' && <MainMenuScreen />}
      {screen === 'match' && <MatchScreen />}
    </Stage>
  );
}
