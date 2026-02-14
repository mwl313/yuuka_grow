export const APP_VERSION = "v1.3";
export const AUTHOR_NAME = "Codex CLI";
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

export const GIANT_MODE_STAGE = 11;
export const COMPARISON_STAGE_CHAIR = 11;
export const COMPARISON_STAGE_DESK = 12;
export const COMPARISON_STAGE_PERSON = 13;
export const COMPARISON_STAGE_CAR = 14;
export const COMPARISON_STAGE_BUILDING = 15;

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
export const DEFAULT_THEME_ID = "default";
export const DEFAULT_BGM_VOLUME = 0.6;
export const DEFAULT_SFX_VOLUME = 0.6;
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
export const PLACEHOLDER_COMPARE_COLOR = 0xf8de8c;
export const PLACEHOLDER_TEXT_COLOR = "#10203a";

export const ASSET_KEY_YUUKA = "yuuka";
export const ASSET_KEY_CHAIR = "chair";
export const ASSET_KEY_DESK = "desk";
export const ASSET_KEY_PERSON = "person";
export const ASSET_KEY_CAR = "car";
export const ASSET_KEY_BUILDING = "building";

export const ASSET_PATH_YUUKA = "/assets/yuuka.png";
export const ASSET_KEY_YUUKA_BODY = "yuuka_body";
export const ASSET_KEY_YUUKA_THIGH = "yuuka_thigh";
export const ASSET_PATH_YUUKA_BODY = "/assets/yuuka/yuuka_body.png";
export const ASSET_PATH_YUUKA_THIGH = "/assets/yuuka/yuuka_thigh.png";
export const ASSET_PATH_CHAIR = "/assets/chair.png";
export const ASSET_PATH_DESK = "/assets/desk.png";
export const ASSET_PATH_PERSON = "/assets/person.png";
export const ASSET_PATH_CAR = "/assets/car.png";
export const ASSET_PATH_BUILDING = "/assets/building.png";

export const YUUKA_BASE_SCALE = 0.5;
export const YUUKA_LOWER_MAX_MULT_L10 = 1.68;
export const YUUKA_UPPER_JOINT_FROM_TOP_PX = 510;
export const YUUKA_FOOT_GAP_PX = 10;
export const YUUKA_TRANSITION_DURATION_MS = 650;
export const YUUKA_FADEOUT_MS = 250;
export const YUUKA_GIANT_GROWTH_PER_STAGE = 1.12;
export const YUUKA_SEAM_OVERLAP_PX = 0;

export const THEME_SLICE_FALLBACK = 12;
