// 별점 요청 — 기분 좋은 순간(최고 기록 경신)에 OS 기본 별점 창을 띄운다.
//
// iOS(SKStoreReviewController)는 1년에 최대 3번만 실제로 창을 보여주고,
// 안드로이드(Play In-App Review)도 할당량이 있어 호출해도 안 뜰 수 있다.
// 창이 떴는지·별점을 줬는지는 앱이 알 수 없으므로, 여기서는 "언제 요청할지"만 관리한다.
//
// 조건
// - 최소 GAMES_BEFORE_ASK 판은 해본 사람에게만. 첫 판은 무조건 최고 기록이라
//   조건을 걸지 않으면 설치 직후 바로 뜬다.
// - 한 번 요청했으면 MIN_DAYS_BETWEEN 일은 다시 묻지 않는다.

const GAMES_BEFORE_ASK = 5;
const MIN_DAYS_BETWEEN = 60;
const DELAY_MS = 1200; // '새 최고 기록!' 문구를 먼저 보여준 뒤에 띄운다

const KEY_GAMES = 'poing.review.games';
const KEY_LAST_ASKED = 'poing.review.lastAsked';

function readNumber(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // 저장이 막혀 있으면 조건 판단만 매번 처음부터 한다. 게임에는 영향 없음.
  }
}

function reviewPlugin() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.InAppReview ?? null;
}

// 판이 끝날 때마다 호출한다.
export function onGameFinished(isNewRecord, { canAsk = true } = {}) {
  const games = readNumber(KEY_GAMES) + 1;
  writeNumber(KEY_GAMES, games);

  if (!canAsk || !isNewRecord || games < GAMES_BEFORE_ASK) return;

  const lastAsked = readNumber(KEY_LAST_ASKED);
  const daysSince = (Date.now() - lastAsked) / (24 * 60 * 60 * 1000);
  if (lastAsked && daysSince < MIN_DAYS_BETWEEN) return;

  const plugin = reviewPlugin();
  if (!plugin) return;

  writeNumber(KEY_LAST_ASKED, Date.now());
  setTimeout(() => {
    plugin.requestReview().catch((err) => {
      console.warn('별점 요청 실패:', err);
    });
  }, DELAY_MS);
}
