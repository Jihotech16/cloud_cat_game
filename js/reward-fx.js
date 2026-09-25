// Cosmetic only: reward state stays paused until this sequence completes.
export const REWARD_FX = {
  jump: 'jump', charge: 'jump', chargeCap: 'jump', doubleJump: 'jump', trGlass: 'jump',
  magnet: 'orb', orbValue: 'orb', trGreed: 'orb', legMagnet: 'orb',
  shield: 'shield', feather: 'feather', legFeather: 'feather',
  coinBonus: 'star', scoreMul: 'star', scoreX2: 'star', trFrenzy: 'star',
  slowmo: 'time', bigcloud: 'cloud', rocket: 'rocket', legRocket: 'rocket',
  trRush: 'wind', legHazard: 'shatter', legShock: 'wave',
};

export async function playRewardSelection({ card, screen, reward, target, valid = () => true }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 120 : reward.tier === 'legendary' ? 780 : 720;
  const animations = [];
  const layer = document.createElement('div');
  layer.className = 'reward-fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  let raf = 0;
  let timer;
  const animate = (el, frames, options) => {
    if (el.animate) animations.push(el.animate(frames, { fill: 'forwards', ...options }));
  };
  try {
    if (!valid()) return false;
    for (const other of screen.querySelectorAll('.reward-card')) {
      if (other !== card) animate(other, [{ opacity: 1 }, { opacity: 0.18 }], { duration: 160 });
    }
    animate(card, [{ transform: 'scale(1)' }, { transform: reduced ? 'scale(1)' : 'scale(1.035)', boxShadow: '0 0 22px #ffe7a580' }], { duration: 180 });
    animate(screen, [{ opacity: 1 }, { opacity: 0 }], { delay: reduced ? 0 : 300, duration: reduced ? 120 : 200 });
    if (!reduced) {
      const art = card.querySelector('.reward-art, .reward-icon');
      if (art) {
        const ghost = art.cloneNode(true);
        const a = art.getBoundingClientRect();
        ghost.classList.add('reward-fx-ghost');
        Object.assign(ghost.style, { position: 'absolute', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: '0' });
        layer.append(ghost);
        animate(ghost, [{ opacity: 0, transform: 'translate(0,0) scale(1)' }, { opacity: 1, offset: 0.15, transform: 'translate(0,0) scale(1.1)' }, { opacity: 0, transform: `translate(${target.x - a.left - a.width / 2}px,${target.y - a.top - a.height / 2}px) scale(.12)` }], { delay: 140, duration: 340 });
      }
      const canvas = document.createElement('canvas');
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      Object.assign(canvas.style, { width: '100%', height: '100%', position: 'absolute', inset: '0' });
      layer.append(canvas);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      const start = performance.now();
      await new Promise(resolve => {
        const tick = now => {
          if (!valid() || now - start >= duration) { resolve(); return; }
          ctx.clearRect(0, 0, innerWidth, innerHeight);
          const p = (now - start - 350) / (duration - 350);
          if (p > 0) drawBurst(ctx, target, Math.min(p, 1), REWARD_FX[reward.id] || 'star', reward.tier === 'legendary');
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        // Background tabs or interrupted RAF must never strand the selection.
        timer = setTimeout(resolve, duration + 150);
      });
    } else {
      await new Promise(resolve => { timer = setTimeout(resolve, duration); });
    }
    return valid();
  } finally {
    cancelAnimationFrame(raf); clearTimeout(timer);
    animations.forEach(a => a.cancel());
    layer.remove();
  }
}

function drawBurst(ctx, target, p, kind, legendary) {
  const { x, y } = target;
  ctx.save();
  ctx.globalAlpha = Math.sin(Math.PI * p) * 0.8;
  ctx.lineWidth = 2;
  ctx.strokeStyle = legendary ? '#f7d98b' : '#b7e8f8';
  ctx.fillStyle = legendary || kind === 'star' ? '#ffe5a0' : '#d2f4fb';
  if (legendary || ['shield', 'wave', 'cloud', 'time', 'wind'].includes(kind)) {
    for (let i = 0; i < (kind === 'wave' ? 3 : 1); i++) {
      ctx.beginPath();
      ctx.ellipse(x, y, 22 + p * 30 + i * 9, (kind === 'wave' || kind === 'cloud' ? .4 : 1) * (22 + p * 30 + i * 9), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const radius = kind === 'orb' ? 52 * (1 - p) : 14 + p * 38;
    let px = x + Math.cos(angle) * radius;
    let py = y + Math.sin(angle) * radius;
    if (kind === 'jump' || kind === 'rocket') { px = x + (i % 4 - 1.5) * 13; py = y + 24 - p * 65 + Math.floor(i / 4) * 15; }
    if (kind === 'feather') { px = x + Math.cos(angle + p) * 40; py = y - 38 + p * 65 + (i % 3) * 9; }
    ctx.beginPath();
    if (kind === 'jump' || kind === 'rocket') {
      ctx.moveTo(px - 4, py + 3); ctx.lineTo(px, py - 2); ctx.lineTo(px + 4, py + 3); ctx.stroke();
    } else if (kind === 'feather') {
      ctx.ellipse(px, py, 2, 7, angle / 3, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'star' || kind === 'shatter') {
      ctx.moveTo(px, py - 5); ctx.lineTo(px + 3, py); ctx.lineTo(px, py + 5); ctx.lineTo(px - 3, py); ctx.closePath(); ctx.fill();
    } else {
      ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
