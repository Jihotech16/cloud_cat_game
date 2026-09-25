import {
  PLAYER_SIZE,
  PLAYER_FEET_INSET,
  PLAYER_BASE_SPEED,
} from './config.js';

const FRAME_SIZE = 128;
const JUMP_READY_FRAME_COUNT = 3;
const JUMPING_FRAME_COUNT = 4;
// 대기 애니메이션(기본 4프레임): 눈을 뜨고 머물다가 짧게 깜빡인다.
// 복장마다 idleDurations 로 프레임 수·길이를 바꿀 수 있다(비눗방울 고양이는 8프레임).
const IDLE_FRAME_DURATIONS = [1100, 550, 120, 650];
const sumMs = (list) => list.reduce((sum, ms) => sum + ms, 0);

// 비눗방울 고양이 특수 동작. 시간(ms)은 게임 속도에 맞춰 원본 그림보다 빠르게 잡았다.
// float 시트(128px, 4×3): 0~8 = 불고 들어가기(부는 단계에 한 번), 9~11 = 방울 안에서 떠다니기(반복).
// pop 시트(208px, 4×2): 방울이 터지고 놀라며 떨어진다(한 번).
const BUBBLE_BLOW_MS = [98, 136, 153, 164, 191, 164, 98, 87, 109]; // 합 1.2초 = BUBBLE_BLOW_FRAMES
const BUBBLE_FLOAT_LOOP = [9, 10, 11];
const BUBBLE_FLOAT_FRAME_MS = 350;
const BUBBLE_POP_MS = [100, 80, 80, 100, 100, 120, 150, 300];
// float 시트 첫 프레임의 고양이(머리 가운데 x 69.5, 발끝 y 122)를 보통 그림(가운데 ~66, 발끝 112)에 맞춘다.
const BUBBLE_FLOAT_DX = -3.5;
const BUBBLE_FLOAT_DY = -10;
// pop 시트는 방울 속 고양이가 float 시트보다 (35, 92)px 오른쪽 아래에 그려져 있다.
const BUBBLE_POP_OFFSET_X = 35;
const BUBBLE_POP_OFFSET_Y = 92;

function frameAt(durations, ms) {
  let elapsed = ms;
  for (let i = 0; i < durations.length; i++) {
    if (elapsed < durations[i]) return i;
    elapsed -= durations[i];
  }
  return -1; // 끝남
}
const IDLE_SHEET_FEET_Y = 112; // 대기 시트는 세 복장 모두 발끝이 이 줄에 맞춰져 있다

// 복장(스킨)별 스프라이트. 모든 시트는 128px 정사각 프레임 규격을 따른다.
// 대기 그림은 idleSheet(4프레임 깜빡임) → idle(한 장) → 준비 동작 첫 프레임 순으로 쓴다.
// *Dy 는 발끝을 기본 고양이와 맞추기 위한 세로 보정(원본 128px 기준, 음수 = 위로).
// idleSheetDx/Dy 는 대기 시트를 준비 동작 첫 프레임 위치에 맞추는 보정이다. 대기 시트는
// 세 복장 모두 발끝 y 112 로 가지런히 그려져 있는데, 준비 동작과 위치가 다르면
// 꾹 누르는 순간 고양이가 옆으로 튀어 보인다.
const SKIN_SPRITES = {
  default: {
    idleSheet: 'assets/cat-idle-sheet.png',
    idleSheetDx: 9, // 대기 시트가 기존 그림(cat.png·준비 첫 프레임)보다 9px 왼쪽에 있다
    idleSheetDy: 1,
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
    idleSheet: 'assets/cat-witch-idle-sheet.png',
    idleSheetDx: 2,
    idleSheetDy: 1,
    idle: null,
    ready: 'assets/cat-witch-jumpready.png',
    jumping: 'assets/cat-witch-jumping.png',
    idleDy: -6,
    readyDy: [-6, -5, -3],
    jumpingDy: 3,
  },
  // 구름 잠옷 고양이도 수면모자 때문에 발끝이 2~4px 낮다(발끝 y 115, 기본 112~115).
  pajamas: {
    idleSheet: 'assets/cat-cloud-pajamas-idle-sheet.png',
    idleSheetDx: 0,
    idleSheetDy: 1,
    // 잠옷 대기 시트는 고양이가 작게 그려져 있다(눈 사이 26px, 점프 준비 31px·점프 30px).
    // 서 있다 뛰는 순간 커져 보이지 않도록 발끝 기준으로 키운다.
    idleSheetScale: 1.15,
    idle: null,
    ready: 'assets/cat-cloud-pajamas-jumpready.png',
    jumping: 'assets/cat-cloud-pajamas-jumping.png',
    idleDy: -3,
    readyDy: [-3, -2, 0],
    jumpingDy: -3,
  },
  // 비눗방울 고양이: 대기 중에 작은 비눗방울을 분다(8프레임). 그림이 칸 가운데보다 왼쪽에 있어
  // 대기·준비 그림을 8px 오른쪽으로 옮겨 다른 고양이와 같은 자리에 선다.
  bubble: {
    idleSheet: 'assets/cat-bubble-idle-sheet.png',
    idleDurations: [900, 200, 250, 300, 250, 300, 300, 600],
    idleSheetDx: 8,
    idleSheetDy: 1,
    idle: null,
    ready: 'assets/cat-bubble-jumpready.png',
    jumping: 'assets/cat-bubble-jumping.png',
    idleDy: 0,
    readyDx: 8,
    readyDy: [0, 0, 0],
    jumpingDy: 0,
    float: 'assets/cat-bubble-float-sheet.png',
    pop: 'assets/cat-bubble-pop-sheet.png',
  },
};

