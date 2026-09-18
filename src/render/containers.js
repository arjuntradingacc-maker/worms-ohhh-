// Seven completely original container silhouettes — no generic test tubes.
// Each shape function draws into a local coordinate space of width `w`,
// height `h`, origin at top-left, and returns the "innerRect" (the liquid
// clipping bounds) plus a "spoutX" (where liquid pours from when tipped).
// Shapes are deliberately chunky, rounded and asymmetric-personality.

function roundPath(ctx, pts, r) {
  // pts: array of {x,y}. Draws a closed rounded polygon.
  ctx.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const pPrev = pts[(i - 1 + n) % n];
    const dx1 = p0.x - pPrev.x, dy1 = p0.y - pPrev.y;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const dx2 = p1.x - p0.x, dy2 = p1.y - p0.y;
    const len2 = Math.hypot(dx2, dy2) || 1;
    const rr = Math.min(r, len1 / 2, len2 / 2);
    const start = { x: p0.x - (dx1 / len1) * rr, y: p0.y - (dy1 / len1) * rr };
    const end = { x: p0.x + (dx2 / len2) * rr, y: p0.y + (dy2 / len2) * rr };
    if (i === 0) ctx.moveTo(start.x, start.y); else ctx.lineTo(start.x, start.y);
    ctx.quadraticCurveTo(p0.x, p0.y, end.x, end.y);
  }
  ctx.closePath();
}

// Each builder returns { draw(ctx,w,h): draws outline path (call ctx.fill/stroke after),
//                         inner(w,h): {x,y,w,h,topY} liquid bounds,
//                         neckTopY(h): y of the very top opening for pour anchoring }

