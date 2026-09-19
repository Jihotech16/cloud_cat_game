import { Cloud, CLOUD_TYPES } from './cloud.js';

let sprite = null;
let ready = false;
if (typeof Image !== 'undefined') {
  sprite = new Image();
  sprite.onload = () => { ready = sprite.naturalWidth === 640 && sprite.naturalHeight === 93; };
  sprite.src = 'assets/balloon-whale-sheet.png';
}

// 화면에 그려질 고래 폭. 충돌 폭(super 의 width)도 같은 비율로 맞춘다.
const DISPLAY_WIDTH = 130;
const BODY_WIDTH = Math.round(DISPLAY_WIDTH * 0.62); // 몸통만 충돌(꼬리는 통과)
// 풍선처럼 천천히 떠오른다. 너무 많이 오르면 위 구름과 간격이 틀어지므로 한계를 둔다.
const RISE_SPEED = 0.12;
const RISE_LIMIT = 60;
// 부딪히면 놀라서 위로 달아난다. 달아나는 동안에는 발판도 장애물도 아니다.
const FLEE_ACCEL = 0.35;
const FLEE_MAX_SPEED = 9;
const FLEE_DESPAWN = 1800; // 이만큼 올라가면 목록에서 지운다

// A solid, non-damaging platform. The small tail is deliberately non-solid.
export class BalloonWhale extends Cloud {
  constructor(x, y) {
    super(x, y, CLOUD_TYPES.WHALE, BODY_WIDTH);
    this.displayWidth = DISPLAY_WIDTH;
    this.displayHeight = DISPLAY_WIDTH * 93 / 160;
    this.risen = 0;
    this.fleeing = false;
    this.fleeSpeed = 0;
    this.fleeDistance = 0;
    this.dead = false;
    this.vx = Math.random() < 0.5 ? -0.35 : 0.35;
    this.homeX = null;
    this.deltaX = 0;
    this.awakeTicks = 0;
    this.age = Math.random() * 132;
  }

  get top() { return this.y - this.displayHeight * 0.42; }
  get belly() { return this.y + this.displayHeight * 0.4; }

  update(worldWidth, timeScale = 1) {
    if (this.fleeing) {
      this.fleeSpeed = Math.min(FLEE_MAX_SPEED, this.fleeSpeed + FLEE_ACCEL * timeScale);
      const rise = this.fleeSpeed * timeScale;
      this.y -= rise;
      this.fleeDistance += rise;
      this.deltaX = 0;
      this.age += timeScale;
      this.awakeTicks = Math.max(0, this.awakeTicks - timeScale);
      if (this.fleeDistance > FLEE_DESPAWN) this.dead = true;
      return;
    }
    if (this.homeX === null) this.homeX = this.x;
    const previousX = this.x;
    const low = Math.max(this.displayWidth * 0.6, this.homeX - 28);
    const high = Math.min(worldWidth - this.displayWidth * 0.4, this.homeX + 28);
    this.x = Math.max(low, Math.min(high, this.x + this.vx * timeScale));
    if (this.x <= low) this.vx = Math.abs(this.vx);
    if (this.x >= high) this.vx = -Math.abs(this.vx);
    this.deltaX = this.x - previousX;
    // 풍선답게 조금씩 떠오른다(한계까지만). 올라탄 고양이는 발판 높이를 따라간다.
    if (this.risen < RISE_LIMIT) {
      const rise = Math.min(RISE_SPEED * timeScale, RISE_LIMIT - this.risen);
      this.y -= rise;
      this.risen += rise;
    }
    this.age += timeScale;
    this.awakeTicks = Math.max(0, this.awakeTicks - timeScale);
  }

  visualBounds() {
    return {
      left: this.x - this.displayWidth * 0.6 - 28,
      right: this.x + this.displayWidth * 0.4 + 28,
      top: this.y - this.displayHeight / 2,
      bottom: this.y + this.displayHeight / 2,
    };
  }

  wake() { this.awakeTicks = 24; }

  // Sweep the player's visible body against the torso, including whale movement.
  // This prevents fast upward jumps from tunnelling through the belly.
  contact(player, previous) {
    const half = player.width * 0.3;
    const head = player.height * 0.36;
    const feet = player.bottom - player.y;
    const left = -this.width / 2 - half;
    const right = this.width / 2 + half;
    const top = this.top - feet;
    const bottom = this.belly + head;
    const x = previous.x - (this.x - this.deltaX);
    const y = previous.y;
    const dx = player.x - previous.x - this.deltaX;
    const dy = player.y - previous.y;
    let enter = -Infinity, leave = Infinity, side = null;
    for (const [position, speed, min, max, nearSide, farSide] of [
      [x, dx, left, right, 'left', 'right'],
      [y, dy, top, bottom, 'top', 'bottom'],
    ]) {
      if (Math.abs(speed) < 1e-9) {
        if (position <= min || position >= max) return null;
        continue;
      }
      const a = (min - position) / speed;
      const b = (max - position) / speed;
      const near = Math.min(a, b);
      if (near > enter) { enter = near; side = speed > 0 ? nearSide : farSide; }
      leave = Math.min(leave, Math.max(a, b));
    }
    if (enter < -1e-7 || enter > 1 || enter > leave || leave < 0) return null;
    return { side, time: Math.max(0, enter), half, head };
  }

  // 부딪힌 순간부터 위로 달아난다(발판·장애물 판정 해제).
  flee() {
    if (this.fleeing) return;
    this.fleeing = true;
    this.isSolid = false;
    this.wake();
  }

  deflect(player, hit) {
    this.wake();
    player.groundedCloud = null;
    player.onGround = false;
    player.charging = false;
    player.chargeLevel = 0;
    player.trail.length = 0;
    if (hit.side === 'bottom') {
      player.y = this.belly + hit.head + 0.5;
      player.vy = Math.max(2.2, Math.min(5, Math.abs(player.vy) * 0.3));
      player.squash = 0.16;
    } else {
      const direction = hit.side === 'left' ? -1 : 1;
      player.x = this.x + direction * (this.width / 2 + hit.half + 0.5);
      player.vx = direction * Math.max(2.5, Math.abs(player.vx) * 0.65);
      player.facing = direction;
      player.wallBounced = true;
    }
    player.jumpPeakVy = Math.max(player.jumpPeakVy, 1);
    this.flee();
  }

  draw(ctx, cameraY) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const frame = this.awakeTicks > 0 ? 3 : Math.floor(this.age / 44) % 3;
    if (ready) {
      ctx.drawImage(sprite, frame * 160, 0, 160, 93,
        this.x - this.displayWidth * 0.6, this.y - cameraY - this.displayHeight / 2,
        this.displayWidth, this.displayHeight);
    } else {
      ctx.fillStyle = '#91c8eb';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - cameraY, this.width / 2, this.displayHeight * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
