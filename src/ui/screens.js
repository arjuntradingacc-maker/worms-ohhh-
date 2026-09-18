// DOM screen navigation, home/level-grid rendering, and the settings /
// collection panels. Deliberately plain DOM — the canvas is reserved for
// gameplay only, per the design brief.

import { WORLDS, LEVELS_PER_WORLD, SPECIAL_FX } from '../game/levels.js';
import * as save from '../core/save.js';
import { playButtonTap } from '../core/audio.js';
import { haptic } from '../core/haptics.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export function wireButtonFeel(el) {
  el.addEventListener('pointerdown', () => {
    playButtonTap();
    haptic('buttonTap');
    el.classList.remove('pressed-burst');
    void el.offsetWidth;
    el.classList.add('pressed-burst');
  }, { passive: true });
}

export function initButtonFeelForAll() {
  $$('.btn, .icon-btn, .world-card, .level-tile').forEach(wireButtonFeel);
}

export class ScreenManager {
  constructor() {
    this.screens = {};
    $$('.screen').forEach((el) => { this.screens[el.id] = el; });
    this.current = 'screen-splash';
  }
  show(id) {
    if (this.current === id) return;
    this.screens[this.current]?.classList.remove('active');
    this.screens[id]?.classList.add('active');
    this.current = id;
  }
}

export function syncCoinDisplays() {
  const coins = save.getCoins();
  $$('[data-coin-counter] .coin-value').forEach((el) => { el.textContent = coins; });
}

export function bumpCoinDisplays() {
  $$('[data-coin-counter]').forEach((el) => {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 300);
  });
}

function worldStarsEarned(world) {
  let total = 0;
  for (let l = 0; l < LEVELS_PER_WORLD; l++) total += save.getStars(`${world.id}-${l + 1}`);
  return total;
}

export function renderWorldRow(onSelectWorld) {
  const row = $('#world-row');
  row.innerHTML = '';
  WORLDS.forEach((world, i) => {
    const unlocked = save.isLevelUnlocked(i * LEVELS_PER_WORLD);
    const card = document.createElement('div');
    card.className = 'world-card' + (unlocked ? '' : ' locked');
    card.style.background = `linear-gradient(160deg, ${world.bg[0]}, ${world.bg[2] || world.bg[0]})`;
    card.style.animationDelay = `${i * 0.06}s`;

    const jar = document.createElement('div');
    jar.className = 'world-card-jar';
    jar.style.background = `linear-gradient(180deg, ${world.palette[1] || world.palette[0]}, ${world.palette[0]})`;
    card.appendChild(jar);

    const label = document.createElement('div');
    label.className = 'world-card-label';
    label.textContent = world.name.replace(' World', '');
    card.appendChild(label);

    const sub = document.createElement('div');
    sub.className = 'world-card-sub';
    if (unlocked) {
      sub.innerHTML = `★ ${worldStarsEarned(world)}<span class="dim">/${LEVELS_PER_WORLD * 3}</span>`;
    } else {
      sub.textContent = '🔒 Locked';
    }
    card.appendChild(sub);

    card.addEventListener('click', () => {
      wireButtonFeel(card);
      if (!unlocked) { card.classList.remove('locked'); void card.offsetWidth; card.classList.add('locked'); return; }
      onSelectWorld(i);
    });
    row.appendChild(card);
  });
}

export function renderLevelGrid(worldIndex, onSelectLevel) {
  const world = WORLDS[worldIndex];
  $('#world-title').textContent = world.name;
  $('#world-tagline').textContent = world.tagline;
  const grid = $('#level-grid');
  grid.innerHTML = '';
  for (let l = 0; l < LEVELS_PER_WORLD; l++) {
    const flatIndex = worldIndex * LEVELS_PER_WORLD + l;
    const unlocked = save.isLevelUnlocked(flatIndex);
    const stars = save.getStars(`${world.id}-${l + 1}`);
    const tile = document.createElement('div');
    tile.className = 'level-tile' + (unlocked ? '' : ' locked');
    tile.style.animationDelay = `${l * 0.04}s`;
    if (unlocked) tile.style.background = `linear-gradient(180deg, ${world.palette[l % world.palette.length]}, ${world.palette[(l + 2) % world.palette.length]})`;
    const num = document.createElement('div');
    num.textContent = unlocked ? String(l + 1) : '🔒';
    tile.appendChild(num);
    if (unlocked) {
      const starsRow = document.createElement('div');
      starsRow.className = 'stars';
      for (let s = 0; s < 3; s++) {
        const st = document.createElement('span');
        st.textContent = '★';
        if (s < stars) st.classList.add('lit');
        starsRow.appendChild(st);
      }
      tile.appendChild(starsRow);
    }
    tile.addEventListener('click', () => {
      wireButtonFeel(tile);
      if (!unlocked) { tile.classList.remove('locked'); void tile.offsetWidth; tile.classList.add('locked'); return; }
      onSelectLevel(l);
    });
    grid.appendChild(tile);
  }
}

