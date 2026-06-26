import { ORB_RADIUS } from './config.js';

// 점프 경로에 떠 있는 동그란 수집 아이템.
export class Orb {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = ORB_RADIUS;
    this.collected = false;
    this.phase = Math.random() * Math.PI * 2; // 반짝임/둥실 위상
  }

  draw(ctx, cameraY, frame) {
    const t = frame * 0.08 + this.phase;
    const bob = Math.sin(t) * this.r * 0.18;
    const x = this.x;
    const y = this.y - cameraY + bob;
    const r = this.r;
    const pulse = 0.85 + 0.15 * Math.sin(t * 1.3);

    ctx.save();
    // 글로우
    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.1 * pulse);
    glow.addColorStop(0, 'rgba(255,236,150,0.85)');
    glow.addColorStop(1, 'rgba(255,210,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.1 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 본체
    const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    body.addColorStop(0, '#fff7d6');
    body.addColorStop(0.5, '#ffd24a');
    body.addColorStop(1, '#f5a623');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.32, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 보상 정의. 게이지가 가득 차면 이 중 3개가 무작위로 제시된다.
export const REWARDS = [
  { id: 'scoreX2', icon: '✨', label: '점수 2배', desc: '한동안 점수가 2배로 쌓여요' },
  { id: 'shield', icon: '🛡️', label: '보호막', desc: '한 번 떨어져도 부활해요' },
  { id: 'magnet', icon: '🧲', label: '자석', desc: '한동안 오브를 끌어당겨요' },
  { id: 'jump', icon: '🚀', label: '점프 파워', desc: '한동안 더 높이 점프해요' },
];

// 무작위로 n개의 보상을 고른다.
export function pickRewardChoices(n = 3) {
  const pool = [...REWARDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
