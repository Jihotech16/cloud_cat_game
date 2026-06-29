import { Game } from './game.js';
import { isMobileDevice, isPortrait } from './device.js';
import { initScores, getBestScore, getGlobalBest } from './score.js';
import { initNative } from './native.js';
import { shareResult } from './share.js';
import { playClickSound } from './audio.js';
import {
  initAds,
  adsAvailable,
  showBanner,
  hideBanner,
  showInterstitial,
  showRewardedAd,
} from './ads.js';
import { addCoins } from './meta.js';
import { TIERS, TAGS, SYNERGIES } from './orb.js';
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
const chargeTrack = document.querySelector('.charge-track');
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
const shareLabel = document.getElementById('share-label');
const btnRewardCoins = document.getElementById('btn-reward-coins');
const btnMenu = document.getElementById('btn-menu');

const gaugeFill = document.getElementById('gauge-fill');
const effectsEl = document.getElementById('effects');
const synergyEl = document.getElementById('synergy');
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
  ['jumpLevel', (n) => `<img class="badge-ico" src="assets/rocket.png" alt="">×${n}`],
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
let lastEarned = 0; // 이번 판에 획득한 코인(보상형 광고 2배에 사용)
let gameOverCount = 0; // 전면 광고 빈도 제어용
const INTERSTITIAL_EVERY = 3; // N판마다 전면 광고 1회

function updateChargeBar(charge, holding) {
  // 트랙 길이 = 현재 모을 수 있는 최대치(상한). 보상으로 상한이 오르면 바가 길어진다.
  // 채움 = 현재 충전 / 상한 → 가득 모으면 트랙 끝까지 꽉 찬다.
  const max = game && typeof game._chargeMax === 'function' ? game._chargeMax() : 1;
  const cap = max > 0 ? max : 1;
  if (chargeTrack) chargeTrack.style.width = `${cap * 100}%`;
  chargeFill.style.width = `${Math.min(1, charge / cap) * 100}%`;
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
  if (effects.rocket) badges.push('<img class="badge-ico" src="assets/rocket.png" alt="">');
  if (effects.shield) badges.push('🛡️');
  effectsEl.innerHTML = badges
    .map((b) => `<span class="effect-badge">${b}</span>`)
    .join('');
}

function updateCoinHud(coins) {
  if (coinHud) coinHud.textContent = coins.toLocaleString();
}

function updateSynergy(state = {}) {
  if (!synergyEl) return;
  const badges = [];
  for (const tag of ['jump', 'orb', 'score', 'survival']) {
    const s = state[tag];
    if (!s || s.count <= 0) continue;
    const meta = TAGS[tag];
    const star = s.tier >= 4 ? '★' : '';
    const title = s.tier > 0 ? SYNERGIES[tag]?.[s.tier] ?? '' : '';
    badges.push(
      `<span class="syn-badge${s.tier > 0 ? ' active' : ''}" style="--syn:${meta.color}" title="${title}">${meta.emoji}${s.count}${star}</span>`,
    );
  }
  synergyEl.innerHTML = badges.join('');
}

