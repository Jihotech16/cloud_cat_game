// 게임 중에 가끔 떠 있는 코인(발바닥 금화). 먹으면 그 판의 코인이 는다.
// 오브와 달리 두 모드 모두에 나오고, 게이지·보상과는 무관하다.
import { COIN_PICKUP_RADIUS } from './config.js';

let sprite = null;
let spriteReady = false;
if (typeof Image !== 'undefined') {
  sprite = new Image();
  sprite.onload = () => { spriteReady = true; };
  sprite.onerror = () => { spriteReady = false; };
  sprite.src = 'assets/coin-paw-64.png';
}

export class CoinPickup {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = COIN_PICKUP_RADIUS;
    this.collected = false;
    this.phase = Math.random() * Math.PI * 2;
  }

  draw(ctx, cameraY, frame) {
    if (this.collected) return;
    // 아주 천천히 위아래로 흔들린다(구름·오브와 같은 4초 주기).
    const bob = Math.sin(frame * (Math.PI * 2 / 240) + this.phase) * this.r * 0.12;
    const size = this.r * 2;
    const x = Math.round(this.x - this.r);
    const y = Math.round(this.y - cameraY - this.r + bob);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (spriteReady) {
      ctx.drawImage(sprite, x, y, size, size);
    } else {
      ctx.fillStyle = '#f5b73d';
      ctx.beginPath();
      ctx.arc(this.x, this.y - cameraY + bob, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
