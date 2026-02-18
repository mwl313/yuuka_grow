import {
  GUEST_COST_BASE,
  GUEST_COST_KINK_STAGE,
  GUEST_COST_MULT_DEN,
  GUEST_COST_MULT_NUM,
  GUEST_COST_SLOPE_POST,
  GUEST_COST_SLOPE_PRE,
} from "./constants";

export function getGuestCost(stage: number): number {
  const pre = Math.min(stage, GUEST_COST_KINK_STAGE);
  const post = Math.max(stage - GUEST_COST_KINK_STAGE, 0);
  const rawGuestCost = Math.round(
    GUEST_COST_BASE + GUEST_COST_SLOPE_PRE * pre + GUEST_COST_SLOPE_POST * post,
  );
  return Math.round((rawGuestCost * GUEST_COST_MULT_NUM) / GUEST_COST_MULT_DEN);
}
