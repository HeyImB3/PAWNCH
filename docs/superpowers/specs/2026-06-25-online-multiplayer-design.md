# PAWNCH Online Multiplayer — Design Spec

**Date:** 2026-06-25
**Status:** Approved design — implementation plan to follow.
**Supersedes:** `docs/ONLINE_SYNC_TODO.md` (the deferred authoritative-timeline patch). This
spec replaces that approach wholesale rather than continuing it.

> This is the single largest change planned for PAWNCH. It re-founds the online match on a
> deterministic, tick-based simulation with rollback netcode, adds ELO matchmaking via a small
> rating service, and ships the game on Steam through a desktop wrapper. The current
> "White client is the authority and broadcasts clocks" patch is abandoned — it can't be made
> perfectly fair because each client still runs its own wall-clock loop.

## Goals

1. **Perfect sync** between the two clients across *every* phase of a match: the coin flip, the
   walk-up animation, the chess half (clocks must never drift), and the boxing half (punches,
   dodges, and parries land at the same moment on both screens).
2. **Fairness with no host advantage** — both halves are timing-critical; neither player may get
   an edge from being "the host" or from latency asymmetry.
3. **Seamless real-time feel** in the ring, comparable to modern rollback fighting games
   (Street Fighter 6, Mortal Kombat 1, Guilty Gear Strive).
4. **ELO matchmaking**: entering online matchmaking pairs you with a similarly-rated opponent;
   ELO is driven by *overall match wins* (win by chess OR boxing — a win is a win), not per-half.
   Win → return to the multiplayer menu to re-queue.
5. **Steam-release ready.** Anything that eases a Steam launch is in scope.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Steam packaging | Desktop wrapper (**Electron**) around the existing web game |
| Sync model | **Deterministic lockstep**, with **rollback** as the shipped end-state |
| Build order | Deterministic tick engine first (foundation), then rollback layered on top |
| ELO storage | **Lightweight rating server** (extend the existing relay), keyed by identity |
| Latency model | **Rollback** (GGPO-style prediction + re-simulation) for the seamless feel |
| Online modes (v1) | **Ranked matchmaking** + **Invite-a-Friend** (Steam, unranked) |
| Rage-quit / drop past grace | **Forfeit** — loss for the quitter, win for the player still present |
| Draw (10 rounds, equal material) | **Standard ELO draw** (ratings nudge toward each other) |
| Tick rate | **60 Hz** (`dt = 1/60 s`) |
| ELO defaults | Start **1000**, K-factor **32**, higher provisional K for first ~10 games (tunable) |
| Wrapper engine | **Electron** over Tauri — bundles Chromium so both clients share identical V8/math (determinism), and Steam bindings are mature |

## Architecture overview

The match becomes **one deterministic, fixed-timestep simulation** ("the sim") driven by a shared
tick counter, with rendering decoupled from it. Online play is **rollback lockstep over the sim**.
Offline modes (story, tutorials, hotseat) run the *same* sim with local inputs and no network. There
is one match engine; "online correctness" reduces to "the sim is deterministic and we exchange
inputs."

Layers (proposed module layout — final names settled in the implementation plan):

- **Sim core** (`src/sim/…`) — pure, deterministic, serializable match state plus
  `step(state, inputs) -> state`. Owns chess clocks, boxing physics, HP, round flow, and the
  walk-up timeline. No `Date.now`, no `Math.random` (seeded PRNG instead), no wall-clock `dt`.
- **Rollback session** (`src/net/rollback.js`) — local input prediction, input exchange,
  `snapshot`/`restore`, re-simulation, and state-hash desync detection.
- **Transport** (`src/net/transport.js`) — pluggable: **Steam P2P** in the wrapper (production),
  the existing **WebSocket relay** for dev/browser. Identical message interface either way.
