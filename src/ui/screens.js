const screens = {};
let current = null;
const listeners = { enter: {}, leave: {} };

export function registerScreens(ids) {
  for (const id of ids) screens[id] = document.getElementById(`screen-${id}`);
}

export function onEnter(id, fn) {
  (listeners.enter[id] = listeners.enter[id] || []).push(fn);
}
export function onLeave(id, fn) {
  (listeners.leave[id] = listeners.leave[id] || []).push(fn);
}

export function showScreen(id, payload) {
  if (current && screens[current]) {
    screens[current].classList.remove('active');
    (listeners.leave[current] || []).forEach((fn) => fn());
  }
  current = id;
  if (screens[id]) screens[id].classList.add('active');
  (listeners.enter[id] || []).forEach((fn) => fn(payload));
}

export function currentScreen() { return current; }

// --- Toasts -------------------------------------------------------
export function showToast(message) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast glass-panel';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s ease'; }, 2200);
  setTimeout(() => el.remove(), 2600);
}

let achTimer = null;
export function showAchievementToast(name) {
  const el = document.getElementById('achievement-toast');
  document.getElementById('achievement-toast-name').textContent = name;
  el.classList.add('show');
  clearTimeout(achTimer);
  achTimer = setTimeout(() => el.classList.remove('show'), 3400);
}
