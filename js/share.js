// 게임 결과 공유.
// 우선순위: Capacitor Share(네이티브 앱) → Web Share API(모바일 웹) → 클립보드 복사.

const GAME_URL = 'https://jihotech16.github.io/cloud_cat_game/';

function buildMessage(score, isBest) {
  const head = isBest
    ? `☁️🐱 신기록! 구름냥 점프에서 ${score}m 등반!`
    : `☁️🐱 구름냥 점프에서 ${score}m 등반!`;
  return `${head}\n나보다 높이 올라갈 수 있어? 도전해봐!`;
}

// 결과를 공유한다. 성공/공유시 true, 클립보드 복사로 대체했으면 'copied', 실패 false.
export async function shareResult(score, isBest = false) {
  const text = buildMessage(score, isBest);
  const title = '구름냥 점프';

  // 1) Capacitor 네이티브 공유
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.() && cap.Plugins?.Share) {
    try {
      await cap.Plugins.Share.share({ title, text, url: GAME_URL, dialogTitle: '결과 공유' });
      return true;
    } catch (err) {
      if (isAbort(err)) return false; // 사용자가 취소
      // 실패 시 아래 폴백으로 진행
    }
  }

  // 2) Web Share API (모바일 브라우저)
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: GAME_URL });
      return true;
    } catch (err) {
      if (isAbort(err)) return false;
    }
  }

  // 3) 클립보드 복사 폴백
  try {
    await navigator.clipboard.writeText(`${text}\n${GAME_URL}`);
    return 'copied';
  } catch {
    return false;
  }
}

function isAbort(err) {
  return err && (err.name === 'AbortError' || /cancel/i.test(err.message || ''));
}
