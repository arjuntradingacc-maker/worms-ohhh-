import { ABILITY_DEFS } from '../game/abilities.js';
import { MODES } from '../game/match.js';

const ABILITY_ICON = { dash: '➤', phase: '◌', magnet: '✦', shield: '⛨' };

let els = null;

export function initHUD() {
  els = {
    score: document.getElementById('hud-score'),
    time: document.getElementById('hud-time'),
    timeLabel: document.getElementById('hud-time-label'),
    overcharge: document.getElementById('overcharge-fill'),
    stamina: document.getElementById('stamina-fill'),
    combo: document.getElementById('combo-badge'),
    minimap: document.getElementById('minimap'),
    abilityBtn: document.getElementById('ability-btn'),
    abilityCd: document.getElementById('ability-cd'),
    countdown: document.getElementById('overlay-countdown'),
    countdownNum: document.getElementById('countdown-number'),
    elimination: document.getElementById('overlay-elimination'),
    elimGrid: document.getElementById('elim-grid'),
    victory: document.getElementById('overlay-victory'),
    victoryTitle: document.getElementById('victory-title'),
    victoryGrid: document.getElementById('victory-grid'),
    pause: document.getElementById('overlay-pause'),
  };
  els.minimapCtx = els.minimap.getContext('2d');
  return els;
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function setAbilityIcon(abilityId) {
  const def = ABILITY_DEFS[abilityId];
  els.abilityBtn.firstChild.textContent = ABILITY_ICON[def?.icon] || '◈';
}

export function updateHUD(match) {
  els.score.textContent = Math.round(match.player.score);
  if (match.mode.duration) {
    els.time.textContent = fmtTime(match.mode.duration - match.elapsed);
    els.timeLabel.textContent = 'Time Left';
  } else {
    els.time.textContent = fmtTime(match.player.survivalSeconds);
    els.timeLabel.textContent = 'Survival';
  }
  els.overcharge.style.width = `${Math.round(match.player.overcharge)}%`;
  els.stamina.style.width = `${Math.round(match.player.stamina)}%`;

  const combo = match.player.comboCount + 1;
  if (combo > 1) {
    els.combo.textContent = `×${combo}`;
    els.combo.classList.add('show');
    els.combo.style.left = `${window.innerWidth / 2}px`;
    els.combo.style.top = `${window.innerHeight * 0.34}px`;
  } else {
    els.combo.classList.remove('show');
  }

  if (match.player.ability) {
    const a = match.player.ability;
    const def = ABILITY_DEFS[a.id];
    // cooldownRemaining ticks down from the moment the ability activates
    // (concurrently with its active-effect window, see abilities.js), so it
    // alone always reflects "time until usable again" — no need to special
    // case `active`, which used to make the ring falsely read 0% while the
    // ability was still resolving.
    const pct = Math.round((a.cooldownRemaining / def.cooldown) * 100);
    els.abilityCd.style.setProperty('--pct', `${pct}%`);
    els.abilityBtn.style.opacity = pct > 0 ? '0.55' : '1';
  }

  drawMinimap(match);
}

function drawMinimap(match) {
  const ctx = els.minimapCtx;
  const size = els.minimap.width;
  const c = size / 2;
  const mapR = c - 6;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, mapR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(150,200,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = 'rgba(10,14,30,0.4)';
  ctx.fillRect(0, 0, size, size);

  const scale = mapR / match.arena.radius;
  for (const lumen of match.lumens) {
    if (!lumen.alive) continue;
    const x = c + lumen.x * scale;
    const y = c + lumen.y * scale;
    ctx.beginPath();
    ctx.fillStyle = lumen.isPlayer ? '#4be3ff' : lumen.isHunter ? '#ff5f6d' : 'rgba(255,255,255,0.55)';
    ctx.arc(x, y, lumen.isPlayer ? 4 : 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (match.titan && match.titan.active) {
    const x = c + match.titan.x * scale, y = c + match.titan.y * scale;
    ctx.beginPath();
    ctx.fillStyle = '#9c5cff';
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function showCountdown(onFlow) {
  els.countdown.classList.add('show');
  const seq = ['3', '2', '1', 'FLOW'];
  let i = 0;
  const step = () => {
    els.countdownNum.textContent = seq[i];
    els.countdownNum.style.animation = 'none';
    // Force reflow so the pulse animation restarts each tick.
    void els.countdownNum.offsetWidth;
    els.countdownNum.style.animation = 'pulse 0.5s ease';
    i++;
    if (i < seq.length) {
      setTimeout(step, 700);
    } else {
      setTimeout(() => { els.countdown.classList.remove('show'); onFlow(); }, 500);
    }
  };
  step();
}

function fillResultGrid(el, result) {
  const rows = [
    ['Score', result.score],
    ['Rank', `#${result.rank} / ${result.totalPlayers}`],
    ['Survival', fmtTime(result.survivalSeconds)],
    ['Largest Size', result.size],
    ['Eliminations', result.eliminations],
    ['Energy Collected', result.energyCollected],
  ];
  el.innerHTML = rows.map(([label, value]) => `<div><span class="rv">${value}</span><span class="rl">${label}</span></div>`).join('');
}

export function showElimination(result, killerName, xpEarned, onContinue) {
  fillResultGrid(els.elimGrid, result);
  const sub = document.createElement('div');
  sub.style.cssText = 'color:var(--text-secondary);font-size:0.82rem;margin-top:-8px;margin-bottom:10px';
  sub.textContent = killerName ? `Crashed into ${killerName}'s trail · +${xpEarned} XP` : `+${xpEarned} XP`;
  els.elimGrid.parentElement.insertBefore(sub, els.elimGrid);
  els.elimination.classList.add('show');
  els.elimination.querySelector('#btn-elim-continue').onclick = () => {
    sub.remove();
    els.elimination.classList.remove('show');
    onContinue();
  };
}

export function showVictory(result, xpEarned, onContinue) {
  els.victoryTitle.textContent = result.won ? 'VICTORY' : 'MATCH COMPLETE';
  fillResultGrid(els.victoryGrid, result);
  const sub = document.createElement('div');
  sub.style.cssText = 'color:var(--text-secondary);font-size:0.82rem;margin-top:-8px;margin-bottom:10px';
  sub.textContent = `+${xpEarned} XP earned`;
  els.victoryGrid.parentElement.insertBefore(sub, els.victoryGrid);
  els.victory.classList.add('show');
  els.victory.querySelector('#btn-victory-continue').onclick = () => {
    sub.remove();
    els.victory.classList.remove('show');
    onContinue();
  };
}

export function showPause(onResume, onQuit) {
  els.pause.classList.add('show');
  els.pause.querySelector('#btn-resume').onclick = () => { els.pause.classList.remove('show'); onResume(); };
  els.pause.querySelector('#btn-quit').onclick = () => { els.pause.classList.remove('show'); onQuit(); };
}

export function hidePause() {
  els.pause.classList.remove('show');
}

export function modeDurationLabel(modeId) {
  return MODES[modeId]?.name || modeId;
}
