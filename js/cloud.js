import { CLOUD_DISPLAY_WIDTH, CLOUD_MOVE_SPEED } from './config.js';

export const CLOUD_TYPES = {
  WHALE: 'whale',
  NORMAL: 'normal',
  DIRECTION: 'direction',
  GLASS: 'glass', // 밟고 점프하면 서서히 사라지는 일회용 발판
  MOVING: 'moving',
  BREAKING: 'breaking',
  BOUNCE: 'bounce',
  BOOST: 'boost',
  ICE: 'ice',     // 미끄럼: 착지해도 멈추지 않고 미끄러진다
  THUNDER: 'thunder', // 작은 번개 연출이 있는 안전한 발판(피해 없음)
  // PHASE 는 정적 연출 방침에 따라 현재 스폰되지 않는다(타입만 남겨둠).
  PHASE: 'phase',
};

const SPRITE_W = 109;
const SPRITE_H = 31;
const PLATFORM_FROM_TOP = 0.32;

let cloudImage = null;
let cloudImageReady = false;

// 특수 구름 전용 스프라이트(있으면 사용). platFrac=발판이 스프라이트 높이의 어디쯤(위→아래 비율)
// aspectHint = 한 프레임의 세로/가로 비율. 이미지가 아직 안 불러와졌을 때도
// 배치 계산(visualBounds)이 실제 그려질 크기를 알 수 있게 미리 적어 둔다.
function loadCloudVariant(src, platFrac, wScale, frameCount = 1, frameTicks = 10, aspectHint = 1) {
  const v = { img: null, ready: false, platFrac, wScale, frameCount, frameTicks, aspectHint };
  if (typeof Image !== 'undefined') {
    v.img = new Image();
    v.img.onload = () => { v.ready = true; };
    v.img.onerror = () => { v.ready = false; };
    v.img.src = src;
  }
  return v;
}
// platFrac: 발판(구름 윗면)이 스프라이트 높이의 어디쯤인지(위→아래 비율).
// 효과(결정·화살표)가 큰 원본 아트 기준 값. 아트를 바꾸면 이 값도 같이 맞춰야 한다.
//
// frameTicks = 한 프레임을 몇 틱(60fps 기준) 유지할지. 4프레임 한 바퀴 기준으로
// 일반 36틱(2.4초) · 부스트 24틱(1.6초) · 바운스 18틱(1.2초). 부스트를 10틱(0.67초)으로 두면
// 혼자만 격렬하게 움직여 보여서 다른 구름과 비슷한 속도로 맞췄다.
const VARIANT_SPRITES = {
  [CLOUD_TYPES.NORMAL]: loadCloudVariant('assets/cloud-normal-imagegen-sheet.png', 0.32, 1, 4, 36, 248 / 872),
  [CLOUD_TYPES.DIRECTION]: loadCloudVariant('assets/cloud-direction-states.png', 0.53, 1, 3, 1, 52 / 128),
  [CLOUD_TYPES.GLASS]: loadCloudVariant('assets/cloud-glass-sheet.png', 0.32, 1, 4, 36, 33 / 128),
  [CLOUD_TYPES.BOOST]: loadCloudVariant('assets/cloud-boost-sheet.png', 0.58, 1.15, 4, 24, 96 / 128),
  [CLOUD_TYPES.BOUNCE]: loadCloudVariant('assets/cloud-bounce-imagegen-v3-sheet.png', 0.52, 1.15, 4, 18, 757 / 520),
  [CLOUD_TYPES.THUNDER]: loadCloudVariant('assets/cloud-thunder-cycle-sheet.png', 0.22, 1, 7, 1, 50 / 128),
};
// Keep the loader's object identity so its asynchronous ready flag stays live.
// 대기 4프레임 → 예고 → 번개 → 잔광. 타격 시간은 기존과 동일하게 유지한다.
// 총 430틱 ≈ 7.2초 주기 — 너무 자주 치면 지나가기가 답답하다.
VARIANT_SPRITES[CLOUD_TYPES.THUNDER].frameDurations = [90, 90, 90, 90, 36, 8, 26];

