import { MODES, COMING_SOON_MODES } from '../game/match.js';
import { ABILITY_DEFS, unlockedAbilities } from '../game/abilities.js';

let selectedMode = 'classic';

export function getSelectedMode() { return selectedMode; }

export function renderModeSelect(profile) {
  const list = document.getElementById('mode-list');
  list.innerHTML = '';
  for (const mode of Object.values(MODES)) {
    const card = document.createElement('div');
    card.className = 'glass-panel mode-card' + (mode.id === selectedMode ? ' selected' : '');
    card.innerHTML = `<h3>${mode.name}</h3><p>${mode.tagline}</p>`;
    card.addEventListener('click', () => {
      selectedMode = mode.id;
      renderModeSelect(profile);
    });
    list.appendChild(card);
  }
  for (const mode of COMING_SOON_MODES) {
    const card = document.createElement('div');
    card.className = 'glass-panel mode-card soon';
    card.innerHTML = `<h3>${mode.name} <span class="pill">Coming Soon</span></h3><p>${mode.tagline}</p>`;
    list.appendChild(card);
  }

  const row = document.getElementById('loadout-row');
  row.innerHTML = '';
  const unlocked = unlockedAbilities(profile.level).map((a) => a.id);
  for (const def of Object.values(ABILITY_DEFS)) {
    const isUnlocked = unlocked.includes(def.id);
    const chip = document.createElement('div');
    chip.className = 'glass-panel loadout-chip' +
      (profile.loadout.ability === def.id ? ' selected' : '') +
      (!isUnlocked ? ' locked' : '');
    chip.innerHTML = `<div style="font-weight:700">${def.name}</div><div style="font-size:0.7rem;color:var(--text-secondary)">${isUnlocked ? def.desc : `Unlocks at level ${def.unlockLevel}`}</div>`;
    if (isUnlocked) {
      chip.addEventListener('click', () => {
        profile.loadout.ability = def.id;
        renderModeSelect(profile);
      });
    }
    row.appendChild(chip);
  }
}
