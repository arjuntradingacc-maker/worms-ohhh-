// Lightweight standalone preview renderer used on the Home and Customize
// screens — a small idle animation loop, independent from the full match
// engine, so menus stay cheap on battery.
export function createPreviewAnimator(canvas) {
  const ctx = canvas.getContext('2d');
  let raf = null;
  let theme = { hue: 165, hue2: 205, aura: 'ring', particle: 'dust' };
  let t = 0;

  function setTheme(newTheme) { theme = { ...theme, ...newTheme }; }

  function frame() {
    t += 0.016;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const hue = theme.hue;

    // Soft ambient glow behind everything.
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
    bgGrad.addColorStop(0, `hsla(${hue},70%,30%,0.25)`);
    bgGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Trail: a gentle wave of floating orbs behind the core.
    const segCount = 9;
    for (let i = segCount; i >= 1; i--) {
      const f = i / segCount;
      const angle = t * 0.6 - f * 0.9;
      const dist = 18 + f * (w * 0.24);
      const x = cx + Math.cos(angle + Math.PI) * dist;
      const y = cy + Math.sin(angle + Math.PI) * dist + Math.sin(t * 2 + i) * 4;
      const r = Math.max(3, (w * 0.09) * (1 - f * 0.6));
      ctx.beginPath();
      ctx.fillStyle = `hsla(${hue},85%,66%,${0.75 - f * 0.55})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aura.
    if (theme.aura && theme.aura !== 'none') {
      ctx.strokeStyle = `hsla(${hue},85%,70%,0.45)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Core.
    const pulse = 1 + Math.sin(t * 2.2) * 0.06;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.16 * pulse);
    grad.addColorStop(0, `hsla(${hue},100%,90%,1)`);
    grad.addColorStop(0.55, `hsla(${hue},95%,60%,0.95)`);
    grad.addColorStop(1, `hsla(${theme.hue2},90%,45%,0.15)`);
    ctx.shadowColor = `hsl(${hue},95%,60%)`;
    ctx.shadowBlur = 30;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.16 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Orbiting particles.
    for (let i = 0; i < 5; i++) {
      const a = t * 1.4 + (i / 5) * Math.PI * 2;
      const r = w * 0.24;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${hue},90%,78%,0.85)`;
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(frame);
  }

  return {
    start() { if (!raf) raf = requestAnimationFrame(frame); },
    stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
    setTheme,
  };
}
