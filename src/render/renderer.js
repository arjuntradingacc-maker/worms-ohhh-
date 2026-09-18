import { ZONE, ZONE_META } from '../game/arena.js';
import { getItem, THEMES } from '../core/cosmetics.js';
import { clamp } from '../core/vec.js';

const ENERGY_COLOR = {
  common: 'hsl(190, 90%, 65%)',
  charged: 'hsl(292, 90%, 68%)',
  prism: 'hsl(320, 90%, 70%)',
  void: 'hsl(265, 70%, 45%)',
  ancient: 'hsl(42, 95%, 62%)',
};

// Wider hue separation for the color-blind-friendly setting. Shape already
// differs per energy type (circle/diamond/shard-cluster/ring/rune), so this
// setting is a second, redundant cue rather than the only one.
const ENERGY_COLOR_CB = {
  common: 'hsl(200, 95%, 62%)',
  charged: 'hsl(35, 95%, 60%)',
  prism: 'hsl(320, 90%, 72%)',
  void: 'hsl(255, 80%, 55%)',
  ancient: 'hsl(50, 100%, 60%)',
};

const QUALITY = {
  low: { glow: false, bgParticles: 40, auraFx: false, segStep: 2 },
  medium: { glow: true, bgParticles: 90, auraFx: true, segStep: 2 },
  high: { glow: true, bgParticles: 160, auraFx: true, segStep: 1 },
  ultra: { glow: true, bgParticles: 260, auraFx: true, segStep: 1 },
};

