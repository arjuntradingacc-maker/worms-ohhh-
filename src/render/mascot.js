// Liqi — the original mascot of Match the Liquid. A small colorful liquid
// blob with a state machine driving idle bob, blinking, excitement,
// dancing, sleeping, celebrating, confusion and a level-complete jump.
// Pure canvas drawing; owns its own animation clock, driven by tick(dt).

import { clamp, lerp, TAU, rand } from '../core/utils.js';

const STATES = ['idle', 'excited', 'dancing', 'asleep', 'celebrating', 'confused', 'jumping'];

export class Liqi {
  constructor() {
    this.state = 'idle';
    this.t = 0;
    this.stateT = 0;
    this.blinkTimer = rand(2, 4);
    this.blinking = 0;
    this.idleTimer = 0;
    this.hue = 322; // candy pink base
    this.squashX = 1; this.squashY = 1;
    this.bobY = 0;
    this.lookX = 0;
    this.confusedLook = 0;
    this.zParticles = [];
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
    if (s !== 'asleep') this.idleTimer = 0;
  }

  poke() {
    // Tapping/interacting resets the fall-asleep timer.
    this.idleTimer = 0;
    if (this.state === 'asleep') this.setState('idle');
  }

  tick(dt) {
    this.t += dt;
    this.stateT += dt;
    if (this.state === 'idle') {
      this.idleTimer += dt;
      if (this.idleTimer > 14) this.setState('asleep');
    }

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinking <= 0 && this.state !== 'asleep') {
      this.blinking = 0.18;
      this.blinkTimer = rand(2.5, 5.5);
    }
    if (this.blinking > 0) this.blinking -= dt;

    // Per-state motion parameters.
    switch (this.state) {
      case 'idle': {
        const bob = Math.sin(this.t * 2.2) * 6;
        this.bobY = bob;
        this.squashX = 1 - Math.max(0, Math.sin(this.t * 2.2)) * 0.03;
        this.squashY = 1 + Math.max(0, Math.sin(this.t * 2.2)) * 0.04;
        this.lookX = Math.sin(this.t * 0.5) * 3;
        break;
      }
      case 'excited': {
        const bob = Math.abs(Math.sin(this.t * 7)) * 10;
        this.bobY = -bob;
        this.squashX = 1 + Math.sin(this.t * 7) * 0.06;
        this.squashY = 1 - Math.sin(this.t * 7) * 0.08;
        break;
      }
      case 'dancing': {
        this.bobY = -Math.abs(Math.sin(this.t * 6)) * 14;
        this.lean = Math.sin(this.t * 5) * 0.28;
        this.squashX = 1 + Math.sin(this.t * 6) * 0.08;
        this.squashY = 1 - Math.sin(this.t * 6) * 0.1;
        this.hue = 300 + Math.sin(this.t * 2) * 60;
        break;
      }
      case 'asleep': {
        this.bobY = Math.sin(this.t * 0.8) * 3 + 4;
        this.squashX = 1.05; this.squashY = 0.92;
        if (Math.random() < dt * 0.9) this.zParticles.push({ x: rand(6, 16), y: 0, life: 1.6, age: 0 });
        break;
      }
      case 'celebrating': {
        this.bobY = -Math.abs(Math.sin(this.t * 8)) * 16;
        this.squashX = 1 + Math.sin(this.t * 8) * 0.1;
        this.squashY = 1 - Math.sin(this.t * 8) * 0.12;
        this.hue = (this.hue + dt * 220) % 360;
        break;
      }
      case 'confused': {
        this.lookX = Math.sin(this.t * 14) * 6;
        this.confusedLook = clamp(this.stateT / 0.3, 0, 1);
        this.squashX = 1 - 0.04; this.squashY = 1.03;
        if (this.stateT > 0.9) this.setState('idle');
        break;
      }
      case 'jumping': {
        const p = clamp(this.stateT / 0.55, 0, 1);
        this.bobY = -Math.sin(p * Math.PI) * 60;
        this.squashY = 1 - Math.sin(p * Math.PI) * 0.15;
        if (p >= 1) this.setState('celebrating');
        break;
      }
    }

