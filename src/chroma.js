// Pure chroma extraction: octave-fold an FFT magnitude spectrum onto the 12-tone
// circle and return a dominant hue + a tonal strength. No DOM/AudioContext, so it
// is unit-testable on its own (see test_chroma.mjs).
//
// Each FFT bin's frequency maps to an angle = 2π·log2(f/440): notes an octave apart
// land on the SAME angle (log2 differs by a whole turn), so the result is pitch-class
// (chroma), octave-agnostic. The energy-weighted circular mean gives the dominant
// pitch's hue; the resultant vector length gives strength — 1 when energy piles on one
// pitch class, →0 when it's spread evenly (percussive / atonal / noise).
const TAU = 6.283185307179586;
// Calibration (the byte-FFT is dB-scaled, so weak harmonics otherwise wash out the peak):
// gate bins below ~-67dB, square the rest to emphasise spectral peaks, then stretch the raw
// resultant length so real music fills 0..1 while broadband/atonal stays near 0. Tuned against
// live tracks — adjust if strength reads too weak/strong (see test_chroma.mjs).
const FLOOR = 120, STR_BIAS = 0.10, STR_GAIN = 3.0;

export function chromaFromFreq(freq, sampleRate, bins) {
  const hzPerBin = sampleRate / (2 * bins);
  let x = 0, y = 0, w = 0;
  for (let i = 1; i < bins; i++) {
    const f = i * hzPerBin;
    if (f < 65 || f > 2100) continue;          // melody/harmony band; below this FFT bins are too coarse for pitch
    const d = freq[i] - FLOOR;
    if (d <= 0) continue;
    const m = d * d;                            // above-floor energy, squared → peaks dominate
    const ang = TAU * Math.log2(f / 440);
    x += m * Math.cos(ang); y += m * Math.sin(ang); w += m;
  }
  if (w <= 0) return { hue: 0, str: 0 };
  const R = Math.hypot(x, y) / w;
  return { hue: (Math.atan2(y, x) / TAU + 1) % 1, str: Math.min(1, Math.max(0, (R - STR_BIAS) * STR_GAIN)) };
}
