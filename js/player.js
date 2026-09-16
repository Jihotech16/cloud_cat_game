import {
  PLAYER_SIZE,
  PLAYER_FEET_INSET,
  PLAYER_BASE_SPEED,
} from './config.js';

const FRAME_SIZE = 128;
const JUMP_READY_FRAME_COUNT = 3;
const JUMPING_FRAME_COUNT = 4;

// 복장(스킨)별 스프라이트. 모든 시트는 128px 정사각 프레임 규격을 따른다.
// idle 이 없으면 준비 동작(ready) 첫 프레임(똑바로 선 자세)을 대기 그림으로 쓴다.
// *Dy 는 발끝을 기본 고양이와 맞추기 위한 세로 보정(원본 128px 기준, 음수 = 위로).
const SKIN_SPRITES = {
  default: {
    idle: 'assets/cat.png',
    ready: 'assets/cat_jumpready.png',
    jumping: 'assets/cat_jumping.png',
    idleDy: 0,
    readyDy: [0, 0, 0],
    jumpingDy: 0,
  },
  // 마녀 고양이는 모자까지 한 칸에 담느라 발끝이 기본 고양이보다 아래에 있다
  // (선 자세 발끝 y 119, 기본 113~116). 그대로 그리면 구름에 파묻혀 보여서 프레임마다 올린다.
  witch: {
    idle: null,
    ready: 'assets/cat-witch-jumpready.png',
    jumping: 'assets/cat-witch-jumping.png',
    idleDy: -6,
    readyDy: [-6, -5, -3],
    jumpingDy: 3,
  },
  // 구름 잠옷 고양이도 수면모자 때문에 발끝이 2~4px 낮다(발끝 y 115, 기본 112~115).
  pajamas: {
    idle: null,
    ready: 'assets/cat-cloud-pajamas-jumpready.png',
    jumping: 'assets/cat-cloud-pajamas-jumping.png',
    idleDy: -3,
    readyDy: [-3, -2, 0],
    jumpingDy: -3,
  },
};

const loaded = {};

function loadImage(src) {
  const entry = { img: null, ready: false };
  if (!src || typeof Image === 'undefined') return entry;
  entry.img = new Image();
  entry.img.onload = () => { entry.ready = true; };
  entry.img.src = src;
  return entry;
}

function spritesFor(id) {
  if (!loaded[id]) {
    const def = SKIN_SPRITES[id] ?? SKIN_SPRITES.default;
    loaded[id] = {
      def,
      idle: loadImage(def.idle),
      ready: loadImage(def.ready),
      jumping: loadImage(def.jumping),
    };
  }
  return loaded[id];
}

let currentSkin = 'default';

// 착용 복장을 바꾼다. 이미지는 처음 쓸 때 불러오고, 다 불러오기 전에는 기본 고양이로 그린다.
export function setPlayerSkin(id) {
  currentSkin = SKIN_SPRITES[id] ? id : 'default';
  spritesFor(currentSkin);
}

export function isCatSpriteReady() {
  return spritesFor('default').idle.ready;
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

    // 착용 복장이 아직 안 불러와졌으면 기본 고양이로 그린다.
    const skin = spritesFor(currentSkin);
    const base = spritesFor('default');
    const pick = (key) => (skin[key].ready ? skin : base);
    const unit = size / FRAME_SIZE;

    // 대기(선 자세) 그림. idle 이미지가 없는 복장은 준비 동작 첫 프레임을 쓴다.
    const drawIdle = () => {
      const idleSet = skin.def.idle ? pick('idle') : pick('ready');
      if (idleSet.def.idle) {
        if (!idleSet.idle.ready) return false;
        ctx.drawImage(idleSet.idle.img, -size / 2, -size / 2 + idleSet.def.idleDy * unit, size, size);
      } else {
        ctx.drawImage(
          idleSet.ready.img,
          0, 0, FRAME_SIZE, FRAME_SIZE,
          -size / 2, -size / 2 + idleSet.def.idleDy * unit, size, size,
        );
      }
      return true;
    };

    // 잔상(모션 트레일): 최근 위치에 흐릿한 실루엣
    if (this.trail.length && base.idle.ready) {
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
        drawIdle();
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

    const readySet = pick('ready');
    const jumpingSet = pick('jumping');
    const useReady = this.charging && this.groundedCloud && readySet.ready.ready;
    const useJumping = this._isInAir() && jumpingSet.jumping.ready;
    if (useReady) {
      const frame = this._getReadyFrame();
      ctx.drawImage(
        readySet.ready.img,
        frame * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE,
        -size / 2, -size / 2 + (readySet.def.readyDy[frame] ?? 0) * unit, size, size,
      );
    } else if (useJumping) {
      const frame = this._getJumpingFrame();
      ctx.drawImage(
        jumpingSet.jumping.img,
        frame * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE,
        -size / 2, -size / 2 + jumpingSet.def.jumpingDy * unit, size, size,
      );
    } else if (!drawIdle()) {
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

spritesFor('default');
