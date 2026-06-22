#!/usr/bin/env python3
"""Synthesize tracks/melodic-demo.wav — a ~24s melodic piece to showcase HUE and
PALETTE. Hue auto-shifts with the spectral centroid (pitch/brightness), so this
track arcs dark→bright→dark (low warm pad → high sparkling bells/lead → resolve)
to travel the centroid; strong soft→dense dynamics sweep the palette's colour
ramp (sparse colour → core colour). Best seen on a procedural palette
(Plasma/Nebula/Inferno/Aurora), which respond to uHue.

    python3 make_melodic_demo.py             # writes tracks/melodic-demo.wav
    python3 make_melodic_demo.py --selftest
"""
import os, sys, wave
import numpy as np

SR, DUR, BPM = 44100, 24.0, 100.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT                      # 2.4 s
N = int(SR * DUR)
rng = np.random.default_rng(5)

# A natural minor note table (Hz)
NOTE = {
    'A2': 110.00, 'B2': 123.47, 'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00,
    'A3': 220.00, 'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00,
    'A4': 440.00, 'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
    'F2': 87.31, 'G2': 98.00,
}


def saw(f, tt):
    return 2 * (f * tt - np.floor(0.5 + f * tt))


def build():
    buf = np.zeros(N + SR)

    def add(sig, start):
        i = int(start * SR)
        buf[i:i + len(sig)] += sig

    def ar(n, atk, rel):
        e = np.ones(n)
        na, nr = max(1, int(atk * SR)), max(1, int(rel * SR))
        e[:na] = np.linspace(0, 1, na)
        e[-nr:] *= np.linspace(1, 0, nr)
        return e

    def pad(length, freqs, amp=0.22, bright=0.12):
        # sustained warm chord (sines + a little saw), slow attack/release — low centroid
        n = int(length * SR); tt = np.arange(n) / SR
        sig = sum(np.sin(2 * np.pi * f * tt) + bright * saw(f, tt) for f in freqs) / len(freqs)
        return amp * sig * ar(n, 0.25 * length, 0.3 * length)

    def pluck(length, f, amp=0.22, bright=0.6):
        # arpeggio note: bright-ish, fast decay
        n = int(length * SR); tt = np.arange(n) / SR
        sig = (1 - bright) * np.sin(2 * np.pi * f * tt) + bright * saw(f, tt)
        return amp * sig * np.exp(-tt * 7) * np.minimum(1, tt * 400)

    def bell(length, f, amp=0.20):
        # inharmonic sparkle high up — lots of treble energy => pushes the centroid (hue) up
        n = int(length * SR); tt = np.arange(n) / SR
        sig = np.sin(2*np.pi*f*tt) + 0.5*np.sin(2*np.pi*2.76*f*tt) + 0.3*np.sin(2*np.pi*5.4*f*tt)
        return amp * sig * np.exp(-tt * 4.5)

    def lead(length, f, amp=0.24):
        # singing lead with vibrato (bright saw) — the melody up high
        n = int(length * SR); tt = np.arange(n) / SR
        vib = 1 + 0.012 * np.sin(2 * np.pi * 5.5 * tt)
        return amp * saw(f * vib, tt) * ar(n, 0.03, 0.25 * length)

    def soft(length, f, amp=0.18):
        # near-pure sine voice — almost no harmonics, keeps the dark intro's centroid low
        n = int(length * SR); tt = np.arange(n) / SR
        return amp * (np.sin(2*np.pi*f*tt) + 0.1*np.sin(2*np.pi*2*f*tt)) * ar(n, 0.06, 0.4 * length)

    def bass(length, f, amp=0.28):
        n = int(length * SR); tt = np.arange(n) / SR
        return amp * (np.sin(2*np.pi*f*tt) + 0.15*saw(f, tt)) * ar(n, 0.02, 0.3 * length)

    def kick(amp=0.5):
        n = int(0.2 * SR); tt = np.arange(n) / SR
        return amp * np.sin(2*np.pi*(48 + 60*np.exp(-tt*30))*tt) * np.exp(-tt*16)

    def hat(amp=0.08):
        n = int(0.03 * SR)
        return amp * np.diff(rng.standard_normal(n), prepend=0) * np.exp(-np.arange(n)/SR*80)

    def arp(notes, start, end, octave=1.0, amp=0.2, step=None):
        step = step or BEAT / 2
        i = 0; t = start
        while t < end:
            add(pluck(step * 1.6, notes[i % len(notes)] * octave, amp), t)
            t += step; i += 1

    # i-VI-III-VII in A minor, one chord per bar (low voicing for the pad + bass root)
    prog = [['A2','C3','E3'], ['F2','A2','C3'], ['C3','E3','G3'], ['G2','B2','D3']]
    roots = ['A2', 'F2', 'C3', 'G2']
    chord_tones = [['A3','C4','E4'], ['F3','A3','C4'], ['C4','E4','G4'], ['G3','B3','D4']]

    # pad + bass on every bar (the harmonic bed); tapered in the bright section so the
    # high content can dominate the spectrum there and push the centroid (hue) up
    for b in range(10):
        ch = prog[b % 4]
        pamp = 0.12 if 6 <= b <= 8 else 0.22
        bamp = 0.13 if 6 <= b <= 8 else 0.26
        add(pad(BAR * 0.98, [NOTE[n] for n in ch], amp=pamp), b * BAR)
        add(bass(BAR * 0.9, NOTE[roots[b % 4]], amp=bamp), b * BAR)

    # ---- bars 0–2 (dark): slow mellow SINE melody, low register (low centroid) ----
    mel_low = ['E4','D4','C4','D4','E4','G4','E4','D4','C4','B3','C4','A3']
    for k, t in enumerate(np.arange(0.0, 3 * BAR, BEAT)):
        add(soft(BEAT * 1.4, NOTE[mel_low[k % len(mel_low)]] * 0.5, amp=0.2), t)  # octave down, pure tone

    # ---- bars 3–5 (brighter): mid arpeggios come in, melody rises ----
    for b in range(3, 6):
        arp([NOTE[n] for n in chord_tones[b % 4]], b * BAR, (b + 1) * BAR, amp=0.18)
    for k, t in enumerate(np.arange(3 * BAR, 6 * BAR, BEAT)):
        add(lead(BEAT * 1.2, NOTE[mel_low[k % len(mel_low)]], amp=0.2), t)         # now at pitch
        add(kick(0.4), t)                                                          # gentle pulse begins

    # ---- bars 6–8 (brightest): high sparkling bells + high arps + soaring lead (centroid peak -> hue travels most) ----
    bright_mel = ['A4','C5','B4','A4','G4','E4','G4','A4','C5','E5','D5','C5']
    for b in range(6, 9):
        arp([NOTE[n] for n in chord_tones[b % 4]], b * BAR, (b + 1) * BAR, octave=2.0, amp=0.2, step=BEAT/4)   # high 16th shimmer
    for k, t in enumerate(np.arange(6 * BAR, 9 * BAR, BEAT / 2)):
        add(bell(BEAT * 1.3, NOTE[bright_mel[k % len(bright_mel)]] * 2, amp=0.22), t)    # high bells (treble-rich)
    for k, t in enumerate(np.arange(6 * BAR, 9 * BAR, BEAT)):
        add(lead(BEAT * 1.1, NOTE[bright_mel[k % len(bright_mel)]], amp=0.22), t)
        add(hat(0.09), t); add(hat(0.07), t + BEAT/2)                                    # airy hats add treble

    # ---- bar 9 (resolve): descend back down, fade the highs, land on a warm low chord ----
    for k, n in enumerate(['E4', 'C4', 'A3', 'E3']):
        add(lead(BEAT * 1.4, NOTE[n], amp=0.18 - 0.02*k), 9 * BAR + k * BEAT * 0.5)
    add(pad(2.4, [NOTE['A2'], NOTE['C3'], NOTE['E3']], amp=0.28), 9 * BAR)             # final Am pad swell

    out = buf[:N]
    out = np.tanh(out * 1.1)
    out = out / np.max(np.abs(out)) * 0.92
    return out.astype(np.float32)


