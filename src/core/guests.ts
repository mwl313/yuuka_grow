import {
  GUEST_ARIS_MONEY_PCT,
  GUEST_ARIS_THIGH_PCT,
  GUEST_KOYUKI_COMMON_STRESS_DELTA,
  GUEST_KOYUKI_JACKPOT_MONEY_PCT,
  GUEST_KOYUKI_LOSS_MONEY_PCT,
  GUEST_KOYUKI_LOSS_THIGH_PCT,
  GUEST_MAKI_SLIP_MONEY_PCT,
  GUEST_MAKI_SLIP_STRESS_DELTA,
  GUEST_MAKI_SLIP_THIGH_PCT,
  GUEST_MAKI_SUCCESS_MONEY_PCT,
  GUEST_MAKI_SUCCESS_STRESS_DELTA,
  GUEST_MAKI_SUCCESS_THIGH_PCT,
  GUEST_MOMOI_STRESS_DELTA,
  GUEST_MOMOI_THIGH_PCT,
  GUEST_NOA_MONEY_PCT,
  GUEST_NOA_STRESS_DELTA,
  GUEST_RIO_MONEY_PCT,
  GUEST_RIO_STRESS_DELTA,
  GUEST_TEACHER_STRESS_DELTA,
  GUEST_TEACHER_THIGH_PCT,
  NOA_WORK_CHARGES,
  OUTCOME_DEFAULT,
  OUTCOME_JACKPOT,
  OUTCOME_LOSS,
  OUTCOME_SLIP,
  OUTCOME_SUCCESS,
} from "./constants";
import { pickGuestByStress } from "./guestWeights";
import { weightedPick } from "./rng";
import type { GameState, GuestEffectResult, GuestOutcomeId, Rng, WeightedItem } from "./types";

export interface GuestOutcomeEffect {
  outcomeId: GuestOutcomeId;
  effectKey: string;
  moneyPct: number;
  thighPct: number;
  stressDelta: number;
  refreshNoaCharges: boolean;
}

export interface GuestCheatEntry {
  guestId: GuestEffectResult["guestId"];
  random: boolean;
  outcomes: readonly GuestOutcomeEffect[];
}

interface GuestEffectTableEntry {
  random: boolean;
  outcomes: readonly GuestOutcomeEffect[];
}