- **Matchmaking + rating service** (`server/`) — the existing Node + `ws` relay extended into a
  small authoritative service: ELO store, ranked widening queue, friend/private rooms, result
  cross-check, forfeit, versioning.
- **Renderer** (existing `states/*`) — a read-only *view* of sim state, with interpolation for
  smoothness. The chess/boxing/walk states stop *owning* timing and instead render the sim.
- **Identity** (`src/net/identity.js`) — Steam ID (+ auth ticket) in the wrapper; a stable local
  UUID or chosen handle in dev/browser.
- **Desktop wrapper** (`desktop/`) — a thin Electron app that loads the web build and injects a
  native bridge to Steamworks (identity, P2P sockets, invites/presence, optionally stats).

## The deterministic sim (the heart, and the big refactor)

- **Fixed 60 Hz tick.** The render loop accumulates real elapsed time, steps the sim in whole ticks,
  and uses the leftover fraction as an interpolation alpha for drawing. The sim never sees
  wall-clock `dt`.
- **One tick counter for the whole match.** Walk-up is ticks `0..N`; then chess, round break, and
  boxing, all on the same timeline. Phase transitions fire at deterministic tick boundaries computed
  from sim state, not from each client's clock. This makes clock drift and "one player a half ahead"
  *structurally impossible*.
- **Seeded PRNG.** A small deterministic RNG (mulberry32-style) seeded from a server-provided
  **match seed**. It replaces every `Math.random` that affects sim state: boxing tells/variation,
  heal amounts, and the **coin flip** (now derived from the seed, so both clients agree). Cosmetic
  randomness (particles, screen shake) uses a *separate* non-sim RNG and must never touch sim state.
- **Serializable state.** All sim state lives in flat, cloneable structures (plain objects / typed
  arrays — no closures, no DOM refs) so `snapshot()` and `restore(snapshot)` are cheap. This is the
  prerequisite for rollback.
- **Inputs.** A compact per-player input per tick — boxing buttons (punch L/R, dodge L/R, block,
  special) and chess move events. Inputs are the *only* thing exchanged over the network.
- **Determinism discipline.** Centralize sim math so operation order is identical on both machines;
  hash sim state each tick to catch drift in testing and live. Because the Steam build is Electron
  (Chromium/V8 on both ends) and dev is Chromium-on-Chromium, floating-point and `Math.*`
  transcendental results are effectively bit-identical — a major reason Electron is chosen over Tauri.

The refactor: `src/boxing.js` (`BoxingMatch`) and the chess-clock + round-flow logic in `game.js`
move into the sim and become pure, tick-driven, and seeded. This is the bulk of the work — and it is
the *same* work that fixes the desync, so it is not paid for twice.

## Rollback netcode (the seamless feel)

GGPO-style — the technique modern fighting games use:

- Both clients run the sim locally at 60 Hz. **Predict** the opponent's not-yet-arrived input for
  the current tick as "same as their last input" (ideal for PAWNCH, where the opponent is usually
  idle or mid-windup), and advance immediately — so **the local player's own inputs feel instant.**
- When the opponent's real input for tick `T` arrives and differs from the prediction, **restore the
  saved state at `T`, re-apply the corrected inputs, and re-simulate forward to the present** in a
  single frame (cheap — the sim is small). The screen snaps to truth; corrections are tiny and rare
  given the telegraphed design.
- A small fixed input delay (1–2 ticks) shrinks rollback distance. The rollback window is bounded
  (~8 ticks ≈ 130 ms); beyond it the game briefly hitches rather than rolling back further (rare,
  only on bad spikes).
- **Render-layer effects only:** hit-stop (`doFreeze`) and special-move FX (`specialfx.js`) become
  presentation effects that never pause or branch the sim, so they cannot cause a desync. Short
  visual interpolation hides small position "pops" from corrections.
- **Desync guard:** clients exchange a state-hash periodically (e.g. every N ticks). A mismatch means
  a bug or tampering → abort cleanly; in ranked, the server arbitrates rather than trusting a client.

