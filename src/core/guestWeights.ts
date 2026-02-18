import {
  GUEST_STRESS_BAND_0_MAX,
  GUEST_STRESS_BAND_1_MAX,
  GUEST_STRESS_BAND_2_MAX,
  GUEST_STRESS_BAND_3_MAX,
  GUEST_WEIGHT_ORDER_BY_STRESS,
  GUEST_WEIGHTS_BY_STRESS_BAND,
} from "./constants";
import type { GuestId, Rng, StressBandId } from "./types";

export function getStressBand(stress: number): StressBandId {
  if (stress <= GUEST_STRESS_BAND_0_MAX) return 0;
  if (stress <= GUEST_STRESS_BAND_1_MAX) return 1;
  if (stress <= GUEST_STRESS_BAND_2_MAX) return 2;
  if (stress <= GUEST_STRESS_BAND_3_MAX) return 3;
  return 4;
}

export function weightedPick<T extends string>(
  keys: readonly T[],
  weights: readonly number[],
  rng: () => number = Math.random,
): T {
  if (keys.length === 0 || keys.length !== weights.length) {
    throw new Error("weightedPick requires same-length non-empty keys/weights");
  }

  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) {
    const uniformIndex = Math.floor(rng() * keys.length);
    return keys[Math.min(uniformIndex, keys.length - 1)];
  }

  const point = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < keys.length; i += 1) {
    cumulative += Math.max(0, weights[i]);
    if (cumulative >= point) return keys[i];
  }
  return keys[keys.length - 1];
}

export function pickGuestByStress(stress: number, rng: Rng): GuestId {
  const band = getStressBand(stress);
  const keys = GUEST_WEIGHT_ORDER_BY_STRESS as readonly GuestId[];
  const weights = GUEST_WEIGHTS_BY_STRESS_BAND[band];
  return weightedPick(keys, weights, rng.next01);
}
