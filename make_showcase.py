#!/usr/bin/env python3
"""Synthesize tracks/showcase.wav — a 20s demo that exercises every reactive
mapping of the visualizer: kicks->beats, sub->core/density, mid stabs->rotation,
hats->treble shimmer, risers + ascending arp->spectral-centroid hue sweeps.

    python3 make_showcase.py        # writes tracks/showcase.wav
    python3 make_showcase.py --selftest
"""
import os, sys, wave
import numpy as np

SR, DUR, BPM = 44100, 20.0, 128.0
BEAT = 60.0 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)


def build():
    buf = np.zeros(N + SR)  # pad tail so events near the end aren't clipped

    def add(sig, start):
        i = int(start * SR)
        buf[i:i + len(sig)] += sig

    def env(n, decay, attack=200):
        tt = np.arange(n) / SR
        return np.minimum(1.0, tt * attack) * np.exp(-tt * decay)

    def kick(amp=1.0):
        # punchy + short: a fast-decaying body so the bass band goes near-silent between
        # hits. That clean gap is what survives the analyser's dB compression and lets
        # each kick read as a transient the beat detector can trigger on.
        n = int(0.20 * SR); tt = np.arange(n) / SR
        pitch = 48 + (120 - 48) * np.exp(-tt * 30)            # snappy pitch drop
        body = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-tt * 16)
        click = np.exp(-tt * 900) * 0.5                       # attack transient
        return amp * (body + click)

    def bassline(length, f, amp=0.3):
        # melodic bass up in the mid band (saw, two octaves up) — adds movement and drives
        # rotation, while leaving the 20-160 Hz beat band to the kick alone (clean gaps).
        n = int(length * SR); tt = np.arange(n) / SR
        return amp * saw(f * 4, tt) * env(n, 8.0)

    def saw(f, tt):
        return 2 * (f * tt - np.floor(0.5 + f * tt))

    def stab(freqs, amp=0.30, length=0.22):
        n = int(length * SR); tt = np.arange(n) / SR
        s = sum(saw(f, tt) for f in freqs) / len(freqs)
        return amp * s * env(n, 7)

    def hat(amp=0.22, length=0.05):
        n = int(length * SR)
        x = np.diff(rng.standard_normal(n), prepend=0)        # crude HP -> treble
        return amp * x * np.exp(-np.arange(n) / SR * 60)

    def clap(amp=0.35):
        n = int(0.18 * SR)
        x = np.diff(rng.standard_normal(n), prepend=0)
        return amp * x * np.exp(-np.arange(n) / SR * 22)

    def crash(amp=0.45, length=1.4):
        n = int(length * SR)
        x = np.diff(rng.standard_normal(n), prepend=0)
        return amp * x * np.exp(-np.arange(n) / SR * 3.2)

    def riser(length, amp=0.4, f0=300, oct_up=4.0):
        n = int(length * SR); tt = np.arange(n) / SR
        swell = (tt / length) ** 1.6
        noise = np.diff(rng.standard_normal(n), prepend=0)
        fr = f0 * 2 ** (tt / length * oct_up)                 # rising sweep -> centroid up
        sweep = np.sin(2 * np.pi * np.cumsum(fr) / SR)
        return amp * swell * (0.6 * noise + 0.5 * sweep)

    # roots (minor vibe) and a mid chord for stabs
    A1, C2, E2, G1 = 55.0, 65.4, 82.4, 49.0
    bass_pat = [A1, A1, C2, E2, A1, A1, G1, E2]
    chord = [220.0, 261.6, 329.6]                             # A min triad (mid band)

    # ---- intro / build (0–3s): riser sweeps centroid up, soft sub swell ----
    add(riser(3.0, amp=0.42), 0.0)
    ns = int(2.2 * SR); ts = np.arange(ns) / SR
    add(0.28 * np.sin(2 * np.pi * (A1 / 2) * ts) * np.minimum(1, ts * 2) * np.exp(-ts * 0.3), 0.5)
    for b in (4, 5):                                          # two pickup kicks into the drop
        add(kick(0.9), b * BEAT)

    # ---- DROP A (3–11s): full kit, every band firing ----
    a0, a1 = 3.0, 11.0
    add(crash(0.5), a0)
    b = a0
    i = 0
    while b < a1:
        add(kick(1.2), b)                                    # 4-on-floor -> clean beats
        add(bassline(BEAT * 0.9, bass_pat[i % len(bass_pat)], 0.3), b)
        add(hat(0.18), b + BEAT * 0.5)                       # offbeat hat
        add(hat(0.12), b + BEAT * 0.25)
        add(hat(0.12), b + BEAT * 0.75)
        if i % 2 == 1:
            add(clap(0.33), b)                               # backbeat
        add(stab(chord, 0.26), b + BEAT * 0.5)              # mid stab -> rotation
        b += BEAT; i += 1

    # ---- breakdown (11–12.5s): drums drop out, energy falls (AGC adapts, beat resets) ----
    add(stab(chord, 0.22, length=1.3), 11.0)
    add(riser(1.4, amp=0.45, f0=400, oct_up=4.5), 11.2)

    # ---- DROP B (12.5–20s): harder, ascending bright arp = big hue sweep, denser hats ----
    b0, b1 = 12.5, 20.0
    add(crash(0.55), b0)
    b = b0; i = 0
    while b < b1:
        add(kick(1.25), b)
        add(bassline(BEAT * 0.9, bass_pat[i % len(bass_pat)], 0.32), b)
        for k in range(4):                                   # 16th-note hats -> shimmer
            add(hat(0.16 if k == 0 else 0.1), b + BEAT * 0.25 * k)
        if i % 2 == 1:
            add(clap(0.36), b)
        b += BEAT; i += 1
    # ascending arpeggio across the whole final drop: pitch climbs ~3 octaves -> hue rotates
    scale = [220.0, 261.6, 329.6, 392.0, 440.0]
    step = BEAT / 4                                          # 16th notes
    steps = int((b1 - b0) / step)
    for s in range(steps):
        f = scale[s % len(scale)] * 2 ** (s / steps * 3.0)  # global rise over the section
        amp = 0.18 + 0.12 * (s / steps)                     # gets louder/brighter
        add(stab([f, f * 2], amp, length=step * 1.6), b0 + s * step)
    add(riser(2.0, amp=0.5, f0=500, oct_up=4.0), 17.0)      # final build
    add(crash(0.6, 1.6), 19.0)                              # climax hit

    out = buf[:N]
    out = np.tanh(out * 1.1)                                # glue / soft limit
    out = out / np.max(np.abs(out)) * 0.95                  # normalize with headroom
    return out.astype(np.float32)


