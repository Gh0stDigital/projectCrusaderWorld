"""Writes simple 8-bit style placeholder sound effects to src/assets/sounds.
Replace any file with a real sound of the same name; the game picks it up as is.
Run: python tools/make_placeholder_sounds.py
"""
import math, random, struct, wave, os

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'sounds')
random.seed(7)

def square(f, t):
    return 1.0 if math.sin(2 * math.pi * f * t) >= 0 else -1.0

def env(t, dur, attack=0.005, release=None):
    release = dur * 0.6 if release is None else release
    if t < attack:
        return t / attack
    left = dur - t
    return max(0.0, min(1.0, left / release))

def tone(freqs, dur, wave_fn=square, vol=0.35, slide=0.0):
    """Notes played one after another: freqs is a list of (freq, seconds)."""
    out = []
    for f, d in freqs:
        n = int(RATE * d)
        for i in range(n):
            t = i / RATE
            fr = f * (1 + slide * t / d)
            out.append(wave_fn(fr, t) * env(t, d) * vol)
    return out

def noise(dur, vol=0.4, lowpass=0.5, sweep=0.0):
    out, prev = [], 0.0
    n = int(RATE * dur)
    for i in range(n):
        t = i / RATE
        a = max(0.02, min(1.0, lowpass + sweep * t / dur))
        prev = prev + a * (random.uniform(-1, 1) - prev)
        out.append(prev * env(t, dur, release=dur * 0.8) * vol)
    return out

def mix(*parts):
    n = max(len(p) for p in parts)
    return [sum(p[i] for p in parts if i < len(p)) for i in range(n)]

def silence(d):
    return [0.0] * int(RATE * d)

def write(name, samples):
    path = os.path.join(OUT, name + '.wav')
    with wave.open(path, 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 32000)) for s in samples))
    print(name, os.path.getsize(path))

sine = lambda f, t: math.sin(2 * math.pi * f * t)

write('ui-click', tone([(1400, 0.03)], 0.03, vol=0.25))
write('select', tone([(880, 0.04), (1320, 0.05)], 0, vol=0.2))
write('place', mix(tone([(140, 0.12)], 0, sine, vol=0.6, slide=-0.5), noise(0.08, 0.25, 0.3)))
write('slash', noise(0.18, 0.5, 0.9, sweep=-0.85))
write('hit', mix(tone([(90, 0.18)], 0, sine, vol=0.7, slide=-0.6), noise(0.12, 0.35, 0.25)))
write('clash', mix(tone([(1046, 0.25)], 0, sine, vol=0.25), tone([(1568, 0.22)], 0, sine, vol=0.18), noise(0.05, 0.3, 0.9)))
write('die-roll', sum([noise(0.03, 0.35, 0.7) + silence(random.uniform(0.02, 0.05)) for _ in range(8)], []))
write('die-land', mix(tone([(220, 0.08)], 0, sine, vol=0.5, slide=-0.3), noise(0.05, 0.3, 0.6)))
write('turn', tone([(660, 0.08), (990, 0.14)], 0, sine, vol=0.3))
write('secure', tone([(523, 0.12), (659, 0.12), (784, 0.12), (1046, 0.3)], 0, vol=0.28))
write('victory', tone([(523, 0.15), (523, 0.15), (523, 0.15), (659, 0.3), (784, 0.15), (1046, 0.5)], 0, vol=0.28))
write('defeat', tone([(392, 0.25), (370, 0.25), (349, 0.25), (262, 0.6)], 0, vol=0.28))
write('retreat', tone([(700, 0.35)], 0, sine, vol=0.3, slide=-0.6))
write('report', tone([(523, 0.1), (392, 0.18)], 0, sine, vol=0.3))
write('kill', mix(tone([(200, 0.4)], 0, vol=0.3, slide=-0.7), noise(0.3, 0.3, 0.4)))
