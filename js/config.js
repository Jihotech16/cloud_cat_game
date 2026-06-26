export const GAME_SCALE = 2;
export const CLOUD_SCALE = 1;
/** 게임플레이 템포 (1 = 기본, 낮을수록 느림) */
export const GAME_SPEED = 0.72;

export const GRAVITY = 0.42 * GAME_SCALE * GAME_SPEED;
export const JUMP_FORCE = 11.5 * GAME_SCALE * GAME_SPEED;
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
