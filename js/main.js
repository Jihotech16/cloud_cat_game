import { Game } from './game.js';
import { isMobileDevice, isPortrait } from './device.js';
import { initScores, getBestScore, getGlobalBest } from './score.js';
import { initAppCheck } from './appcheck.js';
import { initNative } from './native.js';
import { shareResult } from './share.js';
import { playClickSound, setSfxMuted } from './audio.js';
import { startBgm, toggleBgm, isBgmMuted, setBgmScene } from './bgm.js';
import {
  initAds,
  adsAvailable,
  showBanner,
  showInterstitial,
  showRewardedAd,
} from './ads.js';
import { addCoins } from './meta.js';
import { onGameFinished } from './review.js';
import { SKINS, ownsSkin, getEquippedSkin, equipSkin, grantSeasonalSkins, buySkin } from './skins.js';
import { setPlayerSkin } from './player.js';
import { TIERS, TAGS } from './orb.js';
import { t, applyStaticI18n, getLang, setLang, LANGS } from './i18n.js';
import {
  getCoins,
  CONSUMABLES,
  getConsumableCount,
  buyConsumable,
  useConsumable,
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
// HUD 높이는 모드(어드벤처는 게이지·시너지·효과 줄이 붙음)와 보유 효과에 따라 달라진다.
// 콤보 표시와 일시정지 버튼이 HUD 를 가리지 않도록 실제 하단 위치를 CSS 변수로 알려준다.
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => {
    const bottom = hud.getBoundingClientRect().bottom;
    if (bottom > 0) document.documentElement.style.setProperty('--hud-bottom', `${Math.round(bottom)}px`);
  }).observe(hud);
}
const startScreen = document.getElementById('start-screen');
const menuCatImage = document.getElementById('menu-cat-image');
const menuCatSources = {
  classic: 'assets/cat%20background.png',
  adventure: 'assets/cat-adventure-menu.png',
};
// Warm the second illustration so switching modes doesn't leave a blank preview.
const adventureMenuPreload = new Image();
adventureMenuPreload.src = menuCatSources.adventure;
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
const btnMute = document.getElementById('btn-mute');
const btnRewardCoins = document.getElementById('btn-reward-coins');
const btnMenu = document.getElementById('btn-menu');
const btnRevive = document.getElementById('btn-revive');
const btnPause = document.getElementById('btn-pause');
const pauseScreen = document.getElementById('pause-screen');
const btnResume = document.getElementById('btn-resume');
const btnPauseMenu = document.getElementById('btn-pause-menu');

const gaugeFill = document.getElementById('gauge-fill');
const comboEl = document.getElementById('combo');
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
const shopModeEl = document.getElementById('shop-mode');
const btnShopClose = document.getElementById('btn-shop-close');

const modeButtons = document.querySelectorAll('.mode-btn');
const modeHint = document.getElementById('mode-hint');

const tutorialScreen = document.getElementById('tutorial-screen');
const btnTutorialStart = document.getElementById('btn-tutorial-start');
const ADV_TUT_KEY = 'cloudCat_advTutorialSeen';

// [상태키, 진화키(없으면 null), 렌더]
const EFFECT_BADGES = [
  ['jumpLevel', 'jump', (n) => `<img class="badge-ico" src="assets/rocket.png" alt="">×${n}`],
  ['doubleJumpLevel', null, (n) => `🪽×${n}`],
  ['magnetLevel', 'magnet', (n) => `🧲×${n}`],
  ['orbValueLevel', 'orbValue', (n) => `💎×${n}`],
  ['scoreLevel', 'scoreMul', (n) => `📈×${n}`],
  ['chargeRateLevel', null, (n) => `⚡×${n}`],
];

// 전설 보유 badge [플래그키, 이모지, i18n 보상 id]
const LEGEND_BADGES = [
  ['infiniteMagnet', '🌀', 'legMagnet'],
  ['hazardBreaker', '💥', 'legHazard'],
  ['alwaysShockwave', '🌊', 'legShock'],
  ['autoRocket', '🚀', 'legRocket'],
  ['goldFeather', '🕊️', 'legFeather'],
];

