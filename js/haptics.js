// 햅틱(진동) 피드백 — Capacitor 네이티브 앱에서만 동작.
// 번들러를 쓰지 않으므로 런타임 전역 window.Capacitor.Plugins.Haptics 로
// 접근하고, 일반 웹/브라우저에서는 조용히 무시(no-op)한다.
//
// 사용 플러그인: @capacitor/haptics (Capacitor 8 호환 8.x)

// 설정 화면의 '진동' 토글. 기본은 켜짐.
const HAPTICS_OFF_KEY = 'cloudCat_hapticsOff';

export function isHapticsOn() {
  try {
    return localStorage.getItem(HAPTICS_OFF_KEY) !== '1';
  } catch {
    return true;
  }
}

export function setHapticsOn(on) {
  try {
    localStorage.setItem(HAPTICS_OFF_KEY, on ? '0' : '1');
  } catch {
    // 저장이 막혀 있으면 무시
  }
}

function haptics() {
  if (!isHapticsOn()) return null;
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.Haptics ?? null;
}

// 사용자가 기기 설정에서 진동을 껐을 수 있으므로 실패는 모두 무시한다.
function impact(style) {
  const H = haptics();
  if (!H) return;
  try {
    H.impact?.({ style });
  } catch {
    /* noop */
  }
}

/** 가벼운 탁 — 일반 점프. */
export function hapticLight() {
  impact('LIGHT');
}

/** 중간 — 트램펄린 튕김 · 보상 선택. */
export function hapticMedium() {
  impact('MEDIUM');
}

/** 강한 — 가시 충돌 · 게임오버. */
export function hapticHeavy() {
  impact('HEAVY');
}

/** 성공 알림(짧은 3단) — 레인보우 · 로켓. */
export function hapticSuccess() {
  const H = haptics();
  if (!H) return;
  try {
    H.notification?.({ type: 'SUCCESS' });
  } catch {
    /* noop */
  }
}