**Build-order de-risk:** the sim first runs in plain **input-delay lockstep** (no prediction) to
prove determinism and end-to-end sync — *that alone fixes the release blocker and is already fair* —
then prediction/rollback is switched on for feel. Same engine; rollback is a layer, not a rewrite.

## Chess half under the model

- A chess **move** is an input event stamped to the tick it was committed; the board
  (`src/chess/board.js`) is already deterministic.
- **Clocks are computed from the shared tick count** — the side-to-move's clock decreases one tick's
  worth per tick during the chess half, with the increment added on a move. Because both clients
  share the tick counter, the clocks are identical with no snapshots and no broadcast. The
  authoritative-timeline `applyNetClock` / `_broadcastNetClock` mechanism is deleted.
- The half ends deterministically — flag (a clock hits 0), checkmate, or the windowed half cap
  (`CHESS_HALF_SECONDS`, expressed in ticks) — and both clients detect it on the same tick.
- A received move is validated by the deterministic board; a move that fails to validate indicates a
  desync and trips the guard (should not happen between equal versions).

## Boxing half under the model

- `BoxingMatch` becomes the sim's boxing module: telegraphed tells, parry windows, stagger,
  best-of-3 knockdowns, and the get-up minigame — all tick-driven and seeded.
- In online PvP there is **no AI**; both sides are real inputs flowing through the same input path.
  The story AI (`src/opponents.js`, `boxingFromDifficulty`) is untouched and used only offline.
- Parry/telegraph windows (`BOX.PARRY`) are re-tuned to feel right under rollback (frames are now
  authoritative and identical on both ends), preserving the anti-mash perfect-parry mechanic
  (Golden Rule 9) symmetrically for both players. Golden Rule 8 (the AI difficulty curve) governs
  offline only and is unaffected.

## Matchmaking + rating service

Grow `server/` from a blind relay into a small authoritative match service — still Node + `ws`, plus
a tiny persistence layer (SQLite or a JSON store; no heavy dependencies):

- **Identity.** Clients present an identity token: a Steam ID with an auth-session ticket in the
  wrapper (validated via the Steamworks Web API — prevents ELO spoofing), or a stable dev UUID in the
  browser.
- **ELO store** keyed by identity: `rating` (start **1000**, K-factor **32**, higher provisional K
  for the first ~10 games), plus wins / losses / draws / games played. Persisted. A win counts the
  same however earned — checkmate, flag, or KO.
- **Ranked queue.** Enqueue with your rating; pair the closest-rated waiting player; **widen the
  acceptable rating band over time** (e.g. ±50 growing each second up to a cap) so a match always
  eventually forms. On pairing the server mints a **match seed**, derives colors from it, and sends
  both clients `matched { seed, color, oppName, oppRating }`. After a result, both clients return to
  the multiplayer menu to re-queue.
- **Invite-a-Friend (unranked).** A host creates a private room and shares a **Steam invite** (via
  the wrapper overlay) or a short **room code** (dev fallback); the friend joins the same room. No
  ELO change for private matches.
- **Result integrity.** At match end *both* clients report the outcome (and the final state-hash).
  The server applies ELO only when the reports agree; disagreement voids the rating change and flags
  the match — so a tampered client cannot invent wins.
- **Forfeit.** A disconnect past the reconnect grace window is a **loss for the disconnector and a
  win for the player still present**, with ELO applied accordingly.
- **Draw.** Standard ELO adjustment (the higher-rated player loses a little, the lower-rated gains a
  little).
- **Versioning.** Clients send a sim/protocol version; the server only matches identical versions
  (deterministic sims must agree). A mismatch yields a friendly "update required."

## Reconnection under lockstep

