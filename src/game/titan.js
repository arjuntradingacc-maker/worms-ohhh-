import { dist, rand } from '../core/vec.js';

const WARNING_DURATION = 5;
const ROAM_DURATION = 45;
const MAX_HP = 2400;

// The Void Titan is an optional, non-blocking arena event: a giant neutral
// entity that roams slowly. Nearby Lumens chip its HP just by staying close
// (a lightweight stand-in for "attacking" it) and everyone who contributed
// shares in the reward when it falls.
export class VoidTitan {
  constructor(arena) {
    this.arena = arena;
    this.state = 'warning'; // warning -> active -> defeated/expired
    this.timer = WARNING_DURATION;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    const angle = rand(0, Math.PI * 2);
    const d = arena.radius * 0.55;
    this.x = Math.cos(angle) * d;
    this.y = Math.sin(angle) * d;
    this.radius = 90;
    this.heading = rand(0, Math.PI * 2);
    this.contributors = new Map(); // lumenId -> damage dealt
    this.pulsePhase = 0;
  }

  update(dt, lumens, onDefeated) {
    this.pulsePhase += dt;
    if (this.state === 'warning') {
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'active'; this.timer = ROAM_DURATION; }
      return;
    }
    if (this.state !== 'active') return;

    this.timer -= dt;
    this.heading += Math.sin(this.pulsePhase * 0.3) * 0.4 * dt;
    const contained = this.arena.containPoint(this.x + Math.cos(this.heading) * 40, this.y + Math.sin(this.heading) * 40, this.radius);
    if (contained.bounced) this.heading += Math.PI * 0.5;
    this.x += Math.cos(this.heading) * 60 * dt;
    this.y += Math.sin(this.heading) * 60 * dt;

    for (const lumen of lumens) {
      if (!lumen.alive) continue;
      const d = dist(this.x, this.y, lumen.x, lumen.y);
      if (d < this.radius + lumen.radius + 10) {
        const dmg = (8 + lumen.radius * 0.12) * dt;
        this.hp -= dmg;
        this.contributors.set(lumen.id, (this.contributors.get(lumen.id) || 0) + dmg);
        lumen._nearTitan = true;
      }
    }

    if (this.hp <= 0) {
      this.state = 'defeated';
      onDefeated?.(this);
    } else if (this.timer <= 0) {
      this.state = 'expired';
    }
  }

  get active() {
    return this.state === 'warning' || this.state === 'active';
  }

  get finished() {
    return this.state === 'defeated' || this.state === 'expired';
  }
}
