import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceEngine,RULES,PLAYER_ID} from '../dist/engine.js';
import {RaceSession,LocalTransport} from '../dist/session.js';

const start=()=>{const e=new RaceEngine();e.start();for(let i=0;i<361;i++)e.step();return e;};
function cadenceRun(hz){const e=start();e.player.x=-500;let next=0,leg='L';for(let i=0;i<120*12;i++){if(e.time>=next){e.input({playerId:PLAYER_ID,action:leg});leg=leg==='L'?'R':'L';next+=1/hz;}e.step();}return e;}
test('faster alternating cadence produces faster running; release slows to rest',()=>{
  const slow=cadenceRun(4),medium=cadenceRun(6),fast=cadenceRun(9);
  assert(medium.player.speed>slow.player.speed+1);
  assert(fast.player.speed>medium.player.speed+.7);
  assert(fast.player.speed<=RULES.maxSpeed);
  for(let i=0;i<360;i++)fast.step();
  assert.equal(fast.player.speed,0);
});
test('same-leg spam and simultaneous taps do not add speed',()=>{
  const e=start();assert(e.input({playerId:PLAYER_ID,action:'L'}));const speed=e.player.speed;
  for(let i=0;i<50;i++)assert.equal(e.input({playerId:PLAYER_ID,action:'L'}),false);
  assert.equal(e.input({playerId:PLAYER_ID,action:'R'}),false);
  assert.equal(e.player.speed,speed);
  for(let i=0;i<12;i++)e.step();assert(e.input({playerId:PLAYER_ID,action:'R'}));
});
function crossing(age){const e=start(),p=e.player;p.x=RULES.hurdles[0]-.035;p.speed=8;p.lastStep=e.time;p.jumpAge=age;e.step();return e;}
test('timely jump clears; early, late and missing jumps fall once',()=>{
  const good=crossing(.35);assert.equal(good.player.cleared,1);assert.equal(good.player.falls,0);
  for(const age of [.03,.72,null]){const e=crossing(age);assert.equal(e.player.falls,1);assert.equal(e.player.hurdleIndex,1);for(let i=0;i<130;i++)e.step();assert.equal(e.player.falls,1);assert.equal(e.player.fallRemaining,0);}
});
test('jump is unavailable when stationary or already airborne',()=>{
  const e=start();assert.equal(e.input({playerId:PLAYER_ID,action:'J'}),false);
  e.player.speed=7;assert(e.input({playerId:PLAYER_ID,action:'J'}));assert.equal(e.input({playerId:PLAYER_ID,action:'J'}),false);
});
test('pause freezes simulation and inputs; resume preserves state',()=>{
  const e=start();e.player.speed=8;e.pause();const before=e.snapshot();
  for(let i=0;i<240;i++)e.step();assert.deepEqual(e.snapshot(),before);assert.equal(e.input({playerId:PLAYER_ID,action:'L'}),false);
  e.resume();e.step();assert(e.player.x>before.runners[2].x);
});
test('all five runners finish; human can clear every hurdle using jump cue',()=>{
  const e=start();let next=0,leg='L';
  for(let i=0;i<120*60&&e.phase!=='finished';i++){
    if(e.time>=next){e.input({playerId:PLAYER_ID,action:leg});leg=leg==='L'?'R':'L';next+=1/7;}
    const w=e.jumpWindow();if(w.timeTo<=.36&&w.distance>0)e.input({playerId:PLAYER_ID,action:'J'});
    e.step();
  }
  assert.equal(e.phase,'finished');assert.equal(e.player.cleared,10);assert.equal(e.player.falls,0);
  for(const r of e.runners){assert.equal(r.x,110);assert(r.finishTime>0);assert.equal(r.hurdleResults.length,10);}
  const order=e.standings().map(r=>r.finishTime);assert.deepEqual(order,[...order].sort((a,b)=>a-b));
});
test('fixed-step result is stable across 30, 60 and 144 FPS',()=>{
  function simulate(fps){const s=new RaceSession();s.engine.start();for(let i=0;i<fps*20;i++)s.update(1/fps);return s.engine.snapshot();}
  const a=simulate(30),b=simulate(60),c=simulate(144);
  // Floating-point accumulation may differ by one final fixed tick, not gameplay speed.
  assert(Math.abs(a.tick-c.tick)<=1);assert(Math.abs(a.time-c.time)<=RULES.step+1e-8);
  for(let i=0;i<5;i++){assert(Math.abs(a.runners[i].x-b.runners[i].x)<.1);assert(Math.abs(a.runners[i].x-c.runners[i].x)<.1);}
});
test('snapshot round-trip remains deterministic and restart clears state',()=>{
  const a=cadenceRun(6),b=new RaceEngine();b.restore(a.snapshot());
  for(let i=0;i<100;i++){a.step();b.step();}assert.deepEqual(a.snapshot(),b.snapshot());
  a.reset();assert.equal(a.phase,'ready');assert.equal(a.time,0);assert(a.runners.every(r=>r.x===0&&r.falls===0&&r.jumpAge===null&&r.lastLeg===null));
});
test('transport rejects duplicates, malformed commands and CPU input',()=>{
  const transport=new LocalTransport(),s=new RaceSession({transport});s.engine.phase='racing';
  const command={protocol:1,playerId:PLAYER_ID,sequence:0,tick:0,action:'L'};
  assert(s.receive(command));assert.equal(s.receive(command),false);
  assert.equal(s.receive({...command,sequence:1,action:'X'}),false);
  assert.equal(s.receive({...command,sequence:1,playerId:'runner-1'}),false);
  assert.equal(s.receive({...command,sequence:NaN}),false);
});