let game = null;
let selectedMode = 'classic';
let lastScore = 0;
let lastIsNewRecord = false;
let lastEarned = 0; // 이번 판에 획득한 코인(보상형 광고 2배에 사용)
let gameOverCount = 0; // 전면 광고 빈도 제어용
let pendingInterstitial = false; // 게임오버 화면을 떠날 때 재생할 전면 광고 예약
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
  if (menuCatImage) menuCatImage.src = menuCatSources[mode] ?? menuCatSources.classic;
  modeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  if (modeHint) modeHint.textContent = t(`mode.${mode}`);
  // 상점은 두 모드 모두에서 연다. 복장은 모드와 상관없고, 강화만 어드벤처 전용이다.
  refreshMenuRecords();
}

function updateGauge(ratio) {
  gaugeFill.style.width = `${Math.round(ratio * 100)}%`;
  gaugeFill.classList.toggle('full', ratio >= 1);
}

function updateEffects(effects = {}) {
  const badges = [];
  const evolved = effects.evolved || {};
  for (const [key, evoKey, fmt] of EFFECT_BADGES) {
    if (effects[key] > 0) {
      const star = evoKey && evolved[evoKey] ? '<span class="evo-star">★</span>' : '';
      badges.push(fmt(effects[key]) + star);
    }
  }
  if (effects.scoreX2) badges.push('✨×2');
  if (effects.slowmo) badges.push('🐢');
  if (effects.bigcloud) badges.push('☁️');
  if (effects.feather) badges.push('🪶');
  if (effects.rocket) badges.push('<img class="badge-ico" src="assets/rocket.png" alt="">');
  if (effects.shield) badges.push('🛡️');
  // 전설 보유 표시(전용 강조 badge)
  const legends = effects.legends || {};
  const legendMarks = [];
  for (const [flag, emoji, id] of LEGEND_BADGES) {
    if (legends[flag]) legendMarks.push(`<span class="effect-badge legend" title="${t(`reward.${id}.label`)}">${emoji}</span>`);
  }
  effectsEl.innerHTML = badges
    .map((b) => `<span class="effect-badge">${b}</span>`)
    .join('') + legendMarks.join('');
}

function updateCoinHud(coins) {
  if (coinHud) coinHud.textContent = coins.toLocaleString();
}

// 콤보 표시(3 이상일 때만). 배율은 퍼센트로.
function updateCombo(combo = 0, mult = 1) {
  if (!comboEl) return;
  const show = combo >= 3;
  comboEl.classList.toggle('hidden', !show);
  if (!show) return;
  const pct = Math.round((mult - 1) * 100);
  comboEl.innerHTML = `<span class="combo-x">${t('combo.count', { n: combo })}</span><span class="combo-mult">${t('combo.scoreBonus', { pct })}</span>`;
  // 재트리거 애니메이션(숫자 오를 때 살짝 튐)
  comboEl.classList.remove('bump');
  void comboEl.offsetWidth;
  comboEl.classList.add('bump');
}

function updateSynergy(state = {}) {
  if (!synergyEl) return;
  const badges = [];
  for (const tag of ['jump', 'orb', 'score', 'survival']) {
    const s = state[tag];
    if (!s || s.count <= 0) continue;
    const meta = TAGS[tag];
    const stars = s.tier >= 4 ? '★★★' : s.tier >= 3 ? '★★' : s.tier >= 2 ? '★' : '';
    const cur = s.tier > 0 ? t(`syn.${tag}.${s.tier}`) : t('syn.set', { tag: t(`tag.${tag}`) });
    const nextTxt = s.next ? ` · ${t('syn.next', { n: s.next })}` : '';
    badges.push(
      `<span class="syn-badge${s.tier > 0 ? ' active' : ''}" style="--syn:${meta.color}" title="${cur}${nextTxt}">${meta.emoji}${s.count}${stars}</span>`,
    );
  }
  // 시그니처 페어 힌트: 완성(2/2)은 강조, 1/2 는 흐리게 '거의' 표시
  for (const p of state.pairs || []) {
    const active = p.have >= 2;
    badges.push(
      `<span class="pair-badge${active ? ' active' : ''}" title="${t(`pair.${p.id}.label`)}: ${t(`pair.${p.id}.desc`)}">${p.emoji}${active ? '' : '…'}</span>`,
    );
  }
  synergyEl.innerHTML = badges.join('');
}

