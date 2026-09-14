import {RaceSession} from './session.js';
import {TrackRenderer} from './renderer.js';
import {RULES,PLAYER_ID,COLORS} from './engine.js';
import { STAGES, difficultyFor } from './stages.js';
import { EVENTS, getEvent, ROWING } from './events.js';
import { NetClient, NetView, netStandings, loadHostUrl, saveHostUrl, formatCode, defaultHostUrl, inviteBase, inviteLinkFor, parseInviteCode, saveResume, loadResume, clearResume } from './net.js';

const icons={
 sound:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 mute:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',
 expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
 pause:'<path d="M8 5v14m8-14v14"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.3.6-1.5 1.1-1.5 2.5m0 2v1"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 pin:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>'
};
const svg=(name)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelector('#app').innerHTML=`
<main class="shell">
  <header class="topbar">
    <div class="brand" aria-label="Track 84"><div class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></div><div><div class="wordmark">TRACK <em>/ 84</em></div><div class="edition">OLYMPIC ROAD · 1896 → 2024</div></div></div>
    <div class="top-actions"><span class="mode-pill" id="stage-pill">STAGE 01/30</span><button class="icon-button" id="sound" aria-label="Mute sound" title="Mute sound" aria-pressed="true">${svg('sound')}</button><button class="icon-button" id="help" aria-label="How to play" title="How to play">${svg('help')}</button><button class="icon-button" id="fullscreen" aria-label="Full screen" title="Full screen">${svg('expand')}</button><button class="icon-button" id="pause" aria-label="Pause race" title="Pause race (P)" disabled>${svg('pause')}</button></div>
  </header>
  <section class="event-bar" aria-label="Race information"><div><div class="eyebrow" id="stage-eyebrow">OLYMPIC ROAD · STAGE 01/30 · EASIEST</div><h1 class="event-title"><span id="stage-title">1896 Athens · 110m Hurdles</span><span id="stage-sub">Panathenaic Stadium · Greece</span></h1></div><div class="event-meta"><span id="stage-stars">★☆☆☆☆</span><span><strong>5</strong> RUNNERS</span><span><strong id="meta-count">10</strong> <span id="meta-label">HURDLES</span></span><span class="desktop-meta" id="stage-meta">YOU + 4 CPU</span></div></section>
  <section class="cabinet" id="cabinet" aria-label="Race">
    <div class="hud"><div class="stat"><div class="stat-label">POSITION</div><div class="stat-value"><span id="position">—</span><small>/ 5</small></div></div><div class="stat"><div class="stat-label">TIME <b>SEC</b></div><div class="stat-value hud-time" id="time">00.00</div></div><div class="stat"><div class="stat-label">SPEED</div><div class="stat-value"><span id="speed">0.0</span><small>m/s</small></div><div class="speed-meter" id="speed-meter" aria-hidden="true">${'<i></i>'.repeat(10)}</div></div><div class="stat"><div class="stat-label">DISTANCE</div><div class="stat-value"><span id="distance">0</span><small id="distance-max">/110m</small></div></div></div>
    <div class="arena"><canvas id="track" role="img" aria-label="Five runners race over hurdles. Your runner wears lime green in lane three."></canvas><div class="arena-badge"><i></i><span id="race-state">READY TO RACE</span></div><span class="arena-location" id="arena-location">1896 ATHENS • PANATHENAIC</span><div id="feedback" class="feedback" hidden></div><div id="overlay" class="screen-overlay"></div></div>
    <div class="race-progress" role="progressbar" aria-label="Race distance" aria-valuemin="0" aria-valuemax="110" aria-valuenow="0" id="race-progress"><div id="progress"></div></div>
    <div class="race-strip"><div class="race-strip-left"><span class="live-caption" id="race-caption">HURDLES</span><div class="hurdle-pips" id="hurdle-pips" aria-label="Hurdle clearance status">${'<i></i>'.repeat(10)}</div><span class="lives" id="lives" role="img" aria-label="3 lives remaining">❤❤❤</span></div><span class="jump-status" id="jump-status">Find your rhythm. Time your jump.</span></div>
  </section>
  <section class="control-deck" aria-label="Race controls"><div><div class="controls"><div class="leg-group"><button class="play-button" data-action="L" aria-label="L left leg"><span class="key-tag">A / ←</span><span class="letter">L</span><span class="button-label"><strong id="leg-l-label">LEFT LEG</strong><span id="leg-l-sub">ALTERNATE</span></span></button><button class="play-button" data-action="R" aria-label="R right leg"><span class="key-tag">D / →</span><span class="letter">R</span><span class="button-label"><strong id="leg-r-label">RIGHT LEG</strong><span id="leg-r-sub">TO RUN</span></span></button></div><button class="play-button jump" data-action="J" aria-label="J jump"><span class="key-tag">SPACE</span><span class="letter">J</span><span class="button-label"><strong id="jump-label">JUMP</strong><span id="jump-sub">CLEAR IT</span></span></button></div><div class="controls-hint" id="controls-hint"><b>L ↔ R</b> alternate to run <span class="divider">/</span> <b>J</b> time your jump</div></div><aside class="rhythm-panel" aria-label="Current running rhythm"><div class="rhythm-heading"><span id="rhythm-title">YOUR RHYTHM</span> <span id="cadence">0.0 /s</span></div><div class="rhythm-bars" id="rhythm-bars" aria-hidden="true">${'<i></i>'.repeat(20)}</div><p id="rhythm-copy">Quicker taps. <strong>Faster feet.</strong><br/>Jump when the J button lights up.</p></aside></section>
  <footer class="bottom-bar"><div class="opponents" id="opponents"></div><div class="footer-note"><span id="career-note">ROAD TO PARIS 2024</span><span>TOUCH & KEYBOARD</span></div></footer>
</main><div id="help-dialog" class="dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" hidden><div class="dialog-card"><button id="close-help" class="icon-button close-dialog" aria-label="Close instructions">${svg('close')}</button><h2 id="help-title">READY TO RUN?</h2><ol><li>You are the <strong>lime green athlete</strong> in lane 3. Race four computer rivals over the distance.</li><li>Alternate <strong>L · R</strong> to run. Tap faster to build speed. Repeating the same leg will not accelerate you.</li><li>Press <strong>J when it lights up</strong> as a hurdle approaches. Jump too early or too late and you will trip.</li><li>Took a tumble? Get back up, then alternate L · R to find your rhythm again.</li><li><strong>500m Single Sculls (rowing):</strong> the same L · R alternation drives the boat. Hold a steady rhythm near 6–7 strokes a second for clean water (<strong>SWING</strong>); smash the rating and you burn out your crew. Three same-side strokes in a row and you catch a <strong>crab</strong>. Press <strong>J</strong> for a power ten — twice a race. Stroking before the gun is a false start.</li><li>Arcade rules: you have <strong>3 lives</strong>. Finish outside the <strong>top 3</strong> and you lose one — lose all 3 and it is <strong>game over</strong>. Top-3 finishes advance automatically. Pause anytime to reset with a fresh name.</li></ol><div class="help-foot">Keys: L / A / ← · R / D / → · J / Space / ↑<br/>P or Esc: pause · Enter: start<br/>Rotate your phone to play in portrait or landscape.</div><div class="help-foot"><button id="leave-net" class="secondary-button danger" hidden>Leave multiplayer race</button></div></div></div><div class="sr-only" aria-live="polite" id="announcer"></div>`;

