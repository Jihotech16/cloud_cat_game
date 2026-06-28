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

  draw(ctx, cameraY, scale = 1, altitude = 0) {
    if (this.broken && this.breakTimer > 20) return;

    const screenY = this.y - cameraY;
    const alpha = this.broken ? Math.max(0, 1 - this.breakTimer / 20) : 1;
    const w = this.width * scale;
    const h = this.drawHeight * scale;
    const dx = this.x - w / 2;
    const dy = screenY - h / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (cloudImageReady) {
      const filters = {
        [CLOUD_TYPES.NORMAL]: '',
        [CLOUD_TYPES.MOVING]: 'brightness(1.08) saturate(0.85) hue-rotate(185deg)',
        [CLOUD_TYPES.BREAKING]: 'sepia(0.35) brightness(1.12) saturate(1.2)',
        [CLOUD_TYPES.BOUNCE]: 'drop-shadow(0 0 5px rgba(255,95,168,0.95)) saturate(1.3)',
        [CLOUD_TYPES.BOOST]: 'drop-shadow(0 0 5px rgba(120,230,90,0.95)) saturate(1.2)',
      };
      // 고도가 오르면 구름도 어둑하게(밤·우주 분위기)
      let filter = filters[this.type] ?? '';
      if (altitude > 0.05) {
        const dim = `brightness(${(1 - 0.32 * altitude).toFixed(2)}) saturate(${(1 - 0.2 * altitude).toFixed(2)})`;
        filter = filter ? `${filter} ${dim}` : dim;
      }
      ctx.filter = filter || 'none';
      ctx.drawImage(cloudImage, dx, dy, w, h);
      ctx.filter = 'none';
    } else {
      this._drawFallback(ctx, screenY, w, h);
    }

    if (this.type === CLOUD_TYPES.BOUNCE) {
      this._drawBounceMark(ctx, this.x, screenY, w);
    } else if (this.type === CLOUD_TYPES.BOOST) {
      this._drawBoostMark(ctx, this.x, screenY, w);
    }

    ctx.restore();
  }

  // 부스트 구름 표시: 초록 위쪽 화살표 + 1.5×
  _drawBoostMark(ctx, cx, screenY, w) {
    const s = w * 0.13;
    const topY = screenY - this.drawHeight * 0.12;
    ctx.save();
    ctx.fillStyle = '#43c728';
    ctx.beginPath();
    ctx.moveTo(cx, topY - s);
    ctx.lineTo(cx - s, topY + s * 0.5);
    ctx.lineTo(cx - s * 0.4, topY + s * 0.5);
    ctx.lineTo(cx - s * 0.4, topY + s * 1.1);
    ctx.lineTo(cx + s * 0.4, topY + s * 1.1);
    ctx.lineTo(cx + s * 0.4, topY + s * 0.5);
    ctx.lineTo(cx + s, topY + s * 0.5);
    ctx.closePath();
    ctx.fill();
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
  // 고도가 오를수록 특수 구름 비율이 늘어 다양해진다.
  const t = Math.min(1, heightScore / 600);
  const pBreak = 0.05 + 0.10 * t; // 5% → 15%
  const pBounce = 0.05 + 0.08 * t; // 5% → 13%
  const pBoost = 0.05 + 0.08 * t; // 5% → 13%
  const pMove = 0.10 + 0.15 * t; // 10% → 25%

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
