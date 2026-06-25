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
