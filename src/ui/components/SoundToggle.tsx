import { useEffect, useState } from 'react';
import { getSoundSettings, onSoundSettings, setSoundSettings } from '../../audio/sound';

/** Sound on/off, remembered between visits. `inline` sits in the match's top bar instead of the corner. */
export function SoundToggle({ inline = false }: { inline?: boolean }) {
  const [muted, setMuted] = useState(getSoundSettings().muted);
  useEffect(() => onSoundSettings((s) => setMuted(s.muted)), []);
  return (
    <button
      className={inline ? 'top-bar__button top-bar__sound' : 'sound-toggle'}
      onClick={() => setSoundSettings({ muted: !muted })}
      aria-pressed={muted}
      title={muted ? 'Turn sound on' : 'Turn sound off'}
    >
      Sound: {muted ? 'Off' : 'On'}
    </button>
  );
}
