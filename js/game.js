import { Player } from './player.js';
import { Cloud, CLOUD_TYPES, pickCloudType, randomCloudWidth } from './cloud.js';
import { getBestScore, saveBestScore } from './score.js';
import {
  GRAVITY,
  JUMP_FORCE,
  CHARGE_RATE,
  CHARGE_JUMP_BONUS,
  CLOUD_GAP_MIN,
  CLOUD_GAP_MAX,
  SPAWN_LOOKAHEAD,
  START_CLOUD_WIDTH,
  START_Y_OFFSET,
  SCORE_DIVISOR,
  CLOUD_SPAWN_MARGIN_X,
  CLOUD_SPAWN_PADDING,
  CLOUD_COLLISION_INSET,
  LANDING_TOLERANCE,
  CULL_BELOW_PADDING,
  GAME_OVER_MARGIN,
  GAME_SCALE,
} from './config.js';

export class Game {
  constructor(canvas, touchRoot, callbacks = {}) {
    this.canvas = canvas;
    this.touchRoot = touchRoot;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.state = 'idle';
    this.startCloud = null;
    this.worldWidth = 0;
    this.worldHeight = 0;
    this.cameraY = 0;
    this.highestY = 0;
    this.score = 0;

    this.player = null;
    this.clouds = [];
    this.input = { holding: false };
    this.charge = 0;
    this.stars = [];
    this.cloudDecor = [];

    this._bindInput();
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.worldWidth = rect.width;
    this.worldHeight = rect.height;
  }

  _bindInput() {
    const setHolding = (holding) => {
      if (this.state !== 'ready' && this.state !== 'playing') return;
      this.input.holding = holding;
      const charging = holding && !!this.player?.groundedCloud;
      this.callbacks.onCharge?.(this.charge, charging);
    };

    const onRelease = () => {
      if (this.state === 'ready') {
        this.state = 'playing';
      }
      if (this.state === 'playing') {
        this._tryJump();
      }
    };

    this.touchRoot.addEventListener('touchstart', (e) => {
      if (this.state !== 'ready' && this.state !== 'playing') return;
      e.preventDefault();
      setHolding(true);
    }, { passive: false });

    this.touchRoot.addEventListener('touchend', (e) => {
      const stillHolding = e.touches.length > 0;
      if (!stillHolding && this.input.holding) {
        onRelease();
      }
      setHolding(stillHolding);
    });
    this.touchRoot.addEventListener('touchcancel', (e) => {
      const stillHolding = e.touches.length > 0;
      if (!stillHolding && this.input.holding) {
        onRelease();
      }
      setHolding(stillHolding);
    });
  }

