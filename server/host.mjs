// TRACK/84 authoritative multiplayer host.
// One Node process serves the static game (dist/) AND the WebSocket race
// server on the same port, so phones on the same Wi-Fi just open
// http://<host-LAN-address>:4173 — no accounts, no setup.
// The server runs the same deterministic 120 Hz RaceEngine as solo play;
// vacant lanes are driven by the built-in seeded AI. Clients only send
// L/R/J inputs and render 20 Hz authoritative snapshots.
//
// NOTE: LAN-party trust model — no authentication or anti-cheat beyond
// per-player input sequencing and rate limits. Do not expose to the
// untrusted internet without adding auth in front of it.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Room, makeCode } from './room.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 4173);
const TICK_MS = 1000 / 120;

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };

const rooms = new Map(); // code -> Room

function safeSend(ws, data) {
  try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); } catch { /* ignore */ }
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});

const wss = new WebSocketServer({ server, path: '/race' });

wss.on('connection', (ws) => {
  safeSend(ws, JSON.stringify({ t: 'welcome', v: 1 }));
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    try { onMessage(ws, msg); } catch { /* ignore malformed */ }
  });
  ws.on('close', () => {
    const room = ws._room, player = ws._player;
    if (room && player && rooms.get(room.code) === room) {
      room.removePlayer(player);
      if (!room.connected().length) rooms.delete(room.code);
    }
  });
});

function sendTo(player, obj) { safeSend(player.ws, obj); }

function onMessage(ws, msg) {
  switch (msg.t) {
    case 'ping': safeSend(ws, { t: 'pong', at: msg.at ?? 0, serverAt: Date.now() }); return;
    case 'create': {
      const code = makeCode((c) => rooms.has(c));
      const room = new Room(code, sendTo, msg.stage ?? 0);
      rooms.set(code, room);
      const player = room.addPlayer(msg.name, ws);
      if (!player) { safeSend(ws, { t: 'err', msg: 'Room is full' }); return; }
      player.ws = ws; ws._player = player; ws._room = room;
      safeSend(ws, { t: 'you', id: player.id, lane: player.lane });
      room.broadcastRoom();
      return;
    }
    case 'join': {
      const room = rooms.get(String(msg.code ?? '').toUpperCase());
      if (!room) { safeSend(ws, { t: 'err', msg: 'Room not found' }); return; }
      if (room.phase === 'racing') { safeSend(ws, { t: 'err', msg: 'Race in progress' }); return; }
      const player = room.reclaim(msg.name) ?? room.addPlayer(msg.name, ws);
      if (!player) { safeSend(ws, { t: 'err', msg: 'Room is full' }); return; }
      player.ws = ws; ws._player = player; ws._room = room;
      safeSend(ws, { t: 'you', id: player.id, lane: player.lane });
      room.broadcastRoom();
      return;
    }
    case 'leave': {
      const room = ws._room, player = ws._player;
      if (room && player && rooms.get(room.code) === room) {
        room.removePlayer(player);
        if (!room.connected().length) rooms.delete(room.code);
      }
      ws._room = null; ws._player = null;
      return;
    }
    case 'stage': {
      const room = ws._room, player = ws._player;
      if (!room || !player?.host || room.phase === 'racing') return;
      room.setStage(msg.index ?? 0);
      return;
    }
    case 'start':
    case 'again': {
      const room = ws._room, player = ws._player;
      if (!room || !player?.host) return;
      if (msg.t === 'again' && room.phase !== 'over') return;
      if (msg.t === 'start' && room.phase === 'racing') return;
      room.start();
      return;
    }
    case 'input': {
      const room = ws._room, player = ws._player;
      if (!room || !player?.connected) return;
      room.applyInput(player, msg.seq, msg.action);
      return;
    }
  }
}

// Fixed-step loop for all active rooms.
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase === 'racing') room.step();
  }
}, TICK_MS);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TRACK/84 host on http://localhost:${PORT} (open http://<LAN-address>:${PORT} from phones)`);
});
