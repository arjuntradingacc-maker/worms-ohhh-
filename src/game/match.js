import { Arena } from './arena.js';
import { EnergyField, ENERGY_META } from './energy.js';
import { Lumen } from './lumen.js';
import { activateAbility } from './abilities.js';
import { updateBot, pickPersonality, abilityForPersonality, generateBotName, PERSONALITY } from './bots.js';
import { VoidTitan } from './titan.js';
import { Camera } from './camera.js';
import { dist, rand, clamp } from '../core/vec.js';

export const MODES = {
  classic: {
    id: 'classic', name: 'Classic Arena', tagline: 'Free-for-all. Survive. Dominate.',
    arenaRadius: 2600, zoneCount: 6, botCount: 11, energyDensity: 1,
    duration: null, respawnBots: true, allowTitan: true,
  },
  rush: {
    id: 'rush', name: 'Rush', tagline: '3-minute sprint. Energy floods the arena.',
    arenaRadius: 2000, zoneCount: 5, botCount: 10, energyDensity: 1.8,
    duration: 180, respawnBots: true, allowTitan: false,
  },
  duel: {
    id: 'duel', name: 'Duel', tagline: 'Small arena. Nowhere to hide.',
    arenaRadius: 1100, zoneCount: 2, botCount: 2, energyDensity: 1.1,
    duration: 90, respawnBots: false, allowTitan: false,
  },
  hunter: {
    id: 'hunter', name: 'Hunter', tagline: 'One of them hunts. Everyone else survives.',
    arenaRadius: 2200, zoneCount: 5, botCount: 9, energyDensity: 1,
    duration: 120, respawnBots: false, allowTitan: false, hasHunter: true,
  },
};

export const COMING_SOON_MODES = [
  { id: 'relay', name: 'Relay', tagline: 'Chain energy checkpoints in sequence.' },
  { id: 'teamPulse', name: 'Team Pulse', tagline: 'Two teams. One energy pool.' },
  { id: 'voidEvent', name: 'Void Event', tagline: 'Rotating rule-breaking arena event.' },
];

const COLLISION_COOLDOWN = 0.7;

export class Match {
  constructor(modeConfig, profile) {
    this.mode = modeConfig;
    this.profile = profile;
    this.arena = new Arena({ radius: modeConfig.arenaRadius, zoneCount: modeConfig.zoneCount });
    this.energyField = new EnergyField(this.arena, { density: modeConfig.energyDensity });
    this.camera = new Camera();
    this.elapsed = 0;
    this.ended = false;
    this.result = null;
    this.effects = [];
    this.titan = null;
    this._titanSpawned = false;
    this._titanSpawnAt = rand(45, 65);
    this._respawnQueue = [];
    this._playerMaxRadius = 0;
    this._collisionCooldowns = new Map();
    this.freezeTimer = 0;
    this.maxOverchargeSeen = 0;
    this.untouchedSeconds = 0;
    this.maxUntouchedSeconds = 0;
    this.lastKillerName = null;

    this.runStats = {
      energyThisRun: 0, bestCombo: 0, abilitiesUsed: 0, rareCollected: 0,
      top3Finishes: 0, titanParticipations: 0, surviveSeconds: 0, eliminationsThisRun: 0,
    };

    // Callbacks the UI layer wires up for audio/haptics/toasts.
    this.onCollect = null;
    this.onAbilityUsed = null;
    this.onCollision = null;
    this.onElimination = null;
    this.onTitanDefeated = null;
    this.onPlayerEliminated = null;
    this.onMatchEnd = null;

    this.lumens = [];
    this._spawnPlayerAndBots(profile);
  }

  _spawnPoint(index, total) {
    const angle = (index / total) * Math.PI * 2 + rand(-0.2, 0.2);
    const d = rand(this.arena.radius * 0.2, this.arena.radius * 0.55);
    return { x: Math.cos(angle) * d, y: Math.sin(angle) * d, heading: angle + Math.PI };
  }

  _spawnPlayerAndBots(profile) {
    const total = this.mode.botCount + 1;
    const p0 = this._spawnPoint(0, total);
    this.player = new Lumen({
      isPlayer: true, name: profile.name, x: p0.x, y: p0.y, heading: p0.heading,
      cosmetics: profile.cosmetics.equipped, abilityId: profile.loadout.ability,
    });
    this.lumens.push(this.player);

    let hunterAssigned = false;
    for (let i = 1; i < total; i++) {
      const pt = this._spawnPoint(i, total);
      let personality = pickPersonality();
      if (this.mode.hasHunter && !hunterAssigned) { personality = PERSONALITY.HUNTER; hunterAssigned = true; }
      this.lumens.push(this._makeBot(pt, personality, this.mode.hasHunter && personality === PERSONALITY.HUNTER));
    }
  }

  _makeBot(pt, personality, isDesignatedHunter = false) {
    const bot = new Lumen({
      isPlayer: false, name: generateBotName(), x: pt.x, y: pt.y, heading: pt.heading,
      cosmetics: null, abilityId: abilityForPersonality(personality), personality,
    });
    if (isDesignatedHunter) {
      bot.mass = 60;
      bot.isHunter = true;
    } else {
      bot.mass = rand(10, 45);
    }
    return bot;
  }

