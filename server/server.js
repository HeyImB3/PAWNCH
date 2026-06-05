// PAWNCH match server.
//
// Relay + matchmaking with hardening for v0.1:
//   - heartbeat ping/pong so dead sockets are detected & cleaned up
//   - rooms with a rejoin TOKEN: if a player drops, their seat is held for a
//     grace window so they can reconnect and resume the same match
//   - partner notifications: opponentDisconnected (grace) / opponentReturned /
//     opponentLeft (final)
// Clients own their own game state; the server just forwards move/box/phase.
//
// Run:  cd server && npm install && node server.js
// Env:  PORT (default 8080), GRACE_MS (default 20000)

import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const GRACE_MS = process.env.GRACE_MS ? Number(process.env.GRACE_MS) : 20000;
const HEARTBEAT_MS = 15000;

const wss = new WebSocketServer({ port: PORT });

let nextId = 1;
const waiting = [];              // sockets waiting to be matched
const rooms = new Map();         // roomId -> { id, seats: [seat, seat] }
const byToken = new Map();       // token -> seat (for rejoin)
// seat: { token, color, name, ws|null, online, roomId }

const send = (ws, obj) => { if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); };

wss.on('connection', (ws) => {
  ws.id = 'P' + nextId++;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, { t: 'welcome', id: ws.id });
  console.log(`[+] ${ws.id} connected (${wss.clients.size} online)`);

  ws.on('message', (data) => {
    let msg; try { msg = JSON.parse(data); } catch { return; }

    if (msg.t === 'queue') return handleQueue(ws, msg);
    if (msg.t === 'leave') return leaveRoom(ws, true);

    // relay to partner
    const partner = partnerOf(ws);
    if (partner) send(partner, msg);
  });

  ws.on('close', () => {
    console.log(`[-] ${ws.id} disconnected`);
    const i = waiting.indexOf(ws); if (i >= 0) waiting.splice(i, 1);
    handleDrop(ws);
  });
});

function handleQueue(ws, msg) {
  ws.name = (msg.name || 'PLAYER').slice(0, 16);
  const token = msg.token;

  // rejoin path: known token with a held seat in a live room
  if (token && byToken.has(token)) {
    const seat = byToken.get(token);
    const room = rooms.get(seat.roomId);
    if (room) {
      seat.ws = ws; seat.online = true; seat.name = ws.name;
      ws.token = token; ws.roomId = room.id; ws.color = seat.color;
      if (seat.rejoinTimer) { clearTimeout(seat.rejoinTimer); seat.rejoinTimer = null; }
      send(ws, { t: 'matched', color: seat.color, oppName: otherSeat(room, seat).name, rejoin: true });
      const partner = otherSeat(room, seat).ws;
      send(partner, { t: 'opponentReturned' });
      console.log(`[~] ${ws.id} rejoined room ${room.id} as ${seat.color}`);
      return;
    }
    byToken.delete(token); // stale
  }

  enqueue(ws, token);
}

function enqueue(ws, token) {
  if (waiting.includes(ws) || ws.roomId) return;
  ws.token = token || randomUUID();
  if (waiting.length > 0) pair(waiting.shift(), ws);
  else { waiting.push(ws); console.log(`    ${ws.id} queued`); }
}

function pair(a, b) {
  const room = { id: randomUUID().slice(0, 8), seats: [] };
  // coin toss: randomly decide which of the two gets the white pieces
  const [aColor, bColor] = Math.random() < 0.5 ? ['w', 'b'] : ['b', 'w'];
  const seatA = { token: a.token, color: aColor, name: a.name, ws: a, online: true, roomId: room.id };
  const seatB = { token: b.token, color: bColor, name: b.name, ws: b, online: true, roomId: room.id };
  room.seats = [seatA, seatB];
  rooms.set(room.id, room);
  byToken.set(seatA.token, seatA); byToken.set(seatB.token, seatB);
  a.roomId = b.roomId = room.id; a.color = aColor; b.color = bColor;
  send(a, { t: 'matched', color: aColor, oppName: b.name, token: a.token });
  send(b, { t: 'matched', color: bColor, oppName: a.name, token: b.token });
  console.log(`[=] room ${room.id}: ${a.id}(${aColor.toUpperCase()}) vs ${b.id}(${bColor.toUpperCase()})`);
}

function handleDrop(ws) {
  if (!ws.roomId) return;
  const room = rooms.get(ws.roomId);
  if (!room) return;
  const seat = room.seats.find((s) => s.ws === ws);
  if (!seat) return;
  seat.online = false; seat.ws = null;
  const partner = otherSeat(room, seat);
  send(partner.ws, { t: 'opponentDisconnected', graceMs: GRACE_MS });
  // hold the seat for a grace window, then end the room
  seat.rejoinTimer = setTimeout(() => closeRoom(room, 'opponentLeft'), GRACE_MS);
}

function leaveRoom(ws, notify) {
  const room = ws.roomId && rooms.get(ws.roomId);
  if (room) closeRoom(room, 'opponentLeft');
  ws.roomId = null;
}

function closeRoom(room, reason) {
  if (!rooms.has(room.id)) return;
  for (const s of room.seats) {
    if (s.rejoinTimer) clearTimeout(s.rejoinTimer);
    byToken.delete(s.token);
    if (s.online && s.ws) { send(s.ws, { t: reason }); s.ws.roomId = null; }
  }
  rooms.delete(room.id);
  console.log(`[x] room ${room.id} closed (${reason})`);
}

function otherSeat(room, seat) { return room.seats[0] === seat ? room.seats[1] : room.seats[0]; }
function partnerOf(ws) {
  const room = ws.roomId && rooms.get(ws.roomId);
  if (!room) return null;
  const seat = room.seats.find((s) => s.ws === ws);
  return seat ? otherSeat(room, seat).ws : null;
}

// heartbeat: terminate sockets that stop ponging
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, HEARTBEAT_MS);
wss.on('close', () => clearInterval(heartbeat));

console.log(`PAWNCH server listening on ws://localhost:${PORT}  (grace ${GRACE_MS}ms)`);