def write_wav(path, mono):
    pcm = (mono * 32767).astype(np.int16)
    stereo = np.repeat(pcm[:, None], 2, axis=1).tobytes()   # dual-mono
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(stereo)


def _centroid(x):
    """Magnitude-weighted spectral centroid over 80–8000 Hz — what drives the hue."""
    X = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = (f >= 80) & (f <= 8000)
    return np.sum(f[m] * X[m]) / (np.sum(X[m]) + 1e-9)


def count_beats(a, snap=0.3, agc_decay=0.995, floor_mul=1.0):
    """Predict the app's beat detector, modelling the two things that actually gate it:
    the AnalyserNode's temporal smoothing AND its dB/byte compression (which lifts the
    'gap' floor so only a near-silent low end between kicks reads as a transient).
    Chain: bass (20-160 Hz) magnitude → temporal smooth → dB→byte → per-band AGC →
    attack-fast/decay-slow → trigger when bass > 1.35x running avg."""
    win, hop = 2048, SR / 60.0
    f = np.fft.rfftfreq(win, 1 / SR); m = (f >= 20) & (f <= 160)
    nf = int((len(a) - win) / hop)
    mag = np.array([np.mean(np.abs(np.fft.rfft(a[int(k*hop):int(k*hop)+win] * np.hanning(win)))[m]) for k in range(nf)])
    # analyser temporal smoothing (smoothingTimeConstant, loosened by snap)
    stc = 0.78 - snap * 0.45
    sm = np.empty_like(mag); acc = 0.0
    for i, v in enumerate(mag):
        acc = stc * acc + (1 - stc) * v; sm[i] = acc
    # dB → byte(0..1) over a 70 dB window, like getByteFrequencyData
    db = 20 * np.log10(sm + 1e-12)
    top = np.percentile(db, 99)                               # ~maxDecibels anchor
    byte = np.clip((db - (top - 70)) / 70, 0, 1)
    dec = 0.86 - snap * 0.40
    peak, band, bass_avg, beats, prev_cond = 0.35, 0.0, 0.0, 0, False
    for r in byte:
        peak = max(r, peak * agc_decay, 0.35 * floor_mul)
        g = min(1.0, r / peak)
        band = g if g > band else band * dec + g * (1 - dec)  # attack-fast, decay-slow
        cond = band > bass_avg * 1.35 and band > 0.25         # the app's beat trigger
        if cond and not prev_cond:
            beats += 1                                        # count each rising edge
        prev_cond = cond
        bass_avg = bass_avg * 0.92 + band * 0.08
    return beats


def selftest():
    a = build()
    assert len(a) == N, len(a)
    assert 0.9 <= np.max(np.abs(a)) <= 1.0, np.max(np.abs(a))
    # the hue follows the spectral centroid — assert it sweeps meaningfully over the piece
    cs = [_centroid(a[int(s * SR):int((s + 0.5) * SR)]) for s in np.arange(0, 19.5, 0.5)]
    rng_hz = max(cs) - min(cs)
    assert rng_hz > 600, f'hue barely moves: centroid range only {rng_hz:.0f} Hz'
    # reliable beats: the detector sees the bass band only, so low-pass (<180 Hz)
    # then check the envelope is peaky (kick transients stand above the sustained floor)
    seg = a[int(3 * SR):int(11 * SR)]
    X = np.fft.rfft(seg); f = np.fft.rfftfreq(len(seg), 1 / SR)
    X[f > 180] = 0
    e = np.abs(np.fft.irfft(X))
    win = np.ones(int(0.02 * SR)) / int(0.02 * SR)
    e = np.convolve(e, win, 'same')
    peakiness = e.max() / (np.median(e) + 1e-9)
    assert peakiness > 2.5, f'bass not punchy enough for beat detection ({peakiness:.1f})'
    # the kicks must actually register as beats through the real detection chain
    beats = count_beats(a)
    assert beats > 18, f'too few beats detected ({beats}) — kicks not standing out'
    print(f'selftest ok — centroid {min(cs):.0f}->{max(cs):.0f} Hz, peakiness {peakiness:.1f}, beats {beats}')


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest(); sys.exit(0)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tracks', 'showcase.wav')
    write_wav(out, build())
    print('wrote', out)
