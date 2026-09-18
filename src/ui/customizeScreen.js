import { CATALOG, RARITY, THEMES, isUnlocked, getItem } from '../core/cosmetics.js';

const CATEGORY_LABELS = {
  core: 'Core', body: 'Body', trail: 'Trail', aura: 'Aura',
  burst: 'Burst', particle: 'Particle', emblem: 'Emblem', nameplate: 'Nameplate',
};

let activeCategory = 'core';

export function initCustomizeTabs(onSelect) {
  const tabs = document.getElementById('customize-tabs');
  tabs.innerHTML = '';
  for (const cat of Object.keys(CATALOG)) {
    const btn = document.createElement('button');
    btn.className = 'btn' + (cat === activeCategory ? ' btn-primary' : '');
    btn.textContent = CATEGORY_LABELS[cat] || cat;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      initCustomizeTabs(onSelect);
      onSelect(cat);
    });
    tabs.appendChild(btn);
  }
}

export function renderCustomizeGrid(profile, previewAnimator) {
  const grid = document.getElementById('cosmetic-grid');
  grid.innerHTML = '';
  const items = CATALOG[activeCategory] || [];
  for (const itemDef of items) {
    const unlocked = isUnlocked(profile, itemDef);
    const equipped = profile.cosmetics.equipped[activeCategory] === itemDef.id;
    const theme = THEMES[itemDef.theme];
    const rarity = RARITY[itemDef.rarity];
    const el = document.createElement('div');
    el.className = 'glass-panel cosmetic-item' + (equipped ? ' equipped' : '') + (!unlocked ? ' locked' : '');
    el.innerHTML = `
      <span class="rarity-tag" style="background:hsla(${theme.hue},80%,55%,${0.25 + rarity.glow * 0.4})">${rarity.label}</span>
      <div class="swatch" style="background:radial-gradient(circle at 35% 30%, #fff, hsl(${theme.hue},85%,60%), hsl(${theme.hue2},70%,40%))"></div>
      <div style="font-size:0.68rem;color:var(--text-secondary)">${unlocked ? theme.label : (itemDef.unlock.level ? `Lv. ${itemDef.unlock.level}` : 'Locked')}</div>
    `;
    if (unlocked) {
      el.addEventListener('click', () => {
        profile.cosmetics.equipped[activeCategory] = itemDef.id;
        if (activeCategory === 'core' || activeCategory === 'aura') {
          const coreItem = getItem(profile.cosmetics.equipped.core);
          const auraItem = getItem(profile.cosmetics.equipped.aura);
          const t = THEMES[coreItem.theme];
          previewAnimator.setTheme({ hue: t.hue, hue2: t.hue2, aura: auraItem?.shape || 'none' });
        }
        renderCustomizeGrid(profile, previewAnimator);
      });
    }
    grid.appendChild(el);
  }
}

export function getActiveCategory() { return activeCategory; }
