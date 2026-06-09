# Fighter Art Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PAWNCH's blocky procedural boxer with a per-fighter, human-anatomy NES *Punch-Out!!*-style sprite system (chess motifs, faces, unique special poses) across the fight, walk, round-break, match-end, and Story select screens.

**Architecture:** A new self-contained module `src/fighter.js` renders each fighter to a small offscreen buffer (curved silhouette → bold dark-outline dilation → face/FX), then blits it pixel-crisp. Per-fighter identity is a plain `look` data object on each opponent in `opponents.js`. Render sizes/colors live in `config.js`. The boxing/walk/break/end/story states swap `boxer()`/`portrait()` for `drawFighter()`/`drawPortrait()`. Render-only — the sim, AI, difficulty, and roster data are untouched.

**Tech Stack:** Vanilla ES modules + Canvas 2D (no build, no deps). Verification is manual via `npm run dev` (python http.server) + the browser console + `window.PAWNCH`, per the repo's documented workflow.

**Reference implementation:** `.superpowers/brainstorm/mockups/engine.js` is the validated prototype renderer. Tasks port it into `src/fighter.js` with named adaptations. The design spec is `docs/superpowers/specs/2026-06-09-fighter-art-redesign-design.md`.

**Branch:** Work on `fighter-art-redesign` (already created; the spec is committed there).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/fighter.js` | The renderer: `drawFighter`, `drawPortrait`, part libraries (builds, headgear, faces, sash, FX), pose table, offscreen+outline pipeline | **Create** (port of `engine.js`) |
| `src/opponents.js` | Per-fighter `look` data + `HERO_LOOK` + `DEFAULT_LOOK`; attach `look` to each `OPPONENTS` entry | **Modify** |
| `src/config.js` | `FIGHTER` block — in-fight sizes, feet baseline, outline color | **Modify** |
| `src/states/boxing.js` | Use `drawFighter` for enemy (front) + player (back); map sim pose→render pose (jab≠hook, special frames) | **Modify** |
| `src/states/walk.js` | `drawFighter` walk pose for both fighters | **Modify** |
| `src/states/roundbreak.js` | `drawFighter` idle for both fighters | **Modify** |
| `src/states/matchend.js` | `drawFighter` for the winner | **Modify** |
| `src/states/story.js` | `drawPortrait` for the select-screen face tiles | **Modify** |
| `src/gfx.js` | Retire `boxer()`/`portrait()` (or thin wrappers) after migration | **Modify** (Phase 5) |
| `CLAUDE.md` | GR5 wording: procedural fighter art is first-class, still zero-images | **Modify** (Phase 5) |

**Verification note (applies to every task):** Start the dev server with `npm run dev` (serves at http://localhost:5173) — or it may already be running on another port. After a change, hard-reload the page, then **open the browser console and confirm there are NO `[PAWNCH] frame error: …` lines and no uncaught module/syntax errors** before doing the visual check. `window.PAWNCH` (live Game+match) and `window.CHESS` are exposed for poking. There is no test runner — visual confirmation in the running game is the verification.

---

## Phase 1 — The renderer module

### Task 1: Create `src/fighter.js` from the validated prototype

**Files:**
- Create: `src/fighter.js` (port of `.superpowers/brainstorm/mockups/engine.js`)

- [ ] **Step 1: Copy the reference engine into src/**

```bash
cp .superpowers/brainstorm/mockups/engine.js src/fighter.js
```

- [ ] **Step 2: Replace the module header for palette/config compliance (Golden Rules 2 & 3)**

At the TOP of `src/fighter.js`, replace the existing first lines:

```js
export const OUT='#0a0a12', GOLD='#ffd24a';
export const IW=150, IH=216, CX=75, FEET=190;

export function shade(hex,amt){ const n=parseInt(hex.slice(1),16); const c=v=>Math.max(0,Math.min(255,v));
  return '#'+((1<<24)+(c(((n>>16)&255)+amt)<<16)+(c(((n>>8)&255)+amt)<<8)+c((n&255)+amt)).toString(16).slice(1); }
```

with:

```js
// Procedural human-anatomy fighter renderer (NES Punch-Out style). Draws each
// fighter to an offscreen buffer, wraps it in a bold dark outline, and blits it
// pixel-crisp. Per-fighter identity is a `look` data object (see opponents.js).
import { PAL, FIGHTER } from './config.js';
import { shade } from './gfx.js';

