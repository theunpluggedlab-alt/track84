// Rendering-independent fixed-step simulation. Distances are metres, times seconds.
export const RULES = Object.freeze({ distance: 110, hurdles: Array.from({length:10},(_,i)=>13.72+i*9.14), step: 1/120, maxSpeed: 10.6, jumpDuration: .78, jumpHeight: 1.38, clearance: .91, fallDuration: .95 });
export const COLORS = ['#ff936a','#9a90ff','#d5ff64','#63d8ed','#ed87c8'];
export const PLAYER_ID = 'runner-2';
const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));

export class RaceEngine {
  constructor(seed = 84) { this.reset(seed); }
  reset(seed = 84) {
    this.seed=seed>>>0; this.tick=0; this.time=0; this.phase='ready'; this.countdown=3;
    this.events=[]; this.resumePhase='racing';
    this.runners=COLORS.map((color,i)=>({ id:`runner-${i}`,lane:i,name:i===2?'YOU':`CPU ${i<2?i+1:i}`,color,human:i===2,x:0,speed:0,lastLeg:null,lastStep:-10,intervals:[],cadence:0,jumpAge:null,fallRemaining:0,falls:0,cleared:0,hurdleIndex:0,hurdleResults:[],finishTime:null,nextAITap:0,nextAIJump:null,aiLeg:'L',aiPace:[5.3,6.1,0,5.7,6.6][i] }));
  }
  random() { this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0; return this.seed/4294967296; }
  get player() { return this.runners[2]; }
  start() { if(this.phase==='ready') {this.phase='countdown';this.countdown=3;this.emit('countdown',null,{value:3});} }
  pause() { if(this.phase==='racing'||this.phase==='countdown'){this.resumePhase=this.phase;this.phase='paused';} }
  resume() { if(this.phase==='paused') this.phase=this.resumePhase; }
  emit(type,runner,data={}){this.events.push({type,runnerId:runner?.id,tick:this.tick,...data});}
  drainEvents(){const e=this.events;this.events=[];return e;}
  input(command) {
    if(this.phase!=='racing') return false;
    const r=this.runners.find(v=>v.id===command.playerId);
    if(!r||r.finishTime!==null||r.fallRemaining>0) return false;
    if(command.action==='J') return this.jump(r);
    if(command.action!=='L'&&command.action!=='R') return false;
    if(r.lastLeg===command.action) {this.emit('repeat',r);return false;}
    const interval=this.time-r.lastStep;
    // Reject near-simultaneous taps, synthetic key-repeat and duplicate packets.
    if(interval<.045) return false;
    r.lastLeg=command.action;r.lastStep=this.time;
    if(interval<.8) {r.intervals.push(interval);if(r.intervals.length>5)r.intervals.shift();}
    else r.intervals=[];
    r.cadence=r.intervals.length ? clamp(r.intervals.length/r.intervals.reduce((a,b)=>a+b,0),0,12) : 1;
    const target=clamp(2.2+r.cadence*1.14,2.2,RULES.maxSpeed);
    r.speed=Math.min(RULES.maxSpeed,r.speed+clamp((target-r.speed)*.35,.08,1.75));
    this.emit('step',r,{leg:command.action});return true;
  }
  jump(r) {
    if(r.jumpAge!==null||r.speed<1.3)return false;
    r.jumpAge=0;this.emit('jump',r);return true;
  }
  heightAt(age){return age===null||age<0||age>RULES.jumpDuration?0:Math.sin(age/RULES.jumpDuration*Math.PI)*RULES.jumpHeight;}
  jumpWindow(r=this.player){
    const d=(RULES.hurdles[r.hurdleIndex]??Infinity)-r.x;
    const timeTo=d/Math.max(r.speed,.1);
    return {distance:d,timeTo,ideal:timeTo>=.24&&timeTo<=.49,near:timeTo>=0&&timeTo<.9};
  }
  fall(r) {
    r.falls++;r.fallRemaining=RULES.fallDuration;r.speed*=.27;r.jumpAge=null;r.lastLeg=null;r.intervals=[];r.cadence=0;r.lastStep=-10;
    this.emit('fall',r);
  }
  updateAI(r,dt) {
    if(r.fallRemaining>0||r.finishTime!==null)return;
    r.nextAITap-=dt;
    if(r.nextAITap<=0) {
      r.aiLeg=r.aiLeg==='L'?'R':'L';
      this.input({playerId:r.id,action:r.aiLeg});
      r.nextAITap+=1/(r.aiPace+(this.random()-.5)*1.3);
    }
    if(r.nextAIJump===null)r.nextAIJump=.34+(this.random()-.5)*.19+(this.random()<.12?.31:0);
    const w=this.jumpWindow(r);
    if(r.jumpAge===null&&w.timeTo<r.nextAIJump&&w.distance>0&&r.speed>2){this.jump(r);}
  }
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
        if(height>=RULES.clearance&&r.fallRemaining===0) {
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
  snapshot(){return structuredClone({protocol:1,seed:this.seed,tick:this.tick,time:this.time,phase:this.phase,countdown:this.countdown,resumePhase:this.resumePhase,runners:this.runners});}
  restore(snapshot){if(snapshot.protocol!==1)throw new Error('Unsupported race protocol');for(const key of ['seed','tick','time','phase','countdown','resumePhase','runners'])this[key]=structuredClone(snapshot[key]);this.events=[];}
}
