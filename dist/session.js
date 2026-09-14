import {RaceEngine, PLAYER_ID, RULES} from './engine.js';
import { STAGES } from './stages.js';

const CAREER_KEY = 'track84-career-v1';

/** Input transport contract: send({protocol,playerId,sequence,tick,action}).
 * A future WebSocket/WebRTC transport implements onInput(handler) and send(command).
 * The host runs this same fixed-step engine; clients render authoritative snapshots.
 * Local play intentionally opens no sockets and makes no network requests.
 */
export class LocalTransport {
  onInput(handler){this.handler=handler;return ()=>{this.handler=null;};}
  send(command){this.handler?.(command);}
  close(){this.handler=null;}
}

export const MAX_LIVES = 3;

export class RaceSession {
  constructor({transport=new LocalTransport(),seed=84}={}) {
    this.engine=new RaceEngine(seed);this.transport=transport;this.sequence=0;this.lastSequence=new Map();this.playerName='';
    this.disconnect=transport.onInput(command=>this.receive(command));this.accumulator=0;
    this.stageIndex=0;this.unlocked=0;this.medals={};this.lives=MAX_LIVES;
    this.loadCareer();
  }
  loadCareer(){
    try{
      const raw=localStorage.getItem(CAREER_KEY);
      if(!raw)return;
      const data=JSON.parse(raw);
      if(Number.isInteger(data.unlocked))this.unlocked=Math.min(STAGES.length-1,Math.max(0,data.unlocked));
      if(data.medals&&typeof data.medals==='object')this.medals=data.medals;
      if(typeof data.playerName==='string')this.playerName=data.playerName.slice(0,12);
      if(Number.isInteger(data.lives))this.lives=Math.min(MAX_LIVES,Math.max(0,data.lives));
    }catch{}
  }
  saveCareer(){
    try{localStorage.setItem(CAREER_KEY,JSON.stringify({unlocked:this.unlocked,medals:this.medals,playerName:this.playerName,lives:this.lives}));}catch{}
  }
  setStage(index){
    const i=Math.min(STAGES.length-1,Math.max(0,index|0));
    this.stageIndex=i;
    this.engine.setStage(i);
    return i;
  }
  recordResult(rank, advance=false){
    this.medals[this.stageIndex]=rank;
    // Linear tour: only a top-3 finish unlocks the next Games.
    if(advance&&this.stageIndex>=this.unlocked&&this.stageIndex<STAGES.length-1)this.unlocked=this.stageIndex+1;
    // Arcade lives: every finish outside the top 3 costs one life.
    if(!advance)this.lives=Math.max(0,this.lives-1);
    this.saveCareer();
    return this.lives;
  }
  get gameOver(){return this.lives<=0;}
  newGame(){
    // Full arcade reset: lives back to 3, tour back to Athens, name re-entry.
    this.lives=MAX_LIVES;this.unlocked=0;this.medals={};this.playerName='';
    this.saveCareer();
  }
  receive(command){
    if(command.protocol!==1||!['L','R','J'].includes(command.action)||!Number.isSafeInteger(command.sequence)||command.sequence<0)return false;
    if(command.sequence<=(this.lastSequence.get(command.playerId)??-1))return false;
    if(!this.engine.runners.some(r=>r.id===command.playerId&&r.human))return false;
    this.lastSequence.set(command.playerId,command.sequence);
    return this.engine.input(command);
  }
  action(action){this.transport.send({protocol:1,playerId:PLAYER_ID,sequence:this.sequence++,tick:this.engine.tick,action});}
  update(elapsed){
    if(!['racing','countdown'].includes(this.engine.phase)){this.accumulator=0;return;}
    this.accumulator+=Math.min(Math.max(elapsed,0),.1);
    while(this.accumulator>=RULES.step){this.engine.step();this.accumulator-=RULES.step;}
  }
  restart(playerName=this.playerName,stageIndex=this.stageIndex){this.playerName=String(playerName).trim().slice(0,12);this.setStage(stageIndex);this.engine.reset(84+(this.stageIndex*17));this.engine.player.name=this.playerName||'YOU';this.accumulator=0;this.lastSequence.clear();this.saveCareer();this.engine.start();}
  close(){this.disconnect?.();this.transport.close();}
}
