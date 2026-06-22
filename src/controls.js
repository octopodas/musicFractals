// Control panel: the single `ui` settings object that the renderer + audio read,
// all the panel input bindings, per-slider help, fullscreen + panel toggle, and
// localStorage persistence. restoreSettings() is exported separately so main can
// apply saved values AFTER every handler is wired (it fires synthetic events).
import { $ } from './util.js';
import { setRenderScale, updateOffset } from './renderer.js';
import { toggleSysAudio, toggleMicAudio, selectMicDevice } from './capture.js';

const hex2rgb = h => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);

export const ui = { mode:0, shape:0, speed:1, autospeed:false, react:1, agcFloorMul:1, agcDecay:0.995, snap:0.3, pulse:1, dens:1, hue:0, sat:1, style:0, spin:0.3, autorot:true,
  low:[0.039,0.165,0.40], mid:[0.15,0.65,1.0], high:[0.498,0.878,1.0], core:[0.74,0.94,1.0], base:[1.0,0.48,0.12],
  bassCol:[1.0,0.18,0.18], midCol:[0.215,1.0,0.368], trebCol:[0.227,0.627,1.0], tint:0,
  bgTop:[0.031,0.051,0.086], bgBot:[0.016,0.020,0.035] };

function bindRange(id,key,disp){ const el=$(id); el.oninput=()=>{ ui[key]=+el.value; if(disp) $(disp).textContent=(+el.value).toFixed(key==='hue'?0:1); }; el.oninput(); }

// per-slider help: a "?" icon in each slider's label toggles a one-line explanation
const SLIDER_HELP = {
  speed: 'How fast the visuals animate. With “Sync speed to beat” on, this scales the beat-driven tempo.',
  react: 'How strongly the music drives motion and brightness. Higher = more violent reaction to the audio.',
  agcFloorMul: 'Auto-gain floor. Each band (bass/mid/treble) is normalized to its own recent peak so quiet bands still register. Raise = a band must be louder to read full-scale (less sensitive); lower = more sensitive.',
  agcDecay: 'How fast auto-gain forgets a loud peak. Lower = adapts faster to quiet sections (quiet treble lights up sooner); higher = steadier, slower to re-amplify.',
  snap: 'Loosens all three smoothing layers at once (analyser, band decay, beat decay). 0 = smooth/laggy, higher = snappier, more immediate reaction to the audio.',
  pulse: 'Strength of the brightness rings that travel outward from the centre on each beat.',
  dens:  'Thickness/opacity of the volume. Higher packs in more glowing material.',
  hue:   'Rotates every colour around the spectrum. 0 = palette unchanged.',
  sat:   'Colour intensity. 0 = greyscale, 1 = normal, above 1 = boosted.',
  tint:  'Washes the whole volume toward the loudest band’s colour (bass/mid/treble). 0 = off.',
  spin:  'How fast the scene auto-rotates (only when Auto-rotate is on).',
};

// ---------- persist control settings (localStorage, per-origin) ----------
const STORE_KEY = 'fractalCube.settings';
// colours come before 'style' so restoring a saved preset palette isn't forced to Custom
const PERSIST_IDS = ['speed','autospeed','react','agcFloorMul','agcDecay','snap','pulse','dens','hue','sat','spin','vol','autorot',
  'cLow','cMid','cHigh','cCore','cBase','cBass','cMidB','cTreb','tint','cBgTop','cBgBot','mode','shape','style','quality'];
function saveSettings(){
  try{
    const data={};
    PERSIST_IDS.forEach(id=>{ const el=$(id); if(el) data[id] = el.type==='checkbox' ? el.checked : el.value; });
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }catch(e){}
}
export function restoreSettings(){
  let data; try{ data=JSON.parse(localStorage.getItem(STORE_KEY)||'null'); }catch(e){}
  if(!data) return;
  PERSIST_IDS.forEach(id=>{
    if(!(id in data)) return;
    const el=$(id); if(!el) return;
    if(el.type==='checkbox') el.checked = data[id];
    else el.value = data[id];
    el.dispatchEvent(new Event(el.tagName==='SELECT'||el.type==='checkbox' ? 'change' : 'input'));
  });
}
// begin debounced auto-save — call AFTER restoreSettings so restoring doesn't immediately re-save
export function startAutosave(){
  let saveTimer;
  const scheduleSave = ()=>{ clearTimeout(saveTimer); saveTimer=setTimeout(saveSettings, 250); };
  document.addEventListener('input', scheduleSave);
  document.addEventListener('change', scheduleSave);
}

