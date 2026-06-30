import { Player } from './player.js';
import { Cloud, CLOUD_TYPES, pickCloudType, randomCloudWidth } from './cloud.js';
import { Orb, pickRewardChoices, REWARDS } from './orb.js';
import { Hazard } from './hazard.js';
import { getBestScore, saveBestScore } from './score.js';
import { addCoins } from './meta.js';
import {
  playJumpSound,
  playCollectSound,
  playRainbowSound,
  playRewardSound,
  playBounceSound,
  playBoostSound,
  playBreakSound,
  playGameOverSound,
  playShieldSound,
  playRocketSound,
  playHazardSound,
} from './audio.js';
import {
  GRAVITY,
  JUMP_FORCE,
  BOUNCE_FORCE,
  BOOST_JUMP_MULT,
  CHARGE_RATE,
  CHARGE_JUMP_BONUS,
  JUMP_MIN_MULT,
  CHARGE_CAP_BASE,
  CHARGE_CAP_STEP,
  CHARGE_EASE_MIN,
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
  HAZARD_SPEED,
  HAZARD_SPEED_MIN_FACTOR,
  HAZARD_START_SCORE,
  ORB_RADIUS,
  ORB_SPAWN_GAP,
  ORB_RAINBOW_CHANCE,
  ORB_GAUGE_FILL,
  GAUGE_MAX,
  GAUGE_LEVEL_STEP,
  ORB_PICKUP_PADDING,
  ORB_MAGNET_SPEED,
  JUMP_LEVEL_STEP,
  MAGNET_RANGE_STEP,
  SCORE_LEVEL_STEP,
  ORB_VALUE_STEP,
  DOUBLE_JUMP_FORCE_MULT,
  CHARGE_RATE_STEP,
  REWARD_DURATION,
  REWARD_SCORE_MULT,
  ROCKET_DURATION,
  ROCKET_SPEED,
  COIN_REWARD_AMOUNT,
  REROLL_BASE_COST,
  SKIP_COIN_REWARD,
  SYN_JUMP_FORCE_MULT,
  SYN_SHOCKWAVE_RADIUS,
  SYN_ORB_FILL_MULT,
  SYN_ORB_DOUBLE_CHANCE,
  SYN_SCORE_MULT,
  SYN_SCORE_AUTOGROW_FRAMES,
  SYN_FALL_BONUS,
  SYN_SHIELD_REGEN_FRAMES,
  SLOWMO_DURATION,
  SLOWMO_FACTOR,
  BIGCLOUD_DURATION,
  BIGCLOUD_SCALE,
  FEATHER_DURATION,
  FEATHER_MAX_FALL,
  COIN_PER_ORB,
  COIN_PER_RAINBOW,
} from './config.js';

// 낮은 고도에서 깔리는 픽셀 하늘 배경(있으면 사용, 고도가 오르면 동적 하늘로 전환).
let skyBgImg = null;
let skyBgReady = false;
if (typeof Image !== 'undefined') {
  skyBgImg = new Image();
  skyBgImg.onload = () => { skyBgReady = true; };
  skyBgImg.onerror = () => { skyBgReady = false; };
  skyBgImg.src = 'assets/sky-bg.png';
}

export class Game {
  constructor(canvas, touchRoot, callbacks = {}) {
    this.canvas = canvas;
    this.touchRoot = touchRoot;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.state = 'idle';
    this.mode = 'classic';
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

    this.orbs = [];
    this.hazards = [];
    this.particles = [];
    this.gauge = 0;
    this.gaugeNeeded = GAUGE_MAX;
    this.rewardCount = 0;
    this.rerollCount = 0;
    this.rawClimb = 0;
    this.frame = 0;
    this.coins = 0;
    this.airJumpsLeft = 0;
    this.shield = false;
    this.jumpLevel = 0;
    this.doubleJumpLevel = 0;
    this.magnetLevel = 0;
    this.scoreLevel = 0;
    this.orbValueLevel = 0;
    this.chargeRateLevel = 0;
    this.chargeCapLevel = 0;
    this.effects = { scoreX2: 0, slowmo: 0, bigcloud: 0, feather: 0, rocket: 0 };
    this.tagCount = { jump: 0, orb: 0, score: 0, survival: 0 };
    this.taken = new Set();
    this.synergy = this._emptySynergy();

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
    this.shootingStars = Array.from({ length: 3 }, () => this._newShootingStar());
  }

  _newShootingStar() {
    return {
      x: Math.random() * this.worldWidth,
      y: Math.random() * this.worldHeight * 0.5,
      len: (60 + Math.random() * 70) * GAME_SCALE,
      speed: (4 + Math.random() * 3) * GAME_SCALE,
      angle: Math.PI * 0.22 + Math.random() * 0.12,
      life: 0,
      maxLife: 26 + Math.random() * 26,
      wait: 30 + Math.random() * 220,
    };
  }

