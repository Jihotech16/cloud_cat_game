export const GAME_SCALE = 2;
export const CLOUD_SCALE = 1;
/** 게임플레이 템포 (1 = 기본, 낮을수록 느림) */
export const GAME_SPEED = 0.72;

export const GRAVITY = 0.42 * GAME_SCALE * GAME_SPEED;
export const JUMP_FORCE = 7.5 * GAME_SCALE * GAME_SPEED;
export const BOUNCE_FORCE = JUMP_FORCE * 1.95; // 트램펄린 구름 튕김 세기
export const CHARGE_RATE = 0.028 * GAME_SPEED;
export const CHARGE_JUMP_BONUS = 0.75;
export const CLOUD_GAP_MIN = 40 * GAME_SCALE;
export const CLOUD_GAP_MAX = 66 * GAME_SCALE;
export const SPAWN_LOOKAHEAD = 1.2;

export const START_CLOUD_WIDTH = Math.round(109 * CLOUD_SCALE);
export const START_Y_OFFSET = 80 * GAME_SCALE;
export const SCORE_DIVISOR = 10 * GAME_SCALE;

export const CLOUD_SPAWN_MARGIN_X = 50 * GAME_SCALE;
export const CLOUD_SPAWN_PADDING = 100 * GAME_SCALE;
export const CLOUD_COLLISION_INSET = 8;
export const LANDING_TOLERANCE = 4;
export const CULL_BELOW_PADDING = 250 * GAME_SCALE;
export const GAME_OVER_MARGIN = 60 * GAME_SCALE;

export const PLAYER_SIZE = 42 * GAME_SCALE;
export const PLAYER_FEET_INSET = 4 * GAME_SCALE;
export const PLAYER_BASE_SPEED = 4.2 * GAME_SCALE * GAME_SPEED;

export const CLOUD_DISPLAY_WIDTH = Math.round(109 * CLOUD_SCALE);
export const CLOUD_MOVE_SPEED = 1.2 * GAME_SCALE * GAME_SPEED;

// 오브 & 게이지 & 보상
export const ORB_RADIUS = 5 * GAME_SCALE; // 작게
export const ORB_SPAWN_GAP = 54 * GAME_SCALE; // 오브 세로 간격(맵에 골고루 분포)
export const ORB_GAUGE_FILL = 9; // 오브 1개당 게이지 충전량
export const GAUGE_MAX = 100; // 첫 레벨에 필요한 게이지(기준값)
export const GAUGE_LEVEL_STEP = 0.35; // 보상 레벨이 오를 때마다 필요 게이지 +35%
export const ORB_PICKUP_PADDING = 16 * GAME_SCALE; // 수집 판정 여유
export const ORB_MAGNET_SPEED = 6.5 * GAME_SCALE;

export const ORB_RAINBOW_CHANCE = 0.06; // 오브가 레인보우일 확률(특별하게 유지)

// 영구 누적 업그레이드(보상으로 레벨업)
export const JUMP_LEVEL_STEP = 0.2; // 점프 보상 1회당 점프력 배율 +0.2
export const MAGNET_RANGE_STEP = 80 * GAME_SCALE; // 자석 보상 1회당 끌어당김 범위 증가
export const SCORE_LEVEL_STEP = 0.25; // 점수 배율 보상 1회당 점수 획득량 +25%
export const ORB_VALUE_STEP = 0.4; // 오브 가치 보상 1회당 충전량 +40%
export const DOUBLE_JUMP_FORCE_MULT = 0.9; // 공중 점프 위력(지상 대비)

export const CHARGE_RATE_STEP = 0.35; // 차지 가속 보상 1회당 충전 속도 +35%

export const REWARD_DURATION = 8 * 60; // 점수 2배 지속(프레임, 약 8초)
export const REWARD_SCORE_MULT = 2;

// 로켓 부스트(위로 쭉 상승)
export const ROCKET_DURATION = 66; // 약 1.1초
export const ROCKET_SPEED = 13 * GAME_SCALE; // 프레임당 상승량

// 코인 획득 보상
export const COIN_REWARD_AMOUNT = 30;

// 보상 리롤 / 스킵
export const REROLL_BASE_COST = 12; // 리롤 비용(리롤할수록 증가)
export const SKIP_COIN_REWARD = 8; // 스킵 시 받는 코인

// 세트 시너지
export const SYN_JUMP_FORCE_MULT = 1.15; // 점프 2세트: 점프력 +15%
export const SYN_SHOCKWAVE_RADIUS = 130 * GAME_SCALE; // 점프 4세트: 착지 충격파 반경
export const SYN_ORB_FILL_MULT = 1.25; // 오브 2세트: 게이지 +25%
export const SYN_ORB_DOUBLE_CHANCE = 0.3; // 오브 4세트: 2배 확률
export const SYN_SCORE_MULT = 1.2; // 점수 2세트: 점수 +20%
export const SYN_SCORE_AUTOGROW_FRAMES = 720; // 점수 4세트: N프레임마다 점수배율 +1
export const SYN_FALL_BONUS = 0.28; // 생존 2세트: 추락 여유(×화면높이)
export const SYN_SHIELD_REGEN_FRAMES = 900; // 생존 4세트: N프레임마다 보호막 재생

// 일시 효과(프레임)
export const SLOWMO_DURATION = 6 * 60;
export const SLOWMO_FACTOR = 0.5;
export const BIGCLOUD_DURATION = 8 * 60;
export const BIGCLOUD_SCALE = 1.5;
export const FEATHER_DURATION = 6 * 60;
export const FEATHER_MAX_FALL = 4 * GAME_SCALE; // 깃털 시 최대 낙하 속도

// 코인 (메타 성장)
export const COIN_PER_ORB = 1;
export const COIN_PER_RAINBOW = 5;
