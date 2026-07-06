# 아이폰 앱 만들기 (iOS 네이티브) — Poing: Cloud Jump

맥에서 이 게임을 아이폰 앱으로 빌드·테스트·출시하는 전체 절차입니다.
(웹/PWA·Android 기본 절차는 `APP_BUILD.md` 참고)

- **App ID(번들 ID)**: `com.jihotech.cloudcatjump`
- **App Name**: `Poing: Cloud Jump`
- iOS 빌드는 **macOS + Xcode 필수** (윈도우 불가)

> ⚠️ **가장 중요**: 이 앱은 AdMob 광고가 들어있어, iOS는 `Info.plist`에 광고 앱 ID를
> 넣지 않으면 **실행하자마자 크래시**합니다. 아래 2번을 꼭 하세요.

---

## 0. 사전 준비 (맥)

```bash
# Xcode: App Store에서 설치
sudo gem install cocoapods          # CocoaPods (의존성 관리)

git clone https://github.com/Jihotech16/cloud_cat_game.git
cd cloud_cat_game
npm install
```

- 내 아이폰에서 **테스트만** 하려면 → 무료 Apple ID로 가능(앱이 7일마다 만료)
- **앱스토어 출시**까지 하려면 → **Apple Developer Program 연 $99** 필요

---

## 1. iOS 프로젝트 생성 & Xcode 열기

```bash
npm run build          # 웹 자산 → www/
npx cap add ios        # ios/ 네이티브 프로젝트 생성 (최초 1회)
npm run sync           # 빌드 + 동기화
npm run open:ios       # Xcode로 열기
```

---

## 2. ⚠️ AdMob 설정 (필수 — 안 하면 크래시)

Xcode 왼쪽에서 **App → App → Info.plist** 를 열고(또는 `ios/App/App/Info.plist` 직접 편집),
`</dict>` 위에 아래를 추가합니다.

```xml
<!-- AdMob iOS 앱 ID (Poing: Cloud Jump) -->
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-2605477058500539~3996817843</string>

<!-- iOS 14.5+ 추적 동의(ATT) 안내 문구 -->
<key>NSUserTrackingUsageDescription</key>
<string>맞춤 광고를 제공하기 위해 사용됩니다.</string>

<!-- (권장) SKAdNetwork — 광고 성과 측정. 구글 공식 목록 최신본으로 교체 권장 -->
<key>SKAdNetworkItems</key>
<array>
  <dict><key>SKAdNetworkIdentifier</key><string>cstr6suwn9.skadnetwork</string></dict>
</array>
```

> 광고 단위 ID(배너/전면/보상형)는 이미 `js/ads.js`에 iOS용으로 들어가 있습니다.
> 개발 중에는 `IS_TESTING = true`라 테스트 광고가 떠서 안전하고, 출시 직전에 `false`로 바꾸세요.
> (자세한 건 `ADS_SETUP.md`)

---

## 3. 서명(Signing) 설정

Xcode에서 **App 타깃 → Signing & Capabilities**:
1. **Team**: 본인 Apple ID(또는 개발자 팀) 선택
2. **Bundle Identifier**: `com.jihotech.cloudcatjump` 확인 (AdMob·번들 식별과 일치해야 함 — 바꾸지 말 것)
3. "Automatically manage signing" 체크

---

## 4. 내 아이폰에서 실행 (테스트)

1. 아이폰을 케이블로 맥에 연결 (처음이면 "이 컴퓨터를 신뢰")
2. Xcode 상단 기기 선택 → 내 아이폰
3. **Run ▶**
4. 아이폰: **설정 → 일반 → VPN 및 기기 관리** → 본인 개발자 앱 **신뢰**
5. 앱 실행 확인 (메뉴 하단에 테스트 배너, 게임오버 3판마다 전면 등)

> 무료 계정은 7일 후 만료 → 다시 Run 하면 갱신. 유료 계정은 1년.

터미널로 한 번에:
```bash
npm run run:ios
```

---

## 5. 아이콘 / 스플래시

맥에서는 공식 도구가 가장 간편합니다:
```bash
npm i -D @capacitor/assets
npx @capacitor/assets generate --ios \
  --iconBackgroundColor '#6ec6ff' --splashBackgroundColor '#6ec6ff'
```
- 소스: `resources/icon.png`(1024×1024), `resources/splash.png`
- iOS 앱 아이콘·런치스크린 일괄 생성 → `npm run sync` 후 반영

---

## 6. 앱스토어 출시 (Apple Developer $99/년)

1. [App Store Connect](https://appstoreconnect.apple.com)에서 새 앱 등록
   - 번들 ID: `com.jihotech.cloudcatjump`
   - 이름: `Poing: Cloud Jump`
2. 출시 전 `js/ads.js`의 `IS_TESTING = false`로 변경 → `npm run sync`
3. Xcode: **Product → Archive** → **Distribute App → App Store Connect** 업로드
4. App Store Connect에서 제출 준비:
   - 스크린샷(6.7"·6.5" 등 필수 사이즈), 설명, 키워드, 카테고리(게임)
   - **개인정보 처리방침 URL** (광고 SDK 사용 시 필수)
   - **앱 개인정보(App Privacy)**: AdMob이 수집하는 데이터(식별자/사용 데이터 등) 신고
   - 연령 등급 설정
5. **심사 제출** → 보통 1~3일

> ⚠️ 광고가 있으므로 심사 시 개인정보 처리방침과 App Privacy 신고가 특히 중요합니다.
> ATT(추적 동의)를 실제로 띄우려면 AdMob UMP/ATT 흐름 코드가 필요할 수 있어요(원하면 붙여드림).

---

## 7. 코드 수정 → 앱 반영

게임을 고친 뒤에는 항상:
```bash
git pull            # 최신 코드
npm run sync        # www 재빌드 + iOS 동기화
```
그다음 Xcode에서 다시 Run/Archive.

---

## 요약 체크리스트
- [ ] Xcode + CocoaPods 설치
- [ ] `npx cap add ios` → `npm run open:ios`
- [ ] **Info.plist에 GADApplicationIdentifier 추가 (필수!)**
- [ ] Signing & Capabilities에 팀 지정
- [ ] 내 아이폰에서 Run 성공
- [ ] (출시 시) `IS_TESTING=false`, 아이콘 생성, App Store Connect 등록·제출
