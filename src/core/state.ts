import {
  ACTIONS_PER_DAY,
  MIN_THIGH_CM,
  START_MONEY,
  START_STRESS,
  START_THIGH_CM,
  STRESS_MAX,
  STRESS_MIN,
} from "./constants";
import { clamp } from "./clamp";
import type { GameState } from "./types";

export function createInitialState(): GameState {
  return {
    day: 1,
    actionsRemaining: ACTIONS_PER_DAY,
    money: START_MONEY,
    stress: START_STRESS,
    thighCm: START_THIGH_CM,
    stress100Days: 0,
    ateToday: false,
    noaWorkCharges: 0,
    logs: [],
  };
}

export function sanitizeState(input: unknown): GameState {
  const fallback = createInitialState();
  if (!input || typeof input !== "object") return fallback;

  const source = input as Partial<GameState>;
  const day = typeof source.day === "number" && source.day >= 1 ? Math.floor(source.day) : fallback.day;
  const actionsRemaining =
    typeof source.actionsRemaining === "number"
      ? clamp(Math.floor(source.actionsRemaining), 0, ACTIONS_PER_DAY)
      : fallback.actionsRemaining;
  const money = typeof source.money === "number" ? Math.round(source.money) : fallback.money;
  const stress =
    typeof source.stress === "number"
      ? clamp(Math.round(source.stress), STRESS_MIN, STRESS_MAX)
      : fallback.stress;
  const thighCm =
    typeof source.thighCm === "number" && source.thighCm >= MIN_THIGH_CM
      ? source.thighCm
      : fallback.thighCm;
  const stress100Days =
    typeof source.stress100Days === "number" && source.stress100Days >= 0
      ? Math.floor(source.stress100Days)
      : fallback.stress100Days;
  const ateToday = typeof source.ateToday === "boolean" ? source.ateToday : fallback.ateToday;
  const noaWorkCharges =
    typeof source.noaWorkCharges === "number" && source.noaWorkCharges >= 0
      ? Math.floor(source.noaWorkCharges)
      : fallback.noaWorkCharges;
  const logs = Array.isArray(source.logs)
    ? source.logs.filter((line): line is string => typeof line === "string")
    : fallback.logs;

  return {
    day,
    actionsRemaining,
    money,
    stress,
    thighCm,
    stress100Days,
    ateToday,
    noaWorkCharges,
    logs,
  };
}