const $=(id)=>document.getElementById(id);
const session=new RaceSession();const engine=session.engine;
const renderer=new TrackRenderer($('track'));
const controls=[...document.querySelectorAll('[data-action]')];
// Tour state: every Games is always selectable; selStage resumes at the
// highest unlocked stage. Top-3 finishes still auto-advance.
let selStage=Math.min(STAGES.length-1,Math.max(0,session.unlocked));
session.setStage(selStage);
// Discipline: 110m hurdles or 500m single sculls. The engine, the renderer and
// the multiplayer room all read this one field, so every mode stays in step.
function evInfo(){return getEvent(session.event);}
function isRowing(){return session.event==='rowing';}
function pickEvent(id){
  if(getEvent(id).id!==id)return;
  session.setEvent(id);
  engine.reset(84+(selStage*17));
  if(session.playerName)engine.player.name=session.playerName;
  clearAuto();overlayKey='';lastResults='';renderHud();
  showFeedback(getEvent(id).name.toUpperCase(),false,1400);
}
function pickStage(i){
  selStage=Math.min(STAGES.length-1,Math.max(0,i|0));
  session.setStage(selStage);
  overlayKey='';lastResults='';renderHud();
}
let autoTimer=null;
function clearAuto(){if(autoTimer){clearInterval(autoTimer);autoTimer=null;}}
let last=performance.now(),lastHud=0,overlayKey='',feedbackUntil=0,lastResults='',held=new Set(),helpWasRunning=false,helpReturn=null;
let soundEnabled=true,audioContext=null;
try{soundEnabled=localStorage.getItem('track84-sound')!=='off';}catch{}
function soundUI(){$('sound').innerHTML=svg(soundEnabled?'sound':'mute');$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'Mute sound':'Enable sound');$('sound').title=soundEnabled?'Mute sound':'Enable sound';}
function unlockAudio(){if(!soundEnabled)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}}
function tone(freq,duration=.08,volume=.035,type='square',end=null){if(!soundEnabled||!audioContext||audioContext.state!=='running')return;try{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime;o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+duration);}catch{}}
function vibrate(ms){try{navigator.vibrate?.(ms);}catch{}}
function showFeedback(text,error=false,duration=750){$('feedback').textContent=text;$('feedback').classList.toggle('error',error);$('feedback').hidden=false;feedbackUntil=performance.now()+duration;}
function clearHeld(){held.clear();controls.forEach(b=>b.classList.remove('pressed'));}
function stars(n){return '★'.repeat(n)+'☆'.repeat(5-n);}
function stageLabel(i){return difficultyFor(i).label;}

function quitToTitle(){
  clearAuto();
  session.setStage(selStage);
  engine.setEvent(session.event);
  engine.reset(84+(selStage*17));
  if(session.playerName)engine.player.name=session.playerName;
  overlayKey='';lastResults='';renderHud();
}
function begin(){
  const input=$('player-name');
  const name=String(input?input.value:session.playerName).trim().slice(0,12);
  if(!name){input?.focus();return;}
  input?.blur();unlockAudio();clearHeld();clearAuto();
  session.restart(name,selStage);lastResults='';overlayKey='';last=performance.now();session.accumulator=0;renderHud();
}
function beginStage(i){
  const name=(session.playerName||engine.player.name||'YOU').trim().slice(0,12)||'YOU';
  unlockAudio();clearHeld();clearAuto();
  selStage=Math.min(STAGES.length-1,Math.max(0,i|0));
  session.restart(name,selStage);lastResults='';overlayKey='';last=performance.now();session.accumulator=0;renderHud();
}
function newGameFlow(){
  // Arcade reset anytime: 3 lives, tour back to Athens, name re-entry.
  clearAuto();session.newGame();selStage=0;
  session.setStage(0);engine.setEvent(session.event);engine.reset(84);engine.player.name='YOU';
  overlayKey='';lastResults='';renderHud();
}
function changeName(){session.playerName='';session.saveCareer();overlayKey='';renderHud();setTimeout(()=>$('player-name')?.focus(),50);}
function pauseRace(){engine.pause();clearHeld();renderOverlay();}
function resumeRace(){engine.resume();last=performance.now();session.accumulator=0;renderOverlay();}
function action(letter){if(!$('help-dialog').hidden)return;if(net.active){netInput(letter);return;}unlockAudio();session.action(letter);consumeEvents();renderHud();}

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
  if(net.active){netKey(event);return;}
  if(event.code==='Enter'&&['ready','finished'].includes(engine.phase)){event.preventDefault();if(!event.repeat)primaryAction();return;}
  if(event.code==='Escape'||event.code==='KeyP'){event.preventDefault();if(event.repeat)return;if(engine.phase==='paused')resumeRace();else pauseRace();return;}
  const letter=keyMap[event.code];if(!letter)return;
  if(engine.phase==='ready'&&event.code==='Space')return;
  event.preventDefault();if(event.repeat||held.has(event.code))return;
  held.add(event.code);controls.find(b=>b.dataset.action===letter).classList.add('pressed');action(letter);
});
function primaryAction(){
  if(engine.phase==='ready'){begin();return;}
  if(engine.phase==='finished'){
    // Out of lives: coin up for a fresh arcade run.
    if(session.gameOver){newGameFlow();return;}
    // Paris 2024 cleared: loop back to Athens 1896.
    if(session.stageIndex>=STAGES.length-1){beginStage(0);return;}
    // Top-3 auto-advance is pending: jump now, otherwise retry.
    if(autoTimer){const next=session.stageIndex+1;if(next<STAGES.length&&next<=session.unlocked){beginStage(next);return;}}
    beginStage(session.stageIndex);
  }
}
document.addEventListener('keyup',event=>{held.delete(event.code);const letter=keyMap[event.code];if(letter&&!Object.entries(keyMap).some(([key,val])=>val===letter&&held.has(key)))controls.find(b=>b.dataset.action===letter).classList.remove('pressed');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!net.active)pauseRace();});
window.addEventListener('blur',()=>{if(!net.active&&(engine.phase==='racing'||engine.phase==='countdown'))pauseRace();clearHeld();});
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;soundUI();unlockAudio();try{localStorage.setItem('track84-sound',soundEnabled?'on':'off');}catch{}if(soundEnabled)tone(620);});
$('pause').addEventListener('click',()=>{if(net.active)return;if(engine.phase==='paused')resumeRace();else pauseRace();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else showFeedback('Use your browser for full screen',false,2000);}catch{showFeedback('Full screen is unavailable',false,2000);}});
function openHelp(){helpReturn=document.activeElement;helpWasRunning=!net.active&&['racing','countdown'].includes(engine.phase);if(helpWasRunning)pauseRace();$('leave-net').hidden=!net.active;$('help-dialog').hidden=false;$('close-help').focus();}
function closeHelp(){$('help-dialog').hidden=true;if(helpWasRunning)resumeRace();helpReturn?.focus();}
$('help').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);$('help-dialog').addEventListener('click',event=>{if(event.target===$('help-dialog'))closeHelp();});
$('leave-net').addEventListener('click',()=>{closeHelp();netLeave();});

function formatTime(time){return time.toFixed(2).padStart(5,'0');}