function renderSkins() {
  shopSectionTitle(t('shop.skins'));

  const equipped = getEquippedSkin();
  const coins = getCoins();
  for (const skin of SKINS) {
    const owned = ownsSkin(skin.id);
    const isEquipped = owned && skin.id === equipped;
    const forSale = !owned && skin.price != null;
    const affordable = forSale && coins >= skin.price;
    const locked = !owned && !forSale; // 기간 한정 등, 지금은 얻을 수 없음

    let buttonHtml;
    if (isEquipped) buttonHtml = t('skin.equipped');
    else if (owned) buttonHtml = t('skin.equip');
    else if (forSale) buttonHtml = `<img class="coin-ico" src="assets/coin.png" alt=""> ${skin.price.toLocaleString()}`;
    else buttonHtml = t('skin.locked');
    const clickable = (owned && !isEquipped) || affordable;

    const row = document.createElement('div');
    row.className = `shop-item${owned ? '' : ' shop-item--locked'}`;
    row.innerHTML = `
      <span class="skin-preview skin-preview--${skin.id}" aria-hidden="true"></span>
      <span class="shop-info">
        <span class="shop-label">${t(`skin.${skin.id}.label`)}</span>
        <span class="shop-desc">${locked ? t('skin.lockedDesc') : t(`skin.${skin.id}.desc`)}</span>
      </span>
      <button class="shop-buy${isEquipped ? ' is-equipped' : ''}" ${clickable ? '' : 'disabled'}>${buttonHtml}</button>
    `;
    if (clickable) {
      row.querySelector('.shop-buy').addEventListener('click', () => {
        // 사면 바로 입힌다.
        if (forSale && !buySkin(skin.id).ok) return;
        if (equipSkin(skin.id)) setPlayerSkin(skin.id);
        renderShop();
      });
    }
    shopList.appendChild(row);
  }

}

function shopSectionTitle(text) {
  const title = document.createElement('div');
  title.className = 'shop-section-title';
  title.textContent = text;
  shopList.appendChild(title);
}

// 소모품: 여러 개 살 수 있고, 시작 화면에서 켜고 시작하면 한 개 쓴다.
function renderConsumables() {
  shopSectionTitle(t('shop.consumables'));

  const coins = getCoins();
  for (const item of CONSUMABLES) {
    const owned = getConsumableCount(item.id);
    const affordable = coins >= item.price;
    const iconHtml = item.icon.endsWith('.png')
      ? `<img class="shop-icon" src="${item.icon}" alt="">`
      : `<span class="shop-icon">${item.icon}</span>`;
    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `
      ${iconHtml}
      <span class="shop-info">
        <span class="shop-label">${t(`item.${item.id}.label`)} <em>${t('item.owned', { n: owned })}</em></span>
        <span class="shop-desc">${t(`item.${item.id}.desc`)}</span>
      </span>
      <button class="shop-buy" ${affordable ? '' : 'disabled'}>
        <img class="coin-ico" src="assets/coin.png" alt=""> ${item.price.toLocaleString()}
      </button>
    `;
    if (affordable) {
      row.querySelector('.shop-buy').addEventListener('click', () => {
        if (buyConsumable(item.id).ok) {
          renderShop();
          renderConsumableArm();
        }
      });
    }
    shopList.appendChild(row);
  }
}

// 시작 화면에서 이번 판에 쓸 소모품을 켜고 끈다(갖고 있는 것만 보인다).
const armed = {};
const consumableArmEl = document.getElementById('consumable-arm');
function renderConsumableArm() {
  if (!consumableArmEl) return;
  consumableArmEl.innerHTML = '';
  for (const item of CONSUMABLES) {
    const owned = getConsumableCount(item.id);
    if (owned <= 0) {
      armed[item.id] = false;
      continue;
    }
    const chip = document.createElement('button');
    chip.className = `consumable-chip${armed[item.id] ? ' armed' : ''}`;
    chip.type = 'button';
    const iconHtml = item.icon.endsWith('.png')
      ? `<img class="chip-ico" src="${item.icon}" alt="">`
      : `<span class="chip-ico">${item.icon}</span>`;
    chip.innerHTML = `${iconHtml} ${t('item.arm', { name: t(`item.${item.id}.label`), n: owned })}`;
    chip.title = t('item.armedHint');
    chip.addEventListener('click', () => {
      armed[item.id] = !armed[item.id];
      playClickSound();
      renderConsumableArm();
    });
    consumableArmEl.appendChild(chip);
  }
}