  setPlayerInput(angle, magnitude) {
    this.player.setInput(angle, magnitude);
  }

  requestPlayerAbility() {
    this.player.requestAbility();
  }

  update(dt) {
    if (this.ended) return;
    dt = Math.min(dt, 0.05);
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      dt *= 0.06;
    }
    this.elapsed += dt;
    this.runStats.surviveSeconds = this.player.survivalSeconds;

    this.arena.update(dt);
    this.energyField.update(dt, this.elapsed);

    for (const lumen of this.lumens) {
      if (!lumen.alive) continue;
      if (!lumen.isPlayer) updateBot(lumen, this.lumens, this.energyField, this.arena, dt, this.elapsed);
      lumen.update(dt, this.arena);
      if (lumen._wantsAbility) {
        const ok = activateAbility(lumen, this);
        lumen._wantsAbility = false;
        if (ok && lumen.isPlayer) this.runStats.abilitiesUsed += 1;
      }
      if (lumen._boundaryHit && lumen.isPlayer) {
        this.effects.push({ type: 'boundary', x: lumen.x, y: lumen.y });
      }
    }

    this._handleCollection();
    this._handleCollisions();
    this._handleTitan(dt);
    this._processRespawns(dt);
    this._pruneDeadLumens();

    this._playerMaxRadius = Math.max(this._playerMaxRadius, this.player.radius);
    this.runStats.bestCombo = Math.max(this.runStats.bestCombo, this.player.comboCount + 1);
    this.maxOverchargeSeen = Math.max(this.maxOverchargeSeen, this.player.overcharge);
    if (this.player.hitFlash > 0.85) this.untouchedSeconds = 0;
    else this.untouchedSeconds += dt;
    this.maxUntouchedSeconds = Math.max(this.maxUntouchedSeconds, this.untouchedSeconds);

    this.camera.follow(this.player, dt, this.profile.settings.reducedMotion);