    this.zParticles = this.zParticles.filter((z) => { z.age += dt; z.y -= dt * 14; return z.age < z.life; });
  }

  // Draws Liqi centered at (x, y) with the given base radius.
  draw(ctx, x, y, radius = 34) {
    ctx.save();
    ctx.translate(x, y + this.bobY);
    const lean = this.lean || 0;
    ctx.rotate(lean);
    ctx.scale(this.squashX, this.squashY);

    const hue = this.hue;
    const bodyGrad = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, radius * 0.15, 0, 0, radius * 1.15);
    bodyGrad.addColorStop(0, `hsl(${hue}, 100%, 82%)`);
    bodyGrad.addColorStop(0.5, `hsl(${hue}, 92%, 62%)`);
    bodyGrad.addColorStop(1, `hsl(${(hue + 20) % 360}, 90%, 48%)`);

    // Blobby body via wobbling bezier around a circle.
    ctx.beginPath();
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const wob = 1 + Math.sin(a * 3 + this.t * 1.6) * 0.035 + Math.sin(a * 5 - this.t * 0.9) * 0.02;
      const r = radius * wob;
      const px = Math.cos(a) * r, py = Math.sin(a) * r * 1.06;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Side nubs (simple little arm blobs) that wiggle when dancing.
    const armPhase = this.state === 'dancing' ? Math.sin(this.t * 6) : Math.sin(this.t * 2) * 0.2;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * radius * 0.92, radius * 0.15 + Math.abs(armPhase) * -4);
      ctx.rotate(side * armPhase * 0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.22, radius * 0.16, 0, 0, TAU);
      ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
      ctx.fill();
      ctx.restore();
    }

    // Glossy highlight.
    ctx.beginPath();
    ctx.ellipse(-radius * 0.32, -radius * 0.42, radius * 0.32, radius * 0.2, -0.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    // Face.
    const eyeY = -radius * 0.08;
    const eyeSpacing = radius * 0.34;
    const blinkAmt = this.blinking > 0 ? clamp(this.blinking / 0.18, 0, 1) : 0;
    const eyeH = radius * 0.22 * (1 - blinkAmt * 0.92) * (this.state === 'asleep' ? 0.08 : 1);
    const lookX = this.lookX || 0;

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * eyeSpacing + lookX * 0.3, eyeY);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.14, Math.max(1, eyeH), 0, 0, TAU);
      ctx.fillStyle = '#2b1035';
      ctx.fill();
      if (this.state !== 'asleep' && eyeH > radius * 0.05) {
        ctx.beginPath();
        ctx.arc(-radius * 0.03, -radius * 0.04, radius * 0.045, 0, TAU);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
      ctx.restore();
    }

    // Confused single raised eyebrow.
    if (this.state === 'confused') {
      ctx.save();
      ctx.translate(eyeSpacing * -1, eyeY - radius * 0.32);
      ctx.rotate(-0.3);
      ctx.fillStyle = '#2b1035';
      ctx.fillRect(-radius * 0.16, 0, radius * 0.32, radius * 0.05);
      ctx.restore();
    }

    // Mouth.
    ctx.beginPath();
    const mouthY = radius * 0.32;
    if (this.state === 'asleep') {
      ctx.arc(0, mouthY - radius * 0.1, radius * 0.1, 0, Math.PI);
    } else if (this.state === 'confused') {
      ctx.arc(0, mouthY, radius * 0.08, 0, TAU);
      ctx.fillStyle = '#2b1035';
      ctx.fill();
    } else if (this.state === 'excited' || this.state === 'celebrating' || this.state === 'jumping' || this.state === 'dancing') {
      ctx.moveTo(-radius * 0.22, mouthY - radius * 0.05);
      ctx.quadraticCurveTo(0, mouthY + radius * 0.28, radius * 0.22, mouthY - radius * 0.05);
      ctx.quadraticCurveTo(0, mouthY + radius * 0.05, -radius * 0.22, mouthY - radius * 0.05);
      ctx.fillStyle = '#2b1035';
      ctx.fill();
    } else {
      ctx.moveTo(-radius * 0.22, mouthY);
      ctx.quadraticCurveTo(0, mouthY + radius * 0.18, radius * 0.22, mouthY);
    }
    if (this.state === 'idle' || this.state === 'confused') {
      ctx.strokeStyle = '#2b1035';
      ctx.lineWidth = Math.max(2, radius * 0.055);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();

    // Zzz particles while asleep (drawn in world space, not squashed).
    if (this.zParticles.length) {
      ctx.save();
      ctx.font = `${radius * 0.4}px "Fredoka", sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const z of this.zParticles) {
        const a = 1 - z.age / z.life;
        ctx.globalAlpha = a;
        ctx.fillText('z', x + radius * 0.6 + z.x, y - radius * 0.6 + z.y);
      }
      ctx.restore();
    }
  }
}
