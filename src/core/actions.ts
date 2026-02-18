import {
  ACTIONS_PER_DAY,
  EAT_BASE_COST,
  EAT_COST_TO_THIGH_CM,
  EAT_COST_PER_CM,
  EAT_MIN_GAIN_CM,
  EAT_STRESS_REDUCE,
  MIN_THIGH_CM,
  NO_MEAL_MULTIPLIER,
  STRESS_MAX,
  WORK_BASE_MONEY,
  WORK_DAY_SLOPE,
  WORK_STRESS_GAIN,
} from "./constants";
import { clampStress } from "./clamp";
import { checkDayEndEnding, checkImmediateBankrupt, checkInstantSpecialEnding } from "./endings";
import { getNoEatEffectiveFactor } from "./buffSystem";
import {
  EAT_SLOT_EVENING_MASK,
  EAT_SLOT_MORNING_MASK,
  EAT_SLOT_NOON_MASK,
} from "./endingsTable";
import { applyRandomGuestEffect } from "./guests";
import { getGuestCost } from "./guestCost";
import { pushLog } from "./logger";
import { getStage } from "./stage";
import type { GameState, Rng, RunResult, StepResult } from "./types";

function normalizeAfterAction(state: GameState): GameState {
  return {
    ...state,
    stress: clampStress(state.stress),
    thighCm: Math.max(state.thighCm, MIN_THIGH_CM),
  };
}

function consumeAction(state: GameState): GameState {
  return {
    ...state,
    actionsRemaining: Math.max(state.actionsRemaining - 1, 0),
  };
}

function actionSlotMaskByRemaining(actionsRemaining: number): number {
  if (actionsRemaining === 3) return EAT_SLOT_MORNING_MASK;
  if (actionsRemaining === 2) return EAT_SLOT_NOON_MASK;
  return EAT_SLOT_EVENING_MASK;
}

function addActionCount(state: GameState, key: "work" | "eat" | "guest"): GameState {
  return {
    ...state,
    actionCounts: {
      ...state.actionCounts,
      [key]: state.actionCounts[key] + 1,
      totalActions: state.actionCounts.totalActions + 1,
    },
  };
}

function recordDay1Action(state: GameState, key: "work" | "eat" | "guest"): GameState {
  if (state.day !== 1 || state.day1Actions.length >= 3) return state;
  return {
    ...state,
    day1Actions: [...state.day1Actions, key],
  };
}

function finalizeAction(state: GameState): StepResult {
  let next = normalizeAfterAction(state);
  next = consumeAction(next);

  const bankrupt = checkImmediateBankrupt(next);
  if (bankrupt) {
    return { state: next, ended: bankrupt, dayEnded: false };
  }

  if (next.actionsRemaining === 0) {
    const dayResult = endDay(next);
    return {
      state: dayResult.state,
      ended: dayResult.ended,
      dayEnded: true,
    };
  }

  return { state: next, dayEnded: false };
}

export function applyWork(state: GameState): StepResult {
  let moneyGain = (WORK_BASE_MONEY + state.day * WORK_DAY_SLOPE) * state.buffs.creditGainMult;
  let stressGain = WORK_STRESS_GAIN * state.buffs.stressGainMult;
  let remainingNoaCharges = state.noaWorkCharges;
  const usedNoa = remainingNoaCharges > 0;

  if (usedNoa) {
    moneyGain *= 1.5;
    stressGain *= 0.5;
    remainingNoaCharges -= 1;
  }

  const roundedMoneyGain = Math.round(moneyGain);
  const roundedStressGain = Math.round(stressGain);

  let next: GameState = {
    ...state,
    money: state.money + roundedMoneyGain,
    stress: state.stress + roundedStressGain,
    noaWorkCharges: remainingNoaCharges,
  };

  next = pushLog(
    next,
    usedNoa ? "log.workNoa" : "log.work",
    usedNoa
      ? { credits: roundedMoneyGain, stress: roundedStressGain, charges: remainingNoaCharges }
      : { credits: roundedMoneyGain, stress: roundedStressGain },
    "work",
  );
  next = addActionCount(next, "work");
  next = recordDay1Action(next, "work");

  return finalizeAction(next);
}

