import { ENDING_META, getEndingTitle, type Lang } from "./endingMeta";

function buildTitles(lang: Lang): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ENDING_META[lang]).map(([endingId, meta]) => [endingId, meta.title]),
  );
}

export { getEndingTitle };
export type { Lang };

export const ENDING_TITLES: Record<Lang, Record<string, string>> = {
  ko: buildTitles("ko"),
  en: buildTitles("en"),
  ja: buildTitles("ja"),
};

