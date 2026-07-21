# Visual Overhaul V6 — Polish Sweep: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the overhaul: audit all 11 arenas for consistency and tell-readability, add real-browser perf instrumentation, ship an FX-intensity setting, and mark the project complete.

**Architecture:** Audit tasks follow a fixed procedure (screenshot matrix → findings list → targeted fixes → re-verify); the FX setting flows `save.settings.fx` → `game.js` boot/settings → `lighting.js setFxLow()/fxLow()` module flag → gates inside lighting helpers + count-reductions in the heaviest scene loops. No new subsystems.

**Tech Stack:** Unchanged.

## Global Constraints

- All prior Global Constraints verbatim. Fixes must not regress any shipped look without a screenshot justifying the change.
- Audit acceptance gates: (a) every arena's backdrop stays clearly lower-contrast than the fighters; (b) the mock tell banner is legible over every arena at first glance; (c) `fx: 'low'` visibly reduces effect density but keeps every scene's identity readable.
- Save shape gains a key (`settings.fx`) with a safe default — do NOT bump `SAVE_KEY` (additive with a fallback read is enough).

---

### Task 1: Consistency audit + fixes (incl. the deferred beach-frond pass)

- [ ] **Step 1: The matrix.** Headless-screenshot all 11 arenas × {crowd 0, crowd 60} via `tools/arena-preview.html?scene=<id>&crowd=<n>` (22 shots). Assemble two contact strips with PIL (calm row, crowd row) and REVIEW: value consistency (no arena dramatically brighter/darker than its neighbors except castle-by-design), accent-band presence, fallback seams, anything that reads unfinished.
- [ ] **Step 2: Known fix — beach fronds.** `tools/paint_beach.py` `paint_near`: add 3 more blades per cluster and raise leaflet density (drop the missing-leaflet chance 0.12 → 0.06, lengthen `llen` by +2) so the corner framing reads lush; regenerate `near.png`; re-screenshot beach.
- [ ] **Step 3:** Apply any further audit findings (each with a before/after screenshot pair). Commit: `git commit -m "polish(art): cross-arena consistency fixes + lusher beach fronds"`

### Task 2: Tell-readability QA

- [ ] **Step 1: Mock banner.** `tools/arena-preview.html`: with `?tell=1`, draw a facsimile of the boxing tell at its real position — a plate at (14,100) with `panel(...)` + two scale-2 lines (`'HAYMAKER !!'`, `'< HIGH !!'`) in a light accent — using the same `panel/text` imports the harness already has.
- [ ] **Step 2:** Screenshot all 11 arenas with `?tell=1&crowd=40`; verify the plate + text pop instantly everywhere. The risk spots: CASTLE (bright sky at y100), BEACH (horizon glare), STADIUM (busy tiers). Where it fights, darken THAT REGION of the scene slightly (e.g. a subtle painted vignette in the layer or a lower FX alpha there) — never brighten the banner (it's shared).
- [ ] **Step 3:** Commit: `git commit -m "polish(qa): tell-readability pass across all arenas (+harness mock tell)"`

### Task 3: Perf instrumentation + evidence-backed wins

- [ ] **Step 1: Overlay.** Both `tools/arena-preview.html` and `tools/chess-preview.html`: with `?perf=1`, track a rolling 60-frame average of `performance.now()` deltas and draw `avg ms + fps` top-right each frame (real browsers give true numbers; headless virtual-time runs are labeled as such in the text).
- [ ] **Step 2: Allocation audit.** Read every V1–V5 draw path for per-frame allocation hotspots (gradient creations, array churn). Apply ONLY trivially safe wins (e.g. hoisting invariant arrays); document anything left as-is in the commit message. No speculative micro-optimization.
- [ ] **Step 3:** Commit: `git commit -m "polish(perf): frame-time overlays + allocation audit"`

### Task 4: FX-intensity setting

**Files:** `src/save.js` (default `fx: 'full'`), `src/states/settings.js` (VIDEO row `FX`), `src/game.js` (apply at boot), `src/lighting.js` (flag + gates), `src/scenery.js` (count gates), `src/states/boxing.js` (reflection gate if not internal).

- [ ] **Step 1: Flag.** lighting.js:

```js
// FX intensity (Settings VIDEO tab): 'low' halves particle counts and drops
// the costliest passes. Set once at boot + on toggle (game.js / settings.js).
let _fxLow = false;
export function setFxLow(low) { _fxLow = !!low; }
export function fxLow() { return _fxLow; }
```

Gates inside lighting.js: `reflect()` returns without drawing when low (callers unchanged); `Flashbulbs.burst(n)` uses `Math.ceil(n / 2)` when low; `spotlightMoment` skips the dust motes when low.
- [ ] **Step 2: Save + settings.** save.js defaults: `fx: 'full'`. settings.js VIDEO rows: `['FX', s.fx === 'low' ? 'LOW' : 'FULL', true]` + confirm handler `else if (row === 'FX') { game.save.settings.fx = game.save.settings.fx === 'low' ? 'full' : 'low'; setFxLow(game.save.settings.fx === 'low'); audio.sfx.select(); }`. game.js boot (where save loads): `setFxLow(this.save.settings.fx === 'low');`.
- [ ] **Step 3: Scene count gates.** In scenery.js import `fxLow`; halve when low: cyber `L.rainN`, abyss caustic line count + plankton, stadium confetti + wave alpha, dream stardust falls, classic phone twinkles. Pattern: `const n = fxLow() ? Math.ceil(L.rainN / 2) : L.rainN;`
- [ ] **Step 4:** Verify: harness gets `?fxlow=1` (calls `setFxLow(true)` after import) — screenshot cyber+stadium in both modes; suite green; commit: `git commit -m "feat(settings): FX intensity toggle (FULL/LOW) gating the heavy passes"`

### Task 5: Overhaul-complete docs + final checkpoint

- [ ] Spec: V6 row → DONE + a closing "OVERHAUL COMPLETE (V1–V6)" line. CLAUDE.md: FX setting noted in the tour line; "Verifying a change" gains the `?perf=1` overlays. Memory: overhaul complete; next priorities = owner playtest + online-sync 2-A-3. Suite → merge main → suite → push → delete branch → gallery to user.
