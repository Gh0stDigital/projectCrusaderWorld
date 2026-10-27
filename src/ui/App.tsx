import { useAppStore } from '../store/appStore';
import { Stage } from './stage/Stage';
import { TitleScreen } from './screens/TitleScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { SoundToggle } from './components/SoundToggle';
import { useEffect } from 'react';
import { play } from '../audio/sound';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { MatchScreen } from './screens/MatchScreen';

export function App() {
  const screen = useAppStore((s) => s.screen);

  // A quiet click on every enabled button press.
  useEffect(() => {
    const onPress = (e: PointerEvent) => {
      const button = (e.target as HTMLElement).closest('button');
      if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') play('ui-click', { volume: 0.5 });
    };
    window.addEventListener('pointerdown', onPress);
    return () => window.removeEventListener('pointerdown', onPress);
  }, []);

  return (
    <Stage>
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'title' && <TitleScreen />}
      {screen === 'mainMenu' && <MainMenuScreen />}
      {screen === 'match' && <MatchScreen />}
      {screen !== 'loading' && <SoundToggle />}
    </Stage>
  );
}
