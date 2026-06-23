# PAWNCH fighter prompting — the full recipe

Everything here is realized in `tools/fighter_prompts.py`. Read that file alongside this —
it's the living source of truth; this explains the *why* so you can extend it well.

## Table of contents
1. How a fighter prompt is assembled
2. Writing a great `IDENTITY` (the anti-cookie-cutter recipe + examples)
3. Staging / `FOCUS` — why punches aim down-and-forward
4. `CONTINUITY` — why it must stay generic
5. `POSE_DESC` — the pose set and the downward punches
6. The player (back-view + front-view)
7. Real-person likeness (`--anchor-ref`)
8. Sizing (`BODY_H`) and the canvas
9. The stubborn KO `down` pose
10. Designing a special-FX spectacle

---

## 1. How a fighter prompt is assembled

Every generation is one Gemini image call. The prompts compose four shared pieces with one
per-fighter piece:

- **`IDENTITY[slug]`** — the character (per fighter). *This is the only place a fighter's look
  is described.*
- **`STYLE`** — the shared 16-bit Punch-Out look (bold outline, flat 2–3 shade palette, no
  gradients/AA, full body, white background). Generic.
- **`FOCUS`** — shared staging (the player is a foreground opponent below/in front). Generic.
- **`POSE_DESC[pose]`** — what the body is doing this frame (shared across fighters). Generic.
- **`CONTINUITY`** — "stay identical to the reference image" (used on pose calls). Generic.

`anchor_prompt(slug)` = IDENTITY + idle pose + FOCUS + STYLE → the **identity anchor**.
`pose_prompt(slug, pose)` = "same character as the reference" + IDENTITY + POSE_DESC + FOCUS +
STYLE + CONTINUITY, with the anchor passed as `--ref` so the character holds across frames.

The takeaway: **all per-fighter variety lives in `IDENTITY`.** If two fighters look alike, their
IDENTITYs aren't distinct enough — fix that, not the shared pieces.

---

## 2. Writing a great `IDENTITY`

A fighter is a *character first*. Lead with body type + personality; let the chess theme be
*who they are* plus one signature nod; end by ruling out the defaults they should NOT have.

Structure that works:
`"<NAME>, a <one-line personality/role>: <BODY TYPE & silhouette>, <face/hair/expression>,
<costume — what makes them THEM>, <the ONE chess signature nod>. <attitude>. NO <defaults they
lack>."`

Aim for **maximum spread across the roster**: vary size (tiny/round ↔ huge ↔ tall/lanky),
build (doughy ↔ blocky ↔ wiry ↔ mechanical), and archetype (dope, con-man, zealot, diva,
machine, mad-genius, prodigy). If you line up the idle frames as silhouettes, each should be
unmistakable.

**Worked examples** (these are the redesigned roster — note how different the bodies are):

- **patty** — "the SHORTEST and ROUNDEST fighter, a soft doughy PAWN-SHAPED pudgeball with
  stubby arms… orange gloves too big for his tiny arms. A lovable dope." → a tiny round
  silhouette.
- **rosa** — "the WIDEST, most square and blocky fighter… a body textured like grey castle
  stone and red brick… Her body IS the rook-tower. NO helmet." → a wide fortress silhouette;
  the rook is her *build*, not a hat.
- **bishop** — "the TALLEST and LANKIEST by far, gaunt and long-limbed… a high white clerical
  collar and a long dark cassock-robe… NO mitre hat." → a tall thin silhouette; the bishop is
  his *vocation*.
- **iron** — "a steampunk iron ROBOT boxer… riveted plates, brass gears, a single cold glowing
  eye-slit, iron-block fists. No skin, no expression." → inhuman; the biggest tonal swing.
- **gus** — "a sly riverboat-gambler con-man… pencil mustache, a green dealer's visor and sleeve
  garters… NO helmet." → the 'gambit' is his *hustle*.
- **kid** — keeps the **fork**: "a spiky horse-mane MOHAWK… a big bright two-pronged fork symbol
  blazes across his chest, fork-shaped lightning around both gloves." (The fork reads strongest
  in his special-move FX — see §10.)

What the chess nod can be (pick ONE, embodied): a build (rook = fortress), a vocation
(bishop = clergy), a prop/emblem (knight = fork), a material (iron = machine), a behaviour
(queen = theatrical power). Avoid giving everyone a hat.

---

## 3. Staging / `FOCUS` — punches aim down-and-forward

In the boxing scene the enemy stands at the upper-center facing the camera, and the **player is
a smaller opponent in the bottom-of-screen foreground, below and in front.** So an enemy's head,
eyes, and punches aim **down-and-forward toward the player's head in the lower-center-front** —
*not* straight ahead (looks like he's fighting the camera), *not* off to the side (the early
bug — punches read as sideways swings), and *not* straight down at the floor (the over-correction
— he looked like he was punching the ground). The fist lands at head height with foreshortening.

`FOCUS` says this generically (it does NOT call the player "tiny" or the enemy a "giant," so it
works for a short Patty and a huge Iron alike). Keep it that way.

---

## 4. `CONTINUITY` — keep it generic

`CONTINUITY` is appended to every *pose* call to hold the character steady against the anchor.
It must describe *consistency*, never *content*: "keep this fighter identical to the reference —
same face, hair, costume, colours, build; don't add or remove costume elements; don't add a
crown / chess-hat / shoulder armour unless the reference already has one."

