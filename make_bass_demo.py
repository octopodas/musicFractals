#!/usr/bin/env python3
"""Synthesize tracks/bass-demo.wav — a ~24s demo that showcases the app's response
to COMPLEX bass. Where showcase.wav keeps bass simple so beats pop, this one fills
the 20-160 Hz band with evolving, syncopated, modulated low end (rolling subs,
wobble/growl bass, detuned reese) so uBass — which drives density, core throb and
the overall reactBoost — is constantly moving.

    python3 make_bass_demo.py             # writes tracks/bass-demo.wav
    python3 make_bass_demo.py --selftest
"""
import os, sys, wave
import numpy as np

SR, DUR, BPM = 44100, 24.0, 140.0
BEAT = 60.0 / BPM
STEP = BEAT / 4.0                      # 16th note
N = int(SR * DUR)
rng = np.random.default_rng(11)

# A natural-minor-ish bass riff (Hz), low octave
A1, B1, C2, D2, E2, F2, G1 = 55.00, 61.74, 65.41, 73.42, 82.41, 87.31, 49.00


def saw(f, tt):
    return 2 * (f * tt - np.floor(0.5 + f * tt))


def env(n, attack=400, decay=2.0):
    tt = np.arange(n) / SR
    return np.minimum(1.0, tt * attack) * np.exp(-tt * decay)