export function initControls(){
  bindRange('speed','speed','speedV');
  bindRange('react','react','reactV');
  $('agcFloorMul').oninput = ()=>{ ui.agcFloorMul=+$('agcFloorMul').value; $('agcFloorMulV').textContent=ui.agcFloorMul.toFixed(2); }; $('agcFloorMul').oninput();
  $('agcDecay').oninput    = ()=>{ ui.agcDecay=+$('agcDecay').value; $('agcDecayV').textContent=ui.agcDecay.toFixed(3); }; $('agcDecay').oninput();
  $('snap').oninput        = ()=>{ ui.snap=+$('snap').value; $('snapV').textContent=ui.snap.toFixed(2); }; $('snap').oninput();
  bindRange('pulse','pulse','pulseV');
  bindRange('dens','dens','densV');
  $('hue').oninput = ()=>{ ui.hue=+$('hue').value; $('hueV').textContent=Math.round(ui.hue*360); }; $('hue').oninput();
  bindRange('spin','spin','spinV');
  bindRange('sat','sat','satV');
  $('mode').onchange = ()=> ui.mode=+$('mode').value;
  $('shape').onchange = ()=> ui.shape=+$('shape').value;
  $('style').onchange = ()=> ui.style=+$('style').value;
  // custom palette color pickers (selecting one also jumps to the Custom palette)
  [['cLow','low'],['cMid','mid'],['cHigh','high'],['cCore','core'],['cBase','base']].forEach(([id,key])=>{
    const el=$(id);
    el.oninput = ()=>{ ui[key]=hex2rgb(el.value); $('style').value='5'; ui.style=5; };
  });
  // audio tint colors (independent of palette — don't force Custom)
  [['cBass','bassCol'],['cMidB','midCol'],['cTreb','trebCol'],['cBgTop','bgTop'],['cBgBot','bgBot']].forEach(([id,key])=>{
    const el=$(id); el.oninput = ()=> ui[key]=hex2rgb(el.value);
  });
  // backdrop presets just drive the two pickers (reuses their binding + persistence)
  $('bgPreset').onchange = ()=>{
    const v=$('bgPreset').value; if(!v) return;
    const [top,bot]=v.split('|');
    const t=$('cBgTop'), b=$('cBgBot');
    t.value=top; t.dispatchEvent(new Event('input'));
    b.value=bot; b.dispatchEvent(new Event('input'));
  };

  Object.entries(SLIDER_HELP).forEach(([id,text])=>{
    const input=$(id), label=input && input.previousElementSibling;
    if(!label || !label.classList.contains('row')) return;
    const icon=document.createElement('span');
    icon.className='help'; icon.textContent='?'; icon.title='What does this do?';
    const tip=document.createElement('div');
    tip.className='help-text'; tip.textContent=text; tip.hidden=true;
    icon.onclick=()=>{ tip.hidden=!tip.hidden; };
    label.appendChild(icon);
    input.insertAdjacentElement('afterend', tip);
  });
  bindRange('tint','tint','tintV');

  $('autospeed').onchange = ()=>{
    ui.autospeed = $('autospeed').checked;
    $('speed').style.opacity = ui.autospeed ? 0.45 : 1;   // dim slider when beat-driven
    if(!ui.autospeed) $('speedV').textContent = (+$('speed').value).toFixed(1);
  };
  $('autorot').onchange = ()=> ui.autorot=$('autorot').checked;
  $('sysaudio').onchange = async ()=>{
    const on = $('sysaudio').checked;
    const ok = await toggleSysAudio(on);
    if(on && !ok) $('sysaudio').checked = false;                        // cancelled / unsupported / no audio
    if(ok){ $('micaudio').checked = false; $('micDevice').style.display='none'; }  // one capture at a time
  };
  $('micaudio').onchange = async ()=>{
    const on = $('micaudio').checked;
    const ok = await toggleMicAudio(on);
    if(on && !ok) $('micaudio').checked = false;                        // denied / unsupported
    if(ok) $('sysaudio').checked = false;                              // one capture at a time
  };
  $('micDevice').onchange = ()=> selectMicDevice($('micDevice').value);
  $('quality').onchange = ()=>{ setRenderScale(+$('quality').value); };
  $('hidePanel').onclick = ()=>{ $('panel').classList.add('hidden'); $('toggle').style.display='grid'; updateOffset(); };
  $('toggle').onclick = ()=>{ $('panel').classList.remove('hidden'); $('toggle').style.display='none'; updateOffset(); };

  // fullscreen toggle (native Fullscreen API)
  const FS_ENTER='M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3';
  const FS_EXIT ='M5 8h1a2 2 0 0 0 2-2V5M16 5v1a2 2 0 0 0 2 2h1M19 16h-1a2 2 0 0 0-2 2v1M8 19v-1a2 2 0 0 0-2-2H5';
  $('fs').onclick = ()=> document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(()=>{});
  document.addEventListener('fullscreenchange', ()=>{
    $('fs').querySelector('path').setAttribute('d', document.fullscreenElement ? FS_EXIT : FS_ENTER);
    $('fs').title = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  });
}
