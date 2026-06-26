import { suite, test, assert, assertEqual, assertDeepEqual } from '../../tools/test/runner.js';
import { captureFrame, tickView } from './inputview.js';

suite('inputview');

const BOX_ACTIONS = ['jabL', 'jabR', 'hookL', 'hookR', 'dodgeL', 'dodgeR', 'duck', 'block', 'confirm'];
// fake live input: jabR freshly pressed this frame; block held (down) but not a fresh edge.
const src = { pressed: (a) => a === 'jabR', isDown: (a) => a === 'block' || a === 'jabR' };

test('captureFrame collects pressed edges and held actions (in action order)', () => {
  const f = captureFrame(src, BOX_ACTIONS);
  assertDeepEqual(f.pressed, ['jabR']);
  assertDeepEqual(f.held, ['jabR', 'block']);
});

test('a single press reaches exactly ONE sub-tick across a multi-tick frame', () => {
  const f = captureFrame(src, BOX_ACTIONS);
  let presses = 0;
  for (let i = 0; i < 4; i++) { if (tickView(f, i === 0).pressed('jabR')) presses++; }
  assertEqual(presses, 1);
});

test('held actions report isDown on every sub-tick', () => {
  const f = captureFrame(src, BOX_ACTIONS);
  let holds = 0;
  for (let i = 0; i < 4; i++) { if (tickView(f, i === 0).isDown('block')) holds++; }
  assertEqual(holds, 4);
});

test('the edge view reports presses; non-edge views report none but keep held', () => {
  const f = captureFrame(src, BOX_ACTIONS);
  assert(tickView(f, true).pressed('jabR'), 'edge view should see the press');
  assert(!tickView(f, false).pressed('jabR'), 'non-edge view should not');
  assert(tickView(f, false).isDown('block'), 'held persists on non-edge views');
});

test('a frame with no input yields no presses and no holds', () => {
  const empty = { pressed: () => false, isDown: () => false };
  const f = captureFrame(empty, BOX_ACTIONS);
  assertDeepEqual(f.pressed, []);
  assertDeepEqual(f.held, []);
  assert(!tickView(f, true).pressed('jabR'), 'no press');
});