function botHue(id) {
  return (id * 47) % 360;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this._effects = [];
    this._bgSeed = Math.random() * 1000;
    this._energyColors = ENERGY_COLOR;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.w = w; this.h = h;
  }

  _q(quality) { return QUALITY[quality] || QUALITY.high; }

  consumeEffects(match) {
    for (const e of match.effects) this._spawnEffect(e);
    match.effects.length = 0;
  }

  _spawnEffect(e) {
    const base = { age: 0, ...e };
    switch (e.type) {
      case 'bump':
        this._effects.push({ ...base, kind: 'ring', duration: 0.32, maxR: 46, color: '255,255,255' });
        break;
      case 'shieldBlock':
        this._effects.push({ ...base, kind: 'ring', duration: 0.45, maxR: 70, color: '120,220,255' });
        break;
      case 'boundary':
        this._effects.push({ ...base, kind: 'ring', duration: 0.25, maxR: 30, color: '150,200,255' });
        break;
      case 'eliminate':
        this._effects.push({ ...base, kind: 'shockwave', duration: 0.8, maxR: 260, color: '255,120,220' });
        this._effects.push({ ...base, kind: 'particles', duration: 0.9, count: 26, color: '255,160,230' });
        this._effects.push({ ...base, kind: 'label', duration: 1.1, text: e.name + ' eliminated' });
        break;
      case 'titanWarning':
        this._effects.push({ ...base, kind: 'pulseMarker', duration: 5, color: '150,90,255' });
        break;
      case 'titanArrive':
        this._effects.push({ ...base, kind: 'shockwave', duration: 1, maxR: 320, color: '150,90,255' });
        break;
      case 'titanDefeat':
        this._effects.push({ ...base, kind: 'shockwave', duration: 1.4, maxR: 700, color: '255,210,120' });
        this._effects.push({ ...base, kind: 'particles', duration: 1.6, count: 80, color: '255,220,150' });
        break;
      case 'collectText':
        this._effects.push({ ...base, kind: 'floatText', duration: 0.6, color: this._energyColors[e.energyType] || '#fff' });
        break;
    }
  }

  render(match, profile, dt) {
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const quality = { ...this._q(profile.settings.graphics) };
    if (profile.settings.reducedVFX) { quality.glow = false; quality.auraFx = false; }
    this._energyColors = profile.settings.colorBlind ? ENERGY_COLOR_CB : ENERGY_COLOR;
    const cam = match.camera;

    this._drawBackground(ctx, w, h, cam, quality, profile.settings.reducedMotion);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this._drawArena(ctx, match, quality);
    this._drawEnergy(ctx, match, quality);
    if (match.titan) this._drawTitan(ctx, match.titan, quality);

    const sorted = [...match.lumens].filter((l) => l.alive).sort((a, b) => a.radius - b.radius);
    for (const lumen of sorted) if (!lumen.isPlayer) this._drawLumen(ctx, lumen, quality, cam);
    this._drawLumen(ctx, match.player, quality, cam, true);

    this.consumeEffects(match);
    this._updateAndDrawEffects(ctx, dt, cam);

    ctx.restore();
  }

  _drawBackground(ctx, w, h, cam, quality, reducedMotion) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, '#0d1230');
    grad.addColorStop(0.55, '#080a1e');
    grad.addColorStop(1, '#030410');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const t = reducedMotion ? 0 : performance.now() * 0.00002;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const n = quality.bgParticles;
    const parX = cam.x * 0.04, parY = cam.y * 0.04;
    for (let i = 0; i < n; i++) {
      const seed = i * 12.9898 + this._bgSeed;
      const fx = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;
      const fy = ((Math.sin(seed * 1.7) * 12543.231) % 1 + 1) % 1;
      const x = ((fx * w * 3 - parX + t * (i % 5)) % w + w) % w;
      const y = ((fy * h * 3 - parY) % h + h) % h;
      const r = 0.6 + (i % 3) * 0.5;
      ctx.globalAlpha = 0.25 + 0.35 * ((i % 7) / 7);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawArena(ctx, match, quality) {
    const arena = match.arena;
    ctx.save();
    ctx.lineWidth = 6;
    const edgeDist = arena.distanceToEdge(match.player.x, match.player.y);
    const warn = edgeDist < 220;
    ctx.strokeStyle = warn ? `rgba(255,120,140,${0.5 + 0.3 * Math.sin(performance.now() * 0.01)})` : 'rgba(120,200,255,0.35)';
    if (quality.glow) { ctx.shadowColor = warn ? '#ff6688' : '#5fd7ff'; ctx.shadowBlur = 30; }
    ctx.beginPath();
    ctx.arc(0, 0, arena.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    for (const zone of arena.zones) {
      const meta = ZONE_META[zone.type];
      ctx.save();
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.r);
      grad.addColorStop(0, meta.color + '33');
      grad.addColorStop(1, meta.color + '00');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = meta.color + '55';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      if (zone.type === ZONE.GRAVITY_WELL) {
        ctx.save();
        ctx.strokeStyle = meta.color + '66';
        for (let i = 1; i <= 3; i++) {
          const r = zone.r * (0.3 * i) * (0.6 + 0.4 * Math.sin(arena.pulsePhase * 0.5 + i));
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, Math.abs(r), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (zone.type === ZONE.AURORA) {
        ctx.save();
        ctx.fillStyle = meta.color + '55';
        for (let i = 0; i < 10; i++) {
          const a = arena.pulsePhase * 0.6 + i;
          const rr = zone.r * (0.3 + 0.6 * ((i % 5) / 5));
          const x = zone.x + Math.cos(a) * rr;
          const y = zone.y + Math.sin(a * 1.3) * rr;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  _drawEnergy(ctx, match, quality) {
    const cam = match.camera;
    const viewR = Math.max(this.w, this.h) / cam.zoom * 0.7;
    for (const p of match.energyField.particles) {
      const dx = p.x - cam.x, dy = p.y - cam.y;
      if (dx * dx + dy * dy > viewR * viewR) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      const pulse = 1 + Math.sin(p.phase * 2) * 0.15;
      const color = this._energyColors[p.type];
      if (quality.glow) { ctx.shadowColor = color; ctx.shadowBlur = p.type === 'ancient' ? 26 : 14; }
      ctx.fillStyle = color;
      switch (p.type) {
        case 'charged': {
          ctx.rotate(p.phase);
          ctx.beginPath();
          const r = p.r * pulse;
          ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
          ctx.closePath(); ctx.fill();
          break;
        }
        case 'prism': {
          ctx.rotate(p.phase * 1.5);
          for (let i = 0; i < 5; i++) {
            ctx.rotate((Math.PI * 2) / 5);
            ctx.fillStyle = `hsl(${(p.phase * 60 + i * 70) % 360},90%,65%)`;
            ctx.beginPath();
            ctx.arc(p.r * 0.55, 0, p.r * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'void': {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.r * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#0a0716';
          ctx.beginPath();
          ctx.arc(0, 0, p.r * 0.55, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'ancient': {
          ctx.rotate(p.phase * 0.3);
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.stroke();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * p.r * 0.4, Math.sin(a) * p.r * 0.4);
            ctx.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
            ctx.stroke();
          }
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0, 0, p.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default:
          ctx.beginPath();
          ctx.arc(0, 0, p.r * pulse, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  _drawTitan(ctx, titan, quality) {
    ctx.save();
    if (titan.state === 'warning') {
      const t = 1 - clamp(titan.timer / 5, 0, 1);
      ctx.strokeStyle = `rgba(150,90,255,${0.4 + 0.4 * Math.sin(performance.now() * 0.015)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(titan.x, titan.y, 60 + t * 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.translate(titan.x, titan.y);
    if (quality.glow) { ctx.shadowColor = '#9c5cff'; ctx.shadowBlur = 50; }
    const grad = ctx.createRadialGradient(0, 0, titan.radius * 0.2, 0, 0, titan.radius);
    grad.addColorStop(0, '#c9a4ff');
    grad.addColorStop(0.6, '#7a3cff');
    grad.addColorStop(1, '#2a1050');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, titan.radius * (1 + Math.sin(titan.pulsePhase * 2) * 0.02), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // HP ring.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, titan.radius + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (titan.hp / titan.maxHp));
    ctx.stroke();
    ctx.restore();
  }

  _themeFor(lumen) {
    if (lumen.cosmetics) {
      const coreItem = getItem(lumen.cosmetics.core);
      const theme = THEMES[coreItem?.theme] || THEMES.aurora;
      return { hue: theme.hue, hue2: theme.hue2, cosmetics: lumen.cosmetics };
    }
    const hue = botHue(lumen.id);
    return { hue, hue2: (hue + 40) % 360, cosmetics: null };
  }

  _drawLumen(ctx, lumen, quality, cam, isPlayer = false) {
    const theme = this._themeFor(lumen);
    const hue = theme.hue;
    const t = performance.now() * 0.001;

    // Trail: separate floating orbs joined by faint energy links, tapering
    // toward the tail — deliberately not a continuous snake body.
    const trail = lumen.trail;
    const step = quality.segStep;
    ctx.save();
    for (let i = trail.length - 1; i >= 1; i -= step) {
      const seg = trail[i];
      const f = i / trail.length;
      const wob = Math.sin(t * 2.2 + i * 0.6 + lumen.id) * 2.2 * (1 - f * 0.5);
      const perp = Math.atan2(seg.y - (trail[i - 1]?.y ?? seg.y), seg.x - (trail[i - 1]?.x ?? seg.x)) + Math.PI / 2;
      const sx = seg.x + Math.cos(perp) * wob;
      const sy = seg.y + Math.sin(perp) * wob;
      const r = Math.max(2.5, lumen.radius * (0.78 - f * 0.55));
      const alpha = 0.85 - f * 0.65;
      if (i < trail.length - step) {
        const prev = trail[i + step] || trail[trail.length - 1];
        ctx.strokeStyle = `hsla(${hue},80%,65%,${alpha * 0.35})`;
        ctx.lineWidth = Math.max(1, r * 0.5);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(prev.x, prev.y);
        ctx.stroke();
      }
      ctx.fillStyle = `hsla(${hue},85%,68%,${alpha})`;
      if (quality.glow && lumen.isPlayer) { ctx.shadowColor = `hsl(${hue},90%,60%)`; ctx.shadowBlur = 10; }
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Aura.
    if (theme.cosmetics && quality.auraFx) {
      const auraItem = getItem(theme.cosmetics.aura);
      if (auraItem && auraItem.shape !== 'none') this._drawAura(ctx, lumen, hue, auraItem.shape, t);
    }
    if (lumen.magnetActive) this._drawAura(ctx, lumen, 190, 'ring', t);

    // Core.
    ctx.save();
    ctx.translate(lumen.x, lumen.y);
    const pulse = 1 + Math.sin(t * 3 + lumen.id) * 0.05 + lumen.comboFlash * 0.3;
    const flash = lumen.hitFlash;
    const coreHue = flash > 0 ? hue + 40 : hue;
    const lightness = 55 + flash * 30 + Math.min(20, lumen.overcharge * 0.18);
    if (quality.glow) {
      ctx.shadowColor = `hsl(${coreHue},95%,65%)`;
      ctx.shadowBlur = 22 + lumen.overcharge * 0.35 + (isPlayer ? 8 : 0);
    }
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, lumen.radius * pulse);
    grad.addColorStop(0, `hsla(${coreHue},100%,${Math.min(96, lightness + 25)}%,1)`);
    grad.addColorStop(0.55, `hsla(${coreHue},95%,${lightness}%,0.95)`);
    grad.addColorStop(1, `hsla(${theme.hue2},90%,${lightness - 10}%,0.15)`);
    ctx.fillStyle = grad;
    ctx.globalAlpha = lumen.phased ? 0.45 : 1;
    ctx.beginPath();
    ctx.arc(0, 0, lumen.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (lumen.shieldCharges > 0) {
      ctx.strokeStyle = 'rgba(150,220,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, lumen.radius * 1.28, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Orbiting particles.
    const orbitCount = clamp(Math.round(lumen.mass / 12), 2, 8);
    for (let i = 0; i < orbitCount; i++) {
      const a = t * 1.6 + (i / orbitCount) * Math.PI * 2;
      const orbitR = lumen.radius * 1.55;
      ctx.fillStyle = `hsla(${hue},90%,75%,0.8)`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * orbitR, Math.sin(a) * orbitR, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    if (!isPlayer && lumen.radius * cam.zoom > 10) {
      ctx.save();
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(230,240,255,0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(lumen.name, lumen.x, lumen.y - lumen.radius - 12);
      ctx.restore();
    }
  }

  _drawAura(ctx, lumen, hue, shape, t) {
    ctx.save();
    ctx.translate(lumen.x, lumen.y);
    ctx.strokeStyle = `hsla(${hue},85%,70%,0.5)`;
    ctx.lineWidth = 2;
    if (shape === 'ring' || shape === 'halo' || shape === 'veil') {
      ctx.beginPath();
      ctx.arc(0, 0, lumen.radius * 1.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (shape === 'sparks') {
      for (let i = 0; i < 6; i++) {
        const a = t * 2 + (i / 6) * Math.PI * 2;
        const r = lumen.radius * 1.7;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},90%,75%,0.8)`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _updateAndDrawEffects(ctx, dt, cam) {
    for (let i = this._effects.length - 1; i >= 0; i--) {
      const e = this._effects[i];
      e.age += dt;
      if (e.age >= e.duration) { this._effects.splice(i, 1); continue; }
      const t = e.age / e.duration;
      ctx.save();
      if (e.kind === 'ring' || e.kind === 'shockwave') {
        const r = e.maxR * (e.kind === 'shockwave' ? Math.sqrt(t) : t);
        ctx.strokeStyle = `rgba(${e.color},${1 - t})`;
        ctx.lineWidth = e.kind === 'shockwave' ? 5 * (1 - t) + 1 : 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'pulseMarker') {
        ctx.strokeStyle = `rgba(${e.color},${0.5 + 0.3 * Math.sin(e.age * 8)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 70 + Math.sin(e.age * 4) * 15, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'particles') {
        if (!e._parts) {
          e._parts = Array.from({ length: e.count }, () => ({
            a: Math.random() * Math.PI * 2, s: 60 + Math.random() * 220, r: 1.5 + Math.random() * 2.5,
          }));
        }
        ctx.fillStyle = `rgba(${e.color},${1 - t})`;
        for (const p of e._parts) {
          const d = p.s * e.age;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(p.a) * d, e.y + Math.sin(p.a) * d, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.kind === 'floatText') {
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = e.color;
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.text, e.x, e.y - 10 - t * 26);
      } else if (e.kind === 'label') {
        ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.text, e.x, e.y - 60);
      }
      ctx.restore();
    }
  }
}
