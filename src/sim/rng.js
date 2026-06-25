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
