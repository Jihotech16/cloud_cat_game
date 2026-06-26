import { CLOUD_DISPLAY_WIDTH, CLOUD_MOVE_SPEED } from './config.js';

export const CLOUD_TYPES = {
  NORMAL: 'normal',
  MOVING: 'moving',
  BREAKING: 'breaking',
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

  update(worldWidth) {
    if (this.type === CLOUD_TYPES.MOVING) {
      this.x += this.vx;
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

  draw(ctx, cameraY) {
    if (this.broken && this.breakTimer > 20) return;

    const screenY = this.y - cameraY;
    const alpha = this.broken ? Math.max(0, 1 - this.breakTimer / 20) : 1;
    const w = this.width;
    const h = this.drawHeight;
    const dx = this.x - w / 2;
    const dy = screenY - h / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (cloudImageReady) {
      const filters = {
        [CLOUD_TYPES.NORMAL]: 'none',
        [CLOUD_TYPES.MOVING]: 'brightness(1.08) saturate(0.85) hue-rotate(185deg)',
        [CLOUD_TYPES.BREAKING]: 'sepia(0.35) brightness(1.12) saturate(1.2)',
      };
      ctx.filter = filters[this.type];
      ctx.drawImage(cloudImage, dx, dy, w, h);
      ctx.filter = 'none';
    } else {
      this._drawFallback(ctx, screenY, w, h);
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
  const roll = Math.random();
  if (heightScore > 300 && roll < 0.12) return CLOUD_TYPES.BREAKING;
  if (heightScore > 150 && roll < 0.25) return CLOUD_TYPES.MOVING;
  return CLOUD_TYPES.NORMAL;
}

export function randomCloudWidth() {
  const scales = [0.95, 1, 1.05, 1.12];
  const scale = scales[Math.floor(Math.random() * scales.length)];
  return Math.round(CLOUD_DISPLAY_WIDTH * scale);
}

loadCloudSprite();
