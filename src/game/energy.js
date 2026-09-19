import { rand, dist } from '../core/vec.js';
import { ZONE } from './arena.js';

export const ENERGY_TYPE = {
  COMMON: 'common',
  CHARGED: 'charged',
  PRISM: 'prism',
  VOID: 'void',
  ANCIENT: 'ancient',
};

export const ENERGY_META = {
  [ENERGY_TYPE.COMMON]: { value: 1, radius: 5, weight: 70, rare: false },
  [ENERGY_TYPE.CHARGED]: { value: 4, radius: 7, weight: 24, rare: false },
  [ENERGY_TYPE.PRISM]: { value: 12, radius: 9, weight: 5, rare: true, xpBonus: 8 },
  [ENERGY_TYPE.VOID]: { value: 20, radius: 10, weight: 1, rare: true, xpBonus: 20, buff: 'magnet' },
  [ENERGY_TYPE.ANCIENT]: { value: 60, radius: 16, weight: 0, rare: true, xpBonus: 80 },
};

let nextId = 1;

export class EnergyField {
  constructor(arena, { density = 1 } = {}) {
    this.arena = arena;
    this.density = density;
    this.particles = [];
    this.pool = [];
    this.targetCount = Math.round(arena.radius * arena.radius * 0.00013 * density);
    this._ancientTimer = rand(40, 70);
    this._grid = new Map();
    this.cellSize = 220;
  }

  _spawnPoint() {
    // Weighted pick of a location: prefer luminous fields, avoid dense
    // stacking inside void pockets, favor pulse gardens on their beat.
    for (let tries = 0; tries < 6; tries++) {
      const angle = rand(0, Math.PI * 2);
      const d = Math.sqrt(Math.random()) * (this.arena.radius - 60);
      const x = Math.cos(angle) * d;
      const y = Math.sin(angle) * d;
      const zone = this.arena.zoneAt(x, y);
      if (zone?.type === ZONE.VOID_POCKET && Math.random() < 0.85) continue;
      return { x, y, zone };
    }
    return { x: 0, y: 0, zone: null };
  }

  _pickType(zone) {
    if (zone?.type === ZONE.VOID_POCKET) {
      return Math.random() < 0.4 ? ENERGY_TYPE.PRISM : Math.random() < 0.1 ? ENERGY_TYPE.VOID : ENERGY_TYPE.COMMON;
    }
    const r = Math.random() * 100;
    if (r < 70) return ENERGY_TYPE.COMMON;
    if (r < 94) return ENERGY_TYPE.CHARGED;
    if (r < 99.3) return ENERGY_TYPE.PRISM;
    return ENERGY_TYPE.VOID;
  }

  _spawn(type, x, y) {
    const meta = ENERGY_META[type];
    const p = this.pool.pop() || {};
    p.id = nextId++;
    p.type = type;
    p.x = x; p.y = y;
    p.r = meta.radius;
    p.value = meta.value;
    p.alive = true;
    p.phase = Math.random() * Math.PI * 2;
    p.bob = rand(0.5, 1.2);
    p.listIndex = this.particles.length;
    this.particles.push(p);
    this._addToGrid(p);
    return p;
  }

  spawnBurst(x, y, count, favorType = null) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, 40);
      const type = favorType || (Math.random() < 0.15 ? ENERGY_TYPE.CHARGED : ENERGY_TYPE.COMMON);
      this._spawn(type, x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
  }

  update(dt, elapsedSeconds) {
    // Pulse gardens: periodic wave emission.
    for (const z of this.arena.zones) {
      if (z.type !== ZONE.PULSE_GARDEN) continue;
      const period = 4.2;
      const t = (elapsedSeconds + z.phase) % period;
      if (t < dt) {
        const count = 14;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const rr = rand(z.r * 0.2, z.r * 0.9);
          this._spawn(this._pickType(z), z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr);
        }
      }
    }

    if (this.particles.length < this.targetCount) {
      const toSpawn = Math.min(4, this.targetCount - this.particles.length);
      for (let i = 0; i < toSpawn; i++) {
        const { x, y, zone } = this._spawnPoint();
        this._spawn(this._pickType(zone), x, y);
      }
    }

    this._ancientTimer -= dt;
    if (this._ancientTimer <= 0 && !this.particles.some((p) => p.type === ENERGY_TYPE.ANCIENT)) {
      const angle = rand(0, Math.PI * 2);
      const d = rand(0, this.arena.radius * 0.6);
      this._spawn(ENERGY_TYPE.ANCIENT, Math.cos(angle) * d, Math.sin(angle) * d);
      this._ancientTimer = rand(90, 150);
    }

    for (const p of this.particles) p.phase += dt * p.bob;
  }

  // Particles never move once spawned, so the spatial grid is maintained
  // incrementally on spawn/remove rather than rebuilt from scratch every
  // frame (this used to reallocate hundreds of bucket arrays per frame).
  _addToGrid(p) {
    const key = this._cellKey(p.x, p.y);
    let bucket = this._grid.get(key);
    if (!bucket) this._grid.set(key, (bucket = []));
    p._cellKey = key;
    p._cellIndex = bucket.length;
    bucket.push(p);
  }

  _removeFromGrid(p) {
    const bucket = this._grid.get(p._cellKey);
    if (!bucket) return;
    const last = bucket.length - 1;
    const idx = p._cellIndex;
    if (idx !== last) {
      const moved = bucket[last];
      bucket[idx] = moved;
      moved._cellIndex = idx;
    }
    bucket.pop();
  }

  _cellKey(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  nearby(x, y, radius) {
    const result = [];
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this._grid.get(`${cx},${cy}`);
        if (!bucket) continue;
        for (const p of bucket) if (dist(x, y, p.x, p.y) <= radius) result.push(p);
      }
    }
    return result;
  }

  remove(p) {
    if (!p.alive) return;
    const idx = p.listIndex;
    const last = this.particles.length - 1;
    if (idx !== last) {
      const moved = this.particles[last];
      this.particles[idx] = moved;
      moved.listIndex = idx;
    }
    this.particles.pop();
    this._removeFromGrid(p);
    p.alive = false;
    this.pool.push(p);
  }
}
