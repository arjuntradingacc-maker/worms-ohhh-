import { loadProfile, saveProfile, addXP, grantCurrency, submitScore, updateDailyChallenges } from './core/save.js';
import { checkAchievements } from './core/achievementCheck.js';
import { audio } from './core/audio.js';
import { haptics } from './core/haptics.js';
import {
  registerScreens, showScreen, onEnter, onLeave, showToast, showAchievementToast,
} from './ui/screens.js';
import { createPreviewAnimator } from './ui/preview.js';
import { refreshHomeScreen, themeForProfile } from './ui/homeScreen.js';
import { renderModeSelect, getSelectedMode } from './ui/modeSelectScreen.js';
import { initCustomizeTabs, renderCustomizeGrid } from './ui/customizeScreen.js';
import { renderMissions, wireMissionTabs } from './ui/missionsScreen.js';
import { renderLeaderboard } from './ui/leaderboardScreen.js';
import { renderSettings } from './ui/settingsScreen.js';
import { initTutorial } from './ui/tutorialScreen.js';
import {
  initHUD, updateHUD, setAbilityIcon, showCountdown, showElimination, showVictory, showPause,
} from './ui/hud.js';
import { TouchController } from './input/controller.js';
import { Renderer } from './render/renderer.js';
import { Match, MODES } from './game/match.js';

const profile = loadProfile();
const persist = () => saveProfile(profile);

function applyProfileToDom() {
  document.documentElement.style.setProperty('--ui-scale', profile.settings.uiScale);
  document.body.classList.toggle('high-contrast', profile.settings.highContrast);
  document.getElementById('ability-btn').classList.toggle('left', profile.settings.leftHanded);
}
applyProfileToDom();

registerScreens([
  'loading', 'home', 'modeselect', 'customize', 'missions', 'leaderboard',
  'friends', 'settings', 'matchmaking', 'tutorial', 'match',
]);
showScreen('loading');

// --- Audio unlock (must happen inside a user gesture on mobile browsers) --
function unlockAudioOnce() {
  audio.unlock();
  audio.setMusicEnabled(profile.settings.music);
  audio.setSfxEnabled(profile.settings.sfx);
  haptics.setEnabled(profile.settings.haptics);
  audio.startMenuMusic();
  window.removeEventListener('pointerdown', unlockAudioOnce);
  window.removeEventListener('keydown', unlockAudioOnce);
}
window.addEventListener('pointerdown', unlockAudioOnce);
window.addEventListener('keydown', unlockAudioOnce);

// --- Loading -> Home ------------------------------------------------
const TIPS = [
  'Stay moving.', 'Risk creates reward.', 'Watch the edges.', 'Use the arena.',
  'Chain combos before the window closes.', 'High Overcharge makes you a target.',
  'Phase Shift turns a bad crossing into a bluff.', 'Bigger is stronger, but slower to turn.',
];
document.getElementById('loading-tip').textContent = TIPS[(Math.random() * TIPS.length) | 0];
setTimeout(() => showScreen('home'), 1500);

// --- Home -------------------------------------------------------------
const homePreview = createPreviewAnimator(document.getElementById('home-canvas'));
onEnter('home', () => {
  refreshHomeScreen(profile);
  homePreview.setTheme(themeForProfile(profile));
  homePreview.start();
});
onLeave('home', () => homePreview.stop());

document.querySelectorAll('[data-nav]').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.nav));
});

document.getElementById('btn-play').addEventListener('click', () => {
  showScreen(profile.seenTutorial ? 'modeselect' : 'tutorial');
});

onEnter('tutorial', () => {
  initTutorial(() => {
    profile.seenTutorial = true;
    persist();
    showScreen('modeselect');
  });
});

// --- Mode select --------------------------------------------------------
onEnter('modeselect', () => renderModeSelect(profile));
document.getElementById('btn-start-match').addEventListener('click', startMatchFlow);

