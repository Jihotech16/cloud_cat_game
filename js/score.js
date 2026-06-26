import { FIREBASE_DB_URL } from './firebase-config.js';

const STORAGE_KEY = 'cloudCatJump_bestScore';
const DEVICE_KEY = 'cloudCatJump_deviceId';

let cachedBest = 0;

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

async function fetchRemoteBest() {
  const res = await fetch(firebaseScorePath());
  if (!res.ok) throw new Error(`Firebase read failed: ${res.status}`);
  const data = await res.json();
  if (data == null) return 0;
  if (typeof data === 'number') return data;
  if (typeof data.score === 'number') return data.score;
  return 0;
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
}

export function getBestScore() {
  return cachedBest;
}

export function saveBestScore(score) {
  const floored = Math.floor(score);
  if (floored <= cachedBest) return false;

  cachedBest = floored;
  writeLocalBest(floored);

  pushRemoteBest(floored).catch((err) => {
    console.warn('Firebase score save failed:', err);
  });

  return true;
}
