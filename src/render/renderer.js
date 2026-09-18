// The gameplay canvas renderer: lays out containers, draws glossy liquid
// with a living wavy surface + rising bubbles, and orchestrates every
// animated interaction described in the design brief (select, pour,
// perfect match, invalid move, level complete) as tween-driven sequences.

import { Tweens, Easing, clamp, lerp, TAU, rand, roundedRectPath, hexToRgba, shadeHex } from '../core/utils.js';
import { ParticleSystem, drawGlyphAt, GLYPH_NAMES } from '../core/particles.js';
import { getShape } from './containers.js';
import { Liqi } from './mascot.js';

function runsOf(arr) {
  const runs = [];
  for (const c of arr) {
    if (runs.length && runs[runs.length - 1].color === c) runs[runs.length - 1].count++;
    else runs.push({ color: c, count: 1 });
  }
  return runs;
}

class ContainerView {
  constructor(index, colors, capacity, shapeName) {
    this.index = index;
    this.colors = colors.slice(); // bottom-to-top color ids, current logical state
    this.capacity = capacity;
    this.shapeName = shapeName;
    this.fillUnits = colors.length; // animated (can lag behind `colors.length` during a pour)
    this.x = 0; this.y = 0; this.w = 90; this.h = 150;
    this.offsetY = 0; this.offsetX = 0;
    this.scaleX = 1; this.scaleY = 1;
    this.rotation = 0;
    this.glow = 0;
    this.selected = false;
    this.waveAmp = 0; this.wavePhase = 0;
    this.faceTimer = 0;
    this.bubbleAccum = 0;
    this.shakeX = 0;
  }

  get shape() { return getShape(this.shapeName); }

  worldSpout() {
    const inner = this.shape.inner(this.w, this.h);
    return { x: this.x + this.w / 2, y: this.y + inner.y };
  }

