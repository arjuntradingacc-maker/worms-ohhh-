import { angleDiff, angleStep, clamp, damp, dist } from '../core/vec.js';
import { createAbilityState, tickAbility } from './abilities.js';

export const MOVE_STATE = { DRIFT: 'drift', FLOW: 'flow', SURGE: 'surge' };

const BASE_RADIUS = 15;
const COMBO_WINDOW = 2.6; // seconds allowed between collects before the multiplier resets
const MAX_COMBO = 6;
const SURGE_STAMINA_DRAIN = 42; // per second while surging
const SURGE_STAMINA_REGEN = 24; // per second otherwise

let nextId = 1;

export class Lumen {
  constructor({ isPlayer = false, name = 'Lumen', x = 0, y = 0, heading = 0, cosmetics, abilityId, personality = null }) {
    this.id = nextId++;
    this.isPlayer = isPlayer;
    this.name = name;
    this.personality = personality; // null for the player; a string for bots
    this.cosmetics = cosmetics;

    this.x = x;
    this.y = y;
    this.heading = heading;
    this.targetHeading = heading;
    this.speed = 0;

    this.mass = 12;
    this.score = 0;
    this.trail = [{ x, y }];
    this._distSinceSample = 0;

    this.moveState = MOVE_STATE.FLOW;
    this.stamina = 100;
    this.dashBoost = 0;
    this.phased = false;
    this.magnetActive = false;
    this.shieldCharges = 0;

    this.overcharge = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboFlash = 0;

    this.ability = abilityId ? createAbilityState(abilityId) : null;

    this.alive = true;
    this.bornAt = 0;
    this.survivalSeconds = 0;
    this.lastHitAt = -999;
    this.eliminations = 0;

    this.hitFlash = 0;
    this.deathInfo = null;

    // Scratch fields the renderer / camera read but never own.
    this.zone = null;
  }

  get radius() {
    return BASE_RADIUS + Math.sqrt(Math.max(0, this.mass)) * 2.5;
  }

  get bodyLength() {
    return 50 + this.mass * 1.6;
  }

  get pickupRadius() {
    return this.radius + 8 + this.overcharge * 0.12 + (this.magnetActive ? 140 : 0);
  }

  get comboMultiplier() {
    return 1 + this.comboCount;
  }

  get visibilityFactor() {
    // 0..1, how much bots should be drawn to this lumen's overcharge glow.
    return this.overcharge / 100;
  }

  setInput(angle, magnitude) {
    this._inputAngle = angle;
    this._inputMagnitude = clamp(magnitude, 0, 1);
    this._hasInput = magnitude > 0.02;
  }

  requestAbility(match) {
    this._wantsAbility = true;
  }

  onCollect(meta, match) {
    this.mass += meta.value * 2.4;
    const multiplier = this.comboMultiplier;
    const gained = Math.round(meta.value * multiplier);
    this.score += gained;
    this.comboTimer = COMBO_WINDOW;
    if (this.comboCount < MAX_COMBO - 1) {
      this.comboCount += 1;
      this.comboFlash = 0.4;
    }
    this.overcharge = clamp(this.overcharge + meta.value * 0.9, 0, 100);
    return gained;
  }

  applyBuff(name) {
    if (name === 'magnet') {
      this.magnetActive = true;
      this._voidMagnetTimer = 6;
    }
  }

