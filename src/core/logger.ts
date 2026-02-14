import { LOG_MAX_LINES } from "./constants";
import type { GameState, LogPayload } from "./types";

export function encodeLog(payload: LogPayload): string {
  return JSON.stringify(payload);
}

export function decodeLog(line: string): LogPayload | null {
  try {
    const parsed = JSON.parse(line) as LogPayload;
    if (typeof parsed.key !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function pushLog(
  state: GameState,
  key: string,
  params?: Record<string, number | string>,
): GameState {
  const nextLogs = [...state.logs, encodeLog({ key, params })];
  if (LOG_MAX_LINES > 0) {
    while (nextLogs.length > LOG_MAX_LINES) {
      nextLogs.shift();
    }
  }
  return {
    ...state,
    logs: nextLogs,
  };
}
