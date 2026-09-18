const STEPS = [
  { icon: '☝', title: 'Move', text: 'Drag anywhere on screen. Your Lumen always flows forward — you steer the direction.' },
  { icon: '◇', title: 'Collect', text: 'Glide through glowing energy fragments to grow. Chain pickups quickly to build a combo multiplier.' },
  { icon: '⚠', title: 'Danger', text: "Other Lumens' trails are dangerous — crash into one and you burst apart. Bumping a core just costs you some energy." },
  { icon: '➤', title: 'Surge & Drift', text: 'Push your drag far from center to Surge (fast, wide turns). Keep it close to Drift (slow, sharp turns) around tight spaces.' },
  { icon: '◈', title: 'Abilities', text: 'Tap your ability button to use your equipped power. It needs to cool down before you can use it again.' },
  { icon: '◎', title: 'Win', text: 'Survive, outgrow, and outscore the arena. The longer you last, the more Overcharge you build — bigger rewards, bigger risk.' },
];

export function initTutorial(onComplete) {
  let step = 0;
  const textEl = document.getElementById('tutorial-text');
  const dotsEl = document.getElementById('tutorial-dots');
  const nextBtn = document.getElementById('tutorial-next');

  dotsEl.innerHTML = STEPS.map((_, i) => `<span></span>`).join('');

  function render() {
    const s = STEPS[step];
    textEl.innerHTML = `<div style="font-size:1.6rem;margin-bottom:6px">${s.icon} <strong style="font-size:1rem">${s.title}</strong></div><div style="color:var(--text-secondary);font-size:0.92rem">${s.text}</div>`;
    [...dotsEl.children].forEach((d, i) => d.classList.toggle('active', i === step));
    nextBtn.textContent = step === STEPS.length - 1 ? 'Play!' : 'Next';
  }

  nextBtn.onclick = () => {
    step++;
    if (step >= STEPS.length) { onComplete(); return; }
    render();
  };
  render();
}
