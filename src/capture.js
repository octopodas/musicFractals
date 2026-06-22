// Live capture routes: acquire an external audio stream and hand it to the audio
// engine. Two routes — getDisplayMedia (tab/system audio) and getUserMedia (mic
// or a PipeWire/Pulse "Monitor of …" device). Only the stream interface is used;
// the audio graph stays encapsulated in audio.js.
import { $ } from './util.js';
import { ensureAudio, useCapture, stopCapture, captureDeviceId } from './audio.js';

// clean grab for music — Chrome would otherwise apply voice-call processing to a monitor feed
const CAP_AUDIO = {echoCancellation:false, noiseSuppression:false, autoGainControl:false};

// route 1: getDisplayMedia — tab audio (any OS) / system audio (Windows)
export async function toggleSysAudio(on){
  if(!on){ stopCapture(); return false; }
  if(!navigator.mediaDevices?.getDisplayMedia){ alert('System audio capture is not supported in this browser.'); return false; }
  ensureAudio();
  let s;
  try{ s = await navigator.mediaDevices.getDisplayMedia({audio:true, video:true}); }
  catch(e){ return false; }                                   // user dismissed the picker
  if(!s.getAudioTracks().length){                             // shared a source with no audio
    s.getTracks().forEach(t=>t.stop());
    alert('No audio in that share.\nPick a Tab and tick “Share tab audio”, or use the Mic / Monitor option.');
    return false;
  }
  useCapture(s);
  s.getAudioTracks()[0].onended = ()=>{ $('sysaudio').checked=false; stopCapture(); };  // user clicked “Stop sharing”
  return true;
}

// route 2: getUserMedia — pick a PipeWire/PulseAudio "Monitor of …" device for true system audio on Linux
export async function toggleMicAudio(on){
  if(!on){ $('micDevice').style.display='none'; stopCapture(); return false; }
  if(!navigator.mediaDevices?.getUserMedia){ alert('Microphone capture is not supported in this browser.'); return false; }
  ensureAudio();
  let started=false;
  try{ useCapture(await navigator.mediaDevices.getUserMedia({audio:CAP_AUDIO})); started=true; }   // permission + default device
  catch(e){ console.warn('default input unavailable:', e.name); }   // busy/blocked default — still open the picker below
  await populateMicDevices();                                 // labels are exposed once the site has mic permission
  if(!$('micDevice').options.length){
    alert('No audio input available.\nAllow the microphone for this site (camera/mic or tune icon in the address bar), then try again.');
    return false;
  }
  $('micDevice').style.display='';
  if(!started) alert('Default input was busy — pick a source (e.g. SystemAudioLoop) from the list.');
  return true;
}
async function populateMicDevices(){
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
  const cur = captureDeviceId();
  $('micDevice').innerHTML = devs.map(d=>`<option value="${d.deviceId}">${d.label||'Input'}</option>`).join('');
  if(cur) $('micDevice').value = cur;
}
export async function selectMicDevice(id){
  ensureAudio();
  let s;
  try{ s = await navigator.mediaDevices.getUserMedia({audio:{...CAP_AUDIO, deviceId:{exact:id}}}); }
  catch(e){ alert('Couldn’t switch to that input: '+e.name+'.'); return; }
  useCapture(s);
}
