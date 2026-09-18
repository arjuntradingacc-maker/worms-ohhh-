// Thin wrapper around navigator.vibrate. Every call is a no-op when the
// browser doesn't support it or the player has haptics disabled.

let enabled = true;
export function setHapticsEnabled(v) { enabled = v; }

const PATTERNS = {
  select: [8],
  pour: [10, 30, 14],
  perfect: [18, 40, 26],
  invalid: [12],
  levelComplete: [16, 40, 16, 40, 30],
  buttonTap: [6],
  coin: [8],
};

export function haptic(name) {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const pattern = PATTERNS[name];
  if (pattern) navigator.vibrate(pattern);
}
