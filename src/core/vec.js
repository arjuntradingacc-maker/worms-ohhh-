// Minimal 2D vector helpers used throughout LumenLoop. Plain {x,y} objects
// are used everywhere instead of a Vec2 class to keep the hot loop
// allocation-free where possible (callers pass scratch objects).

export const TAU = Math.PI * 2;

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function distSq(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Frame-rate independent exponential smoothing. `smoothing` in [0,1],
// higher = snappier. `dt` in seconds.
export function damp(current, target, smoothing, dt) {
  const t = 1 - Math.pow(1 - smoothing, dt * 60);
  return lerp(current, target, t);
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Shortest signed angular difference, result in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}

export function angleStep(a, target, maxStep) {
  const d = angleDiff(a, target);
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

export function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

export function weightedPick(items, weightFn) {
  let total = 0;
  for (const it of items) total += weightFn(it);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightFn(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
