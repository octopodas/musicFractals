// Self-check for chromaFromFreq. Run: node test_chroma.mjs
import { chromaFromFreq } from './src/chroma.js';

const RATE = 44100, BINS = 1024, HZ = RATE / (2 * BINS);
const cdist = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

// FFT magnitude array with a triangular peak (±2 bins) centred on `hz`
function peak(hz) {
  const a = new Uint8Array(BINS);
  const c = Math.round(hz / HZ);
  for (let k = -2; k <= 2; k++) if (a[c + k] !== undefined) a[c + k] = 255 - Math.abs(k) * 50;
  return a;
}

const A4 = chromaFromFreq(peak(440), RATE, BINS);
const A5 = chromaFromFreq(peak(880), RATE, BINS);   // one octave up
const flat = chromaFromFreq(new Uint8Array(BINS).fill(180), RATE, BINS);   // loud broadband / atonal

console.log('A4 :', A4);
console.log('A5 :', A5);
console.log('flat:', flat);

let fail = 0;
const ok = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); fail++; } };

ok(A4.str > 0.7, `pure tone should be tonal (str=${A4.str.toFixed(3)})`);
ok(cdist(A4.hue, 0) < 0.05, `A=440Hz should map near hue 0 (got ${A4.hue.toFixed(3)})`);
ok(cdist(A5.hue, A4.hue) < 0.06, `octave invariance: 880Hz hue ${A5.hue.toFixed(3)} ≈ 440Hz hue ${A4.hue.toFixed(3)}`);
ok(flat.str < 0.2, `flat spectrum should read atonal (str=${flat.str.toFixed(3)})`);

console.log(fail ? `\n${fail} CHECK(S) FAILED` : '\nall chroma checks passed');
process.exit(fail ? 1 : 0);
