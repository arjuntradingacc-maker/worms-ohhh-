import { xpForLevel } from '../core/save.js';
import { getItem, THEMES } from '../core/cosmetics.js';

export function refreshHomeScreen(profile) {
  document.getElementById('home-level').textContent = profile.level;
  document.getElementById('home-name').textContent = profile.name;
  document.getElementById('home-credits').textContent = profile.credits;
  document.getElementById('home-shards').textContent = profile.prismShards;
  document.getElementById('home-season').textContent = profile.season.name;
  const need = xpForLevel(profile.level);
  document.getElementById('home-xp-fill').style.width = `${Math.min(100, (profile.xp / need) * 100)}%`;
}

export function themeForProfile(profile) {
  const coreItem = getItem(profile.cosmetics.equipped.core);
  const auraItem = getItem(profile.cosmetics.equipped.aura);
  const theme = THEMES[coreItem?.theme] || THEMES.aurora;
  return { hue: theme.hue, hue2: theme.hue2, aura: auraItem?.shape || 'none' };
}
