export type LeaderboardSort = "credit" | "thigh";
export type EndingCategory = "normal" | "bankrupt" | "stress" | "special";

export interface SubmitRunPayload {
  runId: string;
  nickname: string;
  endingCategory: EndingCategory;
  endingId: string;
  survivalDays: number;
  finalCredits: number;
  finalThighCm: number;
  finalStage: number;
  submittedAtClient: string;
  clientVersion: string;
}

export interface RankEntry {
  rank: number | null;
  total: number | null;
  percentileTop: number | null;
}

export interface SubmitRunResponse {
  ok: true;
  shareId: string;
  submittedAtServer: string;
  rank: {
    credit: RankEntry;
    thigh: RankEntry;
  };
}

export interface LeaderboardItem {
  nickname: string;
  ending_category: string;
  ending_id: string;
  survival_days: number;
  final_credits: number;
  final_thigh_cm: number;
  final_stage: number;
  submitted_at_client: string;
  submitted_at_server: string;
}

export interface LeaderboardResponse {
  ok: true;
  sort: LeaderboardSort;
  items: LeaderboardItem[];
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (typeof body.error === "string" && body.error.length > 0) {
        message = body.error;
      }
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function submitRun(payload: SubmitRunPayload): Promise<SubmitRunResponse> {
  const response = await fetch("/api/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<SubmitRunResponse>(response);
}

export async function fetchLeaderboard(sort: LeaderboardSort, limit = 100): Promise<LeaderboardResponse> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const query = new URLSearchParams({
    sort,
    limit: String(safeLimit),
  });
  const response = await fetch(`/api/leaderboard?${query.toString()}`);
  return parseJsonResponse<LeaderboardResponse>(response);
}

export function buildShareUrl(shareId: string): string {
  const encoded = encodeURIComponent(shareId.trim());
  return `${window.location.origin}/share/${encoded}`;
}
