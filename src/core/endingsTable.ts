import { getStage } from "./stage";
import type { EndBaseCategory, EndingCategory, GameState } from "./types";

export type EndingTrigger = "instant" | "on_end";

export interface EndingContext {
  endedAt: Date;
  endedAtHHMM: string;
  stage: number;
}

export interface EndingDef {
  id: string;
  category: EndingCategory;
  trigger: EndingTrigger;
  titleKey: string;
  descKey: string;
  priorityFirst: number;
  priorityRepeat: number;
  condition: (state: GameState, ctx: EndingContext) => boolean;
}

export interface SelectedEnding {
  id: string;
  category: EndingCategory;
  titleKey: string;
  descKey: string;
  effectivePriority: number;
}

export const EAT_SLOT_MORNING_MASK = 1;
export const EAT_SLOT_NOON_MASK = 2;
export const EAT_SLOT_EVENING_MASK = 4;
const ONE_TIME_ENDING_IDS = new Set<string>(["special.marriage", "any.noa_marriage"]);

function makeEndingContext(endedAt: Date, stage: number): EndingContext {
  const hh = String(endedAt.getHours()).padStart(2, "0");
  const mm = String(endedAt.getMinutes()).padStart(2, "0");
  return {
    endedAt,
    endedAtHHMM: `${hh}:${mm}`,
    stage,
  };
}

function isAllDigits(value: number, digit: string): boolean {
  const text = String(Math.max(0, Math.round(value)));
  return text.length > 0 && [...text].every((char) => char === digit);
}

function isBalancedActions(state: GameState): boolean {
  const total = state.actionCounts.totalActions;
  if (total <= 0) return false;
  const ideal = total / 3;
  const tolerance = Math.max(3, Math.ceil(total * 0.08));
  return (
    Math.abs(state.actionCounts.work - ideal) <= tolerance &&
    Math.abs(state.actionCounts.eat - ideal) <= tolerance &&
    Math.abs(state.actionCounts.guest - ideal) <= tolerance
  );
}

function isEatOnlyInSlot(state: GameState, slotMask: number): boolean {
  return state.actionCounts.eat >= 1 && state.eatSlotsMask === slotMask;
}

function isFoodieSequence(state: GameState): boolean {
  return (
    state.day1Actions.length >= 3 &&
    state.day1Actions[0] === "eat" &&
    state.day1Actions[1] === "eat" &&
    state.day1Actions[2] === "eat"
  );
}

function includesMeme1557(value: number): boolean {
  return String(Math.max(0, Math.round(value))).includes("1557");
}

