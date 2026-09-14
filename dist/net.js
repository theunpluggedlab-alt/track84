// Realtime multiplayer client: WebSocket transport, authoritative snapshots,
// and a renderer-compatible view of the remote race. No dependencies.
import { RULES } from './engine.js';
import { difficultyFor } from './stages.js';

export function defaultHostUrl() {
  try {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/race`;
  } catch { return 'ws://localhost:4173/race'; }
}

const HOST_KEY = 'track84-host-url';
export function loadHostUrl(fallback) {
  try { return localStorage.getItem(HOST_KEY) || fallback || defaultHostUrl(); } catch { return fallback || defaultHostUrl(); }
}
export function saveHostUrl(url) {
  try { localStorage.setItem(HOST_KEY, url); } catch { /* ignore */ }
}

// Minimal event emitter (avoids EventTarget quirks with string payloads).
export class NetClient {
  constructor() {
    this.ws = null; this.seq = 0; this.url = '';
    this.handlers = new Map();
    this.pingTimer = null; this.rtt = null;
    this.room = null; this.you = null; this.connected = false;
  }
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }
  emit(type, data) { for (const fn of this.handlers.get(type) ?? []) { try { fn(data); } catch {} } }
  connect(url) {
    this.close();
    this.url = String(url || '').trim();
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { reject(e); return; }
      const timeout = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('connect timeout')); }, 8000);
      ws.onopen = () => {
        clearTimeout(timeout);
        this.ws = ws; this.connected = true;
        this.pingTimer = setInterval(() => this.ping(), 5000);
        this.ping();
        resolve();
      };
      ws.onerror = () => { clearTimeout(timeout); if (!this.connected) reject(new Error('cannot reach host')); };
      ws.onclose = () => { clearTimeout(timeout); this.connected = false; this.stopPing(); this.emit('closed', {}); };
      ws.onmessage = (ev) => this.route(ev.data);
    });
  }
  route(raw) {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'pong' && Number.isFinite(msg.at)) { this.rtt = Date.now() - msg.at; this.emit('rtt', this.rtt); return; }
    if (msg.t === 'room') { this.room = msg; this.emit('room', msg); return; }
    this.emit(msg.t, msg);
  }
  send(obj) {
    if (this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(obj)); return true; } catch {} }
    return false;
  }
  ping() { this.send({ t: 'ping', at: Date.now() }); }
  create(name, stage = 0) { this.send({ t: 'create', name, stage }); }
  join(code, name) { this.send({ t: 'join', code: String(code || '').toUpperCase(), name }); }
  leave() { this.send({ t: 'leave' }); }
  setStage(index) { this.send({ t: 'stage', index }); }
  start() { this.send({ t: 'start' }); }
  again() { this.send({ t: 'again' }); }
  input(action) {
    if (!['L', 'R', 'J'].includes(action)) return false;
    return this.send({ t: 'input', seq: this.seq++, action });
  }
  stopPing() { if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; } }
  close() {
    this.stopPing();
    try { this.ws?.close(); } catch {}
    this.ws = null; this.connected = false; this.room = null; this.seq = 0;
  }
}

// Renderer-compatible read of an authoritative snapshot.
export class NetView {
  constructor() {
    this.runners = []; this.phase = 'lobby'; this.time = 0; this.tick = 0;
    this.countdown = 3; this.stageIndex = 0; this.ownLane = 2;
    this.idealLo = 0.24; this.idealHi = 0.49;
  }
  applySnap(snap, ownLane) {
    this.runners = (snap.runners ?? []).map(r => ({ ...r }));
    this.phase = snap.phase ?? this.phase;
    this.time = snap.time ?? 0; this.tick = snap.tick ?? 0;
    this.countdown = snap.countdown ?? 3;
    if (Number.isInteger(snap.stage)) {
      this.stageIndex = snap.stage;
      const d = difficultyFor(snap.stage);
      this.idealLo = d.idealLo; this.idealHi = d.idealHi;
    }
    if (Number.isInteger(ownLane)) this.ownLane = ownLane;
  }
  get player() { return this.runners[this.ownLane] ?? this.runners[2] ?? null; }
  heightAt(age) {
    return age === null || age === undefined || age < 0 || age > RULES.jumpDuration
      ? 0 : Math.sin(age / RULES.jumpDuration * Math.PI) * RULES.jumpHeight;
  }
  jumpWindow(r) {
    r = r ?? this.player;
    if (!r) return { distance: Infinity, timeTo: Infinity, ideal: false, near: false };
    const d = (RULES.hurdles[r.hurdleIndex] ?? Infinity) - r.x;
    const timeTo = d / Math.max(r.speed, 0.1);
    return { distance: d, timeTo, ideal: timeTo >= this.idealLo && timeTo <= this.idealHi, near: timeTo >= 0 && timeTo < 0.9 };
  }
}

export function netStandings(runners) {
  return [...runners].sort((a, b) =>
    a.finishTime !== null && b.finishTime !== null ? a.finishTime - b.finishTime
    : a.finishTime !== null ? -1 : b.finishTime !== null ? 1 : b.x - a.x || a.lane - b.lane);
}

export function formatCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); }

// Invite links: `${base}?room=CODE` opens the game with the room code
// prefilled (auto-joins when the player name is already known), so guests
// never type the code. Same-origin base keeps the WebSocket host implicit.
export function inviteBase() {
  try { return `${location.origin}${location.pathname}`; } catch { return ''; }
}

export function inviteLinkFor(code, base) {
  const clean = formatCode(code);
  let root = String(base || '').replace(/[?#].*$/, '');
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/]+$/i.test(root)) root += '/';
  else if (!/\/$/.test(root) && !/\/[^/]*\.[^/.]*$/.test(root)) root += '/';
  return `${root}?room=${clean}`;
}

export function parseInviteCode(search) {
  try {
    const params = new URLSearchParams(String(search || ''));
    return formatCode(params.get('room') || '');
  } catch { return ''; }
}
