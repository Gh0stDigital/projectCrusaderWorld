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
  const fade = useAppStore((s) => s.fade);

  // A quiet click on every enabled button press; the confirmation sound on main buttons.
  useEffect(() => {
    const onPress = (e: PointerEvent) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      // Main (gold) buttons confirm something, as does placing a Lord in the turn order;
      // the die roll has its own sounds.
      const confirms =
        (button.classList.contains('btn--primary') && !button.classList.contains('decisive__roll')) ||
        button.classList.contains('lord-setup__choice');
      if (confirms) play('confirm');
      else play('ui-click', { volume: 0.5 });
    };
    window.addEventListener('pointerdown', onPress);
    return () => window.removeEventListener('pointerdown', onPress);
  }, []);

  // A blip whenever any pop-up window (role="dialog") opens.
  useEffect(() => {
    let last = 0;
    const observer = new MutationObserver((records) => {
      const opened = records.some((r) =>
        [...r.addedNodes].some(
          (n) => n instanceof HTMLElement && (n.matches('[role="dialog"]') || n.querySelector('[role="dialog"]')),
        ),
      );
      if (opened && performance.now() - last > 150) {
        last = performance.now();
        play('modal');
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <Stage>
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'title' && <TitleScreen />}
      {screen === 'mainMenu' && <MainMenuScreen />}
      {screen === 'match' && <MatchScreen />}
      {screen !== 'loading' && <SoundToggle />}
      {fade !== 'none' && <div className={`screen-fade screen-fade--${fade}`} aria-hidden="true" />}
    </Stage>
  );
}
