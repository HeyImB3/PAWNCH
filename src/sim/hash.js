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
  // charCodeAt yields UTF-16 code units (not UTF-8 bytes); that is fine here — both
  // clients hash identically, and we only need cross-client agreement, not byte-portability.
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
