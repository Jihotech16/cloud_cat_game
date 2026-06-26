const STORAGE_KEY = 'cloudCatJump_bestScore';

export function getBestScore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const score = parseInt(raw ?? '0', 10);
  return Number.isFinite(score) ? score : 0;
}

export function saveBestScore(score) {
  const current = getBestScore();
  if (score > current) {
    localStorage.setItem(STORAGE_KEY, String(Math.floor(score)));
    return true;
  }
  return false;
}

// Firebase 연동 시 이 모듈을 확장할 예정
export async function syncScore(_score) {
  // TODO: Firebase leaderboard
}
