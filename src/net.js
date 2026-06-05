// PAWNCH online client.
//
// Tiny JSON-over-WebSocket protocol matching /server/server.js. Handles:
// connect, queue, relay chess moves + boxing actions, and — hardened for
// v0.1 — a rejoin TOKEN + automatic reconnection so a dropped connection can
// resume the same match within the server's grace window.
//
// Events (subscribe with .on): matched, move, box, phase, chat,
// opponentDisconnected, opponentReturned, opponentLeft, reconnecting,
// reconnected, gaveup, close, error.

import { NET } from './config.js';

const TOKEN_KEY = 'pawnch.netToken';

function defaultUrl() {
  if (NET.url) return NET.url;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.hostname || 'localhost';
  return `${proto}://${host}:8080`;
}

export class NetClient {
  constructor(url = defaultUrl()) {
    this.url = url;
    this.ws = null;
    this.id = null;
    this.color = null;
    this.name = 'PLAYER';
    this.token = localStorage.getItem(TOKEN_KEY) || null;
    this.handlers = {};
    this.connected = false;
    this.matched = false;          // have we ever been matched this session?
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.maxReconnects = 6;
  }

  on(evt, fn) { (this.handlers[evt] ||= []).push(fn); return this; }
  _emit(evt, data) { (this.handlers[evt] || []).forEach((f) => f(data)); }

  connect() {
    return new Promise((resolve, reject) => {
      try { this.ws = new WebSocket(this.url); }
      catch (e) { return reject(e); }
      const to = setTimeout(() => reject(new Error('connect timeout')), 5000);
      this.ws.onopen = () => { clearTimeout(to); this.connected = true; this.reconnectAttempts = 0; resolve(); };
      this.ws.onerror = (e) => { clearTimeout(to); this._emit('error', e); reject(e); };
      this.ws.onclose = () => this._onClose();
      this.ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this._route(m); };
    });
  }

  _route(msg) {
    switch (msg.t) {
      case 'welcome': this.id = msg.id; break;
      case 'matched':
        this.matched = true;
        this.color = msg.color;
        if (msg.token) { this.token = msg.token; try { localStorage.setItem(TOKEN_KEY, msg.token); } catch {} }
        // a rejoin re-match resumes — don't restart the local game
        this._emit(msg.rejoin ? 'reconnected' : 'matched', msg);
        break;
      case 'move': this._emit('move', msg); break;
      case 'box': this._emit('box', msg); break;
      case 'phase': this._emit('phase', msg); break;
      case 'chat': this._emit('chat', msg); break;
      case 'opponentDisconnected': this._emit('opponentDisconnected', msg); break;
      case 'opponentReturned': this._emit('opponentReturned', msg); break;
      case 'opponentLeft': this.matched = false; this._emit('opponentLeft', msg); break;
      default: this._emit(msg.t, msg);
    }
  }

  _onClose() {
    this.connected = false;
    this._emit('close');
    // auto-reconnect only if we were mid-match and didn't leave on purpose
    if (this.intentionalClose || !this.matched) return;
    if (this.reconnectAttempts >= this.maxReconnects) { this._emit('gaveup'); return; }
    const delay = Math.min(4000, 400 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts++;
    this._emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    setTimeout(() => {
      this.connect().then(() => this.queue(this.name)).catch(() => this._onClose());
    }, delay);
  }

  _send(obj) { if (this.connected) this.ws.send(JSON.stringify(obj)); }

  queue(name) { this.name = name || this.name; this._send({ t: 'queue', name: this.name, token: this.token }); }
  sendMove(move) { this._send({ t: 'move', move }); }
  sendBox(action) { this._send({ t: 'box', action }); }
  sendPhase(phase, payload) { this._send({ t: 'phase', phase, payload }); }
  leave() { this.intentionalClose = true; this.matched = false; this._send({ t: 'leave' }); this.ws?.close(); }
}
