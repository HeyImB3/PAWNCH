// Pure rope-wave math for the ring's three ropes: catenary sag + idle sway +
// traveling, damped impact waves. NO imports — this file also runs inside the
// JSC headless test suite (tools/test/run-headless.js). Tuning enters the game
// via config.js RING.ROPES (which starts from these defaults).
export const ROPE_DEFAULTS = {
  SAG: 4,          // px of catenary sag at mid-span
  IDLE_AMP: 0.7,   // px of idle sway
  IDLE_HZ: 0.35,   // idle sway speed (cycles/sec)
  WAVE_AMP: 9,     // px peak of a full-strength impulse wave
  WAVE_HZ: 7,      // wave oscillation speed
  WAVE_K: 0.035,   // spatial ripple frequency along the rope
  FALLOFF: 130,    // px distance falloff from the impact point
  DECAY_MS: 650,   // exponential time decay of a wave
  DEAD_MS: 2600,   // impulses older than this contribute ~nothing and are pruned
};

// Vertical offset (px, +down) of a rope at pixel x. `impulses` = [{x, t0, mag}].
export function ropeOffset(x, W, tMs, impulses, C = ROPE_DEFAULTS, phase = 0) {
  const sag = Math.sin((x / W) * Math.PI) * C.SAG;
  const idle = Math.sin((tMs / 1000) * C.IDLE_HZ * Math.PI * 2 + phase + x * 0.01) * C.IDLE_AMP;
  let wave = 0;
  for (let i = 0; i < impulses.length; i++) {
    const im = impulses[i];
    const age = tMs - im.t0;
    if (age < 0 || age > C.DEAD_MS) continue;
    const d = Math.abs(x - im.x);
    wave += C.WAVE_AMP * im.mag
      * Math.exp(-d / C.FALLOFF)
      * Math.exp(-age / C.DECAY_MS)
      * Math.sin((age / 1000) * C.WAVE_HZ * Math.PI * 2 - d * C.WAVE_K);
  }
  return sag + idle + wave;
}

export function pruneImpulses(impulses, tMs, C = ROPE_DEFAULTS) {
  return impulses.filter((im) => tMs - im.t0 <= C.DEAD_MS);
}
