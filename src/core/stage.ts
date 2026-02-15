import {
  STAGE_GROWTH_FACTOR_AFTER_MAX,
  STAGE_THRESHOLDS,
} from "./constants";

export function getStage(thighCm: number): number {
  const maxStage = STAGE_THRESHOLDS.length;
  const maxThreshold = STAGE_THRESHOLDS[maxStage - 1];
  let stage = 1;
  for (let index = 0; index < maxStage; index += 1) {
    if (thighCm >= STAGE_THRESHOLDS[index]) {
      stage = index + 1;
    }
  }
  if (thighCm < maxThreshold) return stage;

  const ratio = thighCm / maxThreshold;
  const extraRaw = Math.log(ratio) / Math.log(STAGE_GROWTH_FACTOR_AFTER_MAX);
  const extra = Math.max(0, Math.floor(extraRaw + 1e-9));
  return maxStage + extra;
}

function runStageSanityChecksInDev(): void {
  if (!import.meta.env.DEV) return;

  const maxStage = STAGE_THRESHOLDS.length;
  const maxThreshold = STAGE_THRESHOLDS[maxStage - 1];
  console.assert(getStage(maxThreshold) === maxStage, "Stage check failed at max threshold");
  console.assert(
    getStage(maxThreshold * STAGE_GROWTH_FACTOR_AFTER_MAX * 0.999) === maxStage,
    "Stage check failed below next threshold",
  );
  console.assert(
    getStage(maxThreshold * STAGE_GROWTH_FACTOR_AFTER_MAX) === maxStage + 1,
    "Stage check failed at next threshold",
  );
  console.assert(
    getStage(maxThreshold * STAGE_GROWTH_FACTOR_AFTER_MAX ** 2) === maxStage + 2,
    "Stage check failed at second next threshold",
  );
  console.assert(
    getStage(maxThreshold * STAGE_GROWTH_FACTOR_AFTER_MAX ** 40) > maxStage,
    "Stage check failed for very large value",
  );
}

runStageSanityChecksInDev();
