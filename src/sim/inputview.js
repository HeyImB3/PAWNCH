// Per-frame input latch for fixed-timestep substepping (Phase 1B-C).
//
// A real keypress reports `pressed` true for ONE render frame. When the sim runs
// N sub-ticks in that frame, the edge must reach exactly one tick — otherwise a
// single press becomes N actions (one tap = many punches). Capture the frame's
// pressed edges + held set once from the live input, then hand each sub-tick a
// view: the first sub-tick reports the pressed edges, the rest report none while
// held keys keep reporting isDown. Pure; imports nothing.

// Snapshot a frame's input from a source exposing pressed(a)/isDown(a), for the
// given list of actions the sim cares about. Returns plain arrays (serializable,
// so a future net layer can ship them over the wire unchanged).
export function captureFrame(src, actions) {
  const pressed = [], held = [];
  for (const a of actions) {
    if (src.pressed(a)) pressed.push(a);
    if (src.isDown(a)) held.push(a);
  }
  return { pressed, held };
}

// A per-sub-tick view over a captured frame. `edge` (true only on the first
// sub-tick of the frame) gates whether pressed-edges are visible; isDown always
// reflects the held set.
export function tickView(frame, edge) {
  const pressedSet = edge ? new Set(frame.pressed) : null;
  const heldSet = new Set(frame.held);
  return {
    pressed: (a) => (pressedSet ? pressedSet.has(a) : false),
    isDown: (a) => heldSet.has(a),
  };
}
