// A completely original, fully synthesized sound engine — no audio files.
// Every SFX is built from oscillators/noise + gain envelopes on the Web
// Audio API. Background music is a small generative scheduler so each
// world gets its own looping, seamless, reactive track.

let ctx = null;
let master = null, sfxGain = null, musicGain = null;
let noiseBuffer = null;
let soundOn = true, musicOn = true;
let started = false;

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = soundOn ? 0.85 : 0; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = musicOn ? 0.5 : 0; musicGain.connect(master);
  noiseBuffer = makeNoiseBuffer(ctx);
  return ctx;
}

function makeNoiseBuffer(ac) {
  const len = ac.sampleRate * 1.0;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Must be called from a user gesture (tap) to satisfy autoplay policies.
export function unlockAudio() {
  ensureContext();
  if (ctx.state === 'suspended') ctx.resume();
  started = true;
}

export function setSoundOn(v) { soundOn = v; if (sfxGain) sfxGain.gain.setTargetAtTime(v ? 0.85 : 0, ctx.currentTime, 0.05); }
export function setMusicOn(v) { musicOn = v; if (musicGain) musicGain.gain.setTargetAtTime(v ? 0.5 : 0, ctx.currentTime, 0.05); }

function now() { return ctx.currentTime; }

function envGain(dest, peak, attack, decay, delay = 0) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now() + delay);
  g.gain.linearRampToValueAtTime(peak, now() + delay + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.001), now() + delay + attack + decay);
  g.connect(dest);
  return g;
}

function tone({ freq, type = 'sine', duration = 0.2, peak = 0.5, attack = 0.01, detune = 0, delay = 0, dest = sfxGain, pitchTo = null }) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now() + delay);
  if (pitchTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, pitchTo), now() + delay + duration);
  osc.detune.value = detune;
  const g = envGain(dest, peak, attack, duration, delay);
  osc.connect(g);
  osc.start(now() + delay);
  osc.stop(now() + delay + duration + 0.05);
  return osc;
}

function noiseBurst({ duration = 0.15, peak = 0.4, delay = 0, filterFreq = 2000, filterTo = null, type = 'lowpass', dest = sfxGain }) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(filterFreq, now() + delay);
  if (filterTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), now() + delay + duration);
  const g = envGain(dest, peak, 0.005, duration, delay);
  src.connect(filt).connect(g);
  src.start(now() + delay);
  src.stop(now() + delay + duration + 0.05);
}

// ---- SFX -----------------------------------------------------------------

const hueToSemitone = (hue) => ((hue / 360) * 12) - 6; // ±6 semitones across the color wheel

export function playPour(colorHue = 200) {
  if (!ctx || !soundOn) return;
  const semis = hueToSemitone(colorHue);
  const base = 260 * Math.pow(2, semis / 12);
  noiseBurst({ duration: 0.4, peak: 0.22, filterFreq: 1600, filterTo: 400, type: 'bandpass' });
  tone({ freq: base, type: 'sine', duration: 0.35, peak: 0.18, attack: 0.03, pitchTo: base * 0.6 });
  tone({ freq: base * 2.4, type: 'triangle', duration: 0.28, peak: 0.05, delay: 0.28, attack: 0.005, pitchTo: base * 3.6 });
}

export function playMatch() {
  if (!ctx || !soundOn) return;
  noiseBurst({ duration: 0.05, peak: 0.3, filterFreq: 2500, type: 'highpass' });
  tone({ freq: 520, type: 'square', duration: 0.09, peak: 0.18, delay: 0.05, attack: 0.005 });
  [880, 1175, 1568].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.16, peak: 0.12, delay: 0.13 + i * 0.045, attack: 0.004 }));
}

export function playPerfect() {
  if (!ctx || !soundOn) return;
  tone({ freq: 220, type: 'sine', duration: 0.28, peak: 0.28, attack: 0.02, pitchTo: 520 });
  tone({ freq: 660, type: 'square', duration: 0.08, peak: 0.14, delay: 0.26, attack: 0.004 });
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, type: 'sine', duration: 0.6, peak: 0.14, delay: 0.32 + i * 0.02, attack: 0.01, detune: i * 3 }));
}

export function playInvalid() {
  if (!ctx || !soundOn) return;
  tone({ freq: 260, type: 'sine', duration: 0.22, peak: 0.16, attack: 0.01, pitchTo: 140 });
  tone({ freq: 180, type: 'sine', duration: 0.18, peak: 0.08, delay: 0.05, attack: 0.01, pitchTo: 110 });
}

export function playButtonTap() {
  if (!ctx || !soundOn) return;
  tone({ freq: 720, type: 'square', duration: 0.05, peak: 0.1, attack: 0.002, pitchTo: 900 });
}

export function playSelect() {
  if (!ctx || !soundOn) return;
  tone({ freq: 340, type: 'triangle', duration: 0.09, peak: 0.16, attack: 0.002, pitchTo: 460 });
}

