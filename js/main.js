import { Game } from './game.js';
import { isMobileDevice, isPortrait } from './device.js';
import { initScores, getGlobalBest } from './score.js';
import { initNative } from './native.js';
import { shareResult } from './share.js';

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
const rewardScreen = document.getElementById('reward-screen');
const rewardCards = document.getElementById('reward-cards');


let game = null;
let lastScore = 0;
let lastIsNewRecord = false;

function updateChargeBar(charge, holding) {
  chargeFill.style.width = `${charge * 100}%`;
  chargeBar.classList.toggle('visible', holding);
}

function updateBestDisplays(best) {
  bestScoreEl.textContent = best;
  menuBestEl.textContent = best;

  const global = getGlobalBest();
  globalBestEl.textContent = global;
  menuGlobalBestEl.textContent = global;
}

function updateGauge(ratio) {
  gaugeFill.style.width = `${Math.round(ratio * 100)}%`;
  gaugeFill.classList.toggle('full', ratio >= 1);
}

function updateEffects(effects = {}) {
  const badges = [];
  if (effects.jumpLevel > 0) badges.push(`🚀×${effects.jumpLevel}`);
  if (effects.magnetLevel > 0) badges.push(`🧲×${effects.magnetLevel}`);
  if (effects.scoreX2) badges.push('✨×2');
  if (effects.shield) badges.push('🛡️');
  effectsEl.innerHTML = badges
    .map((b) => `<span class="effect-badge">${b}</span>`)
    .join('');
}

function showRewardChoices(choices) {
  rewardCards.innerHTML = '';
  for (const reward of choices) {
    const card = document.createElement('button');
    card.className = 'reward-card';
    card.innerHTML = `
      <span class="reward-icon">${reward.icon}</span>
      <span class="reward-label">${reward.label}</span>
      <span class="reward-desc">${reward.desc}</span>
    `;
    card.addEventListener('click', () => {
      rewardScreen.classList.add('hidden');
      game.chooseReward(reward.id);
    });
    rewardCards.appendChild(card);
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
    onReward(choices) {
      showRewardChoices(choices);
    },
    onGameOver(score, isNewRecord) {
      hud.classList.add('hidden');
      chargeBar.classList.add('hidden');
      chargeBar.classList.remove('visible');
      gameoverScreen.classList.remove('hidden');
      finalScoreEl.textContent = score;
      newRecordEl.classList.toggle('hidden', !isNewRecord);
      lastScore = score;
      lastIsNewRecord = isNewRecord;
      btnShare.textContent = '📤 결과 공유하기';
      updateBestDisplays(game.getBestScore());
    },
  });

  updateBestDisplays(game.getBestScore());
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
  game.start();
}

window.addEventListener('resize', updateLayout);
window.addEventListener('orientationchange', () => {
  setTimeout(updateLayout, 150);
});

btnStart.addEventListener('click', startGame);
btnRetry.addEventListener('click', startGame);

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
  await initScores();
  updateLayout();
}

boot();
