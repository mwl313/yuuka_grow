export const APP_VERSION = "v1.3";
export const AUTHOR_NAME = "PangyoStonefist";
export const IP_LABEL = "Blue Archive";

export const DAYS_TO_SURVIVE = 100;
export const ACTIONS_PER_DAY = 3;

export const START_MONEY = 5000;
export const START_STRESS = 0;
export const START_THIGH_CM = 53;
export const MIN_THIGH_CM = 1;

export const STRESS_MIN = 0;
export const STRESS_MAX = 100;

export const LOG_MAX_LINES = -1;
export const HISTORY_MAX_RUNS = 20;

export const WORK_BASE_MONEY = 1100;
export const WORK_DAY_SLOPE = 25;
export const WORK_STRESS_GAIN = 8;

export const EAT_BASE_COST = 500;
export const EAT_COST_PER_CM = 1.5;
export const EAT_STRESS_REDUCE = 12;
export const EAT_BASE_GAIN_CM = 4;
export const EAT_GAIN_FACTOR = 0.006;

export const STRESS_END_CONSECUTIVE_DAYS = 10;
export const NO_MEAL_MULTIPLIER = 0.95;
export const NOA_WORK_CHARGES = 3;

export const STAGE_THRESHOLDS = [
  53, 70, 92, 122, 161, 212, 280, 370, 488, 644, 850, 1122, 1481, 1954, 2579,
];
export const STAGE_GROWTH_FACTOR_AFTER_MAX = 1.32;

export const STRESS_BAND_STABLE_MAX = 29;
export const STRESS_BAND_NEUTRAL_MAX = 59;
export const STRESS_BAND_RISKY_MAX = 79;

export const GUEST_TEACHER_THIGH_PCT = 0.08;
export const GUEST_TEACHER_STRESS_DELTA = -15;

export const GUEST_MOMOI_THIGH_PCT = 0.1;
export const GUEST_MOMOI_STRESS_DELTA = 10;

export const GUEST_ARIS_THIGH_PCT = 0.12;
export const GUEST_ARIS_MONEY_PCT = 0.15;

export const GUEST_RIO_MONEY_PCT = 0.12;
export const GUEST_RIO_STRESS_DELTA = 12;

export const GUEST_NOA_MONEY_PCT = 0.05;
export const GUEST_NOA_STRESS_DELTA = -5;

export const GUEST_MAKI_SUCCESS_THIGH_PCT = 0.14;
export const GUEST_MAKI_SUCCESS_MONEY_PCT = 0.15;
export const GUEST_MAKI_SUCCESS_STRESS_DELTA = 10;
export const GUEST_MAKI_SLIP_THIGH_PCT = -0.08;
export const GUEST_MAKI_SLIP_MONEY_PCT = 0.1;
export const GUEST_MAKI_SLIP_STRESS_DELTA = -5;

export const GUEST_KOYUKI_COMMON_STRESS_DELTA = 20;
export const GUEST_KOYUKI_JACKPOT_MONEY_PCT = 0.8;
export const GUEST_KOYUKI_LOSS_MONEY_PCT = -0.5;
export const GUEST_KOYUKI_LOSS_THIGH_PCT = 0.06;

export const OUTCOME_DEFAULT = "default";
export const OUTCOME_SUCCESS = "success";
export const OUTCOME_SLIP = "slip";
export const OUTCOME_JACKPOT = "jackpot";
export const OUTCOME_LOSS = "loss";

export const STRESS_BAND_STABLE = "stable";
export const STRESS_BAND_NEUTRAL = "neutral";
export const STRESS_BAND_RISKY = "risky";
export const STRESS_BAND_GAMBLING = "gambling";

export const GUEST_WEIGHT_STABLE = {
  teacher: 5,
  aris: 5,
  noa: 4,
  momoi: 3,
  rio: 2,
  maki: 2,
  koyuki: 1,
} as const;

export const GUEST_WEIGHT_NEUTRAL = {
  teacher: 3,
  aris: 4,
  noa: 3,
  momoi: 4,
  rio: 3,
  maki: 3,
  koyuki: 2,
} as const;

export const GUEST_WEIGHT_RISKY = {
  teacher: 2,
  aris: 3,
  noa: 2,
  momoi: 4,
  rio: 4,
  maki: 4,
  koyuki: 3,
} as const;

export const GUEST_WEIGHT_GAMBLING = {
  teacher: 1,
  aris: 2,
  noa: 1,
  momoi: 4,
  rio: 4,
  maki: 5,
  koyuki: 5,
} as const;

export const GUEST_IDS = [
  "teacher",
  "momoi",
  "aris",
  "rio",
  "noa",
  "maki",
  "koyuki",
] as const;

