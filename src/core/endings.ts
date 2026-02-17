import { DAYS_TO_SURVIVE, STRESS_END_CONSECUTIVE_DAYS } from "./constants";
import { hasSpecialMarriageCondition } from "./endingsTable";
import type { EndBaseCategory, EndingCategory, GameState, RunResult } from "./types";

export function createRunResult(
  state: GameState,
  endingCategory: EndingCategory,
  endingId: string,
): RunResult {
  return {
    endedAtIso: new Date().toISOString(),
    endingCategory,
    endingId,
    dayReached: state.day,
    finalThighCm: state.thighCm,
    finalMoney: state.money,
    finalStress: state.stress,
  };
}

export function checkImmediateBankrupt(state: GameState): RunResult | undefined {
  if (state.money <= 0) {
    return createRunResult(state, "bankrupt", "bankrupt.default");
  }
  return undefined;
}

export function checkDayEndEnding(state: GameState): RunResult | undefined {
  const bankrupt = checkImmediateBankrupt(state);
  if (bankrupt) return bankrupt;

  if (state.stress100Days >= STRESS_END_CONSECUTIVE_DAYS) {
    return createRunResult(state, "stress", "stress.default");
  }

  if (state.day >= DAYS_TO_SURVIVE) {
    return createRunResult(state, "normal", "normal.default");
  }

  return undefined;
}

export function checkInstantSpecialEnding(state: GameState): RunResult | undefined {
  if (!hasSpecialMarriageCondition(state)) return undefined;
  return createRunResult(state, "special", "special.marriage");
}

export function toBaseEndCategory(value: string): EndBaseCategory {
  if (value === "normal" || value === "bankrupt" || value === "stress" || value === "special") {
    return value;
  }
  if (value === "any") return "normal";
  return "normal";
}
