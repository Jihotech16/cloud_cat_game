# Cloud Cat Jump

구름 위를 뛰어올라 하늘 끝까지 올라가는 고양이 점프 게임입니다.

## 플레이 방법 (모바일 전용)

- 스마트폰 세로 모드에서 플레이
- 화면 **꾹 눌렀다 떼면** 점프 (오래 누를수록 높게)
- 구름에 착지하면 자동으로 튀어 오릅니다
- 떨어지면 게임 오버 — 올라간 높이(m)가 점수입니다
- 홈 화면에 추가하면 앱처럼 실행 (PWA)

## 구름 종류

| 종류 | 설명 |
|------|------|
| 흰 구름 | 일반 구름 |
| 하늘색 구름 | 좌우로 움직임 |
| 노란 구름 | 밟으면 부서짐 |

## 로컬 실행

ES Module을 사용하므로 로컬 서버가 필요합니다.

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .
```

브라우저에서 `http://localhost:8080` 접속

## GitHub Pages 배포

1. [cloud_cat_game](https://github.com/Jihotech16/cloud_cat_game) 저장소에 push
2. GitHub → **Settings** → **Pages**
3. **Source**: `Deploy from a branch`
4. **Branch**: `main` / `/ (root)`
5. 저장 후 `https://jihotech16.github.io/cloud_cat_game/` 에서 플레이

## 점수 저장

- 현재: 브라우저 `localStorage`에 최고 점수 저장
- 예정: Firebase 리더보드 연동 (`js/score.js`)

## 프로젝트 구조

```
├── index.html
├── css/style.css
└── js/
    ├── main.js      # UI & 게임 시작
    ├── game.js      # 게임 루프, 카메라, 충돌
    ├── player.js    # 고양이
    ├── cloud.js     # 구름
    └── score.js     # 점수 (Firebase 확장 예정)
```
