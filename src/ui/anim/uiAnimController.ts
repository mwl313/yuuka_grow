import { CounterAnimator, LogTypewriter, UiAnimator } from "./uiAnimator";

type CounterKey = "credits" | "stress" | "thigh";

interface CounterBinding {
  initialValue: number;
  onWrite: (value: number) => void;
}

interface UiAnimControllerOptions {
  counters: Record<CounterKey, CounterBinding>;
  charsPerSecond?: number;
  onLogLineFinished?: () => void;
}

export class UiAnimController {
  private readonly animator = new UiAnimator();
  private readonly counters: Record<CounterKey, CounterAnimator>;
  private readonly logTypewriter: LogTypewriter;
  private cooldownUntil = 0;

  constructor(options: UiAnimControllerOptions) {
    this.counters = {
      credits: new CounterAnimator(this.animator, options.counters.credits),
      stress: new CounterAnimator(this.animator, options.counters.stress),
      thigh: new CounterAnimator(this.animator, options.counters.thigh),
    };

    this.logTypewriter = new LogTypewriter(this.animator, {
      charsPerSecond: options.charsPerSecond ?? 60,
      onLineFinished: options.onLogLineFinished,
    });
  }

  isAnimating(): boolean {
    return (
      this.counters.credits.isAnimating() ||
      this.counters.stress.isAnimating() ||
      this.counters.thigh.isAnimating() ||
      this.logTypewriter.isActive()
    );
  }

  forceFinalizeAll(_reason: string): void {
    this.counters.credits.finalize();
    this.counters.stress.finalize();
    this.counters.thigh.finalize();
    this.logTypewriter.flushQueue();
  }

  setCooldown(ms: number): void {
    this.cooldownUntil = performance.now() + Math.max(0, ms);
  }

  isCooldownActive(): boolean {
    return performance.now() < this.cooldownUntil;
  }

  // If the user taps while UI animation is still running, force-finish first.
  // Cooldown is intentionally applied by caller after the current action render,
  // so the current action's fresh animations are not skipped.
  onActionUserInput(): boolean {
    if (!this.isAnimating()) return false;
    this.forceFinalizeAll("action");
    return true;
  }

  setCounterTarget(key: CounterKey, value: number): void {
    if (this.isCooldownActive()) {
      this.counters[key].setInstant(value);
      return;
    }
    this.counters[key].setTarget(value);
  }

  syncCounterText(): void {
    this.counters.credits.forceWrite();
    this.counters.stress.forceWrite();
    this.counters.thigh.forceWrite();
  }

  getCounterValue(key: CounterKey): number {
    return this.counters[key].getDisplayInt();
  }

  clearLogTypewriter(): void {
    this.logTypewriter.clear();
  }

  finalizeCurrentLogLine(): void {
    this.logTypewriter.finalizeCurrentLine();
  }

  appendLogLine(item: HTMLLIElement, text: string): void {
    if (this.isCooldownActive()) {
      item.textContent = text;
      item.classList.remove("log-line--typing");
      return;
    }
    this.logTypewriter.pushLine(item, text);
  }
}
