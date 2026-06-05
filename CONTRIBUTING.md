# Contributing to PAWNCH 🥊♟️

Thanks for wanting to help out! PAWNCH is an open (MIT) chess-boxing game, built to
stay simple and easy to iterate on toward a Steam release. Whether you're fixing a
typo or adding a whole new opponent, you're welcome here.

## What you need

- A modern browser.
- **Either** Python 3 **or** Node.js — just to serve the files locally (there's no
  build step).
- Git, and a GitHub account.

## Run it locally

The game is plain ES modules, so it has to be served over `http://` (opening the
HTML directly as a `file://` won't work):

```bash
npm run dev      # uses Python:  python3 -m http.server 5173
# or, with Node only:
npm start        # npx serve -l 5173 .
```

Open the printed URL (e.g. http://localhost:5173) and **click once** so audio can
start. Online multiplayer also needs the relay server (`npm run server`) — see
[`docs/HOSTING.md`](docs/HOSTING.md). Most changes don't need it.

## How the project is laid out

The [`README.md`](README.md) has the full architecture map. The short version: all
gameplay tuning and the color palette live in `src/config.js`; each screen is a
"state" in `src/states/`; the chess engine is in `src/chess/`; the boxing sim is
`src/boxing.js`. If you use Claude Code, [`CLAUDE.md`](CLAUDE.md) documents the
conventions (and there are `/new-opponent` and `/new-state` shortcuts).

## Making a change

1. **Make a branch** — never commit straight to `main`:
   ```bash
   git checkout -b my-change
   ```
2. **Edit, then test in the browser.** There's no automated test suite, so actually
   play the part you changed (Story Mode + local hotseat cover most of it). Watch
   the browser console for errors.
3. **Keep the house style:** vanilla ES modules, no new dependencies or build step,
   colors from `PAL`, anything you might want to tune from `src/config.js`.
4. **Commit** with a clear message, **push** your branch, and **open a Pull
   Request** describing what you changed and how you tested it. Small, focused PRs
   are the easiest to review and merge.

## Good first things to try

From the roadmap in the README:

- Repaint the procedural sprites with real Aseprite art (the loader is ready — see
  `assets/sprites/` and `tools/sprite-gen.html`).
- Tune or extend the opponent ladder in `src/opponents.js`.
- Add colorblind-friendly palettes or difficulty options.
- Improve the online boxing netcode (currently beta).

## Be kind

This is a hobby project meant to be fun. Please be respectful and constructive in
issues and reviews. 💛