export function playLevelComplete() {
  if (!ctx || !soundOn) return;
  tone({ freq: 523.25, type: 'square', duration: 0.09, peak: 0.16, delay: 0 });
  tone({ freq: 659.25, type: 'square', duration: 0.09, peak: 0.16, delay: 0.11 });
  tone({ freq: 392, type: 'sine', duration: 0.35, peak: 0.16, delay: 0.24, pitchTo: 880, attack: 0.02 });
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.8, peak: 0.13, delay: 0.55 + i * 0.02, attack: 0.01 }));
  noiseBurst({ duration: 0.5, peak: 0.08, delay: 0.55, filterFreq: 6000, type: 'highpass' });
}

export function playCoins(count = 1) {
  if (!ctx || !soundOn) return;
  const n = Math.min(count, 8);
  for (let i = 0; i < n; i++) {
    const f = 900 + i * 60;
    tone({ freq: f, type: 'square', duration: 0.09, peak: 0.14, delay: i * 0.07, attack: 0.002, pitchTo: f * 1.8 });
  }
  if (n >= 3) tone({ freq: 1568, type: 'triangle', duration: 0.4, peak: 0.16, delay: n * 0.07 + 0.05, attack: 0.005 });
}

// Combo reactivity: tier 1..5+ per the design brief.
export function playCombo(tier) {
  if (!ctx || !soundOn) return;
  const t = Math.max(1, tier);
  if (t === 1) { tone({ freq: 660, type: 'square', duration: 0.07, peak: 0.14 }); return; }
  if (t === 2) { tone({ freq: 660, type: 'square', duration: 0.06, peak: 0.13 }); tone({ freq: 880, type: 'triangle', duration: 0.12, peak: 0.12, delay: 0.06 }); return; }
  if (t === 3) { tone({ freq: 700, type: 'square', duration: 0.06, peak: 0.13 }); [1046.5, 1318.5].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.14, peak: 0.1, delay: 0.06 + i * 0.05 })); return; }
  if (t === 4) { tone({ freq: 740, type: 'square', duration: 0.06, peak: 0.13 }); [523.25, 659.25, 783.99].forEach((f) => tone({ freq: f, type: 'sine', duration: 0.3, peak: 0.1, delay: 0.08, attack: 0.01 })); return; }
  // 5+: a short funky ascending phrase, root shifts up slightly each escalation.
  const root = 523.25 * Math.pow(2, ((t - 5) % 4) / 12);
  const phrase = [0, 3, 5, 7, 10].map((s) => root * Math.pow(2, s / 12));
  phrase.forEach((f, i) => tone({ freq: f, type: 'sawtooth', duration: 0.14, peak: 0.12, delay: i * 0.075, attack: 0.004 }));
}

// ---- Generative background music -----------------------------------------
// A tiny lookahead scheduler (the standard trick for drift-free WebAudio
// timing) driving a bass line + arpeggio + light percussion per world.

export class MusicScheduler {
  constructor(worldConfig) {
    this.cfg = worldConfig;
    this.playing = false;
    this.nextNoteTime = 0;
    this.step = 0;
    this.stepsPerBar = 8;
    this.intensity = 0; // 0..1, raised by combo streaks
    this._timer = null;
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  start() {
    if (!ctx || this.playing) return;
    this.playing = true;
    this.nextNoteTime = now() + 0.05;
    this._tick();
  }

  stop() {
    this.playing = false;
    if (this._timer) clearTimeout(this._timer);
  }

  _tick() {
    if (!this.playing) return;
    const secondsPerStep = 60 / this.cfg.tempo / 2;
    while (this.nextNoteTime < now() + 0.15) {
      this._scheduleStep(this.step, this.nextNoteTime);
      this.step = (this.step + 1) % this.stepsPerBar;
      this.nextNoteTime += secondsPerStep;
    }
    this._timer = setTimeout(() => this._tick(), 40);
  }

  _scheduleStep(step, t) {
    const { root, scale, wave, bass } = this.cfg;
    const delay = t - now();
    // Bass on the downbeats.
    if (step % 4 === 0) {
      const deg = scale[(step / 4) % scale.length | 0];
      const f = (root / 2) * Math.pow(2, deg / 12);
      tone({ freq: f, type: bass, duration: 0.22, peak: 0.16 + this.intensity * 0.05, delay, attack: 0.005, dest: musicGain });
    }
    // Arpeggio, denser as intensity rises.
    const arpActive = step % 2 === 0 || this.intensity > 0.4;
    if (arpActive) {
      const deg = scale[(step + Math.floor(this.intensity * 3)) % scale.length];
      const f = root * Math.pow(2, deg / 12);
      tone({ freq: f, type: wave, duration: 0.16, peak: 0.07 + this.intensity * 0.05, delay, attack: 0.005, dest: musicGain });
    }
    // Light percussion tick, more frequent at high intensity.
    if (step % 2 === 1 || (this.intensity > 0.6 && step % 1 === 0)) {
      noiseBurst({ duration: 0.04, peak: 0.05 + this.intensity * 0.04, delay, filterFreq: 5000, type: 'highpass', dest: musicGain });
    }
  }
}

export function isStarted() { return started; }
