import { clamp, dist } from '../core/vec.js';

const MAX_DRAG = 62;

// Unifies touch / mouse / pen via the Pointer Events API (one code path for
// "virtual joystick" and "drag anywhere") plus a keyboard fallback so the
// game is also playable with a mouse+keyboard during development.
export class TouchController {
  constructor({ zoneEl, baseEl, thumbEl, abilityEl, getMode, getLeftHanded }) {
    this.zoneEl = zoneEl;
    this.baseEl = baseEl;
    this.thumbEl = thumbEl;
    this.abilityEl = abilityEl;
    this.getMode = getMode || (() => 'floating');
    this.getLeftHanded = getLeftHanded || (() => false);

    this._active = false;
    this._pointerId = null;
    this._originX = 0;
    this._originY = 0;
    this._angle = 0;
    this._magnitude = 0;

    this._abilityPointerId = null;
    this.onAbility = null;

    this._keys = new Set();

    this._bind();
    this._layoutFixedAnchor();
  }

  _bind() {
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onKeyDown = (e) => this._keys.add(e.code);
    this._onKeyUp = (e) => this._keys.delete(e.code);
    this._onAbilityDown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (this._abilityPointerId !== null) return;
      this._abilityPointerId = e.pointerId;
      this.abilityEl.classList.add('pressed');
      this.onAbility?.();
    };
    this._onAbilityUp = (e) => {
      if (e.pointerId !== this._abilityPointerId) return;
      this._abilityPointerId = null;
      this.abilityEl.classList.remove('pressed');
    };

    this.zoneEl.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.abilityEl.addEventListener('pointerdown', this._onAbilityDown);
    window.addEventListener('pointerup', this._onAbilityUp);
    window.addEventListener('pointercancel', this._onAbilityUp);
    window.addEventListener('resize', () => this._layoutFixedAnchor());
  }

  _layoutFixedAnchor() {
    const rect = this.zoneEl.getBoundingClientRect();
    const margin = 110;
    this._fixedAnchor = this.getLeftHanded()
      ? { x: rect.right - margin, y: rect.bottom - margin }
      : { x: rect.left + margin, y: rect.bottom - margin };
  }

  _onDown(e) {
    if (this._pointerId !== null) return;
    if (e.target === this.abilityEl || this.abilityEl.contains(e.target)) return;
    this._pointerId = e.pointerId;
    this._active = true;
    const mode = this.getMode();
    if (mode === 'fixed') {
      this._layoutFixedAnchor();
      this._originX = this._fixedAnchor.x;
      this._originY = this._fixedAnchor.y;
    } else {
      this._originX = e.clientX;
      this._originY = e.clientY;
    }
    this.baseEl.style.left = `${this._originX}px`;
    this.baseEl.style.top = `${this._originY}px`;
    this.baseEl.classList.add('visible');
    this.thumbEl.classList.add('visible');
    this._updateFromPoint(e.clientX, e.clientY);
  }

  _onMove(e) {
    if (e.pointerId !== this._pointerId) return;
    this._updateFromPoint(e.clientX, e.clientY);
  }

  _onUp(e) {
    if (e.pointerId !== this._pointerId) return;
    this._pointerId = null;
    this._active = false;
    this._magnitude = 0;
    this.baseEl.classList.remove('visible');
    this.thumbEl.classList.remove('visible');
    this.thumbEl.style.transform = 'translate(-50%, -50%)';
  }

  _updateFromPoint(cx, cy) {
    const dx = cx - this._originX;
    const dy = cy - this._originY;
    const d = Math.hypot(dx, dy);
    this._magnitude = clamp(d / MAX_DRAG, 0, 1);
    if (d > 2) this._angle = Math.atan2(dy, dx);
    const clampedD = Math.min(d, MAX_DRAG);
    const tx = Math.cos(this._angle) * clampedD;
    const ty = Math.sin(this._angle) * clampedD;
    this.thumbEl.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
  }

  _keyboardInput() {
    let dx = 0, dy = 0;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) dy -= 1;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) dy += 1;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) dx -= 1;
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) dx += 1;
    if (dx === 0 && dy === 0) return null;
    const angle = Math.atan2(dy, dx);
    let magnitude = 0.6;
    if (this._keys.has('ShiftLeft') || this._keys.has('ShiftRight')) magnitude = 0.95;
    if (this._keys.has('ControlLeft') || this._keys.has('AltLeft')) magnitude = 0.15;
    return { angle, magnitude };
  }

  getInput() {
    const kb = this._keyboardInput();
    if (kb) return kb;
    return { angle: this._angle, magnitude: this._active ? this._magnitude : 0 };
  }

  consumeAbilityKey() {
    if (this._keys.has('Space')) {
      this._keys.delete('Space');
      return true;
    }
    return false;
  }

  destroy() {
    this.zoneEl.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.abilityEl.removeEventListener('pointerdown', this._onAbilityDown);
  }
}
