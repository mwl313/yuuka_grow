import {
  ACTIONS_PER_DAY,
  EAT_BASE_COST,
  EAT_BASE_GAIN_CM,
  EAT_COST_PER_CM,
  EAT_GAIN_FACTOR,
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
import {
  EAT_SLOT_EVENING_MASK,
  EAT_SLOT_MORNING_MASK,
  EAT_SLOT_NOON_MASK,
} from "./endingsTable";
import { applyRandomGuestEffect } from "./guests";
import { pushLog } from "./logger";
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
  let moneyGain = WORK_BASE_MONEY + state.day * WORK_DAY_SLOPE;
  let stressGain = WORK_STRESS_GAIN;
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
  );
  next = addActionCount(next, "work");

  return finalizeAction(next);
}

export function applyEat(state: GameState): StepResult {
  const cost = Math.round(EAT_BASE_COST + state.thighCm * EAT_COST_PER_CM);
  const thighGain = EAT_BASE_GAIN_CM + state.thighCm * EAT_GAIN_FACTOR;

  let next: GameState = {
    ...state,
    money: state.money - cost,
    stress: state.stress - EAT_STRESS_REDUCE,
    thighCm: state.thighCm + thighGain,
    ateToday: true,
    eatSlotsMask: state.eatSlotsMask | actionSlotMaskByRemaining(state.actionsRemaining),
  };

  next = pushLog(next, "log.eat", {
    credits: cost,
    thigh: Math.round(thighGain),
    stress: EAT_STRESS_REDUCE,
  });
  next = addActionCount(next, "eat");

  return finalizeAction(next);
}

export function applyGuest(state: GameState, rng: Rng): StepResult {
  const guestResult = applyRandomGuestEffect(state, rng);
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
  });
  next = addActionCount(next, "guest");

  const consumed = consumeAction(normalizeAfterAction(next));
  const instantSpecial = checkInstantSpecialEnding(consumed);
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
    next = {
      ...next,
      thighCm: next.thighCm * NO_MEAL_MULTIPLIER,
    };
    next = pushLog(next, "log.noMeal");
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
