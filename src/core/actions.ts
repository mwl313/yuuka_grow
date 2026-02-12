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
import { checkDayEndEnding, checkImmediateBankrupt } from "./endings";
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
  };

  next = pushLog(next, "log.eat", {
    credits: cost,
    thigh: Math.round(thighGain),
    stress: EAT_STRESS_REDUCE,
  });

  return finalizeAction(next);
}

export function applyGuest(state: GameState, rng: Rng): StepResult {
  const guestResult = applyRandomGuestEffect(state, rng);
  const next = pushLog(guestResult.state, "log.guest", {
    nameKey: `guest.${guestResult.guestId}.name`,
    effectKey: guestResult.effectKey,
  });
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