def _centroid_hz(a):
    """Per-frame spectral centroid over 80–8000 Hz (Hz) — what the app maps to hue."""
    win, hop = 2048, SR / 60.0
    f = np.fft.rfftfreq(win, 1 / SR); m = (f >= 80) & (f <= 8000)
    fb = f[m]
    nf = int((len(a) - win) / hop)
    out = np.empty(nf)
    for k in range(nf):
        X = np.abs(np.fft.rfft(a[int(k*hop):int(k*hop)+win] * np.hanning(win)))[m]
        out[k] = np.sum(fb * X) / (np.sum(X) + 1e-9)
    return out


def selftest():
    a = build()
    assert len(a) == N, len(a)
    assert 0.85 <= np.max(np.abs(a)) <= 1.0, np.max(np.abs(a))
    cen = _centroid_hz(a)
    fps = 60.0
    intro = cen[:int(3 * BAR * fps)].mean()
    bright = cen[int(6 * BAR * fps):int(9 * BAR * fps)].mean()
    # hue is driven by the centroid — it must travel a lot, and rise from dark intro to bright peak
    assert bright > intro * 1.8, f'centroid arc too flat (intro {intro:.0f} -> bright {bright:.0f} Hz)'
    assert (cen.max() - cen.min()) > 2000, f'centroid range too small ({cen.max()-cen.min():.0f} Hz)'
    # the volume should breathe (swells + note dynamics) so density — and thus the
    # palette's colour ramp — moves; use a slow envelope so sustained pads don't mask it
    env = np.convolve(np.abs(a), np.ones(int(0.2*SR))/int(0.2*SR), 'same')
    env = env[int(0.3*SR):int((DUR-0.3)*SR)]                  # drop the silent head/tail ramp
    assert env.max() / (env.min() + 1e-9) > 1.8, f'too flat for the palette ramp ({env.max()/env.min():.1f})'
    print(f'selftest ok — centroid {intro:.0f}->{bright:.0f} Hz (range {cen.max()-cen.min():.0f}), level x{env.max()/env.min():.1f}')


def write_wav(path, mono):
    pcm = (mono * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.repeat(pcm[:, None], 2, axis=1).tobytes())


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest(); sys.exit(0)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tracks', 'melodic-demo.wav')
    write_wav(out, build())
    print('wrote', out)
