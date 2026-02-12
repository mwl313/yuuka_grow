import { HISTORY_MAX_RUNS, SAVE_KEY } from "../core/constants";
import { createInitialState, sanitizeState } from "../core/state";
import type { RunResult, SaveData } from "../core/types";

function createDefaultSaveData(): SaveData {
  return {
    state: createInitialState(),
    best: null,
    history: [],
  };
}

export function loadSaveData(): SaveData {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return createDefaultSaveData();

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const history = Array.isArray(parsed.history)
      ? parsed.history.filter((run): run is RunResult => Boolean(run && typeof run === "object"))
      : [];
    const best = parsed.best && typeof parsed.best === "object" ? (parsed.best as RunResult) : null;
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
