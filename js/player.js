import {
  PLAYER_SIZE,
  PLAYER_FEET_INSET,
  PLAYER_BASE_SPEED,
} from './config.js';

const JUMP_READY_FRAME_SIZE = 128;
const JUMP_READY_FRAME_COUNT = 3;
const JUMPING_FRAME_SIZE = 128;
const JUMPING_FRAME_COUNT = 4;
const JUMPING_FRAME_DURATION = 7;

let catImage = null;
let catImageReady = false;
let jumpReadyImage = null;
let jumpReadyImageReady = false;
let jumpingImage = null;
let jumpingImageReady = false;

export function loadCatSprite() {
  if (catImage) return catImage;
  catImage = new Image();
  catImage.src = 'assets/cat.png';
  catImage.onload = () => {
    catImageReady = true;
  };
  return catImage;
}

export function loadJumpReadySprite() {
  if (jumpReadyImage) return jumpReadyImage;
  jumpReadyImage = new Image();
  jumpReadyImage.src = 'assets/cat_jumpready.png';
  jumpReadyImage.onload = () => {
    jumpReadyImageReady = true;
  };
  return jumpReadyImage;
}

export function loadJumpingSprite() {
  if (jumpingImage) return jumpingImage;
  jumpingImage = new Image();
  jumpingImage.src = 'assets/cat_jumping.png';
  jumpingImage.onload = () => {
    jumpingImageReady = true;
  };
  return jumpingImage;
}

export function isCatSpriteReady() {
  return catImageReady;
}

export class Player {
  static DISPLAY_SIZE = PLAYER_SIZE;
  static FEET_INSET = PLAYER_FEET_INSET;

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = Player.DISPLAY_SIZE;
    this.height = Player.DISPLAY_SIZE;
    this.facing = 1;
    this.onGround = false;
    this.groundedCloud = null;
    this.baseSpeed = PLAYER_BASE_SPEED;
    this.charging = false;
    this.chargeLevel = 0;
    this.airTime = 0;
  }

  get left() {
    return this.x - this.width / 2;
  }

  get right() {
    return this.x + this.width / 2;
  }

  get bottom() {
    return this.y + this.height / 2 - Player.FEET_INSET;
  }

  alignFeetTo(platformTop) {
    this.y = platformTop - (this.height / 2 - Player.FEET_INSET);
  }

  applyWallBounce(worldWidth) {
    const half = this.width / 2;
    const speed = Math.max(Math.abs(this.vx), this.baseSpeed);

    if (this.x < half) {
      this.x = half;
      this.vx = speed;
      this.facing = 1;
    } else if (this.x > worldWidth - half) {
      this.x = worldWidth - half;
      this.vx = -speed;
      this.facing = -1;
    } else if (this.vx !== 0) {
      this.facing = this.vx > 0 ? 1 : -1;
    }
  }

  update(gravity, worldWidth) {
    this.vy += gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.airTime += 1;

    this.applyWallBounce(worldWidth);

    this.onGround = false;
  }

  bounce(jumpForce) {
    this.vy = -jumpForce;
    this.onGround = false;
    this.groundedCloud = null;
    this.charging = false;
    this.chargeLevel = 0;
    this.airTime = 0;
  }

  _getReadyFrame() {
    if (this.chargeLevel < 0.34) return 0;
    if (this.chargeLevel < 0.67) return 1;
    return 2;
  }

  _getJumpingFrame() {
    const frame = Math.floor(this.airTime / JUMPING_FRAME_DURATION);
    return Math.min(JUMPING_FRAME_COUNT - 1, frame);
  }

  draw(ctx, cameraY) {
    const screenY = this.y - cameraY;
    const size = Player.DISPLAY_SIZE;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(this.x, screenY);
    const faceRight = this.vx !== 0 ? this.vx > 0 : this.facing > 0;
    if (faceRight) ctx.scale(-1, 1);

    const useReady = this.charging && jumpReadyImageReady;
    const useJumping = !this.groundedCloud && !useReady && jumpingImageReady;
    if (useReady) {
      const frame = this._getReadyFrame();
      const sx = frame * JUMP_READY_FRAME_SIZE;
      ctx.drawImage(
        jumpReadyImage,
        sx, 0, JUMP_READY_FRAME_SIZE, JUMP_READY_FRAME_SIZE,
        -size / 2, -size / 2, size, size,
      );
    } else if (useJumping) {
      const frame = this._getJumpingFrame();
      const sx = frame * JUMPING_FRAME_SIZE;
      ctx.drawImage(
        jumpingImage,
        sx, 0, JUMPING_FRAME_SIZE, JUMPING_FRAME_SIZE,
        -size / 2, -size / 2, size, size,
      );
    } else if (catImageReady) {
      ctx.drawImage(catImage, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

loadCatSprite();
loadJumpReadySprite();
loadJumpingSprite();