export const SAVE_KEY = "yuuka_save_v1";
export const SETTINGS_KEY = "yuuka_settings_v1";
export const ENDING_COLLECTION_KEY = "yuuka_endings_collection_v1";
export const DEFAULT_THEME_ID = "default";
export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_BGM_VOLUME = 0.5;
export const DEFAULT_SFX_VOLUME = 0.5;
export const DEFAULT_VOICE_VOLUME = 0.5;
export const DEFAULT_MASTER_MUTED = false;
export const DEFAULT_NICKNAME = "Sensei";
export const VOLUME_MIN = 0;
export const VOLUME_MAX = 1;
export const VOLUME_STEP = 0.1;

export const SHARE_PAGE_PATH = "share.html";
export const SHARE_PARAM_THIGH = "thigh";
export const SHARE_PARAM_DAY = "day";
export const SHARE_PARAM_ENDING = "ending";
export const SHARE_PARAM_MONEY = "money";
export const SHARE_PARAM_STRESS = "stress";

export const RENDER_WIDTH = 900;
export const RENDER_HEIGHT = 560;
export const RENDER_BG_COLOR = "#0b1628";
export const PLACEHOLDER_YUUKA_COLOR = 0xa8c6ff;
export const PLACEHOLDER_TEXT_COLOR = "#10203a";

export const ASSET_KEY_YUUKA = "yuuka";
export const ASSET_KEY_BG_MAIN_OFFICE = "bg_main_office";

export const ASSET_PATH_YUUKA = "/assets/yuuka.png";
export const ASSET_PATH_BG_MAIN_OFFICE = "/assets/background/BG_MainOffice.png";
export const ASSET_KEY_YUUKA_BODY = "yuuka_body";
export const ASSET_KEY_YUUKA_THIGH = "yuuka_thigh";
export const ASSET_PATH_YUUKA_BODY = "/assets/yuuka/yuuka_body.png";
export const ASSET_PATH_YUUKA_THIGH = "/assets/yuuka/yuuka_thigh.png";
export const ASSET_KEY_GROW_1 = "grow_1";
export const ASSET_KEY_GROW_2 = "grow_2";
export const ASSET_KEY_GROW_3 = "grow_3";
export const ASSET_KEY_GROW_4 = "grow_4";
export const ASSET_PATH_GROW_1 = "/assets/grow/grow1.mp3";
export const ASSET_PATH_GROW_2 = "/assets/grow/grow2.mp3";
export const ASSET_PATH_GROW_3 = "/assets/grow/grow3.mp3";
export const ASSET_PATH_GROW_4 = "/assets/grow/grow4.mp3";
export const ASSET_KEYS_GROW = [
  ASSET_KEY_GROW_1,
  ASSET_KEY_GROW_2,
  ASSET_KEY_GROW_3,
  ASSET_KEY_GROW_4,
] as const;
export const ASSET_KEY_GIANT_ENTER_1 = "giant_enter_1";
export const ASSET_KEY_GIANT_ENTER_2 = "giant_enter_2";
export const ASSET_PATH_GIANT_ENTER_1 = "/assets/grow/giantmode/giantenter1.mp3";
export const ASSET_PATH_GIANT_ENTER_2 = "/assets/grow/giantmode/giantenter2.mp3";
export const ASSET_KEY_GIANT_BG_1 = "giant_bg_1";
export const ASSET_KEY_GIANT_BG_2 = "giant_bg_2";
export const ASSET_KEY_GIANT_BG_3 = "giant_bg_3";
export const ASSET_KEY_GIANT_BG_4 = "giant_bg_4";
export const ASSET_KEY_GIANT_BG_5 = "giant_bg_5";
export const ASSET_PATH_GIANT_BG_1 = "/assets/background/giantbg1.png";
export const ASSET_PATH_GIANT_BG_2 = "/assets/background/giantbg2.png";
export const ASSET_PATH_GIANT_BG_3 = "/assets/background/giantbg3.png";
export const ASSET_PATH_GIANT_BG_4 = "/assets/background/giantbg4.png";
export const ASSET_PATH_GIANT_BG_5 = "/assets/background/giantbg5.png";
export const ASSET_KEYS_GIANT_BG = [
  ASSET_KEY_GIANT_BG_1,
  ASSET_KEY_GIANT_BG_2,
  ASSET_KEY_GIANT_BG_3,
  ASSET_KEY_GIANT_BG_4,
  ASSET_KEY_GIANT_BG_5,
] as const;
export const ASSET_KEY_GUEST_MANIFEST = "guest_manifest";
export const ASSET_PATH_GUEST_MANIFEST = "/assets/guests/manifest.json";
export const ASSET_KEY_FOOD_MANIFEST = "food_manifest";
export const ASSET_PATH_FOOD_MANIFEST = "/assets/food/manifest.json";
export const ASSET_KEY_WORK_MANIFEST = "work_manifest";
export const ASSET_PATH_WORK_MANIFEST = "/assets/work/manifest.json";
export const ASSET_PATH_BGM_MANIFEST = "/assets/bgm/manifest.json";