The original bug: it hardcoded "same gold chess-piece crown" + "ALWAYS rook-tower pauldrons"
(written for the Pawnchion). That forced every fighter into a crown + pauldrons no matter their
IDENTITY → the cookie-cutter roster. If you ever see sameness creeping in, check that nothing
fighter-specific leaked into `CONTINUITY` or `anchor_prompt`.

---

## 5. `POSE_DESC` — the pose set

`POSE_ORDER` (14): `idle, guard, windupL, windupR, jabL, jabR, hookL, hookR, special, duck,
hurt, stagger, down, walk`. These map to the engine via `boxerKey` in `src/fighter.js`.

- Punches (`jab*`, `hook*`) and wind-ups embed the **down-and-forward** direction (§3).
- `special` is the signature wind-up — a big, dramatic pose (e.g. an overhead two-fist smash).
  The on-screen spectacle is the FX layer (§10); this is just the fighter's pose during it.
- `windupL/R` are the **telegraph** — make them exaggerated and clearly different from idle so
  the player can read the tell (the whole game is read-and-react).

`POSE_DESC` is shared, so edits affect every fighter — change with care, or use `--only` to
re-roll one fighter's pose.

---

## 6. The player (back-view + front-view)

The player is drawn **back-to-camera in fights** (you see their back; punches drive UP at the
bigger enemy above) and **front-facing on win / round-break / walk-in** screens. `gen_player.py`
makes a front identity anchor, then `back_<pose>` frames (the fight view) + `front_{idle,guard,
walk,special}` (the non-combat views). `PLAYER_BACK` / `PLAYER_BACK_POSE` / `PLAYER_FRONT_POSE`
in `fighter_prompts.py` hold the staging. Design the player as a rootable underdog (think
"Little Mac but better" — scrappy, heroic, a chess-pawn-rising motif).

`slice_boxer.py player` slices the facing-prefixed files. The loader (`assets.js`) reads both
`front_` and `back_` per pose; the player needs both, opponents only `front_`.

---

## 7. Real-person likeness (`--anchor-ref`)

For caricature homages (Magnus = Carlsen, Tal = Tal), seed the anchor from a reference photo:
`gen_fighter.py <slug> --anchor-ref "assets/Fighter ref/<photo>"`. The photo conditions the
**anchor only** (the face/identity); the poses then inherit it. `gemini_image.py` detects
webp/jpg. **Crop other people out of the photo first** (Pillow) so the model locks onto the
right face. Keep it affectionate, not mocking; put "NO crown" etc. in the IDENTITY if needed.

---

## 8. Sizing (`BODY_H`) and the canvas

All frames normalise to a 150×216 canvas with feet on row 190, centred on col 75 — identical
to the procedural geometry, so `drawFighter` blits them with no jitter. The **standing body
height** within that canvas is per-fighter in `slice_boxer.py` `BODY_H` (default 150). This is
how size variety reads in-game: Patty ~112, Bishop ~182, Iron ~186, Pawnchion ~172. Wide
fighters are clamped to the canvas width; the `down` pose is sized short/wide. Tune these to
match the fighter's intended presence.

---

## 9. The stubborn KO `down` pose

Conditioned on an upright anchor, the model refuses to draw a figure lying flat — it keeps him
standing. Generate `down` **without** the anchor: a standalone `gemini_image.py` call describing
a side-on figure lying flat on his back on the canvas (head one side, boots the other, arms
sprawled), then re-slice. The slicer sizes `down` short-and-wide automatically.

---

## 10. Designing a special-FX spectacle

`src/specialfx.js` draws a per-fighter, chess-themed spectacle during a boss's special. Register
one per fighter: `registerSpecialFx('<slug>', (ctx, o) => { … })`.

`o = { W, H, ex, feetY, t, phase, k, accent, layer }`:
- `phase` is `'charge'` (winding up — `k` ramps 0→1, pulse with `t`) or `'strike'` (the blow
  landed — `k` is 0→1 burst progress).
- `layer` is `'back'` (drawn behind the fighter — dim the arena, a giant ghost piece, themed
  energy/board) or `'front'` (over everything — shockwave, scattering pieces, a name stamp).

Shared helpers: `dim`, `halo`, `shock`, `scatter` (flying chess glyphs), `stamp` (the move name
slamming in). The `pawnchion` CHECKMATE function is the template. Theme it to the move:

- patty PAWN STORM — a goofy swarm of pawns rushing up. gus GAMBIT — a sacrificed piece floats
  up and pops. rosa ROOK ROLL — a giant stone rook charges in with dust + speed-lines. kid FORK
  — two glowing fork-reticles (head + body) + fork-lightning. bishop DIAGONAL — a holy diagonal
  beam sweeps the ring. queen QUAKE — the floor cracks radially. iron ZUGZWANG — grinding gears +
  steam, heavy iron shock. tal SACRIFICE — a hypnotic spiral of dissolving pieces. magnus ENDGAME
  — a cold lock-on grid, one surgical flash.

The boxing state fires the spectacle automatically: the `back` layer before the fighter, the
`front` layer over both, `'charge'` during the special wind-up and `'strike'` (`specialFxT`)
when the special lands. Tuning numbers live entirely in the FX function — iterate by eye in-game
(you can't see animated canvas from a static read).
