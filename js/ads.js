// AdMob 광고(배너 · 전면 · 보상형) — Capacitor 네이티브 앱에서만 동작.
// 번들러를 쓰지 않으므로 ES import 대신 런타임 전역
// window.Capacitor.Plugins.AdMob 로 접근하고, 일반 웹/브라우저에서는
// AdMob 이 없으므로 모든 함수가 조용히 무시(no-op)된다.
//
// ───────────────────────────────────────────────────────────────
// ⚠️ 출시(실 수익화) 전에 반드시 할 일
//   1) 아래 REAL_IDS 의 플랫폼별 광고 단위 ID 를 실제 ID 로 채움(null=테스트)
//   2) IS_TESTING = false 로 변경(본인 기기 테스트 중에는 true 유지 권장)
//   3) Android: android/app/src/main/AndroidManifest.xml 의
//      com.google.android.gms.ads.APPLICATION_ID 를 실제 Android 앱 ID 로 교체
//   4) iOS: ios/App/App/Info.plist 의 GADApplicationIdentifier 를 실제 iOS 앱 ID
//      (ca-app-pub-2605477058500539~3996817843) 로 설정 — ADS_SETUP.md 참고
//   5) 의존성 설치 후 동기화:  npm i @capacitor-community/admob && npx cap sync
// ───────────────────────────────────────────────────────────────

// 개발 중에는 구글 공식 "테스트 광고"를 노출한다(실 수익 없음, 정책 위반 아님).
const IS_TESTING = true;

// 구글 공식 테스트 광고 단위 ID(실 수익 없음, 개발용). 아직 실제 ID 가
// 없는 항목은 이 테스트 ID 를 그대로 사용한다.
const TEST_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

// 실제 광고 단위 ID(플랫폼별). AdMob 의 광고 단위 ID 는 iOS/Android 가
// 서로 다르므로 플랫폼별로 따로 둔다. 아직 발급받지 못한 항목은 null 로
// 두면 자동으로 테스트 ID 가 쓰인다.
const REAL_IDS = {
  ios: {
    banner: 'ca-app-pub-2605477058500539/1069226002',
    interstitial: 'ca-app-pub-2605477058500539/9620679613',
    rewarded: null, // TODO: iOS 보상형 광고 단위 ID 발급 후 교체
  },
  android: {
    banner: 'ca-app-pub-2605477058500539/7686605244',
    interstitial: null, // TODO: Android 전면 광고 단위 ID 발급 후 교체
    rewarded: null, // TODO: Android 보상형 광고 단위 ID 발급 후 교체
  },
};

function admob() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.AdMob ?? null;
}

function platform() {
  return window.Capacitor?.getPlatform?.() ?? 'web';
}

// 현재 플랫폼의 실제 광고 단위 ID(없으면 테스트 ID).
function adUnit(kind) {
  const real = REAL_IDS[platform()]?.[kind];
  return real || TEST_IDS[kind];
}

/** 네이티브 환경에서 AdMob 을 사용할 수 있는지 여부(웹에서는 false). */
export function adsAvailable() {
  return !!admob();
}

let initialized = false;

/** 앱 부팅 시 1회 호출. AdMob 초기화(+iOS 추적 동의 요청). */
export async function initAds() {
  const AdMob = admob();
  if (!AdMob || initialized) return;
  try {
    await AdMob.initialize({ initializeForTesting: IS_TESTING });
    initialized = true;
  } catch (err) {
    console.warn('AdMob 초기화 실패:', err);
  }
}

// ───────── 배너 ─────────
let bannerShown = false;

/** 하단 배너 표시(메인/게임오버 등 메뉴 화면에서). */
export async function showBanner() {
  const AdMob = admob();
  if (!AdMob || bannerShown) return;
  try {
    await AdMob.showBanner({
      adId: adUnit('banner'),
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: 0,
      isTesting: IS_TESTING,
    });
    bannerShown = true;
  } catch (err) {
    console.warn('배너 표시 실패:', err);
  }
}

/** 게임 플레이 중에는 배너를 숨긴다. */
export async function hideBanner() {
  const AdMob = admob();
  if (!AdMob || !bannerShown) return;
  try {
    await AdMob.hideBanner();
    bannerShown = false;
  } catch (err) {
    console.warn('배너 숨김 실패:', err);
  }
}

// ───────── 전면(인터스티셜) ─────────
/** 전면 광고를 준비 후 노출. 성공 시 true. */
export async function showInterstitial() {
  const AdMob = admob();
  if (!AdMob) return false;
  try {
    await AdMob.prepareInterstitial({ adId: adUnit('interstitial'), isTesting: IS_TESTING });
    await AdMob.showInterstitial();
    return true;
  } catch (err) {
    console.warn('전면 광고 실패:', err);
    return false;
  }
}

// ───────── 보상형 ─────────
// 끝까지 시청해 보상을 받으면 true, 중간 종료/실패면 false.
export async function showRewardedAd() {
  const AdMob = admob();
  if (!AdMob) return false;

  let rewarded = false;
  let listener = null;
  try {
    // 버전에 따라 보상은 이벤트로 전달되므로 리스너로 한번 더 확인한다.
    try {
      listener = await AdMob.addListener('onRewardedVideoAdReward', () => {
        rewarded = true;
      });
    } catch {
      /* 이벤트명이 다른 버전일 수 있음 — 반환값으로 판단 */
    }

    await AdMob.prepareRewardVideoAd({ adId: adUnit('rewarded'), isTesting: IS_TESTING });
    const result = await AdMob.showRewardVideoAd();
    // 일부 버전은 보상 아이템({ type, amount })을 반환한다.
    if (result && (result.amount != null || result.type != null || result === true)) {
      rewarded = true;
    }
    return rewarded;
  } catch (err) {
    console.warn('보상형 광고 실패:', err);
    return rewarded;
  } finally {
    try { await listener?.remove?.(); } catch { /* noop */ }
  }
}
