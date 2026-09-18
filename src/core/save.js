// localStorage persistence: progress, coins, stars, settings, cosmetic
// unlocks. All local-device only — this is an honest static client with
// no backend, so nothing here pretends to sync anywhere.

const KEY = 'mtl_save_v2';

const DEFAULT_SETTINGS = {
  soundOn: true,
  musicOn: true,
  hapticsOn: true,
  colorBlindMode: false,
  highContrast: false,
  reducedMotion: false,
};

function defaultState() {
  return {
    coins: 0,
    stars: {},          // levelId -> 1..3
    bestMoves: {},       // levelId -> move count
    highestUnlocked: 0,  // flat level index unlocked
    unlockedFx: [],      // cosmetic collection unlocked ids
    settings: { ...DEFAULT_SETTINGS },
  };
}

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...defaultState(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) } };
    } else {
      state = defaultState();
    }
  } catch {
    state = defaultState();
  }
  return state;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode / quota — silently skip */ }
}

export function getSettings() { return load().settings; }
export function setSetting(key, value) {
  load().settings[key] = value;
  save();
}

export function getCoins() { return load().coins; }
export function addCoins(n) {
  load().coins += n;
  save();
  return load().coins;
}

export function getStars(levelId) { return load().stars[levelId] || 0; }
export function totalStars() {
  const s = load().stars;
  return Object.values(s).reduce((a, b) => a + b, 0);
}

export function recordLevelResult(flatIndex, levelId, stars, moves) {
  const st = load();
  const prevStars = st.stars[levelId] || 0;
  const improved = stars > prevStars;
  if (improved) st.stars[levelId] = stars;
  const prevBest = st.bestMoves[levelId];
  if (prevBest === undefined || moves < prevBest) st.bestMoves[levelId] = moves;
  if (flatIndex + 1 > st.highestUnlocked) st.highestUnlocked = flatIndex + 1;
  save();
  return { improved, prevStars };
}

export function isLevelUnlocked(flatIndex) {
  return flatIndex <= load().highestUnlocked;
}

export function unlockFx(fxId) {
  const st = load();
  if (!st.unlockedFx.includes(fxId)) {
    st.unlockedFx.push(fxId);
    save();
    return true;
  }
  return false;
}
export function isFxUnlocked(fxId) { return load().unlockedFx.includes(fxId); }

export function resetProgress() {
  state = defaultState();
  save();
}