  _tryJump() {
    if (!this.player) return;
    const upgrade = (1 + this.jumpLevel * JUMP_LEVEL_STEP) * this.synergy.jumpForceMult;
    const cloud = this.player.groundedCloud;

    if (cloud) {
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

      const jumpMult = JUMP_MIN_MULT + this.charge * CHARGE_JUMP_BONUS;
      const cloudBoost = cloud.type === CLOUD_TYPES.BOOST ? BOOST_JUMP_MULT : 1;
      this.player.bounce(JUMP_FORCE * jumpMult * upgrade * cloudBoost);
      playJumpSound(this.charge); // 충전이 클수록 음이 높아짐
      if (cloudBoost > 1) {
        playBoostSound();
        this._spawnParticles(this.player.x, this.player.bottom, '#7fdcff', 8);
      }
      this.charge = 0;
      this.callbacks.onCharge?.(0, false);
      this.airJumpsLeft = this.doubleJumpLevel;

      if (cloud.type === CLOUD_TYPES.BREAKING) {
        cloud.broken = true;
        playBreakSound();
      }
      return;
    }

    // 공중 더블 점프
    if (this.airJumpsLeft > 0) {
      this.airJumpsLeft -= 1;
      if (Math.abs(this.player.vx) < 0.01) {
        this.player.vx = this.player.facing * this.player.baseSpeed;
      }
      this.player.bounce(JUMP_FORCE * upgrade * DOUBLE_JUMP_FORCE_MULT);
      playJumpSound();
      this._spawnParticles(this.player.x, this.player.y + this.player.height * 0.3, '#dff3ff', 8);
    }
  }

  _cloudScale() {
    return this.effects.bigcloud > 0 ? BIGCLOUD_SCALE : 1;
  }

  _chargeRate() {
    return CHARGE_RATE * (1 + this.chargeRateLevel * CHARGE_RATE_STEP);
  }

  // 프레임당 실제 충전 증가량. 시작은 천천히, 채울수록 빨라지는 ease-in.
  // → 살짝 눌렀을 때 게이지가 거의 안 차서 작은 점프를 미세하게 조절할 수 있다.
  _chargeIncrement() {
    const max = this._chargeMax();
    const t = max > 0 ? this.charge / max : 0;
    const ease = CHARGE_EASE_MIN + (1 - CHARGE_EASE_MIN) * t;
    return this._chargeRate() * ease;
  }

  // 현재 모을 수 있는 최대 점프 파워(0~1). 보상으로 상한이 올라간다.
  _chargeMax() {
    return Math.min(1, CHARGE_CAP_BASE + this.chargeCapLevel * CHARGE_CAP_STEP);
  }

  _emptySynergy() {
    return {
      jumpForceMult: 1,
      shockwave: false,
      orbFillMult: 1,
      orbDoubleChance: 0,
      scoreMult: 1,
      scoreAutoGrow: false,
      fallBonus: 0,
      shieldRegen: false,
    };
  }

  // 계열 보유 수에 따라 세트 시너지를 다시 계산한다.
  _recomputeSynergy() {
    const c = this.tagCount;
    const s = this._emptySynergy();
    if (c.jump >= 2) s.jumpForceMult = SYN_JUMP_FORCE_MULT;
    if (c.jump >= 4) s.shockwave = true;
    if (c.orb >= 2) s.orbFillMult = SYN_ORB_FILL_MULT;
    if (c.orb >= 4) s.orbDoubleChance = SYN_ORB_DOUBLE_CHANCE;
    if (c.score >= 2) s.scoreMult = SYN_SCORE_MULT;
    if (c.score >= 4) s.scoreAutoGrow = true;
    if (c.survival >= 2) s.fallBonus = this.worldHeight * SYN_FALL_BONUS;
    if (c.survival >= 4) s.shieldRegen = true;
    this.synergy = s;
    this.callbacks.onSynergy?.(this.getSynergyState());
  }

  // HUD 표시용 계열 상태 { jump:{count,tier}, ... }
  getSynergyState() {
    const out = {};
    for (const tag of ['jump', 'orb', 'score', 'survival']) {
      const count = this.tagCount[tag];
      out[tag] = { count, tier: count >= 4 ? 4 : count >= 2 ? 2 : 0 };
    }
    return out;
  }

  _isPlayerOnCloud(cloud) {
    const half = (cloud.width * this._cloudScale()) / 2;
    return (
      this.player.right > cloud.x - half + CLOUD_COLLISION_INSET &&
      this.player.left < cloud.x + half - CLOUD_COLLISION_INSET
    );
  }

  _landOnCloud(cloud) {
    // 트램펄린: 밟으면 차지 없이 강하게 튕겨 올라간다.
    if (cloud.type === CLOUD_TYPES.BOUNCE) {
      if (Math.abs(this.player.vx) < 0.01) {
        this.player.vx = this.player.facing * this.player.baseSpeed;
      } else {
        this.player.facing = this.player.vx > 0 ? 1 : -1;
      }
      this.player.alignFeetTo(cloud.top);
      this.player.bounce(BOUNCE_FORCE);
      this.airJumpsLeft = this.doubleJumpLevel;
      playBounceSound();
      this._spawnParticles(this.player.x, this.player.bottom, '#ff7ec2', 10);
      this.charge = 0;
      this.callbacks.onCharge?.(0, this.input.holding);
      return;
    }

    if (Math.abs(this.player.vx) > 0.01) {
      this.player.facing = this.player.vx > 0 ? 1 : -1;
    }
    this.player.land();
    this.player.alignFeetTo(cloud.top);
    this.player.vy = 0;
    this.player.vx = 0;
    this.player.groundedCloud = cloud;
    this.player.onGround = true;
    this.charge = 0;
    this.airJumpsLeft = this.doubleJumpLevel;
    this.callbacks.onCharge?.(0, this.input.holding);

    if (this.synergy.shockwave) {
      this._shockwaveAbsorb();
    }
  }