On a drop within the grace window: the client reconnects, the server rejoins it to its room, and the
still-present peer ships a **full sim snapshot at the latest confirmed tick plus the inputs since**;
the returning client restores and resumes. If it cannot catch up within the window, the match is
forfeited. (The existing token + grace + rejoin machinery in `server/server.js` and `src/net.js` is
reused and extended with snapshot transfer.)

## Steam desktop wrapper

A thin **Electron** app in `desktop/` that loads the existing web build and injects a native bridge:

- **Identity:** Steam ID + auth ticket (validated by the rating service).
- **In-match transport:** Steam P2P (SteamNetworkingSockets / Steam Datagram Relay) for free NAT
  traversal and relay. The transport is abstracted, so the same netcode runs over **Steam P2P**
  (production) or **WebSocket** (dev/browser).
- **Invites / presence:** Steam friend invites for private matches; rich presence ("In a ranked
  match").
- **Stats / achievements:** optional, later (wins, KO/checkmate counts).
- **Why Electron, not Tauri:** Electron bundles Chromium, so both clients run identical V8 and math —
  which makes deterministic lockstep dramatically safer. Tauri uses each OS's native webview
  (different engines), a determinism hazard for a lockstep game, and its Steam bindings are less
  mature. The rating/matchmaking service remains the ELO authority regardless; Steam handles transport
  and identity, not rating.
- Game code stays vanilla JS with no build step (Golden Rule 1). The wrapper is a separate, optional
  project; the web version still runs standalone for development (and a possible web/itch build) over
  the WS relay.

## What stays untouched

Offline story mode, tutorials, and local hotseat all run on the new sim with local inputs, and their
feel is preserved. The Golden Rules hold: palette via `PAL`, drawing via `gfx.js` helpers, tuning in
`config.js`, match logic in the sim/`game.js`, and no client dependencies. The art/sprite pipeline and
audio engine are unaffected.

## Risks & de-risking

- **Determinism bugs** (the classic rollback pain). Mitigation: build input-delay lockstep first; add
  a per-tick state-hash desync detector; add a **headless replay test harness** that runs an input log
  through two fresh sims and asserts identical hashes. That harness is the closest thing this repo will
  have to an automated test, and it is worth adding.
- **Refactor regressions to offline modes.** Mitigation: validate the sim against current behavior
  before cutover; keep all changes behind the sim boundary so the renderer/states change minimally.
- **Steam binding complexity.** Mitigation: isolated entirely in the wrapper; the game degrades to the
  WS relay if the native bridge is absent.
- **Scope.** Mitigation: the phased plan below — each phase is independently shippable and verifiable.

## Phased delivery

Detail (files, steps, verification) is produced in the implementation plan. High-level order:

1. **Deterministic sim core.** Refactor match flow, boxing, the chess clock, and round flow into a
   fixed-timestep, seeded, serializable sim; the renderer reads from it; offline modes run on it. No
   networking yet. Add the headless replay/desync test harness.
2. **Input-delay lockstep online.** Exchange inputs over the existing WS transport; both clients run
   the sim in lockstep so the coin flip, walk-up, chess, and boxing all sync. **The release blocker is
   fixed at this phase.**
3. **Rollback layer.** Add prediction, `snapshot`/`restore`, re-simulation, and visual smoothing for
   the seamless feel.
4. **Rating service + matchmaking.** ELO store, widening ranked queue, friend/private rooms, result
   cross-check, forfeit handling, and versioning.
5. **Steam Electron wrapper.** Steamworks identity + P2P transport + invites; ELO keyed by Steam ID;
   the build/ship pipeline.

Phases 3 and 4 are independent and may swap order; `1 → 2` is the spine and must come first.

## Out of scope (v1)

- Spectating and saved replays (the deterministic input log makes both feasible *later*).
- Cross-play between mismatched game versions (deterministic sims must match — versions are gated).
- Server-authoritative simulation (lockstep + result cross-check is the chosen integrity model).
- Tournaments, seasons, and rating decay (the ELO store is built to allow them later).
