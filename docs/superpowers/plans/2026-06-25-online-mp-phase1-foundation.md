# Online Multiplayer — Phase 1 Part A: Deterministic Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and unit-test the deterministic primitives every later online-multiplayer phase depends on — a seeded PRNG, a stable state hash, a fixed-timestep clock, and a replay/desync harness — plus the in-browser test runner the repo currently lacks.

**Architecture:** Add a new `src/sim/` module of pure, dependency-free, serializable ES modules. None of them touch the DOM, `Date.now`, `Math.random`, or wall-clock time, so they are fully deterministic and unit-testable. There is no Node on the dev machine, so the suite is **dual-runtime**: a browser page (`tools/test/index.html`) for a human eyeball, and a headless runner (`tools/test/run-headless.js`) executed by macOS JavaScriptCore via `osascript -l JavaScript`, which gives a shell-detectable pass/fail and a non-zero exit code on failure (the spec's "headless" harness). The headless runner reads each ESM source, strips `import`/`export`, and evals it — so there is one set of pure-ESM source files and both runtimes consume them. **Headless `osascript` is the verification of record for every task.** This plan changes **no existing file except `src/config.js`** (one additive `SIM` block) — it is purely additive substrate, so it cannot regress the live game.

**Tech Stack:** Vanilla JavaScript ES modules, no build step, no dependencies. Python dev server (`tools/devserver.py`) for serving. Browser (Chromium) as the test runtime.

## Global Constraints

These apply to every task. Copied from `CLAUDE.md` Golden Rules and the design spec (`docs/superpowers/specs/2026-06-25-online-multiplayer-design.md`).

- **No build step, no dependencies, no framework.** Vanilla ES modules only.
- **No Node/npm on the dev machine.** There is no `node`, `npm`, `pytest`, or `node --check`. The verification of record is the **headless** runner: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` (macOS JavaScriptCore), which prints `[TESTS] N passed, 0 failed` and exits non-zero on any failure. The browser page (`tools/test/index.html`) is the optional human cross-check.
- **Tune from `src/config.js`.** New tuning constants (the tick rate) go in a `SIM` block there — no magic numbers scattered in code.
- **Sim code is deterministic by construction.** Never use `Math.random`, `Date.now`, `performance.now`, `new Date()`, or wall-clock `dt` inside `src/sim/`. Randomness comes only from the seeded PRNG in `src/sim/rng.js`. Sim state holds only finite numbers, strings, booleans, null, arrays, and plain objects (no `NaN`/`Infinity`, no closures, no DOM refs) so it stays serializable and hashable.
- **Match the surrounding style** — small focused modules with short explanatory comments, the way neighboring `src/*.js` files read.
- **Commits:** end every commit message with the repo's two standard trailers:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01W79S4wsgidziRj2QHrf5G1
  ```
  The per-task commit commands below omit them for brevity — append them to each.
- **Branch:** all work lands on the existing `online-multiplayer` branch.

## File Structure

New files (all additive):

- `tools/test/runner.js` — minimal in-browser test runner: `suite`, `test`, `assert*` helpers, and `run()` which renders results to the page, sets `document.title`, logs `[TESTS] …`, and exposes `window.__TESTS__ = { passed, failed, total }`.
- `tools/test/index.html` — the browser test page; imports the runner + every `*.test.js` and calls `run()`. Served at `http://localhost:5174/tools/test/`.
- `tools/test/run-headless.js` — headless runner for `osascript -l JavaScript`. Holds the same assertion API as classic-script globals, a `MODULES`/`TESTS` manifest (kept in sync with `index.html`'s imports), and a `run(argv)` that loads every source, runs all tests, prints `[TESTS] …`, and throws (non-zero exit) on any failure.
- `tools/test/runner.test.js` — meta-tests proving the assertion helpers behave (run by both runtimes).
- `src/sim/rng.js` — deterministic, serializable seeded PRNG (mulberry32). Sole source of sim randomness.
- `src/sim/rng.test.js` — PRNG tests.
- `src/sim/hash.js` — stable 32-bit state hash (canonical serialization + FNV-1a) for desync detection.
- `src/sim/hash.test.js` — hash tests.
- `src/sim/clock.js` — `FixedStep`: variable real-time → whole sim ticks + render alpha, with a spiral-of-death clamp.
- `src/sim/clock.test.js` — clock tests.
- `src/sim/replay.js` — generic determinism/desync harness (`runReplay`, `checkDeterministic`) over any `(makeState, step, seed, inputLog)`.
- `src/sim/replay.test.js` — harness tests, including a fixture sim that proves it CATCHES non-determinism.

Modified files:

- `src/config.js` — add one additive `SIM` block (tick rate + catch-up clamp). No existing value changes.

**Interface summary (the contracts later phases rely on):**

- `newRng(seed) -> { s }`, `rngFloat(r) -> number [0,1)`, `rngInt(r, n) -> int [0,n)`, `rngRange(r, lo, hi) -> number [lo,hi)`, `rngClone(r) -> { s }`
- `hashState(state) -> uint32`, `hashHex(state) -> string` (8 hex chars)
- `new FixedStep(tickMs, maxTicks?)`, `.advance(realDtMs) -> { ticks, alpha }`, `.reset()`
- `runReplay(makeState, step, seed, inputLog) -> { state, hashes }`, `checkDeterministic(makeState, step, seed, inputLog) -> { ok, divergedAt }`
- The **sim step contract** (defined here, implemented by Phase 1 Part B): `makeState(seed) -> state` builds fresh initial state (with an embedded rng); `step(state, input) -> state` advances exactly one tick and returns the next state.

---

### Task 1: In-browser test harness

**Files:**
- Create: `tools/test/runner.js`
- Create: `tools/test/index.html`
- Create: `tools/test/runner.test.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `suite(name)`, `test(name, fn)`, `assert(cond, msg?)`, `assertEqual(actual, expected, msg?)`, `assertDeepEqual(actual, expected, msg?)`, `assertThrows(fn, msg?)`, `run() -> Promise<{passed,failed,total}>`. All later tasks import these from `../../tools/test/runner.js`.

- [ ] **Step 1: Write the runner**

Create `tools/test/runner.js`:

```js
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
```

- [ ] **Step 2: Write the test page**

Create `tools/test/index.html`:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>PAWNCH tests</title>
  <style>body{background:#070a16;color:#cfd8ff;font-family:monospace;padding:16px}h3{color:#ff7a18}</style>
</head>
<body>
  <h3>PAWNCH sim tests</h3>
  <div id="out"></div>
  <script type="module">
    import { run } from './runner.js';
    // Importing a *.test.js registers its tests as a side effect.
    import './runner.test.js';
    await run();
  </script>
</body>
</html>
```

- [ ] **Step 3: Write meta-tests for the harness**

Create `tools/test/runner.test.js`:

```js
import { suite, test, assert, assertEqual, assertDeepEqual, assertThrows } from './runner.js';

suite('runner');

test('assert passes on truthy', () => { assert(true); });
test('assertEqual passes on equal', () => { assertEqual(2 + 2, 4); });
test('assertEqual reports on unequal', () => {
  assertThrows(() => assertEqual(1, 2));
});
test('assertDeepEqual ignores key order', () => {
  assertDeepEqual({ a: 1, b: 2 }, { a: 1, b: 2 });
});
test('assertThrows passes when fn throws', () => {
  assertThrows(() => { throw new Error('x'); });
});
```

- [ ] **Step 4: Write the headless runner**

Create `tools/test/run-headless.js`:

```js
'use strict';
// Headless test runner for macOS JavaScriptCore:
//   osascript -l JavaScript tools/test/run-headless.js "$PWD"
// Runs the same *.test.js suites as tools/test/index.html with no browser and
// no Node, so the suite has a shell-detectable pass/fail and exit code.
// JavaScriptCore runs classic scripts, so every ESM source has its import lines
// and leading `export ` removed and is concatenated into ONE script that is
// eval'd in a single scope — this keeps cross-file `const`/`class` bindings
// (e.g. SIM, FixedStep) visible to each other, which separate evals do not.
// Exit 0 = all passed; non-zero = a failure (named in the output).
ObjC.import('Foundation');

function read(root, rel) {
  var s = $.NSString.stringWithContentsOfFileEncodingError(root + '/' + rel, $.NSUTF8StringEncoding, null);
  var js = ObjC.unwrap(s);
  if (typeof js !== 'string') throw new Error('cannot read ' + rel);
  return js;
}

function strip(src) {
  return src
    .replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?\s*$/mg, '')
    .replace(/^\s*import\s*['"][^'"]+['"];?\s*$/mg, '')
    .replace(/^export\s+/mg, '');
}

// The assert API (mirrors tools/test/runner.js), as a source prefix so it shares
// the single eval scope with the loaded tests.
var FRAMEWORK = [
  "var __tests = [], __suite = '';",
  "function suite(n){ __suite = n; }",
  "function test(n,f){ __tests.push({ n:(__suite?__suite+' \\u203a ':'')+n, f:f }); }",
  "function assert(c,m){ if(!c) throw new Error(m||'assertion failed'); }",
  "function assertEqual(a,e,m){ if(a!==e) throw new Error((m||'not equal')+': expected '+e+', got '+a); }",
  "function assertDeepEqual(a,e,m){ if(JSON.stringify(a)!==JSON.stringify(e)) throw new Error((m||'not deep-equal')+': expected '+JSON.stringify(e)+', got '+JSON.stringify(a)); }",
  "function assertThrows(f,m){ var t=false; try{f();}catch(e){t=true;} if(!t) throw new Error(m||'expected function to throw'); }",
].join('\n');

// Load order: config + dependency-free modules first, then dependents, then the
// test files. KEEP IN SYNC with tools/test/index.html's import list.
var MODULES = [];
var TESTS = [
  'tools/test/runner.test.js',
];

var EPILOGUE = [
  "var __p=0,__f=0,__fails=[];",
  "__tests.forEach(function(t){ try{ t.f(); __p++; }catch(e){ __f++; __fails.push(t.n+' \\u2014 '+(e&&e.message?e.message:e)); } });",
  "console.log('[TESTS] '+__p+' passed, '+__f+' failed');",
  "__fails.forEach(function(x){ console.log('  FAIL '+x); });",
  "if(__f>0) throw new Error(__f+' test(s) failed');",
].join('\n');

function run(argv) {
  var root = (argv && argv[0]) || ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath);
  var parts = [FRAMEWORK];
  MODULES.forEach(function (m) { parts.push(strip(read(root, m))); });
  TESTS.forEach(function (t) { parts.push(strip(read(root, t))); });
  parts.push(EPILOGUE);
  (0, eval)(parts.join('\n;\n'));
  return '';
}
```

- [ ] **Step 5: Run headless and verify green (verification of record)**

Run from the repo root:

```bash
osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"
```

Expected output:

```
[TESTS] 5 passed, 0 failed
exit=0
```

- [ ] **Step 6: (Optional) browser cross-check**

Run the dev server if not already running: `python3 tools/devserver.py` (serves `http://localhost:5174`, no-cache). Open `http://localhost:5174/tools/test/`. Expected: tab title `✓ 5 passed, 0 failed`, five green `PASS` lines, console `[TESTS] 5 passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add tools/test/
git commit -m "test: add dual-runtime (browser + headless) test runner for the sim suite"
```

---

### Task 2: Seeded PRNG (`src/sim/rng.js`)

**Files:**
- Create: `src/sim/rng.test.js`
- Create: `src/sim/rng.js`

**Interfaces:**
- Consumes: the runner from Task 1.
- Produces: `newRng(seed) -> { s }`, `rngFloat(r) -> number in [0,1)`, `rngInt(r, n) -> int in [0,n)`, `rngRange(r, lo, hi) -> number in [lo,hi)`, `rngClone(r) -> { s }`. State is a single uint32 field `s`, so snapshotting an rng is just copying `s`.

- [ ] **Step 1: Write the failing test**

Create `src/sim/rng.test.js`:

```js
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
  assert(v > 0 && v < 1, 'seed 0 still yields a valid float: ' + v);
});
```

- [ ] **Step 2: Register the new files and run to verify it fails**

Add the import to `tools/test/index.html` right after the `runner.test.js` import line:

```html
    import '../../src/sim/rng.test.js';
```

In `tools/test/run-headless.js`, add `'src/sim/rng.js'` to `MODULES` and `'src/sim/rng.test.js'` to `TESTS` so they read:

```js
var MODULES = [
  'src/sim/rng.js',
];
var TESTS = [
  'tools/test/runner.test.js',
  'src/sim/rng.test.js',
];
```

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS with `cannot read src/sim/rng.js` and `exit=1` (the module does not exist yet). This is the red state.

- [ ] **Step 3: Write the implementation**

Create `src/sim/rng.js`:

```js
// Deterministic, serializable PRNG (mulberry32). The entire simulation's
// randomness flows through this, so two clients seeded identically produce
// identical results — the foundation of lockstep. NEVER use Math.random in sim
// code. State is one uint32 (`s`), so snapshot/restore is just copying it.

const U32 = 0x100000000; // 2^32

// Build a fresh RNG from a 32-bit seed. Seed 0 is nudged to 1 so the generator
// is never stuck.
export function newRng(seed) {
  return { s: (seed >>> 0) || 1 };
}

// Advance the state and return a float in [0, 1). Mutates r.
export function rngFloat(r) {
  let t = (r.s = (r.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / U32;
}

// Integer in [0, n). n must be a positive integer.
export function rngInt(r, n) {
  return Math.floor(rngFloat(r) * n);
}

// Float in [lo, hi).
export function rngRange(r, lo, hi) {
  return lo + rngFloat(r) * (hi - lo);
}

// Shallow copy of the state, for snapshotting an rng embedded in sim state.
export function rngClone(r) {
  return { s: r.s };
}
```

- [ ] **Step 4: Run to verify it passes**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 12 passed, 0 failed
exit=0
```

(5 runner + 7 rng.) Optional browser cross-check: reload `http://localhost:5174/tools/test/` → title `✓ 12 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/sim/rng.js src/sim/rng.test.js tools/test/index.html tools/test/run-headless.js
git commit -m "feat(sim): deterministic seeded PRNG (mulberry32)"
```

---

### Task 3: Stable state hash (`src/sim/hash.js`)

**Files:**
- Create: `src/sim/hash.test.js`
- Create: `src/sim/hash.js`

**Interfaces:**
- Consumes: the runner from Task 1.
- Produces: `hashState(state) -> uint32`, `hashHex(state) -> string` (8 lowercase hex chars). Logically-equal states hash equal regardless of object key insertion order.

- [ ] **Step 1: Write the failing test**

Create `src/sim/hash.test.js`:

```js
import { suite, test, assert, assertEqual } from '../../tools/test/runner.js';
import { hashState, hashHex } from './hash.js';

suite('hash');

test('identical state hashes equal', () => {
  assertEqual(hashState({ a: 1, b: [2, 3] }), hashState({ a: 1, b: [2, 3] }));
});

test('key order does not matter', () => {
  assertEqual(hashState({ a: 1, b: 2, c: 3 }), hashState({ c: 3, b: 2, a: 1 }));
});

test('nested key order does not matter', () => {
  assertEqual(
    hashState({ outer: { x: 1, y: 2 }, list: [{ p: 1, q: 2 }] }),
    hashState({ list: [{ q: 2, p: 1 }], outer: { y: 2, x: 1 } }),
  );
});

test('a changed value changes the hash', () => {
  assert(hashState({ a: 1 }) !== hashState({ a: 2 }), 'value change should alter hash');
});

test('array order is significant', () => {
  assert(hashState([1, 2, 3]) !== hashState([3, 2, 1]), 'array order matters');
});

test('distinguishes types', () => {
  assert(hashState({ a: 1 }) !== hashState({ a: '1' }), 'number vs string');
  assert(hashState({ a: true }) !== hashState({ a: 1 }), 'bool vs number');
  assert(hashState({ a: null }) !== hashState({ a: 0 }), 'null vs zero');
});

test('hashHex is 8 lowercase hex chars', () => {
  const h = hashHex({ a: 1, b: 2 });
  assert(/^[0-9a-f]{8}$/.test(h), 'bad hex: ' + h);
});
```

- [ ] **Step 2: Run to verify it fails**

Add to `tools/test/index.html` after the rng import:

```html
    import '../../src/sim/hash.test.js';
```

In `tools/test/run-headless.js`, add `'src/sim/hash.js'` to `MODULES` and `'src/sim/hash.test.js'` to `TESTS`.

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS with `cannot read src/sim/hash.js` and `exit=1`. This is the red state.

- [ ] **Step 3: Write the implementation**

Create `src/sim/hash.js`:

```js
// Deterministic 32-bit hash of sim state, used to detect desyncs between two
// lockstep clients. State is serialized with sorted object keys so logically
// equal states hash equal regardless of property insertion order, then folded
// with FNV-1a. Assumes sim state holds only finite numbers, strings, booleans,
// null, arrays, and plain objects (the sim guarantees this).

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}

// FNV-1a over the canonical string. Returns an unsigned 32-bit integer.
export function hashState(state) {
  const str = canon(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 8-char lowercase hex form, handy for logs and on-screen desync banners.
export function hashHex(state) {
  return ('00000000' + hashState(state).toString(16)).slice(-8);
}
```

- [ ] **Step 4: Run to verify it passes**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 19 passed, 0 failed
exit=0
```

(12 prior + 7 hash.) Optional browser cross-check: title `✓ 19 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/sim/hash.js src/sim/hash.test.js tools/test/index.html tools/test/run-headless.js
git commit -m "feat(sim): stable FNV-1a state hash for desync detection"
```

---

### Task 4: Fixed-timestep clock (`src/sim/clock.js`) + `SIM` config

**Files:**
- Create: `src/sim/clock.test.js`
- Create: `src/sim/clock.js`
- Modify: `src/config.js` (add a `SIM` block)

**Interfaces:**
- Consumes: the runner from Task 1; `SIM.TICK_MS` from config.
- Produces: `class FixedStep { constructor(tickMs, maxTicks = SIM.MAX_CATCHUP_TICKS); advance(realDtMs) -> { ticks, alpha }; reset() }`. `ticks` is the whole number of sim ticks to run this frame; `alpha` is the leftover fraction (0..1) for render interpolation.

- [ ] **Step 1: Write the failing test**

Create `src/sim/clock.test.js`:

```js
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

test('catch-up is clamped (no spiral of death)', () => {
  const fs = new FixedStep(TICK, 8);
  const { ticks } = fs.advance(TICK * 100); // huge stall, e.g. backgrounded tab
  assertEqual(ticks, 8);
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
```

- [ ] **Step 2: Run to verify it fails**

Add to `tools/test/index.html` after the hash import:

```html
    import '../../src/sim/clock.test.js';
```

In `tools/test/run-headless.js`, add `'src/config.js'` and `'src/sim/clock.js'` to `MODULES` and `'src/sim/clock.test.js'` to `TESTS`. `config.js` must load before `clock.js` (clock reads `SIM` from it), so `MODULES` now reads in this order:

```js
var MODULES = [
  'src/config.js',
  'src/sim/rng.js',
  'src/sim/hash.js',
  'src/sim/clock.js',
];
```

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS with `cannot read src/sim/clock.js` and `exit=1`. This is the red state.

- [ ] **Step 3: Add the `SIM` config block**

In `src/config.js`, add this block immediately after the existing `MATCH = { … };` block (before the `PAL` block):

```js
// Deterministic simulation timing. The whole online/offline match advances on
// this fixed tick (decoupled from the display refresh rate) so two lockstep
// clients stay bit-identical. See docs/superpowers/specs/2026-06-25-online-multiplayer-design.md.
export const SIM = {
  TICK_HZ: 60,
  TICK_MS: 1000 / 60,
  MAX_CATCHUP_TICKS: 8,   // most catch-up ticks to run in one frame (spiral-of-death clamp)
};
```

- [ ] **Step 4: Write the implementation**

Create `src/sim/clock.js`:

```js
// Fixed-timestep accumulator: converts variable real-time frame deltas into a
// whole number of fixed sim ticks plus a render interpolation alpha. The sim
// only ever advances in whole TICK_MS steps, so it stays deterministic at any
// display refresh rate. Decoupled from requestAnimationFrame so it is unit-
// testable on its own.

import { SIM } from '../config.js';

export class FixedStep {
  // tickMs: duration of one sim tick. maxTicks: if a huge real delta arrives
  // (e.g. the tab was backgrounded), never run more than this many catch-up
  // ticks in a single frame — drop the backlog instead of spiralling.
  constructor(tickMs = SIM.TICK_MS, maxTicks = SIM.MAX_CATCHUP_TICKS) {
    this.tickMs = tickMs;
    this.maxTicks = maxTicks;
    this.acc = 0;
  }

  // Feed the real elapsed ms since the last call. Returns how many whole ticks
  // to advance the sim and the leftover alpha (0..1) for interpolating draws.
  advance(realDtMs) {
    this.acc += realDtMs;
    let ticks = Math.floor(this.acc / this.tickMs);
    this.acc -= ticks * this.tickMs;
    if (ticks > this.maxTicks) ticks = this.maxTicks; // drop backlog, keep acc as the remainder
    const alpha = this.acc / this.tickMs;
    return { ticks, alpha };
  }

  reset() { this.acc = 0; }
}
```

- [ ] **Step 5: Run to verify it passes**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 26 passed, 0 failed
exit=0
```

(19 prior + 7 clock.) Optional browser cross-check: title `✓ 26 passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add src/sim/clock.js src/sim/clock.test.js src/config.js tools/test/index.html tools/test/run-headless.js
git commit -m "feat(sim): fixed-timestep clock + SIM config block"
```

---

### Task 5: Replay / desync harness (`src/sim/replay.js`)

**Files:**
- Create: `src/sim/replay.test.js`
- Create: `src/sim/replay.js`

**Interfaces:**
- Consumes: `hashState` from Task 3; `newRng`/`rngFloat` from Task 2 (in the test fixture only).
- Produces: `runReplay(makeState, step, seed, inputLog) -> { state, hashes }` and `checkDeterministic(makeState, step, seed, inputLog) -> { ok, divergedAt }`. These operate on the **sim step contract**: `makeState(seed)` builds fresh initial state (with an embedded rng); `step(state, input)` advances exactly one tick and returns the next state. Phase 1 Part B implements a real `makeState`/`step`; this harness is what proves that implementation deterministic.

- [ ] **Step 1: Write the failing test**

Create `src/sim/replay.test.js`:

```js
import { suite, test, assert, assertEqual, assertDeepEqual } from '../../tools/test/runner.js';
import { runReplay, checkDeterministic } from './replay.js';
import { newRng, rngFloat } from './rng.js';

suite('replay');

// A tiny DETERMINISTIC fixture sim: state carries a seeded rng and an
// accumulator; each tick adds a random step scaled by the input. Used only to
// exercise the harness.
const makeState = (seed) => ({ rng: newRng(seed), total: 0, ticks: 0 });
const step = (s, input) => {
  s.total += rngFloat(s.rng) * (input || 1);
  s.ticks += 1;
  return s;
};

// A NON-deterministic fixture: pulls from Math.random, so two runs diverge.
const badStep = (s) => { s.total += Math.random(); s.ticks += 1; return s; };

const inputs = [1, 2, 1, 3, 1, 1, 2];

test('runReplay produces one hash per tick plus the initial', () => {
  const { hashes } = runReplay(makeState, step, 42, inputs);
  assertEqual(hashes.length, inputs.length + 1);
});

test('deterministic sim replays identically', () => {
  const { ok, divergedAt } = checkDeterministic(makeState, step, 42, inputs);
  assert(ok, 'expected determinism, diverged at tick ' + divergedAt);
  assertEqual(divergedAt, -1);
});

test('two runs share identical per-tick hashes', () => {
  const a = runReplay(makeState, step, 7, inputs);
  const b = runReplay(makeState, step, 7, inputs);
  assertDeepEqual(a.hashes, b.hashes);
});

test('the harness CATCHES non-determinism', () => {
  const { ok, divergedAt } = checkDeterministic(makeState, badStep, 42, inputs);
  assert(!ok, 'harness must flag a Math.random sim as non-deterministic');
  assert(divergedAt >= 1, 'divergence should be at or after the first tick');
});
```

- [ ] **Step 2: Run to verify it fails**

Add to `tools/test/index.html` after the clock import:

```html
    import '../../src/sim/replay.test.js';
```

In `tools/test/run-headless.js`, add `'src/sim/replay.js'` to `MODULES` (after `clock.js`; it depends on `hash.js`, already earlier) and `'src/sim/replay.test.js'` to `TESTS`.

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS with `cannot read src/sim/replay.js` and `exit=1`. This is the red state.

- [ ] **Step 3: Write the implementation**

Create `src/sim/replay.js`:

```js
// Determinism / desync harness. Runs a sim through an input log and records a
// state hash per tick; running it twice and comparing the hashes proves the sim
// is deterministic (or pinpoints the first tick that diverged). This is the
// closest thing the repo has to an automated test for lockstep correctness, and
// later phases reuse it against the real match sim and across the wire.
//
// Sim step contract:
//   makeState(seed) -> state      fresh initial state, with an embedded rng
//   step(state, input) -> state   advance exactly one tick, return next state

import { hashState } from './hash.js';

// Run one pass; returns the final state and the per-tick hashes
// (hashes[0] is the initial state, hashes[t+1] is after input t).
export function runReplay(makeState, step, seed, inputLog) {
  let state = makeState(seed);
  const hashes = [hashState(state)];
  for (let t = 0; t < inputLog.length; t++) {
    state = step(state, inputLog[t]);
    hashes.push(hashState(state));
  }
  return { state, hashes };
}

// Run the same sim twice and compare. Returns { ok, divergedAt } where
// divergedAt is the first differing tick index, or -1 if fully deterministic.
export function checkDeterministic(makeState, step, seed, inputLog) {
  const a = runReplay(makeState, step, seed, inputLog);
  const b = runReplay(makeState, step, seed, inputLog);
  for (let i = 0; i < a.hashes.length; i++) {
    if (a.hashes[i] !== b.hashes[i]) return { ok: false, divergedAt: i };
  }
  return { ok: true, divergedAt: -1 };
}
```

- [ ] **Step 4: Run to verify it passes**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 30 passed, 0 failed
exit=0
```

(26 prior + 4 replay.) The passing "harness CATCHES non-determinism" test confirms the desync detector actually works. Optional browser cross-check: title `✓ 30 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/sim/replay.js src/sim/replay.test.js tools/test/index.html tools/test/run-headless.js
git commit -m "feat(sim): deterministic replay/desync harness"
```

---

## Verification (whole plan)

Headless (verification of record), from the repo root:

```bash
osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"
```

Expected: `[TESTS] 30 passed, 0 failed` and `exit=0`.

Optional browser cross-check: with the dev server running (`python3 tools/devserver.py`), open `http://localhost:5174/tools/test/` — tab title `✓ 30 passed, 0 failed`, console `[TESTS] 30 passed, 0 failed`, `window.__TESTS__ === { passed: 30, failed: 0, total: 30 }`.

Then confirm the live game is unaffected (this plan only added `SIM` to `config.js`): open `http://localhost:5174/`, start a Story match, and play a full round (chess → boxing → round break). No console `[PAWNCH] frame error:` lines.

## What this plan deliberately does NOT do (next plan: Phase 1 Part B)

- It does not move `BoxingMatch`, the chess clock, or round flow into the sim. That extraction — implementing the real `makeState(seed)` / `step(state, input)` against `src/boxing.js`, the chess clock, and the walk/round-flow timeline, then driving the renderer from sim state via `FixedStep` — is Phase 1 Part B, and it will be verified with this harness (`checkDeterministic` over a recorded full-match input log).
- No networking (Phase 2), rollback (Phase 3), rating service (Phase 4), or Steam wrapper (Phase 5).
```