  // 점프 4세트: 착지 시 주변 오브를 빨아들인다.
  _shockwaveAbsorb() {
    const px = this.player.x;
    const py = this.player.y;
    const r = SYN_SHOCKWAVE_RADIUS;
    let absorbed = false;
    for (const orb of this.orbs) {
      if (orb.collected) continue;
      if (Math.hypot(px - orb.x, py - orb.y) <= r) {
        orb.collected = true;
        this._collectOrb(orb);
        absorbed = true;
      }
    }
    if (absorbed) {
      this.orbs = this.orbs.filter((o) => !o.collected);
      this._spawnParticles(px, py, '#bfe9ff', 12);
    }
  }

  _snapToStartCloud() {
    if (!this.startCloud || !this.player) return;
    this.player.x = this.startCloud.x;
    this.player.alignFeetTo(this.startCloud.top);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.groundedCloud = this.startCloud;
    this.airJumpsLeft = this.doubleJumpLevel;
  }

  start(mode = 'classic') {
    this.mode = mode;
    this.state = 'ready';
    this.score = 0;
    this.cameraY = 0;
    this.highestY = 0;

    this.orbs = [];
    this.hazards = [];
    this.particles = [];
    this.gauge = 0;
    this.gaugeNeeded = GAUGE_MAX;
    this.rewardCount = 0;
    this.rerollCount = 0;
    this.rawClimb = 0;
    this.frame = 0;
    this.coins = 0;
    this.airJumpsLeft = 0;
    this.shield = false;
    this.jumpLevel = 0;
    this.doubleJumpLevel = 0;
    this.magnetLevel = 0;
    this.scoreLevel = 0;
    this.orbValueLevel = 0;
    this.chargeRateLevel = 0;
    this.chargeCapLevel = 0;
    this.effects = { scoreX2: 0, slowmo: 0, bigcloud: 0, feather: 0, rocket: 0 };
    this.tagCount = { jump: 0, orb: 0, score: 0, survival: 0 };
    this.taken = new Set();
    this.synergy = this._emptySynergy();

    // 어드벤처 모드에서만 상점 영구 업그레이드 적용
    if (this.mode === 'adventure') {
      const meta = this.callbacks.getStartBonuses?.() ?? {};
      this.jumpLevel = meta.jumpLevel ?? 0;
      this.scoreLevel = meta.scoreLevel ?? 0;
      this.shield = !!meta.shield;
      this.gauge = Math.min(this.gaugeNeeded, meta.gaugeFill ?? 0);
    }

    this.callbacks.onGauge?.(this.gauge / this.gaugeNeeded);
    this.callbacks.onCoins?.(0);
    this.callbacks.onEffects?.(this.getEffects());
    this.callbacks.onSynergy?.(this.getSynergyState());

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
    this.player.facing = 1; // 시작 시 오른쪽을 보고 첫 점프도 오른쪽으로
    this.startFromLeft = false;
    this._snapToStartCloud();

    let y = startY;
    for (let i = 0; i < 18; i++) {
      y -= CLOUD_GAP_MIN + Math.random() * (CLOUD_GAP_MAX - CLOUD_GAP_MIN);
      const x = Math.random() * (this.worldWidth - CLOUD_SPAWN_PADDING) + CLOUD_SPAWN_MARGIN_X;
      const type = pickCloudType(0);
      this.clouds.push(new Cloud(x, y, type, randomCloudWidth()));
    }

    this.highestSpawnedY = this.clouds.reduce((min, c) => (c.y < min ? c.y : min), startY);
    this.highestOrbY = startY;
    this.highestHazardY = startY;
    this._spawnOrbs(); // 시작 화면(대기 상태)부터 오브가 보이도록 미리 생성

    this._initDecor();
    this.input = { holding: false };
    this.charge = 0;
    this.callbacks.onCharge?.(0, false);

    if (this._loopId) cancelAnimationFrame(this._loopId);
    this._loop();
  }

  // 고도가 오를수록 구름이 아주 천천히 작아진다(1500m에서 30% 작게, 하한 유지).
  _cloudSpawnWidth() {
    const t = Math.min(1, this.score / 1500);
    const factor = 1 - 0.3 * t;
    return Math.round(randomCloudWidth() * factor);
  }

