// Bootstraps Match the Liquid: wires save data, audio, the screen
// manager, the gameplay Scene/GameSession, and the small standalone Liqi
// mascots that live on the splash and home screens.

import { WORLDS, LEVELS_PER_WORLD, getLevel, specialFxFor } from './game/levels.js';
import { GameSession } from './game/session.js';
import { Scene } from './render/renderer.js';
import { Liqi } from './render/mascot.js';
import { attachPointerHandling } from './input/pointer.js';
import * as save from './core/save.js';
import * as audio from './core/audio.js';
import { setHapticsEnabled } from './core/haptics.js';
import * as ui from './ui/screens.js';

save.load();
const settings = save.getSettings();
audio.setSoundOn(settings.soundOn);
audio.setMusicOn(settings.musicOn);
setHapticsEnabled(settings.hapticsOn);
ui.applyAccessibilityClasses(settings);

const screens = new ui.ScreenManager();

// ---- Standalone decorative mascots (splash + home) ------------------------
function runStandaloneMascot(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const liqi = new Liqi();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    liqi.tick(dt);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    liqi.draw(ctx, canvas.width / 2, canvas.height / 2 + 10, canvas.width * 0.24);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return liqi;
}
runStandaloneMascot('mascot-splash-canvas');
const homeMascot = runStandaloneMascot('mascot-home-canvas');
document.getElementById('mascot-home-canvas').addEventListener('pointerdown', () => {
  homeMascot.poke();
  homeMascot.setState('excited');
  setTimeout(() => homeMascot.setState('idle'), 900);
});

// ---- Gameplay canvas / scene ------------------------------------------------
const gameCanvas = document.getElementById('game-canvas');
const scene = new Scene(gameCanvas);
scene.setAccessibility({ colorBlind: settings.colorBlindMode, highContrast: settings.highContrast, reducedMotion: settings.reducedMotion });

const liqiHudCanvas = document.getElementById('liqi-hud-canvas');
const liqiHudCtx = liqiHudCanvas.getContext('2d');

function resizeGameCanvas() {
  const rect = gameCanvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  scene.resize(rect.width, rect.height, dpr);
}
window.addEventListener('resize', resizeGameCanvas);

let musicScheduler = null;
function playWorldMusic(worldIndex) {
  if (musicScheduler) musicScheduler.stop();
  musicScheduler = new audio.MusicScheduler(WORLDS[worldIndex].music);
  musicScheduler.start();
}

let session = null;
let currentWorldIndex = 0;
let currentLevelIndex = 0;

function startLevel(worldIndex, levelIndex) {
  currentWorldIndex = worldIndex;
  currentLevelIndex = levelIndex;
  const level = getLevel(worldIndex, levelIndex);

  // The canvas must be visible (screen active, real layout size) before we
  // measure it and lay out containers — otherwise it reads a zero-size rect.
  screens.show('screen-game');
  scene.setWorld(level.world);
  resizeGameCanvas();
  session = new GameSession(scene, level);
  ui.updateHud({ levelLabel: `${level.world.name.split(' ')[0]} ${levelIndex + 1}`, moves: 0 });
  ui.setComboBadge(0);
  scene.mascot.setState('idle');

  session.on('moves', (m) => ui.updateHud({ moves: m }));
  session.on('combo', (c) => {
    ui.setComboBadge(c);
    if (musicScheduler) musicScheduler.setIntensity(Math.min(1, c / 6));
    if (c >= 3) scene.mascot.setState('excited');
  });
  session.on('win', ({ stars, moves, parMoves }) => onLevelWin(worldIndex, levelIndex, level, stars, moves, parMoves));

  playWorldMusic(worldIndex);
}

