import {
  ACTIONS_PER_DAY,
  MIN_THIGH_CM,
  START_MONEY,
  START_STRESS,
  START_THIGH_CM,
  STRESS_MAX,
  STRESS_MIN,
} from "./constants";
import { createInitialBuffMultipliers } from "./buffSystem";
import { clamp } from "./clamp";
import type { ActionCounts, BuffCardSelection, BuffMultipliers, GameState, GuestCounts } from "./types";

function createInitialActionCounts(): ActionCounts {
  return {
    work: 0,
    eat: 0,
    guest: 0,
    totalActions: 0,
  };
}

function createInitialGuestCounts(): GuestCounts {
  return {
    aris: 0,
    koyuki: 0,
    maki: 0,
    momoi: 0,
    noa: 0,
    rio: 0,
    sensei: 0,
  };
}

export function createInitialState(): GameState {
  return {
    day: 1,
    actionsRemaining: ACTIONS_PER_DAY,
    money: START_MONEY,
    stress: START_STRESS,
    thighCm: START_THIGH_CM,
    stress100Days: 0,
    ateToday: false,
    noaWorkCharges: 0,
    actionCounts: createInitialActionCounts(),
    guestCounts: createInitialGuestCounts(),
    koyukiLossCount: 0,
    eatSlotsMask: 0,
    milestonesHit: [],
    buffs: createInitialBuffMultipliers(),
    buffHistory: [],
    logs: [],
  };
}

