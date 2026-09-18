import { dist, rand, clamp } from '../core/vec.js';
import { ABILITY } from './abilities.js';

export const PERSONALITY = {
  EXPLORER: 'explorer',
  AGGRESSIVE: 'aggressive',
  DEFENSIVE: 'defensive',
  OPPORTUNIST: 'opportunist',
  HUNTER: 'hunter',
  STRATEGIST: 'strategist',
};

const AVOID_CHANCE = {
  [PERSONALITY.EXPLORER]: 0.8,
  [PERSONALITY.DEFENSIVE]: 0.92,
  [PERSONALITY.STRATEGIST]: 0.85,
  [PERSONALITY.OPPORTUNIST]: 0.6,
  [PERSONALITY.AGGRESSIVE]: 0.35,
  [PERSONALITY.HUNTER]: 0.28,
};

const PERSONALITY_ABILITY = {
  [PERSONALITY.EXPLORER]: ABILITY.PULSE_DASH,
  [PERSONALITY.DEFENSIVE]: ABILITY.PHASE_SHIFT,
  [PERSONALITY.STRATEGIST]: ABILITY.PHASE_SHIFT,
  [PERSONALITY.OPPORTUNIST]: ABILITY.MAGNET_CORE,
  [PERSONALITY.AGGRESSIVE]: ABILITY.PULSE_DASH,
  [PERSONALITY.HUNTER]: ABILITY.PULSE_DASH,
};

export function pickPersonality() {
  const all = Object.values(PERSONALITY);
  return all[(Math.random() * all.length) | 0];
}

export function abilityForPersonality(personality) {
  return PERSONALITY_ABILITY[personality] || ABILITY.PULSE_DASH;
}

const NAME_PREFIX = ['Nyx', 'Vex', 'Kael', 'Suna', 'Rho', 'Ithe', 'Or', 'Vael', 'Lux', 'Zeph', 'Mira', 'Quen'];
const NAME_SUFFIX = ['ara', 'ion', 'ith', 'oss', 'yn', 'or', 'eth', 'ux', 'is', 'ael'];
export function generateBotName() {
  return NAME_PREFIX[(Math.random() * NAME_PREFIX.length) | 0] + NAME_SUFFIX[(Math.random() * NAME_SUFFIX.length) | 0];
}

function fleeTarget(bot, threat, arena) {
  const away = Math.atan2(bot.y - threat.y, bot.x - threat.x);
  const d = 260;
  let x = bot.x + Math.cos(away) * d;
  let y = bot.y + Math.sin(away) * d;
  const contained = arena.containPoint(x, y, arena.radius * 0.05);
  return { x: contained.x, y: contained.y };
}

function nearestThreat(bot, lumens) {
  let best = null, bestD = Infinity;
  for (const other of lumens) {
    if (other === bot || !other.alive) continue;
    if (other.radius < bot.radius * 1.3) continue;
    const d = dist(bot.x, bot.y, other.x, other.y);
    if (d < 520 && d < bestD) { best = other; bestD = d; }
  }
  return best;
}

function bestPrey(bot, lumens, preferIsolated) {
  let best = null, bestScore = -Infinity;
  for (const other of lumens) {
    if (other === bot || !other.alive) continue;
    if (other.radius > bot.radius * 0.9) continue;
    const d = dist(bot.x, bot.y, other.x, other.y);
    if (d > 800) continue;
    let score = 1 / (d + 60) + other.visibilityFactor * 0.4;
    if (other.isPlayer) score *= 1.05;
    if (best === null || score > bestScore) { best = other; bestScore = score; }
  }
  return best;
}

