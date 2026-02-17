import { LOG_MAX_LINES } from "./constants";
import type { GameState, LogKind, LogPayload } from "./types";

export function encodeLog(payload: LogPayload): string {
  return JSON.stringify(payload);
}

export function decodeLog(line: string): LogPayload | null {
  try {
    const parsed = JSON.parse(line) as LogPayload;
    if (typeof parsed.key !== "string") return null;
    if (
      parsed.kind !== undefined &&
      parsed.kind !== "work" &&
      parsed.kind !== "eat" &&
      parsed.kind !== "guest" &&
      parsed.kind !== "system"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function pushLog(
  state: GameState,
  key: string,
  params?: Record<string, number | string>,
  kind: LogKind = "system",
): GameState {
  const nextLogs = [...state.logs, encodeLog({ key, params, kind })];
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
