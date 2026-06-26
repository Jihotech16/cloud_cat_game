// Capacitor 네이티브 앱(iOS/Android)에서만 동작하는 초기화.
// 이 프로젝트는 번들러를 쓰지 않으므로 ES import 대신
// 런타임에 주입되는 전역 window.Capacitor.Plugins 로 플러그인에 접근한다.
// (일반 웹/브라우저에서는 Capacitor 가 없으므로 조용히 건너뛴다.)

export async function initNative() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  const plugins = cap.Plugins ?? {};
  const { StatusBar, SplashScreen } = plugins;

  // 상태바: 하늘색 배경에 어울리는 어두운 아이콘(Style.Light = 밝은 배경용)
  if (StatusBar) {
    try {
      await StatusBar.setStyle({ style: 'LIGHT' });
      // Android 전용 — iOS 에서는 무시됨
      await StatusBar.setBackgroundColor?.({ color: '#6ec6ff' });
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
