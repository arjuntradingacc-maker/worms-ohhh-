import { rand, dist, clamp } from '../core/vec.js';

// Zone type identifiers. "field" (Luminous Fields) is the implicit default
// everywhere a special zone circle doesn't cover.
export const ZONE = {
  FIELD: 'field',
  GRAVITY_WELL: 'gravityWell',
  PULSE_GARDEN: 'pulseGarden',
  VOID_POCKET: 'voidPocket',
  AURORA: 'aurora',
};

export const ZONE_META = {
  [ZONE.GRAVITY_WELL]: { label: 'Gravity Well', color: '#8b6bff' },
  [ZONE.PULSE_GARDEN]: { label: 'Pulse Garden', color: '#ff5fd1' },
  [ZONE.VOID_POCKET]: { label: 'Void Pocket', color: '#3a2b57' },
  [ZONE.AURORA]: { label: 'Aurora Zone', color: '#4be3c8' },
};

export class Arena {
  constructor({ radius = 2600, zoneCount = 6, seed = Math.random() } = {}) {
    this.radius = radius;
    this.zones = [];
    this._generateZones(zoneCount);
    this.pulsePhase = 0;
  }

  _generateZones(count) {
    const types = [ZONE.GRAVITY_WELL, ZONE.PULSE_GARDEN, ZONE.VOID_POCKET, ZONE.AURORA];
    let attempts = 0;
    const minCenterGap = this.radius * 0.22;
    while (this.zones.length < count && attempts < count * 40) {
      attempts++;
      const type = types[this.zones.length % types.length];
      const r = rand(this.radius * 0.1, this.radius * 0.2);
      const maxCenterDist = this.radius - r - this.radius * 0.05;
      const angle = rand(0, Math.PI * 2);
      const d = rand(this.radius * 0.15, maxCenterDist);
      const x = Math.cos(angle) * d;
      const y = Math.sin(angle) * d;
      if (dist(0, 0, x, y) < minCenterGap && this.zones.length > 0) continue;
      const overlaps = this.zones.some((z) => dist(z.x, z.y, x, y) < z.r + r + 120);
      if (overlaps) continue;
      this.zones.push({ type, x, y, r, phase: rand(0, Math.PI * 2), seed: Math.random() });
    }
  }

  update(dt) {
    this.pulsePhase += dt;
  }

  zoneAt(x, y) {
    for (const z of this.zones) {
      if (dist(z.x, z.y, x, y) <= z.r) return z;
    }
    return null;
  }

  // Small heading bias applied near Gravity Wells; returns a delta angle.
  gravityBias(x, y, heading) {
    let bias = 0;
    for (const z of this.zones) {
      if (z.type !== ZONE.GRAVITY_WELL) continue;
      const d = dist(z.x, z.y, x, y);
      if (d > z.r * 1.6) continue;
      const toWell = Math.atan2(z.y - y, z.x - x);
      let diff = toWell - heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const strength = clamp(1 - d / (z.r * 1.6), 0, 1) * 0.9;
      bias += diff * strength * 0.06;
    }
    return bias;
  }

  distanceToEdge(x, y) {
    return this.radius - dist(0, 0, x, y);
  }

  containPoint(x, y, margin = 0) {
    const d = dist(0, 0, x, y);
    const max = this.radius - margin;
    if (d <= max) return { x, y, bounced: false };
    const scale = max / d;
    return { x: x * scale, y: y * scale, bounced: true };
  }
}