function renderOverlay(){
  let state=engine.phase;
  if(engine.player.finishTime!==null&&state!=='paused')state='results';
  const key=state==='countdown'?`countdown-${Math.ceil(engine.countdown)}`:state==='ready'?`ready-${selStage}-${!!(session.playerName||'').trim()}`:state==='results'?`results-${session.stageIndex}-${engine.player.finishTime}`:state;
  if(key===overlayKey){if(state==='results')renderResults();return;}
  overlayKey=key;$('overlay').hidden=state==='racing';
  if(state==='ready'){
    // No-scroll stage card: any of the 30 Games, name inline, one tap to run.
    const i=selStage, s=STAGES[i], d=difficultyFor(i);
    const hasName=!!(session.playerName||'').trim();
    const options=STAGES.map((o,k)=>`<option value="${k}"${k===i?' selected':''}>${o.year} ${escapeHTML(o.city)} · ${escapeHTML(o.country)}</option>`).join('');
    $('overlay').innerHTML=`<div class="stage-panel"><div class="stage-nav"><button id="prev-stage" class="nav-button" aria-label="Previous Games" ${i<=0?'disabled':''}>◀</button><div class="start-kicker">STAGE ${String(i+1).padStart(2,'0')}/30 · ${d.label}</div><button id="next-stage-pick" class="nav-button" aria-label="Next Games" ${i>=STAGES.length-1?'disabled':''}>▶</button></div>
      <h2 class="stage-name">${s.year} <span>${escapeHTML(s.city).toUpperCase()}</span></h2>
      <p class="stage-place">${escapeHTML(s.stadium)} · ${escapeHTML(s.country)} · ${stars(d.stars)}</p>
      <select id="stage-select" class="stage-select" aria-label="Choose Games">${options}</select>
      ${hasName
        ? `<button id="start-race" class="start-button big">Start ${s.year} ${escapeHTML(s.city)} <span aria-hidden="true">▶</span></button><button id="change-name" class="link-button">${escapeHTML(session.playerName)} · change name</button><button id="open-net" class="link-button net-cta">👥 Multiplayer · up to 5 Players</button>`
        : `<form id="start-form" class="start-form inline"><input id="player-name" name="playerName" aria-label="Player name" placeholder="YOUR NAME" maxlength="12" autocomplete="nickname" autocapitalize="words" enterkeyhint="go" spellcheck="false" required /><button id="start-race" type="submit" class="start-button" disabled>Start <span aria-hidden="true">▶</span></button></form><button id="open-net" class="link-button net-cta">👥 Multiplayer · up to 5 Players</button>`}</div>`;
    $('prev-stage').addEventListener('click',()=>pickStage(selStage-1));
    $('next-stage-pick').addEventListener('click',()=>pickStage(selStage+1));
    $('stage-select').addEventListener('change',event=>pickStage(Number(event.target.value)));
    $('open-net').addEventListener('click',()=>{unlockAudio();netOpenMenu();});
    if(hasName){
      $('start-race').addEventListener('click',begin);
      $('change-name').addEventListener('click',changeName);
    }else{
      const form=$('start-form'),input=$('player-name'),btn=$('start-race');
      form.addEventListener('submit',event=>{event.preventDefault();begin();});
      input.addEventListener('input',event=>{btn.disabled=!event.target.value.trim();});
    }
  }else if(state==='countdown'){
    const s=STAGES[session.stageIndex];
    $('overlay').innerHTML=`<div><div class="count-number">${Math.ceil(engine.countdown)}</div><div class="count-label">${s.year} ${escapeHTML(s.city)} · Get ready to alternate L · R!</div></div>`;
  }else if(state==='paused'){
    $('overlay').innerHTML='<div class="paused-panel"><h2>PAUSED</h2><p>Catch your breath. The track can wait.</p><div class="pause-actions"><button id="resume" class="start-button">Resume race ▶</button><button id="restart" class="secondary-button">Restart</button><button id="quit-title" class="secondary-button">Quit stage</button><button id="new-game" class="secondary-button danger">New game</button></div></div>';
    $('resume').addEventListener('click',resumeRace);$('restart').addEventListener('click',()=>beginStage(session.stageIndex));$('quit-title').addEventListener('click',()=>{engine.resume();quitToTitle();});$('new-game').addEventListener('click',()=>{engine.resume();newGameFlow();});$('resume').focus();
  }else if(state==='results'){
    lastResults='';
    $('overlay').innerHTML='<div class="results-panel"><h2 id="result-heading">FINISH!</h2><div class="result-stage" id="result-stage"></div><div class="result-summary" id="result-summary"></div><ol id="results-list" class="results-list"></ol><p class="result-next" id="result-next" hidden></p><div class="result-actions"><button id="primary-race" class="start-button">Race again <span aria-hidden="true">↻</span></button><button id="retry-race" class="secondary-button">Retry</button></div></div>';
    $('primary-race').addEventListener('click',()=>primaryAction());
    $('retry-race').addEventListener('click',()=>beginStage(session.stageIndex));
    renderResults();
  }else $('overlay').innerHTML='';
}
function renderResults(){
  const standings=engine.standings();const key=standings.map(r=>`${r.id}:${r.finishTime}`).join()+`-${session.stageIndex}-${session.event}`;
  if(key===lastResults)return;lastResults=key;
  clearAuto();
  const rank=standings.findIndex(r=>r.human)+1;
  const advanced=rank<=3;
  if(engine.phase==='finished')session.recordResult(rank,advanced);
  const s=STAGES[session.stageIndex], d=difficultyFor(session.stageIndex);
  const next=STAGES[session.stageIndex+1];
  const hasNext=advanced&&next&&session.stageIndex+1<=session.unlocked;
  const tourDone=session.stageIndex>=STAGES.length-1&&engine.phase==='finished';
  $('result-heading').textContent=rank===1?'1ST PLACE!':rank===2?'2ND PLACE!':rank===3?'3RD PLACE!':'FINISH!';
  $('result-stage').textContent=`${s.year} ${s.city} · ${isRowing()?evInfo().venueLabel:s.stadium} · ${stars(d.stars)} ${d.label}`;
  $('result-summary').innerHTML=engine.mode==='rowing'
    ?`<span>TIME <b>${formatTime(engine.player.finishTime)}s</b></span><span>STROKES <b>${engine.player.strokes}</b></span><span>CRABS <b>${engine.player.crabs}</b></span>`
    :`<span>TIME <b>${formatTime(engine.player.finishTime)}s</b></span><span>CLEARED <b>${engine.player.cleared}/10</b></span><span>FALLS <b>${engine.player.falls}</b></span>`;
  $('results-list').innerHTML=standings.map((r,i)=>`<li class="${r.human?'you':''}"><span>${i+1}</span><span style="color:${r.color}">■</span><span class="result-name">${escapeHTML(r.name)}${r.human?' · YOU':''}</span><span class="result-time">${r.finishTime===null?'Racing…':formatTime(r.finishTime)+'s'}</span></li>`).join('');
  const nextLine=$('result-next'), primary=$('primary-race'), retry=$('retry-race');
  if(engine.phase==='finished'&&session.gameOver){
    $('result-heading').textContent='GAME OVER';
    nextLine.hidden=false;nextLine.innerHTML=`💀 OUT OF LIVES — 3 MISSES`;
    primary.innerHTML=`New game ↺`;retry.hidden=true;primary.focus();
  }else if(tourDone){
    nextLine.hidden=false;nextLine.innerHTML=`🏆 TOUR COMPLETE — PARIS 2024 CONQUERED!`;
    primary.innerHTML=`Back to start ↺`;retry.hidden=false;retry.innerHTML=`Race again <span aria-hidden="true">↻</span>`;primary.focus();
  }else if(hasNext){
    // Top-3: announce the next Games and auto-advance after 5s.
    nextLine.hidden=false;
    primary.innerHTML=`Next: ${next.year} ${escapeHTML(next.city)} ▶ <b id="auto-count">5</b>`;
    retry.hidden=false;
    primary.focus();
    const deadline=performance.now()+5000;
    autoTimer=setInterval(()=>{
      const left=Math.max(0,(deadline-performance.now())/1000);
      $('auto-count')&&($('auto-count').textContent=String(Math.ceil(left)));
      if(left<=0){clearAuto();if(!document.hidden)beginStage(session.stageIndex+1);}
    },200);
  }else if(engine.phase==='finished'&&!advanced){
    nextLine.hidden=false;nextLine.textContent=`${rank}${["st","nd","rd"][rank-1]||"th"} — LIFE LOST · ${session.lives} LEFT · NEXT: ${next?`${next.year} ${next.city.toUpperCase()}, ${next.country.toUpperCase()}`:'—'}`;
    primary.innerHTML=`Try again <span aria-hidden="true">↻</span>`;retry.hidden=true;primary.focus();
  }else{
    nextLine.hidden=true;primary.innerHTML=`Race again <span aria-hidden="true">↻</span>`;retry.hidden=false;
  }
}
function refreshStageChrome(){
  const i=Math.min(STAGES.length-1,Math.max(0,engine.phase==='ready'?selStage:session.stageIndex));
  const s=STAGES[i], d=difficultyFor(i);
  const idx=STAGES.indexOf(s);
  const ev=evInfo(), rowing=isRowing();
  const venue=rowing?ev.venueLabel:s.stadium;
  $('stage-pill').textContent=`STAGE ${String(idx+1).padStart(2,'0')}/30 · ${s.year}`;
  $('stage-eyebrow').textContent=`OLYMPIC ROAD · STAGE ${String(idx+1).padStart(2,'0')}/30 · ${ev.name.toUpperCase()} · ${d.label}`;
  $('stage-title').textContent=`${s.year} ${s.city} · ${ev.name}`;
  $('stage-sub').textContent=`${venue} · ${s.country}`;
  $('stage-stars').textContent=`${stars(d.stars)} ${d.label}`;
  $('arena-location').textContent=`${s.year} ${s.city.toUpperCase()} • ${venue.toUpperCase().slice(0,26)}`;
  // Chrome that changes meaning with the discipline (J is a jump on land and a
  // power-ten call on the water), all driven from the event registry.
  $('meta-count').textContent=ev.meta.split(' ')[0];
  $('meta-label').textContent=ev.meta.split(' ').slice(1).join(' ');
  $('distance-max').textContent=`/${engine.distance}m`;
  $('race-caption').textContent=ev.caption;
  $('jump-label').textContent=ev.action;
  $('jump-sub').textContent=ev.actionSub;
  $('controls-hint').innerHTML=rowing
    ?'<b>L ↔ R</b> alternate oars <span class="divider">/</span> <b>J</b> call a power ten'
    :'<b>L ↔ R</b> alternate to run <span class="divider">/</span> <b>J</b> time your jump';
  $('rhythm-title').textContent=rowing?'STROKE RHYTHM':'YOUR RHYTHM';
  $('rhythm-copy').innerHTML=rowing
    ?'Smooth strokes ride clean water. <strong>Do not blow up.</strong><br/>J calls a power ten — twice a race.'
    :'Quicker taps. <strong>Faster feet.</strong><br/>Jump when the J button lights up.';
  $('leg-l-label').textContent=rowing?'PORT OAR':'LEFT LEG';
  $('leg-l-sub').textContent=rowing?'PULL':'ALTERNATE';
  $('leg-r-label').textContent=rowing?'STARBOARD':'RIGHT LEG';
  $('leg-r-sub').textContent=rowing?'PULL':'TO RUN';
  $('track').setAttribute('aria-label',rowing
    ?'Five single sculls race 500 metres. Your boat wears lime green in lane three.'
    :'Five runners race over hurdles. Your runner wears lime green in lane three.');
  $('cabinet').setAttribute('aria-label',`${ev.name} race`);
  const done=session.medalCount();
  $('career-note').textContent=`CLEARED ${done}/30 · ${rowing?'REGATTA ROAD TO PARIS 2024':'ROAD TO PARIS 2024'}`;
}
function renderHud(){
  const p=engine.player,rank=engine.standings().findIndex(r=>r.human)+1,w=engine.jumpWindow();
  const rowing=engine.mode==='rowing',dist=engine.distance;
  refreshStageChrome();
  $('position').textContent=engine.phase==='ready'?'—':rank;
  $('time').textContent=formatTime(p.finishTime??engine.time);$('speed').textContent=p.speed.toFixed(1);$('distance').textContent=Math.floor(p.x);
  $('progress').style.width=`${p.x/dist*100}%`;
  $('race-progress').setAttribute('aria-valuemax',String(dist));
  $('race-progress').setAttribute('aria-valuenow',String(Math.floor(p.x)));
  $('cadence').textContent=`${p.cadence.toFixed(1)} /s`;
  [...$('speed-meter').children].forEach((el,i)=>el.classList.toggle('on',i<p.speed/engine.rules.maxSpeed*10));
  [...$('rhythm-bars').children].forEach((el,i)=>el.classList.toggle('on',i<p.cadence/9*20));
  if(rowing){
    // On the water the ten pips are the crew's remaining stamina.
    const lit=Math.round(p.stamina*10);
    [...$('hurdle-pips').children].forEach((el,i)=>el.className=i<lit-1?'clear':(i===lit-1?'next':''));
    $('hurdle-pips').setAttribute('aria-label',`Stamina ${Math.round(p.stamina*100)} percent, ${p.powerCharges} power tens left`);
  }else{
    [...$('hurdle-pips').children].forEach((el,i)=>el.className=p.hurdleResults[i]??(i===p.hurdleIndex?'next':''));
    $('hurdle-pips').setAttribute('aria-label',`${p.cleared} hurdles cleared, ${p.falls} collisions`);
  }
  $('lives').style.display='';
  $('lives').textContent='❤'.repeat(session.lives)+''.repeat(Math.max(0,3-session.lives));
  $('lives').setAttribute('aria-label',`${session.lives} lives remaining`);
  const powerReady=rowing&&engine.phase==='racing'&&p.powerCharges>0&&p.powerTen<=0&&p.crabRemaining===0&&p.speed>1.5;
  const cue=rowing?powerReady:(engine.phase==='racing'&&w.ideal&&p.jumpAge===null&&p.fallRemaining===0);
  controls.find(b=>b.dataset.action==='J').classList.toggle('cue',cue);
  if(rowing)$('jump-sub').textContent=p.powerCharges>0?`TEN · ${p.powerCharges} LEFT`:'TEN · USED';
  const status=$('jump-status');status.classList.toggle('perfect',cue);
  if(engine.phase==='ready')status.textContent=rowing?'L ↔ R · ROW WHEN READY':'L ↔ R · GET READY';
  else if(p.finishTime!==null)status.textContent=rowing?'FINISH · GLIDE HOME!':'FINISH · WELL RUN!';
  else if(engine.phase==='paused')status.textContent='Paused';
  else if(rowing&&p.falseStart&&engine.time<ROWING.falseStartLock)status.textContent='FALSE START · BOAT HELD';
  else if(rowing&&p.crabRemaining>0)status.textContent='CRAB! HOLD YOUR LINE';
  else if(rowing&&p.powerTen>0)status.textContent='POWER TEN! LIFT THE BOAT';
  else if(rowing&&p.stamina<=.02)status.textContent='SPENT · EASE OFF AND RESET';
  else if(rowing&&cue)status.textContent='POWER TEN READY — PRESS J';
  else if(rowing&&p.swing)status.textContent='SWING · CLEAN WATER';
  else if(rowing)status.textContent=`${Math.max(0,dist-p.x).toFixed(0)}m TO GO · HOLD THE RHYTHM`;
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
    if(event.type==='repeat'&&performance.now()>feedbackUntil)showFeedback(engine.mode==='rowing'?'SAME OAR — SWITCH':'L ↔ R',false,350);
    // Rowing: a stuck oar, a jump on the gun, and the coxswain's power ten.
    if(event.type==='crab'){showFeedback('CRAB!',true,850);tone(140,.3,.07,'sawtooth',55);vibrate([40,30,60]);$('announcer').textContent='You caught a crab. Hold your line and row again.';}
    if(event.type==='falsestart'){showFeedback('FALSE START',true,1000);tone(120,.32,.07,'sawtooth',80);$('announcer').textContent='False start. The boat is held for a moment.';}
    if(event.type==='power'){showFeedback('POWER TEN!');tone(392,.16,.04);vibrate(24);$('announcer').textContent='Power ten called.';}
    if(event.type==='jump')tone(270,.16,.035,'square',760);
    if(event.type==='clear'){showFeedback(event.perfect?'PERFECT!':'NICE JUMP!');tone(event.perfect?1047:784,.12,.035);vibrate(16);$('announcer').textContent=`${engine.player.cleared} hurdles cleared`;
    }
    if(event.type==='fall'){showFeedback('OUCH!',true,800);tone(180,.23,.07,'sawtooth',50);vibrate([50,30,60]);$('announcer').textContent='You hit a hurdle. Get back up, then keep running.';}
    if(event.type==='finish'){tone(1047,.35,.05);$('announcer').textContent=`Finished! ${formatTime(engine.player.finishTime)} seconds`;}
  }
}
// ================= MULTIPLAYER (realtime, up to 5 phones) =================
// Server-authoritative: the host simulates, clients send L/R/J and render
// 20 Hz snapshots. Solo flow above is untouched; everything net lives here.
const net = {
  active: false, client: null, view: new NetView(),
  lane: 2, myId: null, room: null, screen: 'menu', // menu|lobby|race|over
  lastOver: null, err: '', connectBusy: false, rtt: null, invited: false,
  cadence: { last: 0, times: [] },
};
function netIsHost(){ return !!net.room?.players?.some(p=>p.id===net.myId&&p.host); }
function netStageOptions(sel){
  return STAGES.map((o,k)=>`<option value="${k}"${k===sel?' selected':''}>${o.year} ${escapeHTML(o.city)} · ${escapeHTML(o.country)}</option>`).join('');
}
function netEventOptions(sel){
  return EVENTS.map(e=>`<option value="${e.id}"${e.id===sel?' selected':''}>${escapeHTML(e.name)}</option>`).join('');
}
function netLobbySlots(){
  if(!net.room) return '';
  const byLane = new Map(net.room.players.map(p=>[p.lane,p]));
  let html = '';
  for(let lane=0;lane<5;lane++){
    const p = byLane.get(lane);
    html += p
      ? `<span class="slot" style="--runner:${COLORS[lane]}"><i></i>${escapeHTML(p.name)}${p.id===net.myId?' · YOU':''}${p.host?' · HOST':''}${p.connected?'':' · away'}</span>`
      : `<span class="slot empty"><i></i>CPU · open lane</span>`;
  }
  return html;
}
function netOpenMenu(invited = false){
  net.active = true; net.screen = 'menu'; net.err = ''; net.lastOver = null; net.invited = !!invited;
  net.view = new NetView(); net.cadence = { last: 0, times: [] };
  clearHeld(); overlayKey = ''; lastResults = '';
  renderNetOverlay(); netChrome();
}
function netLeave(){
  clearResume();
  try{ net.client?.leave(); }catch{}
  try{ net.client?.close(); }catch{}
  net.client = null; net.active = false; net.room = null;
  net.screen = 'menu'; net.err = ''; net.lastOver = null; net.invited = false;
  quitToTitle();
}
async function netShare(){
  // Invite via SMS / KakaoTalk / ... : Web Share sheet when available,
  // clipboard copy otherwise. The link carries ?room=CODE so guests join
  // without typing the code; the host stays implicit (same origin).
  const code = net.room?.code;
  if(!code || net.screen !== 'lobby') return;
  const url = inviteLinkFor(code, inviteBase());
  const text = `Join my TRACK/84 race! Room ${code}`;
  if(typeof navigator !== 'undefined' && navigator.share){
    try{ await navigator.share({ title: 'TRACK/84 multiplayer race', text, url }); }catch{}
    return;
  }
  const body = `${text} ${url}`;
  try{
    await navigator.clipboard.writeText(body);
    showFeedback('Invite link copied!', false, 1500);
  }catch{
    try{ window.prompt('Copy your invite link:', body); }catch{}
  }
}
function attachNetHandlers(client){
  client.on('you', m=>{ net.myId = m.id; net.lane = m.lane; });
  client.on('room', m=>{
    net.room = m; net.err = '';
    if(m.code) saveResume(m.code, session.playerName);
    if(m.phase==='racing') net.screen = 'race';
    else if(m.phase==='lobby' && net.screen!=='menu') net.screen = 'lobby';
    overlayKey = '';
  });
  client.on('snap', m=>{
    net.view.applySnap(m, net.lane);
    if(net.screen==='lobby') net.screen = 'race';
  });
  client.on('fx', m=>netFx(m.events ?? []));
  client.on('over', m=>{ net.lastOver = m; net.screen = 'over'; overlayKey = ''; });
  client.on('err', m=>{ net.err = m.msg || 'Error'; if(net.err === 'Room not found') clearResume(); overlayKey = ''; });
  client.on('rtt', ms=>{ net.rtt = ms; const el=$('net-ping'); if(el) el.textContent = `${Math.round(ms)}ms`; });
  client.on('closed', ()=>{
    if(!net.active) return;
    // Menu that never joined (e.g. a failed connect): ignore the stray close.
    if(net.screen === 'menu' && !net.room){ net.client = null; return; }
    const resume = loadResume();
    net.client = null; net.active = false; net.room = null; net.screen = 'menu';
    if(resume){
      // Socket dropped but the page is alive (app switch): one-tap rejoin.
      netOpenMenu();
      if($('net-name') && resume.name) $('net-name').value = resume.name;
      if($('net-code')) $('net-code').value = resume.code;
      net.err = 'Disconnected — tap Join to rejoin'; overlayKey = ''; renderNetOverlay();
    }else{ quitToTitle(); showFeedback('Disconnected from host', true, 2000); }
  });
}
async function netConnect(create){
  if(net.connectBusy) return;
  const name = String($('net-name')?.value ?? session.playerName).trim().slice(0,12) || session.playerName || 'Guest';
  const host = String($('net-host')?.value ?? '').trim() || loadHostUrl();
  const code = formatCode($('net-code')?.value ?? '');
  if(!create && code.length!==4){ net.err = 'Enter the 4-letter room code'; overlayKey=''; renderNetOverlay(); return; }
  net.connectBusy = true; net.err = 'Connecting…'; overlayKey=''; renderNetOverlay();
  const client = new NetClient();
  attachNetHandlers(client);
  try{
    await client.connect(host);
  }catch{ net.err = 'Cannot reach host. Check the address.'; net.connectBusy = false; overlayKey=''; renderNetOverlay(); return; }
  saveHostUrl(host);
  session.playerName = name; session.saveCareer();
  net.client = client; net.connectBusy = false; net.err = '';
  net.screen = 'lobby'; overlayKey='';
  if(create) client.create(name, selStage, session.event);
  else client.join(code, name);
  renderNetOverlay();
}
function netInput(letter){
  if(!net.client?.connected || net.screen!=='race' || net.view.phase!=='racing') return;
  unlockAudio();
  if(!net.client.input(letter)) return;
  const now = performance.now();
  if(letter==='L'||letter==='R'){
    tone(letter==='L'?110:145,.026,.012,'triangle');
    const dt = (now - net.cadence.last)/1000; net.cadence.last = now;
    if(dt < .8 && dt > .02){ net.cadence.times.push(dt); if(net.cadence.times.length>5) net.cadence.times.shift(); }
    else net.cadence.times = [];
  }else tone(270,.16,.035,'square',760);
}
function netFx(events){
  const mine = `runner-${net.lane}`;
  for(const ev of events){
    if(ev.type==='countdown'){ tone(440,.09,.05); $('announcer').textContent = String(ev.value); }
    else if(ev.type==='go'){ tone(880,.3,.05); showFeedback('GO!',false,650); $('announcer').textContent='Go!'; }
    else if(ev.type==='step'||ev.type==='repeat'||ev.type==='jump'||ev.type==='complete'){ /* optimistic/locally covered */ }
    else{
      if(ev.runnerId && ev.runnerId!==mine) continue;
      if(ev.type==='clear'){ showFeedback(ev.perfect?'PERFECT!':'NICE JUMP!'); tone(ev.perfect?1047:784,.12,.035); vibrate(16); $('announcer').textContent='Hurdle cleared'; }
      else if(ev.type==='crab'){ showFeedback('CRAB!',true,800); tone(140,.3,.07,'sawtooth',55); vibrate([40,30,60]); $('announcer').textContent='You caught a crab. Hold your line!'; }
      else if(ev.type==='falsestart'){ showFeedback('FALSE START',true,1000); tone(120,.32,.07,'sawtooth',80); $('announcer').textContent='False start. The boat is held.'; }
      else if(ev.type==='power'){ showFeedback('POWER TEN!'); tone(392,.16,.04); $('announcer').textContent='Power ten called.'; }
      else if(ev.type==='fall'){ showFeedback('OUCH!',true,800); tone(180,.23,.07,'sawtooth',50); vibrate([50,30,60]); $('announcer').textContent='You hit a hurdle. Get back up!'; }
      else if(ev.type==='finish'){ tone(1047,.35,.05); const me=net.view.player; $('announcer').textContent=`Finished! ${me?.finishTime!=null?formatTime(me.finishTime)+' seconds':''}`; }
    }
  }
}
function netKey(event){
  if(event.ctrlKey||event.metaKey||event.altKey) return;
  if(event.code==='Enter'&&!event.repeat){
    event.preventDefault();
    if(net.screen==='lobby'&&netIsHost()){ net.client?.start(); return; }
    if(net.screen==='over'&&netIsHost()){ net.client?.again(); return; }
    return;
  }
  if(event.code==='Escape'||event.code==='KeyP'){ event.preventDefault(); return; } // no pause online
  const letter=keyMap[event.code]; if(!letter) return;
  event.preventDefault(); if(event.repeat||held.has(event.code)) return;
  held.add(event.code); controls.find(b=>b.dataset.action===letter).classList.add('pressed'); netInput(letter);
}
function netEvent(){return getEvent(net.room?.event ?? net.view.mode ?? session.event);}
function netChrome(){
  const stageIdx = net.room?.stage ?? net.view.stageIndex ?? 0;
  const s = STAGES[Math.min(STAGES.length-1,Math.max(0,stageIdx))], d = difficultyFor(STAGES.indexOf(s));
  const n = net.room?.players?.filter(p=>p.connected).length ?? 0;
  const ev = netEvent(), rowing = ev.id === 'rowing', venue = rowing ? ev.venueLabel : s.stadium;
  $('stage-pill').textContent = net.room ? `ROOM ${net.room.code}` : 'MULTI';
  $('stage-eyebrow').textContent = `MULTIPLAYER · ${net.room?`ROOM ${net.room.code} · ${n}/5`:''} · ${ev.name.toUpperCase()} · ${d.label}`;
  $('stage-title').textContent = `${s.year} ${s.city} · ${ev.name}`;
  $('stage-sub').textContent = `${venue} · ${s.country}`;
  $('stage-stars').textContent = `${stars(d.stars)} ${d.label}`;
  $('arena-location').textContent = `${s.year} ${s.city.toUpperCase()} • ${venue.toUpperCase().slice(0,26)}`;
  $('meta-count').textContent = ev.meta.split(' ')[0];
  $('meta-label').textContent = ev.meta.split(' ').slice(1).join(' ');
  $('distance-max').textContent = `/${net.view.distance}m`;
  $('race-caption').textContent = ev.caption;
  $('jump-label').textContent = ev.action;
  $('controls-hint').innerHTML = rowing
    ? '<b>L ↔ R</b> alternate oars <span class="divider">/</span> <b>J</b> call a power ten'
    : '<b>L ↔ R</b> alternate to run <span class="divider">/</span> <b>J</b> time your jump';
  $('rhythm-title').textContent = rowing ? 'STROKE RHYTHM' : 'YOUR RHYTHM';
  $('leg-l-label').textContent = rowing ? 'PORT OAR' : 'LEFT LEG';
  $('leg-r-label').textContent = rowing ? 'STARBOARD' : 'RIGHT LEG';
  $('track').setAttribute('aria-label', rowing
    ? 'Five single sculls race. Your boat wears lime green in lane three.'
    : 'Five runners race over hurdles. Your runner wears lime green in lane three.');
  $('cabinet').setAttribute('aria-label', `${ev.name} race`);
  $('career-note').textContent = net.room ? `${ev.name.toUpperCase()} · ${n} RACER${n===1?'':'S'}${net.rtt!=null?` · ${Math.round(net.rtt)}MS`:''}` : 'MULTIPLAYER';
}
function netCadence(){
  const c = net.cadence;
  if(performance.now()-c.last > 800 || !c.times.length) return 0;
  return Math.min(12, c.times.length / c.times.reduce((a,b)=>a+b,0));
}
function netRenderHud(){
  netChrome();
  const own = net.view.player;
  const order = net.view.runners.length ? netStandings(net.view.runners) : [];
  const rank = own ? order.findIndex(r=>r.lane===net.lane)+1 : 0;
  const racing = net.screen==='race' && ['racing','countdown'].includes(net.view.phase);
  $('position').textContent = own&&net.view.phase!=='lobby' ? rank : '—';
  $('time').textContent = formatTime(net.view.time); $('speed').textContent = own?own.speed.toFixed(1):'0.0'; $('distance').textContent = own?Math.floor(own.x):0;
  $('progress').style.width = own?`${own.x/net.view.distance*100}%`:'0%';
  const cad = netCadence();
  const rowing = net.view.mode === 'rowing';
  $('cadence').textContent = `${cad.toFixed(1)} /s`;
  [...$('speed-meter').children].forEach((el,i)=>el.classList.toggle('on',own&&i<own.speed/(rowing?ROWING.maxSpeed:RULES.maxSpeed)*10));
  [...$('rhythm-bars').children].forEach((el,i)=>el.classList.toggle('on',i<cad/9*20));
  if(rowing && own){
    const lit = Math.round((own.stamina ?? 1)*10);
    [...$('hurdle-pips').children].forEach((el,i)=>{ el.className = i<lit-1?'clear':(i===lit-1?'next':''); });
    $('hurdle-pips').setAttribute('aria-label',`Stamina ${Math.round((own.stamina ?? 1)*100)} percent`);
  }else{
    [...$('hurdle-pips').children].forEach((el,i)=>{ el.className = own ? (own.hurdleResults[i]??(i===own.hurdleIndex?'next':'')) : ''; });
  }
  $('lives').style.display = 'none';
  const w = net.view.jumpWindow(own);
  const powerReady = rowing && racing && net.view.phase==='racing' && own && own.powerCharges>0 && own.powerTen<=0 && own.crabRemaining===0 && own.speed>1.5;
  const cue = rowing ? powerReady : (racing && net.view.phase==='racing' && w.ideal && own && own.jumpAge===null && own.fallRemaining===0);
  controls.find(b=>b.dataset.action==='J').classList.toggle('cue',!!cue);
  if(rowing && own) $('jump-sub').textContent = own.powerCharges>0 ? `TEN · ${own.powerCharges} LEFT` : 'TEN · USED';
  const status = $('jump-status'); status.classList.toggle('perfect',!!cue);
  if(net.screen==='menu') status.textContent = 'CREATE OR JOIN A ROOM';
  else if(net.screen==='lobby') status.textContent = netIsHost() ? 'PRESS START WHEN READY' : 'Waiting for the host…';
  else if(!own) status.textContent = 'Waiting for the host…';
  else if(own.finishTime!==null) status.textContent = rowing?'FINISH · GLIDE HOME!':'FINISH · WELL RUN!';
  else if(net.view.phase==='countdown') status.textContent = 'ON YOUR MARKS…';
  else if(rowing&&own.crabRemaining>0) status.textContent = 'CRAB! HOLD YOUR LINE';
  else if(own.fallRemaining>0) status.textContent = 'GETTING UP… KEEP GOING';
  else if(rowing&&own.powerTen>0) status.textContent = 'POWER TEN! LIFT THE BOAT';
  else if(rowing&&(own.stamina??1)<=.02) status.textContent = 'SPENT · EASE OFF AND RESET';
  else if(cue) status.textContent = rowing?'POWER TEN READY — PRESS J':'JUMP NOW!';
  else if(own.jumpAge!==null) status.textContent = 'AIRBORNE';
  else if(rowing&&own.swing) status.textContent = 'SWING · CLEAN WATER';
  else if(rowing) status.textContent = `${Math.max(0,net.view.distance-own.x).toFixed(0)}m TO GO · HOLD THE RHYTHM`;
  else if(!Number.isFinite(w.distance)) status.textContent = 'FINAL SPRINT!';
  else status.textContent = `NEXT HURDLE ${String(own.hurdleIndex+1).padStart(2,'0')} · ${Math.max(0,w.distance).toFixed(1)}m`;
  const labels = { lobby:'IN THE LOBBY', countdown:'ON YOUR MARKS', racing:'RACE IN PROGRESS', finished:'RACE COMPLETE' };
  $('race-state').textContent = net.screen==='menu'||net.screen==='lobby' ? 'IN THE LOBBY' : (labels[net.view.phase]||'RACE IN PROGRESS');
  $('pause').disabled = true; $('pause').setAttribute('aria-label','Pause unavailable online');
  $('opponents').innerHTML = order.map((r,i)=>`<span class="opponent ${r.lane===net.lane?'you':''}" style="--runner:${r.color}"><i></i>${escapeHTML(r.name)} ${i+1}</span>`).join('');
  renderNetOverlay();
}
function renderNetOverlay(){
  const room = net.room;
  const key = net.screen==='menu' ? `netmenu-${net.invited?1:0}-${net.err}-${!!net.connectBusy}`
    : net.screen==='lobby' ? `netlobby-${room?room.code+':'+room.players.map(p=>p.id+p.name+(p.connected?1:0)).join(',')+':'+room.stage+':'+room.event:'-'}-${netIsHost()}-${net.err}`
    : net.screen==='race' ? `netrace-${net.view.phase}-${net.view.phase==='countdown'?Math.ceil(net.view.countdown):''}`
    : `netover-${net.lastOver?net.lastOver.standings.map(s=>s.id+s.finishTime).join(','):''}-${netIsHost()}`;
  if(key===overlayKey) return;
  overlayKey = key;
  if(net.screen==='menu'){
    const invited = net.invited;
    $('overlay').hidden = false;
    $('overlay').innerHTML = `<div class="stage-panel net-menu"><div class="start-kicker">MULTIPLAYER · UP TO 5 PLAYERS</div>
      <h2 class="stage-name small">${invited ? 'JOIN <span>ROOM</span>' : 'RACE <span>FRIENDS</span>'}</h2>
      <form id="net-form" class="start-form"><input id="net-name" aria-label="Player name" placeholder="YOUR NAME" maxlength="12" autocomplete="nickname" enterkeyhint="go" spellcheck="false" value="${escapeHTML(session.playerName||'')}" /><input id="net-host" aria-label="Host address" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" value="${escapeHTML(loadHostUrl())}" /><div class="net-join"><input id="net-code" aria-label="Room code" placeholder="CODE" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" />${invited
        ? `<button id="net-join" type="submit" class="start-button">Join <span aria-hidden="true">▶</span></button>`
        : `<button id="net-create" type="submit" class="start-button">Create <span aria-hidden="true">▶</span></button><button id="net-join" type="button" class="secondary-button">Join</button>`}</div>${net.err?`<p class="net-err">${escapeHTML(net.err)}</p>`:''}${invited?`<button id="net-uninvite" type="button" class="link-button">or create a new room</button>`:''}<button id="net-back" type="button" class="link-button">← Solo tour</button></form></div>`;
    $('net-form').addEventListener('submit',event=>{event.preventDefault();netConnect(!net.invited);});
    if(invited) $('net-uninvite').addEventListener('click',()=>{ net.invited = false; overlayKey = ''; renderNetOverlay(); });
    else $('net-join').addEventListener('click',()=>netConnect(false));
    $('net-back').addEventListener('click',()=>netLeave());
  }else if(net.screen==='lobby'){
    const host = netIsHost();
    const stage = room?.stage ?? selStage;
    $('overlay').hidden = false;
    $('overlay').innerHTML = `<div class="stage-panel wide"><div class="start-kicker">ROOM · SHARE THIS CODE</div>
      <h2 class="room-code">${room?escapeHTML(room.code):'····'}</h2>
      <div class="lobby-players">${netLobbySlots()}</div>
      <select id="net-event" class="stage-select" aria-label="Olympic event" ${host?'':'disabled'}>${netEventOptions(room?.event ?? session.event)}</select>
      <select id="net-stage" class="stage-select" aria-label="Race stage" ${host?'':'disabled'}>${netStageOptions(stage)}</select>
      ${host?`<button id="net-start" class="start-button big slim">Start race <span aria-hidden="true">▶</span></button>`:`<p class="stage-place slim">Waiting for the host to start…</p>`}
      ${net.err?`<p class="net-err">${escapeHTML(net.err)}</p>`:''}
      <div class="net-row tight"><button id="net-leave" class="link-button">Leave room</button><button id="net-share" class="secondary-button">📨 Invite</button><span class="net-ping" id="net-ping">${net.rtt!=null?Math.round(net.rtt)+'ms':''}</span></div></div>`;
    if(host){
      $('net-event').addEventListener('change',event=>net.client?.setEvent(event.target.value));
      $('net-stage').addEventListener('change',event=>net.client?.setStage(Number(event.target.value)));
      $('net-start').addEventListener('click',()=>net.client?.start());
    }
    $('net-leave').addEventListener('click',()=>netLeave());
    $('net-share').addEventListener('click',()=>netShare());
  }else if(net.screen==='race'){
    $('overlay').hidden = net.view.phase==='racing';
    if(net.view.phase==='countdown'){
      const s = STAGES[net.view.stageIndex] ?? STAGES[0];
      $('overlay').innerHTML = `<div><div class="count-number">${Math.ceil(net.view.countdown)}</div><div class="count-label">${s.year} ${escapeHTML(s.city)} · Get ready to alternate L · R!</div></div>`;
    }else $('overlay').innerHTML = '';
  }else if(net.screen==='over'){
    const over = net.lastOver, host = netIsHost();
    const rows = over ? over.standings.map((r,i)=>`<li class="${r.lane===net.lane?'you':''}"><span>${i+1}</span><span style="color:${COLORS[r.lane]||'#fff'}">■</span><span class="result-name">${escapeHTML(r.name)}${r.lane===net.lane?' · YOU':''}</span><span class="result-time">${r.finishTime==null?'DNF':formatTime(r.finishTime)+'s'}</span></li>`).join('') : '';
    $('overlay').hidden = false;
    $('overlay').innerHTML = `<div class="results-panel"><h2>RESULTS</h2>
      <div class="result-stage">${over?`${over.standings.filter(r=>r.finishTime!=null).length}/5 FINISHED`:''}</div>
      <ol class="results-list">${rows}</ol>
      ${host?`<select id="net-event" class="stage-select" aria-label="Olympic event">${netEventOptions(over?.event ?? net.room?.event ?? session.event)}</select><select id="net-stage" class="stage-select" aria-label="Race stage">${netStageOptions(over?.stage ?? 0)}</select><div class="result-actions"><button id="net-again" class="start-button">Race again <span aria-hidden="true">↻</span></button><button id="net-go" class="secondary-button">Start ▶</button></div>`
        :`<p class="stage-place">Waiting for the host…</p><div class="result-actions"><button id="net-leave2" class="secondary-button">Leave</button></div>`}</div>`;
    if(host){
      $('net-event').addEventListener('change',event=>net.client?.setEvent(event.target.value));
      $('net-stage').addEventListener('change',event=>net.client?.setStage(Number(event.target.value)));
      $('net-again').addEventListener('click',()=>net.client?.again());
      $('net-go').addEventListener('click',()=>{ net.client?.setEvent($('net-event').value); net.client?.setStage(Number($('net-stage').value)); net.client?.start(); });
    }else $('net-leave2').addEventListener('click',()=>netLeave());
  }
}
function netFrame(now){
  last = now;
  renderer.draw(net.view.runners.length ? net.view : engine, now);
  if(now-lastHud > 50){ netRenderHud(); lastHud = now; }
  if(now>feedbackUntil) $('feedback').hidden = true;
  requestAnimationFrame(frame);
}

