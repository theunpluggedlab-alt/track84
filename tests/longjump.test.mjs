import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceEngine, PLAYER_ID } from '../dist/engine.js';
import { EVENTS, LONGJUMP, distanceFor, getEvent, isEvent } from '../dist/events.js';
import { Room } from '../server/room.mjs';
import { NetView } from '../dist/net.js';
import { RaceSession } from '../dist/session.js';

function startJump(stage = 0, humans = [PLAYER_ID], seed = 21) {
  const e = new RaceEngine(seed);
  e.setEvent('longjump');
  e.setStage(stage);
  e.reset(seed, humans);
  e.start();
  while (e.phase === 'countdown') e.step();
  return e;
}

function runToBoard(e, hz = 7.5, jumpAt = 0.4) {
  let leg = 'L', next = 0;
  for (let i = 0; i < 120 * 30 && e.phase !== 'finished'; i++) {
    if (e.time >= next && !e.player.jumped && !e.player.foul) {
      e.input({ playerId: PLAYER_ID, action: leg });
      leg = leg === 'L' ? 'R' : 'L';
      next += 1 / hz;
    }
    const w = e.jumpWindow();
    if (w.distance <= jumpAt && w.distance > 0 && !e.player.jumped) {
      e.input({ playerId: PLAYER_ID, action: 'J' });
    }
    e.step();
    if (e.player.finishTime !== null) break;
  }
  return e;
}

test('long jump ships as third event without disturbing others', () => {
  assert.deepEqual(EVENTS.map(e => e.id), ['hurdles', 'rowing', 'longjump']);
  assert(isEvent('longjump') && !isEvent('polevault'));
  assert.equal(getEvent('longjump').name, 'Long Jump');
  assert.equal(distanceFor('longjump'), LONGJUMP.runway);
  assert.equal(distanceFor('rowing'), 500);
  assert.equal(distanceFor('nope'), 110);
  const e = new RaceEngine(3);
  assert.equal(e.setEvent('longjump'), 'longjump');
  assert.equal(e.distance, LONGJUMP.runway);
  assert.equal(e.rules, LONGJUMP);
});

test('run-up builds speed and take off near the board flies far', () => {
  const e = runToBoard(startJump(), 7.5, 0.4);
  assert.equal(e.player.foul, false);
  assert(e.player.landed);
  assert(e.player.best > 4, `best ${e.player.best}`);
  assert(e.player.best <= LONGJUMP.maxBest);
  assert(e.player.takeoffX <= LONGJUMP.board + LONGJUMP.foulTol);
  assert(e.player.landingX > e.player.takeoffX);
});

test('overstep is a foul and sorts last', () => {
  const e = startJump();
  e.player.x = LONGJUMP.board + LONGJUMP.foulTol + 0.1;
  e.player.speed = 8;
  assert.equal(e.input({ playerId: PLAYER_ID, action: 'J' }), false);
  assert.equal(e.player.foul, true);
  assert.equal(e.player.best, 0);
  for (let i = 0; i < 120 * 20 && e.phase !== 'finished'; i++) e.step();
  assert.equal(e.phase, 'finished');
  const order = e.standings();
  assert.equal(order[order.length - 1].id, PLAYER_ID);
});

test('no jump past the line is an automatic foul', () => {
  const e = startJump();
  e.player.x = LONGJUMP.board - 0.5;
  e.player.speed = 9;
  e.player.lastStep = e.time;
  for (let i = 0; i < 120 && !e.player.foul; i++) e.step();
  assert.equal(e.player.foul, true);
});

test('early safe take off is short, late close take off is long', () => {
  const early = runToBoard(startJump(0, [PLAYER_ID], 31), 7, 5);
  const late = runToBoard(startJump(0, [PLAYER_ID], 32), 7, 0.3);
  assert(!early.player.foul && !late.player.foul);
  assert(late.player.best > early.player.best + 1, `early ${early.player.best} vs late ${late.player.best}`);
});

test('jump needs speed and one attempt only', () => {
  const e = startJump();
  assert.equal(e.input({ playerId: PLAYER_ID, action: 'J' }), false);
  e.player.speed = 8;
  e.player.x = 25;
  assert(e.input({ playerId: PLAYER_ID, action: 'J' }));
  assert(e.player.jumped);
  assert.equal(e.input({ playerId: PLAYER_ID, action: 'J' }), false);
  assert.equal(e.input({ playerId: PLAYER_ID, action: 'L' }), false);
});

test('cpu jumpers finish and standings sort by best', () => {
  const e = startJump(5, [], 77);
  for (let i = 0; i < 120 * 40 && e.phase !== 'finished'; i++) e.step();
  assert.equal(e.phase, 'finished');
  for (const r of e.runners) assert(r.finishTime !== null);
  const order = e.standings().map(r => r.best);
  assert.deepEqual(order, [...order].sort((a, b) => b - a));
});