// 번개 줄기가 스프라이트 안에서 차지하는 자리(프레임 폭·높이 대비 비율).
// 구름 아래로 내려오는 부분만 실제 타격 범위다.
const THUNDER_BOLT = { x0: 58 / 128, x1: 74 / 128, y0: 34 / 50, y1: 49 / 50 };
const THUNDER_STRIKE_FRAME = 5;

export function loadCloudSprite() {
  if (cloudImage) return cloudImage;
  cloudImage = new Image();
  cloudImage.src = 'assets/cloud-export.png';
  cloudImage.onload = () => {
    cloudImageReady = true;
  };
  return cloudImage;
}

export function isCloudSpriteReady() {
  return cloudImageReady;
}

export class Cloud {
  constructor(x, y, type = CLOUD_TYPES.NORMAL, width = CLOUD_DISPLAY_WIDTH) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = width;
    this.drawHeight = width * (SPRITE_H / SPRITE_W);
    this.vx = type === CLOUD_TYPES.MOVING
      ? (Math.random() > 0.5 ? CLOUD_MOVE_SPEED : -CLOUD_MOVE_SPEED)
      : 0;
    this.broken = false;
    this.breakTimer = 0;
    this.directionChoice = 0; // 0=미선택, -1=왼쪽, 1=오른쪽
    this.isSolid = true; // 항상 실체(페이즈 구름 비활성)
    this.animFrameOffset = Math.floor(Math.random() * 40);
    if (type === CLOUD_TYPES.THUNDER) {
      this.animFrameOffset = Math.floor(Math.random() * 430);
    }
  }

  update(worldWidth, timeScale = 1) {
    if (this.type === CLOUD_TYPES.MOVING) {
      this.x += this.vx * timeScale;
      const margin = this.width / 2;
      if (this.x < margin) {
        this.x = margin;
        this.vx *= -1;
      } else if (this.x > worldWidth - margin) {
        this.x = worldWidth - margin;
        this.vx *= -1;
      }
    }

    if (this.broken) {
      this.breakTimer += this.type === CLOUD_TYPES.GLASS ? timeScale : 1;
      if (this.type === CLOUD_TYPES.GLASS && this.breakTimer >= 60) this.dead = true;
    }
  }

  // 착지/충전 중에는 유지하고, 이 발판에서 점프한 순간에만 소멸 시작.
  startGlassFade() {
    if (this.type !== CLOUD_TYPES.GLASS || this.broken) return;
    this.broken = true;
    this.isSolid = false;
    this.breakTimer = 0;
  }

  // 지금 번개가 치는 순간인지(번쩍이는 프레임인지).
  isStriking(frame) {
    if (this.type !== CLOUD_TYPES.THUNDER) return false;
    const variant = VARIANT_SPRITES[this.type];
    if (!variant?.frameDurations) return false;
    return this._spriteFrame(variant, frame) === THUNDER_STRIKE_FRAME;
  }

  // 번개 줄기가 실제로 지나가는 사각형(월드 좌표). draw() 와 같은 방식으로 계산한다.
  strikeZone(scale = 1) {
    const variant = VARIANT_SPRITES[this.type];
    if (!variant) return null;
    const aspect = variant.ready
      ? variant.img.naturalHeight / (variant.img.naturalWidth / variant.frameCount)
      : variant.aspectHint;
    const dispW = this.width * scale * variant.wScale;
    const dispH = dispW * aspect;
    const platY = this.y - this.drawHeight * scale * 0.18;
    const top = platY - dispH * variant.platFrac;
    const left = this.x - dispW / 2;
    return {
      left: left + dispW * THUNDER_BOLT.x0,
      right: left + dispW * THUNDER_BOLT.x1,
      top: top + dispH * THUNDER_BOLT.y0,
      bottom: top + dispH * THUNDER_BOLT.y1,
    };
  }

  // 화면에 실제로 그려지는 영역(월드 좌표, 구름 배율 1 기준). draw() 와 같은 계산을 한다.
  // 발판(top)과 달리 그림 전체를 덮으므로, 구름을 배치할 때 그림끼리 겹치는지 보는 데 쓴다.
  // 바운스 구름은 위로 솟는 이펙트 때문에 그림 높이가 일반 구름의 6배 가까이 된다.
  visualBounds(worldWidth) {
    let left;
    let right;
    let top;
    let bottom;
    const variant = VARIANT_SPRITES[this.type];
    if (variant) {
      const aspect = variant.ready
        ? variant.img.naturalHeight / (variant.img.naturalWidth / variant.frameCount)
        : variant.aspectHint;
      const dispW = this.width * variant.wScale;
      const dispH = dispW * aspect;
      const plat = this.y - this.drawHeight * 0.18;
      top = plat - dispH * variant.platFrac;
      bottom = top + dispH;
      left = this.x - dispW / 2;
      right = this.x + dispW / 2;
    } else {
      // 일반 구름은 숨쉬기로 폭 3.5%, 높이 5% 까지 커진다.
      const w = this.width * 1.035;
      const h = this.drawHeight * 1.05;
      left = this.x - w / 2;
      right = this.x + w / 2;
      top = this.y - h / 2;
      bottom = this.y + h / 2;
    }
    // 움직이는 구름은 결국 화면 폭 전체를 지나가므로 가로로는 피할 수 없다.
    if (this.type === CLOUD_TYPES.MOVING) {
      left = 0;
      right = worldWidth;
    }
    return { left, right, top, bottom };
  }

  get top() {
    const spriteTop = this.y - this.drawHeight / 2;
    return spriteTop + this.drawHeight * PLATFORM_FROM_TOP;
  }

  draw(ctx, cameraY, scale = 1, altitude = 0, frame = 0) {
    const fadeTicks = this.type === CLOUD_TYPES.GLASS ? 60 : 20;
    if (this.broken && this.breakTimer >= fadeTicks) return;

    const screenY = this.y - cameraY;
    // 부서지는 구름의 페이드아웃은 유지한다.
    const progress = this.broken ? Math.min(1, this.breakTimer / fadeTicks) : 0;
    const alpha = this.type === CLOUD_TYPES.GLASS
      ? 1 - progress * progress * (3 - 2 * progress)
      : 1 - progress;
    const w = this.width * scale;
    const h = this.drawHeight * scale;
    const dx = this.x - w / 2;
    const dy = screenY - h / 2;

    ctx.save();
    ctx.globalAlpha = alpha * (this.type === CLOUD_TYPES.GLASS ? 0.78 : 1);

    const dim = altitude > 0.05
      ? `brightness(${(1 - 0.32 * altitude).toFixed(2)}) saturate(${(1 - 0.2 * altitude).toFixed(2)})`
      : '';

    const variant = VARIANT_SPRITES[this.type];
    if (variant && variant.ready) {
      // 전용 스프라이트(구름 + 이펙트 포함)
      const sourceW = variant.img.naturalWidth / variant.frameCount;
      const sourceH = variant.img.naturalHeight;
      const aspect = sourceH / sourceW;
      const dispW = w * variant.wScale;
      const dispH = dispW * aspect;
      const platScreen = screenY - this.drawHeight * scale * 0.18; // 발판(구름 윗면) 화면 y
      const sdx = this.x - dispW / 2;
      const sdy = platScreen - dispH * variant.platFrac;
      ctx.imageSmoothingEnabled = false;
      ctx.filter = dim || 'none';
      const frameIndex = this.type === CLOUD_TYPES.DIRECTION
        ? (this.directionChoice < 0 ? 1 : this.directionChoice > 0 ? 2 : 0)
        : this._spriteFrame(variant, frame);
      ctx.drawImage(
        variant.img,
        frameIndex * sourceW, 0, sourceW, sourceH,
        sdx, sdy, dispW, dispH,
      );
      ctx.filter = 'none';
    } else if (cloudImageReady) {
      const filters = {
        [CLOUD_TYPES.NORMAL]: '',
        [CLOUD_TYPES.GLASS]: 'brightness(1.06) hue-rotate(165deg)',
        [CLOUD_TYPES.MOVING]: 'brightness(1.08) saturate(0.85) hue-rotate(185deg)',
        [CLOUD_TYPES.BREAKING]: 'sepia(0.35) brightness(1.12) saturate(1.2)',
        [CLOUD_TYPES.BOUNCE]: 'drop-shadow(0 0 5px rgba(255,95,168,0.95)) saturate(1.3)',
        [CLOUD_TYPES.BOOST]: 'drop-shadow(0 0 6px rgba(120,220,255,0.95)) brightness(1.05)',
        [CLOUD_TYPES.ICE]: 'brightness(1.12) saturate(0.55) hue-rotate(165deg) drop-shadow(0 0 3px rgba(150,230,255,0.9))',
        [CLOUD_TYPES.THUNDER]: 'brightness(0.6) sepia(0.2) hue-rotate(195deg)',
        [CLOUD_TYPES.PHASE]: 'brightness(1.05) saturate(0.7) hue-rotate(255deg)',
      };
      let filter = filters[this.type] ?? '';
      if (dim) filter = filter ? `${filter} ${dim}` : dim;
      ctx.filter = filter || 'none';
      ctx.drawImage(cloudImage, dx, dy, w, h);
      ctx.filter = 'none';

      if (this.type === CLOUD_TYPES.BOUNCE) {
        this._drawBounceMark(ctx, this.x, screenY, w);
      } else if (this.type === CLOUD_TYPES.BOOST) {
        this._drawBoostMark(ctx, this.x, screenY, w);
      }
    } else {
      this._drawFallback(ctx, screenY, w, h);
    }

    ctx.restore();
  }

  _spriteFrame(variant, frame) {
    const ticks = frame + this.animFrameOffset;
    if (!variant.frameDurations) {
      return Math.floor(ticks / variant.frameTicks) % variant.frameCount;
    }
    const total = variant.frameDurations.reduce((sum, duration) => sum + duration, 0);
    let elapsed = ticks % total;
    for (let i = 0; i < variant.frameDurations.length; i++) {
      if (elapsed < variant.frameDurations[i]) return i;
      elapsed -= variant.frameDurations[i];
    }
    return 0;
  }

  // 부스트 구름 표시: 청록(시안) 상승 화살표 3개 + 반짝이 (정적)
  _drawBoostMark(ctx, cx, screenY, w) {
    const baseY = screenY - this.drawHeight * 0.18;
    const rise = 0; // 정적: 떠오름 애니메이션 없음

    const arrow = (ax, ay, size, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ax, ay - size);
      ctx.lineTo(ax - size * 0.85, ay + size * 0.35);
      ctx.lineTo(ax - size * 0.32, ay + size * 0.35);
      ctx.lineTo(ax - size * 0.32, ay + size);
      ctx.lineTo(ax + size * 0.32, ay + size);
      ctx.lineTo(ax + size * 0.32, ay + size * 0.35);
      ctx.lineTo(ax + size * 0.85, ay + size * 0.35);
      ctx.closePath();
      ctx.fill();
    };

    ctx.save();
    // 가운데 큰 화살표 + 좌우 작은 화살표
    arrow(cx, baseY - rise, w * 0.13, '#5fd0ff');
    arrow(cx - w * 0.2, baseY + w * 0.04 + rise, w * 0.08, '#9be6ff');
    arrow(cx + w * 0.2, baseY + w * 0.04 - rise, w * 0.08, '#9be6ff');

    // 반짝이(4각 별) — 깜빡임
    ctx.fillStyle = '#eafcff';
    const sparkles = [
      { x: cx - w * 0.32, y: baseY + w * 0.02, ph: 0 },
      { x: cx + w * 0.32, y: baseY - w * 0.02, ph: 2.0 },
      { x: cx + w * 0.05, y: baseY - w * 0.16, ph: 4.0 },
    ];
    for (const sp of sparkles) {
      const r = w * 0.035; // 정적: 깜빡임 없이 항상 같은 크기
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - r);
      ctx.lineTo(sp.x + r * 0.32, sp.y);
      ctx.lineTo(sp.x, sp.y + r);
      ctx.lineTo(sp.x - r * 0.32, sp.y);
      ctx.closePath();
      ctx.moveTo(sp.x - r, sp.y);
      ctx.lineTo(sp.x, sp.y - r * 0.32);
      ctx.lineTo(sp.x + r, sp.y);
      ctx.lineTo(sp.x, sp.y + r * 0.32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 트램펄린 구름 표시: 분홍 더블 셰브론(위로 튕김)
  _drawBounceMark(ctx, cx, screenY, w) {
    const s = w * 0.12;
    const topY = screenY - this.drawHeight * 0.1;
    ctx.save();
    ctx.strokeStyle = '#ff4fa3';
    ctx.lineWidth = Math.max(2, w * 0.035);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const yy = topY - i * s * 0.85;
      ctx.beginPath();
      ctx.moveTo(cx - s, yy + s * 0.45);
      ctx.lineTo(cx, yy - s * 0.45);
      ctx.lineTo(cx + s, yy + s * 0.45);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawFallback(ctx, screenY, w, h) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#c8dff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.x, screenY, w * 0.45, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

export function pickCloudType(heightScore) {
  const clamp = (v) => Math.min(1, Math.max(0, v));
  // 아주 천천히 변하도록 긴 구간에 걸쳐 특수 구름이 늘어난다.
  const t = clamp((heightScore - 80) / 1120); // 80m → 1200m
  const tBreak = clamp((heightScore - 200) / 1000); // 부서짐은 200m부터
  const tIce = clamp((heightScore - 300) / 900); // 얼음은 300m부터
  const pBreak = 0.10 * tBreak; // 부서짐: 0% → 10%
  const pMove = 0.03 + 0.15 * t; // 이동: 3% → 18%
  const pBounce = 0.03 + 0.07 * t; // 트램펄린(도움): 3% → 10%
  const pBoost = 0.03 + 0.07 * t; // 부스트(도움): 3% → 10%
  const pIce = 0.09 * tIce; // 얼음(미끄럼): 0% → 9%
  // 번개 구름은 발판으로는 빼고, 나중에 화면 위에서 가끔 크게 내리치는 이벤트로 바꿀 예정.
  const pThunder = 0;
  const pGlass = 0.04 + 0.02 * t; // 유리: 4% → 6%, 일반 구름 일부 대체
  const pDirection = 0.05; // 방향 선택 구름: 5%, 일반 구름 일부 대체
  // 페이즈(깜빡이며 사라지는) 구름은 정적 연출 방침에 따라 비활성화.
  const pPhase = 0;

  const roll = Math.random();
  let acc = 0;
  if (roll < (acc += pBreak)) return CLOUD_TYPES.BREAKING;
  if (roll < (acc += pBounce)) return CLOUD_TYPES.BOUNCE;
  if (roll < (acc += pBoost)) return CLOUD_TYPES.BOOST;
  if (roll < (acc += pMove)) return CLOUD_TYPES.MOVING;
  if (roll < (acc += pIce)) return CLOUD_TYPES.ICE;
  if (roll < (acc += pPhase)) return CLOUD_TYPES.PHASE;
  if (roll < (acc += pThunder)) return CLOUD_TYPES.THUNDER;
  if (roll < (acc += pGlass)) return CLOUD_TYPES.GLASS;
  if (roll < (acc += pDirection)) return CLOUD_TYPES.DIRECTION;
  return CLOUD_TYPES.NORMAL;
}

export function randomCloudWidth() {
  const scales = [0.95, 1, 1.05, 1.12];
  const scale = scales[Math.floor(Math.random() * scales.length)];
  return Math.round(CLOUD_DISPLAY_WIDTH * scale);
}

loadCloudSprite();
