import { Game } from './game.js';
import { isMobileDevice, isPortrait } from './device.js';
import { initScores, getBestScore, getGlobalBest } from './score.js';
import { initNative } from './native.js';
import { shareResult } from './share.js';
import { TIERS } from './orb.js';
import {
  getCoins,
  getStartBonuses,
  UPGRADES,
  getUpgradeLevel,
  nextCost,
  buyUpgrade,
} from './meta.js';

const app = document.getElementById('app');
const desktopGate = document.getElementById('desktop-gate');
const landscapeGate = document.getElementById('landscape-gate');
const canvas = document.getElementById('game-canvas');
const chargeBar = document.getElementById('charge-bar');
const chargeFill = document.getElementById('charge-fill');
const hud = document.getElementById('hud');
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');

const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const globalBestEl = document.getElementById('global-best');
const menuBestEl = document.getElementById('menu-best');
const menuGlobalBestEl = document.getElementById('menu-global-best');
const finalScoreEl = document.getElementById('final-score');
const newRecordEl = document.getElementById('new-record');

const btnStart = document.getElementById('btn-start');
const btnRetry = document.getElementById('btn-retry');
const btnShare = document.getElementById('btn-share');

const gaugeFill = document.getElementById('gauge-fill');
const effectsEl = document.getElementById('effects');
const coinHud = document.getElementById('coin-count');
const rewardScreen = document.getElementById('reward-screen');
const rewardCards = document.getElementById('reward-cards');
const btnReroll = document.getElementById('btn-reroll');
const btnSkip = document.getElementById('btn-skip');

const gameoverCoinsEl = document.getElementById('gameover-coins');
const menuCoinsEl = document.getElementById('menu-coins');
const btnShop = document.getElementById('btn-shop');
const btnShopGameover = document.getElementById('btn-shop-gameover');
const shopScreen = document.getElementById('shop-screen');
const shopList = document.getElementById('shop-list');
const shopCoinsEl = document.getElementById('shop-coins');
const btnShopClose = document.getElementById('btn-shop-close');

const modeButtons = document.querySelectorAll('.mode-btn');
const modeHint = document.getElementById('mode-hint');

const EFFECT_BADGES = [
  ['jumpLevel', (n) => `🚀×${n}`],
  ['doubleJumpLevel', (n) => `🪽×${n}`],
  ['magnetLevel', (n) => `🧲×${n}`],
  ['orbValueLevel', (n) => `💎×${n}`],
  ['scoreLevel', (n) => `📈×${n}`],
  ['chargeRateLevel', (n) => `⚡×${n}`],
];

const MODE_HINTS = {
  classic: '순수 점프 실력에 도전하는 기본 모드',
  adventure: '오브를 모아 보상을 받고 상점을 이용하는 모드',
};

let game = null;
let selectedMode = 'classic';
let lastScore = 0;
let lastIsNewRecord = false;

function updateChargeBar(charge, holding) {
  chargeFill.style.width = `${charge * 100}%`;
  chargeBar.classList.toggle('visible', holding);
}

function updateHudRecords(mode) {
  bestScoreEl.textContent = getBestScore(mode);
  globalBestEl.textContent = getGlobalBest(mode);
}

function refreshMenuRecords() {
  menuBestEl.textContent = getBestScore(selectedMode);
  menuGlobalBestEl.textContent = getGlobalBest(selectedMode);
}

function setMode(mode) {
  selectedMode = mode;
  modeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  if (modeHint) modeHint.textContent = MODE_HINTS[mode] ?? '';
  // 어드벤처 전용 UI(상점)는 해당 모드에서만 노출
  btnShop?.classList.toggle('hidden', mode !== 'adventure');
  refreshMenuRecords();
}

function updateGauge(ratio) {
  gaugeFill.style.width = `${Math.round(ratio * 100)}%`;
  gaugeFill.classList.toggle('full', ratio >= 1);
}

function updateEffects(effects = {}) {
  const badges = [];
  for (const [key, fmt] of EFFECT_BADGES) {
    if (effects[key] > 0) badges.push(fmt(effects[key]));
  }
  if (effects.scoreX2) badges.push('✨×2');
  if (effects.slowmo) badges.push('🐢');
  if (effects.bigcloud) badges.push('☁️');
  if (effects.feather) badges.push('🪶');
  if (effects.rocket) badges.push('🚀');
  if (effects.shield) badges.push('🛡️');
  effectsEl.innerHTML = badges
    .map((b) => `<span class="effect-badge">${b}</span>`)
    .join('');
}

function updateCoinHud(coins) {
  if (coinHud) coinHud.textContent = coins;
}

function renderShop() {
  const coins = getCoins();
  shopCoinsEl.textContent = coins;
  menuCoinsEl.textContent = coins;
  shopList.innerHTML = '';
  for (const up of UPGRADES) {
    const level = getUpgradeLevel(up.id);
    const cost = nextCost(up.id);
    const maxed = cost === null;
    const affordable = !maxed && coins >= cost;

    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `
      <span class="shop-icon">${up.icon}</span>
      <span class="shop-info">
        <span class="shop-label">${up.label} <em>Lv.${level}/${up.max}</em></span>
        <span class="shop-desc">${up.desc}</span>
      </span>
      <button class="shop-buy" ${maxed || !affordable ? 'disabled' : ''}>
        ${maxed ? 'MAX' : `🪙 ${cost}`}
      </button>
    `;
    if (!maxed && affordable) {
      row.querySelector('.shop-buy').addEventListener('click', () => {
        const res = buyUpgrade(up.id);
        if (res.ok) renderShop();
      });
    }
    shopList.appendChild(row);
  }
}

