// Ability catalog. Each Lumen carries exactly one equipped ability (mobile
// controls stay one-hand friendly: joystick + a single action button).
// Surge/Drift are movement *states*, not abilities — see lumen.js.
//
// `activate(lumen, match)` applies the effect and returns nothing; ongoing
// effects are driven every tick from lumen.ability.active in lumen.js.

export const ABILITY = {
  PULSE_DASH: 'pulseDash',
  PHASE_SHIFT: 'phaseShift',
  MAGNET_CORE: 'magnetCore',
  ENERGY_SHIELD: 'energyShield',
};

export const ABILITY_DEFS = {
  [ABILITY.PULSE_DASH]: {
    id: ABILITY.PULSE_DASH,
    name: 'Pulse Dash',
    desc: 'Instantly propel forward, briefly outrunning your own trail risk.',
    cooldown: 6,
    duration: 0.35,
    icon: 'dash',
    unlockLevel: 1,
  },
  [ABILITY.PHASE_SHIFT]: {
    id: ABILITY.PHASE_SHIFT,
    name: 'Phase Shift',
    desc: 'Become intangible for a moment — pass through trails unharmed.',
    cooldown: 11,
    duration: 1.1,
    icon: 'phase',
    unlockLevel: 5,
  },
  [ABILITY.MAGNET_CORE]: {
    id: ABILITY.MAGNET_CORE,
    name: 'Magnet Core',
    desc: 'Pull in nearby energy fragments automatically.',
    cooldown: 14,
    duration: 4.5,
    icon: 'magnet',
    unlockLevel: 10,
  },
  [ABILITY.ENERGY_SHIELD]: {
    id: ABILITY.ENERGY_SHIELD,
    name: 'Energy Shield',
    desc: 'Absorb the next collision instead of losing energy.',
    cooldown: 18,
    duration: 8,
    icon: 'shield',
    unlockLevel: 15,
  },
};

export function unlockedAbilities(level) {
  return Object.values(ABILITY_DEFS).filter((a) => level >= a.unlockLevel);
}

export function createAbilityState(id) {
  return { id, cooldownRemaining: 0, active: false, timeRemaining: 0 };
}

export function tickAbility(state, dt) {
  if (state.cooldownRemaining > 0) state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
  if (state.active) {
    state.timeRemaining -= dt;
    if (state.timeRemaining <= 0) {
      state.active = false;
      state.timeRemaining = 0;
    }
  }
}

export function canActivate(state) {
  return state && state.cooldownRemaining <= 0 && !state.active;
}

// Applies the ability's instantaneous / start-of-duration effects onto a
// lumen. `match` gives access to audio/haptics/vfx callbacks.
export function activateAbility(lumen, match) {
  const state = lumen.ability;
  if (!state || !canActivate(state)) return false;
  const def = ABILITY_DEFS[state.id];
  state.cooldownRemaining = def.cooldown;

  switch (state.id) {
    case ABILITY.PULSE_DASH: {
      state.active = true;
      state.timeRemaining = def.duration;
      lumen.dashBoost = 3.2;
      break;
    }
    case ABILITY.PHASE_SHIFT: {
      state.active = true;
      state.timeRemaining = def.duration;
      lumen.phased = true;
      break;
    }
    case ABILITY.MAGNET_CORE: {
      state.active = true;
      state.timeRemaining = def.duration;
      lumen.magnetActive = true;
      break;
    }
    case ABILITY.ENERGY_SHIELD: {
      state.active = true;
      state.timeRemaining = def.duration;
      lumen.shieldCharges = 1;
      break;
    }
    default:
      return false;
  }
  match?.onAbilityUsed?.(lumen, def);
  return true;
}
