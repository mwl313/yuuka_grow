import {
  GUEST_IDS,
  GUEST_WEIGHT_GAMBLING,
  GUEST_WEIGHT_NEUTRAL,
  GUEST_WEIGHT_RISKY,
  GUEST_WEIGHT_STABLE,
  STRESS_BAND_GAMBLING,
  STRESS_BAND_NEUTRAL,
  STRESS_BAND_RISKY,
  STRESS_BAND_STABLE,
  STRESS_BAND_NEUTRAL_MAX,
  STRESS_BAND_RISKY_MAX,
  STRESS_BAND_STABLE_MAX,
} from "./constants";
import { weightedPick } from "./rng";
import type { GuestId, Rng, StressBandId, WeightedItem } from "./types";

export function getStressBand(stress: number): StressBandId {
  if (stress <= STRESS_BAND_STABLE_MAX) return STRESS_BAND_STABLE;
  if (stress <= STRESS_BAND_NEUTRAL_MAX) return STRESS_BAND_NEUTRAL;
  if (stress <= STRESS_BAND_RISKY_MAX) return STRESS_BAND_RISKY;
  return STRESS_BAND_GAMBLING;
}

function getBandWeights(band: StressBandId): Record<GuestId, number> {
  if (band === STRESS_BAND_STABLE) return { ...GUEST_WEIGHT_STABLE };
  if (band === STRESS_BAND_NEUTRAL) return { ...GUEST_WEIGHT_NEUTRAL };
  if (band === STRESS_BAND_RISKY) return { ...GUEST_WEIGHT_RISKY };
  return { ...GUEST_WEIGHT_GAMBLING };
}

export function pickGuestByStress(stress: number, rng: Rng): GuestId {
  const band = getStressBand(stress);
  const bandWeights = getBandWeights(band);
  const weightedGuests: WeightedItem<GuestId>[] = GUEST_IDS.map((guestId) => ({
    item: guestId,
    weight: bandWeights[guestId],
  }));
  return weightedPick(rng.next01, weightedGuests);
}
