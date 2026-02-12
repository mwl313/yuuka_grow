import { DAYS_TO_SURVIVE, STRESS_END_CONSECUTIVE_DAYS } from "./constants";
import type { EndingId, GameState, RunResult } from "./types";

export function createRunResult(state: GameState, endingId: EndingId): RunResult {
  return {
    endedAtIso: new Date().toISOString(),
    endingId,
    dayReached: state.day,
    finalThighCm: state.thighCm,
    finalMoney: state.money,
    finalStress: state.stress,
  };
}

export function checkImmediateBankrupt(state: GameState): RunResult | undefined {
  if (state.money <= 0) {
    return createRunResult(state, "bankrupt");
  }
  return undefined;
}

export function checkDayEndEnding(state: GameState): RunResult | undefined {
  const bankrupt = checkImmediateBankrupt(state);
  if (bankrupt) return bankrupt;

  if (state.stress100Days >= STRESS_END_CONSECUTIVE_DAYS) {
    return createRunResult(state, "stress");
  }

  if (state.day >= DAYS_TO_SURVIVE) {
    return createRunResult(state, "normal");
  }

  return undefined;
}
