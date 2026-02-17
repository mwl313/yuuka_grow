import { ENDING_COLLECTION_KEY } from "../core/constants";

export interface EndingCollectionEntry {
  count: number;
  firstAtIso: string;
  lastAtIso: string;
}

export type EndingCollectionMap = Record<string, EndingCollectionEntry>;

function sanitizeCollection(input: unknown): EndingCollectionMap {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const next: EndingCollectionMap = {};
  for (const [endingId, raw] of Object.entries(source)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<EndingCollectionEntry>;
    const count =
      typeof item.count === "number" && Number.isFinite(item.count) && item.count > 0
        ? Math.floor(item.count)
        : 0;
    const firstAtIso = typeof item.firstAtIso === "string" ? item.firstAtIso : "";
    const lastAtIso = typeof item.lastAtIso === "string" ? item.lastAtIso : "";
    if (!endingId || count <= 0 || !firstAtIso || !lastAtIso) continue;
    next[endingId] = {
      count,
      firstAtIso,
      lastAtIso,
    };
  }
  return next;
}

export function getCollection(): EndingCollectionMap {
  const raw = localStorage.getItem(ENDING_COLLECTION_KEY);
  if (!raw) return {};
  try {
    return sanitizeCollection(JSON.parse(raw));
  } catch {
    return {};
  }
}

function saveCollection(collection: EndingCollectionMap): void {
  localStorage.setItem(ENDING_COLLECTION_KEY, JSON.stringify(collection));
}

export function hasEnding(endingId: string, collection?: EndingCollectionMap): boolean {
  const source = collection ?? getCollection();
  return Boolean(source[endingId]);
}

export function recordEnding(
  endingId: string,
  endedAtIso: string,
  collection?: EndingCollectionMap,
): EndingCollectionMap {
  const source = collection ?? getCollection();
  const current = source[endingId];
  const next: EndingCollectionMap = {
    ...source,
    [endingId]: current
      ? {
          ...current,
          count: current.count + 1,
          lastAtIso: endedAtIso,
        }
      : {
          count: 1,
          firstAtIso: endedAtIso,
          lastAtIso: endedAtIso,
        },
  };
  saveCollection(next);
  return next;
}
