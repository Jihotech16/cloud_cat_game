export const GAME_SCALE = 2;
export const CLOUD_SCALE = 1;
/** 게임플레이 템포 (1 = 기본, 낮을수록 느림) */
export const GAME_SPEED = 0.72;

export const GRAVITY = 0.42 * GAME_SCALE * GAME_SPEED;
export const JUMP_FORCE = 9 * GAME_SCALE * GAME_SPEED;
export const CHARGE_RATE = 0.028 * GAME_SPEED;
export const CHARGE_JUMP_BONUS = 0.75;
export const CLOUD_GAP_MIN = 50 * GAME_SCALE;
export const CLOUD_GAP_MAX = 85 * GAME_SCALE;
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
export const ORB_RADIUS = 13 * GAME_SCALE;
export const ORB_SPAWN_CHANCE = 0.45; // 구름 1개 스폰당 오브 동반 확률
export const ORB_GAUGE_FILL = 20; // 오브 1개당 게이지 충전량(%)
export const GAUGE_MAX = 100;
export const ORB_PICKUP_PADDING = 18 * GAME_SCALE; // 수집 판정 여유
export const ORB_MAGNET_SPEED = 6.5 * GAME_SCALE;

// 영구 누적 업그레이드(보상으로 레벨업)
export const JUMP_LEVEL_STEP = 0.2; // 점프 보상 1회당 점프력 배율 +0.2
export const MAGNET_RANGE_STEP = 80 * GAME_SCALE; // 자석 보상 1회당 끌어당김 범위 증가
export const SCORE_LEVEL_STEP = 0.25; // 점수 배율 보상 1회당 점수 획득량 +25%

export const REWARD_DURATION = 8 * 60; // 점수 2배 지속(프레임, 약 8초)
export const REWARD_SCORE_MULT = 2;
