import type {
  BuffCardEffect,
  BuffCardSelection,
  BuffKey,
  BuffMultipliers,
  BuffRarityLabel,
} from "./types";

const RARITY_BY_SCORE: Array<{ min: number; max: number; label: BuffRarityLabel }> = [
  { min: 2, max: 3, label: "Common" },
  { min: 4, max: 5, label: "Uncommon" },
  { min: 6, max: 7, label: "Rare" },
  { min: 8, max: 9, label: "Epic" },
  { min: 10, max: 10, label: "Legendary" },
];

interface BuffRangeConfig {
  beneficialMin: number;
  beneficialMax: number;
  harmfulMin: number;
  harmfulMax: number;
  beneficialSign: 1 | -1;
  harmfulSign: 1 | -1;
}

const BUFF_KEYS: readonly BuffKey[] = [
  "stressGainMult",
  "creditGainMult",
  "thighGainMult",
  "koyukiWinProbMult",
  "makiWinProbMult",
  "guestCostMult",
  "eatCostMult",
  "noEatPenaltyMult",
];

const BUFF_RANGE_CONFIG: Record<BuffKey, BuffRangeConfig> = {
  creditGainMult: {
    beneficialMin: 0.05,
    beneficialMax: 0.2,
    harmfulMin: 0.05,
    harmfulMax: 0.15,
    beneficialSign: 1,
    harmfulSign: -1,
  },
  thighGainMult: {
    beneficialMin: 0.03,
    beneficialMax: 0.15,
    harmfulMin: 0.03,
    harmfulMax: 0.12,
    beneficialSign: 1,
    harmfulSign: -1,
  },
  stressGainMult: {
    beneficialMin: 0.1,
    beneficialMax: 0.35,
    harmfulMin: 0.1,
    harmfulMax: 0.4,
    beneficialSign: -1,
    harmfulSign: 1,
  },
  koyukiWinProbMult: {
    beneficialMin: 0.15,
    beneficialMax: 0.8,
    harmfulMin: 0.1,
    harmfulMax: 0.5,
    beneficialSign: 1,
    harmfulSign: -1,
  },
  makiWinProbMult: {
    beneficialMin: 0.15,
    beneficialMax: 0.8,
    harmfulMin: 0.1,
    harmfulMax: 0.5,
    beneficialSign: 1,
    harmfulSign: -1,
  },
  guestCostMult: {
    beneficialMin: 0.1,
    beneficialMax: 0.35,
    harmfulMin: 0.1,
    harmfulMax: 0.4,
    beneficialSign: -1,
    harmfulSign: 1,
  },
  eatCostMult: {
    beneficialMin: 0.05,
    beneficialMax: 0.2,
    harmfulMin: 0.05,
    harmfulMax: 0.25,
    beneficialSign: -1,
    harmfulSign: 1,
  },
  noEatPenaltyMult: {
    beneficialMin: 0.1,
    beneficialMax: 0.5,
    harmfulMin: 0.1,
    harmfulMax: 0.6,
    beneficialSign: -1,
    harmfulSign: 1,
  },
};

const EFFECT_LABELS_KO: Record<BuffKey, string> = {
  creditGainMult: "크레딧 획득",
  thighGainMult: "허벅지 증가",
  stressGainMult: "스트레스 증가",
  koyukiWinProbMult: "코유키 성공 확률",
  makiWinProbMult: "마키 성공 확률",
  guestCostMult: "게스트 비용",
  eatCostMult: "밥 비용",
  noEatPenaltyMult: "무식사 패널티",
};

export const BUFF_CARD_STAGE_MILESTONES = [5, 10, 15, 19, 23, 27, 31, 35, 39] as const;

export function createInitialBuffMultipliers(): BuffMultipliers {
  return {
    stressGainMult: 1,
    creditGainMult: 1,
    thighGainMult: 1,
    koyukiWinProbMult: 1,
    makiWinProbMult: 1,
    guestCostMult: 1,
    eatCostMult: 1,
    noEatPenaltyMult: 1,
  };
}

