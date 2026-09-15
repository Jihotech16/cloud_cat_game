// Capacitor 네이티브 앱(iOS/Android)에서만 동작하는 초기화.
// 이 프로젝트는 번들러를 쓰지 않으므로 ES import 대신
// 런타임에 주입되는 전역 window.Capacitor.Plugins 로 플러그인에 접근한다.
// (일반 웹/브라우저에서는 Capacitor 가 없으므로 조용히 건너뛴다.)

export async function initNative() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  // 네이티브 전용 스타일 훅(예: "홈 화면에 추가" 안내 숨김 — 이미 앱이므로)
  document.documentElement.classList.add('is-native');

  const plugins = cap.Plugins ?? {};
  const { StatusBar, SplashScreen } = plugins;

  // 상태바는 숨긴다. 게임 화면이라 시계·배터리가 필요 없고, 그 자리까지 점수 HUD 를
  // 끌어올리기 위해서다(style.css .hud 참고). 숨김이 실패해도 보이게 되는 경우를 위해
  // 하늘색 배경에 어울리는 어두운 아이콘 스타일은 먼저 지정해 둔다.
  if (StatusBar) {
    try {
      await StatusBar.setStyle({ style: 'LIGHT' });
      // Android 전용 — iOS 에서는 무시됨
      await StatusBar.setBackgroundColor?.({ color: '#6ec6ff' });
      await StatusBar.hide();
    } catch {
      /* 상태바 제어 실패는 치명적이지 않으므로 무시 */
    }
  }

  // 게임 리소스가 준비되면 스플래시 숨김(자동 숨김 타임아웃의 백업)
  if (SplashScreen) {
    try {
      await SplashScreen.hide();
    } catch {
      /* noop */
    }
  }
}
