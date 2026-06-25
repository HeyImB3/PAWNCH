import { suite, test, assert, assertEqual } from '../../tools/test/runner.js';
import { FixedStep } from './clock.js';
import { SIM } from '../config.js';

suite('clock');

const TICK = 1000 / 60;

test('exactly one tick of time yields one tick', () => {
  const fs = new FixedStep(TICK);
  const { ticks } = fs.advance(TICK);
  assertEqual(ticks, 1);
});

test('sub-tick time accumulates, no tick yet', () => {
  const fs = new FixedStep(TICK);
  assertEqual(fs.advance(TICK / 2).ticks, 0);
  assertEqual(fs.advance(TICK / 2).ticks, 1); // two halves = one tick
});

test('multiple ticks from a big delta', () => {
  const fs = new FixedStep(TICK);
  assertEqual(fs.advance(TICK * 3).ticks, 3);
});

test('alpha is the leftover fraction in [0,1)', () => {
  const fs = new FixedStep(TICK);
  const { ticks, alpha } = fs.advance(TICK * 1.5);
  assertEqual(ticks, 1);
  assert(Math.abs(alpha - 0.5) < 1e-9, 'alpha should be ~0.5, got ' + alpha);
});

test('catch-up is clamped (no spiral of death), remainder preserved', () => {
  const fs = new FixedStep(TICK, 8);
  const { ticks, alpha } = fs.advance(TICK * 100.9); // huge stall, e.g. backgrounded tab
  assertEqual(ticks, 8);                             // backlog dropped to the clamp
  assert(alpha >= 0 && alpha < 1, 'alpha stays in [0,1): ' + alpha);
  // drain-before-clamp: acc is reduced by the FULL backlog, so only the true
  // sub-tick remainder (~0.9) is carried — not (100.9 - 8).
  assert(Math.abs(alpha - 0.9) < 1e-9, 'sub-tick remainder preserved: ' + alpha);
});

test('reset clears the accumulator', () => {
  const fs = new FixedStep(TICK);
  fs.advance(TICK / 2);
  fs.reset();
  assertEqual(fs.advance(TICK / 2).ticks, 0); // the prior half was cleared
});

test('SIM config exposes the tick rate', () => {
  assertEqual(SIM.TICK_HZ, 60);
  assert(Math.abs(SIM.TICK_MS - 1000 / 60) < 1e-9, 'TICK_MS mismatch');
});
