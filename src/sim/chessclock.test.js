import { suite, test, assert, assertEqual } from '../../tools/test/runner.js';
import { newChessClock, tickChessClock, addIncrement, resetHalf, chessClockStatus } from './chessclock.js';
import { MATCH, SIM } from '../config.js';

suite('chessclock');

test('a fresh clock has full per-player clocks and the round window', () => {
  const c = newChessClock();
  assertEqual(c.w, MATCH.CHESS_SECONDS * 1000);
  assertEqual(c.b, MATCH.CHESS_SECONDS * 1000);
  assertEqual(c.halfLeft, MATCH.CHESS_HALF_SECONDS * 1000);
});

test('ticking burns the side-to-move clock and the round window only', () => {
  const c = newChessClock();
  tickChessClock(c, 'w', SIM.TICK_MS);
  assert(Math.abs(c.w - (MATCH.CHESS_SECONDS * 1000 - SIM.TICK_MS)) < 1e-9, 'w should drop one tick');
  assertEqual(c.b, MATCH.CHESS_SECONDS * 1000);              // the other side is untouched
  assert(Math.abs(c.halfLeft - (MATCH.CHESS_HALF_SECONDS * 1000 - SIM.TICK_MS)) < 1e-9, 'window should drop one tick');
});

test('600 ticks burns ~10s (tick-based, not wall-clock)', () => {
  const c = newChessClock();
  for (let i = 0; i < 600; i++) tickChessClock(c, 'w', SIM.TICK_MS);
  assert(Math.abs(c.w - (MATCH.CHESS_SECONDS * 1000 - 10000)) < 0.01, 'w off: ' + c.w);
});

test('flag when the side-to-move clock reaches zero', () => {
  const c = newChessClock(50, 100000);                       // 50ms clock, big window
  assertEqual(chessClockStatus(c, 'w'), null);
  for (let i = 0; i < 4; i++) tickChessClock(c, 'w', SIM.TICK_MS);   // 4 * 16.67ms > 50ms
  assertEqual(chessClockStatus(c, 'w'), 'flag');
});

test('time when the round window expires', () => {
  const c = newChessClock();
  for (let i = 0; i < 3601; i++) tickChessClock(c, 'w', SIM.TICK_MS);   // past the 60s window
  assertEqual(chessClockStatus(c, 'w'), 'time');
});

test('round-window expiry takes precedence over a simultaneous flag', () => {
  const c = newChessClock(50, 50);
  tickChessClock(c, 'w', 60);                                // both cross zero this tick
  assertEqual(chessClockStatus(c, 'w'), 'time');            // matches live chess.js: window checked first
});

test('increment adds to the moving side only', () => {
  const c = newChessClock();
  addIncrement(c, 'w');
  assertEqual(c.w, MATCH.CHESS_SECONDS * 1000 + MATCH.CHESS_INCREMENT_MS);
  assertEqual(c.b, MATCH.CHESS_SECONDS * 1000);
});

test('resetHalf restores the window but keeps the per-player clocks', () => {
  const c = newChessClock();
  for (let i = 0; i < 60; i++) tickChessClock(c, 'w', SIM.TICK_MS);
  const wBefore = c.w;
  resetHalf(c);
  assertEqual(c.halfLeft, MATCH.CHESS_HALF_SECONDS * 1000);
  assertEqual(c.w, wBefore);                                 // per-player clocks persist across rounds
});
