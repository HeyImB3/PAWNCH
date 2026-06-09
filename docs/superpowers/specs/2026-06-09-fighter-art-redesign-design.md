# PAWNCH — Fighter Art Redesign (design spec)

Date: 2026-06-09
Status: design approved (visual direction validated in mockups); ready for implementation plan

## 1. Summary

A **complete redesign of every Story-mode fighter's art**, replacing PAWNCH's
current blocky procedural boxer with a **human-anatomy, NES *Punch-Out!!*-style**
sprite system: curved silhouettes (sloped deltoids, real neck, biceps/forearms,
thighs/calves) wrapped in a **bold dark outline**, at a **refined-retro**
resolution. Each of the 10 opponents fuses that body with a **chess motif
cohesive to their existing name + flavor** (Bishop Bruiser's split mitre + diagonal
stole, Rosa Rookrush's rook chimney, etc.), and the roster rides a **comedic →
menacing tone curve** up the ladder. Magnus Maximus and Tal Tempest get
**real-face caricatures** (Carlsen / Tal); THE PAWNCHION is an **all-pieces
amalgam**. The player gets the same polished human body with **no chess gimmick**.

The art stays **100% procedural** (drawn in code, zero image files), **no build /
no deps**, and is **tuned from `config.js`**. The roster's names, tags, ELO,
specials, and difficulty are **unchanged** — this is an art rework only.

The visual direction, the full roster, the new anatomy, the per-fighter builds,
and the in-fight size were all validated against rendered, animated mockups (the
prototype render engine lives at
`.superpowers/brainstorm/mockups/engine.js` and is the reference implementation
for `src/fighter.js`).

## 2. Goals / non-goals

**Goals**
- Replace the shared blocky `boxer()` with a per-fighter **human** sprite that
  reads as a finished, Steam-ready 16-bit character.
- Unique chess identity per opponent (headgear + motif + face + build + a unique
  special-move pose), all from the existing per-fighter palette.
- New **distinct jab vs hook** animations (today they render identically), plus a
  **unique special-move wind-up pose** per fighter.
- Redesigned **select-screen face tiles** matching the new looks, preserving the
  silhouette-until-beaten reveal.
- Bigger ("Medium") in-fight sprites so attacks read more easily and the art is
  appreciable — without colliding with the HUD.
- Preserve every gameplay read (which arm, HIGH vs LOW, the special tells) and the
  difficulty curve / anti-mash systems.

**Non-goals (this pass)**
- Changing any roster data: names, tags, ELO, specials, difficulty, `boxingFromDifficulty`.
- Changing boxing/chess **mechanics** — render-only; the sim is untouched.
- Shipping real pixel-art PNGs. Procedural is the source of truth; a PNG-export
  path (and relaxing GR5) is a **possible future step**, explicitly deferred.
- Arena scenery (already its own feature) and audio.

## 3. Decisions log (answered during brainstorming)

| Topic | Decision |
|-------|----------|
| Ambition | **Bold** — full per-fighter character, not just hat accents |
| Player | Player **also** redesigned, but **no chess gimmick** (clean hero); scaled up to match |
| Animations | Core set **+ a unique special-move pose** per fighter |
| Champion | THE PAWNCHION = **all-pieces amalgam** (crown + knight visor + rook-tower pads + pawn studs) |
| Tone | **Comedic → menacing** gradient up the ladder (mirrors the Punch-Out cast) |
| Body construction | Full departure from blocky → **human anatomy** like the all-fighters reference |
| Proportions | **Punch-Out stylized human** (~4.5–5 heads, caricatured per-fighter builds) |
| Resolution | **Refined retro** (higher internal res for curves, still pixel art) |
| Outline | **Bold dark outline** around every body + interior color breaks |
| Skin treatment | **B — full-color body** (whole body in team color, human-shaped), neck/face skin, trunks trim, white gloves |
| In-fight size | **Medium** (clearly bigger than today; Champion's crown still clears the HUD) |

References used: `assets/Fighter ref/all fighters reference.jpg` (the NES *Punch-Out!!*
roster — **art style only**), `magnus ref.webp` (Magnus's face), `tal ref.jpg`
(Tal's face).

## 4. Art family grammar (the cohesion contract)

All 11 figures must read as one family. These rules are mandatory for every sprite:

- **One-light law** — every figure and every motif piece is lit front-upper-LEFT:
  `bodyHi = shade(body,+42)` on left columns, `bodySh = shade(body,-40)` on right.
  Hats/crowns/sashes obey the same single light.
- **Bold-outline law** — the whole silhouette (body + headgear + gloves + trunks +
  hair) is wrapped in a 1-internal-px near-black outline (`OUT = #0a0a12`),
  produced by dilating the rendered alpha. Interior elements (sash, chest motif)
  get a manual 1px dark edge for definition.
- **Three-zone frame discipline (readability backbone)** — the chess motif lives
  ONLY in the **headgear zone** (above the head) and **torso-center zone**; the
  **arm/glove lanes and full swing arcs stay 100% motif-free** so which-arm and
  HIGH/LOW tells are never obscured. Glove anchors are never moved by costume.
- **Gloves are the shared constant** — off-white (`#ededf2 / #b9b9c6 / #ffffff`),
  unrecolored, the highest-contrast trackable object. Only sanctioned glove mark:
  a 1px trim cuff band. Sole exception: the Champion's orange gloves (kept a clean
  unbroken shape, gold lace only).
- **Vertical-scale ladder** — stature encodes rank: Patty is shortest/roundest;
  each rung climbs in height and headgear ceiling up to the Champion (tallest).
- **Two-tone construction** — `body` hex = the figure (torso/limbs/lit hat faces);
  `trim` hex = the chess "hardware/vestment" (hat bases, sashes, mortar, panels).
- **Face-as-tone-dial** — one eye/brow vocabulary; expression bends along the
  gradient: hopeful (low) → cocked/asymmetric (tricksters) → flat scowl (mid) →
  hooded/lightless/visored (top).
- **Palette discipline** — each fighter locked to their `{body, trim, skin}` + the
  engine-derived shades. **Gold (`PAL.gold`) is reserved for Magnus + Champion only**
  (a rank signal). At most one accent beyond the three hexes, and it must point the
  eye at the chess tell.

### 4.1 Special-pose system (buildable from shared parts)

All 11 specials are built from **four shared arm-frames** + shared primitives, so
no special is bespoke and none can be mistaken for a normal jab:
- **(A) BOTH-CENTER-LOW** stacked wall — Patty PAWN STORM, Rosa ROOK ROLL.
- **(B) BOTH-HIGH / overhead** — Kid feint-high, Queen overhead bomb, Iron joined maul.
- **(C) BOTH-WIDE crucifix** — Tal SAC ATTACK (chest exposed = punish window).
- **(D) ONE-ARM-LOADED** asymmetric — Gus GAMBIT JAB, Bishop DIAGONAL DRIVE,
  Magnus ENDGAME CRUSH counter-stance, Champion CHECKMATE BLOW, player UPPERCUT.

Shared primitives: a **`lean`** value (lateral/forward body commit), a **`sink`**
value (vertical coil), and a small **FX vocabulary** (rising motif-pips, forward
speed-streaks, `fx.ring`/shake, a bright accent-flash). **Tell-contrast contract**:
every special must differ from that fighter's jab/hook by ≥2 of {both-vs-one arm,
high-vs-low, centered-vs-side, body-sink, FX present}. **Slip-vs-guard signature**:
unblockable/slip-only specials use the symmetric/centered frames; guardable
high/low picks use the asymmetric frame.

## 5. Roster look catalog (validated)

Build multipliers and motif assignments below are the validated prototype values
(`engine.js ROSTER`); they become the per-fighter `look` data in `opponents.js`.
`hgt`/`shoulder`/`waist`/etc. are proportion multipliers on the neutral skeleton.

| # | Fighter | Tone | Build (key muls) | Headgear | Motif | Face | Special frame |
|---|---------|------|------------------|----------|-------|------|---------------|
| 0 | Patty Pushwood | goofy | short/round: hgt .84, waist 1.2 belly, glove 1.28 | pawn dome (short) | pawn-glyph chest | hopeful, grin, cheek dabs | A — PAWN STORM (pips) |
| 1 | Gus Gambit | trickster | lean: hgt .93, waist .85 | pawn dome (tall) | gambler diagonal sash | cocked brow, smirk | D — GAMBIT JAB (feint) |
| 2 | Rosa Rookrush | spirited | wide flat: shoulder 1.12, chest 1.08 | rook chimney | brickwork | angryV, grin, red fringe | A — ROOK ROLL (streaks) |
| 3 | Kid Knightmare | cocky | wiry: shoulder .9, waist .82 | knight visor (fwd) | fork emblem | cocked, smirk | B — FORK HOOK (feint) |
| 4 | Bishop Bruiser | stern | tall: shoulder 1.05, waist .85 | split mitre | diagonal stole sash | flatHeavy scowl | D — DIAGONAL DRIVE |
| 5 | Queen Quake | regal | tall/wide: shoulder 1.12 | pearl coronet | wide banner sash | angryV, lipstick, hooded | B — QUEEN QUAKE (overhead) |
| 6 | Iron Endgame | cold | anvil: shoulder 1.5, chest 1.25, waist .9 | iron rook battlement | rivets, near-zero bob | bar-brow, dim eyes | B — ZUGZWANG (maul, forge) |
| 7 | Tal Tempest | wild | lean/tall: hgt 1.06, waist .78 | none — storm mane | teal baldric + pips | **Tal face**: widow's peak, catchlights | C — SAC ATTACK (bolt) |
| 8 | Magnus Maximus | dominant | broad: hgt 1.12, shoulder 1.15 | king crown (cross) | champion sash + gold | **Magnus face**: side-sweep, jaw, stubble | D — ENDGAME CRUSH (counter, aura) |
| 9 | THE PAWNCHION | apex | colossus: hgt 1.18, towers | amalgam | rook-tower pads, kingcross, studs, **orange gloves** | bar-brow, gold eye-glints | D — CHECKMATE BLOW |
| — | YOU (player) | hero | V-taper: hgt 1.06, waist .8 | none | none | hopeful, grin | D — UPPERCUT (back-view) |

## 6. Architecture

### 6.1 New module: `src/fighter.js`
Ports the prototype engine. Exports:
- **`drawFighter(ctx, x, y, size, look, pose, facing, step, opts)`** — renders the
  fighter to a cached offscreen buffer (`IW×IH` internal px), wraps it in the bold
  outline, draws face + FX, and blits it pixel-crisp at the on-screen `size`. `x` is
  the horizontal center; `y` is the **feet baseline** (so taller fighters/hats grow
  upward from a stable floor). `facing`: `1` = front (opponents), `-1` = back (player).
- **`drawPortrait(ctx, x, y, w, h, look, { silhouette, t })`** — head-&-shoulders
  bust reusing the head/headgear/face renderers; `silhouette:true` draws the look as
  an all-dark bust (unbeaten fighter).

Internal pipeline (validated): draw legs → (translate by `leanX,sink`) back arm →
torso + shading + trunks → chest motif → sash → champion rook-towers → neck/head/hair
→ headgear → front arm → **outline whole alpha by dilation** → face features + FX on
top. Part libraries inside the module: `BUILD` (proportion skeleton via `geom`),
`HAT` (headgear renderers), `drawSash`, `drawChest`, `drawFace` (tone-dial +
caricatures), `drawFX`, plus the pose table.

The module is **self-contained** (only imports `PAL`/config + `shade`), keeping
`gfx.js` from ballooning (in the spirit of GR7's small focused modules).

### 6.2 The `look` descriptor
A plain data object per fighter (lives in `opponents.js`):
```js
{
  hue: { body, trim, skin },          // from HUE (palette source of truth)
  // build proportion multipliers (default 1):
  hgt, head, shoulder, chest, waist, hip, thigh, glove, belly, bob,
  headgear: 'pawnDomeShort' | 'pawnDomeTall' | 'rookChimney' | 'rookStub'
          | 'knightVisor' | 'mitre' | 'queenCoronet' | 'kingCrown' | 'amalgam' | 'none',
  hair: 'cap' | 'sideSwept' | 'stormMane' | 'none',  hairCol, heavyJaw, widowPeak,
  emblem: 'pawnGlyph'|'fork'|'brick'|'rivets'|'kingcross'|null,  // chest motif —
          // NOTE: distinct key from the `chest` proportion mul above. The
          // prototype overloaded `chest` for both (a duplicate-key collision that
          // NaN-ed chestHalf for Patty/Rosa/Kid/Iron/Champion); the real look MUST
          // keep `chest` numeric and use `emblem` for the motif.
  sash:  { dir:'LR'|'RL', wide?, pips?, stud? } | null,
  towers: bool, gloveTint: 'orange'|null,
  face: { brows, mouth, eyeCol, hooded, catchlight, glint, stubble, goatee, cheekMark, cheekDab },
  special: { name, frame, fx },       // the unique special pose (frame from §4.1)
}
```

### 6.3 Pose system + sim → render mapping
The renderer's pose table covers: `idle`, `guard`, `jab`, `hook` (each honoring
**arm L/R** and **target high/low**), `windup` (arm cocked = the tell), the
**`special` frame** (the per-fighter unique pose), `duck`, `hurt`, `stagger`,
`down`, `walk`. `boxing.js` maps the sim state → render pose, finally distinguishing
**jab from hook** (today both collapse to `punch`) and showing the **special frame**
during a boss-special / signature wind-up:
```
sim pose → render pose
idle/recover         → idle
guard                → guard
windup (kind=jab)    → windup-jab  (arm, target)
windup (kind=hook)   → windup-hook (arm, target)
windup (special/sig) → special frame (look.special.frame)  // the unique pose
punch (kind=jab)     → jab  (arm)
punch (kind=hook/star) → hook (arm)
stance               → special frame (counter)              // Magnus
dodgeL/R             → lean / duck
duck                 → duck
hurt                 → hurt
stun                 → stagger
down/ko              → down
```

### 6.4 Per-fighter `look` data — `src/opponents.js`
Attach a `look` to each `OPPONENTS[i]` (built from its `hue` + the §5 catalog).
Add a **hero look** (player) and a **default look** (PVP/online enemies that have no
Story `look`). `HUE` stays the palette source.

### 6.5 Config / tuning — `src/config.js` (Golden Rule 2)
New render knobs centralize the magic numbers:
```js
export const FIGHTER = {
  // in-fight buffer→screen blit scales (STARTING values from the Medium mock;
  // finalized against the live HUD in Phase 5):
  SIZE: { enemy: 1.12, player: 1.37, walk: 0.78, break: 0.90, end: 1.05 },
  ENEMY_FEET_Y: 304,        // opponent feet baseline in the 512×448 scene
  OUTLINE: '#0a0a12',
  // internal buffer resolution / baseline are module constants but surfaced here
  // if we want to dial them.
};
```
Medium = the validated `×1.12` enemy blit with feet near the ring floor; the
portrait bust is framed by `drawPortrait` itself, not a blit scale. Exact values
finalized against the live HUD in the polish phase.

### 6.6 Integration call sites
Swap the 7 `boxer()` calls + 1 `portrait()` call to the new module:
- **`src/states/boxing.js`** — enemy uses `m.opponent.look` (Story) / default
  (PVP/online); player uses the hero look (`facing -1`). Apply the §6.3 mapping
  (pass pose + `e.arm` + `e.target` + `e.kind` + `e.special`). Sizes from `FIGHTER.SIZE`.
- **`src/states/walk.js`** — both fighters, `walk` pose, `FIGHTER.SIZE.walk`.
- **`src/states/roundbreak.js`** — both fighters idle, `FIGHTER.SIZE.break`.
- **`src/states/matchend.js`** — winner (front), idle/guard, `FIGHTER.SIZE.end`.
- **`src/states/story.js`** — `drawPortrait(... look, { silhouette: !beaten })`.

### 6.7 Select-screen face tiles
`drawPortrait` renders each fighter's bust from their `look` (head, headgear, face,
palette), framed to the 86×92 cell. The **silhouette-until-beaten** mechanic is
preserved (all-dark bust + the existing `?` overlay) — only the art under it changes.

### 6.8 Retiring the old art
Remove `boxer()` and `portrait()` from `gfx.js` once all call sites move (or leave
thin deprecated wrappers if any external tool references them — `tools/sprite-gen.html`
targets the old keys and is documentation-only). The optional **PNG sprite manifest**
override path (`assets.js` / `gfx.js` `SPRITES`) is **kept intact but deprioritized**;
the new procedural art is the default and runs with zero image files.

## 7. Golden-rule compliance
- **GR1** no build/deps/framework — pure ES module + canvas (offscreen buffers are
  standard canvas).
- **GR2** all render tuning in `config.js` (`FIGHTER`); per-fighter look is roster
  **data** in `opponents.js`.
- **GR3** palette from `HUE`/`PAL`; gold reserved per §4.
- **GR4** drawn to canvas with `imageSmoothingEnabled=false`; new helpers in the
  focused `src/fighter.js` module.
- **GR5** **fully procedural; zero image files required.** Note: the new art is no
  longer a "placeholder" — a small **CLAUDE.md wording update** will mark the
  procedural fighter art as first-class while keeping the zero-images guarantee.
- **GR6** unchanged — render-only; match/win logic stays in `game.js`/the model.
- **GR7** small focused module, matches surrounding style.
- **GR8/GR9** **no gameplay change** — AI, difficulty curve, parry, anti-mash, and
  all tells are preserved; the three-zone discipline (§4) guarantees the read.

## 8. Performance
- Render = a small `IW×IH` (~150×216) offscreen draw + an 8-stamp outline dilation
  per fighter; only **2 fighters per frame** in a fight. Expected to be cheap.
- If profiling shows cost: **cache** the outlined static layers per `(look, pose)`
  and only redraw the moving arm/FX, or cache whole frames keyed by quantized
  `step`. Caching is an optimization, not required for v1.

## 9. Verification (no automated suite)
- `npm run dev`, play Story fights across the ladder; confirm each opponent renders
  their redesign, **jab ≠ hook**, the **special pose** shows on the boss move, and
  every tell (arm, HIGH/LOW, SLIP-IT) still reads. Watch for `[PAWNCH] frame error`.
- Confirm **Medium** size: bigger than `main`, Champion's crown + Rosa's chimney
  clear the HUD round/timer; Iron's width doesn't overflow.
- Select screen: face tiles match the fighters; unbeaten = silhouette + `?`; reveal
  on win still flashes.
- Walk intro, round break, match-end winner all render the new fighters.
- Player back-view reads (which glove, jab/hook/uppercut) during a real fight.
- Smoke via `window.PAWNCH`. A/B faces (Magnus/Tal likeness) and the amalgam in the
  running game during the polish phase.

## 10. Build plan (phases — each ends playable/inspectable)
1. **Renderer** — `src/fighter.js`: port engine, add **back view** + full pose set
   (jab/hook/windup/special/duck/hurt/stagger/down/walk) + `drawPortrait`.
2. **Look data** — add `look` to all opponents + hero/default in `opponents.js`.
3. **Boxing integration** — wire `boxing.js` (§6.3 mapping), add `FIGHTER.SIZE` to
   config; verify a full fight reads.
4. **Other surfaces** — walk, round break, match-end, story face tiles.
5. **Polish loop** — per-fighter pixel tuning (faces, Magnus/Tal likeness, amalgam),
   readability + size final-tune against the live HUD, perf pass, retire old
   `boxer()`/`portrait()`, CLAUDE.md wording. **Reviewed in the running game.**

## 11. Risks & mitigations
- **Tell legibility** (busy motifs hiding the arm) → three-zone discipline (§4),
  gloves stay bright/unmoved; verify each fighter in a real fight (Phase 3/5).
- **Blind-authoring drift** (pixel details off until seen in-game) → Phase 5 is an
  explicit review-in-game loop; the mockups de-risked silhouettes/builds already.
- **HUD collision** from tall hats → Medium size chosen against the mock HUD;
  re-confirm on the live HUD in Phase 5.
- **Player back-view** has no face/motif to anchor → lean on glove + shoulder reads;
  keep the V-taper shading strong, gloves unrecolored.
- **Perf** (offscreen+outline ×2/frame) → measure; cache only if needed (§8).
- **PVP/online** enemies lack a Story `look` → default look fallback.

## 12. Open / deferred decisions
- Exact Medium `FIGHTER.SIZE` values + opponent vertical position → finalized on the
  live HUD in Phase 5 (mock says `×1.12`, feet ~ring floor).
- **PNG export + relaxing GR5** → deferred future step; if the procedural result is
  great we may bake sprites to PNGs and update the rule (user-floated, not in scope).
- Frame caching → only if profiling requires it.
- Whether to keep thin `gfx.js` `boxer()`/`portrait()` wrappers vs. full removal →
  decided in Phase 5 based on remaining references.
