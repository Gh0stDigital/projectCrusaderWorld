import { useEffect, useState } from 'react';
import { getSoundSettings, onSoundSettings, setSoundSettings } from '../../audio/sound';

/** Sound on/off, remembered between visits. */
export function SoundToggle() {
  const [muted, setMuted] = useState(getSoundSettings().muted);
  useEffect(() => onSoundSettings((s) => setMuted(s.muted)), []);
  return (
    <button
      className="sound-toggle"
      onClick={() => setSoundSettings({ muted: !muted })}
      aria-pressed={muted}
      title={muted ? 'Turn sound on' : 'Turn sound off'}
    >
      Sound: {muted ? 'Off' : 'On'}
    </button>
  );
}
