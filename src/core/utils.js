// Small framework-free helpers shared across the game: math, easing,
// a tween engine, and a tiny event emitter. No DOM/canvas here.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const Easing = {
  linear: (t) => t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  quadIn: (t) => t * t,
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  backOut: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  backIn: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  elasticOutSoft: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 4.5;
    return Math.pow(2, -8 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  bounceOut: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

// ---- Tween engine ------------------------------------------------------
// A tiny, dependency-free tween/timeline system driven by an external
// tick(dt). Used for every "funky" squash/stretch/pour/particle motion.

let _id = 0;
export class Tweens {
  constructor() { this.active = []; }

  to(target, props, duration, easing = Easing.quadOut, opts = {}) {
    const from = {};
    for (const k in props) from[k] = target[k] ?? 0;
    const tw = {
      id: ++_id, target, from, to: props, duration: Math.max(0.0001, duration),
      easing, t: 0, delay: opts.delay || 0, onUpdate: opts.onUpdate,
      onComplete: opts.onComplete, dead: false,
    };
    this.active.push(tw);
    return tw;
  }

  delay(seconds, onComplete) {
    return this.to({ v: 0 }, { v: 1 }, seconds, Easing.linear, { onComplete });
  }

  kill(tw) { if (tw) tw.dead = true; }

  update(dt) {
    if (!this.active.length) return;
    const next = [];
    for (const tw of this.active) {
      if (tw.dead) continue;
      if (tw.delay > 0) { tw.delay -= dt; next.push(tw); continue; }
      tw.t += dt;
      const p = clamp(tw.t / tw.duration, 0, 1);
      const e = tw.easing(p);
      for (const k in tw.to) tw.target[k] = lerp(tw.from[k], tw.to[k], e);
      if (tw.onUpdate) tw.onUpdate(e, tw.target);
      if (p >= 1) { if (tw.onComplete) tw.onComplete(); }
      else next.push(tw);
    }
    this.active = next;
  }
}

// A tiny event emitter for cross-module signals (audio reacting to game
// events, UI reacting to combo changes, etc.) without hard coupling.
export class Emitter {
  constructor() { this._l = new Map(); }
  on(evt, fn) {
    if (!this._l.has(evt)) this._l.set(evt, new Set());
    this._l.get(evt).add(fn);
    return () => this._l.get(evt)?.delete(fn);
  }
  emit(evt, payload) {
    this._l.get(evt)?.forEach((fn) => fn(payload));
  }
}

export function hexToHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function shadeHex(hex, percent) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const f = (c) => clamp(Math.round(c + (percent > 0 ? (255 - c) * percent : c * percent)), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
