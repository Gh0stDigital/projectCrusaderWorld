import { useEffect, useState, type ReactNode } from 'react';
import './stage.css';

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;

/**
 * The fixed 1920x1080 game canvas. Everything inside is laid out in canvas
 * pixels, and the whole canvas is scaled evenly to fit the window.
 */
export function Stage({ children }: { children: ReactNode }) {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const onResize = () => setViewport(readViewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const scale = Math.min(viewport.width / STAGE_WIDTH, viewport.height / STAGE_HEIGHT);
  const tooSmall = viewport.width < MIN_WIDTH || viewport.height < MIN_HEIGHT;

  return (
    <div className="stage-frame">
      <div
        className="stage"
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
      {tooSmall && (
        <div className="stage-too-small" role="alert">
          <p>Make the window larger to play.</p>
          <p className="stage-too-small__hint">
            Crusader World needs at least {MIN_WIDTH}×{MIN_HEIGHT}.
          </p>
        </div>
      )}
    </div>
  );
}

function readViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}
