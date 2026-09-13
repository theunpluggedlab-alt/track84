import {RaceSession} from './session.js';
import {TrackRenderer} from './renderer.js';
import {RULES,PLAYER_ID} from './engine.js';

const icons={
 sound:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 mute:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',
 expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
 pause:'<path d="M8 5v14m8-14v14"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.3.6-1.5 1.1-1.5 2.5m0 2v1"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
const svg=(name)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelector('#app').innerHTML=`
<main class="shell">
  <header class="topbar">
    <div class="brand" aria-label="Track 84"><div class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></div><div><div class="wordmark">TRACK <em>/ 84</em></div><div class="edition">THE HURDLE ARCADE</div></div></div>
    <div class="top-actions"><span class="mode-pill">1 PLAYER</span><button class="icon-button" id="sound" aria-label="Mute sound" title="Mute sound" aria-pressed="true">${svg('sound')}</button><button class="icon-button" id="help" aria-label="How to play" title="How to play">${svg('help')}</button><button class="icon-button" id="fullscreen" aria-label="Full screen" title="Full screen">${svg('expand')}</button><button class="icon-button" id="pause" aria-label="Pause race" title="Pause race (P)" disabled>${svg('pause')}</button></div>
  </header>
  <section class="event-bar" aria-label="Race information"><div><div class="eyebrow">ARCADE ATHLETICS · EVENT 01</div><h1 class="event-title">110m Hurdles <span>Find your rhythm. Clear every hurdle.</span></h1></div><div class="event-meta"><span><strong>5</strong> RUNNERS</span><span><strong>10</strong> HURDLES</span><span class="desktop-meta">YOU + 4 CPU</span></div></section>
  <section class="cabinet" aria-label="Hurdle race">
    <div class="hud"><div class="stat"><div class="stat-label">POSITION</div><div class="stat-value"><span id="position">—</span><small>/ 5</small></div></div><div class="stat"><div class="stat-label">TIME <b>SEC</b></div><div class="stat-value hud-time" id="time">00.00</div></div><div class="stat"><div class="stat-label">SPEED</div><div class="stat-value"><span id="speed">0.0</span><small>m/s</small></div><div class="speed-meter" id="speed-meter" aria-hidden="true">${'<i></i>'.repeat(10)}</div></div><div class="stat"><div class="stat-label">DISTANCE</div><div class="stat-value"><span id="distance">0</span><small>/110m</small></div></div></div>
    <div class="arena"><canvas id="track" role="img" aria-label="Five runners race over hurdles. Your runner wears lime green in lane three."></canvas><div class="arena-badge"><i></i><span id="race-state">READY TO RACE</span></div><span class="arena-location">STADIUM '84</span><div id="feedback" class="feedback" hidden></div><div id="overlay" class="screen-overlay"></div></div>
    <div class="race-progress" role="progressbar" aria-label="Race distance" aria-valuemin="0" aria-valuemax="110" aria-valuenow="0"><div id="progress"></div></div>
    <div class="race-strip"><div class="race-strip-left"><span class="live-caption">HURDLES</span><div class="hurdle-pips" id="hurdle-pips" aria-label="Hurdle clearance status">${'<i></i>'.repeat(10)}</div></div><span class="jump-status" id="jump-status">Find your rhythm. Time your jump.</span></div>
  </section>
  <section class="control-deck" aria-label="Race controls"><div><div class="controls"><div class="leg-group"><button class="play-button" data-action="L" aria-label="L left leg"><span class="key-tag">A / ←</span><span class="letter">L</span><span class="button-label"><strong>LEFT LEG</strong><span>ALTERNATE</span></span></button><button class="play-button" data-action="R" aria-label="R right leg"><span class="key-tag">D / →</span><span class="letter">R</span><span class="button-label"><strong>RIGHT LEG</strong><span>TO RUN</span></span></button></div><button class="play-button jump" data-action="J" aria-label="J jump"><span class="key-tag">SPACE</span><span class="letter">J</span><span class="button-label"><strong>JUMP</strong><span>CLEAR IT</span></span></button></div><div class="controls-hint"><b>L ↔ R</b> alternate to run <span class="divider">/</span> <b>J</b> time your jump</div></div><aside class="rhythm-panel" aria-label="Current running rhythm"><div class="rhythm-heading">YOUR RHYTHM <span id="cadence">0.0 /s</span></div><div class="rhythm-bars" id="rhythm-bars" aria-hidden="true">${'<i></i>'.repeat(20)}</div><p>Quicker taps. <strong>Faster feet.</strong><br/>Jump when the J button lights up.</p></aside></section>
  <footer class="bottom-bar"><div class="opponents" id="opponents"></div><div class="footer-note"><span>SOLO RACE</span><span>TOUCH & KEYBOARD</span></div></footer>
</main><div id="help-dialog" class="dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" hidden><div class="dialog-card"><button id="close-help" class="icon-button close-dialog" aria-label="Close instructions">${svg('close')}</button><h2 id="help-title">READY TO RUN?</h2><ol><li>You are the <strong>lime green runner</strong> in lane 3. Race four computer runners over 110 metres.</li><li>Alternate <strong>L · R</strong> to run. Tap faster to build speed. Repeating the same leg will not accelerate you.</li><li>Press <strong>J when it lights up</strong> as a hurdle approaches. Jump too early or too late and you will trip.</li><li>Took a tumble? Get back up, then alternate L · R to find your rhythm again.</li></ol><div class="help-foot">Keys: L / A / ← · R / D / → · J / Space / ↑<br/>P or Esc: pause · Enter: start<br/>Rotate your phone to play in portrait or landscape.</div></div></div><div class="sr-only" aria-live="polite" id="announcer"></div>`;

const $=(id)=>document.getElementById(id);
const session=new RaceSession();const engine=session.engine;
const renderer=new TrackRenderer($('track'));
const controls=[...document.querySelectorAll('[data-action]')];
let last=performance.now(),lastHud=0,overlayKey='',feedbackUntil=0,lastResults='',held=new Set(),helpWasRunning=false,helpReturn=null;
let soundEnabled=true,audioContext=null;
try{soundEnabled=localStorage.getItem('track84-sound')!=='off';}catch{}
function soundUI(){$('sound').innerHTML=svg(soundEnabled?'sound':'mute');$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'Mute sound':'Enable sound');$('sound').title=soundEnabled?'Mute sound':'Enable sound';}
function unlockAudio(){if(!soundEnabled)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}}
function tone(freq,duration=.08,volume=.035,type='square',end=null){if(!soundEnabled||!audioContext||audioContext.state!=='running')return;try{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime;o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+duration);}catch{}}
function vibrate(ms){try{navigator.vibrate?.(ms);}catch{}}
function showFeedback(text,error=false,duration=750){$('feedback').textContent=text;$('feedback').classList.toggle('error',error);$('feedback').hidden=false;feedbackUntil=performance.now()+duration;}
function clearHeld(){held.clear();controls.forEach(b=>b.classList.remove('pressed'));}
function begin(){
  const input=$('player-name'),name=(input?input.value:session.playerName).trim().slice(0,12);
  if(!name){input?.focus();return;}
  input?.blur();unlockAudio();clearHeld();session.restart(name);lastResults='';overlayKey='';last=performance.now();session.accumulator=0;renderHud();
}
function pauseRace(){engine.pause();clearHeld();renderOverlay();}
function resumeRace(){engine.resume();last=performance.now();session.accumulator=0;renderOverlay();}
function action(letter){if(!$('help-dialog').hidden)return;unlockAudio();session.action(letter);consumeEvents();renderHud();}