export const SHAPES = {
  // Bubble bottle: round bulbous body, short round neck. Cute & squat.
  bubble: {
    draw(ctx, w, h) {
      const neckH = h * 0.16, bodyTop = neckH, bodyR = w * 0.46;
      ctx.beginPath();
      ctx.moveTo(w * 0.32, 0);
      ctx.lineTo(w * 0.68, 0);
      ctx.quadraticCurveTo(w * 0.72, neckH * 0.5, w * 0.62, bodyTop);
      ctx.arc(w * 0.5, bodyTop + bodyR * 0.72, bodyR, -Math.PI * 0.82, Math.PI * 0.82, false);
      ctx.quadraticCurveTo(w * 0.28, neckH * 0.5, w * 0.32, 0);
      ctx.closePath();
    },
    inner(w, h) { const neckH = h * 0.16; return { x: w * 0.1, y: neckH * 0.85, w: w * 0.8, h: h - neckH * 0.85 }; },
    neckTopY: () => 0,
  },
  // Jelly jar: wide short jar with a wobbly lid rim.
  jelly: {
    draw(ctx, w, h) {
      roundPath(ctx, [
        { x: w * 0.16, y: h * 0.1 }, { x: w * 0.84, y: h * 0.1 },
        { x: w * 0.9, y: h * 0.98 }, { x: w * 0.1, y: h * 0.98 },
      ], w * 0.16);
    },
    inner(w, h) { return { x: w * 0.14, y: h * 0.14, w: w * 0.72, h: h * 0.82 }; },
    neckTopY: (h) => h * 0.1,
  },
  // Squishy tube: tall narrow rounded tube, slightly pinched waist.
  tube: {
    draw(ctx, w, h) {
      ctx.beginPath();
      ctx.moveTo(w * 0.28, 0);
      ctx.lineTo(w * 0.72, 0);
      ctx.quadraticCurveTo(w * 0.8, h * 0.4, w * 0.62, h * 0.5);
      ctx.quadraticCurveTo(w * 0.86, h * 0.62, w * 0.78, h * 0.94);
      ctx.quadraticCurveTo(w * 0.7, h, w * 0.5, h);
      ctx.quadraticCurveTo(w * 0.3, h, w * 0.22, h * 0.94);
      ctx.quadraticCurveTo(w * 0.14, h * 0.62, w * 0.38, h * 0.5);
      ctx.quadraticCurveTo(w * 0.2, h * 0.4, w * 0.28, 0);
      ctx.closePath();
    },
    inner(w, h) { return { x: w * 0.2, y: h * 0.03, w: w * 0.6, h: h * 0.94 }; },
    neckTopY: () => 0,
  },
  // Candy container: barrel body with a twisted-wrapper top flare.
  candy: {
    draw(ctx, w, h) {
      const flare = h * 0.12;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, 0);
      ctx.lineTo(w * 0.8, 0);
      ctx.lineTo(w * 0.66, flare);
      ctx.quadraticCurveTo(w * 0.92, flare + h * 0.1, w * 0.88, h * 0.55);
      ctx.quadraticCurveTo(w * 0.84, h * 0.98, w * 0.5, h);
      ctx.quadraticCurveTo(w * 0.16, h * 0.98, w * 0.12, h * 0.55);
      ctx.quadraticCurveTo(w * 0.08, flare + h * 0.1, w * 0.34, flare);
      ctx.closePath();
    },
    inner(w, h) { const flare = h * 0.12; return { x: w * 0.14, y: flare + h * 0.05, w: w * 0.72, h: h * 0.9 - flare }; },
    neckTopY: (h) => h * 0.12,
  },
  // Capsule bottle: pill-shaped, fully rounded top and bottom.
  capsule: {
    draw(ctx, w, h) {
      const r = w * 0.42;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - r, r);
      ctx.arc(w * 0.5, r, r, Math.PI, 0, false);
      ctx.lineTo(w * 0.5 + r, h - r);
      ctx.arc(w * 0.5, h - r, r, 0, Math.PI, false);
      ctx.closePath();
    },
    inner(w, h) { const r = w * 0.42; return { x: w * 0.5 - r * 0.92, y: r * 0.35, w: r * 1.84, h: h - r * 0.35 - r }; },
    neckTopY: () => 0,
  },
  // Funky potion jar: bulging middle, narrow cork neck with a knob top.
  potion: {
    draw(ctx, w, h) {
      const neckH = h * 0.2, knobR = w * 0.12;
      ctx.beginPath();
      ctx.arc(w * 0.5, knobR, knobR, 0, Math.PI * 2);
      ctx.moveTo(w * 0.38, knobR * 1.6);
      ctx.lineTo(w * 0.62, knobR * 1.6);
      ctx.lineTo(w * 0.58, neckH);
      ctx.quadraticCurveTo(w * 0.98, neckH + h * 0.1, w * 0.9, h * 0.6);
      ctx.quadraticCurveTo(w * 0.82, h, w * 0.5, h);
      ctx.quadraticCurveTo(w * 0.18, h, w * 0.1, h * 0.6);
      ctx.quadraticCurveTo(w * 0.02, neckH + h * 0.1, w * 0.42, neckH);
      ctx.closePath();
    },
    inner(w, h) { const neckH = h * 0.2; return { x: w * 0.14, y: neckH + h * 0.02, w: w * 0.72, h: h * 0.96 - neckH }; },
    neckTopY: (h) => h * 0.2,
  },
  // Rounded soda bottle: classic curvy waist silhouette, but chunky/candy.
  bottle: {
    draw(ctx, w, h) {
      const neckH = h * 0.22;
      ctx.beginPath();
      ctx.moveTo(w * 0.4, 0);
      ctx.lineTo(w * 0.6, 0);
      ctx.lineTo(w * 0.58, neckH * 0.7);
      ctx.quadraticCurveTo(w * 0.86, neckH + h * 0.06, w * 0.8, h * 0.42);
      ctx.quadraticCurveTo(w * 0.72, h * 0.5, w * 0.8, h * 0.6);
      ctx.quadraticCurveTo(w * 0.9, h * 0.86, w * 0.7, h * 0.98);
      ctx.quadraticCurveTo(w * 0.5, h, w * 0.3, h * 0.98);
      ctx.quadraticCurveTo(w * 0.1, h * 0.86, w * 0.2, h * 0.6);
      ctx.quadraticCurveTo(w * 0.28, h * 0.5, w * 0.2, h * 0.42);
      ctx.quadraticCurveTo(w * 0.14, neckH + h * 0.06, w * 0.42, neckH * 0.7);
      ctx.closePath();
    },
    inner(w, h) { const neckH = h * 0.22; return { x: w * 0.12, y: neckH * 0.6, w: w * 0.76, h: h * 0.98 - neckH * 0.6 }; },
    neckTopY: (h) => h * 0.22,
  },
};

export const SHAPE_NAMES = Object.keys(SHAPES);

export function getShape(name) { return SHAPES[name] || SHAPES.jelly; }
