import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSession, MAX_LIVES } from '../dist/session.js';

test('arcade lives: 3 misses outside top 3 ends the game', () => {
  const s = new RaceSession();
  assert.equal(s.lives, MAX_LIVES);
  assert.equal(s.gameOver, false);
  s.recordResult(5, false);
  assert.equal(s.lives, 2);
  s.recordResult(4, false);
  assert.equal(s.lives, 1);
  assert.equal(s.gameOver, false);
  s.recordResult(6, false);
  assert.equal(s.lives, 0);
  assert.equal(s.gameOver, true);
});

test('top-3 finishes cost no life and unlock the next stage', () => {
  const s = new RaceSession();
  s.recordResult(2, true);
  assert.equal(s.lives, MAX_LIVES);
  assert.equal(s.unlocked, 1);
  s.recordResult(5, false);
  assert.equal(s.lives, MAX_LIVES - 1);
  // A miss never locks progress backwards.
  assert.equal(s.unlocked, 1);
});

test('new game resets lives, tour, medals and name', () => {
  const s = new RaceSession();
  s.recordResult(5, false);
  s.recordResult(1, true);
  s.newGame();
  assert.equal(s.lives, MAX_LIVES);
  assert.equal(s.unlocked, 0);
  assert.deepEqual(s.medals, {});
  assert.equal(s.playerName, '');
  assert.equal(s.gameOver, false);
});
