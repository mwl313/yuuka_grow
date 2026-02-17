export type DomWrite = () => void;

export interface UiAnimationTask {
  update(now: number, queueWrite: (write: DomWrite) => void): boolean;
}

export class UiAnimator {
  private readonly activeTasks = new Set<UiAnimationTask>();
  private readonly pendingWrites: DomWrite[] = [];
  private rafId: number | null = null;

  add(task: UiAnimationTask): void {
    this.activeTasks.add(task);
    this.ensureRunning();
  }

  remove(task: UiAnimationTask): void {
    this.activeTasks.delete(task);
  }

  clear(): void {
    this.activeTasks.clear();
    this.pendingWrites.length = 0;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private ensureRunning(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame((now) => this.tick(now));
  }

  private tick(now: number): void {
    this.rafId = null;
    if (this.activeTasks.size === 0) return;

    this.pendingWrites.length = 0;
    for (const task of [...this.activeTasks]) {
      const keepAlive = task.update(now, (write) => {
        this.pendingWrites.push(write);
      });
      if (!keepAlive) {
        this.activeTasks.delete(task);
      }
    }

    for (const write of this.pendingWrites) {
      write();
    }
    this.pendingWrites.length = 0;

    if (this.activeTasks.size > 0) {
      this.rafId = requestAnimationFrame((nextNow) => this.tick(nextNow));
    }
  }
}

interface CounterAnimatorOptions {
  initialValue: number;
  onWrite: (value: number) => void;
  minDurationMs?: number;
  maxDurationMs?: number;
}

export class CounterAnimator implements UiAnimationTask {
  private readonly animator: UiAnimator;
  private readonly onWrite: (value: number) => void;
  private readonly minDurationMs: number;
  private readonly maxDurationMs: number;

  private startValue: number;
  private displayValue: number;
  private targetValue: number;
  private startTime = 0;
  private durationMs = 0;
  private running = false;
  private lastRenderedInt: number;

  constructor(animator: UiAnimator, options: CounterAnimatorOptions) {
    this.animator = animator;
    this.onWrite = options.onWrite;
    this.minDurationMs = options.minDurationMs ?? 250;
    this.maxDurationMs = options.maxDurationMs ?? 700;
    this.startValue = options.initialValue;
    this.displayValue = options.initialValue;
    this.targetValue = Math.round(options.initialValue);
    this.lastRenderedInt = Math.round(options.initialValue);
  }

  setTarget(nextValue: number): void {
    const target = Math.round(nextValue);
    const now = performance.now();
    if (this.running) {
      this.displayValue = this.sample(now);
      this.startValue = this.displayValue;
    } else {
      this.startValue = this.displayValue;
    }

    this.targetValue = target;
    if (Math.round(this.displayValue) === target) {
      this.displayValue = target;
      this.running = false;
      if (this.lastRenderedInt !== target) {
        this.lastRenderedInt = target;
        this.onWrite(target);
      }
      return;
    }

    this.startTime = now;
    this.durationMs = this.computeDuration(this.startValue, target);
    this.running = true;
    this.animator.add(this);
  }

  setInstant(nextValue: number): void {
    const value = Math.round(nextValue);
    this.targetValue = value;
    this.startValue = value;
    this.displayValue = value;
    this.running = false;
    this.animator.remove(this);
    if (this.lastRenderedInt !== value) {
      this.lastRenderedInt = value;
      this.onWrite(value);
    }
  }

  getDisplayInt(): number {
    return Math.round(this.displayValue);
  }

  forceWrite(): void {
    const value = this.getDisplayInt();
    this.lastRenderedInt = value;
    this.onWrite(value);
  }

  isAnimating(): boolean {
    return this.running;
  }

  finalize(): void {
    this.running = false;
    this.displayValue = this.targetValue;
    this.startValue = this.targetValue;
    this.animator.remove(this);
    if (this.lastRenderedInt !== this.targetValue) {
      this.lastRenderedInt = this.targetValue;
      this.onWrite(this.targetValue);
    }
  }

