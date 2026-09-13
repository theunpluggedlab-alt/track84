import {RaceEngine, PLAYER_ID, RULES} from './engine.js';

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

export class RaceSession {
  constructor({transport=new LocalTransport(),seed=84}={}) {
    this.engine=new RaceEngine(seed);this.transport=transport;this.sequence=0;this.lastSequence=new Map();this.playerName='';
    this.disconnect=transport.onInput(command=>this.receive(command));this.accumulator=0;
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
  restart(playerName=this.playerName){this.playerName=String(playerName).trim().slice(0,12);this.engine.reset(84);this.engine.player.name=this.playerName||'YOU';this.accumulator=0;this.lastSequence.clear();this.engine.start();}
  close(){this.disconnect?.();this.transport.close();}
}
