# TODO: Online multiplayer sync (KNOWN ISSUE — deferred)

**Status:** Not fully working. Tabled intentionally on 2026-06-09 to focus on higher-priority issues. Will be fixed in a later session.

> ⚠️ **RELEASE BLOCKER:** Online multiplayer must be fully fixed and working before this game is Steam-release ready. Do not ship without it.

## Symptom
In an ONLINE match the two clients still drift apart:
- The **coin flip** isn't synced between the two players.
- **Chess moves** and the **half timer** fall out of sync (one client ends/advances a half before the other).

## What's already in place
A first pass at an **authoritative-timeline** design is implemented and gated entirely behind `m.net` (offline story/hotseat is unchanged). The White player is the authority; it's meant to own match-flow transitions + clocks and broadcast them, with the peer following. See:
- `src/game.js` — `netFlow`, `resolveChess`/`resolveBoxing` gating, `_drainNetPhase` / `_applyNetPhase`, `applyNetClock`, `_broadcastNetClock`, `_flipResult`, fixed online `applyRoundHeal`.
- `src/states/multiplayer.js` — `netAuthority` flag, `netInboxPhase`, `phase`/`clock` handlers.
- `src/net.js` — `sendClock`.
- `src/states/walk.js`, `src/states/roundbreak.js` — flow routed through `netFlow`.

The WebSocket relay itself works (verified: `phase` + `clock` messages forward between two clients, colors assigned distinct W/B).

## Likely remaining work when we pick this back up
- **Coin flip:** the walk/coin-toss screen still runs independently per client — drive the toss reveal + walk→chess entry purely from the authority (the colors are already server-assigned, so only the *timing/animation* needs syncing).
- **Chess move / half-timer drift:** the peer still decrements its own clocks and can self-trigger half endings. Make the peer never self-resolve the half; rely solely on the authority's relayed transitions + clock snapshots. Verify the snapshot adoption (`applyNetClock`) is actually firing during the chess half.
- **Authority-backgrounded liveness:** rAF pauses in a hidden tab; consider a `setInterval` pump so the authority's clock/transitions keep advancing while its tab is backgrounded.
- Validate with two real browser windows (single-client + protocol tests pass, but full game-flow sync was never confirmed live).
