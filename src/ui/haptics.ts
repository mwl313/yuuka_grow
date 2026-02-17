const LOBBY_TAP_COOLDOWN_MS = 80;
const STAGE_UP_COOLDOWN_MS = 300;
const GAME_OVER_COOLDOWN_MS = 2000;
const STAGE_BG_TRANSITION_COOLDOWN_MS = 800;

const LOBBY_TAP_PATTERN = 10;
const STAGE_UP_PATTERN = [12, 25, 12];
const STRONG_IMPACT_PATTERN = [25, 35, 25, 35, 60];

let lastLobbyTapAt = 0;
let lastStageUpAt = 0;
let lastGameOverAt = 0;
let lastStageBgTransitionAt = 0;

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function vibrate(pattern: number | number[]): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore unsupported/runtime failures.
  }
}

function passesCooldown(lastAt: number, cooldownMs: number): boolean {
  const now = Date.now();
  return now - lastAt >= cooldownMs;
}

export function hapticLobbyTap(): void {
  if (!passesCooldown(lastLobbyTapAt, LOBBY_TAP_COOLDOWN_MS)) return;
  lastLobbyTapAt = Date.now();
  vibrate(LOBBY_TAP_PATTERN);
}

export function hapticStageUp(): void {
  if (!passesCooldown(lastStageUpAt, STAGE_UP_COOLDOWN_MS)) return;
  lastStageUpAt = Date.now();
  vibrate(STAGE_UP_PATTERN);
}

export function hapticGameOver(): void {
  if (!passesCooldown(lastGameOverAt, GAME_OVER_COOLDOWN_MS)) return;
  lastGameOverAt = Date.now();
  vibrate(STRONG_IMPACT_PATTERN);
}

export function hapticStageBgTransition(): void {
  if (!passesCooldown(lastStageBgTransitionAt, STAGE_BG_TRANSITION_COOLDOWN_MS)) return;
  lastStageBgTransitionAt = Date.now();
  vibrate(STRONG_IMPACT_PATTERN);
}
