import { HAZARD_RADIUS } from './config.js';

// 전용 가시 스프라이트(있으면 사용)
let hazardImg = null;
let hazardImgReady = false;
if (typeof Image !== 'undefined') {
  hazardImg = new Image();
  hazardImg.onload = () => { hazardImgReady = true; };
  hazardImg.onerror = () => { hazardImgReady = false; };
  hazardImg.src = 'assets/hazard.png';
}

// 어드벤처 모드 장애물: 좌우로 떠다니는 가시 덩어리. 닿으면 위험.
export class Hazard {
  constructor(x, y, vx) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.r = HAZARD_RADIUS;
    this.dead = false;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(worldWidth, timeScale = 1) {
    this.x += this.vx * timeScale;
    const m = this.r;
    if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx); }
    else if (this.x > worldWidth - m) { this.x = worldWidth - m; this.vx = -Math.abs(this.vx); }
  }

  draw(ctx, cameraY, frame) {
    const x = this.x;
    const y = this.y - cameraY;
    const r = this.r;
    const rot = frame * 0.04 + this.phase;
    const pulse = 0.9 + 0.1 * Math.sin(frame * 0.18 + this.phase);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    if (hazardImgReady) {
      // 전용 가시 스프라이트
      const size = r * 3.2 * pulse;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(hazardImg, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    // 가시
    const spikes = 8;
    ctx.fillStyle = '#7a1f2b';
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const a0 = (i / spikes) * Math.PI * 2;
      const a1 = ((i + 0.5) / spikes) * Math.PI * 2;
      const a2 = ((i + 1) / spikes) * Math.PI * 2;
      ctx.lineTo(Math.cos(a0) * r * 0.7, Math.sin(a0) * r * 0.7);
      ctx.lineTo(Math.cos(a1) * r * 1.35 * pulse, Math.sin(a1) * r * 1.35 * pulse);
      ctx.lineTo(Math.cos(a2) * r * 0.7, Math.sin(a2) * r * 0.7);
    }
    ctx.closePath();
    ctx.fill();

    // 본체
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r * 0.85);
    body.addColorStop(0, '#e74c3c');
    body.addColorStop(1, '#a02633');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.fill();

    // 경고 코어
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