function bestEnergy(bot, energyField, preferRare) {
  const nearby = energyField.nearby(bot.x, bot.y, 900);
  let best = null, bestScore = -Infinity;
  for (const p of nearby) {
    const d = dist(bot.x, bot.y, p.x, p.y);
    let score = p.value / (d + 40);
    if (preferRare && (p.type === 'prism' || p.type === 'void' || p.type === 'ancient')) score *= 3;
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return best;
}

function wanderTarget(bot, arena) {
  const angle = rand(0, Math.PI * 2);
  const d = rand(arena.radius * 0.2, arena.radius * 0.75);
  return { x: Math.cos(angle) * d, y: Math.sin(angle) * d };
}

export function decideBot(bot, lumens, energyField, arena) {
  const p = bot.personality;
  const threat = nearestThreat(bot, lumens);

  if (threat && p !== PERSONALITY.AGGRESSIVE && p !== PERSONALITY.HUNTER) {
    return { point: fleeTarget(bot, threat, arena), surge: true, ability: 'escape' };
  }
  if (threat && dist(bot.x, bot.y, threat.x, threat.y) < 140) {
    return { point: fleeTarget(bot, threat, arena), surge: true, ability: 'escape' };
  }

  if (p === PERSONALITY.AGGRESSIVE || p === PERSONALITY.HUNTER || p === PERSONALITY.OPPORTUNIST) {
    const prey = bestPrey(bot, lumens, true);
    if (prey) {
      const lead = clamp(dist(bot.x, bot.y, prey.x, prey.y) * 0.18, 30, 160);
      return {
        point: { x: prey.x + Math.cos(prey.heading) * lead, y: prey.y + Math.sin(prey.heading) * lead },
        surge: p !== PERSONALITY.OPPORTUNIST,
        ability: 'chase',
      };
    }
  }

  const preferRare = p === PERSONALITY.OPPORTUNIST || p === PERSONALITY.STRATEGIST;
  const energyTarget = bestEnergy(bot, energyField, preferRare);
  if (energyTarget) {
    return { point: { x: energyTarget.x, y: energyTarget.y }, surge: false, ability: null };
  }

  return { point: wanderTarget(bot, arena), surge: false, ability: null };
}

// Steers `angle` away from nearby foreign trail segments so bots don't
// blindly run into other Lumens' bodies — gated by a per-personality
// chance so bots still make believable mistakes under pressure.
function applyAvoidance(bot, angle, lumens) {
  if (Math.random() > AVOID_CHANCE[bot.personality]) return angle;
  const lookahead = bot.radius + 90;
  const aheadX = bot.x + Math.cos(angle) * lookahead;
  const aheadY = bot.y + Math.sin(angle) * lookahead;
  let repelX = 0, repelY = 0, found = false;
  for (const other of lumens) {
    if (other === bot || !other.alive) continue;
    if (dist(bot.x, bot.y, other.x, other.y) > 500) continue;
    for (let i = 2; i < other.trail.length; i += 3) {
      const seg = other.trail[i];
      const d = dist(aheadX, aheadY, seg.x, seg.y);
      if (d < bot.radius + 26) {
        repelX += aheadX - seg.x;
        repelY += aheadY - seg.y;
        found = true;
      }
    }
  }
  if (!found) return angle;
  const repelAngle = Math.atan2(repelY, repelX);
  return angle * 0.35 + repelAngle * 0.65;
}

export function updateBot(bot, lumens, energyField, arena, dt, elapsed) {
  bot._reevalTimer = (bot._reevalTimer || 0) - dt;
  if (bot._reevalTimer === undefined || bot._reevalTimer <= 0 || !bot._target) {
    bot._reevalTimer = rand(0.22, 0.42);
    bot._decision = decideBot(bot, lumens, energyField, arena);
    bot._target = bot._decision.point;
  }
  let angle = Math.atan2(bot._target.y - bot.y, bot._target.x - bot.x);
  angle = applyAvoidance(bot, angle, lumens);
  angle += Math.sin(elapsed * 1.4 + bot.id * 1.7) * 0.05;

  const d = dist(bot.x, bot.y, bot._target.x, bot._target.y);
  let magnitude = bot._decision.surge ? 0.95 : d < 70 ? 0.4 : 0.6;
  bot.setInput(angle, magnitude);

  if (bot._decision.ability === 'escape' && bot.ability) bot.requestAbility();
  else if (bot._decision.ability === 'chase' && bot.ability && Math.random() < 0.02) bot.requestAbility();
}