export const ENDING_DEFS: EndingDef[] = [
  {
    id: "special.shadow_time",
    category: "special",
    trigger: "on_end",
    titleKey: "ending.special.shadow_time.title",
    descKey: "ending.special.shadow_time.desc",
    priorityFirst: 120,
    priorityRepeat: 120,
    condition: (_state, ctx) => ctx.endedAtHHMM === "00:00",
  },
  {
    id: "special.marriage",
    category: "special",
    trigger: "instant",
    titleKey: "ending.special.marriage.title",
    descKey: "ending.special.marriage.desc",
    priorityFirst: 110,
    priorityRepeat: 110,
    condition: (state) => state.guestCounts.sensei >= 30,
  },
  {
    id: "any.lucky_seven",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.any.lucky_seven.title",
    descKey: "ending.any.lucky_seven.desc",
    priorityFirst: 95,
    priorityRepeat: 5,
    condition: (state) => isAllDigits(state.thighCm, "7"),
  },
  {
    id: "any.all_nines",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.any.all_nines.title",
    descKey: "ending.any.all_nines.desc",
    priorityFirst: 95,
    priorityRepeat: 5,
    condition: (state) => isAllDigits(state.thighCm, "9"),
  },
  {
    id: "any.seq_12345_thigh",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.any.seq_12345_thigh.title",
    descKey: "ending.any.seq_12345_thigh.desc",
    priorityFirst: 90,
    priorityRepeat: 5,
    condition: (state) => String(Math.round(state.thighCm)) === "12345",
  },
  {
    id: "any.seq_123456_credit",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.any.seq_123456_credit.title",
    descKey: "ending.any.seq_123456_credit.desc",
    priorityFirst: 90,
    priorityRepeat: 5,
    condition: (state) => String(Math.round(state.money)) === "123456",
  },
  {
    id: "any.morning_only_eat",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.any.morning_only_eat.title",
    descKey: "ending.any.morning_only_eat.desc",
    priorityFirst: 80,
    priorityRepeat: 10,
    condition: (state) => isEatOnlyInSlot(state, EAT_SLOT_MORNING_MASK),
  },
  {
    id: "any.noon_only_eat",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.any.noon_only_eat.title",
    descKey: "ending.any.noon_only_eat.desc",
    priorityFirst: 80,
    priorityRepeat: 10,
    condition: (state) => isEatOnlyInSlot(state, EAT_SLOT_NOON_MASK),
  },
  {
    id: "any.evening_only_eat",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.any.evening_only_eat.title",
    descKey: "ending.any.evening_only_eat.desc",
    priorityFirst: 80,
    priorityRepeat: 10,
    condition: (state) => isEatOnlyInSlot(state, EAT_SLOT_EVENING_MASK),
  },
  {
    id: "any.noa_marriage",
    category: "special",
    trigger: "instant",
    titleKey: "ending.any.noa_marriage.title",
    descKey: "ending.any.noa_marriage.desc",
    priorityFirst: 109,
    priorityRepeat: 1,
    condition: (state) => state.guestCounts.noa >= 30,
  },
  {
    id: "any.foodie",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.any.foodie.title",
    descKey: "ending.any.foodie.desc",
    priorityFirst: 88,
    priorityRepeat: 12,
    condition: (state) => isFoodieSequence(state),
  },
  {
    id: "any.num_1557",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.any.num_1557.title",
    descKey: "ending.any.num_1557.desc",
    priorityFirst: 90,
    priorityRepeat: 10,
    condition: (state) => includesMeme1557(state.thighCm) || includesMeme1557(state.money),
  },
  {
    id: "normal.planet_scale",
    category: "normal",
    trigger: "on_end",
    titleKey: "ending.normal.planet_scale.title",
    descKey: "ending.normal.planet_scale.desc",
    priorityFirst: 75,
    priorityRepeat: 75,
    condition: (state, ctx) => state.day >= 100 && ctx.stage >= 50,
  },
  {
    id: "normal.earth_destroy",
    category: "normal",
    trigger: "on_end",
    titleKey: "ending.normal.earth_destroy.title",
    descKey: "ending.normal.earth_destroy.desc",
    priorityFirst: 65,
    priorityRepeat: 65,
    condition: (state, ctx) => state.day >= 100 && ctx.stage >= 39,
  },
  {
    id: "normal.atmosphere",
    category: "normal",
    trigger: "on_end",
    titleKey: "ending.normal.atmosphere.title",
    descKey: "ending.normal.atmosphere.desc",
    priorityFirst: 55,
    priorityRepeat: 55,
    condition: (state, ctx) => state.day >= 100 && ctx.stage >= 25,
  },
  {
    id: "normal.malang",
    category: "normal",
    trigger: "on_end",
    titleKey: "ending.normal.malang.title",
    descKey: "ending.normal.malang.desc",
    priorityFirst: 58,
    priorityRepeat: 58,
    condition: (state) => state.day >= 100 && state.guestCounts.momoi + state.guestCounts.aris >= 60,
  },
  {
    id: "normal.worklife_balance",
    category: "any",
    trigger: "on_end",
    titleKey: "ending.normal.worklife_balance.title",
    descKey: "ending.normal.worklife_balance.desc",
    priorityFirst: 50,
    priorityRepeat: 50,
    condition: (state) => isBalancedActions(state),
  },
  {
    id: "normal.social_king",
    category: "normal",
    trigger: "on_end",
    titleKey: "ending.normal.social_king.title",
    descKey: "ending.normal.social_king.desc",
    priorityFirst: 45,
    priorityRepeat: 45,
    condition: (state) => state.day >= 100 && state.actionCounts.guest >= 180,
  },
  {
    id: "normal.workaholic",
    category: "normal",
    trigger: "on_end",
    titleKey: "ending.normal.workaholic.title",
    descKey: "ending.normal.workaholic.desc",
    priorityFirst: 45,
    priorityRepeat: 45,
    condition: (state) => state.day >= 100 && state.actionCounts.work >= 100,
  },
  {
    id: "normal.overnutrition",
    category: "normal",
    trigger: "on_end",
    titleKey: "ending.normal.overnutrition.title",
    descKey: "ending.normal.overnutrition.desc",
    priorityFirst: 40,
    priorityRepeat: 40,
    condition: (state) => state.day >= 100 && state.actionCounts.eat >= 100,
  },
  {
    id: "normal.malnutrition",
    category: "normal",
    trigger: "on_end",
    titleKey: "ending.normal.malnutrition.title",
    descKey: "ending.normal.malnutrition.desc",
    priorityFirst: 40,
    priorityRepeat: 40,
    condition: (state) => state.day >= 100 && state.actionCounts.eat <= 20,
  },
  {
    id: "normal.default",
    category: "normal",
    trigger: "on_end",
    titleKey: "ending.normal.default.title",
    descKey: "ending.normal.default.desc",
    priorityFirst: 10,
    priorityRepeat: 10,
    condition: (state) => state.day >= 100,
  },
  {
    id: "bankrupt.global_crisis",
    category: "bankrupt",
    trigger: "on_end",
    titleKey: "ending.bankrupt.global_crisis.title",
    descKey: "ending.bankrupt.global_crisis.desc",
    priorityFirst: 65,
    priorityRepeat: 65,
    condition: (state, ctx) => state.money <= 0 && ctx.stage >= 30,
  },
  {
    id: "bankrupt.koyuki_reflect",
    category: "bankrupt",
    trigger: "on_end",
    titleKey: "ending.bankrupt.koyuki_reflect.title",
    descKey: "ending.bankrupt.koyuki_reflect.desc",
    priorityFirst: 60,
    priorityRepeat: 60,
    condition: (state) => state.money <= 0 && state.koyukiLossCount >= 10,
  },
  {
    id: "bankrupt.financial_crisis",
    category: "bankrupt",
    trigger: "on_end",
    titleKey: "ending.bankrupt.financial_crisis.title",
    descKey: "ending.bankrupt.financial_crisis.desc",
    priorityFirst: 55,
    priorityRepeat: 55,
    condition: (state, ctx) => state.money <= 0 && ctx.stage >= 20,
  },
  {
    id: "bankrupt.overspend",
    category: "bankrupt",
    trigger: "on_end",
    titleKey: "ending.bankrupt.overspend.title",
    descKey: "ending.bankrupt.overspend.desc",
    priorityFirst: 45,
    priorityRepeat: 45,
    condition: (state) =>
      state.money <= 0 &&
      state.actionCounts.totalActions > 0 &&
      state.actionCounts.eat / state.actionCounts.totalActions >= 0.6,
  },
  {
    id: "bankrupt.default",
    category: "bankrupt",
    trigger: "on_end",
    titleKey: "ending.bankrupt.default.title",
    descKey: "ending.bankrupt.default.desc",
    priorityFirst: 10,
    priorityRepeat: 10,
    condition: (state) => state.money <= 0,
  },
  {
    id: "stress.late_fizzle",
    category: "stress",
    trigger: "on_end",
    titleKey: "ending.stress.late_fizzle.title",
    descKey: "ending.stress.late_fizzle.desc",
    priorityFirst: 55,
    priorityRepeat: 55,
    condition: (state) => state.stress100Days >= 10 && state.day >= 90,
  },
  {
    id: "stress.early_break",
    category: "stress",
    trigger: "on_end",
    titleKey: "ending.stress.early_break.title",
    descKey: "ending.stress.early_break.desc",
    priorityFirst: 50,
    priorityRepeat: 50,
    condition: (state) => state.stress100Days >= 10 && state.day <= 20,
  },
  {
    id: "stress.default",
    category: "stress",
    trigger: "on_end",
    titleKey: "ending.stress.default.title",
    descKey: "ending.stress.default.desc",
    priorityFirst: 10,
    priorityRepeat: 10,
    condition: (state) => state.stress100Days >= 10,
  },
];