const loaded = {};

function idleDurationsOf(def) {
  return def.idleDurations ?? IDLE_FRAME_DURATIONS;
}

// size 를 주면 그 크기가 맞을 때만 ready 로 본다(규격이 틀린 시트는 쓰지 않고 다음 그림으로 대체).
function loadImage(src, size = null) {
  const entry = { img: null, ready: false };
  if (!src || typeof Image === 'undefined') return entry;
  entry.img = new Image();
  entry.img.onload = () => {
    entry.ready = !size
      || (entry.img.naturalWidth === size.w && entry.img.naturalHeight === size.h);
  };
  entry.img.src = src;
  return entry;
}

function spritesFor(id) {
  if (!loaded[id]) {
    const def = SKIN_SPRITES[id] ?? SKIN_SPRITES.default;
    loaded[id] = {
      def,
      idleSheet: loadImage(def.idleSheet, { w: FRAME_SIZE * idleDurationsOf(def).length, h: FRAME_SIZE }),
      idle: loadImage(def.idle),
      ready: loadImage(def.ready),
      jumping: loadImage(def.jumping),
      float: loadImage(def.float),
      pop: loadImage(def.pop),
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
    this.idleElapsedMs = 0; // 대기 애니메이션 진행 시간(서 있을 때만 흐른다)
    this.bubbleAnim = null; // 비눗방울 고양이 특수 동작 { phase: 'blow'|'float'|'pop', t(게임 프레임) }
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
    // 대기 애니메이션: 차지 중이거나 공중이면 처음(눈 뜬 프레임)으로 되돌린다.
    if (this.charging || this._isInAir()) {
      this.idleElapsedMs = 0;
    } else {
      this.idleElapsedMs = (this.idleElapsedMs + (1000 / 60) * timeScale)
        % sumMs(idleDurationsOf(spritesFor(currentSkin).idleSheet.ready ? spritesFor(currentSkin).def : SKIN_SPRITES.default));
    }
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

  _getIdleFrame(def) {
    const frame = frameAt(idleDurationsOf(def), this.idleElapsedMs);
    return frame < 0 ? 0 : frame;
  }

  // 비눗방울 특수 동작: 그릴 시트와 프레임. 없거나 끝났으면 null(보통 그림으로 그린다).
  _bubbleFrame() {
    const anim = this.bubbleAnim;
    if (!anim) return null;
    const ms = anim.t * (1000 / 60);
    if (anim.phase === 'blow') {
      const f = frameAt(BUBBLE_BLOW_MS, ms);
      return { sheet: 'float', frame: f < 0 ? BUBBLE_BLOW_MS.length - 1 : f };
    }
    if (anim.phase === 'float') {
      const i = Math.floor(ms / BUBBLE_FLOAT_FRAME_MS) % BUBBLE_FLOAT_LOOP.length;
      return { sheet: 'float', frame: BUBBLE_FLOAT_LOOP[i] };
    }
    const f = frameAt(BUBBLE_POP_MS, ms);
    return f < 0 ? null : { sheet: 'pop', frame: f };
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

    // 대기(선 자세) 그림. 깜빡임 시트 → 한 장짜리 idle → 준비 동작 첫 프레임 순으로 쓴다.
    // animate=false 면 첫 프레임만(잔상용).
    const drawIdle = (animate = true) => {
      const sheetSet = pick('idleSheet');
      if (sheetSet.idleSheet.ready) {
        const frame = animate ? this._getIdleFrame(sheetSet.def) : 0;
        const { idleSheetDx = 0, idleSheetDy = 0, idleSheetScale = 1 } = sheetSet.def;
        // 발끝 위치는 그대로 두고 가운데를 기준으로 키운다.
        const feetY = -size / 2 + (IDLE_SHEET_FEET_Y + idleSheetDy) * unit;
        const drawSize = size * idleSheetScale;
        ctx.drawImage(
          sheetSet.idleSheet.img,
          frame * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE,
          idleSheetDx * unit - drawSize / 2,
          feetY - IDLE_SHEET_FEET_Y * unit * idleSheetScale,
          drawSize, drawSize,
        );
        return true;
      }
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
        drawIdle(false);
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(this.x, screenY);

    // 비눗방울 고양이 특수 동작(불기·방울 속 부양·터짐)은 전용 시트로 그린다.
    const bubble = this._bubbleFrame();
    const bubbleSheet = bubble && skin[bubble.sheet]?.ready ? skin[bubble.sheet] : null;
    if (bubbleSheet) {
      if (faceRight) ctx.scale(-1, 1);
      const floatX = -size / 2 + BUBBLE_FLOAT_DX * unit;
      const floatY = -size / 2 + BUBBLE_FLOAT_DY * unit;
      if (bubble.sheet === 'float') {
        const col = bubble.frame % 4;
        const row = Math.floor(bubble.frame / 4);
        ctx.drawImage(bubbleSheet.img, col * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE,
          floatX, floatY, size, size);
      } else {
        const cell = 208;
        const col = bubble.frame % 4;
        const row = Math.floor(bubble.frame / 4);
        ctx.drawImage(bubbleSheet.img, col * cell, row * cell, cell, cell,
          floatX - BUBBLE_POP_OFFSET_X * unit, floatY - BUBBLE_POP_OFFSET_Y * unit, cell * unit, cell * unit);
      }
      ctx.restore();
      return;
    }

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
        -size / 2 + (readySet.def.readyDx ?? 0) * unit, -size / 2 + (readySet.def.readyDy[frame] ?? 0) * unit, size, size,
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