function frame(now){
  if(net.active){ netFrame(now); return; }
  session.update((now-last)/1000);last=now;consumeEvents();renderer.draw(engine,now);if(now-lastHud>50){renderHud();lastHud=now;}if(now>feedbackUntil)$('feedback').hidden=true;requestAnimationFrame(frame);}
soundUI();renderHud();
// Invite links (?room=CODE) shared via SMS/KakaoTalk: open multiplayer with
// the code prefilled, and join immediately if the player's name is known.
(function consumeInvite(){
  const code = parseInviteCode(window.location?.search);
  if(code.length !== 4) return;
  try{ window.history.replaceState(null, '', window.location.pathname); }catch{}
  netOpenMenu(true);
  const field = $('net-code');
  if(field) field.value = code;
  if((session.playerName || '').trim()) netConnect(false);
})();
// Mobile keyboards resize the viewport but never scroll the focused input
// into view inside our absolutely-positioned overlay, so the name/code
// fields end up hidden behind the keyboard. Detect the keyboard via
// visualViewport (focus events as fallback) and bring the field into view.
function keyboardOpen(){
  try{
    if(window.visualViewport) return window.visualViewport.height < window.innerHeight * 0.8;
  }catch{}
  return document.activeElement instanceof HTMLInputElement;
}
function syncKeyboardClass(){
  try{ document.body.classList.toggle('kb-open', keyboardOpen()); }catch{}
}
function revealFocusedField(delay){
  const el = document.activeElement;
  if(!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLSelectElement)) return;
  setTimeout(()=>{ try{ el.scrollIntoView({ block: 'center', inline: 'nearest' }); }catch{} }, delay);
}
try{
  if(window.visualViewport) window.visualViewport.addEventListener('resize', ()=>{ syncKeyboardClass(); revealFocusedField(80); });
}catch{}
document.addEventListener('focusin', ()=>{ syncKeyboardClass(); revealFocusedField(150); });
document.addEventListener('focusout', ()=>setTimeout(syncKeyboardClass, 150));
// Refresh / app-switch return: rejoin the remembered room instead of
// stranding the player on the solo screen. Invite links take precedence.
(function resumeRoom(){
  if(parseInviteCode(window.location?.search).length === 4) return;
  const saved = loadResume();
  if(!saved) return;
  netOpenMenu();
  if($('net-name') && saved.name) $('net-name').value = saved.name;
  if($('net-code')) $('net-code').value = saved.code;
  netConnect(false);
})();
requestAnimationFrame(frame);
// Test/debug handle (used by automated checks; no UI effect).
window.__track84={session,engine,beginStage,quitToTitle,newGameFlow,net,netOpenMenu,netLeave};
