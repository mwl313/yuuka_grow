import { ENDING_COLLECTION_KEY } from "../core/constants";

export interface EndingCollectionEntry {
  count: number;
  firstAtIso: string;
  lastAtIso: string;
  isNew: boolean;
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
      isNew: Boolean((item as { isNew?: unknown }).isNew),
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

export function isEndingNew(endingId: string, collection?: EndingCollectionMap): boolean {
  const source = collection ?? getCollection();
  return Boolean(source[endingId]?.isNew);
}

export function clearAllNewFlags(collection?: EndingCollectionMap): EndingCollectionMap {
  const source = collection ?? getCollection();
  let changed = false;
  const next: EndingCollectionMap = {};
  for (const [endingId, entry] of Object.entries(source)) {
    const clearedEntry = entry.isNew ? { ...entry, isNew: false } : entry;
    if (clearedEntry !== entry) {
      changed = true;
    }
    next[endingId] = clearedEntry;
  }
  if (changed) {
    saveCollection(next);
  }
  return changed ? next : source;
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
          isNew: current.isNew,
        }
      : {
          count: 1,
          firstAtIso: endedAtIso,
          lastAtIso: endedAtIso,
          // NEW badge is only for first-time discoveries.
          isNew: true,
        },
  };
  saveCollection(next);
  return next;
}
