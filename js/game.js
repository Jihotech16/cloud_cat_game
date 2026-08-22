import { Player } from './player.js';
import { Cloud, CLOUD_TYPES, pickCloudType, randomCloudWidth } from './cloud.js';
import { Orb, pickRewardChoices, REWARDS, SIGNATURE_PAIRS } from './orb.js';
import { Hazard } from './hazard.js';
import { getBestScore, saveBestScore } from './score.js';
import { addCoins } from './meta.js';
import { t } from './i18n.js';
import {
  hapticLight,
  hapticMedium,
  hapticHeavy,
  hapticSuccess,
} from './haptics.js';
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
  playPerfectSound,
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
  PERFECT_LO,
  PERFECT_HI,
  PERFECT_JUMP_MULT,
  PERFECT_SCORE_BONUS,
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
  DOUBLE_JUMP_MAX_LEVEL,
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
    this.legend = this._emptyLegend();
    this.mods = this._emptyMods();
    this.autoRocketTimer = 0;
    this.combo = 0;
    this.bestLandY = Infinity;
    this.floatTexts = [];
    this.zoneShown = new Set();
    this.banner = null;

    // 화면 흔들림(임팩트 연출). '동작 줄이기'가 켜져 있으면 흔들지 않는다.
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener?.('change', (e) => {
      this.reduceMotion = e.matches;
    });
    // 이번 판에 메타 저장소로 이미 적립한 코인(광고 이어하기 시 중복 적립 방지)
    this.coinsBanked = 0;
    // 광고 이어하기(리바이브)는 판당 1회
    this.usedAdRevive = false;

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
    // 점프력 배율 = 레벨 보너스 × 시너지 × 트레이드오프 × 진화(메가 점프)
    const evolveJump = this.jumpLevel >= 5 ? 1.25 : 1;
    const upgrade = (1 + this.jumpLevel * JUMP_LEVEL_STEP)
      * this.synergy.jumpForceMult * this.mods.jumpForceMult * evolveJump;
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

      let jumpMult = JUMP_MIN_MULT + this.charge * CHARGE_JUMP_BONUS;
      // 시그니처 페어(과충전): 차지+최대치 보유 & 완충이면 점프력 +20%
      if (this.taken.has('chargeCap') && this.taken.has('charge')
        && this.charge >= this._chargeMax() - 0.001) {
        jumpMult *= 1.2;
      }
      // 퍼펙트 차지: 상한 대비 스윗스팟 구간에서 떼면 점프력·점수 보너스
      const cap = this._chargeMax();
      const rel = cap > 0 ? this.charge / cap : 0;
      const perfect = rel >= PERFECT_LO && rel <= PERFECT_HI;
      if (perfect) jumpMult *= PERFECT_JUMP_MULT;
      const cloudBoost = cloud.type === CLOUD_TYPES.BOOST ? BOOST_JUMP_MULT : 1;
      this.player.bounce(JUMP_FORCE * jumpMult * upgrade * cloudBoost);
      if (perfect) this._onPerfect();
      playJumpSound(this.charge); // 충전이 클수록 음이 높아짐
      hapticLight();
      if (cloudBoost > 1) {
        playBoostSound();
        this._addShake(3);
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
      // 시그니처 페어(공중 곡예): 점프+더블점프 보유 시 공중 점프도 지상급 위력
      const airMult = (this.taken.has('jump') && this.taken.has('doubleJump'))
        ? 1 : DOUBLE_JUMP_FORCE_MULT;
      this.player.bounce(JUMP_FORCE * upgrade * airMult);
      playJumpSound();
      hapticLight();
      this._spawnParticles(this.player.x, this.player.y + this.player.height * 0.3, '#dff3ff', 8);
    }
  }

  _cloudScale() {
    const base = this.effects.bigcloud > 0 ? BIGCLOUD_SCALE : 1;
    return base * this.mods.platformScale; // 트레이드오프(광란)로 작아질 수 있음
  }

  _chargeRate() {
    return CHARGE_RATE * (1 + this.chargeRateLevel * CHARGE_RATE_STEP) * this.mods.chargeRateMult;
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
      shockwaveRadius: 0,
      orbFillMult: 1,
      orbDoubleChance: 0,
      magnetBonus: 0,
      scoreMult: 1,
      scoreAutoGrow: false,
      fallBonus: 0,
      shieldRegen: false,
    };
  }

  _emptyLegend() {
    return {
      infiniteMagnet: false, // 무한 자석: 화면 오브 자동 수집
      hazardBreaker: false,  // 가시 파괴자: 닿아도 죽지 않고 부숨
      alwaysShockwave: false, // 파동 마스터: 착지마다 충격파
      autoRocket: false,     // 로켓 엔진: 주기적 자동 로켓
      goldFeather: false,    // 황금 깃털: 상시 저속 낙하
    };
  }

  _emptyMods() {
    return {
      jumpForceMult: 1,
      scoreMult: 1,
      orbFillMult: 1,
      coinMult: 1,
      baseSpeedMult: 1,
      platformScale: 1,
      chargeRateMult: 1,
      hazardSpeedMult: 1,
      gravityMult: 1,
    };
  }

  // 계열 보유 수(2/3/4)에 따라 세트 시너지를 다시 계산한다. 상위 단계는 하위를 포함.
  _recomputeSynergy() {
    const c = this.tagCount;
    const s = this._emptySynergy();
    const GS = GAME_SCALE;
    // 점프
    if (c.jump >= 2) s.jumpForceMult = 1.15;
    if (c.jump >= 3) { s.jumpForceMult = 1.30; s.shockwaveRadius = 90 * GS; }
    if (c.jump >= 4) { s.jumpForceMult = 1.50; s.shockwaveRadius = 150 * GS; }
    // 오브
    if (c.orb >= 2) s.orbFillMult = 1.25;
    if (c.orb >= 3) { s.orbFillMult = 1.45; s.magnetBonus = 1.5 * MAGNET_RANGE_STEP; }
    if (c.orb >= 4) { s.orbFillMult = 1.70; s.orbDoubleChance = 0.30; }
    // 점수
    if (c.score >= 2) s.scoreMult = 1.20;
    if (c.score >= 3) s.scoreMult = 1.45;
    if (c.score >= 4) { s.scoreMult = 1.75; s.scoreAutoGrow = true; }
    // 생존
    if (c.survival >= 2) s.fallBonus = this.worldHeight * 0.28;
    if (c.survival >= 3) s.fallBonus = this.worldHeight * 0.5;
    if (c.survival >= 4) s.shieldRegen = true;
    this.synergy = s;
    this.callbacks.onSynergy?.(this.getSynergyState());
  }

  // 착지 충격파 반경(0 = 없음). 시너지·전설·진화 중 가장 큰 값을 쓴다.
  _shockwaveRadius() {
    let r = this.synergy.shockwaveRadius || 0;
    if (this.jumpLevel >= 5) r = Math.max(r, 90 * GAME_SCALE); // 메가 점프 진화
    if (this.legend.alwaysShockwave) r = Math.max(r, 160 * GAME_SCALE);
    return r;
  }

  // HUD 표시용 계열 상태 + 시그니처 페어 진행도.
  getSynergyState() {
    const out = { pairs: [] };
    for (const tag of ['jump', 'orb', 'score', 'survival']) {
      const count = this.tagCount[tag];
      const tier = count >= 4 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : 0;
      const next = count < 4 ? Math.max(2, count + 1) : null; // 다음 임계까지
      out[tag] = { count, tier, next };
    }
    for (const p of SIGNATURE_PAIRS) {
      const have = p.ids.filter((id) => this.taken.has(id)).length;
      if (have > 0) out.pairs.push({ ...p, have });
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
      hapticMedium();
      this._addShake(4);
      this._spawnParticles(this.player.x, this.player.bottom, '#ff7ec2', 10);
      this.charge = 0;
      this.callbacks.onCharge?.(0, this.input.holding);
      this._registerLanding();
      return;
    }

    const onIce = cloud.type === CLOUD_TYPES.ICE;
    if (onIce) {
      // 얼음: 지그재그 없이 오던 방향 그대로 미끄러진다(수평 속도 유지).
      let sv = this.player.vx;
      if (Math.abs(sv) < 0.5) sv = this.player.facing * this.player.baseSpeed * 0.6;
      this.player.facing = sv > 0 ? 1 : -1;
      this.player.land();
      this.player.alignFeetTo(cloud.top);
      this.player.vy = 0;
      this.player.vx = sv;
    } else {
      // 착지 시 다음 점프 방향:
      // - 벽에 반사됐으면 이미 방향이 바뀌었으니 그대로 둔다.
      // - 벽에 안 부딪히고 착지했으면 반대 방향으로 전환한다(지그재그).
      if (Math.abs(this.player.vx) > 0.01) {
        const incoming = this.player.vx > 0 ? 1 : -1;
        this.player.facing = this.player.wallBounced ? incoming : -incoming;
      }
      this.player.land();
      this.player.alignFeetTo(cloud.top);
      this.player.vy = 0;
      this.player.vx = 0;
    }
    this.player.groundedCloud = cloud;
    this.player.onGround = true;
    this.charge = 0;
    this.airJumpsLeft = this.doubleJumpLevel;
    this.callbacks.onCharge?.(0, this.input.holding);

    this._registerLanding();

    const sw = this._shockwaveRadius();
    if (sw > 0) this._shockwaveAbsorb(sw, this.legend.alwaysShockwave);
  }

  // 착지 충격파: 반경 내 오브를 흡수한다. breakHazards=true 면 가시도 부순다(전설).
  _shockwaveAbsorb(r, breakHazards = false) {
    const px = this.player.x;
    const py = this.player.y;
    let absorbed = false;
    for (const orb of this.orbs) {
      if (orb.collected) continue;
      if (Math.hypot(px - orb.x, py - orb.y) <= r) {
        orb.collected = true;
        this._collectOrb(orb);
        absorbed = true;
      }
    }
    if (breakHazards) {
      for (const h of this.hazards) {
        if (h.dead) continue;
        if (Math.hypot(px - h.x, py - h.y) <= r) {
          h.dead = true;
          this.coins += 1;
          this._spawnParticles(h.x, h.y, '#ffd24a', 10);
          absorbed = true;
        }
      }
      this.hazards = this.hazards.filter((h) => !h.dead);
    }
    if (absorbed) {
      this.orbs = this.orbs.filter((o) => !o.collected);
      this.callbacks.onCoins?.(this.coins);
      this._spawnParticles(px, py, '#bfe9ff', 12);
      this._addShake(3);
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
    this.legend = this._emptyLegend();
    this.mods = this._emptyMods();
    this.autoRocketTimer = 0;
    this.combo = 0;
    this.bestLandY = Infinity;
    this.floatTexts = [];
    this.zoneShown = new Set();
    this.banner = null;
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.coinsBanked = 0;
    this.usedAdRevive = false;

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
      // 250m 이상부터 일부 가시는 상하로 물결치며 움직인다(패턴 다양화).
      const bob = (this.score > 250 && Math.random() < 0.35)
        ? { amp: this.worldHeight * 0.06, speed: 0.04 + Math.random() * 0.03 }
        : null;
      this.hazards.push(new Hazard(x, this.highestHazardY, dir * HAZARD_SPEED * factor * this.mods.hazardSpeedMult, bob));
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
    // 전설 '가시 파괴자': 닿아도 죽지 않고 부수며 코인을 얻는다(보호막 소모 없음).
    if (this.legend.hazardBreaker) {
      h.dead = true;
      this.coins += 2;
      this.callbacks.onCoins?.(this.coins);
      this._spawnParticles(h.x, h.y, '#ffd24a', 14);
      hapticMedium();
      this._addShake(4);
      return;
    }
    if (this.shield) {
      this.shield = false;
      h.dead = true;
      this._spawnParticles(h.x, h.y, '#ffd24a', 16);
      this.player.vy = -JUMP_FORCE * 0.8; // 살짝 튕겨 회피
      this.player.groundedCloud = null;
      this.callbacks.onEffects?.(this.getEffects());
      playShieldSound();
      hapticMedium();
      this._addShake(6);
    } else {
      playHazardSound();
      hapticHeavy();
      this._gameOver();
    }
  }

  _checkLanding() {
    if (this.player.groundedCloud || this.player.vy <= 0) return;

    const viewportBottom = this.cameraY + this.worldHeight;

    for (const cloud of this.clouds) {
      if (cloud.broken) continue;
      // 페이즈 구름이 투명(비실체) 상태면 통과한다.
      if (!cloud.isSolid) continue;

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
    // 페이즈 구름이 투명해지면 발밑이 사라져 떨어진다.
    if (!cloud.isSolid) {
      this.player.groundedCloud = null;
      this.player.onGround = false;
      return;
    }

    if (cloud.type === CLOUD_TYPES.MOVING) {
      this.player.x += cloud.vx;
    }

    // 얼음: 착지 후에도 계속 미끄러진다(약한 마찰). 가장자리로 미끄러지면 떨어짐.
    if (cloud.type === CLOUD_TYPES.ICE) {
      this.player.x += this.player.vx;
      this.player.vx *= 0.99;
      // 화면 벽에서 튕김(밖으로 미끄러지지 않게)
      const half = this.player.width / 2;
      if (this.player.x < half) { this.player.x = half; this.player.vx = Math.abs(this.player.vx); }
      else if (this.player.x > this.worldWidth - half) { this.player.x = this.worldWidth - half; this.player.vx = -Math.abs(this.player.vx); }
      if (Math.abs(this.player.vx) > 0.01) {
        this.player.facing = this.player.vx > 0 ? 1 : -1;
      }
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
      const permMult = (1 + this.scoreLevel * SCORE_LEVEL_STEP) * this.synergy.scoreMult * this.mods.scoreMult;
      let burstMult = this.effects.scoreX2 > 0 ? REWARD_SCORE_MULT : 1;
      // 시그니처 페어: 점수배율+로켓 → 로켓 중 점수 추가 2배
      if (this.effects.rocket > 0 && this.taken.has('scoreMul')) burstMult *= 2;
      this.score += Math.round(delta * permMult * burstMult * this._comboMult());
      this.callbacks.onScore?.(this.score);
      this._checkZone();
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

    this.player.tickAnim(ts);

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
      this.player.update(GRAVITY * this.mods.gravityMult, this.worldWidth, ts);
      // 깃털(일시) 또는 황금 깃털(전설·상시): 낙하 속도 제한
      if ((this.effects.feather > 0 || this.legend.goldFeather) && this.player.vy > FEATHER_MAX_FALL) {
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
    this._updateFloatTexts();
    if (this.banner) {
      this.banner.life -= 0.016;
      if (this.banner.life <= 0) this.banner = null;
    }
    if (this.shakeTime > 0) {
      this.shakeTime -= 1;
      if (this.shakeTime === 0) this.shakeMag = 0;
    }
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

  // 시간 기반 효과: 점수 자동 상승(시너지/복리 진화) / 보호막 재생 / 자동 로켓(전설)
  _updateSynergyTimers() {
    // 점수 배율 자동 상승: 점수 4세트 또는 '복리 점수'(점수배율 Lv5 진화)
    if ((this.synergy.scoreAutoGrow || this.scoreLevel >= 5)
      && this.frame % SYN_SCORE_AUTOGROW_FRAMES === 0) {
      this.scoreLevel += 1;
    }
    if (this.synergy.shieldRegen && !this.shield && this.frame % SYN_SHIELD_REGEN_FRAMES === 0) {
      this.shield = true;
      this.callbacks.onEffects?.(this.getEffects());
    }
    // 전설 '로켓 엔진': 약 12초마다 자동 로켓 부스트
    if (this.legend.autoRocket) {
      this.autoRocketTimer += 1;
      if (this.autoRocketTimer >= 12 * 60 && this.effects.rocket <= 0) {
        this.autoRocketTimer = 0;
        this.effects.rocket = ROCKET_DURATION;
        playRocketSound();
        this._addShake(5, 20);
        this.callbacks.onEffects?.(this.getEffects());
      }
    }
  }

  // 오브 자석 이동 + 수집 판정
  _updateOrbs() {
    const px = this.player.x;
    const py = this.player.y;
    const pickDist = this.player.width * 0.4 + ORB_PICKUP_PADDING;
    // 자석 범위 = 레벨×스텝 × 진화(자기 폭풍 Lv3=×2) + 오브 3세트 보너스
    const evolveMagnet = this.magnetLevel >= 3 ? 2 : 1;
    let magnetRange = this.magnetLevel * MAGNET_RANGE_STEP * evolveMagnet + this.synergy.magnetBonus;
    // 전설 '무한 자석': 사실상 화면 전체를 끌어당긴다.
    if (this.legend.infiniteMagnet) magnetRange = Math.max(magnetRange, this.worldWidth + this.worldHeight);
    const magnetSpeed = this.legend.infiniteMagnet ? ORB_MAGNET_SPEED * 1.6 : ORB_MAGNET_SPEED;

    for (const orb of this.orbs) {
      if (orb.collected) continue;

      const dx = px - orb.x;
      const dy = py - orb.y;
      const dist = Math.hypot(dx, dy);

      if (magnetRange > 0 && dist < magnetRange && dist > 0.01) {
        orb.x += (dx / dist) * magnetSpeed;
        orb.y += (dy / dist) * magnetSpeed;
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

    // 코인 적립. 시그니처 페어(자석+오브가치) 코인 2배 · 트레이드오프(탐욕) coinMult ·
    // 오브가치 Lv5 진화(보석 세공) 시 +1 코인.
    let coinGain = rainbow ? COIN_PER_RAINBOW : COIN_PER_ORB;
    if (this.taken.has('magnet') && this.taken.has('orbValue')) coinGain *= 2;
    if (!rainbow && this.orbValueLevel >= 5) coinGain += 1;
    coinGain = Math.round(coinGain * this.mods.coinMult);
    this.coins += coinGain;
    this.callbacks.onCoins?.(this.coins);

    // 게이지 충전 (레인보우는 즉시 가득)
    if (rainbow) {
      this.gauge = this.gaugeNeeded;
      playRainbowSound();
      hapticSuccess();
      this._spawnParticles(orb.x, orb.y, 'rainbow', 18);
    } else {
      let fill = ORB_GAUGE_FILL * (1 + this.orbValueLevel * ORB_VALUE_STEP);
      fill *= this.synergy.orbFillMult * this.mods.orbFillMult; // 오브 세트 + 트레이드오프
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

  // 화면 흔들림 추가(더 센 요청이 오면 덮어쓴다). '동작 줄이기' 시 무시.
  _addShake(mag, frames = 12) {
    if (this.reduceMotion) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, frames);
  }

  // ── 콤보: 연속 상승 착지로 배율을 쌓고, 크게 추락하면 리셋 ──
  _comboMult() {
    return 1 + Math.min(this.combo, 40) * 0.015; // 콤보당 +1.5%, 최대 +60%
  }

  _registerLanding() {
    const y = this.player.y;
    if (y < this.bestLandY - 1) {
      // 더 높이 올라 착지 → 콤보 +1
      this.combo += 1;
      this.bestLandY = y;
      if (this.combo >= 5 && this.combo % 5 === 0) {
        this._addFloatText(this.player.x, this.player.y - this.player.height * 0.7, t('combo.milestone', { n: this.combo }), '#ff9e3d', 1.05);
        this._addShake(2);
      }
    } else if (y > this.bestLandY + this.worldHeight * 0.9) {
      // 한 화면 이상 추락 후 착지 → 콤보 끊김
      if (this.combo >= 8) {
        this._addFloatText(this.player.x, this.player.y - this.player.height * 0.7, t('combo.break'), '#9aa7b0', 0.9);
      }
      this.combo = 0;
      this.bestLandY = y;
    }
    this.callbacks.onCombo?.(this.combo, this._comboMult());
  }

  // 퍼펙트 차지 성공 연출 + 점수 보너스
  _onPerfect() {
    const bonus = Math.round(PERFECT_SCORE_BONUS * (1 + this.scoreLevel * SCORE_LEVEL_STEP));
    this.score += bonus;
    this.callbacks.onScore?.(this.score);
    this._addFloatText(this.player.x, this.player.y - this.player.height * 0.6, t('game.perfect', { n: bonus }), '#ffe08a', 1.05);
    this._spawnParticles(this.player.x, this.player.bottom, '#ffe9a8', 12);
    playPerfectSound();
    hapticMedium();
  }

  // ── 떠오르는 텍스트(점수 팝업/콤보) ──
  _addFloatText(x, y, text, color = '#ffffff', scale = 1) {
    this.floatTexts.push({ x, y, text, color, scale, life: 1, vy: -0.7 * GAME_SCALE });
  }

  _updateFloatTexts() {
    for (const f of this.floatTexts) {
      f.y += f.vy;
      f.vy *= 0.95;
      f.life -= 0.018;
    }
    if (this.floatTexts.length) this.floatTexts = this.floatTexts.filter((f) => f.life > 0);
  }

  _drawFloatTexts() {
    const ctx = this.ctx;
    for (const f of this.floatTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      ctx.font = `${Math.round(15 * GAME_SCALE * f.scale)}px Jua, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(45,52,54,0.4)';
      ctx.fillStyle = f.color;
      const sy = f.y - this.cameraY;
      ctx.strokeText(f.text, f.x, sy);
      ctx.fillText(f.text, f.x, sy);
      ctx.restore();
    }
  }

  // ── 고도 구역 진입 배너(화면 중앙, 짧게) ──
  _showBanner(text) {
    this.banner = { text, life: 1.5 };
  }

  _checkZone() {
    const ZONES = [
      [224, 'zone.sunset'],
      [400, 'zone.dusk'],
      [576, 'zone.night'],
      [800, 'zone.space'],
    ];
    for (const [th, key] of ZONES) {
      if (this.score >= th && !this.zoneShown.has(th)) {
        this.zoneShown.add(th);
        this._showBanner(t(key));
      }
    }
  }

  _drawBanner() {
    if (!this.banner) return;
    const ctx = this.ctx;
    const b = this.banner;
    const a = Math.min(1, b.life * 1.2) * Math.min(1, (1.5 - b.life) * 3 + 0.2);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(26 * GAME_SCALE)}px Jua, sans-serif`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(45,52,54,0.45)';
    ctx.fillStyle = '#ffffff';
    const x = this.worldWidth / 2;
    const y = this.worldHeight * 0.3;
    ctx.strokeText(b.text, x, y);
    ctx.fillText(b.text, x, y);
    ctx.restore();
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
    // 더블 점프가 최대(3회)면 더 이상 제공하지 않는다.
    if (this.doubleJumpLevel >= DOUBLE_JUMP_MAX_LEVEL) exclude.push('doubleJump');
    // 유니크(전설·트레이드오프)는 이미 획득했으면 제외한다.
    for (const r of REWARDS) {
      if (r.unique && this.taken.has(r.id)) exclude.push(r.id);
    }
    const choices = pickRewardChoices(3, this._rewardProgress(), exclude).map((r) => {
      const level = this._rewardLevel(r.id);
      const out = { ...r, level };
      // 진화 정보: 이미 진화했는지 / 이번에 고르면 진화하는지
      if (r.evolveAt != null && level != null) {
        out.evolved = level >= r.evolveAt;
        out.willEvolve = level + 1 === r.evolveAt;
      }
      return out;
    });
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
      case 'doubleJump': this.doubleJumpLevel = Math.min(DOUBLE_JUMP_MAX_LEVEL, this.doubleJumpLevel + 1); break; // 최대 3회
      case 'scoreMul': this.scoreLevel += 1; break; // 영구 누적
      case 'orbValue': this.orbValueLevel += 1; break; // 영구 누적
      case 'charge': this.chargeRateLevel += 1; break; // 영구 누적
      case 'chargeCap': this.chargeCapLevel += 1; break; // 영구 누적(점프 파워 최대치 ↑)
      case 'rocket': this.effects.rocket = ROCKET_DURATION; playRocketSound(); hapticSuccess(); this._addShake(5, 20); break;
      case 'coinBonus':
        this.coins += COIN_REWARD_AMOUNT;
        this.callbacks.onCoins?.(this.coins);
        break;

      // ── 트레이드오프(강력 + 대가) ──
      case 'trFrenzy': // 점수 +50% / 발판 -18%
        this.mods.scoreMult *= 1.5;
        this.mods.platformScale *= 0.82;
        break;
      case 'trGlass': // 점프력 +40% / 차지 -30%
        this.mods.jumpForceMult *= 1.4;
        this.mods.chargeRateMult *= 0.7;
        break;
      case 'trGreed': // 오브 충전 +60% · 코인 2배 / 가시 +40% 속도
        this.mods.orbFillMult *= 1.6;
        this.mods.coinMult *= 2;
        this.mods.hazardSpeedMult *= 1.4;
        break;
      case 'trRush': // 이동 +30% / 중력 +15%
        this.mods.baseSpeedMult *= 1.3;
        this.mods.gravityMult *= 1.15;
        if (this.player) this.player.baseSpeed *= 1.3;
        break;

      // ── 전설(룰 변경 유니크) ──
      case 'legMagnet': this.legend.infiniteMagnet = true; break;
      case 'legHazard': this.legend.hazardBreaker = true; break;
      case 'legShock': this.legend.alwaysShockwave = true; break;
      case 'legRocket': this.legend.autoRocket = true; this.autoRocketTimer = 0; break;
      case 'legFeather': this.legend.goldFeather = true; break;

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
    hapticMedium();
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
      // 진화 여부(레벨 badge 에 ★ 표시용)
      evolved: {
        jump: this.jumpLevel >= 5,
        magnet: this.magnetLevel >= 3,
        scoreMul: this.scoreLevel >= 5,
        orbValue: this.orbValueLevel >= 5,
      },
      // 전설 보유(전용 badge)
      legends: { ...this.legend },
    };
  }

  getCoins() {
    return this.coins;
  }

  _gameOver() {
    this.state = 'gameover';
    playGameOverSound();
    hapticHeavy();
    // 이번 판 코인 중 아직 적립하지 않은 만큼만 메타 저장소에 누적한다.
    // (광고 이어하기로 판이 이어지면 _gameOver 가 두 번 불리므로 중복 적립 방지)
    const earned = this.mode === 'adventure' ? this.coins : 0;
    const delta = Math.max(0, earned - this.coinsBanked);
    if (delta > 0) {
      addCoins(delta);
      this.coinsBanked = earned;
    }
    const isNewRecord = saveBestScore(this.mode, this.score);
    // 광고 이어하기: 판당 1회만 제공
    const canRevive = !this.usedAdRevive;
    this.callbacks.onGameOver?.(this.score, isNewRecord, earned, { canRevive });
  }

  // 광고 시청 성공 후 그 자리에서 부활해 이어서 플레이한다(판당 1회).
  reviveByAd() {
    if (this.usedAdRevive || this.state !== 'gameover') return false;
    this.usedAdRevive = true;
    this.combo = 0;
    this.bestLandY = Infinity;
    this.callbacks.onCombo?.(0, 1);
    this.hazards = []; // 부활 직후 즉사 방지: 주변 가시 제거
    this._revive(); // 화면 중앙으로 끌어올리고 받쳐줄 구름 생성
    this.effects.feather = FEATHER_DURATION; // 잠깐 부드럽게 하강 → 안전 착지 여유
    this.callbacks.onEffects?.(this.getEffects());
    this.shakeTime = 0;
    this.state = 'playing';
    if (this._loopId) cancelAnimationFrame(this._loopId);
    this._loop();
    return true;
  }

  // 일시정지 / 재개 (플레이 중에만)
  pause() {
    if (this.state !== 'playing') return false;
    this.state = 'paused';
    if (this._loopId) cancelAnimationFrame(this._loopId);
    this.input.holding = false; // 재개 시 의도치 않은 차지 방지
    this.callbacks.onCharge?.(this.charge, false);
    return true;
  }

  resume() {
    if (this.state !== 'paused') return false;
    this.state = 'playing';
    if (this._loopId) cancelAnimationFrame(this._loopId);
    this._loop();
    return true;
  }

  // 일시정지 중 메뉴로 나갈 때: 점수·코인을 저장하고 판을 종료한다(진행 손실 방지).
  abandonRun() {
    if (this.state !== 'paused' && this.state !== 'playing') return;
    if (this._loopId) cancelAnimationFrame(this._loopId);
    const earned = this.mode === 'adventure' ? this.coins : 0;
    const delta = Math.max(0, earned - this.coinsBanked);
    if (delta > 0) {
      addCoins(delta);
      this.coinsBanked = earned;
    }
    saveBestScore(this.mode, this.score);
    this.state = 'gameover';
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
    // 배경은 흔들지 않는다(가장자리 빈 틈 방지). 월드 레이어만 흔든다.
    this._drawBackground();

    const ctx = this.ctx;
    let shaking = false;
    if (this.shakeTime > 0 && this.shakeMag > 0) {
      const m = this.shakeMag * Math.min(1, this.shakeTime / 12);
      const ox = (Math.random() * 2 - 1) * m;
      const oy = (Math.random() * 2 - 1) * m;
      ctx.save();
      ctx.translate(ox, oy);
      shaking = true;
    }

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

    this._drawFloatTexts();

    if (shaking) ctx.restore();

    this._drawBanner();

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
    ctx.fillText(t('game.readyHint'), this.worldWidth / 2, this.worldHeight - 48 * GAME_SCALE);
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