for(const button of controls){
  button.addEventListener('pointerdown',event=>{event.preventDefault();if(event.pointerType==='mouse'&&event.button!==0)return;try{button.setPointerCapture(event.pointerId);}catch{}button.classList.add('pressed');action(button.dataset.action);},{passive:false});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>button.classList.remove('pressed'));
  // Assistive activation / keyboard button click has no pointerdown.
  button.addEventListener('click',event=>{if(event.detail===0)action(button.dataset.action);});
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
const keyMap={KeyL:'L',KeyA:'L',ArrowLeft:'L',KeyR:'R',KeyD:'R',ArrowRight:'R',KeyJ:'J',Space:'J',ArrowUp:'J'};
document.addEventListener('keydown',event=>{
  if(!$('help-dialog').hidden){
    if(event.code==='Escape'){event.preventDefault();closeHelp();}
    else if(event.code==='Tab'){event.preventDefault();$('close-help').focus();}
    return;
  }
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target.isContentEditable)return;
  if(event.code==='Enter'&&['ready','finished'].includes(engine.phase)){event.preventDefault();if(!event.repeat)begin();return;}
  if(event.code==='Escape'||event.code==='KeyP'){event.preventDefault();if(event.repeat)return;if(engine.phase==='paused')resumeRace();else pauseRace();return;}
  const letter=keyMap[event.code];if(!letter)return;
  if(engine.phase==='ready'&&event.code==='Space')return;
  event.preventDefault();if(event.repeat||held.has(event.code))return;
  held.add(event.code);controls.find(b=>b.dataset.action===letter).classList.add('pressed');action(letter);
});
document.addEventListener('keyup',event=>{held.delete(event.code);const letter=keyMap[event.code];if(letter&&!Object.entries(keyMap).some(([key,val])=>val===letter&&held.has(key)))controls.find(b=>b.dataset.action===letter).classList.remove('pressed');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseRace();});
window.addEventListener('blur',()=>{if(engine.phase==='racing'||engine.phase==='countdown')pauseRace();clearHeld();});
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;soundUI();unlockAudio();try{localStorage.setItem('track84-sound',soundEnabled?'on':'off');}catch{}if(soundEnabled)tone(620);});
$('pause').addEventListener('click',()=>{if(engine.phase==='paused')resumeRace();else pauseRace();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else showFeedback('Use your browser for full screen',false,2000);}catch{showFeedback('Full screen is unavailable',false,2000);}});
function openHelp(){helpReturn=document.activeElement;helpWasRunning=['racing','countdown'].includes(engine.phase);if(helpWasRunning)pauseRace();$('help-dialog').hidden=false;$('close-help').focus();}
function closeHelp(){$('help-dialog').hidden=true;if(helpWasRunning)resumeRace();helpReturn?.focus();}
$('help').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);$('help-dialog').addEventListener('click',event=>{if(event.target===$('help-dialog'))closeHelp();});

