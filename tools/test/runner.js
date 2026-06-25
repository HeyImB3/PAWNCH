// Minimal in-browser test runner. There is no Node on the dev machine, so the
// sim's unit tests run in the browser (served by tools/devserver.py). The test
// files are pure ESM and only touch the DOM through this runner, so the same
// suites could later run under Node behind a tiny shim if desired.

const tests = [];
let curSuite = '';

export function suite(name) { curSuite = name; }

export function test(name, fn) {
  tests.push({ name: (curSuite ? curSuite + ' › ' : '') + name, fn });
}

export function assert(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || 'not equal'}: expected ${expected}, got ${actual}`);
}

export function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || 'not deep-equal'}: expected ${e}, got ${a}`);
}

export function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg || 'expected function to throw');
}

// Run every registered test, render lines to the page, set the tab title, log a
// summary, and expose window.__TESTS__ for quick scripted inspection.
export async function run() {
  let passed = 0, failed = 0;
  const out = document.getElementById('out') || document.body;
  for (const t of tests) {
    try { await t.fn(); passed++; line(out, 'PASS', t.name, '#39d98a'); }
    catch (e) { failed++; line(out, 'FAIL', t.name + ' — ' + e.message, '#ff3b53'); console.error(t.name, e); }
  }
  const summary = `${passed} passed, ${failed} failed`;
  const head = document.createElement('div');
  head.style.cssText = 'font-weight:bold;margin:8px 0;color:' + (failed ? '#ff3b53' : '#39d98a');
  head.textContent = '[TESTS] ' + summary;
  out.prepend(head);
  document.title = (failed ? '✗ ' : '✓ ') + summary;
  console.log('[TESTS] ' + summary);
  window.__TESTS__ = { passed, failed, total: passed + failed };
  return window.__TESTS__;
}

function line(out, tag, text, color) {
  const d = document.createElement('div');
  d.style.cssText = 'font-family:monospace;font-size:12px;color:' + color;
  d.textContent = tag + '  ' + text;
  out.appendChild(d);
}