function isCandidateForBase(def: EndingDef, base: EndBaseCategory): boolean {
  if (base === "special") {
    return def.category === "special";
  }
  if (def.category === base) return true;
  if (def.category === "any") return true;
  if (def.category === "special" && def.trigger === "on_end") return true;
  return false;
}

export function selectEnding(
  state: GameState,
  baseEndCategory: EndBaseCategory,
  endedAt: Date,
  isCollected: (endingId: string) => boolean,
): SelectedEnding {
  const stage = getStage(state.thighCm);
  const ctx = makeEndingContext(endedAt, stage);

  const candidates: SelectedEnding[] = [];
  for (const def of ENDING_DEFS) {
    if (!isCandidateForBase(def, baseEndCategory)) continue;
    if (ONE_TIME_ENDING_IDS.has(def.id) && isCollected(def.id)) continue;
    if (!def.condition(state, ctx)) continue;
    const effectivePriority = isCollected(def.id) ? def.priorityRepeat : def.priorityFirst;
    candidates.push({
      id: def.id,
      category: def.category,
      titleKey: def.titleKey,
      descKey: def.descKey,
      effectivePriority,
    });
  }

  if (candidates.length > 0) {
    let winner = candidates[0];
    for (let i = 1; i < candidates.length; i += 1) {
      if (candidates[i].effectivePriority > winner.effectivePriority) {
        winner = candidates[i];
      }
    }
    return winner;
  }

  const fallbackIdByBase: Record<EndBaseCategory, string> = {
    normal: "normal.default",
    bankrupt: "bankrupt.default",
    stress: "stress.default",
    special: "special.marriage",
  };
  const fallbackId = fallbackIdByBase[baseEndCategory];
  const fallback = ENDING_DEFS.find((item) => item.id === fallbackId) ?? ENDING_DEFS[0];
  return {
    id: fallback.id,
    category: fallback.category,
    titleKey: fallback.titleKey,
    descKey: fallback.descKey,
    effectivePriority: isCollected(fallback.id) ? fallback.priorityRepeat : fallback.priorityFirst,
  };
}

export function selectInstantSpecialEndingId(
  state: GameState,
  isCollected: (endingId: string) => boolean = () => false,
): string | undefined {
  const now = new Date();
  const ctx = makeEndingContext(now, getStage(state.thighCm));
  let selected: EndingDef | undefined;
  let selectedPriority = -Infinity;

  for (const def of ENDING_DEFS) {
    if (def.category !== "special" || def.trigger !== "instant") continue;
    if (ONE_TIME_ENDING_IDS.has(def.id) && isCollected(def.id)) continue;
    if (!def.condition(state, ctx)) continue;
    const effectivePriority = isCollected(def.id) ? def.priorityRepeat : def.priorityFirst;
    if (!selected || effectivePriority > selectedPriority) {
      selected = def;
      selectedPriority = effectivePriority;
    }
  }

  return selected?.id;
}
