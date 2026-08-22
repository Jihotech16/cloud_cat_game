import { CLOUD_DISPLAY_WIDTH, CLOUD_MOVE_SPEED } from './config.js';

export const CLOUD_TYPES = {
  NORMAL: 'normal',
  MOVING: 'moving',
  BREAKING: 'breaking',
  BOUNCE: 'bounce',
  BOOST: 'boost',
  ICE: 'ice',     // 미끄럼: 착지해도 멈추지 않고 미끄러진다
  PHASE: 'phase', // 깜빡임: 실체/투명을 반복, 투명일 때 밟을 수 없다
};

// 페이즈 구름 주기(프레임): 실체 156 → 투명 84 반복.
const PHASE_SOLID = 156;
const PHASE_CYCLE = 240;

const SPRITE_W = 109;
const SPRITE_H = 31;
const PLATFORM_FROM_TOP = 0.32;

let cloudImage = null;
let cloudImageReady = false;

// 특수 구름 전용 스프라이트(있으면 사용). platFrac=발판이 스프라이트 높이의 어디쯤(위→아래 비율)
function loadCloudVariant(src, platFrac, wScale) {
  const v = { img: null, ready: false, platFrac, wScale };
  if (typeof Image !== 'undefined') {
    v.img = new Image();
    v.img.onload = () => { v.ready = true; };
    v.img.onerror = () => { v.ready = false; };
    v.img.src = src;
  }
  return v;
}
const VARIANT_SPRITES = {
  [CLOUD_TYPES.BOOST]: loadCloudVariant('assets/cloud-boost.png', 0.47, 1.15),
  [CLOUD_TYPES.BOUNCE]: loadCloudVariant('assets/cloud-bounce.png', 0.58, 1.15),
};

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
    // 페이즈: 실체/투명 상태. 서로 어긋나게 랜덤 위상으로 시작.
    this.phaseT = type === CLOUD_TYPES.PHASE ? Math.random() * PHASE_CYCLE : 0;
    this.isSolid = true;
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

    if (this.type === CLOUD_TYPES.PHASE) {
      this.phaseT += timeScale;
      this.isSolid = (this.phaseT % PHASE_CYCLE) < PHASE_SOLID;
    }

    if (this.broken) {
      this.breakTimer += 1;
    }
  }

  get top() {
    const spriteTop = this.y - this.drawHeight / 2;
    return spriteTop + this.drawHeight * PLATFORM_FROM_TOP;
  }

  draw(ctx, cameraY, scale = 1, altitude = 0, frame = 0) {
    if (this.broken && this.breakTimer > 20) return;

    const screenY = this.y - cameraY;
    let alpha = this.broken ? Math.max(0, 1 - this.breakTimer / 20) : 1;
    // 페이즈: 투명 상태면 흐릿하게(밟을 수 없음). 실체 만료 직전엔 깜빡.
    if (this.type === CLOUD_TYPES.PHASE) {
      if (!this.isSolid) alpha *= 0.22;
      else {
        const p = this.phaseT % PHASE_CYCLE;
        if (p > PHASE_SOLID - 30) alpha *= 0.55 + 0.45 * Math.abs(Math.sin(p * 0.6));
      }
    }
    const w = this.width * scale;
    const h = this.drawHeight * scale;
    const dx = this.x - w / 2;
    const dy = screenY - h / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    const dim = altitude > 0.05
      ? `brightness(${(1 - 0.32 * altitude).toFixed(2)}) saturate(${(1 - 0.2 * altitude).toFixed(2)})`
      : '';

    const variant = VARIANT_SPRITES[this.type];
    if (variant && variant.ready) {
      // 전용 스프라이트(구름 + 이펙트 포함)
      const aspect = variant.img.naturalHeight / variant.img.naturalWidth;
      const dispW = w * variant.wScale;
      const dispH = dispW * aspect;
      const platScreen = screenY - this.drawHeight * scale * 0.18; // 발판(구름 윗면) 화면 y
      const sdx = this.x - dispW / 2;
      const sdy = platScreen - dispH * variant.platFrac;
      ctx.imageSmoothingEnabled = false;
      ctx.filter = dim || 'none';
      ctx.drawImage(variant.img, sdx, sdy, dispW, dispH);
      ctx.filter = 'none';
    } else if (cloudImageReady) {
      const filters = {
        [CLOUD_TYPES.NORMAL]: '',
        [CLOUD_TYPES.MOVING]: 'brightness(1.08) saturate(0.85) hue-rotate(185deg)',
        [CLOUD_TYPES.BREAKING]: 'sepia(0.35) brightness(1.12) saturate(1.2)',
        [CLOUD_TYPES.BOUNCE]: 'drop-shadow(0 0 5px rgba(255,95,168,0.95)) saturate(1.3)',
        [CLOUD_TYPES.BOOST]: 'drop-shadow(0 0 6px rgba(120,220,255,0.95)) brightness(1.05)',
        [CLOUD_TYPES.ICE]: 'brightness(1.12) saturate(0.55) hue-rotate(165deg) drop-shadow(0 0 3px rgba(150,230,255,0.9))',
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
        this._drawBoostMark(ctx, this.x, screenY, w, frame);
      }
    } else {
      this._drawFallback(ctx, screenY, w, h);
    }

    ctx.restore();
  }

  // 부스트 구름 표시: 청록(시안) 상승 화살표 3개 + 반짝이
  _drawBoostMark(ctx, cx, screenY, w, frame = 0) {
    const baseY = screenY - this.drawHeight * 0.18;
    const rise = Math.sin(frame * 0.12) * w * 0.02; // 살짝 위아래 떠오름

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
      const tw = Math.sin(frame * 0.18 + sp.ph);
      if (tw < 0.1) continue;
      const r = w * 0.035 * tw;
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
  const tPhase = clamp((heightScore - 500) / 900); // 페이즈는 500m부터
  const pBreak = 0.10 * tBreak; // 부서짐: 0% → 10%
  const pMove = 0.03 + 0.13 * t; // 이동: 3% → 16%
  const pBounce = 0.03 + 0.07 * t; // 트램펄린(도움): 3% → 10%
  const pBoost = 0.03 + 0.07 * t; // 부스트(도움): 3% → 10%
  const pIce = 0.08 * tIce; // 얼음(미끄럼): 0% → 8%
  const pPhase = 0.07 * tPhase; // 페이즈(깜빡): 0% → 7%

  const roll = Math.random();
  let acc = 0;
  if (roll < (acc += pBreak)) return CLOUD_TYPES.BREAKING;
  if (roll < (acc += pBounce)) return CLOUD_TYPES.BOUNCE;
  if (roll < (acc += pBoost)) return CLOUD_TYPES.BOOST;
  if (roll < (acc += pMove)) return CLOUD_TYPES.MOVING;
  if (roll < (acc += pIce)) return CLOUD_TYPES.ICE;
  if (roll < (acc += pPhase)) return CLOUD_TYPES.PHASE;
  return CLOUD_TYPES.NORMAL;
}

export function randomCloudWidth() {
  const scales = [0.95, 1, 1.05, 1.12];
  const scale = scales[Math.floor(Math.random() * scales.length)];
  return Math.round(CLOUD_DISPLAY_WIDTH * scale);
}

loadCloudSprite();
