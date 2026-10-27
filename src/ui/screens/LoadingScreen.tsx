import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { MUSIC_URLS, SOUND_COUNT, loadMusic, loadSounds } from '../../audio/sound';
import './screens.css';

/** Every image the game uses, found at build time. */
const IMAGES = Object.values(
  import.meta.glob('../../assets/**/*.{png,webp,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<
    string,
    string
  >,
);

/** Download and decode one image so it shows instantly later. A failure is skipped. */
async function loadImage(url: string): Promise<void> {
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    // Unreadable image: the game will just try again when it needs it.
  }
}

/**
 * First screen: loads every image, sound and the font before the game starts,
 * so nothing waits on the network once play begins. Then the title screen.
 */
export function LoadingScreen() {
  const goTo = useAppStore((s) => s.goTo);
  const total = IMAGES.length + SOUND_COUNT + MUSIC_URLS.length + 1;
  const [done, setDone] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const tick = () => !cancelled && setDone((n) => n + 1);
    void Promise.all([
      ...IMAGES.map((url) => loadImage(url).then(tick)),
      loadSounds(tick),
      loadMusic(tick),
      document.fonts.ready.then(tick),
    ]).then(() => {
      if (!cancelled) window.setTimeout(() => goTo('title'), 250);
    });
    return () => {
      cancelled = true;
    };
  }, [goTo]);

  const pct = Math.round((Math.min(done, total) / total) * 100);
  return (
    <div className="loading-screen" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <h1 className="title-screen__name">Crusader World</h1>
      <div className="loading-screen__bar">
        <span className="loading-screen__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="loading-screen__text">Mustering the troops… {pct}%</p>
    </div>
  );
}
