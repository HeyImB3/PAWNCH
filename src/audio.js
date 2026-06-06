// PAWNCH audio — a tiny chiptune engine built on the Web Audio API.
// Square/triangle/noise voices, a step sequencer for looping music, and a
// bank of SFX. No audio files: everything is synthesized at runtime.

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let started = false;

const settings = { master: 0.8, music: 0.7, sfx: 0.9 };
let current = null; // { name, stop }

const NOTES = {}; // name -> frequency
(function buildNotes() {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let oct = 1; oct <= 6; oct++) {
    for (let n = 0; n < 12; n++) {
      const midi = 12 * (oct + 1) + n;
      NOTES[names[n] + oct] = 440 * Math.pow(2, (midi - 69) / 12);
    }
  }
})();
const f = (name) => (name === '-' || !name ? 0 : NOTES[name] || 0);

export function ensureAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  musicGain = ctx.createGain();
  sfxGain = ctx.createGain();
  musicGain.connect(master);
  sfxGain.connect(master);
  master.connect(ctx.destination);
  applyVolumes();
}

export function resume() {
  ensureAudio();
  if (ctx.state === 'suspended') ctx.resume();
  started = true;
}

export function setVolumes(v) {
  Object.assign(settings, v);
  applyVolumes();
}
export function getVolumes() { return { ...settings }; }
let musicMuted = false;
export function toggleMusicMute() { musicMuted = !musicMuted; applyVolumes(); return musicMuted; }
export function isMusicMuted() { return musicMuted; }
function applyVolumes() {
  if (!ctx) return;
  master.gain.value = settings.master;
  musicGain.gain.value = musicMuted ? 0 : settings.music;
  sfxGain.gain.value = settings.sfx;
}

