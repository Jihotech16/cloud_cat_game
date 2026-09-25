// 비눗방울물(비눗방울 고양이 전용 아이템). 비눗방울 고양이를 입었을 때만 두 모드 모두에 나온다.
// 다섯 개를 모으면 게이지가 차고, 그 뒤 구름에 착지하면 큰 비눗방울을 불어 떠오른다(game.js).
// 그림은 고양이가 든 병을 잘라 만든 임시 그림(assets/soap-item.png)이다.
import { SOAP_RADIUS } from './config.js';

let sprite = null;
let spriteReady = false;
if (typeof Image !== 'undefined') {
  sprite = new Image();
  sprite.onload = () => { spriteReady = true; };
  sprite.onerror = () => { spriteReady = false; };
  sprite.src = 'assets/soap-item.png';
}

export class SoapToken {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = SOAP_RADIUS;
    this.collected = false;
    this.phase = Math.random() * Math.PI * 2;
  }

  draw(ctx, cameraY, frame) {
    if (this.collected) return;
    const bob = Math.sin(frame * (Math.PI * 2 / 240) + this.phase) * this.r * 0.14;
    const size = this.r * 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (spriteReady) {
      ctx.drawImage(sprite, Math.round(this.x - this.r), Math.round(this.y - cameraY - this.r + bob), size, size);
    } else {
      ctx.fillStyle = '#8bf0e1';
      ctx.beginPath();
      ctx.arc(this.x, this.y - cameraY + bob, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
