// WebGL renderer: owns the GL context, compiles the raymarch shader, and draws
// one fullscreen triangle per frame with the current settings + audio uniforms.
// Self-heals a lost GPU context by rebuilding every GL resource.
import { $ } from './util.js';
import { VERT, FRAG } from './shader.js';

const canvas = $('gl');
// prefer the discrete / high-performance GPU; opaque + no MSAA = less GPU work
const glOpts = { powerPreference: 'high-performance', antialias: false, alpha: false, depth: false, stencil: false };
const gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
if (!gl) { document.body.innerHTML = '<p style="color:#fff;padding:40px">WebGL not supported in this browser.</p>'; }
// report which renderer the browser actually picked
const glDbg = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = glDbg ? gl.getParameter(glDbg.UNMASKED_RENDERER_WEBGL) : '';
$('gpuInfo').textContent = gpuName ? '⚡ ' + gpuName.replace(/^ANGLE \(|\)$/g, '') : '⚡ GPU (WebGL) — name hidden by browser';

function compile(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
// GL resources rebuilt from scratch on each (re)init so a lost context can heal — see contextrestored below.
let prog, buf, loc, u;
function buildGL() {
  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = name => gl.getUniformLocation(prog, name);
  u = {
    res: U('uRes'), offset: U('uOffset'), shape: U('uShape'), time: U('uTime'), rot: U('uRot'),
    bass: U('uBass'), mid: U('uMid'), treble: U('uTreble'), level: U('uLevel'), beat: U('uBeat'),
    react: U('uReact'), density: U('uDensity'), hue: U('uHue'), style: U('uStyle'), mode: U('uMode'),
    pulse: U('uPulse'), pulseT: U('uPulseT'), sat: U('uSat'),
    colLow: U('uColLow'), colMid: U('uColMid'), colHigh: U('uColHigh'), colCore: U('uColCore'), colBase: U('uColBase'),
    bassCol: U('uBassCol'), midCol: U('uMidCol'), trebleCol: U('uTrebleCol'), tintAmt: U('uTintAmt'),
    bgTop: U('uBgTop'), bgBot: U('uBgBot')
  };
  gl.viewport(0, 0, canvas.width, canvas.height);
}
buildGL();

// The GPU can reset the WebGL context (heavy fullscreen frames, driver TDR). Without this the canvas
// stays dead until a page reload; preventDefault opts into restoration, then we rebuild every resource.
canvas.addEventListener('webglcontextlost', e => e.preventDefault(), false);
canvas.addEventListener('webglcontextrestored', buildGL, false);

let renderScale = 0.8;
function resize() {
  const w = Math.floor(innerWidth * renderScale), h = Math.floor(innerHeight * renderScale);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
}
// shift the cube right so it centres in the space beside the controls panel
let offsetX = 0;
function updateOffset() {
  const p = $('panel');
  // offsetLeft/offsetWidth = layout box, unaffected by the slide-in transform
  const cssShift = p.classList.contains('hidden') ? 0 : (p.offsetLeft + p.offsetWidth) / 2;
  offsetX = cssShift * renderScale;
}
addEventListener('resize', () => { resize(); updateOffset(); });
resize(); updateOffset();

// Render quality is the canvas scale relative to the window — driven by the Quality select.
export function setRenderScale(scale) { renderScale = scale; resize(); updateOffset(); }
export { canvas, updateOffset };
export const contextLost = () => gl.isContextLost();

// Draw one frame. `state` carries live references (no per-frame copies):
//   ui       — control settings, analysis — audio bands+beat+hueAuto,
//   rot      — {x,y} camera rotation, time — fluid time, pulseT — pulse phase.
export function draw({ ui, analysis, rot, time, pulseT }) {
  resize();
  gl.useProgram(prog);
  gl.uniform2f(u.res, canvas.width, canvas.height);
  gl.uniform2f(u.offset, offsetX, 0.0);
  gl.uniform1f(u.time, time);
  gl.uniform2f(u.rot, rot.x, rot.y);
  gl.uniform1f(u.bass, analysis.bass);
  gl.uniform1f(u.mid, analysis.mid);
  gl.uniform1f(u.treble, analysis.treble);
  gl.uniform1f(u.level, analysis.level);
  gl.uniform1f(u.beat, analysis.beat);
  gl.uniform1f(u.react, ui.react);
  gl.uniform1f(u.density, ui.dens);
  gl.uniform1f(u.hue, (ui.hue + analysis.hueAuto * 0.25) % 1.0);
  gl.uniform1i(u.style, ui.style);
  gl.uniform1i(u.mode, ui.mode);
  gl.uniform1i(u.shape, ui.shape);
  gl.uniform1f(u.pulse, ui.pulse);
  gl.uniform1f(u.pulseT, pulseT);
  gl.uniform1f(u.sat, ui.sat);
  gl.uniform3fv(u.colLow, ui.low);
  gl.uniform3fv(u.colMid, ui.mid);
  gl.uniform3fv(u.colHigh, ui.high);
  gl.uniform3fv(u.colCore, ui.core);
  gl.uniform3fv(u.colBase, ui.base);
  gl.uniform3fv(u.bassCol, ui.bassCol);
  gl.uniform3fv(u.midCol, ui.midCol);
  gl.uniform3fv(u.trebleCol, ui.trebCol);
  gl.uniform1f(u.tintAmt, ui.tint);
  gl.uniform3fv(u.bgTop, ui.bgTop);
  gl.uniform3fv(u.bgBot, ui.bgBot);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
