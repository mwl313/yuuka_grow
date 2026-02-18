export const SPIN_TOTAL_MS = 1500;
export const STOP_MS = [900, 1200, 1500] as const;
export const INTERVAL_MIN = 60;
export const INTERVAL_MAX = 240;

type RenderMode = "spin" | "final";

interface CardSpinControllerOptions<T> {
  createDecoy: (slotIndex: number) => T;
  renderSlot: (slotIndex: number, card: T, mode: RenderMode) => void;
  onSpinningStateChange?: (spinning: boolean) => void;
  onAllStopped?: () => void;
  onTick?: () => void;
  onStop?: (slotIndex: number) => void;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export class CardSpinController<T> {
  private readonly options: CardSpinControllerOptions<T>;
  private finalCards: T[] = [];
  private isSpinning = false;
  private stoppedSlots: boolean[] = [];
  private spinStartAt = 0;
  private updateTimers: Array<number | undefined> = [];
  private stopTimers: Array<number | undefined> = [];
  private lastTickAt = 0;

  constructor(options: CardSpinControllerOptions<T>) {
    this.options = options;
  }

  isSpinningNow(): boolean {
    return this.isSpinning;
  }

  startSpin(finalCards: T[]): void {
    this.cancelSpinTimers();
    this.finalCards = [...finalCards];
    this.isSpinning = true;
    this.stoppedSlots = this.finalCards.map(() => false);
    this.spinStartAt = performance.now();
    this.lastTickAt = 0;
    this.options.onSpinningStateChange?.(true);

    const slotCount = Math.min(this.finalCards.length, STOP_MS.length);
    for (let i = 0; i < slotCount; i += 1) {
      this.scheduleUpdate(i);
      this.stopTimers[i] = window.setTimeout(() => {
        this.stopSlot(i);
      }, STOP_MS[i]);
    }
  }

  revealFinal(): void {
    if (!this.isSpinning) return;
    const finalCards = [...this.finalCards];
    this.cancelSpinTimers();
    this.isSpinning = false;
    this.options.onSpinningStateChange?.(false);

    for (let i = 0; i < finalCards.length; i += 1) {
      this.options.renderSlot(i, finalCards[i], "final");
      this.options.onStop?.(i);
    }
    this.options.onAllStopped?.();
  }

  stop(): void {
    if (!this.isSpinning) return;
    this.cancelSpinTimers();
    this.isSpinning = false;
    this.options.onSpinningStateChange?.(false);
  }

  cancelSpinTimers(): void {
    for (const timer of this.updateTimers) {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    }
    for (const timer of this.stopTimers) {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    }
    this.updateTimers = [];
    this.stopTimers = [];
  }

  private scheduleUpdate(slotIndex: number): void {
    if (!this.isSpinning) return;
    if (this.stoppedSlots[slotIndex]) return;
    const stopAt = STOP_MS[slotIndex] ?? SPIN_TOTAL_MS;
    const now = performance.now();
    const elapsed = now - this.spinStartAt;
    if (elapsed >= stopAt) {
      return;
    }

    const decoy = this.options.createDecoy(slotIndex);
    this.options.renderSlot(slotIndex, decoy, "spin");
    if (now - this.lastTickAt >= 120) {
      this.lastTickAt = now;
      this.options.onTick?.();
    }

    const progress = Math.max(0, Math.min(1, elapsed / stopAt));
    const interval = lerp(INTERVAL_MIN, INTERVAL_MAX, progress * progress);
    this.updateTimers[slotIndex] = window.setTimeout(() => {
      this.scheduleUpdate(slotIndex);
    }, interval);
  }

  private stopSlot(slotIndex: number): void {
    if (!this.isSpinning) return;
    if (this.stoppedSlots[slotIndex]) return;
    this.stoppedSlots[slotIndex] = true;

    const updateTimer = this.updateTimers[slotIndex];
    if (updateTimer !== undefined) {
      window.clearTimeout(updateTimer);
      this.updateTimers[slotIndex] = undefined;
    }

    const finalCard = this.finalCards[slotIndex];
    if (finalCard) {
      this.options.renderSlot(slotIndex, finalCard, "final");
      this.options.onStop?.(slotIndex);
    }

    const allStopped = this.stoppedSlots.every((item) => item);
    if (!allStopped) return;
    this.cancelSpinTimers();
    this.isSpinning = false;
    this.options.onSpinningStateChange?.(false);
    this.options.onAllStopped?.();
  }
}
