// Cosmetic catalog. Everything here is purely visual — no stat is ever
// touched by a cosmetic. Each item is rendered by parameterizing shape /
// palette / particle-style enums that the renderer already knows how to
// draw, so adding an item never requires new art assets.

export const RARITY = {
  common: { label: 'Common', order: 0, glow: 0.15 },
  rare: { label: 'Rare', order: 1, glow: 0.35 },
  epic: { label: 'Epic', order: 2, glow: 0.55 },
  mythic: { label: 'Mythic', order: 3, glow: 0.75 },
  legendary: { label: 'Legendary', order: 4, glow: 0.9 },
  ethereal: { label: 'Ethereal', order: 5, glow: 1.0 },
};

// Theme palettes reused across categories so a "Plasma" core and a
// "Plasma" trail visually match.
export const THEMES = {
  plasma: { hue: 322, hue2: 292, label: 'Plasma' },
  aurora: { hue: 165, hue2: 205, label: 'Aurora' },
  solar: { hue: 38, hue2: 12, label: 'Solar' },
  crystal: { hue: 195, hue2: 255, label: 'Crystal' },
  cyber: { hue: 128, hue2: 175, label: 'Cyber' },
  ocean: { hue: 200, hue2: 230, label: 'Ocean' },
  inferno: { hue: 8, hue2: 42, label: 'Inferno' },
  nebula: { hue: 268, hue2: 320, label: 'Nebula' },
  quantum: { hue: 190, hue2: 300, label: 'Quantum' },
  galaxy: { hue: 250, hue2: 285, label: 'Galaxy' },
};

function item(id, category, theme, rarity, shape, unlock) {
  return { id, category, theme, rarity, shape, unlock };
}

export const CATALOG = {
  core: [
    item('core.aurora.default', 'core', 'aurora', 'common', 'orb', { level: 1 }),
    item('core.plasma.spark', 'core', 'plasma', 'rare', 'orb', { level: 4 }),
    item('core.solar.flare', 'core', 'solar', 'epic', 'sun', { level: 9 }),
    item('core.crystal.facet', 'core', 'crystal', 'epic', 'gem', { level: 14 }),
    item('core.cyber.grid', 'core', 'cyber', 'mythic', 'hex', { level: 20 }),
    item('core.quantum.rift', 'core', 'quantum', 'legendary', 'rift', { level: 28 }),
    item('core.galaxy.eye', 'core', 'galaxy', 'ethereal', 'eye', { season: 1 }),
  ],
  body: [
    item('body.aurora.default', 'body', 'aurora', 'common', 'orb', { level: 1 }),
    item('body.ocean.drop', 'body', 'ocean', 'rare', 'drop', { level: 5 }),
    item('body.crystal.shard', 'body', 'crystal', 'epic', 'shard', { level: 12 }),
    item('body.inferno.ember', 'body', 'inferno', 'epic', 'ember', { level: 16 }),
    item('body.cyber.node', 'body', 'cyber', 'mythic', 'hex', { level: 22 }),
    item('body.nebula.wisp', 'body', 'nebula', 'legendary', 'wisp', { season: 1 }),
  ],
  trail: [
    item('trail.aurora.default', 'trail', 'aurora', 'common', 'ribbon', { level: 1 }),
    item('trail.solar.streak', 'trail', 'solar', 'rare', 'streak', { level: 6 }),
    item('trail.crystal.chain', 'trail', 'crystal', 'epic', 'chain', { level: 13 }),
    item('trail.quantum.dashed', 'trail', 'quantum', 'mythic', 'dashed', { level: 24 }),
    item('trail.galaxy.stardust', 'trail', 'galaxy', 'legendary', 'stardust', { season: 1 }),
  ],
  aura: [
    item('aura.none', 'aura', 'aurora', 'common', 'none', { level: 1 }),
    item('aura.plasma.ring', 'aura', 'plasma', 'rare', 'ring', { level: 7 }),
    item('aura.cyber.sparks', 'aura', 'cyber', 'epic', 'sparks', { level: 15 }),
    item('aura.nebula.halo', 'aura', 'nebula', 'mythic', 'halo', { level: 26 }),
    item('aura.ethereal.veil', 'aura', 'quantum', 'ethereal', 'veil', { season: 1 }),
  ],
  burst: [
    item('burst.default', 'burst', 'aurora', 'common', 'nova', { level: 1 }),
    item('burst.solar.shatter', 'burst', 'solar', 'rare', 'shatter', { level: 8 }),
    item('burst.crystal.spiral', 'burst', 'crystal', 'epic', 'spiral', { level: 18 }),
    item('burst.galaxy.collapse', 'burst', 'galaxy', 'legendary', 'collapse', { season: 1 }),
  ],
  particle: [
    item('particle.default', 'particle', 'aurora', 'common', 'dust', { level: 1 }),
    item('particle.ocean.bubble', 'particle', 'ocean', 'rare', 'bubble', { level: 10 }),
    item('particle.inferno.spark', 'particle', 'inferno', 'epic', 'spark', { level: 19 }),
    item('particle.quantum.star', 'particle', 'quantum', 'mythic', 'star', { level: 30 }),
  ],
  emblem: [
    item('emblem.none', 'emblem', 'aurora', 'common', 'none', { level: 1 }),
    item('emblem.spark', 'emblem', 'plasma', 'rare', 'spark', { level: 5 }),
    item('emblem.crest', 'emblem', 'crystal', 'epic', 'crest', { level: 20 }),
    item('emblem.titan', 'emblem', 'inferno', 'legendary', 'titan', { achievement: 'titanSlayer' }),
  ],
  nameplate: [
    item('nameplate.default', 'nameplate', 'aurora', 'common', 'plain', { level: 1 }),
    item('nameplate.pulse', 'nameplate', 'plasma', 'rare', 'pulse', { level: 6 }),
    item('nameplate.shimmer', 'nameplate', 'crystal', 'epic', 'shimmer', { level: 17 }),
    item('nameplate.stardust', 'nameplate', 'galaxy', 'legendary', 'stardust', { season: 1 }),
  ],
};

export function allItems() {
  return Object.values(CATALOG).flat();
}

export function getItem(id) {
  return allItems().find((i) => i.id === id);
}

export function isUnlocked(profile, itemDef) {
  if (!itemDef) return false;
  if (profile.cosmetics.unlocked.includes(itemDef.id)) return true;
  const u = itemDef.unlock || {};
  if (u.level && profile.level >= u.level) return true;
  if (u.achievement && profile.achievements[u.achievement]?.unlocked) return true;
  if (u.season && profile.season.id >= u.season) return false; // seasonal items are earned, not auto-granted
  return false;
}
