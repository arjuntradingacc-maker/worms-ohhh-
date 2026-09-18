export function renderLeaderboard(profile) {
  const list = document.getElementById('lb-list');
  list.innerHTML = '';
  if (!profile.leaderboardLocal.length) {
    list.innerHTML = '<p class="offline-note">No runs recorded yet. Finish a match to appear here.</p>';
    return;
  }
  profile.leaderboardLocal.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'glass-panel lb-row';
    row.innerHTML = `
      <div class="lb-rank">${i + 1}</div>
      <div class="lb-name">${entry.name}<div style="font-size:0.68rem;color:var(--text-faint)">${entry.mode} · size ${entry.size} · ${entry.survival}s</div></div>
      <div class="lb-score">${entry.score}</div>
    `;
    list.appendChild(row);
  });
}