// --- Customize ------------------------------------------------------
const customizePreview = createPreviewAnimator(document.getElementById('customize-canvas'));
onEnter('customize', () => {
  initCustomizeTabs(() => renderCustomizeGrid(profile, customizePreview));
  renderCustomizeGrid(profile, customizePreview);
  customizePreview.setTheme(themeForProfile(profile));
  customizePreview.start();
});
onLeave('customize', () => { persist(); customizePreview.stop(); });

// --- Missions ---------------------------------------------------------
wireMissionTabs();
onEnter('missions', () => renderMissions(profile));

// --- Leaderboard --------------------------------------------------------
onEnter('leaderboard', () => renderLeaderboard(profile));

// --- Settings -----------------------------------------------------------
onEnter('settings', () => renderSettings(profile, persist));

// --- Match lifecycle ------------------------------------------------
let match = null, controller = null, renderer = null;
let running = false, paused = false, resultPresented = false, countdownDone = false;
let rafId = null, lastTime = 0;

function startMatchFlow() {
  showScreen('matchmaking');
  const statusEl = document.getElementById('mm-status');
  const msgs = ['Finding a fair match…', 'Calibrating skill range…', 'Preparing the arena…', 'Spinning up Lumens…'];
  let mi = 0;
  statusEl.textContent = msgs[0];
  const iv = setInterval(() => { mi = (mi + 1) % msgs.length; statusEl.textContent = msgs[mi]; }, 450);
  let cancelled = false;
  document.getElementById('mm-cancel').onclick = () => {
    cancelled = true;
    clearInterval(iv);
    showScreen('modeselect');
  };
  setTimeout(() => {
    clearInterval(iv);
    if (cancelled) return;
    beginMatch();
  }, 1300 + Math.random() * 900);
}

function beginMatch() {
  const modeConfig = MODES[getSelectedMode()];
  match = new Match(modeConfig, profile);
  wireMatchCallbacks();

  if (!renderer) renderer = new Renderer(document.getElementById('game-canvas'));
  renderer.resize();

  if (!controller) {
    controller = new TouchController({
      zoneEl: document.getElementById('joystick-zone'),
      baseEl: document.getElementById('joystick-base'),
      thumbEl: document.getElementById('joystick-thumb'),
      abilityEl: document.getElementById('ability-btn'),
      getMode: () => profile.settings.controlMode,
      getLeftHanded: () => profile.settings.leftHanded,
    });
  }
  controller.onAbility = () => match.requestPlayerAbility();
  document.getElementById('ability-btn').classList.toggle('left', profile.settings.leftHanded);

  initHUD();
  setAbilityIcon(profile.loadout.ability);
  audio.startMatchMusic();

  showScreen('match');
  paused = false;
  resultPresented = false;
  countdownDone = false;
  running = true;
  lastTime = performance.now();
  showCountdown(() => { countdownDone = true; });
  rafId = requestAnimationFrame(loop);
}

function wireMatchCallbacks() {
  match.onCollect = (lumen, particle) => {
    if (!lumen.isPlayer) return;
    audio.collect(particle.type);
    if (particle.type === 'void' || particle.type === 'ancient' || particle.type === 'prism') haptics.play('collectRare');
    if (lumen.comboCount >= 2) audio.combo(lumen.comboCount);
    if (lumen.comboCount + 1 >= 3 && lumen.comboFlash > 0.35) haptics.play('milestone');
    audio.setIntensity(Math.min(1, lumen.mass / 400));
  };
  match.onAbilityUsed = (lumen, def) => {
    if (!lumen.isPlayer) return;
    audio.ability(def.icon);
    haptics.play('ability');
  };
  match.onCollision = (loser, winner, blocked) => {
    if (!loser.isPlayer && !winner.isPlayer) return;
    if (blocked) { audio.ability('shield'); haptics.play('ability'); }
    else { audio.collision(); haptics.play('nearMiss'); }
  };
  match.onElimination = (victim) => {
    audio.eliminate();
    if (victim.isPlayer) haptics.play('eliminate');
  };
  match.onTitanDefeated = (titan, contribution) => {
    const share = Math.min(1, contribution / 400);
    grantCurrency(profile, { credits: Math.round(40 * share) + 20, prismShards: 1 });
    profile.stats.titanKills += 1;
    showToast('Void Titan defeated — bonus rewards granted.');
  };
}

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!paused) {
    if (countdownDone && !match.ended) {
      const input = controller.getInput();
      match.setPlayerInput(input.angle, input.magnitude);
      if (controller.consumeAbilityKey()) match.requestPlayerAbility();
      match.update(dt);
    }
    renderer.render(match, profile, dt);
    updateHUD(match);
  }

  if (match.ended && !resultPresented) {
    resultPresented = true;
    setTimeout(presentResult, match.result.reason === 'eliminated' ? 900 : 300);
  }

  rafId = requestAnimationFrame(loop);
}

