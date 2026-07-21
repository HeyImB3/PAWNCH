import { suite, test, assert } from '../tools/test/runner.js';
import { ropeOffset, pruneImpulses, ROPE_DEFAULTS } from './ropes.js';

suite('ropes');

test('quiet rope is bounded by sag + idle amplitude', () => {
  for (let x = 0; x <= 512; x += 32) {
    const y = ropeOffset(x, 512, 5000, []);
    assert(Math.abs(y) <= ROPE_DEFAULTS.SAG + ROPE_DEFAULTS.IDLE_AMP + 0.001, 'bounded at x=' + x);
  }
});

test('an impulse peaks near the impact then decays to ~quiet', () => {
  const im = [{ x: 256, t0: 1000, mag: 1 }];
  let peak = 0;
  for (let t = 1000; t < 1600; t += 16) peak = Math.max(peak, Math.abs(ropeOffset(256, 512, t, im) - ropeOffset(256, 512, t, [])));
  assert(peak > 3, 'wave should visibly move the rope, peak=' + peak);
  const late = Math.abs(ropeOffset(256, 512, 1000 + ROPE_DEFAULTS.DEAD_MS + 100, im) - ropeOffset(256, 512, 1000 + ROPE_DEFAULTS.DEAD_MS + 100, []));
  assert(late < 0.2, 'wave should die out, late=' + late);
});

test('impulse influence falls off with distance', () => {
  const im = [{ x: 100, t0: 0, mag: 1 }];
  let near = 0, far = 0;
  for (let t = 0; t < 500; t += 16) {
    near = Math.max(near, Math.abs(ropeOffset(110, 512, t, im) - ropeOffset(110, 512, t, [])));
    far = Math.max(far, Math.abs(ropeOffset(480, 512, t, im) - ropeOffset(480, 512, t, [])));
  }
  assert(near > far * 3, `near ${near} should dwarf far ${far}`);
});

test('pruneImpulses drops dead, keeps live', () => {
  const im = [{ x: 0, t0: 0, mag: 1 }, { x: 0, t0: 5000, mag: 1 }];
  const kept = pruneImpulses(im, 5000 + 10);
  assert(kept.length === 1 && kept[0].t0 === 5000, 'only the live impulse remains');
});