// 판을 시작할 때 켜 둔 소모품을 실제로 차감하고, 이번 판에 적용할 목록을 돌려준다.
function consumeArmed() {
  const used = {};
  for (const item of CONSUMABLES) {
    if (armed[item.id] && useConsumable(item.id)) used[item.id] = true;
    armed[item.id] = false;
  }
  renderConsumableArm();
  return used;
}

function renderShop() {
  const coins = getCoins();
  shopCoinsEl.textContent = coins.toLocaleString();
  menuCoinsEl.textContent = coins.toLocaleString();
  if (shopModeEl) shopModeEl.textContent = t(`start.mode${selectedMode === 'adventure' ? 'Adventure' : 'Classic'}`);
  shopList.innerHTML = '';
  renderSkins();
  renderConsumables();
  shopSectionTitle(t('shop.upgrades'));
  // 고른 모드에서 효과가 있는 강화만 보여준다.
  for (const up of UPGRADES.filter((u) => (u.modes ?? ['classic', 'adventure']).includes(selectedMode))) {
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
        <span class="shop-label">${t(`upgrade.${up.id}.label`)} <em>Lv.${level}/${up.max}</em></span>
        <span class="shop-desc">${t(`upgrade.${up.id}.desc`)}</span>
      </span>
      <button class="shop-buy" ${maxed || !affordable ? 'disabled' : ''}>
        ${maxed ? t('shop.max') : `<img class="coin-ico" src="assets/coin.png" alt=""> ${cost.toLocaleString()}`}
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
  shopList.scrollTop = 0; // 맨 위(복장)부터 보이게
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
    if (reward.tradeoff) card.classList.add('reward-card--tradeoff');
    const tierLabel = t(`tier.${reward.tier}`);
    const levelChip = reward.level != null
      ? `<span class="reward-level">Lv.${reward.level}→${reward.level + 1}</span>`
      : '';
    // 진화 표시: 이번에 고르면 진화 / 이미 진화됨
    const evoName = t(`reward.${reward.id}.evo`);
    const evoChip = reward.willEvolve
      ? `<span class="reward-evo">${t('rewardCard.evolveNow', { name: evoName })}</span>`
      : reward.evolved
        ? `<span class="reward-evo evolved">${t('rewardCard.evolved', { name: evoName })}</span>`
        : '';
    // 트레이드오프 대가 표시
    const downside = reward.downside
      ? `<span class="reward-downside">${t('rewardCard.downside', { text: t(`reward.${reward.id}.downside`) })}</span>`
      : '';
    const tagChips = (reward.tags ?? [])
      .map((tg) => `<span class="reward-tag" style="--syn:${TAGS[tg]?.color}">${TAGS[tg]?.emoji} ${t(`tag.${tg}`)}</span>`)
      .join('');
    const iconHtml = reward.icon.endsWith('.png')
      ? `<img class="reward-icon" src="${reward.icon}" alt="">`
      : `<span class="reward-icon">${reward.icon}</span>`;
    card.innerHTML = `
      ${iconHtml}
      <span class="reward-body">
        <span class="reward-label">${t(`reward.${reward.id}.label`)}<span class="reward-tier">${tierLabel}</span>${levelChip}</span>
        <span class="reward-desc">${t(`reward.${reward.id}.desc`)} ${tagChips}</span>
        ${downside}${evoChip}
      </span>
    `;
    card.addEventListener('click', () => {
      rewardScreen.classList.add('hidden');
      game.chooseReward(reward.id);
    });
    rewardCards.appendChild(card);
  }

  if (btnReroll) {
    const cost = info.rerollCost ?? 0;
    btnReroll.innerHTML = `${t('reward.reroll')} (<img class="coin-ico" src="assets/coin.png" alt=""> ${cost})`;
    btnReroll.disabled = (info.coins ?? 0) < cost;
  }
  if (btnSkip) {
    btnSkip.innerHTML = `${t('reward.skip')} (+<img class="coin-ico" src="assets/coin.png" alt=""> ${info.skipReward ?? 0})`;
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
    onCombo(combo, mult) {
      updateCombo(combo, mult);
    },
    getStartBonuses() {
      return getStartBonuses();
    },
    onGameOver(score, isNewRecord, earned = 0, info = {}) {
      hud.classList.add('hidden');
      chargeBar.classList.add('hidden');
      chargeBar.classList.remove('visible');
      btnPause?.classList.add('hidden');
      pauseScreen?.classList.add('hidden');
      comboEl?.classList.add('hidden');
      gameoverScreen.classList.remove('hidden');
      finalScoreEl.textContent = score;
      newRecordEl.classList.toggle('hidden', !isNewRecord);
      gameoverCoinsEl.textContent = earned;
      lastScore = score;
      lastIsNewRecord = isNewRecord;
      lastEarned = earned;
      if (shareLabel) shareLabel.textContent = t('gameover.share');
      updateHudRecords(game.mode);
      refreshMenuRecords();

      // 보상형 광고: 이어하기(판당 1회, 네이티브 한정)
      const reviveEligible = adsAvailable() && !!info.canRevive;
      setupReviveButton(info.canRevive);
      // 코인 2배: 이어하기 버튼이 뜨면 숨겨서 보상형 버튼 2개 동시노출을 막는다.
      setupRewardCoinsButton(earned, reviveEligible);

      // 메뉴 화면이므로 배너 다시 노출
      showBanner();

      // 전면 광고는 지금 띄우지 않는다(이어하기 CTA를 가리지 않도록).
      // N판마다 1회를 예약해두고, 사용자가 '다시 도전/메인'으로 나갈 때 재생한다.
      gameOverCount += 1;
      pendingInterstitial = gameOverCount % INTERSTITIAL_EVERY === 0;

      // 최고 기록을 깬 순간이면 별점 요청(조건·빈도는 review.js 가 관리).
      // 이어하기 버튼이 떠 있으면 OS 별점 창이 그 버튼을 가리므로 이번엔 묻지 않는다.
      onGameFinished(isNewRecord, { canAsk: !reviveEligible });
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

function isAdvTutorialSeen() {
  try {
    return localStorage.getItem(ADV_TUT_KEY) === '1';
  } catch {
    return false;
  }
}

function markAdvTutorialSeen() {
  try {
    localStorage.setItem(ADV_TUT_KEY, '1');
  } catch {
    /* noop */
  }
}

// 어드벤처 첫 진입이면 튜토리얼을 먼저 보여주고, 아니면 바로 시작한다.
function startGame() {
  if (selectedMode === 'adventure' && !isAdvTutorialSeen()) {
    tutorialScreen?.classList.remove('hidden');
    return;
  }
  beginGame();
}

function beginGame() {
  ensureGame();
  setBgmScene('game');
  startScreen.classList.add('hidden');
  tutorialScreen?.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  rewardScreen.classList.add('hidden');
  pauseScreen?.classList.add('hidden');
  btnRevive?.classList.add('hidden');
  hud.classList.remove('hidden');
  chargeBar.classList.remove('hidden');
  chargeBar.classList.remove('visible');
  btnPause?.classList.remove('hidden');
  chargeFill.style.width = '0%';
  newRecordEl.classList.add('hidden');
  scoreEl.textContent = '0';
  updateGauge(0);
  updateEffects({});
  updateSynergy({});
  updateCoinHud(0);
  updateCombo(0);
  // 어드벤처 전용 HUD(게이지/코인/효과) 표시 제어
  app.classList.toggle('mode-adventure', selectedMode === 'adventure');
  updateHudRecords(selectedMode);
  // 플레이 중에도 배너를 유지한다. 겹치지 않게 #app 이 배너 몫을 비워 둔다.
  game.start(selectedMode, consumeArmed());
}

// 보상형 광고로 코인 2배 받기 버튼 준비.
// 코인을 번 어드벤처 모드 + 네이티브(광고 가능) 환경에서만 노출한다.
function setupRewardCoinsButton(earned, suppress = false) {
  if (!btnRewardCoins) return;
  // suppress=true(이어하기 버튼 노출 중)면 코인2배 버튼은 숨긴다.
  const eligible = adsAvailable() && earned > 0 && !suppress;
  btnRewardCoins.classList.toggle('hidden', !eligible);
  if (!eligible) return;
  btnRewardCoins.disabled = false;
  btnRewardCoins.textContent = t('ad.doubleCoins');
}

async function onRewardCoinsClick() {
  if (!btnRewardCoins || btnRewardCoins.disabled || lastEarned <= 0) return;
  btnRewardCoins.disabled = true;
  btnRewardCoins.textContent = t('ad.loading');
  const rewarded = await showRewardedAd();
  if (rewarded) {
    addCoins(lastEarned); // 같은 양만큼 한 번 더 지급 → 2배
    gameoverCoinsEl.textContent = lastEarned * 2;
    if (menuCoinsEl) menuCoinsEl.textContent = getCoins().toLocaleString();
    btnRewardCoins.textContent = t('ad.doubled');
    lastEarned = 0; // 중복 수령 방지
  } else {
    // 시청 취소/실패 → 다시 시도 가능
    btnRewardCoins.disabled = false;
    btnRewardCoins.textContent = t('ad.doubleCoins');
  }
}

// 광고 보고 이어하기 버튼 준비(판당 1회, 네이티브 한정).
function setupReviveButton(canRevive) {
  if (!btnRevive) return;
  const eligible = adsAvailable() && !!canRevive;
  btnRevive.classList.toggle('hidden', !eligible);
  if (!eligible) return;
  btnRevive.disabled = false;
  btnRevive.textContent = t('ad.revive');
}

async function onReviveClick() {
  if (!btnRevive || btnRevive.disabled || !game) return;
  btnRevive.disabled = true;
  btnRevive.textContent = t('ad.loading');
  const rewarded = await showRewardedAd();
  if (rewarded && game.reviveByAd()) {
    // 다시 플레이 화면으로 전환
    gameoverScreen.classList.add('hidden');
    btnRevive.classList.add('hidden');
    hud.classList.remove('hidden');
    chargeBar.classList.remove('hidden');
    btnPause?.classList.remove('hidden');
    return;
  }
  // 시청 취소/실패 → 다시 시도 가능
  btnRevive.disabled = false;
  btnRevive.textContent = t('ad.revive');
}

// 예약된 전면 광고가 있으면 재생(게임오버 화면을 떠날 때 1회).
async function maybeShowInterstitial() {
  if (!pendingInterstitial) return;
  pendingInterstitial = false;
  await showInterstitial();
}

// 일시정지 열기/닫기
function openPause() {
  if (game?.pause()) pauseScreen?.classList.remove('hidden');
}
function closePause() {
  pauseScreen?.classList.add('hidden');
  game?.resume();
}

// 게임오버 → 메인 메뉴(시작 화면)로
function goToMenu() {
  gameoverScreen.classList.add('hidden');
  rewardScreen.classList.add('hidden');
  pauseScreen?.classList.add('hidden');
  hud.classList.add('hidden');
  chargeBar.classList.add('hidden');
  btnPause?.classList.add('hidden');
  refreshMenuRecords();
  if (menuCoinsEl) menuCoinsEl.textContent = getCoins().toLocaleString();
  renderConsumableArm();
  startScreen.classList.remove('hidden');
  setBgmScene('lobby');
  showBanner(); // 메인 메뉴에서 배너 노출
}

window.addEventListener('resize', updateLayout);
window.addEventListener('orientationchange', () => {
  setTimeout(updateLayout, 150);
});

btnStart.addEventListener('click', startGame);
btnTutorialStart?.addEventListener('click', () => {
  markAdvTutorialSeen();
  tutorialScreen?.classList.add('hidden');
  beginGame();
});
btnRetry.addEventListener('click', async () => {
  await maybeShowInterstitial(); // 예약된 전면 광고 먼저 재생
  startGame();
});
btnMenu?.addEventListener('click', async () => {
  await maybeShowInterstitial();
  goToMenu();
});
btnRewardCoins?.addEventListener('click', onRewardCoinsClick);
btnRevive?.addEventListener('click', onReviveClick);

// 일시정지 버튼: 캔버스 위에 떠 있으므로 터치가 게임(차지/점프)으로
// 전파되지 않도록 막는다. 막지 않으면 버튼을 눌러도 점프가 발동한다.
['touchstart', 'touchend', 'touchcancel'].forEach((ev) => {
  btnPause?.addEventListener(ev, (e) => e.stopPropagation(), { passive: false });
});
btnPause?.addEventListener('click', (e) => {
  e.stopPropagation();
  openPause();
});
btnResume?.addEventListener('click', closePause);
btnPauseMenu?.addEventListener('click', () => {
  pauseScreen?.classList.add('hidden');
  game?.abandonRun();
  goToMenu();
});

// 앱이 백그라운드로 가면(전화 수신·홈 버튼) 자동 일시정지 → 복귀 시 이어하기.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game?.pause()) {
    pauseScreen?.classList.remove('hidden');
  }
});

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
    shareLabel.textContent = t('gameover.shareCopied');
    setTimeout(() => {
      shareLabel.textContent = t('gameover.share');
    }, 2000);
  }
  btnShare.disabled = false;
});

