// Rowing event: the 500m single sculls share the engine, the L/R/J protocol
// and the five-lane room with the hurdles, so these tests pin the hallmarks of
// the discipline — rhythm beats force, stamina forces pacing, a stuck oar
// catches a crab and J calls a power ten.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceEngine, PLAYER_ID } from '../dist/engine.js';
import { EVENTS, ROWING, distanceFor, getEvent, isEvent } from '../dist/events.js';
import { Room } from '../server/room.mjs';
import { NetView } from '../dist/net.js';
import { RaceSession } from '../dist/session.js';

// Tap the human lane on a fixed schedule and return the engine. `limit` counts
// racing ticks: the countdown is skipped first, because a stroke before the gun
// is a false start (`early` opts into that on purpose).
function rowAt(hz, opts = {}) {
  const { stage = 0, power = false, jitter = 0, seed = 84, limit = 120 * 180, early = 0 } = opts;
  const e = new RaceEngine(seed);
  e.setEvent('rowing');
  e.setStage(stage);
  e.reset(seed, [PLAYER_ID]);
  e.start();
  for (let i = 0; i < early; i++) e.input({ playerId: PLAYER_ID, action: 'L' });
  while (e.phase === 'countdown') e.step();
  let next = 0, leg = 'L', rnd = 54321;
  const rand = () => (rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let t = 0; t < limit && e.phase !== 'finished'; t++) {
    if (hz > 0 && e.time >= next) {
      leg = leg === 'L' ? 'R' : 'L';
      e.input({ playerId: PLAYER_ID, action: leg });
      next += (1 / hz) * (1 + (rand() - .5) * 2 * jitter);
    }
    if (power && e.player.x > 380) e.input({ playerId: PLAYER_ID, action: 'J' });
    e.step();
  }
  return e;
}

test('rowing ships as a second event without disturbing the hurdles', () => {
  assert.deepEqual(EVENTS.map(e => e.id), ['hurdles', 'rowing']);
  assert(isEvent('rowing') && !isEvent('marathon'));
  assert.equal(getEvent('rowing').name, '500m Single Sculls');
  assert.equal(distanceFor('rowing'), 500);
  assert.equal(distanceFor('nope'), 110);
  const e = new RaceEngine(3);
  assert.equal(e.mode, 'hurdles');
  assert.equal(e.distance, 110);
  assert.equal(e.setEvent('rowing'), 'rowing');
  assert.equal(e.distance, ROWING.distance);
  assert.equal(e.rules, ROWING);
  assert.equal(e.setEvent('curling'), 'hurdles');
});

test('the sustainable rating beats a smashed one over 500m', () => {
  const steady = rowAt(7);
  const smashed = rowAt(9.5);
  assert.equal(steady.phase, 'finished');
  assert.equal(smashed.phase, 'finished');
  assert(steady.player.finishTime < smashed.player.finishTime - 3, `steady ${steady.player.finishTime} vs smashed ${smashed.player.finishTime}`);
  assert.equal(smashed.player.stamina, 0);
  assert(steady.player.stamina > smashed.player.stamina);
});

test('strokes build hull speed and letting go lets the shell glide', () => {
  const idle = rowAt(0, { limit: 120 * 8 });
  const quick = rowAt(7, { limit: 120 * 8 });
  assert(idle.player.x < 40);
  assert(quick.player.x > 60);
  const fast = quick.player.speed, at = quick.player.x;
  for (let i = 0; i < 120 * 4; i++) quick.step();
  assert(quick.player.x > at + 20, 'a released shell keeps gliding');
  assert(quick.player.speed < fast, '...but it bleeds speed');
});

