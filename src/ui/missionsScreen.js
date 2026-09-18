import { ACHIEVEMENTS } from '../core/save.js';

export function renderMissions(profile) {
  const dailyEl = document.getElementById('missions-daily');
  dailyEl.innerHTML = '';
  for (const c of profile.dailyChallenges.list) {
    const pct = Math.min(100, Math.round((c.progress / c.goal) * 100));
    const row = document.createElement('div');
    row.className = 'glass-panel mission-row';
    row.innerHTML = `
      <div class="mission-icon">${c.done ? '✓' : '◎'}</div>
      <div class="mission-info">
        <div style="font-weight:600">${c.desc}</div>
        <div class="mission-bar"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="pill">+${c.reward.xp} XP</div>
    `;
    dailyEl.appendChild(row);
  }

  const achEl = document.getElementById('missions-achievements');
  achEl.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const unlocked = !!profile.achievements[a.id]?.unlocked;
    const row = document.createElement('div');
    row.className = 'glass-panel achievement-row' + (unlocked ? '' : ' locked');
    row.innerHTML = `
      <div class="ach-icon">${unlocked ? '★' : '☆'}</div>
      <div>
        <div style="font-weight:600">${a.name}</div>
        <div style="font-size:0.78rem;color:var(--text-secondary)">${a.desc}</div>
      </div>
    `;
    achEl.appendChild(row);
  }
}

export function wireMissionTabs() {
  document.querySelectorAll('#screen-missions .segmented-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#screen-missions .segmented-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('missions-daily').classList.toggle('hidden', tab !== 'daily');
      document.getElementById('missions-achievements').classList.toggle('hidden', tab !== 'achievements');
    });
  });
}
