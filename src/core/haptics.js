// Thin wrapper around the Vibration API. Silently no-ops on unsupported
// devices (iOS Safari, desktop) rather than throwing.

const PATTERNS = {
  collectRare: [12],
  ability: [10, 30, 10],
  nearMiss: [8],
  eliminate: [15, 40, 15, 40, 25],
  milestone: [10, 20, 10, 20, 10],
  victory: [20, 40, 20, 40, 20, 40, 60],
};

class Haptics {
  constructor() {
    this.enabled = true;
    this.supported = typeof navigator !== 'undefined' && !!navigator.vibrate;
  }

  setEnabled(on) { this.enabled = on; }

  play(name) {
    if (!this.enabled || !this.supported) return;
    const pattern = PATTERNS[name];
    if (!pattern) return;
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }
}

export const haptics = new Haptics();
