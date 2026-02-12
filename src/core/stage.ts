import {
  COMPARISON_STAGE_BUILDING,
  COMPARISON_STAGE_CAR,
  COMPARISON_STAGE_CHAIR,
  COMPARISON_STAGE_DESK,
  COMPARISON_STAGE_PERSON,
  GIANT_MODE_STAGE,
  STAGE_THRESHOLDS,
} from "./constants";
import type { ComparisonKind } from "./types";

export function getStage(thighCm: number): number {
  let stage = 1;
  for (let index = 0; index < STAGE_THRESHOLDS.length; index += 1) {
    if (thighCm >= STAGE_THRESHOLDS[index]) {
      stage = index + 1;
    }
  }
  return stage;
}

export function getComparisonKind(stage: number): ComparisonKind | null {
  if (stage < GIANT_MODE_STAGE) return null;
  if (stage >= COMPARISON_STAGE_BUILDING) return "building";
  if (stage >= COMPARISON_STAGE_CAR) return "car";
  if (stage >= COMPARISON_STAGE_PERSON) return "person";
  if (stage >= COMPARISON_STAGE_DESK) return "desk";
  if (stage >= COMPARISON_STAGE_CHAIR) return "chair";
  return null;
}
