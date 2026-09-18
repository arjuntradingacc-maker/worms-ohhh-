// Local persistence layer. Everything here lives in localStorage on the
// player's device — see README "What's real vs. simulated" for why this
// stands in for the cloud-synced profile service a shipped version would
// use, and for the seam (NetworkAdapter) where that service would attach.

const STORAGE_KEY = 'lumenloop.profile.v1';

export const ACHIEVEMENTS = [
  { id: 'firstFlow', name: 'First Flow', desc: 'Complete your first match.', icon: 'flow' },
  { id: 'energyHunter', name: 'Energy Hunter', desc: 'Collect 10,000 lifetime energy.', icon: 'bolt' },
  { id: 'comboMaster', name: 'Combo Master', desc: 'Reach a x6 combo.', icon: 'combo' },
  { id: 'voidSurvivor', name: 'Void Survivor', desc: 'Survive 3 minutes with Void energy active.', icon: 'void' },
  { id: 'arenaChampion', name: 'Arena Champion', desc: 'Finish #1 in a match.', icon: 'crown' },
  { id: 'perfectEscape', name: 'Perfect Escape', desc: 'Survive a near-collision with Phase Shift.', icon: 'phase' },
  { id: 'overcharged', name: 'Overcharged', desc: 'Reach maximum Overcharge.', icon: 'overcharge' },
  { id: 'titanSlayer', name: 'Titan Slayer', desc: 'Land the finishing blow on a Void Titan.', icon: 'titan' },
  { id: 'millionEnergy', name: 'Million Energy', desc: 'Collect 1,000,000 lifetime energy.', icon: 'million' },
  { id: 'untouchable', name: 'Untouchable', desc: 'Survive 2 minutes without a collision.', icon: 'shield' },
];

const CHALLENGE_POOL = [
  { id: 'collect500', desc: 'Collect 500 energy', goal: 500, metric: 'energyThisRun', reward: { xp: 60, credits: 40 } },
  { id: 'survive5', desc: 'Survive 5 minutes total', goal: 300, metric: 'surviveSeconds', reward: { xp: 80, credits: 50 } },
  { id: 'combo4', desc: 'Reach a x4 combo', goal: 4, metric: 'bestCombo', reward: { xp: 50, credits: 30 } },
  { id: 'useAbilities3', desc: 'Use 3 abilities', goal: 3, metric: 'abilitiesUsed', reward: { xp: 40, credits: 25 } },
  { id: 'collectRare', desc: 'Collect a rare energy fragment', goal: 1, metric: 'rareCollected', reward: { xp: 45, credits: 30 } },
  { id: 'top3', desc: 'Finish in the top 3', goal: 1, metric: 'top3Finishes', reward: { xp: 70, credits: 45 } },
  { id: 'bossEvent', desc: 'Take part in a Void Titan event', goal: 1, metric: 'titanParticipations', reward: { xp: 90, credits: 60, prismShards: 1 } },
];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function pickDaily() {
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4).map((c) => ({ ...c, progress: 0, done: false, claimed: false }));
}

export function xpForLevel(level) {
  return Math.round(90 * Math.pow(level, 1.32));
}

function defaultProfile() {
  return {
    version: 1,
    createdAt: Date.now(),
    name: 'Wanderer' + Math.floor(Math.random() * 900 + 100),
    level: 1,
    xp: 0,
    credits: 150,
    prismShards: 0,
    season: { id: 1, name: 'Season I — Genesis' },
    stats: {
      matches: 0,
      wins: 0,
      totalEnergy: 0,
      bestSize: 0,
      longestSurvival: 0,
      eliminations: 0,
      longestCombo: 0,
      titanKills: 0,
    },
    achievements: {},
    cosmetics: {
      unlocked: [
        'core.aurora.default', 'body.aurora.default', 'trail.aurora.default',
        'aura.none', 'burst.default', 'particle.default', 'emblem.none',
        'nameplate.default',
      ],
      equipped: {
        core: 'core.aurora.default',
        body: 'body.aurora.default',
        trail: 'trail.aurora.default',
        aura: 'aura.none',
        burst: 'burst.default',
        particle: 'particle.default',
        emblem: 'emblem.none',
        nameplate: 'nameplate.default',
      },
    },
    loadout: { ability: 'pulseDash' },
    dailyChallenges: { date: todayKey(), list: pickDaily() },
    settings: {
      music: true,
      sfx: true,
      haptics: true,
      reducedMotion: false,
      reducedVFX: false,
      colorBlind: false,
      highContrast: false,
      leftHanded: false,
      uiScale: 1,
      graphics: 'high',
      controlMode: 'floating',
    },
    leaderboardLocal: [],
    seenTutorial: false,
  };
}

function migrate(p) {
  const d = defaultProfile();
  // Shallow-merge so new fields introduced in later versions of this file
  // are backfilled onto profiles saved by older versions.
  const merged = { ...d, ...p };
  merged.stats = { ...d.stats, ...p.stats };
  merged.settings = { ...d.settings, ...p.settings };
  merged.cosmetics = { ...d.cosmetics, ...p.cosmetics, equipped: { ...d.cosmetics.equipped, ...p.cosmetics?.equipped } };
  merged.season = { ...d.season, ...p.season };
  if (merged.dailyChallenges?.date !== todayKey()) {
    merged.dailyChallenges = { date: todayKey(), list: pickDaily() };
  }
  return merged;
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('LumenLoop: save data unreadable, starting fresh.', e);
    return defaultProfile();
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('LumenLoop: could not persist save data.', e);
  }
}

// Returns number of levels gained.
export function addXP(profile, amount) {
  profile.xp += Math.round(amount);
  profile.season.xp = (profile.season.xp || 0) + Math.round(amount);
  let gained = 0;
  while (profile.xp >= xpForLevel(profile.level)) {
    profile.xp -= xpForLevel(profile.level);
    profile.level += 1;
    gained += 1;
  }
  return gained;
}

export function grantCurrency(profile, { credits = 0, prismShards = 0 }) {
  profile.credits += Math.round(credits);
  profile.prismShards += Math.round(prismShards);
}

export function unlockAchievement(profile, id) {
  if (profile.achievements[id]?.unlocked) return false;
  profile.achievements[id] = { unlocked: true, ts: Date.now() };
  return true;
}

export function unlockCosmetic(profile, id) {
  if (!profile.cosmetics.unlocked.includes(id)) {
    profile.cosmetics.unlocked.push(id);
    return true;
  }
  return false;
}

export function submitScore(profile, entry) {
  profile.leaderboardLocal.push(entry);
  profile.leaderboardLocal.sort((a, b) => b.score - a.score);
  profile.leaderboardLocal = profile.leaderboardLocal.slice(0, 25);
}

// Feeds one match's stat block into daily-challenge progress. Returns the
// list of challenges newly completed this call (not yet claimed).
export function updateDailyChallenges(profile, runStats) {
  const justCompleted = [];
  for (const c of profile.dailyChallenges.list) {
    if (c.done) continue;
    const v = runStats[c.metric];
    if (v === undefined) continue;
    c.progress = c.metric === 'surviveSeconds' || c.metric.startsWith('best')
      ? Math.max(c.progress, v)
      : c.progress + v;
    if (c.progress >= c.goal) {
      c.progress = c.goal;
      c.done = true;
      justCompleted.push(c);
    }
  }
  return justCompleted;
}
