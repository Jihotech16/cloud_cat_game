# 앱 빌드 & 출시 가이드 (Capacitor)

이 프로젝트는 [Capacitor](https://capacitorjs.com/)로 기존 웹 게임을 iOS/Android 네이티브 앱으로 감쌉니다.
웹 소스는 리포 루트(`index.html`, `css/`, `js/`, `assets/`, `icons/`)에 그대로 두고,
빌드 시 `www/`로 복사한 뒤 네이티브 프로젝트에 주입합니다.

- **App ID**: `com.jihotech.cloudcatjump`
- **App Name**: `Cloud Cat Jump`

> ⚠️ 실제 빌드/서명/스토어 제출은 **본인 PC**에서 진행해야 합니다.
> (Android는 Windows/Mac/Linux, **iOS는 macOS + Xcode 필수**)

---

## 0. 사전 준비 (PC)

```bash
git clone https://github.com/Jihotech16/cloud_cat_game.git
cd cloud_cat_game
npm install
```

- **Android**: [Android Studio](https://developer.android.com/studio) 설치 (JDK 17 포함)
- **iOS**: macOS + [Xcode](https://apps.apple.com/app/xcode/id497799835) + CocoaPods (`sudo gem install cocoapods`)

---

## 1. 웹 자산 빌드

```bash
npm run build      # 루트 웹 파일 → www/ 복사
```

---

## 2. Android

Android 네이티브 프로젝트(`android/`)는 이미 리포에 포함돼 있습니다.

```bash
npm run sync           # www 빌드 + 네이티브로 동기화
npm run open:android   # Android Studio로 열기
```

Android Studio에서:
1. Gradle 동기화가 끝나길 기다립니다.
2. **Run ▶** 으로 에뮬레이터/실기기 테스트.
3. 출시용 빌드: **Build → Generate Signed Bundle / APK → Android App Bundle(.aab)**
   - 키스토어가 없으면 새로 생성(분실하면 업데이트 불가하니 안전하게 보관).
4. 생성된 `.aab`를 [Google Play Console](https://play.google.com/console)에 업로드.
   - Play 개발자 계정 등록비 $25(1회).

> 네이티브 프로젝트를 처음부터 다시 만들려면: `npx cap add android`

---

## 3. iOS (macOS 필요)

iOS 프로젝트는 리포에 포함돼 있지 않습니다(CocoaPods/Xcode 필요). 로컬에서 생성:

```bash
npm run build
npx cap add ios
npm run sync
npm run open:ios       # Xcode로 열기
```

Xcode에서:
1. **Signing & Capabilities** → 본인 Apple 개발자 팀 선택.
2. 실기기/시뮬레이터로 **Run ▶** 테스트.
3. 출시: **Product → Archive → Distribute App → App Store Connect** 업로드.
   - Apple 개발자 프로그램 $99/년.

---

## 4. 아이콘 / 스플래시

아이콘 소스: `icons/icon.svg` → 생성물:
- PWA/웹: `icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
- Capacitor 소스: `resources/icon.png`(1024), `resources/splash.png`(2732)
- Android 런처 아이콘: `android/.../res/mipmap-*` (이미 적용됨)

### 아이콘 재생성
SVG를 수정했다면:

```bash
npm run icons                       # 웹/PWA + resources/ PNG 재생성
node scripts/gen-android-icons.mjs  # Android 런처 아이콘 재생성
```

> 이 리포의 스크립트는 sharp 바이너리 다운로드가 막힌 환경 때문에 Chromium으로 렌더링합니다.
> **본인 PC라면** 공식 도구가 더 간편합니다:
> ```bash
> npm i -D @capacitor/assets
> npx @capacitor/assets generate --iconBackgroundColor '#6ec6ff' --splashBackgroundColor '#6ec6ff'
> ```
> (`resources/icon.png`, `resources/splash.png`를 소스로 iOS/Android 아이콘·스플래시 일괄 생성)

---

## 5. 자주 쓰는 명령 요약

| 명령 | 설명 |
|------|------|
| `npm run build` | 웹 자산 → `www/` |
| `npm run sync` | 빌드 + 네이티브 동기화(`cap sync`) |
| `npm run open:android` / `open:ios` | IDE 열기 |
| `npm run run:android` / `run:ios` | 동기화 후 기기 실행 |
| `npm run icons` | 웹/PWA 아이콘 재생성 |

---

## 참고: 코드 수정 → 앱 반영 흐름

게임 로직(`js/`, `css/`, `index.html`)을 고친 뒤에는 항상:

```bash
npm run sync
```

을 실행해야 네이티브 앱에 반영됩니다.
