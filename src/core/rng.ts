import type { Rng, WeightedItem } from "./types";

export const defaultRng: Rng = {
  next01: () => Math.random(),
};

export function weightedPick<T>(rng01: () => number, items: WeightedItem<T>[]): T {
  if (items.length === 0) {
    throw new Error("weightedPick requires at least one item");
  }

  const total = items.reduce((sum, current) => sum + current.weight, 0);
  if (total <= 0) {
    const uniformIndex = Math.floor(rng01() * items.length);
    return items[Math.min(uniformIndex, items.length - 1)].item;
  }

  const randomPoint = rng01() * total;
  let cumulative = 0;
  for (const candidate of items) {
    cumulative += candidate.weight;
    if (cumulative >= randomPoint) {
      return candidate.item;
    }
  }

  return items[items.length - 1].item;
}
