import { FIREBASE_DB_URL } from './firebase-config.js';

const STORAGE_KEY = 'cloudCatJump_bestScore';
const DEVICE_KEY = 'cloudCatJump_deviceId';

let cachedBest = 0;
let cachedGlobalBest = 0;

function readLocalBest() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const score = parseInt(raw ?? '0', 10);
  return Number.isFinite(score) ? score : 0;
}

function writeLocalBest(score) {
  localStorage.setItem(STORAGE_KEY, String(score));
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function firebaseScorePath() {
  return `${FIREBASE_DB_URL}/bestScores/${getDeviceId()}.json`;
}

function firebaseAllScoresPath() {
  return `${FIREBASE_DB_URL}/bestScores.json`;
}

function extractScore(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.score === 'number') return value.score;
  return 0;
}

async function fetchRemoteBest() {
  const res = await fetch(firebaseScorePath());
  if (!res.ok) throw new Error(`Firebase read failed: ${res.status}`);
  const data = await res.json();
  return extractScore(data);
}

async function fetchGlobalBest() {
  const res = await fetch(firebaseAllScoresPath());
  if (!res.ok) throw new Error(`Firebase read failed: ${res.status}`);
  const data = await res.json();
  if (data == null || typeof data !== 'object') return 0;
  let max = 0;
  for (const value of Object.values(data)) {
    const score = extractScore(value);
    if (score > max) max = score;
  }
  return max;
}

async function pushRemoteBest(score) {
  const res = await fetch(firebaseScorePath(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      score,
      updatedAt: Date.now(),
    }),
  });
  if (!res.ok) throw new Error(`Firebase write failed: ${res.status}`);
}

export async function initScores() {
  const local = readLocalBest();
  cachedBest = local;

  // 개인 최고기록 동기화
  try {
    const remote = await fetchRemoteBest();
    cachedBest = Math.max(local, remote);
    writeLocalBest(cachedBest);

    if (remote < cachedBest) {
      await pushRemoteBest(cachedBest);
    }
  } catch (err) {
    console.warn('Firebase score sync skipped:', err);
  }

  // 전체 최고기록 조회 (실패해도 개인 기록에는 영향 없음)
  cachedGlobalBest = cachedBest;
  try {
    const global = await fetchGlobalBest();
    cachedGlobalBest = Math.max(global, cachedBest);
  } catch (err) {
    console.warn('Firebase global best skipped (전체 노드 읽기 권한 확인 필요):', err);
  }
}

export function getBestScore() {
  return cachedBest;
}

export function getGlobalBest() {
  return cachedGlobalBest;
}

export function saveBestScore(score) {
  const floored = Math.floor(score);
  if (floored <= cachedBest) return false;

  cachedBest = floored;
  if (floored > cachedGlobalBest) cachedGlobalBest = floored;
  writeLocalBest(floored);

  pushRemoteBest(floored).catch((err) => {
    console.warn('Firebase score save failed:', err);
  });

  return true;
}
