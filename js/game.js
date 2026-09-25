import { Player } from './player.js';
import { Cloud, CLOUD_TYPES, pickCloudType, randomCloudWidth } from './cloud.js';
import { Orb, pickRewardChoices, REWARDS, SIGNATURE_PAIRS } from './orb.js';
import { Hazard } from './hazard.js';
import { BalloonWhale } from './whale.js';
import { CoinPickup } from './coin.js';
import { SoapToken } from './soap.js';
import { LetterToken, LETTERS } from './letters.js';
import { getBestScore, saveBestScore } from './score.js';
import { addCoins } from './meta.js';
import { t, getFont } from './i18n.js';
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
  CHARGE_HOLD_FRAMES,
  PERFECT_LO,
  PERFECT_LO_STEP,
  SOAP_NEEDED,
  SOAP_GAP,
  SOAP_CHANCE,
  BUBBLE_BLOW_FRAMES,
  BUBBLE_FLOAT_FRAMES,
  BUBBLE_FLOAT_METERS,
  BUBBLE_SCORE_MULT,
  BUBBLE_POP_GRACE_FRAMES,
  BUBBLE_HIT_RADIUS,
  BUBBLE_EXIT_PREP_FRAMES,
  BUBBLE_EXIT_JUMP_MULT,
  COIN_BONUS_STEP,
  PERFECT_HI,
  PERFECT_JUMP_MULT,
  PERFECT_SCORE_BONUS,
  CLOUD_GAP_MIN,
  CLOUD_GAP_MAX,
  CLOUD_OVERLAP_NEIGHBORS,
  CLOUD_OVERLAP_TRIES,
  CLOUD_OVERLAP_PAD,
  CLOUD_OVERLAP_MAX_PUSH,
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
  WHALE_START_SCORE,
  WHALE_CHANCE,
  WHALE_MIN_GAP,
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
  CLASSIC_METERS_PER_COIN,
  COIN_PICKUP_VALUE,
  COIN_PICKUP_GAP,
  COIN_PICKUP_CHANCE,
  LETTER_GAP_METERS,
  LETTER_SCORE_BONUS,
  LETTER_SCORE_STEP,
  LETTER_DUPLICATE_COINS,
  ZAP_COOLDOWN_FRAMES,
  BOOSTER_JUMP_MULT,
} from './config.js';

// 이미지 로딩 실패 시 기존 배경을 유지한다.
let skyBgImg = null;
let skyBgReady = false;
if (typeof Image !== 'undefined') {
  skyBgImg = new Image();
  skyBgImg.onload = () => { skyBgReady = true; };
  skyBgImg.onerror = () => { skyBgReady = false; };
  skyBgImg.src = 'assets/sky-bg.png';
}