const GUEST_EFFECT_TABLE: Record<GuestEffectResult["guestId"], GuestEffectTableEntry> = {
  teacher: {
    random: false,
    outcomes: [
      {
        outcomeId: OUTCOME_DEFAULT,
        effectKey: "guest.effect.teacher",
        moneyPct: 0,
        thighPct: GUEST_TEACHER_THIGH_PCT,
        stressDelta: GUEST_TEACHER_STRESS_DELTA,
        refreshNoaCharges: false,
      },
    ],
  },
  momoi: {
    random: false,
    outcomes: [
      {
        outcomeId: OUTCOME_DEFAULT,
        effectKey: "guest.effect.momoi",
        moneyPct: 0,
        thighPct: GUEST_MOMOI_THIGH_PCT,
        stressDelta: GUEST_MOMOI_STRESS_DELTA,
        refreshNoaCharges: false,
      },
    ],
  },
  aris: {
    random: false,
    outcomes: [
      {
        outcomeId: OUTCOME_DEFAULT,
        effectKey: "guest.effect.aris",
        moneyPct: GUEST_ARIS_MONEY_PCT,
        thighPct: GUEST_ARIS_THIGH_PCT,
        stressDelta: 0,
        refreshNoaCharges: false,
      },
    ],
  },
  rio: {
    random: false,
    outcomes: [
      {
        outcomeId: OUTCOME_DEFAULT,
        effectKey: "guest.effect.rio",
        moneyPct: GUEST_RIO_MONEY_PCT,
        thighPct: 0,
        stressDelta: GUEST_RIO_STRESS_DELTA,
        refreshNoaCharges: false,
      },
    ],
  },
  noa: {
    random: false,
    outcomes: [
      {
        outcomeId: OUTCOME_DEFAULT,
        effectKey: "guest.effect.noa",
        moneyPct: GUEST_NOA_MONEY_PCT,
        thighPct: 0,
        stressDelta: GUEST_NOA_STRESS_DELTA,
        refreshNoaCharges: true,
      },
    ],
  },
  maki: {
    random: true,
    outcomes: [
      {
        outcomeId: OUTCOME_SUCCESS,
        effectKey: "guest.effect.maki.success",
        moneyPct: GUEST_MAKI_SUCCESS_MONEY_PCT,
        thighPct: GUEST_MAKI_SUCCESS_THIGH_PCT,
        stressDelta: GUEST_MAKI_SUCCESS_STRESS_DELTA,
        refreshNoaCharges: false,
      },
      {
        outcomeId: OUTCOME_SLIP,
        effectKey: "guest.effect.maki.slip",
        moneyPct: GUEST_MAKI_SLIP_MONEY_PCT,
        thighPct: GUEST_MAKI_SLIP_THIGH_PCT,
        stressDelta: GUEST_MAKI_SLIP_STRESS_DELTA,
        refreshNoaCharges: false,
      },
    ],
  },
  koyuki: {
    random: true,
    outcomes: [
      {
        outcomeId: OUTCOME_JACKPOT,
        effectKey: "guest.effect.koyuki.jackpot",
        moneyPct: GUEST_KOYUKI_JACKPOT_MONEY_PCT,
        thighPct: 0,
        stressDelta: GUEST_KOYUKI_COMMON_STRESS_DELTA,
        refreshNoaCharges: false,
      },
      {
        outcomeId: OUTCOME_LOSS,
        effectKey: "guest.effect.koyuki.loss",
        moneyPct: GUEST_KOYUKI_LOSS_MONEY_PCT,
        thighPct: GUEST_KOYUKI_LOSS_THIGH_PCT,
        stressDelta: GUEST_KOYUKI_COMMON_STRESS_DELTA,
        refreshNoaCharges: false,
      },
    ],
  },
};

const GUEST_CHEAT_ORDER: GuestEffectResult["guestId"][] = [
  "aris",
  "koyuki",
  "maki",
  "momoi",
  "noa",
  "rio",
  "teacher",
];

function applyPercent(value: number, pct: number): number {
  return value * (1 + pct);
}

function applyOutcome(state: GameState, effect: GuestOutcomeEffect): GameState {
  const next = { ...state };
  next.thighCm = applyPercent(next.thighCm, effect.thighPct);
  next.money = Math.round(applyPercent(next.money, effect.moneyPct));
  next.stress += effect.stressDelta;
  if (effect.refreshNoaCharges) {
    next.noaWorkCharges = NOA_WORK_CHARGES;
  }
  return next;
}

function pickEqualChanceOutcome(rng: Rng, outcomes: GuestOutcomeEffect[]): GuestOutcomeEffect {
  const weightedOutcomes: WeightedItem<GuestOutcomeEffect>[] = outcomes.map((item) => ({
    item,
    weight: 1,
  }));
  return weightedPick(rng.next01, weightedOutcomes);
}

function resolveGuestOutcome(guestId: GuestEffectResult["guestId"], rng: Rng): GuestOutcomeEffect {
  const config = GUEST_EFFECT_TABLE[guestId];
  if (!config.random) {
    return config.outcomes[0];
  }
  return pickEqualChanceOutcome(rng, [...config.outcomes]);
}

export function getGuestCheatEntries(): GuestCheatEntry[] {
  return GUEST_CHEAT_ORDER.map((guestId) => {
    const config = GUEST_EFFECT_TABLE[guestId];
    return {
      guestId,
      random: config.random,
      outcomes: config.outcomes,
    };
  });
}

export function applyRandomGuestEffect(state: GameState, rng: Rng): GuestEffectResult {
  const guestId = pickGuestByStress(state.stress, rng);
  const outcome = resolveGuestOutcome(guestId, rng);
  return {
    state: applyOutcome(state, outcome),
    guestId,
    effectKey: outcome.effectKey,
    outcomeId: outcome.outcomeId,
  };
}