    this._checkEndConditions();
  }

  _handleCollection() {
    for (const lumen of this.lumens) {
      if (!lumen.alive) continue;
      const nearby = this.energyField.nearby(lumen.x, lumen.y, lumen.pickupRadius);
      for (const p of nearby) {
        if (dist(lumen.x, lumen.y, p.x, p.y) > lumen.pickupRadius) continue;
        const meta = ENERGY_META[p.type];
        const gained = lumen.onCollect(meta, this);
        this.energyField.remove(p);
        if (p.type === 'void' || meta.buff) lumen.applyBuff(meta.buff);
        if (lumen.isPlayer) {
          this.runStats.energyThisRun += meta.value;
          if (meta.rare) this.runStats.rareCollected += 1;
          this.effects.push({ type: 'collectText', x: p.x, y: p.y, text: `+${gained}`, energyType: p.type });
        }
        this.onCollect?.(lumen, p, gained);
      }
    }
  }

  _pairKey(a, b) { return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`; }

  _handleCollisions() {
    const alive = this.lumens.filter((l) => l.alive);

    // Brief spawn grace: skip lethal trail collisions for the first couple
    // of seconds so nobody (player included) can be eliminated before
    // they've had a chance to see the arena, let alone react.
    const trailCollisionsEnabled = this.elapsed > 2.5;

    // Core-vs-core "bumps": partial energy loss for the smaller Lumen.
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        if (a.phased || b.phased) continue;
        const key = this._pairKey(a, b);
        const last = this._collisionCooldowns.get(key) || -999;
        if (this.elapsed - last < COLLISION_COOLDOWN) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < a.radius + b.radius) {
          this._collisionCooldowns.set(key, this.elapsed);
          this._resolveBump(a, b);
        }
      }
    }

    // Trail collisions: running into someone else's energized trail bursts you.
    if (!trailCollisionsEnabled) return;
    for (const victim of alive) {
      if (!victim.alive || victim.phased) continue;
      for (const owner of alive) {
        if (owner === victim || !owner.alive) continue;
        if (dist(victim.x, victim.y, owner.x, owner.y) > owner.bodyLength + victim.radius + 40) continue;
        const ownerSegRadius = owner.radius * 0.5;
        for (let i = 3; i < owner.trail.length; i++) {
          const seg = owner.trail[i];
          if (dist(victim.x, victim.y, seg.x, seg.y) < victim.radius * 0.82 + ownerSegRadius) {
            this._eliminate(victim, owner);
            break;
          }
        }
        if (!victim.alive) break;
      }
    }
  }

  _resolveBump(a, b) {
    const loser = a.radius <= b.radius ? a : b;
    const winner = loser === a ? b : a;
    if (loser.shieldCharges > 0) {
      loser.shieldCharges = 0;
      this.effects.push({ type: 'shieldBlock', x: loser.x, y: loser.y });
      this.onCollision?.(loser, winner, true);
      return;
    }
    const lost = loser.mass * 0.16;
    loser.mass = Math.max(10, loser.mass - lost);
    loser.overcharge *= 0.65;
    loser.hitFlash = 1;
    this.energyField.spawnBurst((loser.x + winner.x) / 2, (loser.y + winner.y) / 2, clamp(Math.round(lost / 3), 3, 14));
    const away = Math.atan2(loser.y - winner.y, loser.x - winner.x);
    loser.x += Math.cos(away) * 18;
    loser.y += Math.sin(away) * 18;
    this.effects.push({ type: 'bump', x: (loser.x + winner.x) / 2, y: (loser.y + winner.y) / 2 });
    this.onCollision?.(loser, winner, false);
  }

  _eliminate(victim, owner) {
    victim.kill('trail');
    victim._diedAtElapsed = this.elapsed;
    owner.eliminations += 1;
    if (owner.isPlayer) this.runStats.eliminationsThisRun += 1;
    const burstCount = clamp(Math.round(victim.mass / 5), 8, 46);
    const pts = victim.trail;
    for (let i = 0; i < burstCount; i++) {
      const seg = pts[Math.floor((i / burstCount) * pts.length)] || { x: victim.x, y: victim.y };
      this.energyField.spawnBurst(seg.x, seg.y, 1, i % 6 === 0 ? 'charged' : null);
    }
    this.effects.push({ type: 'eliminate', x: victim.x, y: victim.y, name: victim.name });
    this.freezeTimer = 0.09;
    this.onElimination?.(victim, owner);

    if (victim.isPlayer) {
      this.lastKillerName = owner.name;
      this.onPlayerEliminated?.(victim, owner);
      this._endMatch('eliminated');
      return;
    }
    if (this.mode.respawnBots) {
      this._respawnQueue.push({ at: this.elapsed + 3.2, personality: victim.personality });
    }
  }

  // Dead bots stick around briefly (their burst/shockwave VFX and rank
  // standing stay meaningful for a few seconds) but must not accumulate
  // forever in an endless Classic session — respawns create fresh Lumen
  // instances rather than reusing the old one.
  _pruneDeadLumens() {
    if (this.lumens.length < 20) return;
    this.lumens = this.lumens.filter((l) => l.isPlayer || l.alive || this.elapsed - (l._diedAtElapsed ?? 0) < 5);
  }

  _processRespawns(dt) {
    if (!this._respawnQueue.length) return;
    const ready = this._respawnQueue.filter((r) => this.elapsed >= r.at);
    if (!ready.length) return;
    this._respawnQueue = this._respawnQueue.filter((r) => this.elapsed < r.at);
    for (const r of ready) {
      const idx = this.lumens.filter((l) => !l.isPlayer).length;
      const pt = this._spawnPoint(idx + 1, this.mode.botCount + 1);
      this.lumens.push(this._makeBot(pt, r.personality || pickPersonality()));
    }
  }

  _handleTitan(dt) {
    if (!this.mode.allowTitan) return;
    if (!this._titanSpawned && this.elapsed >= this._titanSpawnAt) {
      this.titan = new VoidTitan(this.arena);
      this._titanSpawned = true;
      this.effects.push({ type: 'titanWarning', x: this.titan.x, y: this.titan.y });
    }
    if (this.titan && this.titan.active) {
      const nearBefore = this.titan.state;
      this.titan.update(dt, this.lumens.filter((l) => l.alive), (titan) => {
        this.effects.push({ type: 'titanDefeat', x: titan.x, y: titan.y });
        const contribution = titan.contributors.get(this.player.id) || 0;
        if (contribution > 0) {
          this.runStats.titanParticipations += 1;
          this.onTitanDefeated?.(titan, contribution);
        }
        this.energyField.spawnBurst(titan.x, titan.y, 40, 'prism');
      });
      if (nearBefore === 'warning' && this.titan.state === 'active') {
        this.effects.push({ type: 'titanArrive', x: this.titan.x, y: this.titan.y });
      }
      if (this.titan._nearPlayerTick === undefined) this.titan._nearPlayerTick = 0;
      if (this.player._nearTitan) {
        this.runStats.titanParticipations = Math.max(this.runStats.titanParticipations, 1);
        this.player._nearTitan = false;
      }
    }
  }

  _rankOf(lumen) {
    const sorted = [...this.lumens].sort((a, b) => b.score - a.score);
    return sorted.indexOf(lumen) + 1;
  }

  _checkEndConditions() {
    if (this.mode.duration && this.elapsed >= this.mode.duration) {
      this._endMatch(this.mode.hasHunter ? 'survived' : 'time');
    }
  }

  _endMatch(reason) {
    if (this.ended) return;
    this.ended = true;
    const rank = this._rankOf(this.player);
    if (rank <= 3) this.runStats.top3Finishes = 1;
    this.result = {
      reason,
      mode: this.mode.id,
      rank,
      totalPlayers: this.lumens.length,
      score: this.player.score,
      size: Math.round(this._playerMaxRadius),
      survivalSeconds: Math.round(this.player.survivalSeconds),
      eliminations: this.player.eliminations,
      energyCollected: this.runStats.energyThisRun,
      won: reason === 'survived' || (rank === 1 && this.player.alive),
    };
    this.onMatchEnd?.(this.result);
  }

  forfeit() {
    this._endMatch('forfeit');
  }
}