  _initDecor() {
    this.stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * this.worldWidth,
      y: Math.random() * this.worldHeight * 3,
      size: (Math.random() * 2 + 1) * GAME_SCALE,
      alpha: Math.random() * 0.5 + 0.2,
    }));
    this.cloudDecor = Array.from({ length: 6 }, () => ({
      x: Math.random() * this.worldWidth,
      y: Math.random() * this.worldHeight,
      scale: Math.random() * 0.6 + 0.4,
      speed: Math.random() * 0.15 + 0.05,
    }));
  }

  _tryJump() {
    if (!this.player?.groundedCloud) return;

    const cloud = this.player.groundedCloud;
    if (cloud.broken) return;

    if (Math.abs(this.player.vx) < 0.01) {
      if (this.startFromLeft) {
        this.player.vx = -this.player.baseSpeed;
        this.player.facing = -1;
        this.startFromLeft = false;
      } else {
        this.player.vx = this.player.facing * this.player.baseSpeed;
      }
    }

    const jumpMult = 1 + this.charge * CHARGE_JUMP_BONUS;
    this.player.bounce(JUMP_FORCE * jumpMult);
    this.charge = 0;
    this.callbacks.onCharge?.(0, false);

    if (cloud.type === CLOUD_TYPES.BREAKING) {
      cloud.broken = true;
    }
  }

  _isPlayerOnCloud(cloud) {
    return (
      this.player.right > cloud.x - cloud.width / 2 + CLOUD_COLLISION_INSET &&
      this.player.left < cloud.x + cloud.width / 2 - CLOUD_COLLISION_INSET
    );
  }

  _landOnCloud(cloud) {
    this.player.alignFeetTo(cloud.top);
    this.player.vy = 0;
    this.player.vx = 0;
    this.player.groundedCloud = cloud;
    this.player.onGround = true;
    this.charge = 0;
    this.callbacks.onCharge?.(0, this.input.holding);
  }

  _snapToStartCloud() {
    if (!this.startCloud || !this.player) return;
    this.player.x = this.startCloud.x;
    this.player.alignFeetTo(this.startCloud.top);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.groundedCloud = this.startCloud;
  }

  start() {
    this.state = 'ready';
    this.score = 0;
    this.cameraY = 0;
    this.highestY = 0;

    const startY = this.worldHeight - START_Y_OFFSET;
    this.startCloud = new Cloud(
      this.worldWidth / 2,
      startY,
      CLOUD_TYPES.NORMAL,
      START_CLOUD_WIDTH,
    );

    this.clouds = [this.startCloud];
    this.player = new Player(
      this.startCloud.x,
      0,
    );
    this.player.alignFeetTo(this.startCloud.top);
    this.player.vx = 0;
    this.player.vy = 0;
    this.startFromLeft = true;
    this._snapToStartCloud();

    let y = startY;
    for (let i = 0; i < 18; i++) {
      y -= CLOUD_GAP_MIN + Math.random() * (CLOUD_GAP_MAX - CLOUD_GAP_MIN);
      const x = Math.random() * (this.worldWidth - CLOUD_SPAWN_PADDING) + CLOUD_SPAWN_MARGIN_X;
      const type = pickCloudType(0);
      this.clouds.push(new Cloud(x, y, type, randomCloudWidth()));
    }

    this.highestSpawnedY = this.clouds.reduce((min, c) => (c.y < min ? c.y : min), startY);

    this._initDecor();
    this.input = { holding: false };
    this.charge = 0;
    this.callbacks.onCharge?.(0, false);

    if (this._loopId) cancelAnimationFrame(this._loopId);
    this._loop();
  }

  _spawnClouds() {
    const spawnAbove = this.cameraY - this.worldHeight * SPAWN_LOOKAHEAD;

    if (this.highestSpawnedY <= spawnAbove) return;

    let y = this.highestSpawnedY;
    while (y > spawnAbove) {
      y -= CLOUD_GAP_MIN + Math.random() * (CLOUD_GAP_MAX - CLOUD_GAP_MIN);
      const x = Math.random() * (this.worldWidth - CLOUD_SPAWN_PADDING) + CLOUD_SPAWN_MARGIN_X;
      const type = pickCloudType(this.score);
      this.clouds.push(new Cloud(x, y, type, randomCloudWidth()));
      this.highestSpawnedY = y;
    }

    const cullBelow = this.cameraY + this.worldHeight + CULL_BELOW_PADDING;
    this.clouds = this.clouds.filter((c) => c.y < cullBelow);
  }

  _checkLanding() {
    if (this.player.groundedCloud || this.player.vy <= 0) return;

    for (const cloud of this.clouds) {
      if (cloud.broken) continue;

      const playerBottom = this.player.bottom;
      const prevBottom = playerBottom - this.player.vy;
      const cloudTop = cloud.top;

      if (
        this._isPlayerOnCloud(cloud) &&
        prevBottom <= cloudTop + LANDING_TOLERANCE &&
        playerBottom >= cloudTop - LANDING_TOLERANCE
      ) {
        this._landOnCloud(cloud);
        break;
      }
    }
  }

  _updateGrounded() {
    const cloud = this.player.groundedCloud;
    if (!cloud || cloud.broken) {
      this.player.groundedCloud = null;
      return;
    }

    if (cloud.type === CLOUD_TYPES.MOVING) {
      this.player.x += cloud.vx;
    }

    this.player.alignFeetTo(cloud.top);
    this.player.vy = 0;

    if (!this._isPlayerOnCloud(cloud)) {
      this.player.groundedCloud = null;
      this.player.onGround = false;
      return;
    }

    if (this.input.holding) {
      this.charge = Math.min(1, this.charge + CHARGE_RATE);
      this.callbacks.onCharge?.(this.charge, true);
    }
  }

  _updateCamera() {
    const targetY = this.player.y - this.worldHeight * 0.55;
    if (targetY < this.cameraY) {
      this.cameraY = targetY;
    }

    const climbed = Math.max(0, Math.floor((this.worldHeight - START_Y_OFFSET - this.player.y) / SCORE_DIVISOR));
    if (climbed > this.score) {
      this.score = climbed;
      this.callbacks.onScore?.(this.score);
    }
  }

  _syncPlayerChargeAnim() {
    if (!this.player) return;
    const onCloud = this.state === 'ready' || !!this.player.groundedCloud;
    this.player.charging = onCloud && this.input.holding;
    this.player.chargeLevel = this.charge;
  }

  _update() {
    if (this.state === 'ready') {
      this._snapToStartCloud();
      if (this.input.holding) {
        this.charge = Math.min(1, this.charge + CHARGE_RATE);
        this.callbacks.onCharge?.(this.charge, true);
      }
      this._syncPlayerChargeAnim();
      return;
    }

    for (const cloud of this.clouds) {
      cloud.update(this.worldWidth);
    }

    if (this.player.groundedCloud) {
      this._updateGrounded();
    } else {
      this.player.update(GRAVITY, this.worldWidth);
      this._checkLanding();
    }

    this._spawnClouds();
    this._updateCamera();
    this._syncPlayerChargeAnim();

    if (this.player.y - this.cameraY > this.worldHeight + GAME_OVER_MARGIN) {
      this._gameOver();
    }
  }

  _gameOver() {
    this.state = 'gameover';
    const isNewRecord = saveBestScore(this.score);
    this.callbacks.onGameOver?.(this.score, isNewRecord);
  }

  _drawBackground() {
    const ctx = this.ctx;
    const h = this.worldHeight;

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    const altitude = Math.min(this.score / 800, 1);
    gradient.addColorStop(0, this._lerpColor('#6ec6ff', '#1a237e', altitude));
    gradient.addColorStop(1, this._lerpColor('#b8e6ff', '#4a148c', altitude * 0.7));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.worldWidth, h);

    for (const star of this.stars) {
      const sy = ((star.y - this.cameraY * 0.3) % (h * 3) + h * 3) % (h * 3);
      if (altitude < 0.3) continue;
      ctx.fillStyle = `rgba(255,255,255,${star.alpha * altitude})`;
      ctx.beginPath();
      ctx.arc(star.x, sy, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const dec of this.cloudDecor) {
      dec.y += dec.speed;
      if (dec.y > h + 40) dec.y = -40;
      this._drawDecorCloud(ctx, dec.x, dec.y, dec.scale * 30 * GAME_SCALE);
    }
  }

  _drawDecorCloud(ctx, x, y, r) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x - r * 0.6, y + r * 0.2, r * 0.6, 0, Math.PI * 2);
    ctx.arc(x + r * 0.6, y + r * 0.2, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _lerpColor(a, b, t) {
    const parse = (hex) => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = parse(a);
    const [r2, g2, b2] = parse(b);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const bl = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${bl})`;
  }

  _draw() {
    this._drawBackground();

    const sorted = [...this.clouds].sort((a, b) => a.y - b.y);
    for (const cloud of sorted) {
      cloud.draw(this.ctx, this.cameraY);
    }

    this.player.draw(this.ctx, this.cameraY);

    if (this.state === 'ready') {
      this._drawReadyHint();
    }
  }

  _drawReadyHint() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${18 * GAME_SCALE}px Jua, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(45, 52, 54, 0.25)';
    ctx.shadowBlur = 6;
    ctx.fillText('👆 꾹 눌렀다 떼면 출발!', this.worldWidth / 2, this.worldHeight - 48 * GAME_SCALE);
    ctx.restore();
  }

  _loop() {
    if (this.state !== 'ready' && this.state !== 'playing') return;

    this._update();
    this._draw();

    this._loopId = requestAnimationFrame(() => this._loop());
  }

  getBestScore() {
    return getBestScore();
  }
}
