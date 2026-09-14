// Authoritative race room: owns one RaceEngine, validates inputs, and emits
// snapshots + events. Transport-agnostic: constructed with a send(id, data)
// function so it can be unit-tested with fake sockets.
import { RaceEngine } from '../dist/engine.js';
import { STAGES } from '../dist/stages.js';
import { isEvent } from '../dist/events.js';

export const SNAP_EVERY = 6; // 20 snapshots/sec at 120 Hz
export const MAX_INPUTS_PER_SEC = 30;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeCode(existing) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    if (!existing(code)) return code;
  }
  throw new Error('room table full');
}

export function cleanName(name) {
  return String(name ?? '').trim().slice(0, 12) || 'Guest';
}

let nextPlayerId = 1;

export class Room {
  constructor(code, send, stage = 0, opts = {}) {
    this.code = code;
    this.send = send; // (player, obj) => void
    this.stage = Math.min(STAGES.length - 1, Math.max(0, stage | 0));
    this.event = isEvent(opts.event) ? opts.event : 'hurdles';
    this.phase = 'lobby'; // lobby | racing | over
    // Idle/disconnected-human safety: never let a race run forever.
    this.timeout = Number.isFinite(opts.timeout) ? opts.timeout : 180;
    this.players = []; // {id,name,lane,connected,seq,host,inputStamps[]}
    this.engine = new RaceEngine(84 + ((Math.random() * 1e9) | 0));
    this.engine.setStage(this.stage);
    this.engine.setEvent(this.event);
    this.sentOver = false;
    this.snapTick = 0;
    // Grace period: when everyone disconnects (app switch, refresh), the
    // room survives briefly so players can come back. The host clears it.
    this.emptySince = null;
  }
  get host() { return this.players[0] ?? null; }
  connected() { return this.players.filter(p => p.connected); }
  playerOfLane(lane) { return this.players.find(p => p.lane === lane); }
  takeLane() {
    for (let lane = 0; lane < 5; lane++) if (!this.playerOfLane(lane)) return lane;
    return -1;
  }
  addPlayer(name) {
    const lane = this.takeLane();
    if (lane < 0) return null;
    const player = { id: `p${nextPlayerId++}`, name: cleanName(name), lane, connected: true, seq: -1, host: this.players.length === 0, inputStamps: [] };
    this.players.push(player);
    this.syncHumans();
    return player;
  }
  reclaim(name) {
    // Same-name phone coming back (sleep/reload): take the old lane back.
    const ghost = this.players.find(p => !p.connected && p.name === cleanName(name));
    if (!ghost) return null;
    ghost.connected = true; ghost.seq = -1; ghost.inputStamps = [];
    // The host coming back takes the crown again if nobody holds it.
    if (!this.players.some(p => p.host)) ghost.host = true;
    this.engine.setHuman(`runner-${ghost.lane}`, true);
    const r = this.engine.runners[ghost.lane];
    if (r) r.name = ghost.name;
    this.broadcastRoom();
    return ghost;
  }
  isEmptyExpired(now = Date.now(), ttl = 5 * 60 * 1000) {
    return this.connected().length === 0 && this.emptySince != null && now - this.emptySince > ttl;
  }
  removePlayer(player) {
    player.connected = false;
    // Host leaves: promote the first connected player.
    if (player.host) {
      player.host = false;
      const next = this.connected()[0];
      if (next) next.host = true;
    }
    // Vacated lane falls back to AI immediately.
    this.engine.setHuman(`runner-${player.lane}`, false);
    this.broadcastRoom();
  }
  nameLanes() {
    // Every lane shows either its connected player or a CPU tag —
    // never the solo default 'YOU'.
    for (let lane = 0; lane < 5; lane++) {
      const r = this.engine.runners[lane];
      const p = this.players.find(q => q.connected && q.lane === lane);
      if (r) r.name = p ? p.name : `CPU ${lane + 1}`;
    }
  }
  syncHumans() {
    const humans = this.connected().map(p => `runner-${p.lane}`);
    this.engine.reset(this.engine.seed, humans.length ? humans : []);
    this.nameLanes();
    this.engine.setStage(this.stage);
  }
  setStage(index) {
    this.stage = Math.min(STAGES.length - 1, Math.max(0, index | 0));
    this.engine.setStage(this.stage);
    this.engine.setEvent(this.event);
    this.engine.reset(this.engine.seed, this.connected().map(p => `runner-${p.lane}`));
    this.nameLanes();
    this.phase = 'lobby'; this.sentOver = false;
    this.broadcastRoom();
  }
  setEvent(id) {
    // The host picks the discipline; the room returns to the lobby either way.
    this.event = isEvent(id) ? id : 'hurdles';
    this.engine.setEvent(this.event);
    this.engine.reset(this.engine.seed, this.connected().map(p => `runner-${p.lane}`));
    this.nameLanes();
    this.phase = 'lobby'; this.sentOver = false;
    this.broadcastRoom();
  }
  start() {
    if (this.phase === 'racing' || !this.connected().length) return false;
    this.syncHumans();
    this.engine.setStage(this.stage);
    this.engine.setEvent(this.event);
    this.engine.reset((Math.random() * 1e9) | 0, this.connected().map(p => `runner-${p.lane}`));
    this.nameLanes();
    this.phase = 'racing'; this.sentOver = false;
    this.engine.start();
    this.broadcastRoom();
    return true;
  }
  applyInput(player, seq, action, now = Date.now()) {
    if (this.phase !== 'racing') return false;
    if (!['L', 'R', 'J'].includes(action)) return false;
    if (!Number.isSafeInteger(seq) || seq < 0 || seq <= player.seq) return false;
    player.inputStamps = player.inputStamps.filter(t => now - t < 1000);
    if (player.inputStamps.length >= MAX_INPUTS_PER_SEC) return false;
    player.inputStamps.push(now);
    player.seq = seq;
    return this.engine.input({ playerId: `runner-${player.lane}`, action });
  }
  snapshot() {
    const e = this.engine;
    return {
      t: 'snap', tick: e.tick, time: e.time, phase: e.phase, countdown: e.countdown,
      stage: e.stageIndex, mode: e.mode, distance: e.distance,
      runners: e.runners.map(r => ({
        id: r.id, lane: r.lane, name: r.name, color: r.color, human: r.human,
        x: r.x, speed: r.speed, cadence: r.cadence, jumpAge: r.jumpAge,
        fallRemaining: r.fallRemaining, falls: r.falls, cleared: r.cleared,
        hurdleIndex: r.hurdleIndex, hurdleResults: r.hurdleResults, finishTime: r.finishTime,
        // Rowing
        stamina: r.stamina, strokes: r.strokes, crabs: r.crabs, crabRemaining: r.crabRemaining,
        swing: r.swing, powerTen: r.powerTen, powerCharges: r.powerCharges, falseStart: r.falseStart,
        // Long jump
        best: r.best, foul: r.foul, jumped: r.jumped, landed: r.landed,
        takeoffX: r.takeoffX, landingX: r.landingX,
      })),
    };
  }
  roomState() {
    return {
      t: 'room', code: this.code, stage: this.stage, event: this.event, phase: this.phase,
      players: this.players.map(p => ({ id: p.id, name: p.name, lane: p.lane, host: !!p.host, connected: p.connected })),
    };
  }
  broadcastRoom() {
    const msg = this.roomState();
    for (const p of this.connected()) this.send(p, msg);
  }
  sendFx() {
    const events = this.engine.drainEvents();
    if (!events.length) return;
    const byOwner = new Map();
    for (const p of this.connected()) byOwner.set(p.id, []);
    const broadcast = [];
    for (const ev of events) {
      if (ev.runnerId == null) { broadcast.push(ev); continue; }
      const owner = this.players.find(p => p.connected && `runner-${p.lane}` === ev.runnerId);
      if (owner) byOwner.get(owner.id).push(ev);
    }
    for (const p of this.connected()) {
      const mine = byOwner.get(p.id).concat(broadcast);
      if (mine.length) this.send(p, { t: 'fx', events: mine });
    }
  }
  step() {
    if (this.phase !== 'racing') return;
    this.engine.step();
    this.sendFx();
    this.snapTick++;
    if (this.snapTick % SNAP_EVERY === 0 || this.engine.phase !== 'racing') {
      const snap = this.snapshot();
      for (const p of this.connected()) this.send(p, snap);
    }
    // Stragglers (idle humans) are scored DNF; standings sort them last.
    if (this.engine.phase === 'racing' && this.engine.time > this.timeout) {
      this.engine.phase = 'finished';
    }
    if (this.engine.phase === 'finished' && !this.sentOver) {
      this.sentOver = true;
      this.phase = 'over';
      const order = this.engine.standings().map(r => ({ id: r.id, lane: r.lane, name: r.name, finishTime: r.finishTime, cleared: r.cleared, falls: r.falls, strokes: r.strokes, crabs: r.crabs, best: r.best, foul: r.foul }));
      const msg = { t: 'over', stage: this.stage, event: this.event, standings: order };
      for (const p of this.connected()) this.send(p, msg);
      this.broadcastRoom();
    }
  }
}
