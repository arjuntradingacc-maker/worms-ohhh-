import { unlockAchievement, ACHIEVEMENTS } from './save.js';

// Called once per completed match, after profile.stats has already been
// updated with this run's totals. Returns the achievements newly unlocked
// this call (for toast display), each as its full catalog entry.
export function checkAchievements(profile, match, result) {
  const newly = [];
  const tryUnlock = (id, condition) => {
    if (condition && unlockAchievement(profile, id)) {
      newly.push(ACHIEVEMENTS.find((a) => a.id === id));
    }
  };

  tryUnlock('firstFlow', profile.stats.matches >= 1);
  tryUnlock('energyHunter', profile.stats.totalEnergy >= 10000);
  tryUnlock('millionEnergy', profile.stats.totalEnergy >= 1000000);
  tryUnlock('comboMaster', match.runStats.bestCombo >= 6);
  tryUnlock('voidSurvivor', match.runStats.rareCollected > 0 && result.survivalSeconds >= 180);
  tryUnlock('arenaChampion', result.rank === 1);
  tryUnlock('perfectEscape', match.player.ability?.id === 'phaseShift' && match.runStats.abilitiesUsed > 0 && result.reason !== 'eliminated');
  tryUnlock('overcharged', match.maxOverchargeSeen >= 99);
  tryUnlock('untouchable', match.maxUntouchedSeconds >= 120);
  tryUnlock('titanSlayer', match.runStats.titanParticipations > 0 && profile.stats.titanKills > 0);

  return newly;
}