function onLevelWin(worldIndex, levelIndex, level, stars, moves) {
  audio.playLevelComplete();
  const flatIndex = worldIndex * LEVELS_PER_WORLD + levelIndex;
  const { improved } = save.recordLevelResult(flatIndex, level.id, stars, moves);
  const coinsEarned = 10 + stars * 10 + (improved ? 5 : 0);
  save.addCoins(coinsEarned);

  // Boss level of a world unlocks that world's cosmetic liquid FX.
  const fx = specialFxFor(worldIndex, levelIndex, 0);
  if (fx) save.unlockFx(fx);

  scene.triggerLevelCompleteBurst();
  if (musicScheduler) musicScheduler.stop();

  setTimeout(() => {
    ui.showCompleteOverlay({
      stars, coinsEarned,
      onNext: () => {
        ui.bumpCoinDisplays();
        const nextFlat = flatIndex + 1;
        if (nextFlat >= WORLDS.length * LEVELS_PER_WORLD) {
          screens.show('screen-home');
          renderHome();
          return;
        }
        const nw = Math.floor(nextFlat / LEVELS_PER_WORLD);
        const nl = nextFlat % LEVELS_PER_WORLD;
        startLevel(nw, nl);
      },
      onReplay: () => { ui.bumpCoinDisplays(); startLevel(worldIndex, levelIndex); },
    });
    ui.syncCoinDisplays();
  }, 550);
}

// ---- Screen wiring ----------------------------------------------------------
function renderHome() {
  ui.syncCoinDisplays();
  ui.renderWorldRow((worldIndex) => {
    screens.show('screen-levels');
    ui.renderLevelGrid(worldIndex, (levelIndex) => startLevel(worldIndex, levelIndex));
    ui.initButtonFeelForAll();
  });
}

document.getElementById('btn-tap-start').addEventListener('click', () => {
  audio.unlockAudio();
  screens.show('screen-home');
  renderHome();
  ui.initButtonFeelForAll();
}, { once: true });

document.getElementById('btn-play').addEventListener('click', () => {
  const flat = save.load().highestUnlocked;
  const w = Math.floor(Math.min(flat, WORLDS.length * LEVELS_PER_WORLD - 1) / LEVELS_PER_WORLD);
  screens.show('screen-levels');
  ui.renderLevelGrid(w, (levelIndex) => startLevel(w, levelIndex));
  ui.initButtonFeelForAll();
});

document.querySelector('[data-back-to-home]').addEventListener('click', () => { screens.show('screen-home'); renderHome(); });
document.querySelector('[data-back-to-levels]').addEventListener('click', () => {
  if (musicScheduler) musicScheduler.stop();
  screens.show('screen-levels');
  ui.renderLevelGrid(currentWorldIndex, (levelIndex) => startLevel(currentWorldIndex, levelIndex));
  ui.initButtonFeelForAll();
});

document.getElementById('btn-undo').addEventListener('click', () => { if (session) session.undo(); });
document.getElementById('btn-reset').addEventListener('click', () => { if (confirm('Reset this level?')) startLevel(currentWorldIndex, currentLevelIndex); });

ui.wireSettings((key, value) => {
  if (key === 'soundOn') audio.setSoundOn(value);
  if (key === 'musicOn') audio.setMusicOn(value);
  if (key === 'hapticsOn') setHapticsEnabled(value);
  if (key === 'colorBlindMode') scene.setAccessibility({ colorBlind: value });
  if (key === 'highContrast') { scene.setAccessibility({ highContrast: value }); ui.applyAccessibilityClasses(save.getSettings()); }
  if (key === 'reducedMotion') { scene.setAccessibility({ reducedMotion: value }); ui.applyAccessibilityClasses(save.getSettings()); }
});
ui.wireCollection();

// Pointer input -> game session.
attachPointerHandling(gameCanvas, scene, (index) => {
  if (!session) return;
  const wasInvalidTarget = session.selected !== -1 && session.selected !== index && !session.engine.canPour(session.selected, index);
  session.handleTap(index);
  if (wasInvalidTarget) ui.shakeHud();
});

// ---- Main render loop -------------------------------------------------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  scene.update(dt);
  scene.draw();

  liqiHudCtx.clearRect(0, 0, liqiHudCanvas.width, liqiHudCanvas.height);
  if (screens.current === 'screen-game') {
    scene.mascot.draw(liqiHudCtx, liqiHudCanvas.width / 2, liqiHudCanvas.height / 2 + 6, liqiHudCanvas.width * 0.32);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Handle mobile viewport quirks: re-measure the canvas after layout settles.
window.addEventListener('orientationchange', () => setTimeout(resizeGameCanvas, 200));
