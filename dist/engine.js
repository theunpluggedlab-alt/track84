// Rendering-independent fixed-step simulation. Distances are metres, times seconds.
import { difficultyFor, STAGES } from './stages.js';
import { ROWING, isEvent } from './events.js';
export const RULES = Object.freeze({ distance: 110, hurdles: Array.from({length:10},(_,i)=>13.72+i*9.14), step: 1/120, maxSpeed: 10.6, jumpDuration: .78, jumpHeight: 1.38, clearance: .91, fallDuration: .95 });
export const COLORS = ['#ff936a','#9a90ff','#d5ff64','#63d8ed','#ed87c8'];
export const PLAYER_ID = 'runner-2';
const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const DEFAULT_PACE = [5.3,6.1,0,5.7,6.6];

export class RaceEngine {
  constructor(seed = 84) { this.stageIndex=0; this.mode='hurdles'; this.applyDifficulty(null, true); this.reset(seed); }
  // Event selection: 'hurdles' (110m, the original arcade race) or 'rowing'
  // (500m single sculls). The rules of the chosen event drive distance, speed
  // and the meaning of J, so hosts and clients stay on one shared engine.
  setEvent(id) { this.mode = isEvent(id) ? id : 'hurdles'; return this.mode; }
  get distance() { return this.mode === 'rowing' ? ROWING.distance : RULES.distance; }
  get rules() { return this.mode === 'rowing' ? ROWING : RULES; }
  setStage(index) {
    const i = STAGES.length ? Math.min(STAGES.length-1, Math.max(0, index|0)) : 0;
    this.stageIndex = i;
    this.applyDifficulty(difficultyFor(i));
    return i;
  }
  applyDifficulty(d, silent=false) {
    // Defaults preserve the original arcade tuning when no career stage is set.
    this.aiPaceBase = d?.lanes ? [...d.lanes] : [...DEFAULT_PACE];
    this.aiJitter = d?.jitter ?? 1.3;
    this.aiMistake = d?.mistake ?? 0.12;
    this.aiSpread = d?.spread ?? 0.19;
    this.clearance = d?.clearance ?? RULES.clearance;
    this.idealLo = d?.idealLo ?? 0.24;
    this.idealHi = d?.idealHi ?? 0.49;
    if (!silent) for (const r of this.runners ?? []) if (!r.human) r.aiPace = this.aiPaceBase[r.lane] ?? r.aiPace;
  }
  reset(seed = 84, humanIds = null) {
    this.seed=seed>>>0; this.tick=0; this.time=0; this.phase='ready'; this.countdown=3;
    this.events=[]; this.resumePhase='racing';
    // Solo default keeps lane 3 (runner-2) human; net hosts pass joined lanes.
    const humans = humanIds ?? ['runner-2'];
    this.runners=COLORS.map((color,i)=>({ id:`runner-${i}`,lane:i,name:i===2?'YOU':`CPU ${i<2?i+1:i}`,color,human:humans.includes(`runner-${i}`),x:0,speed:0,lastLeg:null,lastStep:-10,intervals:[],cadence:0,jumpAge:null,fallRemaining:0,falls:0,cleared:0,hurdleIndex:0,hurdleResults:[],finishTime:null,nextAITap:0,nextAIJump:null,aiLeg:'L',aiPace:(this.aiPaceBase??DEFAULT_PACE)[i],stamina:1,strokes:0,crabs:0,crabRemaining:0,swing:false,powerTen:0,powerCharges:ROWING.powerCharges,falseStart:false,repeats:0,aiRepeat:0 }));
  }
  random() { this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0; return this.seed/4294967296; }
  setHuman(id, human) {
    const r=this.runners.find(v=>v.id===id); if(!r) return false;
    r.human=!!human;
    if(!r.human){ r.aiPace=(this.aiPaceBase??DEFAULT_PACE)[r.lane]??r.aiPace; r.nextAITap=0; r.nextAIJump=null; }
    return true;
  }
  get player() { return this.runners[2]; }
  start() { if(this.phase==='ready') {this.phase='countdown';this.countdown=3;this.emit('countdown',null,{value:3});} }
  pause() { if(this.phase==='racing'||this.phase==='countdown'){this.resumePhase=this.phase;this.phase='paused';} }
  resume() { if(this.phase==='paused') this.phase=this.resumePhase; }
  emit(type,runner,data={}){this.events.push({type,runnerId:runner?.id,tick:this.tick,...data});}
  drainEvents(){const e=this.events;this.events=[];return e;}
  input(command) {
    // Rowing: a stroke before the gun is a false start — the boat is held back.
    if(this.phase!=='racing') {
      if(this.mode==='rowing'&&this.phase==='countdown'&&(command.action==='L'||command.action==='R')) {
        const early=this.runners.find(v=>v.id===command.playerId);
        if(early&&!early.falseStart){early.falseStart=true;this.emit('falsestart',early);}
      }
      return false;
    }
    const r=this.runners.find(v=>v.id===command.playerId);
    if(!r||r.finishTime!==null||r.fallRemaining>0||r.crabRemaining>0) return false;
    if(command.action==='J') return this.mode==='rowing' ? this.powerTen(r) : this.jump(r);
    if(command.action!=='L'&&command.action!=='R') return false;
    if(r.lastLeg===command.action) {
      // Rowing: a stuck oar. Three same-side strokes in a row catch a crab.
      r.repeats++;
      if(this.mode==='rowing'&&r.repeats>=ROWING.crabRepeats){this.crab(r);return false;}
      this.emit('repeat',r);return false;
    }
    const interval=this.time-r.lastStep;
    // Reject near-simultaneous taps, synthetic key-repeat and duplicate packets.
    if(interval<.045) return false;
    r.repeats=0;r.lastLeg=command.action;r.lastStep=this.time;
    if(interval<.8) {r.intervals.push(interval);if(r.intervals.length>5)r.intervals.shift();}
    else r.intervals=[];
    r.cadence=r.intervals.length ? clamp(r.intervals.length/r.intervals.reduce((a,b)=>a+b,0),0,12) : 1;
    if(this.mode==='rowing') this.strokeRower(r);
    else {
      const target=clamp(2.2+r.cadence*1.14,2.2,RULES.maxSpeed);
      r.speed=Math.min(RULES.maxSpeed,r.speed+clamp((target-r.speed)*.35,.08,1.75));
    }
    this.emit('step',r,{leg:command.action});return true;
  }
  // ---- Rowing -----------------------------------------------------------
  // Hull speed comes from the stroke rate, then stamina, rhythm ("swing") and a
  // POWER TEN surge scale the target. Everything is a pure function of the tap
  // history, so hosts and clients stay deterministic.
  strokeRower(r) {
    r.strokes++;
    if(r.intervals.length>=4) {
      const mean=r.intervals.reduce((a,b)=>a+b,0)/r.intervals.length;
      const spread=Math.sqrt(r.intervals.reduce((a,b)=>a+(b-mean)*(b-mean),0)/r.intervals.length);
      r.swing=mean>.02&&spread/mean<=ROWING.swingCv;
    } else r.swing=false;
    const target=clamp(ROWING.base+r.cadence*ROWING.perCadence,ROWING.base,ROWING.maxSpeed)*this.hullFactor(r);
    const gap=target-r.speed;
    // Over target the hull drags the crew back down (tired legs, sloppy rating).
    r.speed=Math.max(0,Math.min(ROWING.maxSpeed,r.speed+(gap>0?clamp(gap*ROWING.accel,ROWING.accelMin,ROWING.accelMax):gap*ROWING.decel)));
  }
  hullFactor(r) {
    // Tired crew dig in, a steady rhythm rides clean water, a surge lifts the bow.
    const fresh=1-ROWING.staminaPenalty*(1-clamp(r.stamina/ROWING.staminaFloor,0,1));
    const swing=r.swing?1+ROWING.swingBonus:1;
    const surge=r.powerTen>0?1+ROWING.powerBoost:1;
    return fresh*swing*surge;
  }
  crab(r) {
    r.crabs++;r.repeats=0;r.crabRemaining=ROWING.crabDuration;r.speed*=ROWING.crabSpeed;
    r.lastLeg=null;r.intervals=[];r.cadence=0;r.swing=false;r.lastStep=-10;
    this.emit('crab',r);
  }
  powerTen(r) {
    if(r.powerTen>0||r.powerCharges<=0||r.speed<1.5) return false;
    r.powerCharges--;r.powerTen=ROWING.powerDuration;
    this.emit('power',r);return true;
  }
  stepRower(r,dt) {
    if(r.powerTen>0) r.powerTen=Math.max(0,r.powerTen-dt);
    const over=clamp((r.cadence-ROWING.cruise)/(ROWING.strokeMax-ROWING.cruise),0,1);
    const drain=over*ROWING.drainPerSec*(r.powerTen>0?ROWING.powerDrain:1);
    r.stamina=clamp(r.stamina-dt*drain+(over>0?0:dt*ROWING.recoverPerSec),0,1);
    if(r.falseStart&&this.time<ROWING.falseStartLock) r.speed=0;
    else if(r.crabRemaining>0){r.crabRemaining=Math.max(0,r.crabRemaining-dt);r.speed*=Math.exp(-dt*2.2);}
    else {
      const idle=this.time-r.lastStep;
      r.speed=Math.max(0,r.speed-dt*(idle>ROWING.stallAfter?ROWING.stallDrag:ROWING.glideDrag));
      if(idle>.8)r.cadence=0;
    }
    const prevX=r.x;
    r.x+=r.speed*dt;
    if(r.x>=ROWING.distance) {
      r.finishTime=this.time-dt+dt*clamp((ROWING.distance-prevX)/(r.x-prevX),0,1);
      r.x=ROWING.distance;r.speed=0;r.cadence=0;r.powerTen=0;this.emit('finish',r);
    }
  }
  jump(r) {
    if(r.jumpAge!==null||r.speed<1.3)return false;
    r.jumpAge=0;this.emit('jump',r);return true;
  }
  heightAt(age){return age===null||age<0||age>RULES.jumpDuration?0:Math.sin(age/RULES.jumpDuration*Math.PI)*RULES.jumpHeight;}
  jumpWindow(r=this.player){
    const d=(RULES.hurdles[r.hurdleIndex]??Infinity)-r.x;
    const timeTo=d/Math.max(r.speed,.1);
    const lo=this.idealLo??0.24, hi=this.idealHi??0.49;
    return {distance:d,timeTo,ideal:timeTo>=lo&&timeTo<=hi,near:timeTo>=0&&timeTo<.9};
  }
  fall(r) {
    r.falls++;r.fallRemaining=RULES.fallDuration;r.speed*=.27;r.jumpAge=null;r.lastLeg=null;r.intervals=[];r.cadence=0;r.lastStep=-10;
    this.emit('fall',r);
  }
  updateAI(r,dt) {
    if(r.fallRemaining>0||r.crabRemaining>0||r.finishTime!==null)return;
    r.nextAITap-=dt;
    if(r.nextAITap<=0) {
      // Rowing: a sloppy crew rattles the boat. Crabs get rarer as the Games
      // get harder, because the stage's mistake rate falls 38% -> 4%.
      if(this.mode==='rowing'&&r.aiRepeat<=0&&this.random()<(this.aiMistake??0.12)*.03) r.aiRepeat=ROWING.crabRepeats;
      if(r.aiRepeat>0) r.aiRepeat--; else r.aiLeg=r.aiLeg==='L'?'R':'L';
      this.input({playerId:r.id,action:r.aiLeg});
      // CPU crews hold a coached rating: they never blow up mid-race.
      const pace=this.mode==='rowing'?clamp(r.aiPace,3.0,6.9):r.aiPace;
      r.nextAITap+=1/(pace+(this.random()-.5)*(this.aiJitter??1.3));
    }
    if(this.mode==='rowing') {
      // Coxswain's call: the AI lifts for home over the last third.
      if(r.powerTen<=0&&r.powerCharges>0&&r.x>ROWING.distance*.68&&this.random()<dt*.35) this.powerTen(r);
      return;
    }
    if(r.nextAIJump===null){
      const spread=this.aiSpread??0.19, mistake=this.aiMistake??0.12;
      r.nextAIJump=.34+(this.random()-.5)*spread+(this.random()<mistake?.31:0);
    }
    const w=this.jumpWindow(r);
    if(r.jumpAge===null&&w.timeTo<r.nextAIJump&&w.distance>0&&r.speed>2){this.jump(r);}
  }
  finishLine(){return this.mode==='rowing'?ROWING.distance:RULES.distance;}
  step(dt=RULES.step) {
    if(this.phase==='countdown') {
      const prev=Math.ceil(this.countdown);this.countdown-=dt;
      if(this.countdown<=0){this.phase='racing';this.emit('go');}
      else if(Math.ceil(this.countdown)!==prev)this.emit('countdown',null,{value:Math.ceil(this.countdown)});
      return;
    }
    if(this.phase!=='racing')return;
    this.tick++; this.time+=dt;
    for(const r of this.runners) {
      if(r.finishTime!==null)continue;
      if(!r.human)this.updateAI(r,dt);
      if(this.mode==='rowing'){this.stepRower(r,dt);continue;}
      if(r.fallRemaining>0){r.fallRemaining=Math.max(0,r.fallRemaining-dt);r.speed*=Math.exp(-dt*1.2);}
      else {
        const idle=this.time-r.lastStep;
        r.speed=Math.max(0,r.speed-dt*(idle>.32?5.2:1.55));
        if(idle>.8)r.cadence=0;
      }
      const prevX=r.x;
      const priorJump=r.jumpAge;
      r.x+=r.speed*dt;
      if(r.jumpAge!==null){r.jumpAge+=dt;if(r.jumpAge>RULES.jumpDuration)r.jumpAge=null;}
      const hurdle=RULES.hurdles[r.hurdleIndex];
      if(hurdle!==undefined&&prevX<hurdle&&r.x>=hurdle) {
        const alpha=clamp((hurdle-prevX)/(r.x-prevX),0,1);
        const height=this.heightAt(priorJump===null?null:priorJump+dt*alpha);
        if(height>=(this.clearance??RULES.clearance)&&r.fallRemaining===0) {
          r.cleared++;r.hurdleResults.push('clear');
          this.emit('clear',r,{perfect:height>1.27});
        } else {r.hurdleResults.push('hit');this.fall(r);}
        r.hurdleIndex++;r.nextAIJump=null;
      }
      if(r.x>=RULES.distance) {
        r.finishTime=this.time-dt+dt*clamp((RULES.distance-prevX)/(r.x-prevX),0,1);
        r.x=RULES.distance;r.speed=0;r.jumpAge=null;this.emit('finish',r);
      }
    }
    if(this.runners.every(r=>r.finishTime!==null)){this.phase='finished';this.emit('complete');}
  }
  standings(){return [...this.runners].sort((a,b)=>a.finishTime!==null&&b.finishTime!==null?a.finishTime-b.finishTime:a.finishTime!==null?-1:b.finishTime!==null?1:b.x-a.x||a.lane-b.lane);}
  snapshot(){return structuredClone({protocol:1,mode:this.mode,seed:this.seed,tick:this.tick,time:this.time,phase:this.phase,countdown:this.countdown,resumePhase:this.resumePhase,runners:this.runners,stageIndex:this.stageIndex,aiPaceBase:this.aiPaceBase,aiJitter:this.aiJitter,aiMistake:this.aiMistake,aiSpread:this.aiSpread,clearance:this.clearance,idealLo:this.idealLo,idealHi:this.idealHi});}
  restore(snapshot){if(snapshot.protocol!==1)throw new Error('Unsupported race protocol');for(const key of ['seed','tick','time','phase','countdown','resumePhase','runners'])this[key]=structuredClone(snapshot[key]);for(const key of ['mode','stageIndex','aiPaceBase','aiJitter','aiMistake','aiSpread','clearance','idealLo','idealHi'])if(snapshot[key]!==undefined)this[key]=structuredClone(snapshot[key]);this.events=[];}
}
