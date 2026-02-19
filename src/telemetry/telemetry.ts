const STORAGE_KEY_ANON_ID = "yuuka_anon_id_v1";
const HEARTBEAT_INTERVAL_MS = 60_000;

const TELEMETRY_ENDPOINTS = {
  sessionStart: "/api/telemetry/session_start",
  heartbeat: "/api/telemetry/heartbeat",
  sessionEnd: "/api/telemetry/session_end",
} as const;

let initialized = false;
let heartbeatTimer: number | undefined;
let currentSession: { anonId: string; sessionId: string } | null = null;
let sessionEnded = false;

// Privacy note: metrics identify activity by anonId only (no IP/cookie tracking in client).
function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getOrCreateAnonId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ANON_ID)?.trim() ?? "";
    if (stored.length > 0 && stored.length <= 80) return stored;
  } catch {
    // Ignore storage errors and fall back to a volatile id.
  }

  const created = createId();
  try {
    localStorage.setItem(STORAGE_KEY_ANON_ID, created);
  } catch {
    // Ignore storage errors.
  }
  return created;
}

async function postJson(url: string, payload: unknown, options?: { keepalive?: boolean }): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: options?.keepalive === true,
  });
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== undefined) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
}

function sendSessionEndOnce(): void {
  if (sessionEnded) return;
  sessionEnded = true;
  stopHeartbeat();
  if (!currentSession) return;

  const payload = {
    anonId: currentSession.anonId,
    sessionId: currentSession.sessionId,
    ts: new Date().toISOString(),
  };
  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const sent = navigator.sendBeacon(TELEMETRY_ENDPOINTS.sessionEnd, blob);
      if (sent) return;
    }
  } catch {
    // Ignore and fallback to fetch below.
  }
  void postJson(TELEMETRY_ENDPOINTS.sessionEnd, payload, { keepalive: true }).catch(() => undefined);
}

export function initTelemetry(): void {
  if (initialized) return;
  initialized = true;

  const anonId = getOrCreateAnonId();
  const sessionId = createId();
  currentSession = { anonId, sessionId };
  sessionEnded = false;

  const startedAt = new Date().toISOString();
  void postJson(TELEMETRY_ENDPOINTS.sessionStart, {
    anonId,
    sessionId,
    startedAt,
    referrer: document.referrer || undefined,
  }).catch(() => undefined);

  heartbeatTimer = window.setInterval(() => {
    if (!currentSession || sessionEnded) return;
    void postJson(TELEMETRY_ENDPOINTS.heartbeat, {
      anonId: currentSession.anonId,
      sessionId: currentSession.sessionId,
      ts: new Date().toISOString(),
    }).catch(() => undefined);
  }, HEARTBEAT_INTERVAL_MS);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") {
        sendSessionEndOnce();
      }
    },
    { capture: true },
  );
  window.addEventListener("beforeunload", sendSessionEndOnce, { capture: true });
  window.addEventListener("pagehide", sendSessionEndOnce, { capture: true });
}
