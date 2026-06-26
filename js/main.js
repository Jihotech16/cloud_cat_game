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

function ensureGame() {
  if (game) return;

  game = new Game(canvas, app, {
    onScore(score) {
      scoreEl.textContent = score;
    },
    onCharge(charge, holding) {
      updateChargeBar(charge, holding);
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
  hud.classList.remove('hidden');
  chargeBar.classList.remove('hidden');
  chargeBar.classList.remove('visible');
  chargeFill.style.width = '0%';
  newRecordEl.classList.add('hidden');
  scoreEl.textContent = '0';
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
