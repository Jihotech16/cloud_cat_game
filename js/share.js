// 게임 결과 공유.
// 우선순위: Capacitor Share(네이티브 앱) → Web Share API(모바일 웹) → 클립보드 복사.

import { t } from './i18n.js';

// 받는 사람이 바로 설치할 수 있게 스토어 링크를 붙인다.
// 안드로이드 앱에서 공유하면 Play 스토어, 그 외(아이폰 앱·웹)는 App Store.
const APP_STORE_URL = 'https://apps.apple.com/app/id6791374302';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.jihotech.cloudcatjump';

function storeUrl() {
  const platform = window.Capacitor?.getPlatform?.();
  return platform === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
}

function buildMessage(score, isBest) {
  const head = isBest ? t('share.best', { n: score }) : t('share.normal', { n: score });
  return `${head}\n${t('share.cta')}`;
}

// 결과를 공유한다. 성공/공유시 true, 클립보드 복사로 대체했으면 'copied', 실패 false.
export async function shareResult(score, isBest = false) {
  const text = buildMessage(score, isBest);
  const title = 'Poing: Cloud Jump';
  const url = storeUrl();

  // 1) Capacitor 네이티브 공유
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.() && cap.Plugins?.Share) {
    try {
      await cap.Plugins.Share.share({ title, text, url, dialogTitle: t('gameover.share') });
      return true;
    } catch (err) {
      if (isAbort(err)) return false; // 사용자가 취소
      // 실패 시 아래 폴백으로 진행
    }
  }

  // 2) Web Share API (모바일 브라우저)
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      if (isAbort(err)) return false;
    }
  }

  // 3) 클립보드 복사 폴백
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return false;
  }
}

function isAbort(err) {
  return err && (err.name === 'AbortError' || /cancel/i.test(err.message || ''));
}
