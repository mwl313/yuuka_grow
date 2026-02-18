export type EndingCategory = "normal" | "bankrupt" | "stress" | "special" | "any";
export type EndBaseCategory = "normal" | "bankrupt" | "stress" | "special";
export type EndingId = string;
export type GuestId =
  | "teacher"
  | "momoi"
  | "aris"
  | "rio"
  | "noa"
  | "maki"
  | "koyuki";
export type GuestOutcomeId = "default" | "success" | "slip" | "jackpot" | "loss";
export type StressBandId = 0 | 1 | 2 | 3 | 4;
export type LanguageCode = "ko" | "en" | "ja";
export type ActionSlotId = "morning" | "noon" | "evening";
export type LogKind = "work" | "eat" | "guest" | "system";
export type BuffKey =
  | "stressGainMult"
  | "creditGainMult"
  | "thighGainMult"
  | "koyukiWinProbMult"
  | "makiWinProbMult"
  | "guestCostMult"
  | "eatCostMult"
  | "noEatPenaltyMult";
export type BuffRarityLabel = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export interface BuffMultipliers {
  stressGainMult: number;
  creditGainMult: number;
  thighGainMult: number;
  koyukiWinProbMult: number;
  makiWinProbMult: number;
  guestCostMult: number;
  eatCostMult: number;
  noEatPenaltyMult: number;
}

export interface BuffCardEffect {
  key: BuffKey;
  delta: number;
}

export interface BuffCardSelection {
  id: string;
  rarityScore: number;
  rarityLabel: BuffRarityLabel;
  buff: BuffCardEffect;
  debuff: BuffCardEffect;
  milestone: number;
  selectedAtDay: number;
  selectedAtStage: number;
}

export interface ActionCounts {
  work: number;
  eat: number;
  guest: number;
  totalActions: number;
}

export interface GuestCounts {
  aris: number;
  koyuki: number;
  maki: number;
  momoi: number;
  noa: number;
  rio: number;
  sensei: number;
}

export interface GameState {
  day: number;
  actionsRemaining: number;
  money: number;
  stress: number;
  thighCm: number;
  stress100Days: number;
  ateToday: boolean;
  noaWorkCharges: number;
  actionCounts: ActionCounts;
  guestCounts: GuestCounts;
  koyukiLossCount: number;
  eatSlotsMask: number;
  milestonesHit: number[];
  buffs: BuffMultipliers;
  buffHistory: BuffCardSelection[];
  logs: string[];
}

export interface RunResult {
  endedAtIso: string;
  endingCategory: EndingCategory;
  endingId: EndingId;
  dayReached: number;
  finalThighCm: number;
  finalMoney: number;
  finalStress: number;
}

export interface LogPayload {
  key: string;
  params?: Record<string, number | string>;
  kind?: LogKind;
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
