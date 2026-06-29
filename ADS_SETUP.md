# 광고(AdMob) 설정 가이드

배너 · 전면(인터스티셜) · 보상형 3종 광고를 `@capacitor-community/admob` 으로 붙였습니다.
현재는 **구글 공식 테스트 광고**가 나오도록 되어 있어, 기기/에뮬레이터에서 바로 확인할 수 있습니다.
실제 수익화를 하려면 아래 절차로 **실제 ID** 로 교체하세요.

## 1. 의존성 설치 & 동기화 (개발 PC에서)
```bash
npm install            # @capacitor-community/admob 포함 설치
npm run sync           # www 빌드 + cap sync
npm run open:android   # 안드로이드 스튜디오에서 실행/테스트
```
> Capacitor 8 과 peer dependency 경고가 나오면 `npm install --legacy-peer-deps` 로 설치하세요.

## 2. 광고가 나오는 위치
| 광고 | 노출 시점 | 코드 |
|---|---|---|
| **배너** | 시작 화면·게임오버 등 메뉴 화면 하단 (플레이 중엔 숨김) | `js/ads.js` `showBanner/hideBanner` |
| **전면** | 게임오버 **3판마다 1회** | `main.js` `INTERSTITIAL_EVERY` |
| **보상형** | 게임오버 화면의 **🎬 광고 보고 코인 2배** 버튼 (어드벤처 + 코인 획득 시) | `onRewardCoinsClick` |

빈도 조절: `js/main.js` 의 `INTERSTITIAL_EVERY` 값 변경.

## 3. 실제 ID 로 교체 (출시 전 필수)
[AdMob 콘솔](https://admob.google.com)에서 앱 등록 후 **앱 ID** 와 **광고 단위 ID 3개**(배너/전면/보상형)를 발급받아 교체합니다.

1. **`js/ads.js` — `REAL_IDS` (플랫폼별)**
   - iOS/Android 각각의 `banner / interstitial / rewarded` 에 실제 광고 단위 ID 입력. `null` 이면 자동으로 테스트 ID 사용.
   - `const IS_TESTING = true;` → `false` (본인 기기 테스트 중에는 true 유지 권장)
2. **Android — `android/app/src/main/AndroidManifest.xml`**
   - `com.google.android.gms.ads.APPLICATION_ID` 의 `android:value` 를 실제 **Android 앱 ID** 로 교체 (※ 안드로이드 앱은 AdMob 에서 별도 등록·발급 필요)
3. **iOS — `ios/App/App/Info.plist`** (iOS 빌드 시 — iOS 프로젝트는 로컬에서 `cap add ios` 로 생성)
   ```xml
   <key>GADApplicationIdentifier</key>
   <string>ca-app-pub-2605477058500539~3996817843</string>
   <!-- iOS 14.5+ 추적 동의 안내 문구 -->
   <key>NSUserTrackingUsageDescription</key>
   <string>맞춤 광고를 제공하기 위해 사용됩니다.</string>
   ```

### ✅ 현재 적용 상태 (Poing: Cloud Jump)
- **iOS 배너**: `ca-app-pub-2605477058500539/1069226002` 적용 완료
- **iOS 앱 ID**: `ca-app-pub-2605477058500539~3996817843` → **Info.plist 에 직접 추가 필요(위 3번)**
- **Android 배너**: `ca-app-pub-2605477058500539/7686605244` 적용 완료
- **Android 앱 ID**: `ca-app-pub-2605477058500539~5873006293` → AndroidManifest.xml 적용 완료
- iOS·Android 전면/보상형: 아직 테스트 ID (발급되면 `REAL_IDS` 에 채우면 됨)
- `IS_TESTING = true` 라 실제 단위 ID 라도 **테스트 광고**가 떠서 계정 위험 없음. 출시 시 `false`.

## 4. 동의(UMP) / iOS ATT
- EU·UK 사용자 대상이면 AdMob 콘솔에서 **GDPR 동의 메시지(UMP)** 를 설정해야 합니다.
- iOS 14.5+ 는 추적 동의(ATT) 팝업이 필요할 수 있습니다. AdMob 플러그인의
  `requestTrackingAuthorization` / `requestConsentInfo` 를 `initAds()` 에 추가하면 됩니다(필요 시 알려주세요).

## 5. 주의
- 실 ID 로 바꾼 뒤 **본인 기기에서 실제 광고를 반복 클릭하면 계정이 정지**될 수 있습니다. 테스트는 반드시 테스트 ID 로.
- 웹(브라우저)에서는 AdMob 이 없어 모든 광고 함수가 자동으로 무시됩니다(게임은 정상 동작).
