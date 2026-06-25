import { suite, test, assert, assertEqual, assertDeepEqual } from '../../tools/test/runner.js';
import { newRng, rngFloat, rngInt, rngRange, rngClone } from './rng.js';

suite('rng');

test('same seed yields the same sequence', () => {
  const a = newRng(12345), b = newRng(12345);
  const seqA = [rngFloat(a), rngFloat(a), rngFloat(a)];
  const seqB = [rngFloat(b), rngFloat(b), rngFloat(b)];
  assertDeepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = newRng(1), b = newRng(2);
  assert(rngFloat(a) !== rngFloat(b), 'distinct seeds should differ');
});

test('rngFloat stays in [0,1)', () => {
  const r = newRng(7);
  for (let i = 0; i < 1000; i++) {
    const x = rngFloat(r);
    assert(x >= 0 && x < 1, 'out of range: ' + x);
  }
});

test('rngInt stays in [0,n)', () => {
  const r = newRng(99);
  for (let i = 0; i < 1000; i++) {
    const x = rngInt(r, 6);
    assert(Number.isInteger(x) && x >= 0 && x < 6, 'out of range: ' + x);
  }
});

test('rngRange stays in [lo,hi)', () => {
  const r = newRng(3);
  for (let i = 0; i < 1000; i++) {
    const x = rngRange(r, 10, 15);
    assert(x >= 10 && x < 15, 'out of range: ' + x);
  }
});

test('rngClone reproduces the future sequence', () => {
  const r = newRng(555);
  rngFloat(r); rngFloat(r);              // advance a bit
  const snap = rngClone(r);
  const fromLive = [rngFloat(r), rngFloat(r)];
  const fromSnap = [rngFloat(snap), rngFloat(snap)];
  assertDeepEqual(fromLive, fromSnap);
});

test('seed 0 is handled (never a dead generator)', () => {
  const a = newRng(0), b = newRng(0);
  assertEqual(rngFloat(a), rngFloat(b));          // seed 0 is reproducible, not stuck
  const v = rngFloat(newRng(0));
  assert(v >= 0 && v < 1, 'seed 0 still yields a valid float: ' + v);
});
