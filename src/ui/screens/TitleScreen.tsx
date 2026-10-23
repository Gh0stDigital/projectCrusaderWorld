import { useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import './screens.css';

export function TitleScreen() {
  const goTo = useAppStore((s) => s.goTo);

  useEffect(() => {
    const onKey = () => goTo('mainMenu');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo]);

  return (
    <button className="title-screen" onClick={() => goTo('mainMenu')}>
      <h1 className="title-screen__name">Crusader World</h1>
      <p className="title-screen__tagline">Conquer the road to the Holy Land</p>
      <p className="title-screen__prompt">Press any key to begin</p>
    </button>
  );
}
