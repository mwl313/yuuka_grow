import {
  SHARE_PAGE_PATH,
  SHARE_PARAM_DAY,
  SHARE_PARAM_ENDING,
  SHARE_PARAM_MONEY,
  SHARE_PARAM_STRESS,
  SHARE_PARAM_THIGH,
} from "../core/constants";
import type { EndingId, RunResult } from "../core/types";

interface ShareResult {
  thigh: number;
  day: number;
  ending: EndingId;
  money: number;
  stress: number;
}

const validEndings: EndingId[] = ["normal", "bankrupt", "stress"];

export function buildShareRelativeUrl(run: RunResult): string {
  const params = new URLSearchParams({
    [SHARE_PARAM_THIGH]: String(Math.round(run.finalThighCm)),
    [SHARE_PARAM_DAY]: String(Math.round(run.dayReached)),
    [SHARE_PARAM_ENDING]: run.endingId,
    [SHARE_PARAM_MONEY]: String(Math.round(run.finalMoney)),
    [SHARE_PARAM_STRESS]: String(Math.round(run.finalStress)),
  });
  return `${SHARE_PAGE_PATH}?${params.toString()}`;
}

export function parseShareQuery(search: string): ShareResult | null {
  const params = new URLSearchParams(search);
  const thighRaw = params.get(SHARE_PARAM_THIGH);
  const dayRaw = params.get(SHARE_PARAM_DAY);
  const ending = params.get(SHARE_PARAM_ENDING);
  const moneyRaw = params.get(SHARE_PARAM_MONEY);
  const stressRaw = params.get(SHARE_PARAM_STRESS);

  if (!thighRaw || !dayRaw || !ending || !moneyRaw || !stressRaw) {
    return null;
  }

  const thigh = Number(thighRaw);
  const day = Number(dayRaw);
  const money = Number(moneyRaw);
  const stress = Number(stressRaw);

  if (!Number.isFinite(thigh)) return null;
  if (!Number.isFinite(day)) return null;
  if (!Number.isFinite(money)) return null;
  if (!Number.isFinite(stress)) return null;
  if (!ending || !validEndings.includes(ending as EndingId)) return null;

  return {
    thigh: Math.round(thigh),
    day: Math.round(day),
    ending: ending as EndingId,
    money: Math.round(money),
    stress: Math.round(stress),
  };
}
