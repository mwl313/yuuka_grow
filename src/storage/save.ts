import { HISTORY_MAX_RUNS, SAVE_KEY } from "../core/constants";
import { createInitialState, sanitizeState } from "../core/state";
import { toBaseEndCategory } from "../core/endings";
import type { EndingCategory, RunResult, SaveData } from "../core/types";

function createDefaultSaveData(): SaveData {
  return {
    state: createInitialState(),
    best: null,
    history: [],
  };
}

function inferCategoryFromEndingId(endingId: string): EndingCategory {
  const head = endingId.split(".")[0];
  if (head === "normal" || head === "bankrupt" || head === "stress" || head === "special" || head === "any") {
    return head;
  }
  return toBaseEndCategory(head);
}

function sanitizeRunResult(input: unknown): RunResult | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Partial<RunResult>;
  if (typeof source.endingId !== "string" || source.endingId.length <= 0) return null;
  const endedAtIso = typeof source.endedAtIso === "string" ? source.endedAtIso : new Date().toISOString();
  const dayReached = typeof source.dayReached === "number" ? Math.max(1, Math.floor(source.dayReached)) : 1;
  const finalThighCm =
    typeof source.finalThighCm === "number" && Number.isFinite(source.finalThighCm)
      ? source.finalThighCm
      : 0;
  const finalMoney =
    typeof source.finalMoney === "number" && Number.isFinite(source.finalMoney) ? Math.round(source.finalMoney) : 0;
  const finalStress =
    typeof source.finalStress === "number" && Number.isFinite(source.finalStress)
      ? Math.round(source.finalStress)
      : 0;
  const endingCategory =
    source.endingCategory === "normal" ||
    source.endingCategory === "bankrupt" ||
    source.endingCategory === "stress" ||
    source.endingCategory === "special" ||
    source.endingCategory === "any"
      ? source.endingCategory
      : inferCategoryFromEndingId(source.endingId);
  return {
    endedAtIso,
    endingCategory,
    endingId: source.endingId,
    dayReached,
    finalThighCm,
    finalMoney,
    finalStress,
  };
}

export function loadSaveData(): SaveData {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return createDefaultSaveData();

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const history = Array.isArray(parsed.history)
      ? parsed.history
          .map((run) => sanitizeRunResult(run))
          .filter((run): run is RunResult => Boolean(run))
      : [];
    const best = sanitizeRunResult(parsed.best);
    return {
      state: sanitizeState(parsed.state),
      best,
      history,
    };
  } catch {
    return createDefaultSaveData();
  }
}

export function saveData(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function recordRunResult(current: SaveData, result: RunResult): SaveData {
  const nextHistory = [result, ...current.history].slice(0, HISTORY_MAX_RUNS);
  const nextBest =
    current.best === null || result.finalThighCm > current.best.finalThighCm ? result : current.best;
  return {
    ...current,
    best: nextBest,
    history: nextHistory,
  };
}