def build():
    buf = np.zeros(N + SR)

    def add(sig, start):
        i = int(start * SR)
        buf[i:i + len(sig)] += sig

    def sub(length, f0, f1=None, amp=0.7, decay=3.0):
        # sine sub (+2nd harmonic for body); optional pitch glide f0->f1 (808 slide)
        n = int(length * SR); tt = np.arange(n) / SR
        f = np.full(n, f0) if f1 is None else f0 * (f1 / f0) ** np.minimum(1.0, tt / length)
        ph = 2 * np.pi * np.cumsum(f) / SR
        return amp * (np.sin(ph) + 0.30 * np.sin(2 * ph)) * env(n, decay=decay)

    def wobble(length, f, rate, amp=0.75):
        # growl/wobble: an LFO opens harmonics (dark sine <-> bright saw) and pumps the
        # amplitude — energy sweeps between the bass and low-mid bands at `rate` Hz
        n = int(length * SR); tt = np.arange(n) / SR
        lfo = 0.5 + 0.5 * np.sin(2 * np.pi * rate * tt - np.pi / 2)
        ph = 2 * np.pi * f * tt
        dark = np.sin(ph) + 0.2 * np.sin(2 * ph)
        tone = (1 - lfo) * dark + lfo * saw(f, tt)
        pump = lfo ** 3                                        # deep gate: troughs near silence so uBass wobbles hard
        return amp * tone * pump * env(n, decay=0.5)

    def reese(length, f, amp=0.5, decay=6.0):
        # detuned saws beat against each other -> a moving, gnarly neuro bass (plucky)
        n = int(length * SR); tt = np.arange(n) / SR
        s = (saw(f, tt) + saw(f * 1.007, tt) + saw(f * 0.993, tt)) / 3
        s = 0.6 * s + 0.4 * np.sin(2 * np.pi * f * tt)         # tame the very top
        return amp * s * env(n, decay=decay)

    def kick(amp=0.9):
        n = int(0.22 * SR); tt = np.arange(n) / SR
        pitch = 50 + 70 * np.exp(-tt * 30)
        return amp * (np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-tt * 14) + 0.4 * np.exp(-tt * 900))

    def snare(amp=0.5):
        n = int(0.2 * SR); t = np.arange(n) / SR
        noise = np.diff(rng.standard_normal(n), prepend=0) * np.exp(-t * 22)
        tone = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 30)
        return amp * (0.7 * noise + 0.5 * tone)

    def hat(amp=0.16):
        n = int(0.04 * SR)
        return amp * np.diff(rng.standard_normal(n), prepend=0) * np.exp(-np.arange(n) / SR * 70)

    def roll(notes, mask, start, end, inst, **kw):
        """Place `inst` on the 16th grid from start..end following an on/off `mask`,
        cycling `notes` for pitch — the engine of the syncopated bass patterns."""
        i = 0; t = start
        while t < end:
            if mask[i % len(mask)]:
                add(inst(STEP * 1.9, notes[(i // 1) % len(notes)], **kw), t)
            t += STEP; i += 1

    def drums(start, end, half=True):
        b = start; i = 0
        while b < end:
            add(kick(0.9), b)
            add(snare(0.5), b + (BEAT if half else BEAT))      # backbeat
            for k in range(2):
                add(hat(0.14), b + BEAT * (0.5 + k))
            b += BEAT * 2; i += 1

    # ---- intro (0–6s): rolling syncopated SUB bassline — bass rhythm drives density ----
    sub_notes = [A1, A1, C2, A1, E2, A1, G1, A1, D2, A1, F2, E2]
    sync = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]    # stabby, gaps so the band dips
    roll(sub_notes, sync, 0.0, 6.0, sub, amp=0.8, decay=16.0)   # staccato -> core throbs per stab
    drums(0.0, 6.0)

    # ---- wobble (6–12s): growl bass, wobble rate changes each bar (core breathes) ----
    wob_rate_by_bar = [BPM/60*1, BPM/60*2, BPM/60*1, BPM/60*4]  # 1/4, 1/8, 1/4, 1/16 wobbles
    wob_notes = [A1, A1, F2, G1]
    bar = BEAT * 4
    for k, t in enumerate(np.arange(6.0, 12.0, bar)):
        add(wobble(min(bar * 0.7, 12.0 - t), wob_notes[k % len(wob_notes)], wob_rate_by_bar[k % 4], amp=0.85), t)
    drums(6.0, 12.0)                                            # 0.3-bar rest between phrases = a gap

    # ---- reese roll (12–18s): detuned moving bass, denser 16th pattern ----
    reese_notes = [A1, A1, C2, E2, D2, C2, A1, G1, A1, B1, E2, C2]
    dense = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]    # syncopated stabs with gaps
    roll(reese_notes, dense, 12.0, 18.0, reese, amp=0.62, decay=11.0)
    drums(12.0, 18.0)

    # ---- climax (18–24s): big syncopated stabs with space (sub+reese octave grit),
    # one growl burst for timbre, then a final low note + tail ----
    add(sub(0.85, E2, A1, amp=0.85, decay=2.2), 18.0)         # downward slide into the drop
    cmask = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]
    cnotes = [A1, A1, C2, G1, E2, A1, F2, D2]
    t = 18.6; i = 0
    while t < 22.0:
        if cmask[i % len(cmask)]:
            add(sub(STEP * 1.8, cnotes[i % len(cnotes)], amp=0.78, decay=13), t)
            add(reese(STEP * 1.7, cnotes[i % len(cnotes)] * 2, amp=0.30, decay=10), t)  # octave-up grit
        t += STEP; i += 1
    add(wobble(BEAT * 1.5, A1, BPM / 60 * 3, amp=0.6), 20.3)  # one growl burst for movement
    add(sub(2.0, A1, amp=0.8, decay=0.7), 22.0)               # final low note + tail
    drums(18.0, 24.0)

    out = buf[:N]
    out = np.tanh(out * 1.05)
    out = out / np.max(np.abs(out)) * 0.95
    return out.astype(np.float32)


def _band_byte(a, lo, hi):
    """Per-frame band level the app actually *sees* before AGC: FFT magnitude →
    analyser temporal smoothing → dB/byte compression. This is what drives beat
    detection (transients), the spectrum, and (via centroid) the hue. AGC saturates
    on continuous bass, so the response to complex bass lives in this signal's
    movement — stabs/gaps (beats) and harmonic shifts (mids → rotation)."""
    win, hop = 2048, SR / 60.0
    f = np.fft.rfftfreq(win, 1 / SR); m = (f >= lo) & (f <= hi)
    nf = int((len(a) - win) / hop)
    mag = np.array([np.mean(np.abs(np.fft.rfft(a[int(k*hop):int(k*hop)+win] * np.hanning(win)))[m]) for k in range(nf)])
    acc = 0.0; sm = np.empty_like(mag)
    for i, v in enumerate(mag):
        acc = 0.645 * acc + 0.355 * v; sm[i] = acc
    db = 20 * np.log10(sm + 1e-12)
    return np.clip((db - (np.percentile(db, 99) - 70)) / 70, 0, 1)


def selftest():
    a = build()
    assert len(a) == N, len(a)
    assert 0.9 <= np.max(np.abs(a)) <= 1.0, np.max(np.abs(a))
    bass = _band_byte(a, 20, 160)
    mid = _band_byte(a, 160, 1800)
    treble = _band_byte(a, 1800, 9000)
    # bass-dominant: the low end carries the track
    assert bass.mean() > treble.mean(), f'not bass-dominant ({bass.mean():.2f} vs {treble.mean():.2f})'
    # complex: the bass the app sees must be dynamic (stabs/gaps), not a flat wall —
    # high spread + many oscillations = transients for beats + a throbbing core
    assert bass.std() > 0.18, f'bass too static (std {bass.std():.3f})'
    wiggles = int(np.sum(np.diff(np.sign(np.diff(bass))) != 0))
    assert wiggles > 120, f'bass not complex enough ({wiggles} turns)'
    # harmonic movement (wobble/reese) spills into the mids -> drives rotation
    assert mid.std() > 0.12, f'not enough harmonic movement for rotation ({mid.std():.3f})'
    print(f'selftest ok — bass std {bass.std():.2f} ({wiggles} turns), mid std {mid.std():.2f}, bass>treble')


def write_wav(path, mono):
    pcm = (mono * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.repeat(pcm[:, None], 2, axis=1).tobytes())


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest(); sys.exit(0)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tracks', 'bass-demo.wav')
    write_wav(out, build())
    print('wrote', out)
