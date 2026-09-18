// Fully procedural audio engine — every sound in LumenLoop is synthesized
// with the WebAudio API at runtime, so there are zero binary audio assets
// to ship or license. This keeps the whole game inside a handful of text
// files.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = { music: true, sfx: true };
    this._musicNodes = null;
    this._musicKind = null;
    this._intensity = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.enabled.music ? 0.35 : 0;
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.enabled.sfx ? 0.55 : 0;
    this.sfxGain.connect(this.ctx.destination);
  }

  setMusicEnabled(on) {
    this.enabled.music = on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.35 : 0, this.ctx.currentTime, 0.15);
  }

  setSfxEnabled(on) {
    this.enabled.sfx = on;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
  }

  // --- low-level building blocks -----------------------------------
  _tone({ freq, type = 'sine', duration = 0.2, gain = 0.3, sweepTo = null, delay = 0, out = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, duration * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(out || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _noise({ duration = 0.2, gain = 0.2, filterFreq = 2000, delay = 0, out = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(out || this.sfxGain);
    src.start(t0);
  }

  // --- SFX -----------------------------------------------------------
  collect(type = 'common') {
    const map = {
      common: { freq: 740, gain: 0.18, type: 'sine', dur: 0.09 },
      charged: { freq: 520, sweepTo: 900, gain: 0.22, type: 'triangle', dur: 0.14 },
      prism: { freq: 660, sweepTo: 1320, gain: 0.26, type: 'sine', dur: 0.22 },
      void: { freq: 220, sweepTo: 110, gain: 0.3, type: 'sawtooth', dur: 0.3 },
      ancient: { freq: 180, sweepTo: 720, gain: 0.35, type: 'triangle', dur: 0.5 },
    };
    const m = map[type] || map.common;
    this._tone({ freq: m.freq, sweepTo: m.sweepTo, type: m.type, duration: m.dur, gain: m.gain });
  }

  combo(level) {
    const base = 440 + level * 60;
    this._tone({ freq: base, type: 'square', duration: 0.08, gain: 0.12 });
    this._tone({ freq: base * 1.5, type: 'sine', duration: 0.12, gain: 0.14, delay: 0.05 });
  }

  ability(kind) {
    const map = {
      dash: { freq: 300, sweepTo: 900, dur: 0.22, type: 'sawtooth' },
      phase: { freq: 900, sweepTo: 200, dur: 0.35, type: 'sine' },
      magnet: { freq: 200, sweepTo: 500, dur: 0.3, type: 'triangle' },
      shield: { freq: 500, sweepTo: 700, dur: 0.25, type: 'square' },
    };
    const m = map[kind] || map.dash;
    this._tone({ freq: m.freq, sweepTo: m.sweepTo, type: m.type, duration: m.dur, gain: 0.24 });
    this._noise({ duration: 0.15, gain: 0.08, filterFreq: 3000 });
  }

  warning() {
    this._tone({ freq: 220, type: 'square', duration: 0.12, gain: 0.15 });
  }

  collision() {
    this._noise({ duration: 0.18, gain: 0.25, filterFreq: 700 });
    this._tone({ freq: 160, sweepTo: 60, type: 'sawtooth', duration: 0.22, gain: 0.2 });
  }

  eliminate() {
    this._noise({ duration: 0.5, gain: 0.3, filterFreq: 500 });
    this._tone({ freq: 500, sweepTo: 40, type: 'sawtooth', duration: 0.6, gain: 0.28 });
    this._tone({ freq: 1200, sweepTo: 80, type: 'sine', duration: 0.7, gain: 0.18, delay: 0.05 });
  }

  levelUp() {
    [0, 0.09, 0.18].forEach((d, i) => {
      this._tone({ freq: 440 * Math.pow(1.26, i), type: 'triangle', duration: 0.22, gain: 0.22, delay: d });
    });
  }

  victory() {
    [0, 0.12, 0.24, 0.4].forEach((d, i) => {
      this._tone({ freq: 392 * Math.pow(1.19, i), type: 'sine', duration: 0.5, gain: 0.2, delay: d });
    });
  }

  // --- Music ------------------------------------------------------
  stopMusic() {
    if (this._musicNodes) {
      const now = this.ctx.currentTime;
      for (const n of this._musicNodes.gains) n.gain.setTargetAtTime(0.0001, now, 0.4);
      const nodes = this._musicNodes;
      setTimeout(() => {
        nodes.oscs.forEach((o) => { try { o.stop(); } catch (e) {} });
      }, 1000);
      this._musicNodes = null;
      this._musicKind = null;
    }
  }

  startMenuMusic() {
    if (!this.ctx || this._musicKind === 'menu') return;
    this.stopMusic();
    this._musicKind = 'menu';
    const now = this.ctx.currentTime;
    const oscs = [], gains = [];
    const freqs = [110, 164.81, 220];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.05, now, 1.2);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.05;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(now);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      oscs.push(osc, lfo);
      gains.push(g);
    }
    this._musicNodes = { oscs, gains };
  }

  startMatchMusic() {
    if (!this.ctx || this._musicKind === 'match') return;
    this.stopMusic();
    this._musicKind = 'match';
    const now = this.ctx.currentTime;
    const oscs = [], gains = [];
    const pad = this.ctx.createOscillator();
    pad.type = 'sawtooth';
    pad.frequency.value = 55;
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 400;
    this._padFilter = padFilter;
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.0001;
    padGain.gain.setTargetAtTime(0.06, now, 1);
    pad.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.musicGain);
    pad.start(now);
    oscs.push(pad);
    gains.push(padGain);

    // Rhythmic pulse layer, gated by a simple gain-envelope sequencer.
    const pulse = this.ctx.createOscillator();
    pulse.type = 'triangle';
    pulse.frequency.value = 110;
    const pulseGain = this.ctx.createGain();
    pulseGain.gain.value = 0;
    pulse.connect(pulseGain);
    pulseGain.connect(this.musicGain);
    pulse.start(now);
    oscs.push(pulse);
    gains.push(pulseGain);
    this._pulseGain = pulseGain;
    this._pulseStep = 0;
    this._pulseTimer = setInterval(() => {
      if (!this.ctx || this._musicKind !== 'match') return;
      const t = this.ctx.currentTime;
      const on = this._pulseStep % 2 === 0;
      this._pulseStep++;
      if (on) {
        pulseGain.gain.cancelScheduledValues(t);
        pulseGain.gain.setValueAtTime(0.0001, t);
        pulseGain.gain.exponentialRampToValueAtTime(0.03 + this._intensity * 0.05, t + 0.02);
        pulseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      }
    }, 260);

    this._musicNodes = { oscs, gains };
  }

  // intensity in [0,1] — driven by player size / overcharge.
  setIntensity(intensity) {
    this._intensity = clamp01(intensity);
    if (this._padFilter && this.ctx) {
      this._padFilter.frequency.setTargetAtTime(350 + this._intensity * 900, this.ctx.currentTime, 0.5);
    }
  }
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

export const audio = new AudioEngine();
