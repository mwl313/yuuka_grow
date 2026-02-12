import { STRESS_MAX, STRESS_MIN } from "./constants";

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function clampStress(stress: number): number {
  return clamp(Math.round(stress), STRESS_MIN, STRESS_MAX);
}