export function sanitizeState(input: unknown): GameState {
  const fallback = createInitialState();
  if (!input || typeof input !== "object") return fallback;

  const source = input as Partial<GameState>;
  const day = typeof source.day === "number" && source.day >= 1 ? Math.floor(source.day) : fallback.day;
  const actionsRemaining =
    typeof source.actionsRemaining === "number"
      ? clamp(Math.floor(source.actionsRemaining), 0, ACTIONS_PER_DAY)
      : fallback.actionsRemaining;
  const money = typeof source.money === "number" ? Math.round(source.money) : fallback.money;
  const stress =
    typeof source.stress === "number"
      ? clamp(Math.round(source.stress), STRESS_MIN, STRESS_MAX)
      : fallback.stress;
  const thighCm =
    typeof source.thighCm === "number" && source.thighCm >= MIN_THIGH_CM
      ? source.thighCm
      : fallback.thighCm;
  const stress100Days =
    typeof source.stress100Days === "number" && source.stress100Days >= 0
      ? Math.floor(source.stress100Days)
      : fallback.stress100Days;
  const ateToday = typeof source.ateToday === "boolean" ? source.ateToday : fallback.ateToday;
  const noaWorkCharges =
    typeof source.noaWorkCharges === "number" && source.noaWorkCharges >= 0
      ? Math.floor(source.noaWorkCharges)
      : fallback.noaWorkCharges;
  const actionCountsSource =
    source.actionCounts && typeof source.actionCounts === "object"
      ? (source.actionCounts as Partial<ActionCounts>)
      : {};
  const actionCounts: ActionCounts = {
    work:
      typeof actionCountsSource.work === "number" && actionCountsSource.work >= 0
        ? Math.floor(actionCountsSource.work)
        : fallback.actionCounts.work,
    eat:
      typeof actionCountsSource.eat === "number" && actionCountsSource.eat >= 0
        ? Math.floor(actionCountsSource.eat)
        : fallback.actionCounts.eat,
    guest:
      typeof actionCountsSource.guest === "number" && actionCountsSource.guest >= 0
        ? Math.floor(actionCountsSource.guest)
        : fallback.actionCounts.guest,
    totalActions:
      typeof actionCountsSource.totalActions === "number" && actionCountsSource.totalActions >= 0
        ? Math.floor(actionCountsSource.totalActions)
        : fallback.actionCounts.totalActions,
  };
  const guestCountsSource =
    source.guestCounts && typeof source.guestCounts === "object"
      ? (source.guestCounts as Partial<GuestCounts>)
      : {};
  const guestCounts: GuestCounts = {
    aris:
      typeof guestCountsSource.aris === "number" && guestCountsSource.aris >= 0
        ? Math.floor(guestCountsSource.aris)
        : fallback.guestCounts.aris,
    koyuki:
      typeof guestCountsSource.koyuki === "number" && guestCountsSource.koyuki >= 0
        ? Math.floor(guestCountsSource.koyuki)
        : fallback.guestCounts.koyuki,
    maki:
      typeof guestCountsSource.maki === "number" && guestCountsSource.maki >= 0
        ? Math.floor(guestCountsSource.maki)
        : fallback.guestCounts.maki,
    momoi:
      typeof guestCountsSource.momoi === "number" && guestCountsSource.momoi >= 0
        ? Math.floor(guestCountsSource.momoi)
        : fallback.guestCounts.momoi,
    noa:
      typeof guestCountsSource.noa === "number" && guestCountsSource.noa >= 0
        ? Math.floor(guestCountsSource.noa)
        : fallback.guestCounts.noa,
    rio:
      typeof guestCountsSource.rio === "number" && guestCountsSource.rio >= 0
        ? Math.floor(guestCountsSource.rio)
        : fallback.guestCounts.rio,
    sensei:
      typeof guestCountsSource.sensei === "number" && guestCountsSource.sensei >= 0
        ? Math.floor(guestCountsSource.sensei)
        : fallback.guestCounts.sensei,
  };
  const koyukiLossCount =
    typeof source.koyukiLossCount === "number" && source.koyukiLossCount >= 0
      ? Math.floor(source.koyukiLossCount)
      : fallback.koyukiLossCount;
  const eatSlotsMask =
    typeof source.eatSlotsMask === "number" && source.eatSlotsMask >= 0
      ? Math.floor(source.eatSlotsMask)
      : fallback.eatSlotsMask;
  const logs = Array.isArray(source.logs)
    ? source.logs.filter((line): line is string => typeof line === "string")
    : fallback.logs;
  const milestonesHit = Array.isArray(source.milestonesHit)
    ? source.milestonesHit
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .map((value) => Math.floor(value))
        .filter((value) => value >= 0)
    : fallback.milestonesHit;
  const buffsSource =
    source.buffs && typeof source.buffs === "object"
      ? (source.buffs as Partial<BuffMultipliers>)
      : {};
  const baseBuffs = createInitialBuffMultipliers();
  const buffs: BuffMultipliers = {
    stressGainMult:
      typeof buffsSource.stressGainMult === "number" && Number.isFinite(buffsSource.stressGainMult)
        ? Math.max(0.05, buffsSource.stressGainMult)
        : baseBuffs.stressGainMult,
    creditGainMult:
      typeof buffsSource.creditGainMult === "number" && Number.isFinite(buffsSource.creditGainMult)
        ? Math.max(0.05, buffsSource.creditGainMult)
        : baseBuffs.creditGainMult,
    thighGainMult:
      typeof buffsSource.thighGainMult === "number" && Number.isFinite(buffsSource.thighGainMult)
        ? Math.max(0.05, buffsSource.thighGainMult)
        : baseBuffs.thighGainMult,
    koyukiWinProbMult:
      typeof buffsSource.koyukiWinProbMult === "number" && Number.isFinite(buffsSource.koyukiWinProbMult)
        ? Math.max(0.05, buffsSource.koyukiWinProbMult)
        : baseBuffs.koyukiWinProbMult,
    makiWinProbMult:
      typeof buffsSource.makiWinProbMult === "number" && Number.isFinite(buffsSource.makiWinProbMult)
        ? Math.max(0.05, buffsSource.makiWinProbMult)
        : baseBuffs.makiWinProbMult,
    guestCostMult:
      typeof buffsSource.guestCostMult === "number" && Number.isFinite(buffsSource.guestCostMult)
        ? Math.max(0.05, buffsSource.guestCostMult)
        : baseBuffs.guestCostMult,
    eatCostMult:
      typeof buffsSource.eatCostMult === "number" && Number.isFinite(buffsSource.eatCostMult)
        ? Math.max(0.05, buffsSource.eatCostMult)
        : baseBuffs.eatCostMult,
    noEatPenaltyMult:
      typeof buffsSource.noEatPenaltyMult === "number" && Number.isFinite(buffsSource.noEatPenaltyMult)
        ? Math.max(0.05, buffsSource.noEatPenaltyMult)
        : baseBuffs.noEatPenaltyMult,
  };
  const buffHistory = Array.isArray(source.buffHistory)
    ? source.buffHistory.filter((entry): entry is BuffCardSelection => {
        if (!entry || typeof entry !== "object") return false;
        const card = entry as Partial<BuffCardSelection>;
        if (typeof card.id !== "string") return false;
        if (!card.buff || typeof card.buff !== "object") return false;
        if (!card.debuff || typeof card.debuff !== "object") return false;
        if (typeof card.rarityScore !== "number") return false;
        if (typeof card.rarityLabel !== "string") return false;
        if (typeof card.milestone !== "number") return false;
        if (typeof card.selectedAtDay !== "number") return false;
        if (typeof card.selectedAtStage !== "number") return false;
        if (typeof card.buff.key !== "string" || typeof card.buff.delta !== "number") return false;
        if (typeof card.debuff.key !== "string" || typeof card.debuff.delta !== "number") return false;
        return true;
      })
    : fallback.buffHistory;

  return {
    day,
    actionsRemaining,
    money,
    stress,
    thighCm,
    stress100Days,
    ateToday,
    noaWorkCharges,
    actionCounts,
    guestCounts,
    koyukiLossCount,
    eatSlotsMask,
    milestonesHit,
    buffs,
    buffHistory,
    logs,
  };
}