function presentResult() {
  const result = match.result;
  profile.stats.matches += 1;
  if (result.won) profile.stats.wins += 1;
  profile.stats.totalEnergy += result.energyCollected;
  profile.stats.bestSize = Math.max(profile.stats.bestSize, result.size);
  profile.stats.longestSurvival = Math.max(profile.stats.longestSurvival, result.survivalSeconds);
  profile.stats.eliminations += result.eliminations;
  profile.stats.longestCombo = Math.max(profile.stats.longestCombo, match.runStats.bestCombo);

  const xpGained = Math.round(30 + result.energyCollected * 0.6 + result.survivalSeconds * 0.5 + result.eliminations * 40 + (result.won ? 80 : 0));
  const creditsGained = Math.round(10 + result.energyCollected * 0.15 + (result.won ? 30 : 0));
  const levelsGained = addXP(profile, xpGained);
  grantCurrency(profile, { credits: creditsGained });
  submitScore(profile, {
    name: profile.name, score: result.score, mode: match.mode.name,
    size: result.size, survival: result.survivalSeconds, ts: Date.now(),
  });

  const completedChallenges = updateDailyChallenges(profile, match.runStats);
  for (const c of completedChallenges) {
    addXP(profile, c.reward.xp);
    grantCurrency(profile, { credits: c.reward.credits || 0, prismShards: c.reward.prismShards || 0 });
  }

  const newAchievements = checkAchievements(profile, match, result);
  persist();

  if (levelsGained > 0) { audio.levelUp(); showToast(`Level up! You're now level ${profile.level}.`); }
  if (result.reason === 'eliminated') {
    showElimination(result, match.lastKillerName, xpGained, onResultContinue);
  } else {
    if (result.won) { audio.victory(); haptics.play('victory'); }
    showVictory(result, xpGained, onResultContinue);
  }

  for (const c of completedChallenges) showToast(`Challenge complete: ${c.desc}`);
  newAchievements.forEach((a, i) => setTimeout(() => showAchievementToast(a.name), i * 900));
}

function onResultContinue() {
  running = false;
  cancelAnimationFrame(rafId);
  audio.stopMusic();
  audio.startMenuMusic();
  showScreen('home');
}

document.getElementById('btn-pause').addEventListener('click', () => {
  if (!running || match.ended) return;
  paused = true;
  showPause(
    () => { paused = false; lastTime = performance.now(); },
    () => {
      running = false;
      cancelAnimationFrame(rafId);
      match.forfeit();
      audio.stopMusic();
      audio.startMenuMusic();
      showScreen('home');
    },
  );
});

window.addEventListener('resize', () => renderer?.resize());

// Debug hook for local testing only (?debug in the URL) — never referenced
// by normal gameplay code.
if (new URLSearchParams(location.search).has('debug')) {
  window.__lumenDebug = {
    get match() { return match; },
    get profile() { return profile; },
    forceEliminate() {
      const killer = match.lumens.find((l) => !l.isPlayer && l.alive);
      match._eliminate(match.player, killer);
    },
    forceEndMatch(reason) { match._endMatch(reason || 'time'); },
  };
}
