// Translates pointer/touch taps on the gameplay canvas into a container
// index. Pure input mapping — no game rules live here.

export function attachPointerHandling(canvasEl, scene, onTap) {
  let downPos = null;

  function toLocal(e) {
    const rect = canvasEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTest(x, y) {
    for (let i = scene.containers.length - 1; i >= 0; i--) {
      const cv = scene.containers[i];
      const pad = 10;
      if (x >= cv.baseX - pad && x <= cv.baseX + cv.w + pad && y >= cv.baseY - pad && y <= cv.baseY + cv.h + pad) {
        return i;
      }
    }
    return -1;
  }

  function onDown(e) {
    downPos = toLocal(e);
  }
  function onUp(e) {
    if (!downPos) return;
    const p = toLocal(e);
    const dist = Math.hypot(p.x - downPos.x, p.y - downPos.y);
    downPos = null;
    if (dist > 24) return; // treat as a drag/scroll gesture, not a tap
    const idx = hitTest(p.x, p.y);
    if (idx >= 0) onTap(idx);
  }

  canvasEl.addEventListener('pointerdown', onDown, { passive: true });
  canvasEl.addEventListener('pointerup', onUp, { passive: true });
  canvasEl.addEventListener('pointercancel', () => { downPos = null; }, { passive: true });

  return () => {
    canvasEl.removeEventListener('pointerdown', onDown);
    canvasEl.removeEventListener('pointerup', onUp);
  };
}