export const BGM_CATEGORIES = [
  "lobby",
  "leaderboard",
  "gameearly",
  "gamemid",
  "gamelate",
  "gameend",
  "gamefinal",
  "result",
] as const;
export const BGM_DEFAULT_CROSSFADE_MS = 800;
export const BGM_HARD_SWITCH_CROSSFADE_MS = 400;
export const BGM_CONTEXT_GAP_MS = 100;
export const BGM_OUTPUT_ATTENUATION = 0.85;
export const BGM_MAX_LOAD_RETRIES = 3;
export const BGM_GAME_EARLY_MAX_STAGE = 10;
export const BGM_GAME_MID_MAX_STAGE = 17;
export const BGM_GAME_LATE_MAX_STAGE = 24;
export const BGM_GAME_END_MAX_STAGE = 31;
export const ASSET_PATH_BGM_DEATH = "/assets/bgm/death.mp3";

export const YUUKA_BASE_SCALE = 0.5;
export const YUUKA_LOWER_MAX_MULT_L10 = 1.68;
export const YUUKA_UPPER_JOINT_FROM_TOP_PX = 510;
export const YUUKA_FOOT_GAP_PX = 10;
export const YUUKA_TRANSITION_DURATION_MS = 650;
export const YUUKA_FADEOUT_MS = 250;
export const YUUKA_GIANT_GROWTH_PER_STAGE = 1.12;
export const YUUKA_GIANT_LOG_A = 0.25;
export const YUUKA_SEAM_OVERLAP_PX = 0;
export const YUUKA_LEVEL_GROWTH_ANIM_MS = 500;
export const YUUKA_TRANSITION_SHAKE_MAX_PX = 14;

export const THEME_SLICE_FALLBACK = 12;

export const GUEST_CINEMATIC_ENTER_MS = 550;
export const GUEST_CINEMATIC_ACTION_MS = 400;
export const GUEST_CINEMATIC_EXIT_MS = 550;
export const GUEST_CINEMATIC_SKIP_FADE_MS = 150;
export const GUEST_VOICE_START_DELAY_MS = 0;
export const GUEST_VOICE_FADEOUT_MS = 300;
export const GUEST_TARGET_HEIGHT_RATIO = 0.35;
export const GUEST_BASE_TEXTURE_SIZE = 500;
export const GUEST_ENTER_OFFSCREEN_MULT = 0.6;
export const GUEST_ENTER_OFFSCREEN_MARGIN_PX = 20;
export const GUEST_TARGET_X_RATIO = 0.6;
export const GUEST_BOB_AMPLITUDE_PX = 6;
export const GUEST_ACTION_SHAKE_X_PX = 6;
export const GUEST_ACTION_SHAKE_ROT_RAD = 0.05;

export const ACTION_VFX_TARGET_HEIGHT_RATIO = 0.3;
export const ACTION_VFX_NATIVE_HEIGHT_PX = 240;
export const ACTION_VFX_MOVE_MS = 200;
export const ACTION_VFX_FADE_MS = 100;
export const ACTION_VFX_OFFSCREEN_MULT = 0.6;
export const ACTION_VFX_OFFSCREEN_MARGIN_PX = 20;
export const ACTION_VFX_SPAWN_Y_RATIO = 0.5;
export const ACTION_VFX_TARGET_X_RATIO = 0.5;
export const ACTION_VFX_TARGET_Y_RATIO = 0.5;
export const ACTION_VFX_PLACEHOLDER_COLOR = 0xffdca8;

export const GIANT_TRIGGER_STAGE_START = 11;
export const GIANT_TRIGGER_STAGE_INTERVAL = 7;
export const GIANT_TRIGGER_GROW_PLAYBACK_RATE = 0.65;
export const GIANT_TRIGGER_ECHO_1_DELAY_MS = 120;
export const GIANT_TRIGGER_ECHO_2_DELAY_MS = 240;
export const GIANT_TRIGGER_ECHO_1_VOLUME = 0.45;
export const GIANT_TRIGGER_ECHO_2_VOLUME = 0.25;
export const GIANT_TRIGGER_ECHO_1_RATE = 0.63;
export const GIANT_TRIGGER_ECHO_2_RATE = 0.62;
export const GIANT_BG_FLASH_PEAK_1_MS = 25;
export const GIANT_BG_FLASH_DROP_1_MS = 80;
export const GIANT_BG_FLASH_PEAK_2_MS = 25;
export const GIANT_BG_FLASH_DROP_2_MS = 140;
export const GIANT_BG_FLASH_PEAK_3_MS = 25;
export const GIANT_BG_FLASH_DROP_3_MS = 160;
export const GIANT_BG_CROSS_FADE_OUT_MS = 70;
export const GIANT_BG_CROSS_FADE_IN_MS = 180;
