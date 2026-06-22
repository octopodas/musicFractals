// Audio player: playlist, transport (play/pause/next/prev/seek/volume), file
// drag-drop + picker, and auto-discovery of tracks/ when served over http(s).
import { $ } from './util.js';
import { ensureAudio, audioEl } from './audio.js';

// ============================================================================
// EDIT THIS if you want tracks baked in. Paths are relative to index.html.
// When served over http(s), the page also tries to auto-load tracks/tracks.json
// (a JSON array of filenames) or falls back to common names below.
const TRACKS = [
  // { name: "My Song", src: "tracks/my-song.mp3" },
];
// ============================================================================

let playlist = [], current = -1, seeking = false;

const fmt = t => { if(!isFinite(t))return '0:00'; const m=Math.floor(t/60),s=Math.floor(t%60); return m+':'+String(s).padStart(2,'0'); };

function renderList(){
  const sel = $('trackSelect');
  if(!playlist.length){ sel.innerHTML='<option>— no tracks loaded —</option>'; return; }
  sel.innerHTML = playlist.map((t,i)=>`<option value="${i}">${i+1}. ${t.name}</option>`).join('');
  if(current>=0) sel.value = current;
}
function addTracks(items){
  const wasEmpty = playlist.length===0;
  playlist.push(...items);
  renderList();
  if(wasEmpty) load(0, false);
}
function load(i, autoplay=true){
  if(i<0||i>=playlist.length) return;
  current = i;
  audioEl.src = playlist[i].src;
  $('npName').textContent = playlist[i].name;
  renderList();
  if(autoplay) playAudio();
}
function playAudio(){ ensureAudio(); audioEl.play().catch(()=>{}); }

// auto-discover tracks when served
async function discover(){
  if(TRACKS.length){ addTracks(TRACKS); return; }
  try{
    const r = await fetch('tracks/tracks.json',{cache:'no-store'});
    if(r.ok){
      const names = await r.json();
      addTracks(names.map(n=>({name:String(n).replace(/\.[^.]+$/,''), src:'tracks/'+n})));
    }
  }catch(e){/* offline — user adds via picker */}
}

export function initPlayer(){
  // transport
  $('play').onclick = ()=>{ if(!playlist.length){ $('fileInput').click(); return; } audioEl.paused?playAudio():audioEl.pause(); };
  $('next').onclick = ()=> playlist.length && load((current+1)%playlist.length);
  $('prev').onclick = ()=> playlist.length && load((current-1+playlist.length)%playlist.length);
  audioEl.onended = ()=> $('next').onclick();
  audioEl.onplay  = ()=> $('playIcon').innerHTML='<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';
  audioEl.onpause = ()=> $('playIcon').innerHTML='<path d="M8 5v14l11-7z"/>';
  audioEl.ontimeupdate = ()=>{
    $('npTime').textContent = fmt(audioEl.currentTime)+' / '+fmt(audioEl.duration);
    if(!seeking) $('seek').value = (audioEl.currentTime/(audioEl.duration||1))*1000;
  };
  $('seek').oninput  = ()=>{ seeking=true; };
  $('seek').onchange = e=>{ audioEl.currentTime = (e.target.value/1000)*(audioEl.duration||0); seeking=false; };
  $('trackSelect').onchange = e=> load(+e.target.value);
  $('vol').oninput = e=> audioEl.volume = +e.target.value;
  audioEl.volume = 0.85;

  // file loading
  $('addFiles').onclick = ()=> $('fileInput').click();
  $('fileInput').onchange = e=> {
    const items = [...e.target.files].map(f=>({name:f.name.replace(/\.[^.]+$/,''), src:URL.createObjectURL(f)}));
    if(items.length) addTracks(items);
  };
  // drag & drop anywhere
  addEventListener('dragover', e=>e.preventDefault());
  addEventListener('drop', e=>{
    e.preventDefault();
    const items=[...e.dataTransfer.files].filter(f=>f.type.startsWith('audio'))
      .map(f=>({name:f.name.replace(/\.[^.]+$/,''), src:URL.createObjectURL(f)}));
    if(items.length) addTracks(items);
  });

  discover();
}
