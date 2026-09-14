import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStroke, rowingPose } from '../dist/rowing-animation.js';

const rower = { strokes: 12, speed: 12, cadence: 6, crabRemaining: 0, finishTime: null };
test('visual stroke remains continuous across cadence changes and freezes with race time', () => {
  let s = advanceStroke(null, rower, 100);
  s = advanceStroke(s, rower, 100.2);
  const paused = advanceStroke(s, { ...rower, cadence: 12 }, 100.2);
  assert.equal(paused.phase, s.phase);
  const next = advanceStroke(paused, { ...rower, cadence: 12 }, 100.3);
  assert(Math.abs(next.phase - s.phase - .135) < 1e-9);
  assert.equal(advanceStroke(next, { ...rower, strokes: 0 }, 0).phase, 0);
});
test('coasting settles, crab holds the pose, and frame rate does not change the stroke', () => {
  const start = advanceStroke(null, rower, 0);
  const moving = advanceStroke(start, rower, .3);
  assert.equal(advanceStroke(moving, { ...rower, crabRemaining: 1 }, .5).phase, moving.phase);
  assert.equal(advanceStroke(moving, { ...rower, cadence: 0 }, 1.5).phase, 0);
  const run = fps => {
    let s = start;
    for (let i = 1; i <= fps; i++) s = advanceStroke(s, rower, i / fps);
    return s.phase;
  };
  assert(Math.abs(Math.sin(run(30)*2*Math.PI)-Math.sin(run(120)*2*Math.PI))<1e-9);
});
test('feet stay planted and leg lengths stay constant through drive and recovery', () => {
  for(let i=0;i<=100;i++){
    const p=rowingPose(i/100);
    assert.deepEqual(p.foot,[-14,-2]);
    for(const point of [p.hip,p.foot])assert(Math.abs(Math.hypot(point[0]-p.knee[0],point[1]-p.knee[1])-11.5)<1e-9);
  }
  assert.deepEqual({ ...rowingPose(0), drive: false },rowingPose(1));
  assert(rowingPose(.23).hip[0]>rowingPose(0).hip[0]);
  assert(rowingPose(.43).shoulder[0]>rowingPose(.23).shoulder[0]);
  assert.equal(rowingPose(.62).hip[0],rowingPose(.43).hip[0]);
});
