/**
 * Sound system. Every sound effect is downloaded and decoded once, at startup
 * (see the loading screen), and kept in memory as an AudioBuffer, so playing
 * one later starts within a few milliseconds and never waits on the network.
 * Music streams instead (long files), with a short fade.
 *
 * Browsers keep audio locked until the player interacts with the page; the
 * first click or key press unlocks it.
 *
 * Sound files live in src/assets/sounds, named after the sound (e.g.
 * slash.wav). Replacing a file with a real sound of the same name is all it
 * takes; .wav, .ogg and .mp3 all work.
 */

const FILES = import.meta.glob('../assets/sounds/*.{wav,ogg,mp3}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Music tracks in src/assets/music (kept out of git; may be absent). */
const MUSIC = import.meta.glob('../assets/music/*.{mp3,ogg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** URL of a music track by file name (e.g. 'battle-theme'), or null if that file isn't there. */
export function musicUrl(name: string): string | null {
  const entry = Object.entries(MUSIC).find(([path]) => path.split('/').pop()!.replace(/\.(mp3|ogg)$/, '') === name);
  return entry ? entry[1] : null;
}

/** Every music file, so the loading screen can fetch them into the cache ahead of time. */
export const MUSIC_URLS = Object.values(MUSIC);

/** Sound effects, by file name. */
export type SoundName =
  | 'ui-click'
  | 'select'
  | 'place'
  | 'slash'
  | 'hit'
  | 'clash'
  | 'kill'
  | 'die-roll'
  | 'die-land'
  | 'turn'
  | 'secure'
  | 'victory'
  | 'defeat'
  | 'retreat'
  | 'modal'
  | 'heal'
  | 'sabotage'
  | 'zoom'
  | 'archer'
  | 'second-pass'
  | 'confirm'
  | 'captain'
  | 'turn-change'
  | 'card-flip'
  | 'heist';

export interface SoundSettings {
  muted: boolean;
  /** 0 to 1. */
  effects: number;
  music: number;
}

const SETTINGS_KEY = 'crusader-world.sound';
const DEFAULTS: SoundSettings = { muted: false, effects: 0.8, music: 0.5 };

function loadSettings(): SoundSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULTS, ...(JSON.parse(saved) as Partial<SoundSettings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let effectsGain: GainNode | null = null;
let musicGain: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
let settings = loadSettings();
const listeners = new Set<(s: SoundSettings) => void>();
let music: { el: HTMLAudioElement; node: MediaElementAudioSourceNode } | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  effectsGain = ctx.createGain();
  musicGain = ctx.createGain();
  effectsGain.connect(master);
  musicGain.connect(master);
  master.connect(ctx.destination);
  applySettings();
  return ctx;
}

function applySettings() {
  if (!ctx || !master || !effectsGain || !musicGain) return;
  const now = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, now, 0.02);
  effectsGain.gain.setTargetAtTime(settings.effects, now, 0.02);
  musicGain.gain.setTargetAtTime(settings.music, now, 0.02);
}

function nameOf(path: string): string {
  return path.split('/').pop()!.replace(/\.(wav|ogg|mp3)$/, '');
}

/** Every sound file the game ships with, for the loading screen to count. */
export const SOUND_COUNT = Object.keys(FILES).length;

/**
 * Download and decode every sound effect. Calls onEach after each one so the
 * loading screen can show progress. A sound that fails to load is skipped
 * (the game simply plays nothing for it).
 */
export async function loadSounds(onEach?: () => void): Promise<void> {
  const audio = context();
  await Promise.all(
    Object.entries(FILES).map(async ([path, url]) => {
      try {
        if (audio) {
          const data = await (await fetch(url)).arrayBuffer();
          buffers.set(nameOf(path), await audio.decodeAudioData(data));
        }
      } catch {
        // Missing or unreadable file: stay silent for that sound.
      } finally {
        onEach?.();
      }
    }),
  );
}

/** Unlock audio on the player's first interaction (browsers require one). */
export function unlockOnFirstInput() {
  const unlock = () => {
    void context()?.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/** Play a sound effect now. Overlapping plays of the same sound are fine. */
export function play(name: SoundName, options: { volume?: number; rate?: number } = {}) {
  const audio = context();
  const buffer = buffers.get(name);
  if (!audio || !buffer || !effectsGain || settings.muted || audio.state !== 'running') return;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = options.rate ?? 1;
  const gain = audio.createGain();
  gain.gain.value = options.volume ?? 1;
  source.connect(gain).connect(effectsGain);
  source.start();
}

/** Start a music track (streamed, looping), fading out any current one. */
export function playMusic(url: string) {
  const audio = context();
  if (!audio || !musicGain) return;
  stopMusic();
  const el = new Audio(url);
  el.loop = true;
  el.crossOrigin = 'anonymous';
  const node = audio.createMediaElementSource(el);
  node.connect(musicGain);
  music = { el, node };
  void el.play().catch(() => {});
}

export function stopMusic() {
  if (!music) return;
  const { el, node } = music;
  music = null;
  el.pause();
  node.disconnect();
}

export function getSoundSettings(): SoundSettings {
  return settings;
}

export function setSoundSettings(change: Partial<SoundSettings>) {
  settings = { ...settings, ...change };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: the setting just won't be remembered.
  }
  applySettings();
  listeners.forEach((l) => l(settings));
}

export function onSoundSettings(listener: (s: SoundSettings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
