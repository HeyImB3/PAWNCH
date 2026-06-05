// Keyboard input with edge detection + a remappable action map.
// Actions are semantic so chess, boxing, and menus share one vocabulary.

export const DEFAULT_BINDINGS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  confirm: ['Enter', 'Space', 'KeyJ'],
  cancel: ['Escape', 'Backspace', 'KeyK'],
  // boxing
  jabL: ['KeyA'],        // left jab
  jabR: ['KeyD'],        // right jab
  hookL: ['KeyQ'],       // left hook
  hookR: ['KeyE'],       // right hook
  dodgeL: ['ArrowLeft'],
  dodgeR: ['ArrowRight'],
  duck: ['ArrowDown'],
  block: ['ShiftLeft', 'ShiftRight', 'KeyS'],
  // player 2 (local multiplayer boxing) — separate cluster
  p2_jabL: ['KeyF'], p2_jabR: ['KeyH'], p2_hookL: ['KeyT'], p2_hookR: ['KeyU'],
  p2_dodgeL: ['KeyG'], p2_dodgeR: ['KeyJ'], p2_duck: ['KeyB'], p2_block: ['KeyV'],
};

class Input {
  constructor() {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.down = new Set();      // currently held codes
    this.pressedQ = new Set();  // codes pressed since last poll
    this.anyKey = false;
    this.captureNext = null;    // callback to grab the next raw keydown (remap UI)
    // pointer (mouse/touch) state in canvas space
    this.mouse = { x: 0, y: 0, over: false };
    this.mDown = false;         // held
    this.mPressed = false;      // press edge (this frame)
    this.mReleased = false;     // release edge (this frame)
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
      // remap capture: hand the raw code to a listener and swallow it
      if (this.captureNext) { const cb = this.captureNext; this.captureNext = null; cb(e.code); return; }
      if (!this.down.has(e.code)) this.pressedQ.add(e.code);
      this.down.add(e.code);
      this.anyKey = true;
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.mDown = false; });
  }

  // wire pointer events from the game canvas (mapped into the 512x448 space)
  attachPointer(canvas, viewW, viewH) {
    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) / r.width * viewW;
      this.mouse.y = (e.clientY - r.top) / r.height * viewH;
    };
    canvas.addEventListener('pointermove', (e) => { toCanvas(e); this.mouse.over = true; });
    canvas.addEventListener('pointerdown', (e) => { toCanvas(e); this.mDown = true; this.mPressed = true; this.anyKey = true; });
    window.addEventListener('pointerup', (e) => { toCanvas(e); this.mDown = false; this.mReleased = true; });
    canvas.addEventListener('pointerleave', () => { this.mouse.over = false; });
  }
  // capture the next raw keydown (for rebinding). cb(code) called once.
  beginCapture(cb) { this.captureNext = cb; }

  setBindings(b) { this.bindings = b; }
  _codes(action) { return this.bindings[action] || []; }
  // held this frame
  isDown(action) { return this._codes(action).some((c) => this.down.has(c)); }
  // pressed (edge) this frame — consume via endFrame()
  pressed(action) { return this._codes(action).some((c) => this.pressedQ.has(c)); }
  pressedCode(code) { return this.pressedQ.has(code); }
  consumeAnyKey() { const a = this.anyKey; this.anyKey = false; return a; }
  endFrame() { this.pressedQ.clear(); this.mPressed = false; this.mReleased = false; }
}

export const input = new Input();