  update(now: number, queueWrite: (write: DomWrite) => void): boolean {
    if (!this.running) return false;

    this.displayValue = this.sample(now);
    const rounded = Math.round(this.displayValue);
    if (rounded !== this.lastRenderedInt) {
      this.lastRenderedInt = rounded;
      queueWrite(() => this.onWrite(rounded));
    }

    if (now - this.startTime >= this.durationMs) {
      this.displayValue = this.targetValue;
      this.running = false;
      if (this.lastRenderedInt !== this.targetValue) {
        this.lastRenderedInt = this.targetValue;
        queueWrite(() => this.onWrite(this.targetValue));
      }
      return false;
    }

    return true;
  }

  private sample(now: number): number {
    if (!this.running || this.durationMs <= 0) return this.targetValue;
    const elapsed = Math.max(0, now - this.startTime);
    const t = Math.min(1, elapsed / this.durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    return this.startValue + (this.targetValue - this.startValue) * eased;
  }

  private computeDuration(from: number, to: number): number {
    const distance = Math.abs(to - from);
    const scaled = this.minDurationMs + Math.min(distance * 4, this.maxDurationMs - this.minDurationMs);
    return Math.max(this.minDurationMs, Math.min(this.maxDurationMs, scaled));
  }
}

interface LogTypewriterOptions {
  charsPerSecond?: number;
  onLineFinished?: () => void;
}

interface PendingLine {
  item: HTMLLIElement;
  text: string;
}

interface TypingLine {
  item: HTMLLIElement;
  text: string;
  startTime: number;
  renderedLength: number;
}

export class LogTypewriter implements UiAnimationTask {
  private readonly animator: UiAnimator;
  private readonly charsPerSecond: number;
  private readonly onLineFinished?: () => void;
  private readonly queue: PendingLine[] = [];
  private current: TypingLine | null = null;

  constructor(animator: UiAnimator, options?: LogTypewriterOptions) {
    this.animator = animator;
    this.charsPerSecond = options?.charsPerSecond ?? 60;
    this.onLineFinished = options?.onLineFinished;
  }

  pushLine(item: HTMLLIElement, text: string): void {
    this.queue.push({ item, text });
    if (!this.current) {
      this.startNext(performance.now());
      if (this.current) {
        this.animator.add(this);
      }
    }
  }

  finalizeCurrentLine(): void {
    if (!this.current) return;
    this.current.item.textContent = this.current.text;
    this.current.item.classList.remove("log-line--typing");
    this.current = null;
    this.onLineFinished?.();
    if (this.queue.length === 0) {
      this.animator.remove(this);
    }
  }

  clear(): void {
    this.finalizeCurrentLine();
    this.queue.length = 0;
    this.animator.remove(this);
  }

  flushQueue(): void {
    this.finalizeCurrentLine();
    for (const pending of this.queue) {
      pending.item.textContent = pending.text;
      pending.item.classList.remove("log-line--typing");
      this.onLineFinished?.();
    }
    this.queue.length = 0;
    this.animator.remove(this);
  }

  isActive(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  update(now: number, queueWrite: (write: DomWrite) => void): boolean {
    if (!this.current) return false;

    const elapsedSec = Math.max(0, now - this.current.startTime) / 1000;
    const nextLength = Math.min(this.current.text.length, Math.floor(elapsedSec * this.charsPerSecond));
    if (nextLength !== this.current.renderedLength) {
      this.current.renderedLength = nextLength;
      const item = this.current.item;
      const nextText = this.current.text.slice(0, nextLength);
      queueWrite(() => {
        item.textContent = nextText;
      });
    }

    if (nextLength >= this.current.text.length) {
      const completedItem = this.current.item;
      this.current = null;
      queueWrite(() => {
        completedItem.classList.remove("log-line--typing");
        this.onLineFinished?.();
      });
      this.startNext(now);
      return this.current !== null;
    }

    return true;
  }

  private startNext(now: number): void {
    const next = this.queue.shift();
    if (!next) return;
    next.item.classList.add("log-line--typing");
    this.current = {
      item: next.item,
      text: next.text,
      startTime: now,
      renderedLength: 0,
    };
  }
}