  center() { return { x: this.x + this.w / 2, y: this.y + this.h / 2 }; }
}

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0; this.height = 0; this.dpr = 1;
    this.tweens = new Tweens();
    this.particles = new ParticleSystem();
    this.mascot = new Liqi();
    this.containers = [];
    this.world = null;
    this.colorPalette = [];
    this.time = 0;
    this.shakeX = 0; this.shakeY = 0; this.shakeMag = 0;
    this.bgBlobs = [];
    this.bgStars = [];
    this.colorBlind = false;
    this.highContrast = false;
    this.reducedMotion = false;
    this.perfectBursts = []; // {x,y,t,dur,text}
    this.busy = false; // true while a pour animation is running
    this.specialFxByColor = {};
  }

  setAccessibility({ colorBlind, highContrast, reducedMotion }) {
    if (colorBlind !== undefined) this.colorBlind = colorBlind;
    if (highContrast !== undefined) this.highContrast = highContrast;
    if (reducedMotion !== undefined) { this.reducedMotion = reducedMotion; this.particles.reducedMotion = reducedMotion; }
  }

  resize(w, h, dpr) {
    this.width = w; this.height = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.containers.length) this._layout();
  }

  setWorld(world) {
    this.world = world;
    this.colorPalette = world.palette;
    this.bgBlobs = Array.from({ length: 7 }, () => ({
      x: rand(0, 1), y: rand(0, 1), r: rand(40, 110), speed: rand(0.01, 0.03), phase: rand(0, TAU),
      hue: rand(0, 360),
    }));
    this.bgStars = Array.from({ length: 22 }, () => ({ x: rand(0, 1), y: rand(0, 1), r: rand(1, 2.6), tw: rand(0, TAU) }));
  }

  setLevel(level, specialFxByColor = {}) {
    this.containers = level.containers.map((c, i) => new ContainerView(i, c, level.capacity, this._shapeFor(level, i)));
    this.specialFxByColor = specialFxByColor;
    this._layout();
    this.busy = false;
  }

  _shapeFor(level, i) {
    const shapes = level.world.shapes;
    return shapes[i % shapes.length];
  }

  _layout() {
    const n = this.containers.length;
    if (!n) return;
    const padTop = this.height * 0.14, padBottom = this.height * 0.1;
    const areaW = this.width * 0.92, areaH = this.height - padTop - padBottom;
    const maxCols = n <= 6 ? n : Math.ceil(n / 2);
    const cols = Math.min(maxCols, n);
    const rows = Math.ceil(n / cols);
    const cellW = areaW / cols;
    const cellH = areaH / rows;
    const capMax = Math.max(...this.containers.map((c) => c.capacity));
    const w = Math.min(cellW * 0.85, 128);
    const h = Math.min(cellH * 0.86, w * 2.2 * (capMax / 4));
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const rowCount = Math.min(cols, n - row * cols);
      const rowOffset = (cols - rowCount) * cellW * 0.5;
      const cx = this.width * 0.04 + rowOffset + col * cellW + cellW / 2;
      const cy = padTop + row * cellH + cellH / 2;
      const cv = this.containers[i];
      cv.w = w; cv.h = h;
      cv.x = cx - w / 2; cv.y = cy - h / 2;
      cv.baseX = cv.x; cv.baseY = cv.y;
    }
  }

  colorHex(colorId) { return this.colorPalette[colorId % this.colorPalette.length]; }

  // ---- per-frame update -------------------------------------------------

  update(dt) {
    this.time += dt;
    this.tweens.update(dt);
    this.particles.update(dt);
    this.mascot.tick(dt);

    this.shakeMag *= Math.pow(0.001, dt);
    if (this.shakeMag < 0.02) this.shakeMag = 0;
    this.shakeX = (Math.random() * 2 - 1) * this.shakeMag;
    this.shakeY = (Math.random() * 2 - 1) * this.shakeMag;

    for (const cv of this.containers) {
      cv.wavePhase += dt * 3.2;
      cv.waveAmp *= Math.pow(0.02, dt);
      if (cv.faceTimer > 0) cv.faceTimer -= dt;
      cv.shakeX *= Math.pow(0.001, dt);
      // Ambient bubbles, subtle.
      if (!this.reducedMotion && cv.fillUnits > 0.3) {
        cv.bubbleAccum += dt;
        if (cv.bubbleAccum > rand(1.2, 2.4)) {
          cv.bubbleAccum = 0;
          const inner = cv.shape.inner(cv.w, cv.h);
          const fillH = (cv.fillUnits / cv.capacity) * inner.h;
          this.particles.spawnBubbles(cv.x + cv.w / 2, cv.y + inner.y + inner.h - fillH * rand(0.2, 0.8), 1, { spread: inner.w * 0.3, speed: 0.4 });
        }
      }
    }

    this.perfectBursts = this.perfectBursts.filter((b) => (b.t += dt) < b.dur);
  }

  // ---- drawing ------------------------------------------------------------

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    this._drawBackground(ctx);
    for (const cv of this.containers) this._drawContainer(ctx, cv);
    this.particles.draw(ctx);
    for (const b of this.perfectBursts) this._drawPerfectText(ctx, b);

    ctx.restore();
  }

  drawMascot(x, y, r) { this.mascot.draw(this.ctx, x, y, r); }

  _drawBackground(ctx) {
    const world = this.world;
    if (!world) return;
    const w = this.width, h = this.height;
    const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
    grad.addColorStop(0, world.bg[0]);
    grad.addColorStop(0.55, world.bg[1]);
    grad.addColorStop(1, world.bg[2]);
    ctx.fillStyle = this.highContrast ? '#0a0a12' : grad;
    ctx.fillRect(0, 0, w, h);

    if (this.highContrast) return; // keep background quiet for readability

    for (const s of this.bgStars) {
      const tw = 0.5 + 0.5 * Math.sin(this.time * 2 + s.tw);
      ctx.globalAlpha = 0.25 + tw * 0.35;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const b of this.bgBlobs) {
      const bx = ((b.x + Math.sin(this.time * b.speed * TAU + b.phase) * 0.06) % 1) * w;
      const by = ((b.y + this.time * b.speed * 0.05) % 1) * h;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
      g.addColorStop(0, `hsla(${b.hue}, 90%, 75%, 0.14)`);
      g.addColorStop(1, `hsla(${b.hue}, 90%, 75%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, TAU);
      ctx.fill();
    }
  }

  _drawContainer(ctx, cv) {
    const shape = cv.shape;
    ctx.save();
    const cx = cv.x + cv.w / 2, cy = cv.y + cv.h / 2;
    ctx.translate(cx + cv.offsetX + cv.shakeX, cy + cv.offsetY);
    ctx.rotate(cv.rotation);
    ctx.scale(cv.scaleX, cv.scaleY);
    ctx.translate(-cv.w / 2, -cv.h / 2);

    // Soft contact shadow.
    ctx.save();
    ctx.translate(cv.w / 2, cv.h + 6);
    ctx.scale(1, 0.28);
    const shg = ctx.createRadialGradient(0, 0, 0, 0, 0, cv.w * 0.55);
    shg.addColorStop(0, 'rgba(0,0,0,0.35)');
    shg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shg;
    ctx.beginPath(); ctx.arc(0, 0, cv.w * 0.55, 0, TAU); ctx.fill();
    ctx.restore();

    // Glow ring behind selected / perfect containers.
    if (cv.glow > 0.01) {
      ctx.save();
      ctx.shadowColor = `rgba(255,255,255,${0.9 * cv.glow})`;
      ctx.shadowBlur = 26 * cv.glow;
      shape.draw(ctx, cv.w, cv.h);
      ctx.fillStyle = `rgba(255,255,255,${0.05 * cv.glow})`;
      ctx.fill();
      ctx.restore();
    }

    // Glass body.
    shape.draw(ctx, cv.w, cv.h);
    const glassGrad = ctx.createLinearGradient(0, 0, cv.w, cv.h);
    if (this.highContrast) {
      glassGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
      glassGrad.addColorStop(1, 'rgba(255,255,255,0.06)');
    } else {
      glassGrad.addColorStop(0, 'rgba(255,255,255,0.32)');
      glassGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      glassGrad.addColorStop(1, 'rgba(255,255,255,0.22)');
    }
    ctx.fillStyle = glassGrad;
    ctx.fill();
    ctx.lineWidth = this.highContrast ? 4 : 2.5;
    ctx.strokeStyle = this.highContrast ? '#ffffff' : 'rgba(255,255,255,0.55)';
    ctx.stroke();

    // Liquid clipped to inner window.
    const inner = shape.inner(cv.w, cv.h);
    ctx.save();
    roundedRectPath(ctx, inner.x, inner.y, inner.w, inner.h, Math.min(14, inner.w * 0.22));
    ctx.clip();
    this._drawLiquid(ctx, cv, inner);
    ctx.restore();

    // Glossy highlight over the whole container (drawn after liquid so it
    // reads as glass, not just paint).
    ctx.save();
    shape.draw(ctx, cv.w, cv.h);
    ctx.clip();
    const hi = ctx.createLinearGradient(cv.w * 0.1, 0, cv.w * 0.4, cv.h);
    hi.addColorStop(0, 'rgba(255,255,255,0.5)');
    hi.addColorStop(0.3, 'rgba(255,255,255,0.08)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(0, 0, cv.w * 0.5, cv.h);
    ctx.restore();

    // Funny face overlay on invalid moves.
    if (cv.faceTimer > 0) this._drawFace(ctx, cv, inner);

    ctx.restore();
  }

  _drawLiquid(ctx, cv, inner) {
    const runs = runsOf(cv.colors);
    const unit = inner.h / cv.capacity;
    const totalUnits = cv.colors.length;
    const visibleUnits = Math.min(cv.fillUnits, cv.capacity);
    if (visibleUnits <= 0.01) return;
    const fillTopY = inner.y + inner.h - visibleUnits * unit;

    let yCursor = inner.y + inner.h; // bottom, draw upward
    for (const run of runs) {
      const runH = run.count * unit;
      const bandTop = yCursor - runH;
      const clipTop = Math.max(bandTop, fillTopY);
      if (clipTop >= yCursor) { yCursor = bandTop; continue; }
      const hex = this.colorHex(run.color);
      const grad = ctx.createLinearGradient(0, clipTop, 0, yCursor);
      grad.addColorStop(0, shadeHex(hex, 0.28));
      grad.addColorStop(0.5, hex);
      grad.addColorStop(1, shadeHex(hex, -0.18));
      ctx.fillStyle = this.highContrast ? hex : grad;
      ctx.fillRect(inner.x, clipTop, inner.w, yCursor - clipTop);

      if (this.colorBlind) {
        const glyph = GLYPH_NAMES[run.color % GLYPH_NAMES.length];
        const midY = (clipTop + yCursor) / 2;
        if (yCursor - clipTop > 10) drawGlyphAt(ctx, inner.x + inner.w / 2, midY, Math.min(inner.w, unit) * 0.7, glyph);
      }

      const fx = this.specialFxByColor[run.color];
      if (fx) this._drawSpecialFx(ctx, fx, inner.x, clipTop, inner.w, yCursor - clipTop, hex);

      yCursor = bandTop;
    }

    // Wavy top surface for liveliness.
    if (visibleUnits > 0) {
      const topHex = this.colorHex(cv.colors[Math.min(cv.colors.length - 1, Math.round(visibleUnits) - 1)] ?? cv.colors[0]);
      ctx.save();
      ctx.beginPath();
      const waveH = Math.min(6, cv.waveAmp);
      ctx.moveTo(inner.x, fillTopY);
      const segs = 5;
      for (let i = 1; i <= segs; i++) {
        const px = inner.x + (inner.w * i) / segs;
        const py = fillTopY + Math.sin(cv.wavePhase + i * 1.4) * waveH;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(inner.x + inner.w, fillTopY - 3);
      ctx.lineTo(inner.x, fillTopY - 3);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(shadeHex(topHex, 0.35), 0.8);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawSpecialFx(ctx, fx, x, y, w, h, hex) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    const t = this.time;
    if (fx === 'glitter' || fx === 'crystal') {
      for (let i = 0; i < 4; i++) {
        const gx = x + ((Math.sin(t * 2 + i * 3) + 1) / 2) * w;
        const gy = y + ((i + 0.5) / 4) * h;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(gx, gy, 1.6, 0, TAU); ctx.fill();
      }
    } else if (fx === 'electric' || fx === 'neon') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.5);
      for (let i = 1; i <= 6; i++) ctx.lineTo(x + (w * i) / 6, y + h * 0.5 + Math.sin(t * 12 + i) * h * 0.15);
      ctx.stroke();
    } else if (fx === 'galaxy') {
      for (let i = 0; i < 3; i++) {
        const gx = x + ((Math.sin(t + i * 2) + 1) / 2) * w;
        const gy = y + ((Math.cos(t * 0.7 + i) + 1) / 2) * h;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(gx, gy, 1.2, 0, TAU); ctx.fill();
      }
    } else if (fx === 'bubble' || fx === 'soda') {
      // handled mostly by ambient bubble spawner; add a couple static rising rings
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(x + w * 0.3, y + ((t * 40) % h), 2.5, 0, TAU); ctx.stroke();
    } else if (fx === 'lava') {
      ctx.fillStyle = `hsla(${20 + Math.sin(t * 2) * 10}, 100%, 60%, 0.4)`;
      ctx.beginPath(); ctx.ellipse(x + w * 0.5, y + h * 0.5, w * 0.3, h * 0.15, 0, 0, TAU); ctx.fill();
    } else if (fx === 'rainbow') {
      const g = ctx.createLinearGradient(x, y, x + w, y);
      ['#ff5c5c', '#ffd23f', '#5cff8f', '#5cc9ff', '#c15cff'].forEach((c, i, arr) => g.addColorStop(i / (arr.length - 1), c));
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    } else if (fx === 'jelly') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.5 + Math.sin(t * 4) * 3);
      ctx.lineTo(x + w, y + h * 0.5 - Math.sin(t * 4) * 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawFace(ctx, cv, inner) {
    const t = clamp(cv.faceTimer / 0.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = t;
    const cx = inner.x + inner.w / 2;
    const cy = inner.y + inner.h * 0.35;
    const r = inner.w * 0.16;
    ctx.fillStyle = '#2b1035';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + side * r * 1.4, cy, r * 0.5, r * 0.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + r * 1.3, r * 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _drawPerfectText(ctx, b) {
    const p = b.t / b.dur;
    let scale;
    if (p < 0.35) scale = Easing.backOut(p / 0.35) * 1.15;
    else if (p < 0.6) scale = lerp(1.15, 1, (p - 0.35) / 0.25);
    else scale = lerp(1, 0.8, (p - 0.6) / 0.4);
    const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(b.x, b.y - p * 40);
    ctx.scale(scale, scale);
    ctx.font = '900 30px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(120,20,80,0.9)';
    ctx.strokeText(b.text, 0, 0);
    const g = ctx.createLinearGradient(0, -16, 0, 16);
    g.addColorStop(0, '#fff8d6');
    g.addColorStop(1, '#ffd23f');
    ctx.fillStyle = g;
    ctx.fillText(b.text, 0, 0);
    ctx.restore();
  }

  // ---- interaction animations --------------------------------------------

  selectContainer(index) {
    const cv = this.containers[index];
    cv.selected = true;
    this.tweens.to(cv, { glow: 1 }, 0.15, Easing.quadOut);
    this.tweens.to(cv, { offsetY: -10 }, 0.09, Easing.quadOut, {
      onComplete: () => this.tweens.to(cv, { offsetY: 0 }, 0.28, Easing.elasticOutSoft),
    });
    this.tweens.to(cv, { scaleX: 0.9, scaleY: 1.12 }, 0.08, Easing.quadOut, {
      onComplete: () => this.tweens.to(cv, { scaleX: 1, scaleY: 1 }, 0.32, Easing.elasticOutSoft),
    });
    cv.waveAmp = 5;
    const spout = cv.worldSpout();
    if (!this.reducedMotion) this.particles.spawnBubbles(spout.x, spout.y + 10, 3, { spread: 12 });
  }

  deselectContainer(index) {
    const cv = this.containers[index];
    cv.selected = false;
    this.tweens.to(cv, { glow: 0 }, 0.18, Easing.quadOut);
  }

  invalidMove(index) {
    const cv = this.containers[index];
    cv.faceTimer = 0.6;
    cv.waveAmp = 6;
    let n = 0;
    const wiggle = () => {
      n++;
      const dir = n % 2 === 0 ? 1 : -1;
      this.tweens.to(cv, { rotation: dir * 0.12 }, 0.07, Easing.quadOut, {
        onComplete: () => { if (n < 5) wiggle(); else this.tweens.to(cv, { rotation: 0 }, 0.15, Easing.elasticOutSoft); },
      });
    };
    wiggle();
    this.mascot.setState('confused');
    this.shakeMag = Math.max(this.shakeMag, this.reducedMotion ? 0 : 3);
  }

  // Animates a pour that has ALREADY been applied to game logic. `result`
  // matches the shape returned by LiquidPuzzle.pour(). Resolves when the
  // whole choreography (including any perfect-match flourish) is done.
  animatePour({ from, to, color, destSolved, levelSolved }, newContainersState) {
    return new Promise((resolve) => {
      this.busy = true;
      const src = this.containers[from];
      const dst = this.containers[to];
      const hex = this.colorHex(color);
      // The destination only ever grows toward its new (longer) color list,
      // so it's safe to swap in immediately and clip-draw up to fillUnits.
      // The source SHRINKS, though: swapping its colors in immediately would
      // leave fillUnits (still animating down from the old length) with no
      // color data to clip against mid-drain. Keep its old colors until the
      // drain tween finishes, then swap.
      dst.colors = newContainersState[to].slice();

      const srcSpout = src.worldSpout();
      const dstTop = dst.worldSpout();
      const dx = dstTop.x - srcSpout.x;

      const rm = this.reducedMotion;
      const T = rm ? 0.5 : 1;

      // 1-2: jump up + anticipation bounce.
      this.tweens.to(src, { offsetY: -18 }, 0.12 * T, Easing.backOut);
      // 3: tilt toward destination.
      const tiltAngle = clamp(dx * 0.003, -0.55, 0.55);
      this.tweens.to(src, { rotation: tiltAngle }, 0.18 * T, Easing.quadOut, { delay: 0.1 * T });
      src.waveAmp = 8;

      const pourDelay = 0.3 * T;
      const pourDur = rm ? 0.28 : 0.5;

      this.tweens.delay(pourDelay, () => {
        // Source drains, destination fills (after a short travel beat), in lockstep.
        this.tweens.to(src, { fillUnits: newContainersState[from].length }, pourDur, Easing.quadIn, {
          onComplete: () => { src.colors = newContainersState[from].slice(); },
        });
        this.tweens.delay(pourDur * 0.15, () => {
          this.tweens.to(dst, { fillUnits: newContainersState[to].length }, pourDur * 0.85, Easing.backOut, {
            onUpdate: () => { dst.waveAmp = 7; },
          });
        });

        if (!rm) {
          // Droplets flying around a bezier stream while liquid transfers.
          const steps = 8;
          for (let i = 0; i <= steps; i++) {
            this.tweens.delay((i / steps) * pourDur, () => {
              if (!this.containers.includes(src)) return;
              const sp = src.worldSpout();
              const dp = dst.worldSpout();
              const midX = (sp.x + dp.x) / 2, midY = Math.min(sp.y, dp.y) - 30;
              const t = i / steps;
              const px = lerp(lerp(sp.x, midX, t), lerp(midX, dp.x, t), t);
              const py = lerp(lerp(sp.y, midY, t), lerp(midY, dp.y, t), t);
              this.particles.spawnDroplets(px, py, 2, hex, { x: Math.sign(dx) || 1, y: 0.5 });
            });
          }
          this.particles.spawnBubbles(dstTop.x, dstTop.y, 4, { spread: 14 });
        }

        this.tweens.delay(pourDur * 0.6, () => {
          this.particles.spawnBubbles(dstTop.x, dstTop.y, 6, { spread: 16, speed: 1.4 });
        });
      });

      const settleDelay = pourDelay + pourDur + 0.05;
      this.tweens.delay(settleDelay, () => {
        // Containers bounce happily back to rest.
        this.tweens.to(src, { rotation: 0, offsetY: 0 }, 0.32 * T, Easing.elasticOutSoft);
        this.tweens.to(dst, { scaleX: 1.14, scaleY: 0.86 }, 0.1 * T, Easing.quadOut, {
          onComplete: () => this.tweens.to(dst, { scaleX: 1, scaleY: 1 }, 0.3 * T, Easing.elasticOutSoft),
        });
        if (!rm) this.particles.spawnSparkles(dstTop.x, dstTop.y, 8, hex);

        if (destSolved) {
          this._perfectMatch(dst, hex, () => this._finishPour(resolve, levelSolved));
        } else {
          this.tweens.delay(0.3 * T, () => this._finishPour(resolve, levelSolved));
        }
      });
    });
  }

  _finishPour(resolve, levelSolved) {
    this.busy = false;
    resolve({ levelSolved });
  }

  _perfectMatch(cv, hex, onDone) {
    const T = this.reducedMotion ? 0.5 : 1;
    const c = cv.center();
    cv.glow = 1;
    this.tweens.to(cv, { glow: 0 }, 0.7 * T, Easing.quadOut);
    this.perfectBursts.push({ x: c.x, y: c.y - cv.h * 0.6, t: 0, dur: 1.1, text: 'PERFECT!' });

    if (!this.reducedMotion) {
      this.particles.spawnConfettiBurst(c.x, c.y, 22, this.colorPalette);
      this.particles.spawnStarSpiral(c.x, c.y, 10, '#ffe066');
    }
    this.mascot.setState('excited');

    let n = 0;
    const wiggle = () => {
      n++;
      const dir = n % 2 === 0 ? 1 : -1;
      this.tweens.to(cv, { offsetX: dir * 8 }, 0.06 * T, Easing.quadOut, {
        onComplete: () => { if (n < 6) wiggle(); else this.tweens.to(cv, { offsetX: 0 }, 0.12 * T, Easing.elasticOutSoft); },
      });
    };
    wiggle();

    this.tweens.to(cv, { scaleX: 1.16, scaleY: 0.86 }, 0.1 * T, Easing.quadOut, {
      onComplete: () => this.tweens.to(cv, { scaleX: 1, scaleY: 1 }, 0.3 * T, Easing.elasticOutSoft),
    });

    this.shakeMag = Math.max(this.shakeMag, this.reducedMotion ? 0 : 4);

    this.tweens.delay(0.55 * T, onDone);
  }

  triggerLevelCompleteBurst() {
    this.mascot.setState('jumping');
    if (this.reducedMotion) return;
    for (const cv of this.containers) {
      this.tweens.to(cv, { offsetY: -14 }, 0.14, Easing.backOut, {
        delay: rand(0, 0.15),
        onComplete: () => this.tweens.to(cv, { offsetY: 0 }, 0.3, Easing.elasticOutSoft),
      });
    }
    this.particles.spawnConfettiSide(true, this.width, this.height, 30, this.colorPalette);
    this.particles.spawnConfettiSide(false, this.width, this.height, 30, this.colorPalette);
    this.shakeMag = 5;
  }
}
