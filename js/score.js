import { FIREBASE_DB_URL } from './firebase-config.js';

const DEVICE_KEY = 'cloudCatJump_deviceId';

// 모드별 저장 위치. classic은 기존 경로를 그대로 써서 데이터 호환을 유지한다.
const MODES = {
  classic: { storageKey: 'cloudCatJump_bestScore', node: 'bestScores' },
  adventure: { storageKey: 'cloudCatJump_bestScore_adventure', node: 'bestScoresAdventure' },
};

const cachedBest = { classic: 0, adventure: 0 };
const cachedGlobalBest = { classic: 0, adventure: 0 };

function modeConf(mode) {
  return MODES[mode] ?? MODES.classic;
}

function readLocalBest(mode) {
  const raw = localStorage.getItem(modeConf(mode).storageKey);
  const score = parseInt(raw ?? '0', 10);
  return Number.isFinite(score) ? score : 0;
}

function writeLocalBest(mode, score) {
  localStorage.setItem(modeConf(mode).storageKey, String(score));
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function firebaseScorePath(mode) {
  return `${FIREBASE_DB_URL}/${modeConf(mode).node}/${getDeviceId()}.json`;
}

function firebaseAllScoresPath(mode) {
  return `${FIREBASE_DB_URL}/${modeConf(mode).node}.json`;
}

function extractScore(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.score === 'number') return value.score;
  return 0;
}

async function fetchRemoteBest(mode) {
  const res = await fetch(firebaseScorePath(mode));
  if (!res.ok) throw new Error(`Firebase read failed: ${res.status}`);
  return extractScore(await res.json());
}

async function fetchGlobalBest(mode) {
  const res = await fetch(firebaseAllScoresPath(mode));
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

async function pushRemoteBest(mode, score) {
  const res = await fetch(firebaseScorePath(mode), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, updatedAt: Date.now() }),
  });
  if (!res.ok) throw new Error(`Firebase write failed: ${res.status}`);
}

async function syncMode(mode) {
  const local = readLocalBest(mode);
  cachedBest[mode] = local;

  // 개인 최고기록 동기화
  try {
    const remote = await fetchRemoteBest(mode);
    cachedBest[mode] = Math.max(local, remote);
    writeLocalBest(mode, cachedBest[mode]);
    if (remote < cachedBest[mode]) {
      await pushRemoteBest(mode, cachedBest[mode]);
    }
  } catch (err) {
    console.warn(`Firebase score sync skipped (${mode}):`, err);
  }

  // 전체 최고기록 (실패해도 개인 기록에는 영향 없음)
  cachedGlobalBest[mode] = cachedBest[mode];
  try {
    const global = await fetchGlobalBest(mode);
    cachedGlobalBest[mode] = Math.max(global, cachedBest[mode]);
  } catch (err) {
    console.warn(`Firebase global best skipped (${mode}, 전체 노드 읽기 권한 확인 필요):`, err);
  }
}

export async function initScores() {
  await Promise.all(Object.keys(MODES).map((mode) => syncMode(mode)));
}

export function getBestScore(mode = 'classic') {
  return cachedBest[mode] ?? 0;
}

export function getGlobalBest(mode = 'classic') {
  return cachedGlobalBest[mode] ?? 0;
}

export function saveBestScore(mode, score) {
  const floored = Math.floor(score);
  if (floored <= (cachedBest[mode] ?? 0)) return false;

  cachedBest[mode] = floored;
  if (floored > (cachedGlobalBest[mode] ?? 0)) cachedGlobalBest[mode] = floored;
  writeLocalBest(mode, floored);

  pushRemoteBest(mode, floored).catch((err) => {
    console.warn(`Firebase score save failed (${mode}):`, err);
  });

  return true;
}