function randomRange(min: number, max: number, rng01: () => number): number {
  return min + (max - min) * rng01();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toScoreFromMagnitude(value: number, min: number, max: number, preferHigh: boolean): number {
  if (max <= min) return 3;
  const ratio = clamp01((value - min) / (max - min));
  const normalized = preferHigh ? ratio : 1 - ratio;
  return Math.max(1, Math.min(5, 1 + Math.round(normalized * 4)));
}

function rarityFromScore(score: number): BuffRarityLabel {
  for (const entry of RARITY_BY_SCORE) {
    if (score >= entry.min && score <= entry.max) return entry.label;
  }
  return "Common";
}

function randomBuffKey(rng01: () => number): BuffKey {
  const index = Math.floor(rng01() * BUFF_KEYS.length);
  return BUFF_KEYS[Math.min(index, BUFF_KEYS.length - 1)];
}

function createEffect(key: BuffKey, beneficial: boolean, rng01: () => number): BuffCardEffect {
  const config = BUFF_RANGE_CONFIG[key];
  const magnitude = beneficial
    ? randomRange(config.beneficialMin, config.beneficialMax, rng01)
    : randomRange(config.harmfulMin, config.harmfulMax, rng01);
  const sign = beneficial ? config.beneficialSign : config.harmfulSign;
  return {
    key,
    delta: sign * magnitude,
  };
}

function buildCardId(rng01: () => number): string {
  const token = Math.floor(rng01() * 1_000_000)
    .toString(16)
    .padStart(5, "0");
  return `buff-${Date.now()}-${token}`;
}

export function generateBuffCards(
  milestone: number,
  day: number,
  stage: number,
  rng01: () => number,
): BuffCardSelection[] {
  const cards: BuffCardSelection[] = [];

  for (let index = 0; index < 3; index += 1) {
    const buffKey = randomBuffKey(rng01);
    let debuffKey = randomBuffKey(rng01);
    while (debuffKey === buffKey) {
      debuffKey = randomBuffKey(rng01);
    }

    const buff = createEffect(buffKey, true, rng01);
    const debuff = createEffect(debuffKey, false, rng01);
    const buffConfig = BUFF_RANGE_CONFIG[buff.key];
    const debuffConfig = BUFF_RANGE_CONFIG[debuff.key];
    const buffScore = toScoreFromMagnitude(
      Math.abs(buff.delta),
      buffConfig.beneficialMin,
      buffConfig.beneficialMax,
      true,
    );
    const debuffScore = toScoreFromMagnitude(
      Math.abs(debuff.delta),
      debuffConfig.harmfulMin,
      debuffConfig.harmfulMax,
      false,
    );
    const rarityScore = buffScore + debuffScore;

    cards.push({
      id: buildCardId(rng01),
      rarityScore,
      rarityLabel: rarityFromScore(rarityScore),
      buff,
      debuff,
      milestone,
      selectedAtDay: day,
      selectedAtStage: stage,
    });
  }

  return cards;
}

export function applyCardToMultipliers(
  base: BuffMultipliers,
  card: Pick<BuffCardSelection, "buff" | "debuff">,
): BuffMultipliers {
  const next = { ...base };
  for (const effect of [card.buff, card.debuff]) {
    const multiplier = 1 + effect.delta;
    const updated = next[effect.key] * multiplier;
    next[effect.key] = Math.max(0.05, updated);
  }
  return next;
}

export function getNoEatEffectiveFactor(noEatPenaltyMult: number, baseFactor: number): number {
  const severity = Math.max(0, noEatPenaltyMult);
  return Math.max(0, Math.min(1, 1 - (1 - baseFactor) * severity));
}

export function getAdjustedWinProbability(baseProbability: number, probabilityMult: number): number {
  return clamp01(baseProbability * Math.max(0, probabilityMult));
}

export function formatBuffEffectLine(effect: BuffCardEffect): string {
  const label = EFFECT_LABELS_KO[effect.key] ?? effect.key;
  const percent = `${Math.round(Math.abs(effect.delta) * 100)}%`;
  const prefix = effect.delta >= 0 ? "+" : "-";
  return `${prefix}${label} ${percent}`;
}

