// Firebase App Check — 기록 저장 REST 요청이 "진짜 우리 앱"에서 왔는지 증명한다.
//
// score.js 는 Realtime Database 를 REST 로 직접 호출한다. 보안 규칙만으로는
// 값을 깎거나 형식을 망가뜨리는 건 막아도, URL 만 알면 누구나 curl 로
// 그럴듯한 높은 점수를 써넣는 것까지는 막을 수 없다. App Check 토큰을 붙이면
// 서버가 요청의 출처를 검증하므로 그 구멍이 닫힌다.
//
// iOS 는 App Attest, 안드로이드는 Play Integrity 를 쓴다. 둘 다 실기기에서만
// 동작하므로 시뮬레이터·에뮬레이터·웹에서는 토큰이 없고, 그때는 헤더 없이
// 그냥 보낸다(모니터링 단계에서는 거부되지 않는다).
//
// ⚠️ 콘솔에서 '강제(enforce)' 로 바꾸는 시점 주의:
// 이미 배포된 빌드는 토큰을 보내지 않으므로, 강제로 바꾸면 그 사용자들의
// 기록 동기화가 전부 끊긴다. App Check 가 들어간 버전이 충분히 보급된 뒤에
// 전환할 것.

let plugin = null;
let ready = false;

// 토큰은 만료 전까지 재사용한다. 매 요청마다 새로 받으면 App Attest 가
// 기기에 불필요한 부담을 준다.
let cachedToken = null;
let cachedExpiry = 0;

const EXPIRY_MARGIN_MS = 60 * 1000; // 만료 1분 전에는 미리 갱신

function appCheck() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.FirebaseAppCheck ?? null;
}

export async function initAppCheck() {
  plugin = appCheck();
  if (!plugin) return; // 웹/브라우저에서는 조용히 통과

  try {
    await plugin.initialize({ isTokenAutoRefreshEnabled: true });
    ready = true;
  } catch (err) {
    // 실패해도 게임은 그대로 굴러가야 한다. 토큰만 못 붙일 뿐이다.
    console.warn('App Check 초기화 실패(토큰 없이 진행):', err);
    ready = false;
  }
}

// 유효한 토큰을 돌려준다. 못 받으면 null — 호출부는 헤더를 생략하면 된다.
export async function getAppCheckToken() {
  if (!ready || !plugin) return null;

  const now = Date.now();
  if (cachedToken && now < cachedExpiry - EXPIRY_MARGIN_MS) return cachedToken;

  try {
    const res = await plugin.getToken({ forceRefresh: false });
    if (!res?.token) return null;
    cachedToken = res.token;
    // expireTimeMillis 는 iOS/안드로이드에서만 온다. 없으면 30분으로 잡는다.
    cachedExpiry = res.expireTimeMillis ?? now + 30 * 60 * 1000;
    return cachedToken;
  } catch (err) {
    console.warn('App Check 토큰 발급 실패(토큰 없이 진행):', err);
    return null;
  }
}

// fetch 에 넘길 헤더를 만든다. 토큰이 없으면 넘겨받은 헤더를 그대로 돌려준다.
export async function withAppCheck(headers = {}) {
  const token = await getAppCheckToken();
  return token ? { ...headers, 'X-Firebase-AppCheck': token } : headers;
}
