import { CLOUD_DISPLAY_WIDTH, CLOUD_MOVE_SPEED } from './config.js';

export const CLOUD_TYPES = {
  NORMAL: 'normal',
  MOVING: 'moving',
  BREAKING: 'breaking',
  BOUNCE: 'bounce',
  BOOST: 'boost',
};

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
    const alpha = this.broken ? Math.max(0, 1 - this.breakTimer / 20) : 1;
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
  // 아주 천천히 변하도록 긴 구간에 걸쳐 특수 구름이 늘어난다.
  const t = Math.min(1, Math.max(0, (heightScore - 80) / 1120)); // 80m → 1200m
  const tBreak = Math.min(1, Math.max(0, (heightScore - 200) / 1000)); // 부서짐은 200m부터
  const pBreak = 0.10 * tBreak; // 부서짐: 0% → 10% (가장 방해되므로 가장 늦게)
  const pMove = 0.03 + 0.14 * t; // 이동: 3% → 17%
  const pBounce = 0.03 + 0.07 * t; // 트램펄린(도움): 3% → 10%
  const pBoost = 0.03 + 0.07 * t; // 부스트(도움): 3% → 10%

  const roll = Math.random();
  if (roll < pBreak) return CLOUD_TYPES.BREAKING;
  if (roll < pBreak + pBounce) return CLOUD_TYPES.BOUNCE;
  if (roll < pBreak + pBounce + pBoost) return CLOUD_TYPES.BOOST;
  if (roll < pBreak + pBounce + pBoost + pMove) return CLOUD_TYPES.MOVING;
  return CLOUD_TYPES.NORMAL;
}

export function randomCloudWidth() {
  const scales = [0.95, 1, 1.05, 1.12];
  const scale = scales[Math.floor(Math.random() * scales.length)];
  return Math.round(CLOUD_DISPLAY_WIDTH * scale);
}

loadCloudSprite();
