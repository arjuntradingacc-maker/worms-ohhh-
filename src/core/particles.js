// A small, dependency-free particle system for bubbles, sparkles,
// confetti, star spirals and pour droplets. Pure canvas drawing, no DOM.

import { rand, randInt, choice, TAU } from './utils.js';

class Particle {
  constructor(opts) { Object.assign(this, opts); this.age = 0; }

  update(dt) {
    this.age += dt;
    this.vy += (this.gravity || 0) * dt;
    this.vx *= 1 - (this.drag || 0) * dt;
    this.vy *= 1 - (this.drag || 0) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation = (this.rotation || 0) + (this.rotSpeed || 0) * dt;
    if (this.wobbleFreq) this.x += Math.sin(this.age * this.wobbleFreq + this.wobblePhase) * (this.wobbleAmp || 0) * dt;
    return this.age < this.life;
  }

  draw(ctx) {
    const t = this.age / this.life;
    const fade = this.fadeOut === false ? 1 : 1 - t;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade) * (this.alpha ?? 1);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation || 0);
    const s = this.scaleOverLife ? lerpScale(this.sizeStart ?? this.size, this.sizeEnd ?? this.size, t) : this.size;
    switch (this.shape) {
      case 'circle': drawCircle(ctx, s, this.color); break;
      case 'ring': drawRing(ctx, s, this.color, this.ringWidth || 3); break;
      case 'star': drawStar(ctx, s, this.color); break;
      case 'spark': drawSpark(ctx, s, this.color); break;
      case 'confetti': drawConfetti(ctx, s, this.color); break;
      default: drawCircle(ctx, s, this.color);
    }
    ctx.restore();
  }
}

function lerpScale(a, b, t) { return a + (b - a) * t; }

function drawCircle(ctx, r, color) {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
}

function drawRing(ctx, r, color, w) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
}

function drawStar(ctx, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (i / 10) * TAU - Math.PI / 2;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSpark(ctx, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.25);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
  ctx.moveTo(0, -r); ctx.lineTo(0, r);
  ctx.stroke();
}

function drawConfetti(ctx, r, color) {
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.5, -r * 0.3, r, r * 0.6);
}

const GLYPH_PATHS = {
  circle: (ctx, r) => { ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.fill(); },
  triangle: (ctx, r) => { ctx.beginPath(); ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.5, r * 0.4); ctx.lineTo(-r * 0.5, r * 0.4); ctx.closePath(); ctx.fill(); },
  square: (ctx, r) => { ctx.fillRect(-r * 0.35, -r * 0.35, r * 0.7, r * 0.7); },
  diamond: (ctx, r) => { ctx.beginPath(); ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.4, 0); ctx.lineTo(0, r * 0.55); ctx.lineTo(-r * 0.4, 0); ctx.closePath(); ctx.fill(); },
  star: (ctx, r) => drawStar(ctx, r * 0.5, ctx.fillStyle),
  hexagon: (ctx, r) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const x = Math.cos(a) * r * 0.5, y = Math.sin(a) * r * 0.5; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); },
  cross: (ctx, r) => { ctx.fillRect(-r * 0.5, -r * 0.15, r, r * 0.3); ctx.fillRect(-r * 0.15, -r * 0.5, r * 0.3, r); },
};
export const GLYPH_NAMES = Object.keys(GLYPH_PATHS);

// Standalone helper (not a particle) for the renderer to draw a static
// colorblind-mode pattern glyph on top of a liquid band, every frame.
export function drawGlyphAt(ctx, x, y, size, glyph) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  const fn = GLYPH_PATHS[glyph] || GLYPH_PATHS.circle;
  fn(ctx, size);
  ctx.restore();
}

export class ParticleSystem {
  constructor() { this.list = []; this.reducedMotion = false; }

  update(dt) { this.list = this.list.filter((p) => p.update(dt)); }
  draw(ctx) { for (const p of this.list) p.draw(ctx); }
  get count() { return this.list.length; }

  _scaleCount(n) { return this.reducedMotion ? Math.ceil(n * 0.35) : n; }