  _spawnClouds() {
    const spawnAbove = this.cameraY - this.worldHeight * SPAWN_LOOKAHEAD;

    if (this.highestSpawnedY <= spawnAbove) return;

    let y = this.highestSpawnedY;
    while (y > spawnAbove) {
      const gap = CLOUD_GAP_MIN + Math.random() * (CLOUD_GAP_MAX - CLOUD_GAP_MIN);
      y -= gap;
      const x = Math.random() * (this.worldWidth - CLOUD_SPAWN_PADDING) + CLOUD_SPAWN_MARGIN_X;
      const type = pickCloudType(this.score);
      this.clouds.push(new Cloud(x, y, type, this._cloudSpawnWidth()));
      this.highestSpawnedY = y;
    }

    const cullBelow = this.cameraY + this.worldHeight + CULL_BELOW_PADDING;
    this.clouds = this.clouds.filter((c) => c.y < cullBelow);
    this.orbs = this.orbs.filter((o) => !o.collected && o.y < cullBelow);
  }

  // 오브를 맵 전체에 일정한 세로 간격으로 골고루 뿌린다. (어드벤처 모드 전용)
  _spawnOrbs() {
    if (this.mode !== 'adventure') return;
    const spawnAbove = this.cameraY - this.worldHeight * SPAWN_LOOKAHEAD;

    while (this.highestOrbY > spawnAbove) {
      this.highestOrbY -= ORB_SPAWN_GAP * (0.75 + Math.random() * 0.5);
      const x = ORB_RADIUS * 2 + Math.random() * (this.worldWidth - ORB_RADIUS * 4);
      const type = Math.random() < ORB_RAINBOW_CHANCE ? 'rainbow' : 'normal';
      this.orbs.push(new Orb(x, this.highestOrbY, type));
    }
  }

  // 장애물 생성: 일정 점수부터, 고도 오를수록 촘촘하게. (어드벤처 전용)
  _spawnHazards() {
    if (this.mode !== 'adventure') return;
    if (this.score < HAZARD_START_SCORE) {
      // 등장 전엔 화면 위쪽 기준선만 따라 올린다(나중에 몰아서 안 쏟아지게).
      this.highestHazardY = Math.min(this.highestHazardY, this.cameraY - this.worldHeight);
      return;
    }
    const spawnAbove = this.cameraY - this.worldHeight * SPAWN_LOOKAHEAD;
    const t = Math.min(1, this.score / 800);
    const gap = this.worldHeight * (0.95 - 0.5 * t); // 고도0: ~1화면, 고도1: ~0.45화면
    // 가시 속도: 최저는 항상 느리게 유지하고, 고도가 오르면 "상한"만 높아진다.
    // → 각 가시마다 [느림 ~ 상한] 사이를 랜덤으로 골라, 높은 곳에서도 느린 가시가 섞인다.
    const speedFloor = HAZARD_SPEED_MIN_FACTOR;
    const speedCeil = HAZARD_SPEED_MIN_FACTOR + (1 - HAZARD_SPEED_MIN_FACTOR) * t;

    while (this.highestHazardY > spawnAbove) {
      this.highestHazardY -= gap * (0.7 + Math.random() * 0.6);
      const r = this.worldWidth * 0.07;
      const x = r + Math.random() * (this.worldWidth - r * 2);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const factor = speedFloor + Math.random() * (speedCeil - speedFloor);
      this.hazards.push(new Hazard(x, this.highestHazardY, dir * HAZARD_SPEED * factor));
    }
  }

  // 장애물 이동 + 충돌 판정.
  _updateHazards() {
    const ts = this.effects.slowmo > 0 ? SLOWMO_FACTOR : 1;
    const px = this.player.x;
    const py = this.player.y;
    const hitDist = this.player.width * 0.32;

    for (const h of this.hazards) {
      if (h.dead) continue;
      h.update(this.worldWidth, ts);
      if (Math.hypot(px - h.x, py - h.y) < hitDist + h.r) {
        this._onHazardHit(h);
        if (this.state !== 'playing') return; // 게임오버 시 중단
      }
    }
    const cullBelow = this.cameraY + this.worldHeight + CULL_BELOW_PADDING;
    this.hazards = this.hazards.filter((h) => !h.dead && h.y < cullBelow);
  }

  _onHazardHit(h) {
    if (this.shield) {
      this.shield = false;
      h.dead = true;
      this._spawnParticles(h.x, h.y, '#ffd24a', 16);
      this.player.vy = -JUMP_FORCE * 0.8; // 살짝 튕겨 회피
      this.player.groundedCloud = null;
      this.callbacks.onEffects?.(this.getEffects());
      playShieldSound();
    } else {
      playHazardSound();
      this._gameOver();
    }
  }

  _checkLanding() {
    if (this.player.groundedCloud || this.player.vy <= 0) return;

    const viewportBottom = this.cameraY + this.worldHeight;

    for (const cloud of this.clouds) {
      if (cloud.broken) continue;

      // 화면 아래로 사라진(보이지 않는) 구름에는 착지하지 않는다.
      if (cloud.top > viewportBottom) continue;

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
      this.charge = Math.min(this._chargeMax(), this.charge + this._chargeIncrement());
      this.callbacks.onCharge?.(this.charge, true);
    }
  }