export function updateHud({ levelLabel, moves }) {
  if (levelLabel !== undefined) $('#level-label').textContent = levelLabel;
  if (moves !== undefined) $('#move-count').textContent = `${moves} move${moves === 1 ? '' : 's'}`;
}

export function setComboBadge(combo) {
  const badge = $('#combo-badge');
  if (combo < 2) { badge.classList.add('hidden'); return; }
  badge.textContent = `LIQUID COMBO ×${combo}`;
  badge.classList.remove('hidden');
  badge.classList.remove('pop');
  void badge.offsetWidth;
  badge.classList.add('pop');
  const heat = Math.min(1, (combo - 2) / 6);
  badge.style.filter = `saturate(${1 + heat}) brightness(${1 + heat * 0.25})`;
}

export function shakeHud() {
  const hud = $('.game-hud');
  hud.classList.remove('shake');
  void hud.offsetWidth;
  hud.classList.add('shake');
}

export function showCompleteOverlay({ stars, coinsEarned, onNext, onReplay }) {
  const overlay = $('#overlay-complete');
  overlay.classList.remove('hidden');
  $$('#stars-row .star').forEach((el, i) => {
    el.classList.remove('earned');
    el.style.animationDelay = '';
  });
  $('#coins-earned-count').textContent = '0';
  let shown = 0;
  const revealStar = (i) => {
    if (i >= 3) {
      let c = 0;
      const target = coinsEarned;
      const step = Math.max(1, Math.round(target / 16));
      const timer = setInterval(() => {
        c = Math.min(target, c + step);
        $('#coins-earned-count').textContent = c;
        if (c >= target) clearInterval(timer);
      }, 30);
      return;
    }
    const el = $$('#stars-row .star')[i];
    if (i < stars) el.classList.add('earned');
    setTimeout(() => revealStar(i + 1), 220);
  };
  setTimeout(() => revealStar(0), 450);

  const nextBtn = $('#btn-next-level');
  const replayBtn = $('#btn-replay-level');
  const cleanup = () => { overlay.classList.add('hidden'); nextBtn.onclick = null; replayBtn.onclick = null; };
  nextBtn.onclick = () => { cleanup(); onNext(); };
  replayBtn.onclick = () => { cleanup(); onReplay(); };
}

export function wireSettings(onChange) {
  const s = save.getSettings();
  const map = {
    'opt-sound': 'soundOn', 'opt-music': 'musicOn', 'opt-haptics': 'hapticsOn',
    'opt-colorblind': 'colorBlindMode', 'opt-highcontrast': 'highContrast', 'opt-reducedmotion': 'reducedMotion',
  };
  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    el.checked = !!s[key];
    el.addEventListener('change', () => {
      save.setSetting(key, el.checked);
      onChange(key, el.checked);
    });
  }
  $('#btn-close-settings').addEventListener('click', () => $('#overlay-settings').classList.add('hidden'));
  $('#btn-reset-progress').addEventListener('click', () => {
    if (confirm('Reset all progress, coins and stars? This cannot be undone.')) {
      save.resetProgress();
      location.reload();
    }
  });
  $('[data-open-settings]').addEventListener('click', () => $('#overlay-settings').classList.remove('hidden'));
}

function renderFxGrid() {
  const grid = $('#fx-grid');
  grid.innerHTML = '';
  SPECIAL_FX.forEach((fx) => {
    const unlocked = save.isFxUnlocked(fx);
    const swatch = document.createElement('div');
    swatch.className = 'fx-swatch' + (unlocked ? ' unlocked' : '');
    swatch.textContent = unlocked ? fx.toUpperCase() : '🔒';
    grid.appendChild(swatch);
  });
}

export function wireCollection() {
  renderFxGrid();
  $('[data-open-collection]').addEventListener('click', () => {
    renderFxGrid();
    $('#overlay-collection').classList.remove('hidden');
  });
  $('#btn-close-collection').addEventListener('click', () => $('#overlay-collection').classList.add('hidden'));
}

export function applyAccessibilityClasses(settings) {
  document.body.classList.toggle('high-contrast', !!settings.highContrast);
  document.body.classList.toggle('reduced-motion', !!settings.reducedMotion);
}
