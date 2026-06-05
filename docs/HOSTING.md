# Hosting PAWNCH online multiplayer

The game itself is static (it runs great on GitHub Pages). **Online multiplayer
is the one piece that needs a small always-on server** — the WebSocket relay in
[`server/server.js`](../server/server.js) that matchmakes two players and
forwards their moves. This guide shows the easiest ways to run it.

> You don't need any of this to play Story Mode, local hotseat, or to share the
> Pages link. It's only for internet head-to-head.

## How the pieces fit together

```
  Player A  ──┐                                  ┌── Player B
 (browser)    │   wss://your-server:8080         │   (browser)
   GitHub  ───┼──────────  RELAY  ───────────────┼───  GitHub
   Pages      │     (server/server.js, Node)     │     Pages
              └──────────────────────────────────┘
```

Both players load the **same Pages site**; their browsers connect to the **same
relay server** you host. The site needs to know where that server is.

## 1) Run it locally (LAN / same machine — for testing)

```bash
cd server
npm install
node server.js            # listens on ws://localhost:8080
```

Two browser tabs on the same machine can now play (Multiplayer → Online Match).
For two machines on the same Wi-Fi, use the host's LAN IP (e.g. `ws://192.168.1.20:8080`).

## 2) Host it on the internet (pick one)

The server is a tiny Node app, so any host that runs Node works. Free/cheap options:

- **Render.com** (free tier): New → *Web Service* → connect this repo → Root
  Directory `server`, Build `npm install`, Start `node server.js`. Render gives
  you a URL like `your-app.onrender.com` (it serves WSS automatically).
- **Railway.app / Fly.io / Glitch**: same idea — point them at the `server/`
  folder, build `npm install`, start `node server.js`.
- **A VPS** (DigitalOcean, etc.): `git clone`, `cd server && npm install`, then
  run it under `pm2` or `systemd` so it stays up.

### Important: WSS vs WS

GitHub Pages is served over **HTTPS**, and browsers refuse to open an insecure
`ws://` socket from an `https://` page. So your hosted server must be reachable
over **`wss://`** (secure WebSocket). Managed hosts (Render/Railway/Fly) give you
HTTPS/WSS for free. On a raw VPS you'd put it behind a TLS reverse proxy
(Caddy/Nginx) or use a tunnel like Cloudflare Tunnel.

## 3) Point the game at your server

Edit [`src/config.js`](../src/config.js) and set the URL:

```js
export const NET = {
  url: 'wss://your-app.onrender.com',   // your hosted relay
};
```

Commit + push; GitHub Pages redeploys in a minute and Online Match will connect
there. (Leave `url: null` to default to `ws://<page-host>:8080`, which is handy
for local testing but won't work from the live HTTPS site.)

## Notes / next steps

- The current relay is **authoritative-lite**: clients own their own state and it
  just forwards messages, with heartbeat + a rejoin token for dropped players.
  Chess sync is deterministic and solid; boxing sync is **beta**.
- For a real launch you'd add: room codes / invite links, rate limiting, and
  ideally server-side validation or rollback for the boxing half.
- Set the port via the `PORT` env var if your host assigns one
  (`PORT=xxxx node server.js`).
