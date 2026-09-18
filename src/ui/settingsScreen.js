import { audio } from '../core/audio.js';
import { haptics } from '../core/haptics.js';

function switchRow(label, checked, onChange) {
  const row = document.createElement('div');
  row.className = 'glass-panel setting-row';
  row.innerHTML = `<span class="label">${label}</span><div class="switch${checked ? ' on' : ''}"><div class="knob"></div></div>`;
  const sw = row.querySelector('.switch');
  sw.addEventListener('click', () => {
    const next = !sw.classList.contains('on');
    sw.classList.toggle('on', next);
    onChange(next);
  });
  return row;
}

function segmentedRow(label, options, value, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'glass-panel setting-row';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'stretch';
  wrap.style.gap = '10px';
  const seg = document.createElement('div');
  seg.className = 'segmented';
  seg.innerHTML = `<span class="label" style="padding:6px 2px 0">${label}</span>`;
  const row = document.createElement('div');
  row.className = 'segmented';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.textContent = opt.label;
    btn.className = opt.value === value ? 'active' : '';
    btn.addEventListener('click', () => {
      row.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(opt.value);
    });
    row.appendChild(btn);
  }
  wrap.innerHTML = `<span class="label">${label}</span>`;
  wrap.appendChild(row);
  return wrap;
}

export function renderSettings(profile, saveProfile) {
  const body = document.getElementById('settings-body');
  body.innerHTML = '';

  const audioGroup = document.createElement('div');
  audioGroup.className = 'settings-group';
  audioGroup.innerHTML = '<h3>Audio</h3>';
  audioGroup.appendChild(switchRow('Music', profile.settings.music, (v) => {
    profile.settings.music = v; audio.setMusicEnabled(v); saveProfile();
  }));
  audioGroup.appendChild(switchRow('Sound Effects', profile.settings.sfx, (v) => {
    profile.settings.sfx = v; audio.setSfxEnabled(v); saveProfile();
  }));
  audioGroup.appendChild(switchRow('Haptics', profile.settings.haptics, (v) => {
    profile.settings.haptics = v; haptics.setEnabled(v); saveProfile();
  }));
  body.appendChild(audioGroup);

  const controlsGroup = document.createElement('div');
  controlsGroup.className = 'settings-group';
  controlsGroup.innerHTML = '<h3>Controls</h3>';
  controlsGroup.appendChild(segmentedRow('Joystick', [
    { label: 'Floating', value: 'floating' }, { label: 'Fixed', value: 'fixed' },
  ], profile.settings.controlMode, (v) => { profile.settings.controlMode = v; saveProfile(); }));
  controlsGroup.appendChild(switchRow('Left-handed', profile.settings.leftHanded, (v) => {
    profile.settings.leftHanded = v;
    document.getElementById('ability-btn').classList.toggle('left', v);
    saveProfile();
  }));
  body.appendChild(controlsGroup);

  const displayGroup = document.createElement('div');
  displayGroup.className = 'settings-group';
  displayGroup.innerHTML = '<h3>Display &amp; Graphics</h3>';
  displayGroup.appendChild(segmentedRow('Quality', [
    { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' }, { label: 'Ultra', value: 'ultra' },
  ], profile.settings.graphics, (v) => { profile.settings.graphics = v; saveProfile(); }));
  const scaleRow = document.createElement('div');
  scaleRow.className = 'glass-panel setting-row';
  scaleRow.style.flexDirection = 'column';
  scaleRow.style.alignItems = 'stretch';
  scaleRow.innerHTML = `<span class="label">UI Scale</span><input type="range" class="slider" min="0.85" max="1.25" step="0.05" value="${profile.settings.uiScale}">`;
  scaleRow.querySelector('input').addEventListener('input', (e) => {
    profile.settings.uiScale = parseFloat(e.target.value);
    document.documentElement.style.setProperty('--ui-scale', profile.settings.uiScale);
    saveProfile();
  });
  displayGroup.appendChild(scaleRow);
  body.appendChild(displayGroup);

  const accessGroup = document.createElement('div');
  accessGroup.className = 'settings-group';
  accessGroup.innerHTML = '<h3>Accessibility</h3>';
  accessGroup.appendChild(switchRow('Reduced Motion', profile.settings.reducedMotion, (v) => { profile.settings.reducedMotion = v; saveProfile(); }));
  accessGroup.appendChild(switchRow('Reduced VFX', profile.settings.reducedVFX, (v) => { profile.settings.reducedVFX = v; saveProfile(); }));
  accessGroup.appendChild(switchRow('High Contrast UI', profile.settings.highContrast, (v) => {
    profile.settings.highContrast = v;
    document.body.classList.toggle('high-contrast', v);
    saveProfile();
  }));
  accessGroup.appendChild(switchRow('Color-blind Friendly Palette', profile.settings.colorBlind, (v) => {
    profile.settings.colorBlind = v; saveProfile();
  }));
  body.appendChild(accessGroup);
}
