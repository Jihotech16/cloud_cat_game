// P·O·I·N·G 글자 아이템. 한 판에 순서대로 하나씩 나오고, 다섯 글자를 모두 모으면
// 로켓 발사 + 점수 보너스를 준다(game.js 에서 처리). 다 모으면 다시 P 부터 시작한다.
import { LETTER_RADIUS } from './config.js';

export const LETTERS = ['p', 'o', 'i', 'n', 'g'];

const FRAME = 64;
let sheet = null;
let sheetReady = false;
if (typeof Image !== 'undefined') {
  sheet = new Image();
  sheet.onload = () => {
    sheetReady = sheet.naturalWidth === FRAME * LETTERS.length && sheet.naturalHeight === FRAME;
  };
  sheet.onerror = () => { sheetReady = false; };
  sheet.src = 'assets/poing-items-sheet.png';
}

const FALLBACK_COLORS = ['#ef7d9d', '#f0b429', '#7fd1b9', '#7bb4ec', '#b38ae0'];

export class LetterToken {
  constructor(x, y, index) {
    this.x = x;
    this.y = y;
    this.index = index; // 0=P … 4=G
    this.r = LETTER_RADIUS;
    this.collected = false;
    this.phase = Math.random() * Math.PI * 2;
  }

  draw(ctx, cameraY, frame) {
    if (this.collected) return;
    const bob = Math.sin(frame * (Math.PI * 2 / 240) + this.phase) * this.r * 0.14;
    const size = this.r * 2;
    const x = Math.round(this.x - this.r);
    const y = Math.round(this.y - cameraY - this.r + bob);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (sheetReady) {
      ctx.drawImage(sheet, this.index * FRAME, 0, FRAME, FRAME, x, y, size, size);
    } else {
      ctx.fillStyle = FALLBACK_COLORS[this.index];
      ctx.beginPath();
      ctx.arc(this.x, this.y - cameraY + bob, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.round(this.r * 1.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LETTERS[this.index].toUpperCase(), this.x, this.y - cameraY + bob);
    }
    ctx.restore();
  }
}