  update(dt, arena) {
    if (!this.alive) return;
    this.survivalSeconds += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
    this.comboFlash = Math.max(0, this.comboFlash - dt);

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Determine desired movement state from input magnitude (falls back to
    // Flow when the stick is released so the creature keeps drifting
    // forward, per the "continuously moving" brief).
    const mag = this._hasInput ? this._inputMagnitude : 0.5;
    let desiredState = MOVE_STATE.FLOW;
    if (mag < 0.24) desiredState = MOVE_STATE.DRIFT;
    else if (mag > 0.8 && this.stamina > 4) desiredState = MOVE_STATE.SURGE;
    this.moveState = desiredState;

    if (this.moveState === MOVE_STATE.SURGE) {
      this.stamina = clamp(this.stamina - SURGE_STAMINA_DRAIN * dt, 0, 100);
    } else {
      this.stamina = clamp(this.stamina + SURGE_STAMINA_REGEN * dt, 0, 100);
    }

    // Ability lifecycle.
    if (this.ability) {
      tickAbility(this.ability, dt);
      if (!this.ability.active) {
        this.phased = false;
        this.magnetActive = this._voidMagnetTimer > 0;
      }
    }
    if (this._voidMagnetTimer > 0) {
      this._voidMagnetTimer -= dt;
      this.magnetActive = true;
    }
    this.dashBoost = Math.max(0, this.dashBoost - dt * 2.4);

    // Steering: momentum-based turn rate depending on move state.
    const turnRates = { [MOVE_STATE.DRIFT]: 3.4, [MOVE_STATE.FLOW]: 2.2, [MOVE_STATE.SURGE]: 1.35 };
    const controlPenalty = 1 - (this.overcharge / 100) * 0.18;
    let maxTurn = turnRates[this.moveState] * controlPenalty * dt;
    if (this._hasInput) {
      this.targetHeading = this._inputAngle;
    }
    const gravBias = arena.gravityBias(this.x, this.y, this.heading);
    this.heading = angleStep(this.heading, this.targetHeading, maxTurn);
    this.heading += gravBias;

    // Speed target depending on state + size (bigger = slightly slower) + dash.
    const sizeDrag = clamp(1 - (this.radius - BASE_RADIUS) * 0.0016, 0.55, 1);
    const baseSpeeds = { [MOVE_STATE.DRIFT]: 95, [MOVE_STATE.FLOW]: 170, [MOVE_STATE.SURGE]: 275 };
    let targetSpeed = baseSpeeds[this.moveState] * sizeDrag;
    if (this.dashBoost > 0) targetSpeed += 420 * (this.dashBoost / 3.2);
    this.speed = damp(this.speed, targetSpeed, 0.35, dt);

    // Integrate position.
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;

    // Arena containment: soft bounce with a small energy cost, telegraphed
    // by the renderer glowing the boundary as the player nears it.
    const contained = arena.containPoint(this.x, this.y, this.radius);
    if (contained.bounced) {
      this.x = contained.x;
      this.y = contained.y;
      const normalAngle = Math.atan2(this.y, this.x);
      this.heading = normalAngle + Math.PI + angleDiff(normalAngle, this.heading) * 0.3;
      this.speed *= 0.4;
      this.mass = Math.max(10, this.mass - 1.5);
      this._boundaryHit = true;
    } else {
      this._boundaryHit = false;
    }

    this.zone = arena.zoneAt(this.x, this.y);

    // Passive overcharge drift: rises slowly while alive & growing, decays
    // when idle-small, creating the risk/reward tension from the brief.
    const target = clamp(20 + Math.sqrt(this.mass) * 3.2, 0, 100);
    this.overcharge = damp(this.overcharge, target, 0.12, dt);

    // Trail sampling: push a new point once we've moved far enough that the
    // spacing stays proportional to body size, independent of frame rate.
    const spacing = Math.max(7, this.radius * 0.32);
    const head = this.trail[0];
    const d = dist(head.x, head.y, this.x, this.y);
    if (d >= spacing) {
      this.trail.unshift({ x: this.x, y: this.y });
    }

    // Trim tail to the mass-derived body length, with a hard cap so an
    // extreme, long-lived Lumen can never blow up render/collision cost.
    let acc = 0;
    let cut = this.trail.length;
    for (let i = 1; i < this.trail.length; i++) {
      acc += dist(this.trail[i - 1].x, this.trail[i - 1].y, this.trail[i].x, this.trail[i].y);
      if (acc >= this.bodyLength) { cut = i + 1; break; }
    }
    cut = Math.min(cut, 220);
    if (cut < this.trail.length) this.trail.length = cut;
  }

  segmentCount() {
    return Math.max(3, Math.min(90, Math.round(this.bodyLength / Math.max(7, this.radius * 0.32))));
  }

  kill(reason) {
    this.alive = false;
    this.deathInfo = { reason, at: this.survivalSeconds, mass: this.mass, score: this.score };
  }
}
