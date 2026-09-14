import test from 'node:test';
import assert from 'node:assert/strict';
import { Room, makeCode, cleanName } from '../server/room.mjs';
import { NetView, netStandings, inviteLinkFor, parseInviteCode } from '../dist/net.js';

function harness(stage = 0) {
  const outbox = new Map(); // playerId -> received objects
  const room = new Room('TEST', (player, obj) => {
    if (!outbox.has(player.id)) outbox.set(player.id, []);
    outbox.get(player.id).push(obj);
  }, stage);
  return { room, outbox };
}

test('rooms assign lanes 0..4 and reject the 6th player', () => {
  const { room } = harness();
  const lanes = [];
  for (let i = 0; i < 5; i++) lanes.push(room.addPlayer(`P${i}`).lane);
  assert.deepEqual(lanes, [0, 1, 2, 3, 4]);
  assert.equal(room.addPlayer('P6'), null);
  assert.equal(room.host.name, 'P0');
});

test('AI lanes are named CPU, never the solo YOU', () => {
  const { room } = harness();
  room.addPlayer('ALICE');
  assert(room.start());
  const names = room.engine.runners.map(r => r.name);
  assert(!names.includes('YOU'), `AI lane called YOU: ${names}`);
  assert.deepEqual(names.slice(1), ['CPU 2', 'CPU 3', 'CPU 4', 'CPU 5']);
});

test('rejoining with the same name reclaims the old lane', () => {
  const { room } = harness();
  const a = room.addPlayer('ALICE');
  room.removePlayer(a);
  assert.equal(room.engine.runners[a.lane].human, false);
  const back = room.reclaim('ALICE');
  assert(back && back.lane === a.lane);
  assert.equal(room.engine.runners[a.lane].human, true);
  assert.equal(room.players.length, 1);
});

test('host leaving promotes the next connected player', () => {
  const { room } = harness();
  const a = room.addPlayer('A');
  const b = room.addPlayer('B');
  assert.equal(a.host, true);
  room.removePlayer(a);
  assert.equal(a.host, false);
  assert.equal(b.host, true);
});

test('makeCode avoids collisions and cleanName trims', () => {
  const code = makeCode((c) => c === 'AAAA');
  assert.equal(code.length, 4);
  assert.equal(cleanName('  abcdefghijklmnop  '), 'abcdefghijkl');
  assert.equal(cleanName(''), 'Guest');
});

test('input validation: order, duplicates, actions, phases', () => {
  const { room } = harness();
  const p = room.addPlayer('P1');
  assert.equal(room.applyInput(p, 0, 'L'), false); // lobby: rejected
  assert(room.start());
  for (let i = 0; i < 400; i++) room.step(); // through the countdown
  assert.equal(room.engine.phase, 'racing');
  assert.equal(room.applyInput(p, 0, 'X'), false);
  assert.equal(room.applyInput(p, 0, 'L'), true);
  assert.equal(room.applyInput(p, 0, 'R'), false); // duplicate seq
  assert.equal(room.applyInput(p, -1, 'R'), false);
  // Burst inputs sharing one timestamp: the per-second cap binds at 30.
  let ok = 0, seq = 1, leg = 'R';
  for (let i = 0; i < 39; i++) {
    for (let s = 0; s < 6; s++) room.step(); // let game time pass between taps
    if (room.applyInput(p, seq++, leg, 1_000_000)) ok++;
    leg = leg === 'L' ? 'R' : 'L';
  }
  assert(ok > 0 && ok <= 30);
});

test('disconnect hands the lane to AI and the race still completes', () => {
  const outbox = new Map();
  const room = new Room('TEST', (player, obj) => {
    if (!outbox.has(player.id)) outbox.set(player.id, []);
    outbox.get(player.id).push(obj);
  }, 0, { timeout: 40 });
  const p = room.addPlayer('P1');
  const q = room.addPlayer('P2'); // stays connected (idle) to receive the outcome
  assert(room.start());
  room.removePlayer(p);
  assert.equal(room.engine.runners[p.lane].human, false);
  let over = null;
  for (let i = 0; i < 120 * 60 && !over; i++) {
    room.step();
    for (const msgs of outbox.values()) for (const m of msgs) if (m.t === 'over') over = m;
    outbox.clear();
  }
  assert(over, 'expected an over message');
  assert.equal(over.standings.length, 5);
  // The disconnected lane ran by AI and actually finished.
  const ai = over.standings.find(s => s.lane === p.lane);
  assert(ai.finishTime > 0);
  // The idle human is scored DNF (null sorts last).
  const idle = over.standings.find(s => s.lane === q.lane);
  assert.equal(idle.finishTime, null);
  assert.equal(over.standings[4].lane, q.lane);
});

test('snapshots carry every field the renderer needs', () => {
  const { room } = harness(7);
  room.addPlayer('P1'); room.addPlayer('P2');
  assert(room.start());
  for (let i = 0; i < 30; i++) room.step();
  const snap = room.snapshot();
  assert.equal(snap.stage, 7);
  assert.equal(snap.runners.length, 5);
  for (const r of snap.runners) {
    for (const k of ['id', 'lane', 'name', 'color', 'x', 'speed', 'jumpAge', 'hurdleIndex', 'hurdleResults', 'finishTime']) {
      assert(k in r, `missing ${k}`);
    }
  }
});

test('invite links round-trip the 4-letter room code', () => {
  assert.equal(inviteLinkFor('ab12', 'https://track84.onrender.com/'), 'https://track84.onrender.com/?room=AB12');
  assert.equal(inviteLinkFor('ab12', 'https://track84.onrender.com/index.html?x=1#y'), 'https://track84.onrender.com/index.html?room=AB12');
  assert.equal(parseInviteCode('?room=ab12'), 'AB12');
  assert.equal(parseInviteCode('?room=AB12&foo=1'), 'AB12');
  assert.equal(parseInviteCode(''), '');
  assert.equal(parseInviteCode('?foo=1'), '');
});
test('NetView exposes player, jump cue and standings', () => {
  const { room } = harness(0);
  room.addPlayer('P1');
  room.start();
  for (let i = 0; i < 30; i++) room.step();
  const view = new NetView();
  view.applySnap(room.snapshot(), 0);
  assert.equal(view.player.lane, 0);
  assert.equal(view.stageIndex, 0);
  // Ideal window on the easiest stage is generous (0.16..0.66).
  assert(view.idealHi - view.idealLo > 0.4);
  const w = view.jumpWindow(view.player);
  assert('ideal' in w && 'distance' in w);
  assert.equal(view.heightAt(null), 0);
  assert(view.heightAt(0.39) > 1.2);
  const order = netStandings(view.runners);
  assert.equal(order.length, 5);
});