// --- low-level voice ----------------------------------------------------
function blip(dest, { type = 'square', freq, t, dur, vol = 0.2, decay = true, detune = 0 }) {
  if (!freq) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (detune) osc.detune.setValueAtTime(detune, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  if (decay) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  else { g.gain.setValueAtTime(vol, t + dur - 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  osc.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function noise(dest, { t, dur, vol = 0.3, hp = 0 }) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = src;
  if (hp) { const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = hp; src.connect(filt); node = filt; }
  node.connect(g); g.connect(dest);
  src.start(t); src.stop(t + dur);
}

// --- SFX ----------------------------------------------------------------
export const sfx = {
  move()    { _sfx(() => blip(sfxGain, { type: 'square', freq: f('C5'), t: ctx.currentTime, dur: 0.07, vol: 0.18 })); },
  capture() { _sfx(() => { const t = ctx.currentTime; blip(sfxGain, { type: 'square', freq: f('G3'), t, dur: 0.12, vol: 0.25 }); noise(sfxGain, { t, dur: 0.12, vol: 0.2, hp: 800 }); }); },
  check()   { _sfx(() => { const t = ctx.currentTime; blip(sfxGain, { type: 'square', freq: f('E5'), t, dur: 0.09, vol: 0.22 }); blip(sfxGain, { type: 'square', freq: f('B5'), t: t + 0.08, dur: 0.12, vol: 0.22 }); }); },
  select()  { _sfx(() => blip(sfxGain, { type: 'square', freq: f('E4'), t: ctx.currentTime, dur: 0.05, vol: 0.18 })); },
  confirm() { _sfx(() => { const t = ctx.currentTime; blip(sfxGain, { type: 'square', freq: f('C5'), t, dur: 0.07, vol: 0.2 }); blip(sfxGain, { type: 'square', freq: f('G5'), t: t + 0.06, dur: 0.1, vol: 0.2 }); }); },
  jab()     { _sfx(() => { const t = ctx.currentTime; noise(sfxGain, { t, dur: 0.06, vol: 0.25, hp: 1200 }); blip(sfxGain, { type: 'square', freq: f('A4'), t, dur: 0.05, vol: 0.15 }); }); },
  hook()    { _sfx(() => { const t = ctx.currentTime; noise(sfxGain, { t, dur: 0.1, vol: 0.32, hp: 500 }); blip(sfxGain, { type: 'square', freq: f('D4'), t, dur: 0.08, vol: 0.2 }); }); },
  hit()     { _sfx(() => { const t = ctx.currentTime; noise(sfxGain, { t, dur: 0.14, vol: 0.4, hp: 200 }); blip(sfxGain, { type: 'triangle', freq: f('A2'), t, dur: 0.14, vol: 0.3 }); }); },
  dodge()   { _sfx(() => blip(sfxGain, { type: 'triangle', freq: f('G5'), t: ctx.currentTime, dur: 0.08, vol: 0.16, detune: -400 })); },
  block()   { _sfx(() => noise(sfxGain, { t: ctx.currentTime, dur: 0.05, vol: 0.2, hp: 2000 })); },
  // PERFECT PARRY — a bright ascending arcade "star" twinkle: a fast rising
  // arpeggio capped by a high shimmer, so a clean parry feels rewarding.
  parry()   { _sfx(() => { const t = ctx.currentTime; [1047, 1319, 1568, 2093].forEach((fr, i) => blip(sfxGain, { type: 'square', freq: fr, t: t + i * 0.045, dur: 0.08, vol: 0.22 })); blip(sfxGain, { type: 'triangle', freq: 2637, t: t + 0.16, dur: 0.22, vol: 0.16 }); noise(sfxGain, { t, dur: 0.05, vol: 0.1, hp: 3000 }); }); },
  bell()    { _sfx(() => { const t = ctx.currentTime; for (let i = 0; i < 3; i++) blip(sfxGain, { type: 'triangle', freq: f('A5'), t: t + i * 0.18, dur: 0.16, vol: 0.3 }); }); },
  // a short, punchy upward blip for each get-up mash — pitch climbs with the bar.
  getup(charge = 0) { _sfx(() => { const t = ctx.currentTime; const base = 320 + charge * 520; blip(sfxGain, { type: 'square', freq: base, t, dur: 0.05, vol: 0.2 }); noise(sfxGain, { t, dur: 0.04, vol: 0.12, hp: 1400 }); }); },
  ko()      { _sfx(() => { const t = ctx.currentTime; [f('C5'), f('G4'), f('E4'), f('C4')].forEach((fr, i) => blip(sfxGain, { type: 'square', freq: fr, t: t + i * 0.12, dur: 0.18, vol: 0.28 })); }); },
  win()     { _sfx(() => { const t = ctx.currentTime; [f('C5'), f('E5'), f('G5'), f('C6')].forEach((fr, i) => blip(sfxGain, { type: 'square', freq: fr, t: t + i * 0.1, dur: 0.16, vol: 0.26 })); }); },
};
function _sfx(fn) { if (!ctx || !started) return; fn(); }

// --- music sequencer ----------------------------------------------------
// A song = { bpm, lead:[...], bass:[...], drums:[...] } where each track is an
// array of step tokens. '-' = rest, otherwise a note name. Loops forever.
function playSong(song) {
  stopMusic();
  const stepDur = 60 / song.bpm / 2; // 8th notes
  const len = Math.max(song.lead.length, song.bass.length, (song.drums || []).length);
  let step = 0;
  let stopped = false;
  let nextTime = ctx.currentTime + 0.06;

  function schedule() {
    if (stopped) return;
    while (nextTime < ctx.currentTime + 0.2) {
      const s = step % len;
      const lead = song.lead[s % song.lead.length];
      const bass = song.bass[s % song.bass.length];
      const arp = song.arp ? song.arp[s % song.arp.length] : '-';
      const dr = song.drums ? song.drums[s % song.drums.length] : '-';
      const lv = song.leadVol ?? 0.12;
      if (lead && lead !== '-') {
        blip(musicGain, { type: 'square', freq: f(lead), t: nextTime, dur: stepDur * 0.95, vol: lv });
        if (song.lead2) blip(musicGain, { type: 'square', freq: f(lead) * 1.003, t: nextTime, dur: stepDur * 0.95, vol: lv * 0.5, detune: 8 }); // subtle detuned doubling
      }
      if (bass && bass !== '-') blip(musicGain, { type: 'triangle', freq: f(bass), t: nextTime, dur: stepDur * 1.4, vol: 0.16 });
      if (arp && arp !== '-') blip(musicGain, { type: 'square', freq: f(arp), t: nextTime, dur: stepDur * 0.5, vol: 0.06 });
      if (dr === 'k') { noise(musicGain, { t: nextTime, dur: 0.06, vol: 0.18, hp: 80 }); blip(musicGain, { type: 'sine', freq: 110, t: nextTime, dur: 0.08, vol: 0.2 }); }
      if (dr === 's') noise(musicGain, { t: nextTime, dur: 0.08, vol: 0.2, hp: 1500 });
      if (dr === 'h') noise(musicGain, { t: nextTime, dur: 0.03, vol: 0.08, hp: 6000 });
      if (dr === 'H') noise(musicGain, { t: nextTime, dur: 0.05, vol: 0.12, hp: 5000 }); // open hat
      nextTime += stepDur;
      step++;
    }
    current.timer = setTimeout(schedule, 50);
  }
  current = { name: song.name, timer: null, stop: () => { stopped = true; clearTimeout(current.timer); } };
  schedule();
}

export function stopMusic() {
  if (current) { current.stop(); current = null; }
}

export function playTitleTheme() { if (!ctx || !started) return; if (current?.name === 'title') return; playSong(TITLE); }
export function playFightTheme(variant = 0) {
  if (!ctx || !started) return;
  const song = FIGHT_TRACKS[variant % FIGHT_TRACKS.length];
  if (current?.name === song.name) return;
  playSong(song);
}
export function nowPlaying() { return current?.name || null; }

// --- the tunes ----------------------------------------------------------
// Anthemic arcade march for the title.
const TITLE = {
  name: 'title', bpm: 132,
  lead: [
    'C5','-','E5','G5','C6','-','G5','E5', 'F5','-','A5','C6','A5','-','G5','-',
    'E5','-','G5','C6','E6','-','C6','G5', 'D5','-','F5','A5','G5','-','E5','-',
  ],
  bass: [
    'C3','C3','G3','C3','C3','C3','G3','C3', 'F3','F3','C3','F3','F3','F3','C3','F3',
    'C3','C3','G3','C3','C3','C3','G3','C3', 'G3','G3','D3','G3','G3','G3','D3','G3',
  ],
  drums: ['k','h','s','h','k','h','s','h','k','h','s','h','k','h','s','h'],
};

// Driving, aggressive arcade-fighter theme (in-match). Fast minor riff with a
// galloping bass, an arpeggio shimmer, a doubled lead, and a busy drum line.
const FIGHT = {
  name: 'fight', bpm: 168, leadVol: 0.13, lead2: true,
  lead: [
    'A4','E5','A4','C5','E5','C5','A4','-',  'A4','E5','A4','D5','F5','E5','D5','-',
    'A4','E5','A4','C5','E5','G5','E5','-',  'F5','E5','D5','C5','B4','-','E5','-',
  ],
  bass: [
    'A2','A2','A3','A2','E2','E2','E3','E2', 'A2','A2','A3','A2','D2','D2','D3','D2',
    'A2','A2','A3','A2','C2','C2','C3','C2', 'F2','F2','F3','F2','E2','E2','E2','E2',
  ],
  arp: [
    'A4','C5','E5','C5','A4','C5','E5','C5', 'A4','D5','F5','D5','A4','D5','F5','D5',
    'A4','C5','E5','C5','C5','E5','G5','E5', 'F4','A4','C5','A4','E4','G4','B4','G4',
  ],
  drums: ['k','h','s','H','k','k','s','h','k','h','s','H','k','s','s','H'],
};

// A second in-match theme (alternates per opponent): bouncier, "boss rush" feel.
const FIGHT2 = {
  name: 'fight2', bpm: 156, leadVol: 0.13, lead2: true,
  lead: [
    'E5','-','D5','E5','G5','E5','D5','-',  'C5','-','B4','C5','E5','C5','B4','-',
    'A4','-','C5','E5','A5','-','G5','E5',  'D5','E5','D5','C5','B4','-','-','-',
  ],
  bass: [
    'E2','E2','E3','E2','G2','G2','G3','G2', 'C2','C2','C3','C2','C2','C2','G2','G2',
    'A2','A2','A3','A2','A2','A2','E2','E2', 'D2','D2','D3','D2','E2','E2','B2','B2',
  ],
  arp: [
    'E5','G5','B5','G5','E5','G5','B5','G5', 'C5','E5','G5','E5','C5','E5','G5','E5',
    'A4','C5','E5','C5','A4','C5','E5','C5', 'B4','D5','G5','D5','E5','G5','B5','G5',
  ],
  drums: ['k','h','H','h','s','h','k','h','k','h','H','h','s','h','s','H'],
};

const FIGHT_TRACKS = [FIGHT, FIGHT2];
