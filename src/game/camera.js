import { damp, clamp } from '../core/vec.js';

// Dynamic top-down camera: smoothly follows the player core and zooms out
// as their Lumen grows, with inertia so nothing ever snaps.
export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.15;
    this._targetZoom = 1.15;
  }

  follow(target, dt, reducedMotion) {
    const smoothing = reducedMotion ? 0.35 : 0.09;
    this.x = damp(this.x, target.x, smoothing * 2.4, dt);
    this.y = damp(this.y, target.y, smoothing * 2.4, dt);

    const radius = target.radius || 15;
    this._targetZoom = clamp(1.35 - (radius - 15) * 0.0032, 0.42, 1.35);
    const zoomSmoothing = reducedMotion ? 0.5 : 0.045;
    this.zoom = damp(this.zoom, this._targetZoom, zoomSmoothing * 2.4, dt);
  }

  // World -> screen transform helper for the renderer.
  worldToScreen(x, y, screenW, screenH) {
    return {
      x: (x - this.x) * this.zoom + screenW / 2,
      y: (y - this.y) * this.zoom + screenH / 2,
    };
  }
}