test('a steady rhythm earns swing, a sloppy one does not', () => {
  // How much of the race the crew rode clean water, measured with a jittered
  // stroke schedule: the swing gate sits at an interval spread of 0.22.
  const swingShare = (jitter) => {
    const e = new RaceEngine(84);
    e.setEvent('rowing');
    e.reset(84, [PLAYER_ID]);
    e.start();
    while (e.phase === 'countdown') e.step();
    let next = 0, leg = 'L', rnd = 999;
    const rand = () => (rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296;
    let on = 0, ticks = 0;
    for (let t = 0; t < 120 * 8 && e.phase === 'racing'; t++) {
      if (e.time >= next) {
        leg = leg === 'L' ? 'R' : 'L';
        e.input({ playerId: PLAYER_ID, action: leg });
        next += (1 / 6) * (1 + (rand() - .5) * 2 * jitter);
      }
      e.step();
      if (e.player.swing) on++;
      ticks++;
    }
    return on / ticks;
  };
  const clean = swingShare(.2), sloppy = swingShare(.6);
  assert(clean > .8, `steady rhythm swung ${clean}`);
  assert(sloppy < .3, `sloppy rhythm swung ${sloppy}`);
  const a = rowAt(6, { jitter: .2 }), b = rowAt(6, { jitter: .6 });
  assert(a.player.finishTime < b.player.finishTime, `clean ${a.player.finishTime} vs sloppy ${b.player.finishTime}`);
});

test('three same-side strokes in a row catch a crab', () => {
  const e = rowAt(6, { limit: 120 * 6 });
  const before = e.player.x;
  // A stuck oar: hold the side the crew was last on, three strokes running.
  const same = e.player.lastLeg;
  assert(same === 'L' || same === 'R', 'the crew has been rowing');
  assert.equal(e.input({ playerId: PLAYER_ID, action: same }), false);
  assert.equal(e.player.crabs, 0);
  e.step();
  assert.equal(e.input({ playerId: PLAYER_ID, action: same }), false);
  assert.equal(e.player.crabs, 0);
  assert.equal(e.input({ playerId: PLAYER_ID, action: same }), false);
  assert.equal(e.player.crabs, 1);
  assert(e.player.crabRemaining > 0);
  assert.equal(e.player.repeats, 0);
  // While the blade is buried the crew cannot be driven.
  assert.equal(e.input({ playerId: PLAYER_ID, action: same }), false);
  assert.equal(e.input({ playerId: PLAYER_ID, action: 'J' }), false);
  const stuck = e.player.speed;
  for (let i = 0; i < 130; i++) e.step();
  assert.equal(e.player.crabRemaining, 0);
  assert(e.player.speed < stuck);
  assert(e.player.x > before, 'the boat still carries its way');
  assert.equal(e.player.lastLeg, null, 'the crab resets the stroke');
  assert(e.input({ playerId: PLAYER_ID, action: 'R' }), 'the oar is free again');
});

test('stamina drains above the sustainable rating and recovers below it', () => {
  const hard = rowAt(8, { limit: 120 * 20 });
  assert(hard.player.stamina < .3, `stamina ${hard.player.stamina}`);
  const before = hard.player.stamina;
  for (let i = 0; i < 120 * 6; i++) hard.step();
  assert(hard.player.stamina > before + .15, `recovered to ${hard.player.stamina}`);
  assert.equal(hard.player.cadence, 0);
});

test('a power ten spends one call, lifts the hull and cannot be stacked', () => {
  const e = rowAt(6, { limit: 120 * 3 });
  assert.equal(e.player.powerCharges, ROWING.powerCharges);
  assert.equal(e.input({ playerId: PLAYER_ID, action: 'J' }), true);
  assert.equal(e.player.powerCharges, ROWING.powerCharges - 1);
  assert(e.player.powerTen > 0);
  const plain = e.player.speed;
  assert.equal(e.input({ playerId: PLAYER_ID, action: 'J' }), false);
  assert.equal(e.player.powerCharges, ROWING.powerCharges - 1);
  e.input({ playerId: PLAYER_ID, action: 'R' });
  for (let i = 0; i < 12; i++) e.step();
  assert(e.player.speed > plain, 'the surge actually lifts the bow');
  // Nothing left to call once both charges are gone.
  e.input({ playerId: PLAYER_ID, action: 'J' });
  for (let i = 0; i < 400; i++) e.step();
  e.input({ playerId: PLAYER_ID, action: 'J' });
  assert.equal(e.player.powerCharges, 0);
  assert.equal(e.input({ playerId: PLAYER_ID, action: 'J' }), false);
});

test('a stroke before the gun is a false start and the boat is held', () => {
  const early = rowAt(7, { limit: 120 * 3, early: 2 });
  const clean = rowAt(7, { limit: 120 * 3 });
  assert.equal(early.player.falseStart, true);
  assert.equal(clean.player.falseStart, false);
  assert.equal(early.phase, 'racing');
  // The held boat trails the clean one from the very first strokes.
  assert(early.player.x < clean.player.x, `held ${early.player.x} vs clean ${clean.player.x}`);
  // A J press on the gun is not a false start: it is just a wasted call.
  const wasteful = new RaceEngine(11);
  wasteful.setEvent('rowing');
  wasteful.reset(11, [PLAYER_ID]);
  wasteful.start();
  assert.equal(wasteful.input({ playerId: PLAYER_ID, action: 'J' }), false);
  assert.equal(wasteful.player.falseStart, false);
  assert.equal(wasteful.player.powerCharges, ROWING.powerCharges);
});

test('every lane finishes 500m and standings sort by time', () => {
  const e = rowAt(7);
  assert.equal(e.phase, 'finished');
  for (const r of e.runners) {
    assert.equal(r.x, ROWING.distance);
    assert(r.finishTime > 0);
  }
  const order = e.standings().map(r => r.finishTime);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert(e.runners.every(r => r.falls === 0), 'rowers do not fall');
});

test('cpu crews row the whole course and manage their own boat', () => {
  const e = new RaceEngine(5);
  e.setEvent('rowing');
  e.setStage(0);
  e.reset(5, []);
  e.start();
  for (let i = 0; i < 120 * 150 && e.phase !== 'finished'; i++) e.step();
  assert.equal(e.phase, 'finished');
  for (const r of e.runners) {
    assert(r.finishTime > 0, `${r.name} did not finish`);
    assert(r.strokes > 60, `${r.name} took ${r.strokes} strokes`);
    assert(r.powerCharges >= 0 && r.powerCharges <= ROWING.powerCharges);
    assert(r.crabs >= 0);
  }
});

test('rowing is frame-rate independent and survives a snapshot round-trip', () => {
  const simulate = (fps) => {
    const s = new RaceSession();
    s.setEvent('rowing');
    s.engine.start();
    for (let i = 0; i < fps * 6; i++) s.update(1 / fps);
    return s.engine;
  };
  const a = simulate(30), b = simulate(60), c = simulate(144);
  // Frames land on different ticks; the simulation itself must not care, so
  // bring every engine to the same tick and require identical state.
  const align = (e, tick) => { let n = 0; while (e.tick < tick && n++ < 20000) e.step(); return e.snapshot(); };
  const tick = Math.max(a.tick, b.tick, c.tick);
  const shape = s => s.runners.map(r => [r.x, r.speed, r.stamina, r.cadence, r.strokes, r.powerCharges, r.aiRepeat]);
  const first = shape(align(a, tick));
  assert(Math.abs(a.tick - c.tick) <= 1, 'frame loops land on the same tick');
  assert.deepEqual(shape(align(b, tick)), first);
  assert.deepEqual(shape(align(c, tick)), first);
  const source = rowAt(7, { limit: 120 * 5 });
  const copy = new RaceEngine(1);
  copy.restore(source.snapshot());
  assert.equal(copy.mode, 'rowing');
  assert.equal(copy.distance, ROWING.distance);
  for (let i = 0; i < 120; i++) { source.step(); copy.step(); }
  assert.deepEqual(source.snapshot(), copy.snapshot());
});

test('two humans race rowing side by side to the flag in one room', () => {
  const outbox = new Map();
  const room = new Room('ROW2', (player, obj) => {
    if (!outbox.has(player.id)) outbox.set(player.id, []);
    outbox.get(player.id).push(obj);
  }, 5, { event: 'rowing' });
  const alice = room.addPlayer('ALICE');
  const bob = room.addPlayer('BOB');
  assert(alice && bob);
  assert(room.start());
  assert.equal(room.engine.mode, 'rowing');
  const crews = [
    { p: alice, hz: 7, seq: 0, next: 0, leg: 'L' },
    { p: bob, hz: 5, seq: 0, next: 0, leg: 'L' },
  ];
  let ticks = 0;
  // The room rate-limits each lane to 30 inputs/sec: advance every crew's own
  // request clock in step with its stroke plan so the headless race never
  // trips the anti-spam guard (one tap every 140ms << the 30/sec cap).
  const clocks = new Map(crews.map(c => [c.p.id, 3000000]));
  while (room.phase !== 'over' && ticks++ < 120 * 120) {
    if (room.engine.phase === 'racing') {
      for (const c of crews) {
        // Retire a crew the moment it crosses the line: a finished hull no
        // longer accepts strokes, and the room keeps running for the others.
        const hull = room.engine.runners[c.p.lane];
        if (hull.finishTime !== null) continue;
        if (room.engine.time >= c.next) {
          c.leg = c.leg === 'L' ? 'R' : 'L';
          clocks.set(c.p.id, clocks.get(c.p.id) + Math.round(1000 / c.hz));
          assert(room.applyInput(c.p, c.seq++, c.leg, clocks.get(c.p.id)), 'stroke accepted');
          c.next += 1 / c.hz;
        }
      }
    }
    room.step();
  }
  assert.equal(room.phase, 'over');
  let over = null;
  for (const msgs of outbox.values()) for (const m of msgs) if (m.t === 'over') over = m;
  assert(over, 'the room announced the result of a rowing race');
  assert.equal(over.event, 'rowing');
  assert.equal(over.standings.length, 5);
  const aliceRow = over.standings.find(s => s.lane === alice.lane);
  const bobRow = over.standings.find(s => s.lane === bob.lane);
  assert(aliceRow.finishTime > 0 && bobRow.finishTime > 0, 'both humans finished');
  assert(aliceRow.finishTime < bobRow.finishTime, 'the stronger rating won');
  assert(over.standings[0].finishTime <= aliceRow.finishTime, 'standings stay ordered');
});

test('hosting rowing keeps the lane, snapshot and result contracts', () => {
  const outbox = new Map();
  const room = new Room('ROW1', (player, obj) => {
    if (!outbox.has(player.id)) outbox.set(player.id, []);
    outbox.get(player.id).push(obj);
  }, 0, { event: 'rowing' });
  assert.equal(room.event, 'rowing');
  assert.equal(room.roomState().event, 'rowing');
  room.addPlayer('ALICE');
  room.addPlayer('BOB');
  assert(room.start());
  assert.equal(room.engine.mode, 'rowing');
  for (let i = 0; i < 30; i++) room.step();
  const snap = room.snapshot();
  assert.equal(snap.mode, 'rowing');
  assert.equal(snap.distance, ROWING.distance);
  const view = new NetView();
  view.applySnap(snap, 0);
  assert.equal(view.mode, 'rowing');
  assert.equal(view.distance, ROWING.distance);
  assert.equal(view.player.lane, 0);
  for (const key of ['stamina', 'strokes', 'crabs', 'swing', 'powerCharges', 'powerTen', 'crabRemaining', 'falseStart']) {
    assert(key in view.runners[0], `snapshot missing ${key}`);
  }
  assert.equal(view.jumpWindow(view.player).distance, Infinity);
  // The host can switch discipline between races; the room returns to the lobby.
  room.phase = 'over';
  room.setEvent('hurdles');
  assert.equal(room.event, 'hurdles');
  assert.equal(room.engine.mode, 'hurdles');
  assert.equal(room.phase, 'lobby');
  room.setEvent('tiddlywinks');
  assert.equal(room.event, 'hurdles');
});