// 같은 크기의 다섯 세로 패널: 낮, 노을, 황혼, 밤, 우주.
const PIXEL_SKY_STOPS = [0, 0.28, 0.5, 0.72, 1];
let pixelSkyReady = false;
let pixelSkySource = null;
const pixelSky = typeof Image !== 'undefined' ? new Image() : null;
if (pixelSky) {
  pixelSky.onload = () => {
    pixelSkyReady = pixelSky.naturalWidth >= 5 && pixelSky.naturalHeight > 0;
    if (!pixelSkyReady) return;
    // Flatten generated alpha once so adjacent skies cannot show through dark pixels.
    pixelSkySource = document.createElement('canvas');
    pixelSkySource.width = pixelSky.naturalWidth;
    pixelSkySource.height = pixelSky.naturalHeight;
    const skyContext = pixelSkySource.getContext('2d');
    const colors = ['#85bcec', '#f4ab8b', '#7763a9', '#1b2550', '#090f26'];
    colors.forEach((color, index) => {
      skyContext.fillStyle = color;
      const left = Math.round(index * pixelSky.naturalWidth / 5);
      const right = Math.round((index + 1) * pixelSky.naturalWidth / 5);
      skyContext.fillRect(left, 0, right - left, pixelSky.naturalHeight);
    });
    skyContext.drawImage(pixelSky, 0, 0);
  };
  pixelSky.onerror = () => { pixelSkyReady = false; };
  pixelSky.src = 'assets/sky-pixel-atlas.png';
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
    this.chargeHold = 0;
    this.stars = [];

    this.orbs = [];
    this.hazards = [];
    this.particles = [];
    this.soaps = [];
    this.soap = 0;
    this.bubble = null;
    this.bubbleGrace = 0;
    this.cat = 'default';
    this.gauge = 0;
    this.gaugeNeeded = GAUGE_MAX;
    this.rewardCount = 0;
    this.rerollCount = 0;
    this.rawClimb = 0;
    this.frame = 0;
    this.coins = 0;
    this.coinMult = 1;
    this.perfectLo = PERFECT_LO;
    this.airJumpsLeft = 0;
    this.shields = 0; // 남은 보호막 개수(영구 강화·소모품·보상이 더해진다)
    this.consumables = {};
    this.boosterCharges = 0;
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
    // 배너가 뜨고 사라지면 #app 의 padding 이 바뀌어 캔버스 표시 크기만 달라진다.
    // 이때 window resize 는 발생하지 않으므로 직접 관찰해서 다시 계산한다.
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this._resize()).observe(this.canvas);
    }
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
      if (!holding) this.input.clientX = null;
      this._syncDirectionCloud();
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
      this.input.clientX = e.touches[0]?.clientX ?? null;
      this._syncDirectionCloud();
    }, { passive: false });

    this.touchRoot.addEventListener('touchmove', (e) => {
      if (!this.input.holding || (this.state !== 'ready' && this.state !== 'playing')) return;
      e.preventDefault();
      this.input.clientX = e.touches[0]?.clientX ?? null;
      this._syncDirectionCloud();
    }, { passive: false });

    this.touchRoot.addEventListener('touchend', (e) => {
      const stillHolding = e.touches.length > 0;
      if (!stillHolding && this.input.holding) {
        this.input.clientX = e.changedTouches[0]?.clientX ?? this.input.clientX;
        this._syncDirectionCloud();
        onRelease();
      }
      if (stillHolding) this.input.clientX = e.touches[0].clientX;
      setHolding(stillHolding);
    });
    this.touchRoot.addEventListener('touchcancel', (e) => {
      const stillHolding = e.touches.length > 0;
      if (stillHolding) this.input.clientX = e.touches[0].clientX;
      setHolding(stillHolding);
    });
  }

  _syncDirectionCloud() {
    const cloud = this.player?.groundedCloud;
    if (cloud?.type !== CLOUD_TYPES.DIRECTION) return;
    if (!this.input.holding || !Number.isFinite(this.input.clientX)) {
      cloud.directionChoice = 0;
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    cloud.directionChoice = this.input.clientX < rect.left + rect.width / 2 ? -1 : 1;
    this.player.facing = cloud.directionChoice;
  }

  _initDecor() {
    this.stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * this.worldWidth,
      y: Math.random() * this.worldHeight * 3,
      size: (Math.random() * 2 + 1) * GAME_SCALE,
      alpha: Math.random() * 0.5 + 0.2,
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
    if (this.bubble?.phase === 'float') {
      this._jumpOutOfBubble(); // 떠 있는 동안 누르면 방울을 터뜨리며 뛰어나간다
      return;
    }
    if (this._bubbleHolds()) return; // 비눗방울을 부는 중이거나 뛰어나갈 준비 중
    // 점프력 배율 = 레벨 보너스 × 시너지 × 트레이드오프 × 진화(메가 점프)
    const evolveJump = this.jumpLevel >= 5 ? 1.25 : 1;
    const upgrade = (1 + this.jumpLevel * JUMP_LEVEL_STEP)
      * this.synergy.jumpForceMult * this.mods.jumpForceMult * evolveJump;
    const cloud = this.player.groundedCloud;

    if (cloud) {
      if (cloud.broken) return;

      if (cloud.type === CLOUD_TYPES.DIRECTION && cloud.directionChoice !== 0) {
        this.player.facing = cloud.directionChoice;
        this.player.vx = cloud.directionChoice * this.player.baseSpeed;
        this.startFromLeft = false;
      } else if (Math.abs(this.player.vx) < 0.01) {
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
      const perfect = rel >= this.perfectLo && rel <= PERFECT_HI;
      if (perfect) jumpMult *= PERFECT_JUMP_MULT;
      const cloudBoost = cloud.type === CLOUD_TYPES.BOOST ? BOOST_JUMP_MULT : 1;
      // 소모품 '출발 부스터': 그 판의 첫 점프만 크게 솟는다.
      let boosterMult = 1;
      if (this.boosterCharges > 0) {
        this.boosterCharges -= 1;
        boosterMult = BOOSTER_JUMP_MULT;
        this._spawnParticles(this.player.x, this.player.y + this.player.height * 0.4, '#ff8a3d', 18);
        playBoostSound();
        hapticHeavy();
      }
      this.player.bounce(JUMP_FORCE * jumpMult * upgrade * cloudBoost * boosterMult);
      if (cloud.type === CLOUD_TYPES.DIRECTION) cloud.directionChoice = 0;
      if (perfect) this._onPerfect();
      playJumpSound(this.charge); // 충전이 클수록 음이 높아짐
      hapticLight();
      if (cloudBoost > 1) {
        playBoostSound();
        this._addShake(3);
        this._spawnParticles(this.player.x, this.player.bottom, '#7fdcff', 8);
      }
      this.charge = 0;
      this.chargeHold = 0;
      this.callbacks.onCharge?.(0, false);
      this.airJumpsLeft = this.doubleJumpLevel;

      if (cloud.type === CLOUD_TYPES.BREAKING) {
        cloud.broken = true;
        playBreakSound();
      } else if (cloud.type === CLOUD_TYPES.GLASS) {
        cloud.startGlassFade();
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

  // 게이지를 한 프레임 진행시킨다. 최대치에 닿으면 CHARGE_HOLD_FRAMES 동안
  // 그대로 머물렀다가 0 으로 돌아가 처음부터 다시 차오른다. 최대에서 계속
  // 멈춰 있으면 타이밍을 놓쳤을 때 작은 점프를 할 방법이 없기 때문이다.
  _advanceCharge() {
    const max = this._chargeMax();
    if (max <= 0) return;

    if (this.chargeHold > 0) {
      this.chargeHold -= 1;
      if (this.chargeHold === 0) this.charge = 0; // 유지가 끝나면 처음부터
      this.callbacks.onCharge?.(this.charge, true);
      return;
    }

    const next = this.charge + this._chargeIncrement();
    if (next >= max) {
      this.charge = max;
      this.chargeHold = CHARGE_HOLD_FRAMES;
    } else {
      this.charge = next;
    }

    this.callbacks.onCharge?.(this.charge, true);
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
    const half = (cloud.width * (cloud.type === CLOUD_TYPES.WHALE ? 1 : this._cloudScale())) / 2;
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
      if (this.bubble?.phase === 'pop' || this.bubble?.phase === 'exit') this._setBubble(null);
      this.player.bounce(BOUNCE_FORCE);
      this.airJumpsLeft = this.doubleJumpLevel;
      playBounceSound();
      hapticMedium();
      this._addShake(4);
      this._spawnParticles(this.player.x, this.player.bottom, '#ff7ec2', 10);
      this.charge = 0;
      this.chargeHold = 0;
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
    this.chargeHold = 0;
    this.airJumpsLeft = this.doubleJumpLevel;
    this.callbacks.onCharge?.(0, this.input.holding);

    this._registerLanding();

    const sw = this._shockwaveRadius();
    if (sw > 0) this._shockwaveAbsorb(sw, this.legend.alwaysShockwave);

    if (this.bubble?.phase === 'pop' || this.bubble?.phase === 'exit') this._setBubble(null);
    // 비눗방울 고양이: 비눗방울물 게이지가 찬 채로 착지하면 비눗방울을 분다.
    if (this.cat === 'bubble' && this.soap >= SOAP_NEEDED && !this.bubble && this.effects.rocket <= 0) {
      this._startBubble();
    }
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

  start(mode = 'classic', consumables = {}) {
    this.mode = mode;
    this.consumables = consumables;
    this.state = 'ready';
    this.score = 0;
    this.cameraY = 0;
    this.highestY = 0;

    this.orbs = [];
    this.hazards = [];
    this.particles = [];
    this.platformSpawnCount = 0;
    this.sinceWhale = 0;
    this.lastZapFrame = -999;
    this.coinPickups = [];
    this.highestCoinY = 0;
    this.letters = [];
    this.highestLetterY = 0;
    this.nextLetter = 0;          // 다음에 놓을 글자 후보(0=P … 4=G)
    this.collectedLetters = new Set(); // 이번 세트에서 모은 글자(인덱스)
    this.letterSets = 0;          // 완성한 세트 수
    this.gauge = 0;
    this.gaugeNeeded = GAUGE_MAX;
    this.rewardCount = 0;
    this.rerollCount = 0;
    this.rawClimb = 0;
    this.frame = 0;
    this.coins = 0;
    this.airJumpsLeft = 0;
    this.shields = 0;
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

    // 상점 영구 업그레이드는 두 모드 모두 적용한다.
    // 단 시작 게이지는 오브·보상 카드가 있는 어드벤처에서만 의미가 있다.
    const meta = this.callbacks.getStartBonuses?.() ?? {};
    this.jumpLevel = meta.jumpLevel ?? 0;
    this.scoreLevel = meta.scoreLevel ?? 0;
    this.coinMult = 1 + (meta.coinLevel ?? 0) * COIN_BONUS_STEP;
    this.cat = meta.cat ?? 'default';
    this.perfectLo = PERFECT_LO - (meta.perfectLevel ?? 0) * PERFECT_LO_STEP;
    // 보호막은 소모품으로만 갖고 시작한다(영구 강화에서 제외).
    // 소모품은 시작 화면에서 켜고 시작할 때 main.js 가 이미 한 개 차감해 넘겨준다.
    this.shields = this.consumables.shieldItem ? 1 : 0;
    this.boosterCharges = this.consumables.booster ? 1 : 0;
    if (this.mode === 'adventure') {
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
    for (let i = 0; i < 24; i++) {
      y -= this._cloudGap();
      const cloud = this._placeCloud(y, this._nextPlatformType(0), randomCloudWidth());
      this.clouds.push(cloud);
      y = cloud.y;
    }

    this.highestSpawnedY = this.clouds.reduce((min, c) => (c.y < min ? c.y : min), startY);
    this.highestOrbY = startY;
    this.highestHazardY = startY;
    this.highestCoinY = startY;
    this.coinPickups = [];
    this.highestSoapY = startY;
    this.soaps = [];
    this.soap = 0;
    this._setBubble(null);
    this.bubbleGrace = 0;
    this.callbacks.onSoap?.(0, this.cat === 'bubble');
    this.highestLetterY = startY;
    this.letters = [];
    this.nextLetter = 0;
    this.collectedLetters = new Set();
    this.letterSets = 0;
    this._spawnOrbs(); // 시작 화면(대기 상태)부터 오브가 보이도록 미리 생성
    this._spawnCoinPickups(); // 코인도 시작부터 보이게
    this._spawnSoaps();
    this._spawnLetters();

    this._initDecor();
    this.input = { holding: false };
    this.charge = 0;
    this.chargeHold = 0;
    this.callbacks.onCharge?.(0, false);

    if (this._loopId) cancelAnimationFrame(this._loopId);
    this._loop();
  }

  // 구름 세로 간격. 초반(저고도)엔 좁혀서 촘촘하게 → 두 모드 모두 시작이 수월.
  // 0~250m 사이에서 기본 간격으로 부드럽게 넓어진다.
  _cloudGap() {
    const t = Math.min(1, this.score / 250);
    const factor = 0.62 + 0.38 * t; // 시작 62% 간격 → 100%
    return (CLOUD_GAP_MIN + Math.random() * (CLOUD_GAP_MAX - CLOUD_GAP_MIN)) * factor;
  }

  // 고도가 오를수록 구름이 아주 천천히 작아진다(1500m에서 30% 작게, 하한 유지).
  _cloudSpawnWidth() {
    const t = Math.min(1, this.score / 1500);
    const factor = 1 - 0.3 * t;
    return Math.round(randomCloudWidth() * factor);
  }

  // 새 구름의 위치를 정한다. 그림이 바로 아래 구름들과 겹치면 가로 위치를 다시 뽑고,
  // 가로로 피할 자리가 없으면(움직이는 구름이 이웃이거나 화면이 좁을 때) 겹치지 않을
  // 만큼만 위로 올린다. 올리는 폭은 CLOUD_OVERLAP_MAX_PUSH 로 제한해서, 기본 충전 점프
  // (약 260px)로 닿지 못할 만큼 간격이 벌어지는 일은 없게 한다.
  _nextPlatformType(score) {
    this.platformSpawnCount += 1;
    this.sinceWhale += 1;
    const canWhale = score >= WHALE_START_SCORE && this.sinceWhale >= WHALE_MIN_GAP;
    if (canWhale && Math.random() < WHALE_CHANCE) {
      this.sinceWhale = 0;
      return CLOUD_TYPES.WHALE;
    }
    return pickCloudType(score);
  }

  _placeCloud(y, type, width) {
    const cloud = type === CLOUD_TYPES.WHALE ? new BalloonWhale(0, y) : new Cloud(0, y, type, width);
    const neighbors = this.clouds.slice(-CLOUD_OVERLAP_NEIGHBORS);
    const randomX = () => Math.random() * (this.worldWidth - CLOUD_SPAWN_PADDING) + CLOUD_SPAWN_MARGIN_X;

    for (let i = 0; i < CLOUD_OVERLAP_TRIES; i++) {
      cloud.x = randomX();
      if (this._overlapPush(cloud, neighbors) === 0) return cloud;
    }

    const push = this._overlapPush(cloud, neighbors);
    if (type === CLOUD_TYPES.WHALE && push > CLOUD_OVERLAP_MAX_PUSH) {
      return this._placeCloud(y, CLOUD_TYPES.NORMAL, width);
    }
    if (push <= CLOUD_OVERLAP_MAX_PUSH) cloud.y -= push;
    return cloud;
  }

  // cloud 를 이웃과 겹치지 않게 하려면 위로 몇 px 올려야 하는지. 0 이면 이미 안 겹친다.
  _overlapPush(cloud, neighbors) {
    const a = cloud.visualBounds(this.worldWidth);
    let push = 0;
    for (const other of neighbors) {
      const b = other.visualBounds(this.worldWidth);
      const overlapX = a.left < b.right + CLOUD_OVERLAP_PAD && a.right > b.left - CLOUD_OVERLAP_PAD;
      const overlapY = a.top < b.bottom + CLOUD_OVERLAP_PAD && a.bottom > b.top - CLOUD_OVERLAP_PAD;
      if (overlapX && overlapY) {
        push = Math.max(push, a.bottom - (b.top - CLOUD_OVERLAP_PAD));
      }
    }
    return push;
  }

  _spawnClouds() {
    const spawnAbove = this.cameraY - this.worldHeight * SPAWN_LOOKAHEAD;

    if (this.highestSpawnedY <= spawnAbove) return;

    let y = this.highestSpawnedY;
    while (y > spawnAbove) {
      const gap = this._cloudGap();
      y -= gap;
      const cloud = this._placeCloud(y, this._nextPlatformType(this.score), this._cloudSpawnWidth());
      this.clouds.push(cloud);
      y = cloud.y;
      this.highestSpawnedY = y;
    }

    const cullBelow = this.cameraY + this.worldHeight + CULL_BELOW_PADDING;
    this.clouds = this.clouds.filter((c) => c.y < cullBelow && !c.dead);
    this.orbs = this.orbs.filter((o) => !o.collected && o.y < cullBelow);
    this.coinPickups = this.coinPickups.filter((c) => c.y < cullBelow);
    this.soaps = this.soaps.filter((sp) => sp.y < cullBelow);
    this.letters = this.letters.filter((tk) => tk.y < cullBelow);
  }

  // 코인: 두 모드 모두, 일정 간격마다 확률로 하나씩 띄운다.
  _spawnCoinPickups() {
    const spawnAbove = this.cameraY - this.worldHeight * SPAWN_LOOKAHEAD;
    while (this.highestCoinY > spawnAbove) {
      this.highestCoinY -= COIN_PICKUP_GAP * (0.7 + Math.random() * 0.6);
      if (Math.random() > COIN_PICKUP_CHANCE) continue;
      const margin = this.worldWidth * 0.12;
      const x = margin + Math.random() * (this.worldWidth - margin * 2);
      this.coinPickups.push(new CoinPickup(x, this.highestCoinY));
    }
  }

  // ── 비눗방울 고양이 ──
  // 비눗방울물: 비눗방울 고양이를 입었을 때만, 두 모드 모두 일정 간격마다 확률로 놓는다.
  _spawnSoaps() {
    if (this.cat !== 'bubble') return;
    const spawnAbove = this.cameraY - this.worldHeight * SPAWN_LOOKAHEAD;
    while (this.highestSoapY > spawnAbove) {
      this.highestSoapY -= SOAP_GAP * (0.8 + Math.random() * 0.4);
      if (Math.random() > SOAP_CHANCE) continue;
      const margin = this.worldWidth * 0.14;
      const x = margin + Math.random() * (this.worldWidth - margin * 2);
      this.soaps.push(new SoapToken(x, this.highestSoapY));
    }
  }

  _collectSoaps() {
    if (!this.soaps.length) return;
    const reach = this.player.width * 0.32;
    for (const sp of this.soaps) {
      if (sp.collected) continue;
      if (Math.hypot(this.player.x - sp.x, this.player.y - sp.y) > sp.r + reach) continue;
      sp.collected = true;
      this.soap = Math.min(SOAP_NEEDED, this.soap + 1);
      this.callbacks.onSoap?.(this.soap / SOAP_NEEDED, true);
      this._spawnParticles(sp.x, sp.y, '#8bf0e1', 10);
      playCollectSound();
      hapticLight();
    }
    this.soaps = this.soaps.filter((sp) => !sp.collected);
  }

  // bubble: null | { phase: 'blow' | 'float' | 'exit' | 'pop', t, launched? }
  // 'exit' 는 방울 속에서 스스로 뛰어나가는 동작: 준비 동안은 계속 떠 있다가(launched=false) 점프한다.
  _setBubble(bubble) {
    this.bubble = bubble;
    if (this.player) this.player.bubbleAnim = bubble ? { phase: bubble.phase, t: 0 } : null;
  }

  // 게이지가 찬 채로 구름에 착지하면 호출: 구름 위에서 비눗방울을 분다.
  _startBubble() {
    this.soap = 0;
    this.callbacks.onSoap?.(0, true);
    this.charge = 0;
    this.chargeHold = 0;
    this.callbacks.onCharge?.(0, false);
    this._setBubble({ phase: 'blow', t: 0 });
  }

  // 방울이 고양이를 붙잡고 있는 상태(불기·부양·뛰어나갈 준비): 점프·착지·일반 물리를 막고, 점수는 절반.
  _bubbleHolds() {
    const b = this.bubble;
    return !!b && (b.phase === 'blow' || b.phase === 'float' || (b.phase === 'exit' && !b.launched));
  }

  _jumpOutOfBubble() {
    this._setBubble({ phase: 'exit', t: 0, launched: false });
  }

  _popBubble() {
    if (!this.bubble || this.bubble.phase === 'pop') return;
    this.player.groundedCloud = null;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.jumpPeakVy = JUMP_FORCE; // 떨어지는 점프 그림으로 이어지게
    this.bubbleGrace = BUBBLE_POP_GRACE_FRAMES;
    this._spawnParticles(this.player.x, this.player.y, '#bfefff', 14);
    playBreakSound();
    hapticMedium();
    this._setBubble({ phase: 'pop', t: 0 });
  }

  // 매 프레임: 부는 중이면 구름에 붙어 있고, 떠 있으면 일정 속도로 올라간다.
  // 이 동안은 일반 물리(착지·고래·번개)를 건너뛴다. true 를 돌려주면 이번 프레임 이동을 처리한 것.
  _updateBubble(ts) {
    const b = this.bubble;
    if (this.bubbleGrace > 0) this.bubbleGrace -= ts;
    if (!b) return false;
    b.t += ts;
    if (this.player.bubbleAnim) this.player.bubbleAnim.t = b.t;

    if (b.phase === 'blow') {
      const cloud = this.player.groundedCloud;
      if (!cloud || cloud.broken || !cloud.isSolid) {
        this._popBubble(); // 발밑 구름이 사라지면 불다 말고 떨어진다
        return false;
      }
      if (cloud.type === CLOUD_TYPES.MOVING) this.player.x += cloud.vx * ts;
      this.player.alignFeetTo(cloud.top);
      this.player.vy = 0;
      if (b.t >= BUBBLE_BLOW_FRAMES) {
        this.player.groundedCloud = null;
        this.player.onGround = false;
        this._setBubble({ phase: 'float', t: 0 });
      }
      return true;
    }
    if (b.phase === 'float' || (b.phase === 'exit' && !b.launched)) {
      const speed = (BUBBLE_FLOAT_METERS * SCORE_DIVISOR) / BUBBLE_FLOAT_FRAMES;
      this.player.vx = 0;
      this.player.vy = -speed;
      this.player.y -= speed * ts;
      if (b.phase === 'float' && b.t >= BUBBLE_FLOAT_FRAMES) this._popBubble();
      if (b.phase === 'exit' && b.t >= BUBBLE_EXIT_PREP_FRAMES) {
        // 방울이 터지며 위로 뛰어오른다. 이후는 보통 점프처럼 떨어지고 착지한다.
        b.launched = true;
        this.player.vx = this.player.facing * this.player.baseSpeed;
        this.player.bounce(JUMP_FORCE * BUBBLE_EXIT_JUMP_MULT);
        this._spawnParticles(this.player.x, this.player.y, '#bfefff', 14);
        playJumpSound(0.8);
        hapticLight();
        return false;
      }
      return true;
    }
    // pop: 일반 물리로 떨어진다. 그림은 player 가 터지는 동작을 한 번 보여준 뒤 점프 그림으로 돌아간다.
    return false;
  }

  // 글자: 순서대로 하나씩, 좌우로 흩어지게 놓는다.
  _spawnLetters() {
    if (this.mode !== 'adventure') return; // 일반 모드는 순수 점프만 — POING 글자 없음
    const spawnAbove = this.cameraY - this.worldHeight * SPAWN_LOOKAHEAD;
    const gap = LETTER_GAP_METERS * SCORE_DIVISOR;
    while (this.highestLetterY > spawnAbove) {
      this.highestLetterY -= gap * (0.85 + Math.random() * 0.3);
      const index = this.nextLetter;
      const margin = this.worldWidth * 0.14;
      const x = margin + Math.random() * (this.worldWidth - margin * 2);
      this.letters.push(new LetterToken(x, this.highestLetterY, index));
      this.nextLetter = (index + 1) % LETTERS.length;
    }
  }

  // 글자를 먹었는지 확인한다. 다섯 글자를 다 모으면 로켓 + 점수 보너스.
  _collectLetters() {
    const reach = this.player.width * 0.32;
    for (const token of this.letters) {
      if (token.collected) continue;
      if (Math.hypot(this.player.x - token.x, this.player.y - token.y) > token.r + reach) continue;
      token.collected = true;
      const duplicate = this.collectedLetters.has(token.index);
      this._spawnParticles(token.x, token.y, '#ffd24a', duplicate ? 8 : 12);
      playCollectSound();
      hapticLight();
      if (duplicate) {
        // 이미 모은 글자는 진행도에 더해지지 않는 대신 코인을 조금 준다.
        this.coins += LETTER_DUPLICATE_COINS;
        this.callbacks.onCoins?.(this._currentCoins());
        this._addFloatText(token.x, token.y, `+${LETTER_DUPLICATE_COINS}`, '#f5a623', 0.8);
        continue;
      }
      this.collectedLetters.add(token.index);
      this._addFloatText(token.x, token.y, LETTERS[token.index].toUpperCase(), '#f5a623', 0.8);
      this.callbacks.onLetters?.([...this.collectedLetters]);
      if (this.collectedLetters.size >= LETTERS.length) this._completeLetterSet();
    }
    this.letters = this.letters.filter((tk) => !tk.collected);
  }

  _completeLetterSet() {
    this.letterSets += 1;
    this.collectedLetters.clear();
    this.letters = []; // 남아 있던 글자는 치우고 새 세트를 시작한다
    this.callbacks.onLetters?.([]);
    // 보상: 로켓 발사 + 점수. 세트를 거듭할수록 점수가 커진다.
    this.effects.rocket = ROCKET_DURATION;
    this.callbacks.onEffects?.(this.getEffects());
    const bonus = LETTER_SCORE_BONUS + (this.letterSets - 1) * LETTER_SCORE_STEP;
    this.score += bonus;
    this.callbacks.onScore?.(this.score);
    this._addFloatText(this.player.x, this.player.y - this.player.height, `POING! +${bonus}`, '#ff8fab', 1.3);
    this._showBanner('POING!');
    playRocketSound();
    hapticSuccess();
    this._addShake(6, 22);
  }

  // 코인을 주웠는지 확인한다(몸이 닿으면 획득).
  _collectCoinPickups() {
    const reach = this.player.width * 0.32;
    for (const coin of this.coinPickups) {
      if (coin.collected) continue;
      if (Math.hypot(this.player.x - coin.x, this.player.y - coin.y) > coin.r + reach) continue;
      coin.collected = true;
      this.coins += COIN_PICKUP_VALUE;
      this.callbacks.onCoins?.(this._currentCoins());
      this._spawnParticles(coin.x, coin.y, '#ffd24a', 10);
      this._addFloatText(coin.x, coin.y, `+${COIN_PICKUP_VALUE}`, '#f5a623', 0.8);
      playCollectSound();
      hapticLight();
    }
    this.coinPickups = this.coinPickups.filter((c) => !c.collected);
  }

  // 지금까지 이번 판에서 번 코인(일반 모드는 올라간 거리도 코인이 된다).
  _currentCoins() {
    const base = this.mode === 'adventure'
      ? this.coins
      : this.coins + Math.floor(this.score / CLASSIC_METERS_PER_COIN);
    return Math.floor(base * this.coinMult); // 고양이별 '코인 보너스' 강화
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
    const gap = this.worldHeight * (1.4 - 0.55 * t); // 고도0: ~1.4화면, 고도1: ~0.85화면
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
    const floating = this._bubbleHolds() && this.bubble.phase !== 'blow';
    // 비눗방울 안에 있으면 방울 크기만큼 넓게 부딪히고, 닿으면 방울만 터진다.
    const hitDist = floating ? BUBBLE_HIT_RADIUS : this.player.width * 0.32;

    for (const h of this.hazards) {
      if (h.dead) continue;
      h.update(this.worldWidth, ts);
      if (Math.hypot(px - h.x, py - h.y) < hitDist + h.r) {
        if (floating) {
          this._popBubble();
          return;
        }
        if (this.bubbleGrace > 0) continue; // 방금 터진 방울 — 같은 가시에 바로 죽지 않게
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
    if (this.shields > 0) {
      this.shields -= 1;
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

  // 번개: 공중에서 줄기에 닿으면 상승이 끊기고 그대로 떨어진다(구름 위에 서 있는 건 안전).
  _checkLightning(previous = null) {
    if (this.player.groundedCloud) return;
    if (this.frame - this.lastZapFrame < ZAP_COOLDOWN_FRAMES) return;
    const scale = this._cloudScale();
    const halfW = this.player.width * 0.28;
    // 한 프레임에 18px 넘게 움직이는데 번개 줄기는 13px 남짓이라, 지금 위치만 보면
    // 빠른 점프가 줄기를 뚫고 지나간다. 직전 위치까지 포함한 경로로 판정한다.
    const prevY = previous ? previous.y : this.player.y;
    const prevX = previous ? previous.x : this.player.x;
    const dy = this.player.y - prevY;
    const top = Math.min(this.player.y, prevY) - this.player.height * 0.3;
    const bottom = Math.max(this.player.y, prevY) + (this.player.bottom - this.player.y);
    const left = Math.min(this.player.x, prevX) - halfW;
    const right = Math.max(this.player.x, prevX) + halfW;
    for (const cloud of this.clouds) {
      if (cloud.type !== CLOUD_TYPES.THUNDER || !cloud.isStriking(this.frame)) continue;
      const zone = cloud.strikeZone(scale);
      if (!zone) continue;
      const hitX = right > zone.left && left < zone.right;
      const hitY = bottom > zone.top && top < zone.bottom;
      if (!hitX || !hitY) continue;
      this._zap(dy);
      return;
    }
  }

  _zap(dy = 0) {
    this.lastZapFrame = this.frame;
    // 솟구치다 맞았으면 줄기 아래쪽으로 되돌려, 뚫고 올라간 것처럼 보이지 않게 한다.
    if (dy < 0) this.player.y = Math.max(this.player.y, this.player.y - dy * 0.5);
    // 위로 가던 힘을 끊어 그대로 떨어뜨린다.
    this.player.vy = Math.max(this.player.vy, 1.5);
    this.player.jumpPeakVy = 0;
    this.player.trail.length = 0;
    this.player.charging = false;
    this.player.chargeLevel = 0;
    this._spawnParticles(this.player.x, this.player.y, '#ffe08a', 16);
    this._addShake(6);
    playHazardSound();
    hapticMedium();
    if (this.combo > 0) {
      this._addFloatText(this.player.x, this.player.y - this.player.height * 0.7, t('combo.break'), '#9aa7b0', 0.9);
      this.combo = 0;
      this.callbacks.onCombo?.(0, 1);
    }
  }

  _checkWhales(previous) {
    if (this.player.groundedCloud || this.effects.rocket > 0) return;
    let nearest = null;
    for (const whale of this.clouds) {
      if (whale.type !== CLOUD_TYPES.WHALE || whale.fleeing) continue; // 달아나는 고래는 통과
      if (whale.top > this.cameraY + this.worldHeight) continue;
      const hit = whale.contact(this.player, previous);
      if (hit && (!nearest || hit.time < nearest.hit.time)) nearest = { whale, hit };
    }
    if (!nearest) return;
    const { whale, hit } = nearest;
    whale.wake();
    if (hit.side === 'top') {
      this._landOnCloud(whale);
    } else {
      whale.deflect(this.player, hit);
      this.charge = 0;
      this.chargeHold = 0;
      this.callbacks.onCharge?.(0, false);
      playBounceSound();
      hapticLight();
    }
  }

  _checkLanding() {
    if (this.player.groundedCloud || this.player.vy <= 0) return;

    const viewportBottom = this.cameraY + this.worldHeight;

    for (const cloud of this.clouds) {
      if (cloud.type === CLOUD_TYPES.WHALE) continue; // Solid collision handles all four sides.
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

    if (cloud.type === CLOUD_TYPES.WHALE) {
      this.player.x += cloud.deltaX;
    } else if (cloud.type === CLOUD_TYPES.MOVING) {
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
      this._advanceCharge();
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
      const beforeCoins = this._currentCoins();
      const bubbleMult = this._bubbleHolds() ? BUBBLE_SCORE_MULT : 1;
      this.score += Math.round(delta * permMult * burstMult * this._comboMult() * bubbleMult);
      this.callbacks.onScore?.(this.score);
      const afterCoins = this._currentCoins();
      if (afterCoins !== beforeCoins) this.callbacks.onCoins?.(afterCoins);
      this._checkZone();
    }
  }

  _syncPlayerChargeAnim() {
    if (!this.player) return;
    this._syncDirectionCloud();
    const onCloud = this.state === 'ready' || !!this.player.groundedCloud;
    this.player.charging = onCloud && this.input.holding;
    this.player.chargeLevel = this.charge;
  }

  _update() {
    this.frame += 1;

    if (this.state === 'ready') {
      this._snapToStartCloud();
      if (this.input.holding) {
        this._advanceCharge();
      }
      this._syncPlayerChargeAnim();
      this.player.tickAnim(); // 시작 대기 중에도 깜빡임이 흐르도록
      return;
    }

    const ts = this.effects.slowmo > 0 ? SLOWMO_FACTOR : 1;

    this.player.tickAnim(ts);

    for (const cloud of this.clouds) {
      cloud.update(this.worldWidth, ts);
    }

    if (this._updateBubble(ts)) {
      // 비눗방울을 부는 중이거나 떠 있는 중: 이동은 _updateBubble 이 처리했다.
    } else if (this.effects.rocket > 0) {
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
      const previous = { x: this.player.x, y: this.player.y };
      this.player.update(GRAVITY * this.mods.gravityMult, this.worldWidth, ts);
      // 깃털(일시) 또는 황금 깃털(전설·상시): 낙하 속도 제한
      if ((this.effects.feather > 0 || this.legend.goldFeather) && this.player.vy > FEATHER_MAX_FALL) {
        this.player.vy = FEATHER_MAX_FALL;
      }
      this._checkWhales(previous);
      this._checkLightning(previous);
      this._checkLanding();
    }

    this._spawnClouds();
    this._spawnOrbs();
    this._spawnCoinPickups();
    this._spawnSoaps();
    this._spawnLetters();
    this._spawnHazards();
    this._updateOrbs();
    this._collectCoinPickups();
    this._collectSoaps();
    this._collectLetters();
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
      if (this.shields > 0) {
        this.shields -= 1;
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
    if (this.synergy.shieldRegen && this.shields === 0 && this.frame % SYN_SHIELD_REGEN_FRAMES === 0) {
      this.shields = 1;
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
      ctx.font = `${Math.round(15 * GAME_SCALE * f.scale)}px ${getFont()}`;
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
    ctx.font = `${Math.round(26 * GAME_SCALE)}px ${getFont()}`;
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
    const exclude = this.shields > 0 ? ['shield'] : [];
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
      case 'shield': this.shields += 1; break;
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
    this._setBubble(null);
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
      shield: this.shields > 0,
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
    const earned = this._earnedCoins();
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

  // 이번 판에 번 코인. 어드벤처는 오브·보상으로 모은 코인, 일반 모드는 올라간 거리로 계산한다.
  _earnedCoins() {
    return this._currentCoins();
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
    const earned = this._earnedCoins();
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

    if (pixelSkyReady) {
      this._drawPixelSky(ctx, altitude, w, h);
      if (altitude > 0.55 && !this.reduceMotion) this._drawShootingStars(ctx, altitude);
      return;
    }

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

  }

  _drawPixelSky(ctx, altitude, w, h) {
    let index = 0;
    while (index < PIXEL_SKY_STOPS.length - 2 && altitude > PIXEL_SKY_STOPS[index + 1]) index++;
    const progress = Math.max(0, Math.min(1,
      (altitude - PIXEL_SKY_STOPS[index]) / (PIXEL_SKY_STOPS[index + 1] - PIXEL_SKY_STOPS[index])));
    const blend = progress * progress * (3 - 2 * progress);
    const panelWidth = Math.floor(pixelSky.naturalWidth / 5) - 6;
    const panelHeight = pixelSky.naturalHeight;
    // Cover each panel without stretching pixels or sampling its neighbours.
    const scale = Math.max(w / panelWidth, h / panelHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = 3 + (panelWidth - sw) / 2;
    const sy = 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.drawImage(pixelSkySource, Math.round(index * pixelSky.naturalWidth / 5) + sx, sy, sw, sh, 0, 0, w, h);
    if (blend > 0) {
      ctx.globalAlpha = blend;
      ctx.drawImage(pixelSkySource, Math.round((index + 1) * pixelSky.naturalWidth / 5) + sx, sy, sw, sh, 0, 0, w, h);
    }
    ctx.restore();
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
        const pixel = 2 * GAME_SCALE;
        const steps = Math.max(1, Math.ceil(s.len / pixel));
        ctx.save();
        ctx.fillStyle = '#fff4dc';
        for (let step = steps; step >= 0; step--) {
          ctx.globalAlpha = a * (1 - step / (steps + 1));
          const x = Math.round((s.x - Math.cos(s.angle) * step * pixel) / pixel) * pixel;
          const y = Math.round((s.y - Math.sin(s.angle) * step * pixel) / pixel) * pixel;
          ctx.fillRect(x, y, pixel, pixel);
        }
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

    for (const coin of this.coinPickups) {
      coin.draw(this.ctx, this.cameraY, this.frame);
    }
    for (const sp of this.soaps) {
      sp.draw(this.ctx, this.cameraY, this.frame);
    }
    for (const token of this.letters) {
      token.draw(this.ctx, this.cameraY, this.frame);
    }
    for (const orb of this.orbs) {
      orb.draw(this.ctx, this.cameraY, this.frame);
    }

    for (const hazard of this.hazards) {
      hazard.draw(this.ctx, this.cameraY, this.frame);
    }

    this._drawParticles();

    this.player.draw(this.ctx, this.cameraY);

    if (this.shields > 0) {
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
    ctx.font = `${18 * GAME_SCALE}px ${getFont()}`;
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