function openShop() {
  renderShop();
  shopScreen.classList.remove('hidden');
}

function closeShop() {
  shopScreen.classList.add('hidden');
  if (menuCoinsEl) menuCoinsEl.textContent = getCoins();
}

function showRewardChoices(choices, info = {}) {
  rewardCards.innerHTML = '';
  for (const reward of choices) {
    const card = document.createElement('button');
    card.className = `reward-card reward-card--${reward.tier}`;
    const tierLabel = TIERS[reward.tier]?.label ?? '';
    const levelChip = reward.level != null
      ? `<span class="reward-level">Lv.${reward.level}→${reward.level + 1}</span>`
      : '';
    card.innerHTML = `
      <span class="reward-icon">${reward.icon}</span>
      <span class="reward-label">${reward.label}<span class="reward-tier">${tierLabel}</span>${levelChip}</span>
      <span class="reward-desc">${reward.desc}</span>
    `;
    card.addEventListener('click', () => {
      rewardScreen.classList.add('hidden');
      game.chooseReward(reward.id);
    });
    rewardCards.appendChild(card);
  }

  if (btnReroll) {
    const cost = info.rerollCost ?? 0;
    btnReroll.textContent = `🔄 다시 뽑기 (🪙 ${cost})`;
    btnReroll.disabled = (info.coins ?? 0) < cost;
  }
  if (btnSkip) {
    btnSkip.textContent = `⏭️ 건너뛰기 (+🪙 ${info.skipReward ?? 0})`;
  }

  rewardScreen.classList.remove('hidden');
}

function ensureGame() {
  if (game) return;

  game = new Game(canvas, app, {
    onScore(score) {
      scoreEl.textContent = score;
    },
    onCharge(charge, holding) {
      updateChargeBar(charge, holding);
    },
    onGauge(ratio) {
      updateGauge(ratio);
    },
    onEffects(effects) {
      updateEffects(effects);
    },
    onReward(choices, info) {
      showRewardChoices(choices, info);
    },
    onCoins(coins) {
      updateCoinHud(coins);
    },
    getStartBonuses() {
      return getStartBonuses();
    },
    onGameOver(score, isNewRecord, earned = 0) {
      hud.classList.add('hidden');
      chargeBar.classList.add('hidden');
      chargeBar.classList.remove('visible');
      gameoverScreen.classList.remove('hidden');
      finalScoreEl.textContent = score;
      newRecordEl.classList.toggle('hidden', !isNewRecord);
      gameoverCoinsEl.textContent = earned;
      lastScore = score;
      lastIsNewRecord = isNewRecord;
      btnShare.textContent = '📤 결과 공유하기';
      updateHudRecords(game.mode);
      refreshMenuRecords();
    },
  });
}

function updateLayout() {
  const mobile = isMobileDevice();
  const portrait = isPortrait();

  desktopGate.classList.toggle('hidden', mobile);
  landscapeGate.classList.toggle('hidden', !mobile || portrait);
  app.classList.toggle('hidden', !mobile || !portrait);

  if (mobile && portrait) {
    ensureGame();
  }
}

function startGame() {
  ensureGame();
  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  rewardScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  chargeBar.classList.remove('hidden');
  chargeBar.classList.remove('visible');
  chargeFill.style.width = '0%';
  newRecordEl.classList.add('hidden');
  scoreEl.textContent = '0';
  updateGauge(0);
  updateEffects({});
  updateCoinHud(0);
  // 어드벤처 전용 HUD(게이지/코인/효과) 표시 제어
  app.classList.toggle('mode-adventure', selectedMode === 'adventure');
  updateHudRecords(selectedMode);
  game.start(selectedMode);
}

window.addEventListener('resize', updateLayout);
window.addEventListener('orientationchange', () => {
  setTimeout(updateLayout, 150);
});

btnStart.addEventListener('click', startGame);
btnRetry.addEventListener('click', startGame);

modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

btnShop?.addEventListener('click', openShop);
btnShopGameover?.addEventListener('click', openShop);
btnShopClose?.addEventListener('click', closeShop);

btnReroll?.addEventListener('click', () => game?.rerollReward());
btnSkip?.addEventListener('click', () => {
  rewardScreen.classList.add('hidden');
  game?.skipReward();
});

btnShare.addEventListener('click', async () => {
  btnShare.disabled = true;
  const result = await shareResult(lastScore, lastIsNewRecord);
  if (result === 'copied') {
    btnShare.textContent = '✅ 결과를 복사했어요!';
    setTimeout(() => {
      btnShare.textContent = '📤 결과 공유하기';
    }, 2000);
  }
  btnShare.disabled = false;
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

async function boot() {
  initNative();
  if (menuCoinsEl) menuCoinsEl.textContent = getCoins();
  setMode(selectedMode);
  await initScores();
  setMode(selectedMode); // 점수 로드 후 기록 갱신
  updateLayout();
}

boot();