function renderShop() {
  const coins = getCoins();
  shopCoinsEl.textContent = coins.toLocaleString();
  menuCoinsEl.textContent = coins.toLocaleString();
  shopList.innerHTML = '';
  for (const up of UPGRADES) {
    const level = getUpgradeLevel(up.id);
    const cost = nextCost(up.id);
    const maxed = cost === null;
    const affordable = !maxed && coins >= cost;

    const iconHtml = up.icon.endsWith('.png')
      ? `<img class="shop-icon" src="${up.icon}" alt="">`
      : `<span class="shop-icon">${up.icon}</span>`;

    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `
      ${iconHtml}
      <span class="shop-info">
        <span class="shop-label">${up.label} <em>Lv.${level}/${up.max}</em></span>
        <span class="shop-desc">${up.desc}</span>
      </span>
      <button class="shop-buy" ${maxed || !affordable ? 'disabled' : ''}>
        ${maxed ? 'MAX' : `<img class="coin-ico" src="assets/coin.png" alt=""> ${cost.toLocaleString()}`}
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
  if (menuCoinsEl) menuCoinsEl.textContent = getCoins().toLocaleString();
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
    const tagChips = (reward.tags ?? [])
      .map((t) => `<span class="reward-tag" style="--syn:${TAGS[t]?.color}">${TAGS[t]?.emoji} ${TAGS[t]?.label}</span>`)
      .join('');
    const iconHtml = reward.icon.endsWith('.png')
      ? `<img class="reward-icon" src="${reward.icon}" alt="">`
      : `<span class="reward-icon">${reward.icon}</span>`;
    card.innerHTML = `
      ${iconHtml}
      <span class="reward-label">${reward.label}<span class="reward-tier">${tierLabel}</span>${levelChip}</span>
      <span class="reward-desc">${reward.desc} ${tagChips}</span>
    `;
    card.addEventListener('click', () => {
      rewardScreen.classList.add('hidden');
      game.chooseReward(reward.id);
    });
    rewardCards.appendChild(card);
  }

  if (btnReroll) {
    const cost = info.rerollCost ?? 0;
    btnReroll.innerHTML = `🔄 다시 뽑기 (<img class="coin-ico" src="assets/coin.png" alt=""> ${cost})`;
    btnReroll.disabled = (info.coins ?? 0) < cost;
  }
  if (btnSkip) {
    btnSkip.innerHTML = `⏭️ 건너뛰기 (+<img class="coin-ico" src="assets/coin.png" alt=""> ${info.skipReward ?? 0})`;
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
    onSynergy(state) {
      updateSynergy(state);
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
      lastEarned = earned;
      if (shareLabel) shareLabel.textContent = '결과 공유하기';
      updateHudRecords(game.mode);
      refreshMenuRecords();

      // 보상형 광고: 코인을 번 어드벤처 모드에서만 '코인 2배' 버튼 노출(네이티브 한정)
      setupRewardCoinsButton(earned);

      // 메뉴 화면이므로 배너 다시 노출
      showBanner();

      // 전면 광고: N판마다 1회(첫 판 제외)
      gameOverCount += 1;
      if (gameOverCount % INTERSTITIAL_EVERY === 0) {
        showInterstitial();
      }
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
  updateSynergy({});
  updateCoinHud(0);
  // 어드벤처 전용 HUD(게이지/코인/효과) 표시 제어
  app.classList.toggle('mode-adventure', selectedMode === 'adventure');
  updateHudRecords(selectedMode);
  hideBanner(); // 플레이 중에는 배너 숨김
  game.start(selectedMode);
}

// 보상형 광고로 코인 2배 받기 버튼 준비.
// 코인을 번 어드벤처 모드 + 네이티브(광고 가능) 환경에서만 노출한다.
function setupRewardCoinsButton(earned) {
  if (!btnRewardCoins) return;
  const eligible = adsAvailable() && earned > 0;
  btnRewardCoins.classList.toggle('hidden', !eligible);
  if (!eligible) return;
  btnRewardCoins.disabled = false;
  btnRewardCoins.textContent = '🎬 광고 보고 코인 2배';
}

async function onRewardCoinsClick() {
  if (!btnRewardCoins || btnRewardCoins.disabled || lastEarned <= 0) return;
  btnRewardCoins.disabled = true;
  btnRewardCoins.textContent = '광고 불러오는 중…';
  const rewarded = await showRewardedAd();
  if (rewarded) {
    addCoins(lastEarned); // 같은 양만큼 한 번 더 지급 → 2배
    gameoverCoinsEl.textContent = lastEarned * 2;
    if (menuCoinsEl) menuCoinsEl.textContent = getCoins().toLocaleString();
    btnRewardCoins.textContent = '✅ 코인 2배 획득!';
    lastEarned = 0; // 중복 수령 방지
  } else {
    // 시청 취소/실패 → 다시 시도 가능
    btnRewardCoins.disabled = false;
    btnRewardCoins.textContent = '🎬 광고 보고 코인 2배';
  }
}

// 게임오버 → 메인 메뉴(시작 화면)로
function goToMenu() {
  gameoverScreen.classList.add('hidden');
  rewardScreen.classList.add('hidden');
  hud.classList.add('hidden');
  chargeBar.classList.add('hidden');
  refreshMenuRecords();
  if (menuCoinsEl) menuCoinsEl.textContent = getCoins().toLocaleString();
  startScreen.classList.remove('hidden');
  showBanner(); // 메인 메뉴에서 배너 노출
}

window.addEventListener('resize', updateLayout);
window.addEventListener('orientationchange', () => {
  setTimeout(updateLayout, 150);
});

btnStart.addEventListener('click', startGame);
btnRetry.addEventListener('click', startGame);
btnMenu?.addEventListener('click', goToMenu);
btnRewardCoins?.addEventListener('click', onRewardCoinsClick);

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
  if (result === 'copied' && shareLabel) {
    shareLabel.textContent = '✅ 결과를 복사했어요!';
    setTimeout(() => {
      shareLabel.textContent = '결과 공유하기';
    }, 2000);
  }
  btnShare.disabled = false;
});

// UI 버튼 클릭음(동적으로 생성되는 보상/상점 버튼까지 위임으로 처리)
app.addEventListener('click', (e) => {
  if (e.target.closest('button')) playClickSound();
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

async function boot() {
  initNative();
  await initAds();
  showBanner(); // 시작 화면(메뉴)에서 배너 노출
  if (menuCoinsEl) menuCoinsEl.textContent = getCoins().toLocaleString();
  setMode(selectedMode);
  await initScores();
  setMode(selectedMode); // 점수 로드 후 기록 갱신
  updateLayout();
}

boot();