test('long jump is frame-rate independent and survives snapshot', () => {
  const simulate = (fps) => {
    const s = new RaceSession();
    s.setEvent('longjump');
    s.engine.start();
    for (let i = 0; i < fps * 6; i++) s.update(1 / fps);
    return s.engine;
  };
  const a = simulate(30), b = simulate(60), c = simulate(144);
  const align = (e, tick) => { while (e.tick < tick) e.step(); return e.snapshot(); };
  const tick = Math.max(a.tick, b.tick, c.tick);
  const shape = s => s.runners.map(r => [r.x, r.speed, r.best, r.foul, r.jumped]);
  assert.deepEqual(shape(align(b, tick)), shape(align(a, tick)));
  assert.deepEqual(shape(align(c, tick)), shape(align(a, tick)));
  const source = runToBoard(startJump(), 7, 0.5);
  const copy = new RaceEngine(1);
  copy.restore(source.snapshot());
  assert.equal(copy.mode, 'longjump');
  for (let i = 0; i < 60; i++) { source.step(); copy.step(); }
  assert.deepEqual(source.snapshot(), copy.snapshot());
});

test('two humans jump side by side in one room', () => {
  const outbox = new Map();
  const room = new Room('LJ01', (player, obj) => {
    if (!outbox.has(player.id)) outbox.set(player.id, []);
    outbox.get(player.id).push(obj);
  }, 5, { event: 'longjump' });
  const alice = room.addPlayer('ALICE');
  const bob = room.addPlayer('BOB');
  assert(alice && bob);
  assert(room.start());
  assert.equal(room.engine.mode, 'longjump');
  const crews = [
    { p: alice, hz: 7.5, next: 0, leg: 'L', jumpAt: 0.35 },
    { p: bob, hz: 6, next: 0.05, leg: 'L', jumpAt: 2.5 },
  ];
  const clocks = new Map(crews.map(c => [c.p.id, 4000000]));
  let ticks = 0;
  while (room.phase !== 'over' && ticks++ < 120 * 60) {
    if (room.engine.phase === 'racing') {
      for (const c of crews) {
        const lane = room.engine.runners[c.p.lane];
        if (lane.finishTime !== null) continue;
        if (!lane.jumped && room.engine.time >= c.next) {
          c.leg = c.leg === 'L' ? 'R' : 'L';
          clocks.set(c.p.id, clocks.get(c.p.id) + Math.round(1000 / c.hz));
          room.applyInput(c.p, c.nextSeq ?? (c.nextSeq = 0, 0), c.leg, clocks.get(c.p.id));
          c.nextSeq = (c.nextSeq ?? 0) + 1;
          c.next += 1 / c.hz;
        }
        if (!lane.jumped && !lane.foul && LONGJUMP.board - lane.x <= c.jumpAt && LONGJUMP.board - lane.x > 0) {
          clocks.set(c.p.id, clocks.get(c.p.id) + 40);
          room.applyInput(c.p, c.nextSeq ?? 0, 'J', clocks.get(c.p.id));
          c.nextSeq = (c.nextSeq ?? 0) + 1;
        }
      }
    }
    room.step();
  }
  assert.equal(room.phase, 'over');
  let over = null;
  for (const msgs of outbox.values()) for (const m of msgs) if (m.t === 'over') over = m;
  assert(over);
  assert.equal(over.event, 'longjump');
  const aRow = over.standings.find(s => s.lane === alice.lane);
  const bRow = over.standings.find(s => s.lane === bob.lane);
  assert('best' in aRow && 'foul' in bRow);
  assert(aRow.best > bRow.best, `late ${aRow.best} vs early ${bRow.best}`);
});

test('hosting long jump keeps snapshot and result contracts', () => {
  const outbox = new Map();
  const room = new Room('LJ02', (player, obj) => {
    if (!outbox.has(player.id)) outbox.set(player.id, []);
    outbox.get(player.id).push(obj);
  }, 0, { event: 'longjump' });
  assert.equal(room.event, 'longjump');
  room.addPlayer('ALICE');
  assert(room.start());
  for (let i = 0; i < 30; i++) room.step();
  const snap = room.snapshot();
  assert.equal(snap.mode, 'longjump');
  assert.equal(snap.distance, LONGJUMP.runway);
  const view = new NetView();
  view.applySnap(snap, 0);
  assert.equal(view.mode, 'longjump');
  for (const key of ['best', 'foul', 'jumped', 'landed', 'takeoffX', 'landingX']) {
    assert(key in view.runners[0], `snapshot missing ${key}`);
  }
  const w = view.jumpWindow(view.player);
  assert(Number.isFinite(w.distance));
});
