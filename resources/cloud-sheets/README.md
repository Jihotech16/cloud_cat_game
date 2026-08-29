# 구름 스프라이트 시트 (미사용 · 보관용)

가로로 이어붙인 프레임 시트다. 한때 `js/cloud.js`에서 `drawImage`의
소스 사각형으로 잘라 애니메이션으로 재생했으나, 움직임이 어색해
정적 렌더로 되돌리면서(#75) 코드에서 빠졌다.

| 파일 | 전체 크기 | 프레임당 | 프레임 수 |
|---|---|---|---|
| `cloud-sheet.png` | 654×34 | 109×34 | 6 |
| `cloud-boost-sheet.png` | 512×96 | 128×96 | 4 |
| `cloud-bounce-sheet.png` | 512×116 | 128×116 | 4 |

`resources/`는 `scripts/build-www.mjs`가 복사하지 않으므로(대상은
`css`·`js`·`assets`·`icons`) 이 파일들은 앱 번들에 포함되지 않는다.
다시 쓰려면 `assets/`로 옮기고 프레임 폭을 `naturalWidth / frameCount`로
계산해 잘라 쓰면 된다.

주의: 애니메이션을 되살릴 경우 `js/cloud.js`의 `SPRITE_H`(현재 31)는
정적 `cloud-export.png`(109×31) 기준 값이라, 높이 34인 `cloud-sheet.png`를
쓰면 발판 충돌 판정이 어긋난다. 시트를 쓸 땐 34로 맞춰야 한다.
