import { ORB_RADIUS } from './config.js';

// 선택 사항: assets/orb.png 가 있으면 그 스프라이트를 쓰고, 없으면 픽셀아트로 재현.
let orbImg = null;
let orbImgReady = false;
if (typeof Image !== 'undefined') {
  orbImg = new Image();
  orbImg.onload = () => { orbImgReady = true; };
  orbImg.onerror = () => { orbImgReady = false; };
  orbImg.src = 'assets/orb.png';
}

// 무지개 오브 스프라이트(있으면 사용).
let rainbowImg = null;
let rainbowImgReady = false;
if (typeof Image !== 'undefined') {
  rainbowImg = new Image();
  rainbowImg.onload = () => { rainbowImgReady = true; };
  rainbowImg.onerror = () => { rainbowImgReady = false; };
  rainbowImg.src = 'assets/orb-rainbow.png';
}

// 청록 픽셀아트 구슬 스프라이트(저해상도 → 확대 시 픽셀 느낌). 한 번만 생성해 캐시.
let pixelOrb = null;
function getPixelOrb() {
  if (pixelOrb || typeof document === 'undefined') return pixelOrb;
  const S = 18;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const x = cv.getContext('2d');
  const cx = S / 2 - 0.5;
  const cy = S / 2 - 0.5;
  const disc = (r, color, ox = 0, oy = 0) => {
    x.fillStyle = color;
    x.beginPath();
    x.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
    x.fill();
  };
  disc(8.4, '#0b5560');                 // 어두운 외곽 링
  disc(6.8, '#15a9bd');                 // 진한 청록 본체
  disc(5.2, '#3ad6e6', -0.6, -0.6);     // 밝은 면
  disc(3.0, '#9af0f6', -1.2, -1.4);     // 하이라이트 영역
  // 중앙 흰 십자 반짝
  x.fillStyle = '#ffffff';
  x.fillRect(Math.round(cx - 0.5), Math.round(cy - 2.5), 2, 5);
  x.fillRect(Math.round(cx - 2.5), Math.round(cy - 0.5), 5, 2);
  // 좌상단 작은 점 하이라이트
  x.fillRect(Math.round(cx - 3.5), Math.round(cy - 3.5), 1, 1);
  pixelOrb = cv;
  return pixelOrb;
}

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
    ctx.imageSmoothingEnabled = false;

    if (orbImgReady) {
      // 제공된 스프라이트(반짝이 포함) 사용
      const size = r * 4.6 * pulse;
      ctx.drawImage(orbImg, Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
    } else {
      // 픽셀아트 구슬 + 반짝이 직접 그리기
      const sprite = getPixelOrb();
      const size = r * 2.7;
      if (sprite) {
        ctx.drawImage(sprite, Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
      }
      this._drawSparkles(ctx, x, y, r, frame);
    }
    ctx.restore();
  }

  // 청록 십자 반짝이를 주위에 그린다(픽셀 느낌, 깜빡임).
  _drawSparkles(ctx, x, y, r, frame) {
    const pts = [
      { ox: 1.5, oy: -1.7, ph: 0 },
      { ox: -1.7, oy: 1.4, ph: 2.1 },
      { ox: 1.7, oy: 1.6, ph: 4.0 },
    ];
    ctx.fillStyle = '#aef6fb';
    for (const s of pts) {
      const tw = Math.sin(frame * 0.12 + this.phase + s.ph);
      if (tw < 0.2) continue;
      const a = (tw - 0.2) / 0.8;
      const sx = Math.round(x + s.ox * r);
      const sy = Math.round(y + s.oy * r);
      const len = Math.max(1, Math.round(r * 0.45 * a));
      const w = Math.max(1, Math.round(r * 0.16));
      ctx.fillRect(sx - len, sy - (w >> 1), len * 2, w);
      ctx.fillRect(sx - (w >> 1), sy - len, w, len * 2);
    }
  }

  _drawRainbow(ctx, x, y, r, frame, pulse) {
    if (rainbowImgReady) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const size = r * 4.4; // 크기 고정(맥동 제거)
      ctx.drawImage(rainbowImg, Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
      ctx.restore();
      return;
    }

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

// 보상 등급(레어도). 카드 색과 등장 가중치가 등급에 따라 달라진다.
// w0=고도 0%일 때 가중치, w1=고도 100%일 때 가중치 → 높이 오를수록 상위 등급↑
export const TIERS = {
  common: { label: '일반', w0: 3.0, w1: 1.5 },
  rare: { label: '레어', w0: 1.3, w1: 2.0 },
  epic: { label: '에픽', w0: 0.5, w1: 1.0 },
  legendary: { label: '전설', w0: 0.06, w1: 0.4 }, // 매우 희귀 · 고도 오를수록 ↑
};

function tierWeight(tier, progress) {
  const t = TIERS[tier];
  if (!t) return 1;
  const p = Math.min(1, Math.max(0, progress));
  return t.w0 + (t.w1 - t.w0) * p;
}

// 보상 계열(태그). 같은 계열을 모으면 세트 시너지가 발동한다.
export const TAGS = {
  jump: { emoji: '🦘', label: '점프', color: '#4a90e2' },
  orb: { emoji: '🔮', label: '오브', color: '#16a766' },
  score: { emoji: '📈', label: '점수', color: '#e8638a' },
  survival: { emoji: '🛡️', label: '생존', color: '#f5a623' },
};

// 보상 정의. 게이지가 가득 차면 이 중 3개가 등급 가중치로 제시된다.
// evolveAt: 이 레벨에 도달하면 진화(강화형으로 승격). evolveName: 진화명.
export const REWARDS = [
  { id: 'jump', icon: '⬆️', label: '점프 파워 ⬆', desc: '점프력이 영구적으로 올라가요 (중첩)', tier: 'common', tags: ['jump'], evolveAt: 5, evolveName: '메가 점프' },
  { id: 'charge', icon: '⚡', label: '차지 가속 ⬆', desc: '점프 충전(꾹 누르기) 속도가 빨라져요 (중첩)', tier: 'common', tags: ['jump'] },
  { id: 'chargeCap', icon: '🔋', label: '점프 파워 최대치 ⬆', desc: '점프 파워를 더 많이 모을 수 있어요 (중첩)', tier: 'common', tags: ['jump'] },
  { id: 'orbValue', icon: '💎', label: '오브 가치 ⬆', desc: '오브당 게이지 충전량이 늘어요 (중첩)', tier: 'common', tags: ['orb'], evolveAt: 5, evolveName: '보석 세공' },
  { id: 'feather', icon: '🪶', label: '깃털', desc: '한동안 천천히 떨어져요', tier: 'common', tags: ['jump', 'survival'] },
  { id: 'slowmo', icon: '🐢', label: '슬로우 모션', desc: '한동안 시간이 느려져 조종이 쉬워요', tier: 'common', tags: ['survival'] },
  { id: 'bigcloud', icon: '☁️', label: '큰 발판', desc: '한동안 구름이 커져 착지가 쉬워요', tier: 'common', tags: ['survival'] },
  { id: 'coinBonus', icon: '🪙', label: '코인 획득', desc: '코인을 한 번에 받아요', tier: 'common', tags: [] },
  { id: 'magnet', icon: '🧲', label: '자석 ⬆', desc: '오브 끌어당김 범위가 늘어나요 (중첩)', tier: 'rare', tags: ['orb'], evolveAt: 3, evolveName: '자기 폭풍' },
  { id: 'doubleJump', icon: '🪽', label: '더블 점프 ⬆', desc: '공중에서 한 번 더 점프해요 (중첩)', tier: 'rare', tags: ['jump'] },
  { id: 'scoreMul', icon: '📈', label: '점수 배율 ⬆', desc: '점수 획득량이 영구적으로 늘어요 (중첩)', tier: 'rare', tags: ['score'], evolveAt: 5, evolveName: '복리 점수' },
  { id: 'scoreX2', icon: '✨', label: '점수 2배', desc: '한동안 점수가 2배로 쌓여요', tier: 'rare', tags: ['score'] },
  { id: 'rocket', icon: 'assets/rocket.png', label: '로켓 부스트', desc: '잠깐 위로 쭉 솟아올라요!', tier: 'epic', tags: ['score'] },
  { id: 'shield', icon: '🛡️', label: '보호막', desc: '한 번 떨어져도 부활해요', tier: 'epic', tags: ['survival'] },

  // ── 트레이드오프(강력하지만 대가가 있음). unique=판당 1회. downside=대가 설명.
  { id: 'trFrenzy', icon: '🔥', label: '광란', desc: '점수 획득 +50%', downside: '발판이 18% 작아져요', tier: 'rare', tags: ['score'], tradeoff: true, unique: true },
  { id: 'trGlass', icon: '🎯', label: '유리 대포', desc: '점프력 +40%', downside: '차지 속도 30% 느려져요', tier: 'rare', tags: ['jump'], tradeoff: true, unique: true },
  { id: 'trGreed', icon: '🤑', label: '탐욕', desc: '오브 충전 +60% · 코인 2배', downside: '가시가 40% 빨라져요', tier: 'rare', tags: ['orb'], tradeoff: true, unique: true },
  { id: 'trRush', icon: '💨', label: '질주', desc: '이동 속도 +30%', downside: '중력이 15% 세져요', tier: 'epic', tags: ['jump'], tradeoff: true, unique: true },

  // ── 전설(게임의 룰을 바꾸는 유니크). unique=판당 1회.
  { id: 'legMagnet', icon: '🌀', label: '무한 자석', desc: '화면의 모든 오브를 자동으로 빨아들여요', tier: 'legendary', tags: ['orb'], unique: true },
  { id: 'legHazard', icon: '💥', label: '가시 파괴자', desc: '가시에 닿으면 죽지 않고 부수며 코인을 얻어요', tier: 'legendary', tags: ['survival'], unique: true },
  { id: 'legShock', icon: '🌊', label: '파동 마스터', desc: '착지마다 충격파로 주변 오브·가시를 쓸어요', tier: 'legendary', tags: ['jump'], unique: true },
  { id: 'legRocket', icon: 'assets/rocket.png', label: '로켓 엔진', desc: '주기적으로 자동 로켓 부스트가 터져요', tier: 'legendary', tags: ['score'], unique: true },
  { id: 'legFeather', icon: '🕊️', label: '황금 깃털', desc: '항상 천천히 떨어져 추락 위험이 크게 줄어요', tier: 'legendary', tags: ['survival'], unique: true },
];

// 세트 시너지 정의(임계 2/3/4 → 누적 효과 설명). HUD/툴팁 표시에 사용.
export const SYNERGIES = {
  jump: { 2: '점프력 +15%', 3: '점프력 +30% · 착지 충격파', 4: '점프력 +50% · 대형 충격파' },
  orb: { 2: '게이지 +25%', 3: '게이지 +45% · 자석 범위 ↑', 4: '게이지 +70% · 오브 가끔 2배' },
  score: { 2: '점수 +20%', 3: '점수 +45%', 4: '점수 +75% · 배율 자동 상승' },
  survival: { 2: '추락 여유 ↑', 3: '추락 여유 ↑↑', 4: '보호막 자동 재생' },
};

// 시그니처 페어: 특정 두 보상을 모두 가지면 발동하는 숨은 조합.
// ids 둘을 모두 taken 하면 effect 가 켜진다. HUD 에 '거의 완성' 힌트로 노출한다.
export const SIGNATURE_PAIRS = [
  { ids: ['magnet', 'orbValue'], emoji: '⛏️', label: '자원 채굴', desc: '오브가 코인을 2배로 줘요' },
  { ids: ['scoreMul', 'rocket'], emoji: '☄️', label: '유성 궤도', desc: '로켓 중 점수가 추가로 2배!' },
  { ids: ['jump', 'doubleJump'], emoji: '🤸', label: '공중 곡예', desc: '공중 점프가 지상 점프만큼 강해져요' },
  { ids: ['chargeCap', 'charge'], emoji: '🔌', label: '과충전', desc: '완충 시 점프력 +20%' },
];

// 등급 가중치(고도 진행도 반영)로 중복 없이 n개의 보상을 고른다.
// exclude: 제외할 보상 id 목록(예: 이미 활성화된 보호막).
export function pickRewardChoices(n = 3, progress = 0, exclude = []) {
  const ex = new Set(exclude);
  const pool = REWARDS.filter((r) => !ex.has(r.id)).map((r) => ({ ...r }));
  const chosen = [];
  while (chosen.length < n && pool.length) {
    const weights = pool.map((r) => tierWeight(r.tier, progress));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let idx = 0;
    while (idx < pool.length - 1 && (roll -= weights[idx]) > 0) idx += 1;
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return chosen;
}