function formatTime(time){return time.toFixed(2).padStart(5,'0');}
function renderOverlay(){
  let state=engine.phase;
  if(engine.player.finishTime!==null&&state!=='paused')state='results';
  const key=state==='countdown'?`countdown-${Math.ceil(engine.countdown)}`:state;
  if(key===overlayKey){if(state==='results')renderResults();return;}
  overlayKey=key;$('overlay').hidden=state==='racing';
  if(state==='ready'){
    $('overlay').innerHTML=`<div class="start-content"><div class="start-kicker">ON YOUR MARKS.</div><h2 class="start-title">110m<br/><span>HURDLES</span></h2><p class="start-copy">Five runners. Ten hurdles. Your moment.</p><form id="start-form" class="start-form"><label for="player-name">PLAYER NAME</label><input id="player-name" name="playerName" aria-label="Player name" placeholder="YOUR NAME" maxlength="12" autocomplete="nickname" autocapitalize="words" enterkeyhint="go" spellcheck="false" required /><button id="start-race" type="submit" class="start-button" disabled>Start race <span aria-hidden="true">▶</span></button></form><div class="key-hint">Enter your name. Own your lane.</div></div>`;
    $('start-form').addEventListener('submit',event=>{event.preventDefault();begin();});
    $('player-name').addEventListener('input',event=>{$('start-race').disabled=!event.target.value.trim();});
  }else if(state==='countdown'){
    $('overlay').innerHTML=`<div><div class="count-number">${Math.ceil(engine.countdown)}</div><div class="count-label">Get ready to alternate L · R!</div></div>`;
  }else if(state==='paused'){
    $('overlay').innerHTML='<div class="paused-panel"><h2>PAUSED</h2><p>Catch your breath. The track can wait.</p><div class="pause-actions"><button id="resume" class="start-button">Resume race ▶</button><button id="restart" class="secondary-button">Restart</button></div></div>';
    $('resume').addEventListener('click',resumeRace);$('restart').addEventListener('click',begin);$('resume').focus();
  }else if(state==='results'){
    lastResults='';
    $('overlay').innerHTML='<div class="results-panel"><h2 id="result-heading">FINISH!</h2><div class="result-summary" id="result-summary"></div><ol id="results-list" class="results-list"></ol><p class="result-pending" id="result-pending"></p><button id="again" class="start-button">Race again <span aria-hidden="true">↻</span></button></div>';
    $('again').addEventListener('click',begin);renderResults();$('again').focus();
  }else $('overlay').innerHTML='';
}
function renderResults(){
  const standings=engine.standings();const key=standings.map(r=>`${r.id}:${r.finishTime}`).join();
  if(key===lastResults)return;lastResults=key;
  const rank=standings.findIndex(r=>r.human)+1;
  $('result-heading').textContent=rank===1?'1ST PLACE!':'FINISH!';
  $('result-summary').innerHTML=`<span>TIME <b>${formatTime(engine.player.finishTime)}s</b></span><span>CLEARED <b>${engine.player.cleared}/10</b></span><span>FALLS <b>${engine.player.falls}</b></span>`;
  $('results-list').innerHTML=standings.map((r,i)=>`<li class="${r.human?'you':''}"><span>${i+1}</span><span style="color:${r.color}">■</span><span class="result-name">${escapeHTML(r.name)}${r.human?' · YOU':''}</span><span class="result-time">${r.finishTime===null?'Racing…':formatTime(r.finishTime)+'s'}</span></li>`).join('');
  $('result-pending').textContent=engine.phase==='finished'?`You finished ${rank}${["st","nd","rd"][rank-1]||"th"}. Ready for another race?`:'The other runners are heading for the finish.';
}
function renderHud(){
  const p=engine.player,rank=engine.standings().findIndex(r=>r.human)+1,w=engine.jumpWindow();
  $('position').textContent=engine.phase==='ready'?'—':rank;
  $('time').textContent=formatTime(p.finishTime??engine.time);$('speed').textContent=p.speed.toFixed(1);$('distance').textContent=Math.floor(p.x);
  $('progress').style.width=`${p.x/RULES.distance*100}%`;document.querySelector('.race-progress').setAttribute('aria-valuenow',String(Math.floor(p.x)));
  $('cadence').textContent=`${p.cadence.toFixed(1)} /s`;
  [...$('speed-meter').children].forEach((el,i)=>el.classList.toggle('on',i<p.speed/RULES.maxSpeed*10));
  [...$('rhythm-bars').children].forEach((el,i)=>el.classList.toggle('on',i<p.cadence/9*20));
  [...$('hurdle-pips').children].forEach((el,i)=>el.className=p.hurdleResults[i]??(i===p.hurdleIndex?'next':''));
  $('hurdle-pips').setAttribute('aria-label',`${p.cleared} hurdles cleared, ${p.falls} collisions`);
  const cue=engine.phase==='racing'&&w.ideal&&p.jumpAge===null&&p.fallRemaining===0;
  controls.find(b=>b.dataset.action==='J').classList.toggle('cue',cue);
  const status=$('jump-status');status.classList.toggle('perfect',cue);
  if(engine.phase==='ready')status.textContent='L ↔ R · GET READY';
  else if(p.finishTime!==null)status.textContent='FINISH · WELL RUN!';
  else if(engine.phase==='paused')status.textContent='Paused';
  else if(p.fallRemaining>0)status.textContent='GETTING UP… KEEP GOING';
  else if(cue)status.textContent='JUMP NOW!';
  else if(p.jumpAge!==null)status.textContent='AIRBORNE';
  else if(!Number.isFinite(w.distance))status.textContent='FINAL SPRINT!';
  else status.textContent=`NEXT HURDLE ${String(p.hurdleIndex+1).padStart(2,'0')} · ${Math.max(0,w.distance).toFixed(1)}m`;
  const labels={ready:'READY TO RACE',countdown:'ON YOUR MARKS',racing:'RACE IN PROGRESS',paused:'PAUSED',finished:'RACE COMPLETE'};
  $('race-state').textContent=labels[engine.phase];
  $('pause').disabled=!['racing','countdown','paused'].includes(engine.phase);$('pause').setAttribute('aria-label',engine.phase==='paused'?'Resume race':'Pause race');
  $('opponents').innerHTML=engine.standings().map((r,i)=>`<span class="opponent ${r.human?'you':''}" style="--runner:${r.color}"><i></i>${escapeHTML(r.name)}${engine.phase==='ready'?'':` ${i+1}`}</span>`).join('');
  renderOverlay();
}
function consumeEvents(){
  for(const event of engine.drainEvents()){
    if(event.type==='countdown'){tone(440,.09,.05);$('announcer').textContent=String(event.value);}
    if(event.type==='go'){tone(880,.3,.05);showFeedback('GO!',false,650);$('announcer').textContent='Go!';}
    if(event.runnerId!==PLAYER_ID)continue;
    if(event.type==='step')tone(event.leg==='L'?110:145,.026,.012,'triangle');
    if(event.type==='repeat'&&performance.now()>feedbackUntil)showFeedback('L ↔ R',false,350);
    if(event.type==='jump')tone(270,.16,.035,'square',760);
    if(event.type==='clear'){showFeedback(event.perfect?'PERFECT!':'NICE JUMP!');tone(event.perfect?1047:784,.12,.035);vibrate(16);$('announcer').textContent=`${engine.player.cleared} hurdles cleared`;
    }
    if(event.type==='fall'){showFeedback('OUCH!',true,800);tone(180,.23,.07,'sawtooth',50);vibrate([50,30,60]);$('announcer').textContent='You hit a hurdle. Get back up, then keep running.';}
    if(event.type==='finish'){tone(1047,.35,.05);$('announcer').textContent=`Finished! ${formatTime(engine.player.finishTime)} seconds`;}
  }
}
function frame(now){session.update((now-last)/1000);last=now;consumeEvents();renderer.draw(engine,now);if(now-lastHud>50){renderHud();lastHud=now;}if(now>feedbackUntil)$('feedback').hidden=true;requestAnimationFrame(frame);}
soundUI();renderHud();requestAnimationFrame(frame);

