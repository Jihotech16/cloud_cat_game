import {
  PLAYER_SIZE,
  PLAYER_FEET_INSET,
  PLAYER_BASE_SPEED,
} from './config.js';

const JUMP_READY_FRAME_SIZE = 128;
const JUMP_READY_FRAME_COUNT = 3;
const JUMPING_FRAME_SIZE = 128;
const JUMPING_FRAME_COUNT = 4;

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
    this.jumpPeakVy = 0;
    this.wallBounced = false; // 이번 비행 중 벽에 반사됐는지
    this.squash = 0;   // +면 착지(납작), -면 점프(길쭉). 매 프레임 0으로 감쇠.
    this.trail = [];   // 빠르게 상승/하강 시 잔상용 최근 위치
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
      this.wallBounced = true;
    } else if (this.x > worldWidth - half) {
      this.x = worldWidth - half;
      this.vx = -speed;
      this.facing = -1;
      this.wallBounced = true;
    } else if (this.vx !== 0) {
      this.facing = this.vx > 0 ? 1 : -1;
    }
  }

  update(gravity, worldWidth, timeScale = 1) {
    this.vy += gravity * timeScale;
    this.x += this.vx * timeScale;
    this.y += this.vy * timeScale;

    this.applyWallBounce(worldWidth);

    this.onGround = false;
  }

  bounce(jumpForce) {
    this.vy = -jumpForce;
    this.onGround = false;
    this.groundedCloud = null;
    this.charging = false;
    this.chargeLevel = 0;
    this.jumpPeakVy = jumpForce;
    this.wallBounced = false; // 새 비행 시작 — 벽 반사 기록 초기화
    this.squash = -0.32; // 점프 순간 길쭉하게
    this.trail.length = 0;
  }

  land() {
    this.jumpPeakVy = 0;
    this.squash = 0.42; // 착지 순간 납작하게
    this.trail.length = 0;
  }

  // 매 프레임 호출: 스쿼시 감쇠 + 잔상 갱신.
  tickAnim(timeScale = 1) {
    // 0을 향해 부드럽게 복귀
    this.squash *= Math.pow(0.72, timeScale);
    if (Math.abs(this.squash) < 0.01) this.squash = 0;

    // 공중에서 빠르게 움직일 때만 잔상 남김
    const fast = !this.groundedCloud && Math.abs(this.vy) > 6;
    if (fast) {
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 4) this.trail.pop();
    } else if (this.trail.length) {
      this.trail.pop();
    }
  }

  _getReadyFrame() {
    if (this.chargeLevel < 0.34) return 0;
    if (this.chargeLevel < 0.67) return 1;
    return 2;
  }

  _getJumpingFrame() {
    const peak = this.jumpPeakVy;
    if (!peak) return 0;

    // 점프 궤적에 맞춰 4프레임: 발사 → 상승 → 정점 → 하강
    if (this.vy <= -peak * 0.55) return 0;
    if (this.vy < 0) return 1;
    if (this.vy < peak * 0.45) return 2;
    return 3;
  }

  _isInAir() {
    return this.jumpPeakVy > 0 && !this.groundedCloud;
  }

  draw(ctx, cameraY) {
    const screenY = this.y - cameraY;
    const size = Player.DISPLAY_SIZE;
    const faceRight = this.vx !== 0 ? this.vx > 0 : this.facing > 0;

    // 잔상(모션 트레일): 최근 위치에 흐릿한 실루엣
    if (this.trail.length && catImageReady) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const t = this.trail[i];
        const a = 0.16 * (1 - i / (this.trail.length + 1));
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(t.x, t.y - cameraY);
        if (faceRight) ctx.scale(-1, 1);
        ctx.drawImage(catImage, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(this.x, screenY);
    // 스쿼시&스트레치 — 발밑을 기준으로 눌리고 늘어난다.
    if (this.squash !== 0) {
      const footY = size / 2 - Player.FEET_INSET;
      ctx.translate(0, footY);
      ctx.scale(1 + this.squash * 0.45, 1 - this.squash * 0.45);
      ctx.translate(0, -footY);
    }
    if (faceRight) ctx.scale(-1, 1);

    const useReady = this.charging && this.groundedCloud && jumpReadyImageReady;
    const useJumping = this._isInAir() && jumpingImageReady;
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