  _updateCamera() {
    const targetY = this.player.y - this.worldHeight * 0.55;
    if (targetY < this.cameraY) {
      this.cameraY = targetY;
    }

    const climbed = Math.max(0, Math.floor((this.worldHeight - START_Y_OFFSET - this.player.y) / SCORE_DIVISOR));
    if (climbed > this.rawClimb) {
      const delta = climbed - this.rawClimb;
      this.rawClimb = climbed;
      const permMult = (1 + this.scoreLevel * SCORE_LEVEL_STEP) * this.synergy.scoreMult;
      let burstMult = this.effects.scoreX2 > 0 ? REWARD_SCORE_MULT : 1;
      // 시그니처 페어: 점수배율+로켓 → 로켓 중 점수 추가 2배
      if (this.effects.rocket > 0 && this.taken.has('scoreMul')) burstMult *= 2;
      this.score += Math.round(delta * permMult * burstMult);
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
    this.frame += 1;

    if (this.state === 'ready') {
      this._snapToStartCloud();
      if (this.input.holding) {
        this.charge = Math.min(this._chargeMax(), this.charge + this._chargeIncrement());
        this.callbacks.onCharge?.(this.charge, true);
      }
      this._syncPlayerChargeAnim();
      return;
    }

    const ts = this.effects.slowmo > 0 ? SLOWMO_FACTOR : 1;

    for (const cloud of this.clouds) {
      cloud.update(this.worldWidth, ts);
    }

    if (this.effects.rocket > 0) {
      // 로켓 부스트: 중력 무시하고 위로 쭉 상승
      this.player.groundedCloud = null;
      this.player.onGround = false;
      this.player.vx = 0;
      this.player.vy = -ROCKET_SPEED;
      this.player.y -= ROCKET_SPEED;
      this.player.jumpPeakVy = ROCKET_SPEED; // 상승 애니메이션 유지
      if (this.frame % 2 === 0) {
        this._spawnParticles(this.player.x, this.player.y + this.player.height * 0.45, '#ff8a3d', 5);
      }
    } else if (this.player.groundedCloud) {
      this._updateGrounded();
    } else {
      this.player.update(GRAVITY, this.worldWidth, ts);
      // 깃털: 낙하 속도 제한
      if (this.effects.feather > 0 && this.player.vy > FEATHER_MAX_FALL) {
        this.player.vy = FEATHER_MAX_FALL;
      }
      this._checkLanding();
    }

    this._spawnClouds();
    this._spawnOrbs();
    this._spawnHazards();
    this._updateOrbs();
    this._updateHazards();
    if (this.state !== 'playing' && this.state !== 'ready') return; // 장애물로 게임오버
    this._updateParticles();
    this._tickEffects();
    this._updateSynergyTimers();
    this._updateCamera();
    this._syncPlayerChargeAnim();

    const overLine = this.worldHeight + GAME_OVER_MARGIN + this.synergy.fallBonus;
    if (this.player.y - this.cameraY > overLine) {
      if (this.shield) {
        this.shield = false;
        this._revive();
        playShieldSound();
        this.callbacks.onEffects?.(this.getEffects());
      } else {
        this._gameOver();
      }
    }
  }

  // 시간 기반 세트 효과: 점수 자동 상승 / 보호막 자동 재생
  _updateSynergyTimers() {
    if (this.synergy.scoreAutoGrow && this.frame % SYN_SCORE_AUTOGROW_FRAMES === 0) {
      this.scoreLevel += 1;
    }
    if (this.synergy.shieldRegen && !this.shield && this.frame % SYN_SHIELD_REGEN_FRAMES === 0) {
      this.shield = true;
      this.callbacks.onEffects?.(this.getEffects());
    }
  }

  // 오브 자석 이동 + 수집 판정
  _updateOrbs() {
    const px = this.player.x;
    const py = this.player.y;
    const pickDist = this.player.width * 0.4 + ORB_PICKUP_PADDING;
    const magnetRange = this.magnetLevel * MAGNET_RANGE_STEP;

    for (const orb of this.orbs) {
      if (orb.collected) continue;

      const dx = px - orb.x;
      const dy = py - orb.y;
      const dist = Math.hypot(dx, dy);

      if (magnetRange > 0 && dist < magnetRange && dist > 0.01) {
        orb.x += (dx / dist) * ORB_MAGNET_SPEED;
        orb.y += (dy / dist) * ORB_MAGNET_SPEED;
      }

      if (dist < pickDist + orb.r) {
        orb.collected = true;
        this._collectOrb(orb);
      }
    }
    this.orbs = this.orbs.filter((o) => !o.collected);
  }

  _collectOrb(orb) {
    const rainbow = orb.type === 'rainbow';

    // 코인 적립 (시그니처 페어: 자석+오브가치 → 코인 2배)
    let coinGain = rainbow ? COIN_PER_RAINBOW : COIN_PER_ORB;
    if (this.taken.has('magnet') && this.taken.has('orbValue')) coinGain *= 2;
    this.coins += coinGain;
    this.callbacks.onCoins?.(this.coins);

    // 게이지 충전 (레인보우는 즉시 가득)
    if (rainbow) {
      this.gauge = this.gaugeNeeded;
      playRainbowSound();
      this._spawnParticles(orb.x, orb.y, 'rainbow', 18);
    } else {
      let fill = ORB_GAUGE_FILL * (1 + this.orbValueLevel * ORB_VALUE_STEP);
      fill *= this.synergy.orbFillMult; // 오브 2세트
      if (this.synergy.orbDoubleChance > 0 && Math.random() < this.synergy.orbDoubleChance) {
        fill *= 2; // 오브 4세트: 가끔 2배
      }
      this.gauge = Math.min(this.gaugeNeeded, this.gauge + fill);
      playCollectSound();
      this._spawnParticles(orb.x, orb.y, '#ffd24a', 8);
    }
    this.callbacks.onGauge?.(this.gauge / this.gaugeNeeded);

    if (this.gauge >= this.gaugeNeeded) {
      this._triggerReward();
    }
  }

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (1 + Math.random() * 3) * GAME_SCALE;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1,
        decay: 0.03 + Math.random() * 0.03,
        size: (2 + Math.random() * 2) * GAME_SCALE,
        color: color === 'rainbow' ? `hsl(${Math.random() * 360},95%,60%)` : color,
      });
    }
  }

  _updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15 * GAME_SCALE;
      p.life -= p.decay;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  _tickEffects() {
    let changed = false;
    for (const key of ['scoreX2', 'slowmo', 'bigcloud', 'feather', 'rocket']) {
      if (this.effects[key] > 0) {
        this.effects[key] -= 1;
        if (this.effects[key] === 0) {
          changed = true;
          // 로켓 종료 시 부드럽게 낙하로 전환
          if (key === 'rocket' && this.player) {
            this.player.vy = 0;
            this.player.jumpPeakVy = JUMP_FORCE;
          }
        }
      }
    }
    if (changed) this.callbacks.onEffects?.(this.getEffects());
  }

  // 고도 진행도(0~1) — 등급 확률에 사용. 우주(score 800)에서 최대.
  _rewardProgress() {
    return Math.min(1, this.score / 800);
  }

  // 영구 누적 보상의 현재 레벨(아니면 null).
  _rewardLevel(id) {
    switch (id) {
      case 'jump': return this.jumpLevel;
      case 'doubleJump': return this.doubleJumpLevel;
      case 'magnet': return this.magnetLevel;
      case 'scoreMul': return this.scoreLevel;
      case 'orbValue': return this.orbValueLevel;
      case 'charge': return this.chargeRateLevel;
      case 'chargeCap': return this.chargeCapLevel;
      default: return null;
    }
  }

  _rerollCost() {
    return REROLL_BASE_COST * (this.rerollCount + 1);
  }

  // 현재 선택지를 만들어 콜백으로 전달(리롤 시 재호출).
  _emitRewardChoices() {
    // 이미 보호막이 있으면 중복 제공하지 않는다(낭비 방지).
    const exclude = this.shield ? ['shield'] : [];
    const choices = pickRewardChoices(3, this._rewardProgress(), exclude).map((r) => ({
      ...r,
      level: this._rewardLevel(r.id),
    }));
    this.callbacks.onReward?.(choices, {
      coins: this.coins,
      rerollCost: this._rerollCost(),
      skipReward: SKIP_COIN_REWARD,
    });
  }

  // 게이지가 가득 차면 게임을 멈추고 보상 선택을 띄운다.
  _triggerReward() {
    this.state = 'reward';
    this.rerollCount = 0;
    if (this._loopId) cancelAnimationFrame(this._loopId);
    this._emitRewardChoices();
  }

  // 코인을 내고 선택지를 다시 뽑는다.
  rerollReward() {
    if (this.state !== 'reward') return;
    const cost = this._rerollCost();
    if (this.coins < cost) return;
    this.coins -= cost;
    this.rerollCount += 1;
    this.callbacks.onCoins?.(this.coins);
    this._emitRewardChoices();
  }

  // 보상을 받지 않고 코인을 얻으며 재개(레벨업·게이지 성장 없음).
  skipReward() {
    if (this.state !== 'reward') return;
    this.coins += SKIP_COIN_REWARD;
    this.callbacks.onCoins?.(this.coins);
    this.gauge = 0;
    this.callbacks.onGauge?.(0);
    this.state = 'playing';
    this._loop();
  }

  // main.js가 카드 선택 후 호출한다.
  chooseReward(id) {
    if (this.state !== 'reward') return;

    switch (id) {
      case 'shield': this.shield = true; break;
      case 'scoreX2': this.effects.scoreX2 = REWARD_DURATION; break;
      case 'slowmo': this.effects.slowmo = SLOWMO_DURATION; break;
      case 'bigcloud': this.effects.bigcloud = BIGCLOUD_DURATION; break;
      case 'feather': this.effects.feather = FEATHER_DURATION; break;
      case 'magnet': this.magnetLevel += 1; break; // 영구 누적
      case 'jump': this.jumpLevel += 1; break; // 영구 누적
      case 'doubleJump': this.doubleJumpLevel += 1; break; // 영구 누적
      case 'scoreMul': this.scoreLevel += 1; break; // 영구 누적
      case 'orbValue': this.orbValueLevel += 1; break; // 영구 누적
      case 'charge': this.chargeRateLevel += 1; break; // 영구 누적
      case 'chargeCap': this.chargeCapLevel += 1; break; // 영구 누적(점프 파워 최대치 ↑)
      case 'rocket': this.effects.rocket = ROCKET_DURATION; playRocketSound(); break;
      case 'coinBonus':
        this.coins += COIN_REWARD_AMOUNT;
        this.callbacks.onCoins?.(this.coins);
        break;
      default: break;
    }

    // 계열 태그 누적 → 세트 시너지 갱신
    const def = REWARDS.find((r) => r.id === id);
    if (def) {
      this.taken.add(id);
      for (const tag of def.tags ?? []) {
        this.tagCount[tag] = (this.tagCount[tag] ?? 0) + 1;
      }
      this._recomputeSynergy();
    }

    playRewardSound();
    // 레벨이 오를수록 다음 보상에 필요한 게이지를 키운다.
    this.rewardCount += 1;
    this.gaugeNeeded = GAUGE_MAX * (1 + this.rewardCount * GAUGE_LEVEL_STEP);
    this.gauge = 0;
    this.callbacks.onGauge?.(0);
    this.callbacks.onEffects?.(this.getEffects());

    this.state = 'playing';
    this._loop();
  }

  // 보호막으로 부활: 화면 중앙으로 끌어올리고 받쳐줄 구름을 둔다.
  _revive() {
    const reviveY = this.cameraY + this.worldHeight * 0.4;
    this.clouds.push(new Cloud(
      this.worldWidth / 2,
      this.cameraY + this.worldHeight * 0.62,
      CLOUD_TYPES.NORMAL,
      START_CLOUD_WIDTH,
    ));
    this.player.x = this.worldWidth / 2;
    this.player.y = reviveY;
    this.player.vx = 0;
    this.player.vy = -JUMP_FORCE * 1.3;
    this.player.groundedCloud = null;
    this.player.onGround = false;
  }

  getGauge() {
    return this.gauge / this.gaugeNeeded;
  }

  getEffects() {
    return {
      shield: this.shield,
      scoreX2: this.effects.scoreX2 > 0,
      slowmo: this.effects.slowmo > 0,
      bigcloud: this.effects.bigcloud > 0,
      feather: this.effects.feather > 0,
      rocket: this.effects.rocket > 0,
      jumpLevel: this.jumpLevel,
      doubleJumpLevel: this.doubleJumpLevel,
      magnetLevel: this.magnetLevel,
      scoreLevel: this.scoreLevel,
      orbValueLevel: this.orbValueLevel,
      chargeRateLevel: this.chargeRateLevel,
      chargeCapLevel: this.chargeCapLevel,
    };
  }

  getCoins() {
    return this.coins;
  }

  _gameOver() {
    this.state = 'gameover';
    playGameOverSound();
    const earned = this.mode === 'adventure' ? this.coins : 0;
    const totalCoins = earned > 0 ? addCoins(earned) : 0; // 메타 저장에 누적
    const isNewRecord = saveBestScore(this.mode, this.score);
    this.callbacks.onGameOver?.(this.score, isNewRecord, earned, totalCoins);
  }

  // 고도에 따라 하늘 색을 낮→노을→황혼→밤→우주로 보간한다.
  _skyGradient(altitude, h) {
    const STOPS = [
      { a: 0.0, top: '#6ec6ff', bot: '#b8e6ff' }, // 낮 맑은 하늘
      { a: 0.28, top: '#ff8e6e', bot: '#ffd6a6' }, // 노을
      { a: 0.5, top: '#6a4aa0', bot: '#ff7ea6' }, // 보랏빛 황혼
      { a: 0.72, top: '#16235e', bot: '#3a2170' }, // 밤하늘
      { a: 1.0, top: '#03030f', bot: '#0c0a26' }, // 우주
    ];
    let i = 0;
    while (i < STOPS.length - 2 && altitude > STOPS[i + 1].a) i++;
    const lo = STOPS[i];
    const hi = STOPS[i + 1];
    const t = Math.min(1, Math.max(0, (altitude - lo.a) / (hi.a - lo.a)));
    const g = this.ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, this._lerpColor(lo.top, hi.top, t));
    g.addColorStop(1, this._lerpColor(lo.bot, hi.bot, t));
    return g;
  }

  // start 이전엔 0, end 이후엔 1로 부드럽게 증가
  _fadeIn(t, start, end) {
    return Math.min(1, Math.max(0, (t - start) / (end - start)));
  }

  _drawBackground() {
    const ctx = this.ctx;
    const h = this.worldHeight;
    const w = this.worldWidth;
    const altitude = Math.min(this.score / 800, 1);

    ctx.fillStyle = this._skyGradient(altitude, h);
    ctx.fillRect(0, 0, w, h);

    // 낮은 고도: 업로드한 픽셀 하늘 이미지를 덮고, 오르면 동적 하늘로 페이드아웃
    const bgA = skyBgReady ? 1 - this._fadeIn(altitude, 0.0, 0.3) : 0;
    if (bgA > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = bgA;
      ctx.drawImage(skyBgImg, 0, 0, w, h);
      ctx.restore();
    }

    // 해: 지상~노을 구간, 고도가 오르면 아래로 지면서 노을 연출.
    // 배경 이미지에 이미 해가 있으므로, 이미지가 보일 땐 절차적 해를 숨긴다.
    const sunA = (1 - this._fadeIn(altitude, 0.06, 0.36)) * (1 - bgA);
    if (sunA > 0) {
      this._drawSun(ctx, w * 0.74, h * (0.2 + altitude * 0.9), 36 * GAME_SCALE, sunA);
    }

    // 달: 황혼부터 떠올라 밤·우주까지
    const moonA = this._fadeIn(altitude, 0.5, 0.72);
    if (moonA > 0) {
      this._drawMoon(ctx, w * 0.72, h * 0.2, 24 * GAME_SCALE, moonA);
    }

    // 별: 황혼부터 서서히 짙어짐
    const starA = this._fadeIn(altitude, 0.34, 0.7);
    if (starA > 0) {
      for (const star of this.stars) {
        const sy = ((star.y - this.cameraY * 0.3) % (h * 3) + h * 3) % (h * 3);
        ctx.fillStyle = `rgba(255,255,255,${star.alpha * starA})`;
        ctx.beginPath();
        ctx.arc(star.x, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 별똥별: 밤·우주에서 가끔 가로지름
    if (altitude > 0.55) {
      this._drawShootingStars(ctx, altitude);
    }

    // 토성형 행성: 우주 구간
    const planetA = this._fadeIn(altitude, 0.78, 0.96);
    if (planetA > 0) {
      this._drawPlanet(ctx, w * 0.24, h * 0.26, 20 * GAME_SCALE, planetA);
    }

    // 떠다니는 구름: 고도가 오르면 옅어지다 사라짐
    const cloudA = Math.max(0, 1 - altitude / 0.5);
    if (cloudA > 0) {
      for (const dec of this.cloudDecor) {
        dec.y += dec.speed;
        if (dec.y > h + 40) dec.y = -40;
        this._drawDecorCloud(ctx, dec.x, dec.y, dec.scale * 30 * GAME_SCALE, cloudA);
      }
    }
  }

  _drawSun(ctx, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.6);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawMoon(ctx, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
    glow.addColorStop(0, 'rgba(226,232,255,0.45)');
    glow.addColorStop(1, 'rgba(226,232,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef1ff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(193,202,232,0.6)';
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.18, r * 0.18, 0, Math.PI * 2);
    ctx.arc(x + r * 0.26, y + r * 0.3, r * 0.12, 0, Math.PI * 2);
    ctx.arc(x + r * 0.12, y - r * 0.36, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawPlanet(ctx, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#d98c5f';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,221,184,0.3)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,213,174,0.85)';
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.8, r * 0.55, -0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawShootingStars(ctx, altitude) {
    const visible = Math.min(1, (altitude - 0.55) / 0.2);
    for (const s of this.shootingStars) {
      if (s.wait > 0) {
        s.wait -= 1;
        continue;
      }
      s.life += 1;
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;

      const a = Math.sin((s.life / s.maxLife) * Math.PI) * visible;
      if (a > 0) {
        const tailX = s.x - Math.cos(s.angle) * s.len;
        const tailY = s.y - Math.sin(s.angle) * s.len;
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2 * GAME_SCALE;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        ctx.restore();
      }

      if (s.life >= s.maxLife || s.x > this.worldWidth + 60 || s.y > this.worldHeight + 60) {
        Object.assign(s, this._newShootingStar());
        s.wait = 90 + Math.random() * 260;
      }
    }
  }

  // 보호막 보유 시 캐릭터 주위에 보호막 거품을 그린다.
  _drawShield() {
    const ctx = this.ctx;
    const x = this.player.x;
    const y = this.player.y - this.cameraY;
    const r = this.player.width * 0.62;
    const pulse = 0.9 + 0.1 * Math.sin(this.frame * 0.15);

    ctx.save();
    // 채워진 거품
    const grad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * pulse);
    grad.addColorStop(0, 'rgba(120, 220, 255, 0.05)');
    grad.addColorStop(0.8, 'rgba(120, 220, 255, 0.18)');
    grad.addColorStop(1, 'rgba(90, 200, 255, 0.35)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
    ctx.fill();
    // 테두리 링
    ctx.strokeStyle = 'rgba(150, 230, 255, 0.85)';
    ctx.lineWidth = 2 * GAME_SCALE;
    ctx.beginPath();
    ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    // 하이라이트 반짝임
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(x - r * 0.4, y - r * 0.45, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y - this.cameraY, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawDecorCloud(ctx, x, y, r, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = 0.25 * alpha;
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

    const cloudScale = this._cloudScale();
    const altitude = Math.min(this.score / 800, 1);
    const sorted = [...this.clouds].sort((a, b) => a.y - b.y);
    for (const cloud of sorted) {
      cloud.draw(this.ctx, this.cameraY, cloudScale, altitude, this.frame);
    }

    for (const orb of this.orbs) {
      orb.draw(this.ctx, this.cameraY, this.frame);
    }

    for (const hazard of this.hazards) {
      hazard.draw(this.ctx, this.cameraY, this.frame);
    }

    this._drawParticles();

    this.player.draw(this.ctx, this.cameraY);

    if (this.shield) {
      this._drawShield();
    }

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
    return getBestScore(this.mode);
  }
}