// UI 버튼 클릭음(동적으로 생성되는 보상/상점 버튼까지 위임으로 처리)
app.addEventListener('click', (e) => {
  if (e.target.closest('button')) playClickSound();
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

// 배경음: 첫 사용자 입력에서 시작(음소거 설정이 아니면), 버튼으로 on/off
let bgmArmed = false;
window.addEventListener('pointerdown', () => {
  if (bgmArmed) return;
  bgmArmed = true;
  startBgm();
}, { once: true });

function updateMuteBtn() {
  if (btnMute) btnMute.textContent = isBgmMuted() ? t('sound.off') : t('sound.on');
}
btnMute?.addEventListener('click', () => {
  toggleBgm();
  setSfxMuted(isBgmMuted()); // 효과음도 함께 on/off
  updateMuteBtn();
});

// 언어 선택기: 버튼을 만들고, 누르면 언어 전환 + 화면 문구 갱신.
function renderLangSelector() {
  const el = document.getElementById('lang-select');
  if (!el) return;
  el.innerHTML = '';
  for (const { code, label } of LANGS) {
    const b = document.createElement('button');
    b.className = 'lang-btn' + (code === getLang() ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      setLang(code);
      applyStaticI18n();
      updateMuteBtn();
      setMode(selectedMode); // 모드 힌트 갱신
      refreshMenuRecords();
      renderConsumableArm();
      renderLangSelector();
    });
    el.appendChild(b);
  }
}

async function boot() {
  setPlayerSkin(getEquippedSkin());
  document.documentElement.lang = getLang();
  applyStaticI18n();
  renderLangSelector();
  // 스플래시가 내려간 뒤에 ATT 를 요청해야 한다. iOS 는 앱이 active 가
  // 아니면 추적 동의 팝업을 조용히 무시하기 때문이다(심사 반려 사유였음).
  await initNative();
  // 기록 REST 요청에 붙일 토큰을 먼저 준비한다(initScores 보다 앞서야 한다).
  await initAppCheck();
  await initAds();
  showBanner(); // 시작 화면(메뉴)에서 배너 노출
  if (menuCoinsEl) menuCoinsEl.textContent = getCoins().toLocaleString();
  setSfxMuted(isBgmMuted()); // 저장된 음소거 설정을 효과음에도 반영
  updateMuteBtn();
  setMode(selectedMode);
  renderConsumableArm();
  await initScores();
  setMode(selectedMode); // 점수 로드 후 기록 갱신
  updateLayout();
  showSeasonalGift();
}

// 기간 한정 복장 지급(10월 = 마녀 고양이). 이번에 처음 받았으면 선물 창을 띄운다.
const giftScreen = document.getElementById('gift-screen');
function showSeasonalGift() {
  const granted = grantSeasonalSkins();
  if (!granted.includes('witch') || !giftScreen) return;
  giftScreen.classList.remove('hidden');
}
document.getElementById('btn-gift-equip')?.addEventListener('click', () => {
  if (equipSkin('witch')) setPlayerSkin('witch');
  giftScreen.classList.add('hidden');
});
document.getElementById('btn-gift-later')?.addEventListener('click', () => {
  giftScreen.classList.add('hidden');
});


boot();
