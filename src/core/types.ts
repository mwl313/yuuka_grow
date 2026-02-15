export type EndingId = "normal" | "bankrupt" | "stress";
export type GuestId =
  | "teacher"
  | "momoi"
  | "aris"
  | "rio"
  | "noa"
  | "maki"
  | "koyuki";
export type GuestOutcomeId = "default" | "success" | "slip" | "jackpot" | "loss";
export type StressBandId = "stable" | "neutral" | "risky" | "gambling";
export type LanguageCode = "ko" | "en" | "ja";

export interface GameState {
  day: number;
  actionsRemaining: number;
  money: number;
  stress: number;
  thighCm: number;
  stress100Days: number;
  ateToday: boolean;
  noaWorkCharges: number;
  logs: string[];
}

export interface RunResult {
  endedAtIso: string;
  endingId: EndingId;
  dayReached: number;
  finalThighCm: number;
  finalMoney: number;
  finalStress: number;
}

export interface LogPayload {
  key: string;
  params?: Record<string, number | string>;
}

export interface Settings {
  bgmVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  masterMuted: boolean;
  language: LanguageCode;
  nickname: string;
}

export interface SaveData {
  state: GameState;
  best: RunResult | null;
  history: RunResult[];
}

export interface WeightedItem<T> {
  item: T;
  weight: number;
}

export interface Rng {
  next01: () => number;
}

export interface StepResult {
  state: GameState;
  ended?: RunResult;
  dayEnded: boolean;
}

export interface GuestEffectResult {
  state: GameState;
  guestId: GuestId;
  effectKey: string;
  outcomeId: GuestOutcomeId;
}