export function applyEat(state: GameState): StepResult {
  const finalCost = Math.round(
    (EAT_BASE_COST + state.thighCm * EAT_COST_PER_CM) * state.buffs.eatCostMult,
  );
  // Option 3: thigh gain scales from the actual paid meal cost.
  const baseThighGain = Math.max(EAT_MIN_GAIN_CM, Math.round(finalCost * EAT_COST_TO_THIGH_CM));
  const thighGain = Math.round(baseThighGain * state.buffs.thighGainMult);

  let next: GameState = {
    ...state,
    money: state.money - finalCost,
    stress: state.stress - EAT_STRESS_REDUCE,
    thighCm: state.thighCm + thighGain,
    ateToday: true,
    eatSlotsMask: state.eatSlotsMask | actionSlotMaskByRemaining(state.actionsRemaining),
  };

  next = pushLog(next, "log.eat", {
    credits: finalCost,
    thigh: thighGain,
    stress: EAT_STRESS_REDUCE,
  }, "eat");
  next = addActionCount(next, "eat");
  next = recordDay1Action(next, "eat");

  return finalizeAction(next);
}

export function applyGuest(
  state: GameState,
  rng: Rng,
  isEndingCollected: (endingId: string) => boolean = () => false,
): StepResult {
  const stage = getStage(state.thighCm);
  const guestCost = Math.round(getGuestCost(stage) * state.buffs.guestCostMult);
  const paidState: GameState = {
    ...state,
    money: state.money - guestCost,
  };
  const guestResult = applyRandomGuestEffect(paidState, rng);
  const nextGuestState: GameState = {
    ...guestResult.state,
    guestCounts: {
      ...guestResult.state.guestCounts,
      aris: guestResult.state.guestCounts.aris + (guestResult.guestId === "aris" ? 1 : 0),
      koyuki: guestResult.state.guestCounts.koyuki + (guestResult.guestId === "koyuki" ? 1 : 0),
      maki: guestResult.state.guestCounts.maki + (guestResult.guestId === "maki" ? 1 : 0),
      momoi: guestResult.state.guestCounts.momoi + (guestResult.guestId === "momoi" ? 1 : 0),
      noa: guestResult.state.guestCounts.noa + (guestResult.guestId === "noa" ? 1 : 0),
      rio: guestResult.state.guestCounts.rio + (guestResult.guestId === "rio" ? 1 : 0),
      sensei: guestResult.state.guestCounts.sensei + (guestResult.guestId === "teacher" ? 1 : 0),
    },
    koyukiLossCount:
      guestResult.state.koyukiLossCount +
      (guestResult.guestId === "koyuki" && guestResult.outcomeId === "loss" ? 1 : 0),
  };
  let next = pushLog(nextGuestState, "log.guest", {
    nameKey: `guest.${guestResult.guestId}.name`,
    effectKey: guestResult.effectKey,
  }, "guest");
  next = addActionCount(next, "guest");
  next = recordDay1Action(next, "guest");

  const consumed = consumeAction(normalizeAfterAction(next));
  const instantSpecial = checkInstantSpecialEnding(consumed, isEndingCollected);
  if (instantSpecial) {
    return {
      state: consumed,
      ended: instantSpecial,
      dayEnded: false,
    };
  }

  return finalizeAction(next);
}

export function endDay(state: GameState): { state: GameState; ended?: RunResult } {
  let next = { ...state };

  if (!next.ateToday) {
    const noEatFactor = getNoEatEffectiveFactor(next.buffs.noEatPenaltyMult, NO_MEAL_MULTIPLIER);
    const noMealPenaltyPercent = Number(((1 - noEatFactor) * 100).toFixed(1));
    next = {
      ...next,
      thighCm: next.thighCm * noEatFactor,
    };
    next = pushLog(next, "log.noMeal", { penalty: noMealPenaltyPercent }, "system");
  }

  next = normalizeAfterAction(next);
  next = {
    ...next,
    stress100Days: next.stress === STRESS_MAX ? next.stress100Days + 1 : 0,
  };

  const ended = checkDayEndEnding(next);
  if (ended) {
    return { state: next, ended };
  }

  return {
    state: {
      ...next,
      day: next.day + 1,
      actionsRemaining: ACTIONS_PER_DAY,
      ateToday: false,
    },
  };
}
