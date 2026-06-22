// Audio engine: builds the Web Audio graph, analyses the playing signal into
// bass/mid/treble/level + beat + auto-hue, and exposes the small graph hooks
// (useCapture/stopCapture) that capture.js uses to swap in a live stream.
import { $ } from './util.js';
import { chromaFromFreq } from './chroma.js';

export const audioEl = $('audio');

// Live analysis read by the renderer + main loop each frame (mutated in place).
// centroid 0..1 = spectral brightness (low→high); chromaHue/chromaStr = dominant
// pitch class as hue + how tonal (vs atonal/percussive) it is.
export const analysis = { bass: 0, mid: 0, treble: 0, level: 0, beat: 0, hueAuto: 0, centroid: 0, chromaHue: 0, chromaStr: 0 };

let actx, analyser, freq, srcNode;
// per-band rolling peaks for auto-gain; floors double as init and gate silence
const agcFloor = { bass: 0.35, mid: 0.20, treble: 0.10 };
const peak = { bass: 0.35, mid: 0.20, treble: 0.10 };
let bassAvg = 0;
let chromaVX = 0, chromaVY = 0;   // smoothed chroma vector (circular smoothing of hue+strength)

export const getFreq = () => freq;   // raw FFT bins for the spectrum bars (undefined until initAudio)

export function initAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  srcNode = actx.createMediaElementSource(audioEl);
  analyser = actx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  freq = new Uint8Array(analyser.frequencyBinCount);
  srcNode.connect(actx.destination);   // file playback to speakers
  srcNode.connect(analyser);           // …and into the analyser (a leaf — kept out of the output path so a captured stream can drive it without echoing)
}
// initAudio + resume — needed before playback and before any live capture
export function ensureAudio() { initAudio(); if (actx.state === 'suspended') actx.resume(); }

export function analyze(ui) {
  if (!analyser) { analysis.bass = analysis.mid = analysis.treble = analysis.level = 0; analysis.beat *= 0.9; return; }
  // snap: one knob loosens all three smoothing layers together (0 = current, 1 = snappy)
  analyser.smoothingTimeConstant = 0.78 - ui.snap * 0.45;   // analyser FFT smoothing
  analyser.getByteFrequencyData(freq);
  const nyq = actx.sampleRate / 2, bins = freq.length;
  const idx = hz => Math.min(bins - 1, Math.round(hz / nyq * bins));
  const avg = (a, b) => { let s = 0, n = 0; for (let i = idx(a); i <= idx(b); i++) { s += freq[i]; n++; } return n ? s / n / 255 : 0; };
  // attack-fast decay-slow smoothing (snap loosens the decay)
  const dec = 0.86 - ui.snap * 0.40;
  const sm = (cur, t) => t > cur ? t : cur * dec + t * (1 - dec);
  // per-band auto-gain: normalize each band to its own recent peak so naturally-quiet
  // bands (treble) swing full-scale; peak rises instantly, decays slowly, floored to gate silence
  const agc = (k, raw) => { peak[k] = Math.max(raw, peak[k] * ui.agcDecay, agcFloor[k] * ui.agcFloorMul); return Math.min(1, raw / peak[k]); };
  analysis.bass = sm(analysis.bass, agc('bass', avg(20, 160)));
  analysis.mid = sm(analysis.mid, agc('mid', avg(160, 1800)));
  analysis.treble = sm(analysis.treble, agc('treble', avg(1800, 9000)));
  analysis.level = sm(analysis.level, avg(20, 12000));
  // beat detection on bass energy
  bassAvg = bassAvg * 0.92 + analysis.bass * 0.08;
  if (analysis.bass > bassAvg * 1.35 && analysis.bass > 0.25) analysis.beat = 1.0;
  analysis.beat *= 0.90 - ui.snap * 0.40;
  // spectral-centroid -> auto hue (pitch reactive)
  let num = 0, den = 0;
  for (let i = idx(80); i < idx(8000); i++) { num += i * freq[i]; den += freq[i]; }
  const cen = den ? (num / den) / bins : 0;
  analysis.hueAuto += ((cen) - analysis.hueAuto) * 0.05;
  // centroid as Hz, log-mapped ~200Hz..5kHz -> 0..1 (perceptual brightness)
  const centHz = den ? (num / den) * nyq / bins : 0;
  const cnorm = centHz > 0 ? Math.min(1, Math.max(0, (Math.log2(centHz) - 7.64) / 4.65)) : 0;
  analysis.centroid += (cnorm - analysis.centroid) * 0.08;
  // dominant pitch -> hue, smoothed as a vector so the hue wraps cleanly and atonal frames fade strength
  const ch = chromaFromFreq(freq, actx.sampleRate, bins);
  chromaVX += (ch.str * Math.cos(6.2831853 * ch.hue) - chromaVX) * 0.12;
  chromaVY += (ch.str * Math.sin(6.2831853 * ch.hue) - chromaVY) * 0.12;
  analysis.chromaHue = (Math.atan2(chromaVY, chromaVX) / 6.2831853 + 1) % 1;
  analysis.chromaStr = Math.min(1, Math.hypot(chromaVX, chromaVY));
}

// ---------- live capture: route a MediaStream into the analyser instead of the file ----------
let capStream = null, capSrc = null, fileFeedsViz = true;
function fileViz(on) { if (on === fileFeedsViz || !srcNode) return; on ? srcNode.connect(analyser) : srcNode.disconnect(analyser); fileFeedsViz = on; }
export function useCapture(stream) {                            // swap whatever is driving the analyser to this stream
  if (capSrc) capSrc.disconnect();
  if (capStream) capStream.getTracks().forEach(t => t.stop());
  stream.getVideoTracks().forEach(t => t.stop());               // audio only
  capStream = stream; capSrc = actx.createMediaStreamSource(stream);
  fileViz(false); capSrc.connect(analyser);                   // no connect to destination → no echo
}
export function stopCapture() {
  if (capSrc) { capSrc.disconnect(); capSrc = null; }
  if (capStream) { capStream.getTracks().forEach(t => t.stop()); capStream = null; }
  fileViz(true);
}
export const captureDeviceId = () => capStream?.getAudioTracks()[0].getSettings().deviceId;
