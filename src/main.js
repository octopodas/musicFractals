// Entry point: wires the modules in the order that matters, then runs the frame
// loop that analyses audio → advances time → draws.
import { $ } from './util.js';
import { draw, contextLost, canvas } from './renderer.js';
import { analysis, analyze, getFreq } from './audio.js';
import { initPlayer } from './player.js';
import { ui, initControls, restoreSettings, startAutosave } from './controls.js';

// Init order is load-bearing: wire all handlers FIRST, then restoreSettings()
// (it fires synthetic input/change events into those handlers), then start
// auto-saving so restoring doesn't immediately overwrite the saved state.
initPlayer();
initControls();
restoreSettings();
startAutosave();

// drag to rotate
let rot={x:0.5,y:-0.3}, drag=false, last={x:0,y:0};
canvas.addEventListener('pointerdown', e=>{ drag=true; last={x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e=>{ if(!drag)return; rot.x+=(e.clientX-last.x)*0.006; rot.y+=(e.clientY-last.y)*0.006; last={x:e.clientX,y:e.clientY}; });
canvas.addEventListener('pointerup', ()=> drag=false);

// spectrum bars
const NB=24; const levelsEl=$('levels');
for(let i=0;i<NB;i++) levelsEl.appendChild(document.createElement('i'));
const bars=[...levelsEl.children];

// ---------- main loop ----------
let fluidTime = 0, pulseT = 0, beatSpeed = 1, prev = performance.now();
function frame(now){
  if(contextLost()){ requestAnimationFrame(frame); return; } // skip while GPU recovers; rAF chain stays alive
  const dt = Math.min(0.05,(now-prev)/1000); prev=now;
  analyze(ui);

  // auto-speed: lurches hard on each beat, coasts back toward baseline between (slider scales it)
  const beatTarget = 0.25 + analysis.beat*4.0 + analysis.bass*0.4;
  beatSpeed += (beatTarget - beatSpeed) * (beatTarget > beatSpeed ? 0.65 : 0.30); // snap up fast, ease down quicker so each beat punches
  const speed = ui.autospeed ? ui.speed * beatSpeed : ui.speed;
  if(ui.autospeed) $('speedV').textContent = speed.toFixed(1);

  // fluid time surges with music
  const drive = 0.35 + ui.react*(analysis.level*1.4 + analysis.beat*1.5);
  fluidTime += dt * speed * drive;
  // pulse phase travels outward, accelerating on each beat
  pulseT += dt * (1.2 + analysis.beat*7.0 + analysis.bass*2.5);

  if(ui.autorot && !drag) rot.x += dt * ui.spin * (0.6 + analysis.mid*1.5);

  draw({ ui, analysis, rot, time:fluidTime, pulseT });

  // spectrum bars from raw fft
  const freq = getFreq();
  if(freq){
    for(let i=0;i<NB;i++){
      const v = freq[Math.floor((i/NB)*(freq.length*0.5))]/255;
      bars[i].style.height = Math.max(8, v*100)+'%';
    }
  }
  $('bpm').style.opacity = 0.4 + analysis.beat*0.6;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
