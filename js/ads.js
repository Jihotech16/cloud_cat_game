// AdMob 광고(배너 · 전면 · 보상형) — Capacitor 네이티브 앱에서만 동작.
// 번들러를 쓰지 않으므로 ES import 대신 런타임 전역
// window.Capacitor.Plugins.AdMob 로 접근하고, 일반 웹/브라우저에서는
// AdMob 이 없으므로 모든 함수가 조용히 무시(no-op)된다.
//
// ───────────────────────────────────────────────────────────────
// ⚠️ 출시(실 수익화) 전에 반드시 할 일
//   1) 아래 REAL_IDS 의 플랫폼별 광고 단위 ID 를 실제 ID 로 채움(null=테스트)
//   2) IS_TESTING = false 유지. 본인 기기 테스트는 TEST_DEVICE_IDS 등록으로 해결
//   3) Android: android/app/src/main/AndroidManifest.xml 의
//      com.google.android.gms.ads.APPLICATION_ID 를 실제 Android 앱 ID 로 교체
//   4) iOS: ios/App/App/Info.plist 의 GADApplicationIdentifier 를 실제 iOS 앱 ID
//      (ca-app-pub-2605477058500539~3996817843) 로 설정 — ADS_SETUP.md 참고
//   5) 의존성 설치 후 동기화:  npm i @capacitor-community/admob && npx cap sync
// ───────────────────────────────────────────────────────────────

// 개발 중에는 구글 공식 "테스트 광고"를 노출한다(실 수익 없음, 정책 위반 아님).
const IS_TESTING = false;

// 개발자 본인 기기(해시 ID).
//
// ⚠️ 2026-09-05 확인: 이 배열은 실제로 동작하지 않는다.
// AdMob.initialize({ testingDevices }) 로 넘겨도 GMA SDK 의
// requestConfiguration.testDeviceIdentifiers 는 빈 배열로 남는다(실기기 로그로 확인).
// 즉 여기에 올바른 ID 를 넣어도 개발자 기기에 실광고가 그대로 나간다.
//
// 그래서 개발자 기기는 **AdMob 콘솔**에 등록해 막는다:
//   설정 > 기기 테스트 > 테스트 기기 추가 (플랫폼 iOS, 광고 ID/IDFA 입력)
// 콘솔 등록은 서버에서 적용되므로 앱 코드와 무관하고 이미 배포된 빌드에도 즉시 먹는다.
//   · 지호 iPhone 16 Pro Max — IDFA BFD5AF9A-13FE-418C-A9A8-B5EABD9D21A9 (2026-09-05 등록)
// IDFA 는 ATT 를 허용한 상태에서만 유효하다. 재설치해도 바뀌지 않는다
// (기기 해시 ID 와 달리 IDFA 는 IDFV 기반이 아니다).
const TEST_DEVICE_IDS = [];

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
    rewarded: 'ca-app-pub-2605477058500539/4433755949',
  },
  android: {
    banner: 'ca-app-pub-2605477058500539/7686605244',
    interstitial: 'ca-app-pub-2605477058500539/1408550044',
    rewarded: 'ca-app-pub-2605477058500539/2669660823',
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * iOS 추적 동의(ATT) 팝업을 확실히 띄운다.
 *
 * iOS 는 앱이 active 상태가 아닐 때 requestTrackingAuthorization 을 조용히
 * 무시한다 — 팝업이 뜨지 않고 notDetermined 로 즉시 반환된다. 스플래시가
 * 떠 있는 동안 호출하면 정확히 이 현상이 나고, 2026-07 심사에서 이 사유로
 * Guideline 2.1 반려를 받았다(프레임워크는 링크됐는데 팝업을 못 찾겠다).
 *
 * 그래서 (1) 호출 전에 스플래시가 내려가길 기다리고(main.js 에서 initNative
 * 를 await), (2) 여기서 상태를 확인해가며 재시도하고, (3) 그래도 안 뜨면
 * 첫 사용자 입력 시 한 번 더 시도한다. 사용자 입력 시점은 앱이 반드시
 * active 이므로 마지막 안전망이 된다.
 */
async function requestAttWithRetry(AdMob) {
  if (platform() !== 'ios') return;
  if (typeof AdMob.requestTrackingAuthorization !== 'function') return;

  const status = async () => {
    try {
      const r = await AdMob.trackingAuthorizationStatus?.();
      return r?.status ?? null;
    } catch {
      return null; // 조회 실패는 미결정으로 간주하고 요청을 시도한다
    }
  };

  // 이미 응답한 사용자에게는 다시 물을 수 없다(설정에서만 변경 가능).
  const before = await status();
  if (before && before !== 'notDetermined') return;

  for (let i = 0; i < 3; i++) {
    try {
      await AdMob.requestTrackingAuthorization();
    } catch (err) {
      console.warn('ATT 동의 요청 실패:', err);
    }
    const after = await status();
    if (after && after !== 'notDetermined') return; // 사용자가 응답함
    await sleep(600); // 아직 active 가 아닐 수 있으니 잠시 후 재시도
  }

  // 마지막 안전망: 첫 사용자 입력 때 한 번 더(그 시점엔 반드시 active).
  const onFirstInput = async () => {
    document.removeEventListener('pointerdown', onFirstInput);
    if ((await status()) === 'notDetermined') {
      try {
        await AdMob.requestTrackingAuthorization();
      } catch { /* noop */ }
    }
  };
  document.addEventListener('pointerdown', onFirstInput, { once: true });
}

/** 앱 부팅 시 1회 호출. iOS 추적 동의(ATT) 팝업 → AdMob 초기화. */
export async function initAds() {
  const AdMob = admob();
  if (!AdMob || initialized) return;
  try {
    // ATT 팝업은 광고 초기화(=추적 데이터 수집) '전에' 띄워야 한다.
    await requestAttWithRetry(AdMob);
    await AdMob.initialize({
      initializeForTesting: IS_TESTING,
      testingDevices: TEST_DEVICE_IDS,
    });
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