const GOLD = PAL.gold;
const OUT = FIGHTER.OUTLINE;
const IW = 150, IH = 216, CX = 75, FEET = 190;   // offscreen geometry (internal px)
```

- [ ] **Step 3: Delete the prototype-only `ROSTER` export**

Delete the entire `export const ROSTER=[ … ];` array at the bottom of the file (the look data moves to `opponents.js` in Task 6; the renderer must not own roster data).

- [ ] **Step 4: Change `render` from exported to internal and keep `geom` available**

Find `export function render(look,pose,step){` and remove the `export` keyword (it becomes an internal helper used by `drawFighter`/`drawPortrait`). Leave its body unchanged for now (poses/back-view/blit are added in Tasks 3–5).

- [ ] **Step 5: Verify the module loads with no syntax error**

Run: `npm run dev` (if not already running), open http://localhost:5173, open the console.
Expected: the title screen loads; **no** `Uncaught SyntaxError` / module-load error in the console. (The module isn't called yet; this only confirms it parses and imports `PAL`/`FIGHTER`/`shade` cleanly — those land in Task 2, so do Task 2 before this check if `FIGHTER` is undefined.)

- [ ] **Step 6: Commit**

```bash
git add src/fighter.js
git commit -m "feat(fighter): scaffold procedural fighter renderer from prototype"
```

---

### Task 2: Add the `FIGHTER` render config

**Files:**
- Modify: `src/config.js` (append a new export near `BOX`)

- [ ] **Step 1: Add the FIGHTER block**

Append to `src/config.js`:

```js
// Procedural fighter rendering (see src/fighter.js). Sizes are buffer→screen
// blit scales for the new human sprites. STARTING values from the "Medium" mock;
// fine-tune against the live HUD in the polish phase.
export const FIGHTER = {
  SIZE: {
    enemy:  1.12,   // opponent in a fight (front)
    player: 1.37,   // you (back, foreground — reads bigger/closer)
    walk:   0.78,   // walk-to-the-board intro
    break:  0.90,   // round-break screen
    end:    1.05,   // match-end winner
  },
  ENEMY_FEET_Y: 304,   // opponent feet baseline in the 512×448 boxing scene
  PLAYER_FEET_Y: 452,  // player feet baseline (slightly off-bottom, foreground)
  OUTLINE: '#0a0a12',  // bold dark outline color (near-black)
};
```

- [ ] **Step 2: Verify**

Reload the page; console clean. In the console run `PAWNCH` is fine; specifically confirm no error from `fighter.js` importing `FIGHTER` (the import in Task 1 now resolves).

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "feat(config): add FIGHTER render sizes + outline"
```

---

### Task 3: Expand the pose table (jab≠hook, windup tell, duck/hurt/stagger/down/walk)

**Files:**
- Modify: `src/fighter.js` (replace `poseFor`)

The prototype `poseFor` only knows idle/guard/jab/hook/special. The game needs a `windup` tell (arm cocked back), distinct jab vs hook driven by `info.kind`, plus `duck`, `hurt`, `stagger`, `down`, `walk`. The render pose + extra info come from `boxing.js` (Task 7).

- [ ] **Step 1: Replace `poseFor` with the expanded version**

Replace the entire `function poseFor(g,pose,step,look){ … }` with:

```js
// pose: idle|guard|windup|punch|special|duck|hurt|stagger|down|walk
// info (optional): { arm:'L'|'R', kind:'jab'|'hook'|'signature', target:'high'|'low' }
function poseFor(g,pose,step,look,info){
  const shY=g.yShoulder+3, shL=CX-g.shoulderHalf*0.8, shR=CX+g.shoulderHalf*0.8;
  const chin=g.yHeadC+g.headRy*0.6, bob=Math.sin(step*0.5)*(look.bob??1.2);
  const arm=info?.arm||'R', kind=info?.kind||'jab', high=info?.target!=='low';
  const yHit=high?chin+6:chin+16;                          // HIGH = head line, LOW = body line
  let L={sh:[shL,shY], el:[shL-3,shY+20], gl:[CX-13,chin+12+bob]};
  let R={sh:[shR,shY], el:[shR+3,shY+20], gl:[CX+13,chin+12-bob]};
  let leanX=0, sink=0, fx=null, label=pose.toUpperCase(), expose=false;
  // helper: cock one arm back/out (the windup tell), or extend it (the punch)
  const guardOff=(A)=> A==='L' ? (L.gl=[CX-9,chin+2]) : (R.gl=[CX+9,chin+2]);
  if(pose==='guard'){ L.gl=[CX-9,chin+2]; R.gl=[CX+9,chin+2]; }
  else if(pose==='windup'){
    label='WINDUP'; guardOff(arm==='L'?'R':'L');
    if(kind==='hook'){ if(arm==='L'){ L.gl=[CX-17,shY+10]; L.el=[shL-10,shY+12]; } else { R.gl=[CX+17,shY+10]; R.el=[shR+10,shY+12]; } leanX = arm==='L'?-2:2; }
    else { if(arm==='L'){ L.gl=[CX-15,yHit-4]; } else { R.gl=[CX+15,yHit-4]; } } // jab/signature: pull straight back
  }
  else if(pose==='punch'){
    label=kind==='hook'?'HOOK':'JAB'; guardOff(arm==='L'?'R':'L');
    if(kind==='hook'){ if(arm==='L'){ L.gl=[CX+6,chin-6]; L.el=[shL-10,shY+12]; } else { R.gl=[CX-6,chin-6]; R.el=[shR+10,shY+12]; } leanX = arm==='L'?-4:4; }
    else { if(arm==='L'){ L.gl=[CX-4,yHit]; L.el=[shL-5,shY+15]; } else { R.gl=[CX+4,yHit]; R.el=[shR+5,shY+15]; } }
  }
  else if(pose==='special'){
    const sp=look.special||{}; label=sp.name||'SPECIAL'; fx=sp.fx; const f=sp.frame;
    const HI=g.yHeadC-g.headRy-6;
    if(f==='bothLow'){ L.gl=[CX-7,chin+14]; R.gl=[CX+7,chin+14]; L.el=[shL-2,shY+16]; R.el=[shR+2,shY+16]; sink=2; }
    else if(f==='bothHighFeint'){ L.gl=[CX-9,chin-2]; R.gl=[CX+9,chin-2]; }
    else if(f==='overhead'){ L.gl=[CX-18,HI]; R.gl=[CX+18,HI]; L.el=[shL-6,shY+6]; R.el=[shR+6,shY+6]; sink=5; }
    else if(f==='maul'){ L.gl=[CX-5,HI+2]; R.gl=[CX+5,HI+2]; L.el=[shL-4,shY+8]; R.el=[shR+4,shY+8]; sink=4; }
    else if(f==='crucifix'){ L.gl=[CX-30,shY+2]; R.gl=[CX+30,shY+2]; L.el=[shL-12,shY+4]; R.el=[shR+12,shY+4]; expose=true; }
    else if(f==='oneLoadedLow'){ R.gl=[CX-8,g.yWaist+4]; R.el=[shR+8,shY+18]; L.gl=[CX-9,chin]; leanX=4; }
    else if(f==='oneLoadedHigh'){ R.gl=[shR+14,shY+2]; R.el=[shR+12,shY+12]; L.gl=[CX-4,chin+16]; leanX=4; }
    else if(f==='counter'){ L.gl=[CX-9,g.yWaist]; R.gl=[CX+9,g.yWaist]; L.el=[shL-3,shY+16]; R.el=[shR+3,shY+16]; sink=2; }
    else if(f==='uppercut'){ R.gl=[CX+4,g.yWaist+6]; R.el=[shR+4,shY+20]; L.gl=[CX-9,chin]; sink=3; }
  }
  else if(pose==='duck'){ sink=8; L.gl=[CX-9,chin+4]; R.gl=[CX+9,chin+4]; label='DUCK'; }
  else if(pose==='hurt'){ leanX=2; L.gl=[CX-11,chin+10]; R.gl=[CX+11,chin+10]; label='HURT'; }
  else if(pose==='stagger'){ leanX=-2; L.gl=[CX-13,chin+14]; R.gl=[CX+13,chin+14]; label='STAGGER'; }
  else if(pose==='down'){ label='DOWN'; }   // down handled specially in render (see Task 4 Step 3)
  else if(pose==='walk'){ const sw=Math.sin(step)*3; L.gl=[CX-12,chin+10+sw]; R.gl=[CX+12,chin+10-sw]; label='WALK'; }
  return {L,R,leanX,sink,fx,label,expose};
}
```

- [ ] **Step 2: Verify the module still parses**

Reload; console clean (renderer still isn't drawn until Task 7, so this is a parse/sanity check only).

- [ ] **Step 3: Commit**

```bash
git add src/fighter.js
git commit -m "feat(fighter): full pose table (jab/hook/windup/duck/hurt/stagger/down/walk)"
```

---

### Task 4: Add `drawFighter` (blit wrapper) + back-view (`facing -1`) + a downed pose

**Files:**
- Modify: `src/fighter.js` (extend `render`, add `drawHeadBack`, add `drawFighter`)

- [ ] **Step 1: Give `render` a `facing` + `info` param and branch head/face for the back view**

Replace the `render` function with:

```js
function render(look,pose,step,facing,info){
  const [art,ctx]=newCv(IW,IH); const g=geom(look); const C=colors(look.hue);
  const pp=poseFor(g,pose,step,look,info);
  look._forge = pp.fx==='forge';
  const back = facing===-1;
  const glove = look.gloveTint==='orange' ? {g:C.body,hi:C.bodyHi,sh:C.bodySh} : {g:'#ededf2',hi:'#ffffff',sh:'#b9b9c6'};
  if(pose==='down'){ drawDown(ctx,g,C,glove); }
  else {
    drawLegs(ctx,g,C);
    ctx.save(); ctx.translate(pp.leanX,pp.sink);
    drawArm(ctx,pp.R,C.body,glove,g);
    drawTorso(ctx,g,C);
    if(!back){ drawChest(ctx,g,look,C); drawSash(ctx,g,look,C); }
    if(look.towers) drawTowers(ctx,g,C);
    if(back){ drawHeadBack(ctx,g,C,look); }
    else { drawHead(ctx,g,C,look); (HAT[look.headgear]||HAT.none)(ctx,g,C); }
    drawArm(ctx,pp.L,C.body,glove,g);
    ctx.restore();
  }
  const lined=outlineCanvas(art); const lctx=lined.getContext('2d');
  if(!back && pose!=='down'){ lctx.save(); lctx.translate(pp.leanX,pp.sink); drawFace(lctx,g,C,look); lctx.restore(); }
  if(pp.fx) drawFX(lctx,g,C,pp,step);
  return {lined,label:pp.label,geom:g};
}
```

- [ ] **Step 2: Add `drawHeadBack` (back of the head — all hair, no face)**

Add near `drawHead`:

```js
function drawHeadBack(ctx,g,C,look){
  ctx.fillStyle=C.skin; ctx.fillRect(CX-g.neckW/2,g.yNeck-2,g.neckW,8);          // neck nape
  ctx.fillStyle=look.hairCol||'#241813';
  ctx.beginPath(); ctx.ellipse(CX,g.yHeadC,g.headRx,g.headRy,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=shade(look.hairCol||'#241813',-22);                              // right-side shadow
  ctx.save(); ctx.beginPath(); ctx.ellipse(CX,g.yHeadC,g.headRx,g.headRy,0,0,Math.PI*2); ctx.clip();
  ctx.fillRect(CX+g.headRx*0.3,g.yHeadC-g.headRy,g.headRx,g.headRy*2); ctx.restore();
  ctx.fillStyle=shade(look.hairCol||'#241813',16);                               // crisp nape fade line
  ctx.fillRect(CX-g.headRx*0.7,g.yHeadC+g.headRy*0.5,g.headRx*1.4,1.5);
}
```

- [ ] **Step 3: Add `drawDown` (sprawled on the canvas)**

Add near `drawLegs`:

```js
function drawDown(ctx,g,C,glove){
  const y=g.yFeet-6;
  ctx.fillStyle='rgba(0,0,0,0.34)'; ctx.fillRect(CX-34,y+6,68,5);
  ctx.strokeStyle=C.body; ctx.lineCap='round'; ctx.lineWidth=g.thighHalf*2;       // legs out flat
  ctx.beginPath(); ctx.moveTo(CX-6,y); ctx.lineTo(CX-30,y+2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX+6,y); ctx.lineTo(CX+30,y-2); ctx.stroke();
  ctx.fillStyle=C.body; ctx.beginPath(); ctx.ellipse(CX,y-6,g.shoulderHalf*0.9,7,0,0,Math.PI*2); ctx.fill(); // torso
  ctx.fillStyle=C.trim; ctx.fillRect(CX-10,y-2,20,5);                              // trunks
  ctx.fillStyle=C.skin; ctx.beginPath(); ctx.ellipse(CX-g.shoulderHalf*0.9-6,y-8,g.headRx,g.headRy*0.8,0,0,Math.PI*2); ctx.fill(); // head to the side
  ctx.fillStyle=glove.g; ctx.beginPath(); ctx.arc(CX+g.shoulderHalf*0.9+6,y-2,g.gloveR,0,Math.PI*2); ctx.fill();
}
```

- [ ] **Step 4: Add the public `drawFighter` blit wrapper at the bottom of the file**

```js
// Public API: render `look` in `pose` and blit it pixel-crisp.
// x = horizontal center; y = FEET baseline (sprite/hat grow upward). size = blit scale.
// facing: 1 = front (opponents), -1 = back (player). info = { arm, kind, target } (optional).
export function drawFighter(ctx, x, y, size, look, pose='idle', facing=1, step=0, info=null){
  const { lined } = render(look, pose, step, facing, info);
  const dx = Math.round(x - CX*size), dy = Math.round(y - FEET*size);
  ctx.drawImage(lined, dx, dy, Math.round(IW*size), Math.round(IH*size));
}
```

- [ ] **Step 5: Verify the module parses**

Reload; console clean. (Still not invoked in-game; this is a parse/sanity gate.)

- [ ] **Step 6: Commit**

```bash
git add src/fighter.js
git commit -m "feat(fighter): drawFighter blit + back-view + downed pose"
```

---

### Task 5: Add `drawPortrait` (select-screen face tile)

**Files:**
- Modify: `src/fighter.js` (add `drawPortrait`)

- [ ] **Step 1: Add the portrait renderer**

`drawPortrait` renders a head-&-shoulders bust by drawing the fighter in `idle`, then blitting the **upper region** of the buffer into the cell. `silhouette:true` recolors the bust all-dark (unbeaten fighter). Add at the bottom of `src/fighter.js`:

```js
// Head-&-shoulders bust for the Story select grid. Fills the cell (x,y,w,h).
// silhouette:true => anonymous all-dark bust (a fighter you haven't beaten).
export function drawPortrait(ctx, x, y, w, h, look, { silhouette=false, t=0 } = {}){
  const { lined, geom: g } = render(look, 'idle', t*3, 1, null);
  // studio backdrop
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  const bg=ctx.createLinearGradient(x,y,x,y+h);
  bg.addColorStop(0, silhouette ? '#1b2344' : mixHex(look.hue.body,'#0a1024',0.55));
  bg.addColorStop(1, '#070a16'); ctx.fillStyle=bg; ctx.fillRect(x,y,w,h);
  // frame the bust: top of hat .. mid-chest, centered, filling the cell width
  const top = g.yHeadTop - 8, bottom = g.yShoulder + 26;
  const srcH = bottom - top, srcW = IW;
  const scale = Math.min(w/srcW, h/srcH) * 1.15;
  const dw = IW*scale, dh = IH*scale;
  const dx = x + w/2 - CX*scale, dy = y + h*0.12 - top*scale;
  if(silhouette){
    // draw an all-dark silhouette of the bust
    const [sil,sc]=newCv(IW,IH); sc.drawImage(lined,0,0);
    sc.globalCompositeOperation='source-in'; sc.fillStyle='#0a1022'; sc.fillRect(0,0,IW,IH);
    ctx.drawImage(sil, dx, dy, dw, dh);
    ctx.fillStyle='rgba(140,165,225,0.10)'; ctx.fillRect(x,y,w,2);
  } else {
    ctx.drawImage(lined, dx, dy, dw, dh);
  }
  ctx.restore();
}
function mixHex(a,b,t){ const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);
  const r=Math.round((A>>16&255)*(1-t)+(B>>16&255)*t), g=Math.round((A>>8&255)*(1-t)+(B>>8&255)*t), c=Math.round((A&255)*(1-t)+(B&255)*t);
  return '#'+((1<<24)+(r<<16)+(g<<8)+c).toString(16).slice(1); }
```

- [ ] **Step 2: Verify parse**

Reload; console clean. (`newCv` is already defined in the module from the port; confirm no "newCv is not defined".)

- [ ] **Step 3: Commit**

```bash
git add src/fighter.js
git commit -m "feat(fighter): drawPortrait for Story select face tiles"
```

---

## Phase 2 — Per-fighter look data

### Task 6: Attach a `look` to every opponent + hero/default

**Files:**
- Modify: `src/opponents.js`

- [ ] **Step 1: Add the `LOOKS` table + `HERO_LOOK` + `DEFAULT_LOOK`**

Add to `src/opponents.js` (after the `HUE` map at the bottom). Each entry is keyed by roster index. `chest` is the build proportion (numeric); `emblem` is the chest motif (string) — keep them separate.

```js
// Per-fighter visual `look` (consumed by src/fighter.js). Build fields are
// proportion multipliers on the neutral skeleton (default 1). `chest` is the
// build width; `emblem` is the chest MOTIF (distinct keys — do not merge).
const LOOKS = {
  0:{ hgt:0.84, head:1.12, shoulder:0.84, chest:1.0, waist:1.2, hip:1.12, glove:1.28, belly:1, bob:1.6,
      headgear:'pawnDomeShort', emblem:'pawnGlyph',
      special:{name:'PAWN STORM',frame:'bothLow',fx:'pips'}, face:{brows:'hopeful',mouth:'grin',cheekDab:true} },
  1:{ hgt:0.93, shoulder:0.9, waist:0.85,
      headgear:'pawnDomeTall', sash:{dir:'LR'},
      special:{name:'GAMBIT JAB',frame:'oneLoadedHigh',fx:'spark'}, face:{brows:'cocked',mouth:'smirk'} },
  2:{ hgt:0.95, shoulder:1.12, chest:1.08, waist:1.0,
      headgear:'rookChimney', emblem:'brick',
      special:{name:'ROOK ROLL',frame:'bothLow',fx:'streak'}, face:{brows:'angryV',mouth:'grin',hairCol:'#7a0c18'} },
  3:{ hgt:0.97, shoulder:0.9, waist:0.82, chest:1.0,
      headgear:'knightVisor', emblem:'fork', hair:'none',
      special:{name:'FORK HOOK',frame:'bothHighFeint',fx:'spark'}, face:{brows:'cocked',mouth:'smirk'} },
  4:{ hgt:1.03, shoulder:1.05, waist:0.85,
      headgear:'mitre', sash:{dir:'RL'},
      special:{name:'DIAGONAL DRIVE',frame:'oneLoadedLow',fx:'diag'}, face:{brows:'flatHeavy',mouth:'flat'} },
  5:{ hgt:1.06, shoulder:1.12, chest:1.05,
      headgear:'queenCoronet', sash:{dir:'LR',wide:true},
      special:{name:'QUEEN QUAKE',frame:'overhead',fx:'quake'}, face:{brows:'angryV',mouth:'lipstick',hooded:true,cheekMark:true} },
  6:{ hgt:0.98, head:0.92, shoulder:1.5, chest:1.25, waist:0.9, thigh:1.18, bob:0.2,
      headgear:'rookStub', emblem:'rivets',
      special:{name:'ZUGZWANG SLAM',frame:'maul',fx:'forge'}, face:{brows:'bar',mouth:'flat',eyeCol:'#2a2a30'} },
  7:{ hgt:1.06, shoulder:1.0, waist:0.78, bob:1.4,
      headgear:'none', hair:'stormMane', sash:{dir:'RL',pips:3},
      special:{name:'SAC ATTACK',frame:'crucifix',fx:'bolt'}, face:{brows:'angryV',mouth:'smirk',widowPeak:true,catchlight:true,stubble:true} },
  8:{ hgt:1.12, shoulder:1.15, chest:1.05, waist:0.95, bob:0.25,
      headgear:'kingCrown', hair:'sideSwept', hairCol:'#7a5836', heavyJaw:true, sash:{dir:'LR',stud:true},
      special:{name:'ENDGAME CRUSH',frame:'counter',fx:'aura'}, face:{brows:'flatHeavy',mouth:'smirk',hooded:true,stubble:true} },
  9:{ hgt:1.18, shoulder:1.2, chest:1.1, waist:0.9, towers:true, gloveTint:'orange',
      headgear:'amalgam', hair:'none', emblem:'kingcross', sash:{dir:'LR',stud:true},
      special:{name:'CHECKMATE BLOW',frame:'oneLoadedHigh',fx:'streak'}, face:{brows:'bar',mouth:'flat',glint:true} },
};

// The player (drawn back-view in a fight, front on win screens). No chess gimmick.
export const HERO_LOOK = { hue: HUE.player, hgt:1.06, shoulder:1.05, waist:0.8,
  headgear:'none', special:{name:'UPPERCUT',frame:'uppercut'}, face:{brows:'hopeful',mouth:'grin'} };

// Fallback look for PVP/online enemies (no Story `look`): a plain red boxer.
export const DEFAULT_LOOK = { hue: HUE.red, hgt:1.0, shoulder:1.0, waist:1.0,
  headgear:'none', special:{name:'HAYMAKER',frame:'oneLoadedHigh',fx:'streak'}, face:{brows:'flat',mouth:'flat'} };
```

- [ ] **Step 2: Attach `look` (with resolved hue) to each `OPPONENTS` entry**

In `src/opponents.js`, change the `OPPONENTS` map to merge in the look + its palette:

```js
export const OPPONENTS = ROSTER.map((o, i) => ({
  id: i,
  index: i,
  name: o.name,
  elo: o.elo,
  tag: o.tag,
  hue: o.hue,
  boxing: boxingFromDifficulty(o.d, o.special),
  look: { ...(LOOKS[i] || {}), hue: HUE[o.hue] || HUE.red },   // resolved palette for the renderer
}));
```

- [ ] **Step 3: Verify**

Reload; console clean. In the console: `PAWNCH` then check the data exists — run `import('./src/opponents.js').then(m=>console.log(m.OPPONENTS[4].look.headgear))` should log `mitre`; `m.HERO_LOOK` and `m.DEFAULT_LOOK` defined.

- [ ] **Step 4: Commit**

```bash
git add src/opponents.js
git commit -m "feat(opponents): per-fighter look data + hero/default looks"
```

---

## Phase 3 — Boxing integration

### Task 7: Render the new fighters in the fight (jab≠hook, special frames, sizes)

**Files:**
- Modify: `src/states/boxing.js` (imports, the two `boxer()` calls in `draw()`, add a `mapPose` helper)

- [ ] **Step 1: Swap the import**

In `src/states/boxing.js`, change:

```js
import { text, textWidth, panel, ring, boxer, barH } from '../gfx.js';
```
to:
```js
import { text, textWidth, panel, ring, barH } from '../gfx.js';
import { drawFighter } from '../fighter.js';
import { FIGHTER } from '../config.js';
import { OPPONENTS, HUE, HERO_LOOK, DEFAULT_LOOK } from '../opponents.js';
```
(The existing `import { OPPONENTS, HUE } from '../opponents.js';` line is replaced by the line above — do not import `OPPONENTS/HUE` twice.)

- [ ] **Step 2: Resolve the looks in `enter()`**

In `BoxingState.enter()`, after `this.oppHue = …`, add:

```js
this.enemyLook = (m.mode === 'story' && m.opponent?.look) ? m.opponent.look : DEFAULT_LOOK;
this.playerLook = HERO_LOOK;
```

- [ ] **Step 3: Add the sim→render pose mapper (module-level function at the bottom of the file)**

```js
// Map a BoxingMatch fighter's sim state to a fighter.js render pose + info.
// This is where jab finally renders differently from hook, and where a boss
// SPECIAL / signature wind-up shows the fighter's unique special pose.
function mapPose(fr) {
  const p = fr.pose;
  const info = { arm: fr.arm || 'R', kind: fr.kind || 'jab', target: fr.target || 'high' };
  if (p === 'windup') return (fr.special || fr.kind === 'signature') ? { pose: 'special' } : { pose: 'windup', info };
  if (p === 'punch')  return { pose: 'punch', info };
  if (p === 'stance') return { pose: 'special' };          // counter-stance boss move
  if (p === 'recover') return { pose: 'idle' };
  if (p === 'dodgeL' || p === 'dodgeR' || p === 'duck') return { pose: 'duck' };
  if (p === 'hurt')  return { pose: 'hurt' };
  if (p === 'stun')  return { pose: 'stagger' };
  if (p === 'down' || p === 'ko') return { pose: 'down' };
  if (p === 'guard') return { pose: 'guard' };
  return { pose: 'idle' };
}
```

- [ ] **Step 4: Replace the enemy draw**

In `draw()`, replace the enemy block. Find:

```js
    const ex = W / 2 + e.offset, ey = 150 + e.duckY;
```
…through the existing `boxer(ctx, ex, ey, 5.2, eHue, eMap[e.pose] || 'idle', 1, this.t * 4);` line. Replace the whole enemy render (keep the `eFlaring`/`eHue` flicker logic and the `ctx.globalAlpha` hit-flash) with:

```js
    const ex = W / 2 + e.offset;
    const eFlaring = (e.special || e.kind === 'signature') && (e.pose === 'windup' || e.pose === 'stance') && Math.floor(this.t * 18) % 2 === 0;
    let eLook = this.enemyLook;
    if (e.pose === 'stun') eLook = Math.floor(this.t * 12) % 2 ? { ...this.enemyLook, hue: this.redHue } : this.enemyLook;
    else if (eFlaring) eLook = { ...this.enemyLook, hue: this.flareHue };
    if (e.flash > 0 && Math.floor(this.t * 30) % 2) ctx.globalAlpha = 0.6;
    const em = mapPose(e);
    drawFighter(ctx, ex, FIGHTER.ENEMY_FEET_Y, FIGHTER.SIZE.enemy, eLook, em.pose, 1, this.t * 4, em.info);
    ctx.globalAlpha = 1;
    if (e.pose === 'stun') this._stunFx(ctx, ex, FIGHTER.ENEMY_FEET_Y - 150);
```

(Delete the now-unused `eMap` object and the old `ey`/`e.duckY` usage in this block. The `_tell`/`_stanceWarn` calls just below stay unchanged.)

- [ ] **Step 5: Replace the player draw**

Find the player block ending in `boxer(ctx, pxs, pys, 6.5, pHue, pMap[p.pose] || 'idle', -1, this.t * 4);` and replace (keeping the star-glow + hit-flash) with:

```js
    const pxs = W / 2 + p.offset;
    let pLook = (p.pose === 'stun' && Math.floor(this.t * 12) % 2) ? { ...this.playerLook, hue: this.redHue } : this.playerLook;
    if (p.starFx > 0) {
      ctx.globalAlpha = 0.5 * (p.starFx / 320);
      ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(pxs, FIGHTER.PLAYER_FEET_Y - 150, 70, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (p.flash > 0 && Math.floor(this.t * 30) % 2) ctx.globalAlpha = 0.6;
    const pm = mapPose(p);
    drawFighter(ctx, pxs, FIGHTER.PLAYER_FEET_Y, FIGHTER.SIZE.player, pLook, pm.pose, -1, this.t * 4, pm.info);
    ctx.globalAlpha = 1;
    if (p.pose === 'stun') this._stunFx(ctx, pxs, FIGHTER.PLAYER_FEET_Y - 150);
```

(Delete the now-unused `pMap` object. `HUE.player` is no longer needed here — the hero look carries its palette.)

- [ ] **Step 6: Verify in a real fight**

`npm run dev` → Story Mode → fight #1 (Patty). Confirm:
- Console has no `[PAWNCH] frame error`.
- The opponent is the new human Patty (pawn dome, round, oversized mitts), clearly bigger than before, hat **below** the round/timer.
- A **jab looks different from a hook** (jab = straight; hook = wider + body lean).
- During PAWN STORM the **special pose** shows (both mitts low + pawn pips).
- The player (foreground, from behind) renders; knockdowns show the downed pose; a parry shows the stagger.
- Spot-check a tall-hat fighter (Bishop/Champion via a later fight or `window.PAWNCH`) for HUD clearance, and Iron for width.

- [ ] **Step 7: Commit**

```bash
git add src/states/boxing.js
git commit -m "feat(boxing): render new fighters; map sim pose to jab/hook/special"
```

---

## Phase 4 — Other surfaces

### Task 8: Walk-to-the-board intro

**Files:**
- Modify: `src/states/walk.js`

- [ ] **Step 1: Swap imports + draws**

Change `import { text, ring, chessTable, boxer, piece, pieceSprite } from '../gfx.js';` to drop `boxer` and add:
```js
import { text, ring, chessTable, piece, pieceSprite } from '../gfx.js';
import { drawFighter } from '../fighter.js';
import { FIGHTER } from '../config.js';
import { HUE, HERO_LOOK } from '../opponents.js';
```
In `enter()`, add `this.oppLook = (m.mode==='story' && m.opponent?.look) ? m.opponent.look : { ...HERO_LOOK, hue: HUE.red };`.
In `draw()`, replace the two `boxer(...)` calls:
```js
    drawFighter(ctx, px, py, FIGHTER.SIZE.walk, HERO_LOOK, p < 0.98 ? 'walk' : 'idle', 1, step);
    drawFighter(ctx, ox, py, FIGHTER.SIZE.walk, this.oppLook, p < 0.98 ? 'walk' : 'idle', 1, step + 1.5);
```
(Drop the old `py - 6` offset; `drawFighter`'s `y` is the feet baseline — keep both at `py`.)

- [ ] **Step 2: Verify**

Start any Story fight → the walk intro shows both new fighters strolling (walk pose) to the table; console clean.

- [ ] **Step 3: Commit**

```bash
git add src/states/walk.js
git commit -m "feat(walk): new fighters in the walk-to-board intro"
```

---

### Task 9: Round-break screen

**Files:**
- Modify: `src/states/roundbreak.js`

- [ ] **Step 1: Swap imports + draws**

Change `import { text, panel, ring, boxer, barH } from '../gfx.js';` → drop `boxer`; add:
```js
import { drawFighter } from '../fighter.js';
import { FIGHTER } from '../config.js';
import { HUE, HERO_LOOK } from '../opponents.js';
```
In `enter()`, add `this.oppLook = (this.m.mode==='story' && this.m.opponent?.look) ? this.m.opponent.look : { ...HERO_LOOK, hue: HUE.red };`.
Replace the two `boxer(...)` calls (the ones at `110, H-60` and `W-110, H-60`):
```js
    drawFighter(ctx, 110, H - 34, FIGHTER.SIZE.break, HERO_LOOK, 'idle', 1, this.t * 2);
    drawFighter(ctx, W - 110, H - 34, FIGHTER.SIZE.break, this.oppLook, 'idle', 1, this.t * 2 + 1);
```
(Old `y = H-60` was a chest anchor; `drawFighter` uses a feet baseline, so use `H-34` to sit them similarly. Tune in Phase 5 if needed.)

- [ ] **Step 2: Verify**

Let a round time out (or use the dev skip combo `B`+`3` held 7s) to reach the round-break screen; both fighters render; console clean.

- [ ] **Step 3: Commit**

```bash
git add src/states/roundbreak.js
git commit -m "feat(roundbreak): new fighters on the round-break screen"
```

---

### Task 10: Match-end winner

**Files:**
- Modify: `src/states/matchend.js`

- [ ] **Step 1: Swap imports + the winner draw**

Change `import { text, panel, boxer, logo } from '../gfx.js';` → drop `boxer`; add:
```js
import { drawFighter } from '../fighter.js';
import { FIGHTER } from '../config.js';
import { OPPONENTS, HUE, HERO_LOOK } from '../opponents.js';
```
Replace `boxer(ctx, W / 2, 198, 5, hue, this.isDraw ? 'idle' : 'guard', 1, this.t * 6);` with:
```js
    const winnerLook = (this.story && !winnerIsPlayer && this.m.opponent?.look) ? this.m.opponent.look : HERO_LOOK;
    drawFighter(ctx, W / 2, 300, FIGHTER.SIZE.end, winnerLook, this.isDraw ? 'idle' : 'guard', 1, this.t * 6);
```
(The old `hue` line above it may now be unused — remove it if so. `y=300` puts the feet near where the old chest-anchored `y=198` sat; tune in Phase 5.)

- [ ] **Step 2: Verify**

Win or lose a Story fight; the match-end screen shows the correct winner (you on a win, the opponent on a loss) in the new art; console clean.

- [ ] **Step 3: Commit**

```bash
git add src/states/matchend.js
git commit -m "feat(matchend): new fighter art for the winner"
```

---

### Task 11: Story select-screen face tiles

**Files:**
- Modify: `src/states/story.js`

- [ ] **Step 1: Swap the portrait import + call**

Change `import { text, textWidth, panel, portrait } from '../gfx.js';` → drop `portrait`; add `import { drawPortrait } from '../fighter.js';`.
In `_drawCell()`, replace:
```js
    portrait(ctx, r.x, r.y, r.w, r.h, HUE[o.hue] || HUE.player, { silhouette: !s.beaten, t: t + idx });
```
with:
```js
    drawPortrait(ctx, r.x, r.y, r.w, r.h, o.look, { silhouette: !s.beaten, t: t + idx });
```
(`HUE` may now be unused in this file — remove from the import if so.)

- [ ] **Step 2: Verify**

Open Story Mode. Confirm: beaten fighters show their **redesigned bust** (hat + face + colors); unbeaten fighters are an all-dark **silhouette** with the `?`; the just-unlocked gold flash still works; console clean.

- [ ] **Step 3: Commit**

```bash
git add src/states/story.js
git commit -m "feat(story): redesigned face tiles via drawPortrait"
```

---

## Phase 5 — Cleanup + polish

### Task 12: Retire the old `boxer()`/`portrait()` and update CLAUDE.md

**Files:**
- Modify: `src/gfx.js`, `CLAUDE.md`

- [ ] **Step 1: Confirm there are no remaining callers**

Run: `grep -rn "boxer(\|portrait(" src/ | grep -v "fighter.js\|drawBoxerSprite\|drawPortrait\|drawFighter"`
Expected: no matches in `src/states/*` or elsewhere (all migrated). If any remain, migrate them before deleting.

- [ ] **Step 2: Remove `boxer()` and `portrait()` from `src/gfx.js`**

Delete the `export function boxer(…){ … }` and `export function portrait(…){ … }` definitions (and the now-unused `drawBoxerSprite` helper + the `SPRITES.boxers` boxer-blit path if nothing else references them — keep the piece-sprite path intact). Leave `shade`, `text`, `panel`, `ring`, `barH`, `FX`, etc. untouched.

- [ ] **Step 3: Update CLAUDE.md Golden Rule 5 wording**

In `CLAUDE.md`, adjust GR5 so procedural fighter art reads as first-class while keeping the zero-images guarantee. Change the sentence "Art & audio are procedural placeholders." to:
```
5. **Procedural-first art & audio.** The fighters, pieces, FX, and audio are
   drawn/synthesized in code — the new human fighter sprites (`src/fighter.js`)
   are first-class procedural art, not placeholders. The game must still run with
   **zero** image/audio files present; real sprites may *optionally* override via
   the `assets/sprites/` manifest.
```

- [ ] **Step 4: Verify**

Reload and play a fight, the walk, a round break, match-end, and the Story select. Everything renders via the new system; console clean; `grep` from Step 1 still returns nothing.

- [ ] **Step 5: Commit**

```bash
git add src/gfx.js CLAUDE.md
git commit -m "refactor(gfx): retire old boxer()/portrait(); CLAUDE.md GR5 wording"
```

---

### Task 13: In-game polish pass (human-reviewed loop)

**Files:**
- Modify: `src/fighter.js` (pixel tuning), `src/config.js` (`FIGHTER.SIZE`, feet baselines)

This task is an **iterative review loop with the user in the running game** — there is no single correct diff. Work one checklist item at a time; after each visual tweak, reload and re-confirm, then commit.

- [ ] **Step 1: Size + placement final-tune.** Against the live HUD, confirm `FIGHTER.SIZE.enemy/player` and `ENEMY_FEET_Y/PLAYER_FEET_Y` read "Medium": opponent clearly bigger than `main`, Champion crown + Rosa chimney clear the round/timer, Iron's width doesn't overflow, player back-view reads. Adjust the config numbers; commit.
- [ ] **Step 2: Face likeness.** With the user, A/B **Magnus** (side-sweep, heavy jaw, stubble, ice stare) and **Tal** (widow's peak, burning catchlights, storm mane) until they read as the real people. Tune `drawFace`/`drawHead`. Commit.
- [ ] **Step 3: Champion amalgam.** Confirm THE PAWNCHION reads as "wears every piece" (crown points + knight visor + rook-tower pads + pawn studs) without burying the arms; adjust `HAT.amalgam`/`drawTowers`. Commit.
- [ ] **Step 4: Readability audit (the three-zone contract).** For each fighter, in a real fight, confirm which-arm and HIGH/LOW tells stay legible and each **special pose differs from that fighter's jab/hook by ≥2 cues**. Fix any motif that crowds the arm lanes. Commit per fix.
- [ ] **Step 5: Tone-curve check.** Eyeball the ladder Patty→Champion: stature climbs monotonically; faces ramp hopeful→menacing. Nudge build multipliers in `opponents.js` `LOOKS` if a rung is off. Commit.
- [ ] **Step 6: Performance.** With two fighters animating, confirm the loop stays smooth (no frame backlog in the console). If a profile shows the offscreen+outline is hot, cache the outlined static layers per `(look,pose)` and redraw only arms/FX (see spec §8). Only do this if measured. Commit if changed.

---

## Self-Review (completed by plan author)

**Spec coverage:** renderer module (Tasks 1,3,4,5) ✓; back-view player (Task 4) ✓; full pose set incl jab≠hook + special frames + duck/hurt/stagger/down/walk (Tasks 3,7) ✓; per-fighter look + hero/default (Task 6) ✓; config sizes (Task 2) ✓; boxing integration + pose map (Task 7) ✓; walk/break/end/story surfaces (Tasks 8–11) ✓; select-screen face tiles + silhouette (Tasks 5,11) ✓; retire old art + GR5 wording (Task 12) ✓; size/likeness/readability/perf polish (Task 13) ✓; gold-reserved/three-zone/special-pose contracts enforced in the look data + Task 13 audit ✓.

**Placeholder scan:** no "TBD/handle edge cases/similar-to" — every code step is concrete; Task 13 is intentionally an iterative human-review loop (visual taste cannot be a fixed diff) with explicit checklist items.

**Type/name consistency:** `drawFighter(ctx,x,y,size,look,pose,facing,step,info)`, `render(look,pose,step,facing,info)`, `poseFor(g,pose,step,look,info)`, `mapPose(fr)→{pose,info}`, `look` fields (`chest` numeric vs `emblem` motif kept distinct), `HERO_LOOK`/`DEFAULT_LOOK`, `FIGHTER.SIZE.*`/`ENEMY_FEET_Y`/`PLAYER_FEET_Y`/`OUTLINE` — all consistent across tasks.
