import { ORB_RADIUS } from './config.js';

// 점프 경로에 떠 있는 동그란 수집 아이템.
// type: 'normal' | 'rainbow'(가끔 등장, 게이지 즉시 가득)
export class Orb {
  constructor(x, y, type = 'normal') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.r = ORB_RADIUS * (type === 'rainbow' ? 1.15 : 1);
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

    if (this.type === 'rainbow') {
      this._drawRainbow(ctx, x, y, r, frame, pulse);
      return;
    }

    ctx.save();
    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.1 * pulse);
    glow.addColorStop(0, 'rgba(255,236,150,0.85)');
    glow.addColorStop(1, 'rgba(255,210,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.1 * pulse, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    body.addColorStop(0, '#fff7d6');
    body.addColorStop(0.5, '#ffd24a');
    body.addColorStop(1, '#f5a623');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.32, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawRainbow(ctx, x, y, r, frame, pulse) {
    const hue = (frame * 4) % 360;
    ctx.save();
    // 무지개 글로우
    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4 * pulse);
    glow.addColorStop(0, `hsla(${hue},100%,70%,0.9)`);
    glow.addColorStop(1, `hsla(${hue},100%,70%,0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 무지개 띠 본체
    const body = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    for (let i = 0; i <= 6; i++) {
      body.addColorStop(i / 6, `hsl(${(hue + i * 60) % 360},95%,60%)`);
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 보상 등급(레어도). 등장 가중치와 카드 색이 등급에 따라 달라진다.
export const TIERS = {
  common: { label: '일반', weight: 3 },
  rare: { label: '레어', weight: 1.3 },
  epic: { label: '에픽', weight: 0.5 },
};

// 보상 정의. 게이지가 가득 차면 이 중 3개가 등급 가중치로 제시된다.
export const REWARDS = [
  { id: 'jump', icon: '⬆️', label: '점프 파워 ⬆', desc: '점프력이 영구적으로 올라가요 (중첩)', tier: 'common' },
  { id: 'charge', icon: '⚡', label: '차지 가속 ⬆', desc: '점프 충전(꾹 누르기) 속도가 빨라져요 (중첩)', tier: 'common' },
  { id: 'orbValue', icon: '💎', label: '오브 가치 ⬆', desc: '오브당 게이지 충전량이 늘어요 (중첩)', tier: 'common' },
  { id: 'feather', icon: '🪶', label: '깃털', desc: '한동안 천천히 떨어져요', tier: 'common' },
  { id: 'slowmo', icon: '🐢', label: '슬로우 모션', desc: '한동안 시간이 느려져 조종이 쉬워요', tier: 'common' },
  { id: 'bigcloud', icon: '☁️', label: '큰 발판', desc: '한동안 구름이 커져 착지가 쉬워요', tier: 'common' },
  { id: 'coinBonus', icon: '🪙', label: '코인 획득', desc: '코인을 한 번에 받아요', tier: 'common' },
  { id: 'magnet', icon: '🧲', label: '자석 ⬆', desc: '오브 끌어당김 범위가 늘어나요 (중첩)', tier: 'rare' },
  { id: 'doubleJump', icon: '🪽', label: '더블 점프 ⬆', desc: '공중에서 한 번 더 점프해요 (중첩)', tier: 'rare' },
  { id: 'scoreMul', icon: '📈', label: '점수 배율 ⬆', desc: '점수 획득량이 영구적으로 늘어요 (중첩)', tier: 'rare' },
  { id: 'scoreX2', icon: '✨', label: '점수 2배', desc: '한동안 점수가 2배로 쌓여요', tier: 'rare' },
  { id: 'rocket', icon: '🚀', label: '로켓 부스트', desc: '잠깐 위로 쭉 솟아올라요!', tier: 'epic' },
  { id: 'shield', icon: '🛡️', label: '보호막', desc: '한 번 떨어져도 부활해요', tier: 'epic' },
];

// 등급 가중치로 중복 없이 n개의 보상을 고른다.
export function pickRewardChoices(n = 3) {
  const pool = REWARDS.map((r) => ({ ...r }));
  const chosen = [];
  while (chosen.length < n && pool.length) {
    const weights = pool.map((r) => TIERS[r.tier]?.weight ?? 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let idx = 0;
    while (idx < pool.length - 1 && (roll -= weights[idx]) > 0) idx += 1;
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return chosen;
}