  spawnBubbles(x, y, count, opts = {}) {
    count = this._scaleCount(count);
    for (let i = 0; i < count; i++) {
      this.list.push(new Particle({
        x: x + rand(-opts.spread || -10, opts.spread || 10),
        y: y + rand(-6, 6),
        vx: rand(-12, 12),
        vy: rand(-70, -30) * (opts.speed || 1),
        gravity: -8,
        drag: 0.3,
        life: rand(0.5, 1.1),
        size: rand(2.5, 6),
        color: 'rgba(255,255,255,0.55)',
        shape: 'circle',
        wobbleFreq: rand(3, 6), wobblePhase: rand(0, TAU), wobbleAmp: rand(4, 10),
      }));
    }
  }

  spawnDroplets(x, y, count, colorHex, dir = { x: 0, y: 1 }) {
    count = this._scaleCount(count);
    for (let i = 0; i < count; i++) {
      this.list.push(new Particle({
        x: x + rand(-6, 6), y: y + rand(-6, 6),
        vx: dir.x * rand(20, 80) + rand(-40, 40),
        vy: dir.y * rand(20, 80) + rand(-20, 20),
        gravity: 240,
        drag: 0.05,
        life: rand(0.3, 0.6),
        size: rand(2, 4.5),
        color: colorHex,
        shape: 'circle',
      }));
    }
  }

  spawnSparkles(x, y, count, color = '#fff') {
    count = this._scaleCount(count);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      this.list.push(new Particle({
        x, y,
        vx: Math.cos(a) * rand(30, 110), vy: Math.sin(a) * rand(30, 110),
        gravity: 40, drag: 0.6,
        life: rand(0.35, 0.7),
        size: rand(2, 4),
        color,
        shape: 'spark',
        rotation: rand(0, TAU),
      }));
    }
  }

  spawnConfettiBurst(x, y, count, palette) {
    count = this._scaleCount(count);
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI, 0);
      this.list.push(new Particle({
        x, y,
        vx: Math.cos(a) * rand(60, 260),
        vy: Math.sin(a) * rand(120, 340) - 60,
        gravity: 320, drag: 0.08,
        life: rand(0.9, 1.8),
        size: rand(4, 9),
        color: choice(palette),
        shape: 'confetti',
        rotation: rand(0, TAU), rotSpeed: rand(-14, 14),
      }));
    }
  }

  spawnConfettiSide(fromLeft, screenW, screenH, count, palette) {
    count = this._scaleCount(count);
    const x = fromLeft ? -10 : screenW + 10;
    const dir = fromLeft ? 1 : -1;
    for (let i = 0; i < count; i++) {
      this.list.push(new Particle({
        x, y: rand(screenH * 0.1, screenH * 0.6),
        vx: dir * rand(180, 420),
        vy: rand(-260, -60),
        gravity: 320, drag: 0.05,
        life: rand(1.2, 2.2),
        size: rand(5, 10),
        color: choice(palette),
        shape: 'confetti',
        rotation: rand(0, TAU), rotSpeed: rand(-18, 18),
      }));
    }
  }

  spawnStarSpiral(cx, cy, count, color = '#ffe066') {
    count = this._scaleCount(count);
    for (let i = 0; i < count; i++) {
      const startAngle = (i / count) * TAU;
      const radius = rand(30, 60);
      const p = new Particle({
        x: cx + Math.cos(startAngle) * radius,
        y: cy + Math.sin(startAngle) * radius,
        vx: 0, vy: -rand(20, 40),
        life: rand(0.9, 1.4),
        size: rand(6, 11),
        color, shape: 'star',
        gravity: -10, drag: 0.2,
      });
      // orbit motion layered on top of the base update via a custom hook
      p.orbit = { angle: startAngle, radius, speed: rand(2.4, 3.6), cx, cy };
      const baseUpdate = p.update.bind(p);
      p.update = (dt) => {
        p.orbit.angle += p.orbit.speed * dt;
        p.orbit.radius += 26 * dt;
        p.orbit.cy -= 18 * dt;
        p.x = p.orbit.cx + Math.cos(p.orbit.angle) * p.orbit.radius;
        p.y = p.orbit.cy + Math.sin(p.orbit.angle) * p.orbit.radius * 0.6;
        p.rotation += 4 * dt;
        p.age += dt;
        return p.age < p.life;
      };
      this.list.push(p);
    }
  }
}
