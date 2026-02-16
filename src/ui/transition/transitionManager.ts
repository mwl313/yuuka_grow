export type TransitionType = "slide" | "shutter" | "glitch";
export type TransitionDirection = "left" | "right";

interface TransitionOptions {
  type?: TransitionType;
  direction?: TransitionDirection;
  freezeFrame?: boolean;
  onMid?: () => void | Promise<void>;
}

const SLIDE_COVER_MS = 300;
const SLIDE_REVEAL_MS = 330;
const SHUTTER_CLOSE_MS = 240;
const SHUTTER_OPEN_MS = 280;
const FREEZE_MS = 100;
const GLITCH_TOTAL_MS = 360;
const FLASH_MS = 25;
const PRE_SHAKE_DURATION_MS = 260;

export class TransitionManager {
  private readonly overlay: HTMLDivElement;
  private readonly slidePanel: HTMLDivElement;
  private readonly slideLogo: HTMLImageElement;
  private readonly shutterLayer: HTMLDivElement;
  private readonly glitchLayer: HTMLDivElement;
  private readonly flashLayer: HTMLDivElement;
  private queue: Promise<void> = Promise.resolve();
  private freezeOverlay?: HTMLDivElement;
  private preShakeTarget?: HTMLElement;
  private preShakeToken = 0;
  private preShakeTimeoutId?: number;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.id = "transition-overlay";

    this.slidePanel = document.createElement("div");
    this.slidePanel.className = "transition-slide-panel";
    this.slideLogo = document.createElement("img");
    this.slideLogo.className = "transition-slide-logo";
    this.slideLogo.src = "/assets/boot/boot_gddlogo.webp";
    this.slideLogo.alt = "";
    this.slideLogo.setAttribute("aria-hidden", "true");
    this.slidePanel.append(this.slideLogo);

    this.shutterLayer = document.createElement("div");
    this.shutterLayer.className = "transition-shutter-layer";

    this.glitchLayer = document.createElement("div");
    this.glitchLayer.className = "transition-glitch-layer";

    this.flashLayer = document.createElement("div");
    this.flashLayer.className = "transition-flash-layer";

    this.overlay.append(this.slidePanel, this.shutterLayer, this.glitchLayer, this.flashLayer);
    document.body.append(this.overlay);
  }

  transitionTo(_screenId: string, opts?: TransitionOptions): Promise<void> {
    const options = opts ?? {};
    const task = async () => {
      const type = options.type ?? "slide";
      this.cancelPreShake();
      this.overlay.classList.add("transition--active", `transition--${type}`);
      try {
        if (type === "shutter") {
          await this.runShutterTransition(options.onMid, options.freezeFrame ?? true);
        } else if (type === "glitch") {
          await this.runGlitchTransition(options.onMid);
        } else {
          await this.runSlideTransition(options.direction ?? "left", options.onMid);
        }
      } finally {
        this.overlay.classList.remove("transition--active", "transition--slide", "transition--shutter", "transition--glitch");
        this.removeFreezeOverlay();
        this.slidePanel.style.transform = "";
        this.shutterLayer.style.transform = "";
        this.shutterLayer.style.opacity = "";
        this.glitchLayer.style.opacity = "";
        this.glitchLayer.style.transform = "";
        this.flashLayer.style.opacity = "";
      }
    };

    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async playPreShake(targetEl: HTMLElement, durationMs = PRE_SHAKE_DURATION_MS): Promise<void> {
    this.cancelPreShake();
    const token = ++this.preShakeToken;
    this.preShakeTarget = targetEl;
    targetEl.style.setProperty("--pre-shake-duration", `${durationMs}ms`);
    targetEl.classList.add("pre-shake-slow");

    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        targetEl.removeEventListener("animationend", onAnimationEnd);
        if (this.preShakeTimeoutId !== undefined) {
          window.clearTimeout(this.preShakeTimeoutId);
          this.preShakeTimeoutId = undefined;
        }
        resolve();
      };
      const onAnimationEnd = (event: AnimationEvent) => {
        if (event.animationName === "pre-shake-slow") {
          finish();
        }
      };
      targetEl.addEventListener("animationend", onAnimationEnd);
      this.preShakeTimeoutId = window.setTimeout(finish, durationMs + 34);
    });

    if (token !== this.preShakeToken) {
      return;
    }
    this.clearPreShakeState();
  }

  private async runSlideTransition(direction: TransitionDirection, onMid?: () => void | Promise<void>): Promise<void> {
    const startX = direction === "left" ? -100 : 100;
    const endX = -startX;

    this.slidePanel.style.transform = `translateX(${startX}%)`;
    await this.nextFrame();

    await this.waitAnimation(
      this.slidePanel.animate(
        [{ transform: `translateX(${startX}%)` }, { transform: "translateX(0%)" }],
        {
          duration: SLIDE_COVER_MS,
          easing: "cubic-bezier(0.42, 0, 0.58, 1)",
          fill: "forwards",
        },
      ),
    );

    if (onMid) {
      await onMid();
    }

    await this.waitAnimation(
      this.slidePanel.animate(
        [{ transform: "translateX(0%)" }, { transform: `translateX(${endX}%)` }],
        {
          duration: SLIDE_REVEAL_MS,
          easing: "cubic-bezier(0.42, 0, 0.58, 1)",
          fill: "forwards",
        },
      ),
    );
  }

  private async runShutterTransition(onMid?: () => void | Promise<void>, useFreezeFrame = true): Promise<void> {
    if (useFreezeFrame) {
      // Optional freeze-frame lead-in. Disabled for Game -> Ending where pre-shake is used.
      this.removeFreezeOverlay();
      this.freezeOverlay = this.captureFreezeFrame();
      document.body.append(this.freezeOverlay);
      await this.wait(FREEZE_MS);
    }

    this.shutterLayer.style.transform = "scaleY(0.02)";
    this.shutterLayer.style.opacity = "0";
    await this.nextFrame();

    await this.waitAnimation(
      this.shutterLayer.animate(
        [
          { transform: "scaleY(0.02)", opacity: 0 },
          { transform: "scaleY(1)", opacity: 1 },
        ],
        {
          duration: SHUTTER_CLOSE_MS,
          easing: "cubic-bezier(0.32, 0, 0.67, 1)",
          fill: "forwards",
        },
      ),
    );

    if (useFreezeFrame) {
      this.removeFreezeOverlay();
    }

    if (onMid) {
      await onMid();
    }

    await this.waitAnimation(
      this.shutterLayer.animate(
        [
          { transform: "scaleY(1)", opacity: 1 },
          { transform: "scaleY(0.02)", opacity: 0 },
        ],
        {
          duration: SHUTTER_OPEN_MS,
          easing: "cubic-bezier(0.32, 0, 0.67, 1)",
          fill: "forwards",
        },
      ),
    );
  }

  private async runGlitchTransition(onMid?: () => void | Promise<void>): Promise<void> {
    // Phase 1: flash + noisy cover, switch at midpoint, then reveal out.
    const midMs = Math.floor(GLITCH_TOTAL_MS / 2);
    const revealMs = GLITCH_TOTAL_MS - midMs;

    this.glitchLayer.style.opacity = "0";
    this.glitchLayer.style.transform = "translateX(0px)";
    this.flashLayer.style.opacity = "0";
    await this.nextFrame();

    this.waitAnimation(
      this.flashLayer.animate(
        [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }],
        {
          duration: FLASH_MS,
          easing: "linear",
          fill: "forwards",
        },
      ),
    ).catch(() => undefined);

    await this.waitAnimation(
      this.glitchLayer.animate(
        [
          { opacity: 0.15, transform: "translateX(0px)" },
          { opacity: 0.85, transform: "translateX(2px)" },
          { opacity: 0.8, transform: "translateX(-2px)" },
        ],
        {
          duration: midMs,
          easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
          fill: "forwards",
        },
      ),
    );

    if (onMid) {
      await onMid();
    }

    await this.waitAnimation(
      this.glitchLayer.animate(
        [
          { opacity: 0.8, transform: "translateX(0px)" },
          { opacity: 0.35, transform: "translateX(1px)" },
          { opacity: 0, transform: "translateX(0px)" },
        ],
        {
          duration: revealMs,
          easing: "cubic-bezier(0.32, 0, 0.67, 1)",
          fill: "forwards",
        },
      ),
    );
  }

  private captureFreezeFrame(): HTMLDivElement {
    const freeze = document.createElement("div");
    freeze.id = "transition-freeze-overlay";

    const sourceCanvas = document.querySelector<HTMLCanvasElement>("#render-host canvas");
    if (!sourceCanvas) {
      return freeze;
    }

    const viewportCanvas = document.createElement("canvas");
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(window.innerWidth * ratio));
    const height = Math.max(1, Math.floor(window.innerHeight * ratio));
    viewportCanvas.width = width;
    viewportCanvas.height = height;
    viewportCanvas.style.width = "100%";
    viewportCanvas.style.height = "100%";

    const ctx = viewportCanvas.getContext("2d");
    if (!ctx) {
      return freeze;
    }

    const rect = sourceCanvas.getBoundingClientRect();
    try {
      ctx.drawImage(
        sourceCanvas,
        rect.left * ratio,
        rect.top * ratio,
        rect.width * ratio,
        rect.height * ratio,
      );
    } catch {
      // Canvas capture can fail due to context restrictions on some browsers.
    }

    freeze.append(viewportCanvas);
    return freeze;
  }

  private removeFreezeOverlay(): void {
    if (!this.freezeOverlay) {
      return;
    }
    this.freezeOverlay.remove();
    this.freezeOverlay = undefined;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  private async waitAnimation(animation: Animation): Promise<void> {
    try {
      await animation.finished;
    } catch {
      // Ignore interrupted animation errors.
    }
  }

  private cancelPreShake(): void {
    this.preShakeToken += 1;
    if (this.preShakeTimeoutId !== undefined) {
      window.clearTimeout(this.preShakeTimeoutId);
      this.preShakeTimeoutId = undefined;
    }
    this.clearPreShakeState();
  }

  private clearPreShakeState(): void {
    if (this.preShakeTarget) {
      this.preShakeTarget.classList.remove("pre-shake-slow");
      this.preShakeTarget.style.removeProperty("--pre-shake-duration");
      this.preShakeTarget.style.transform = "";
    }
    this.preShakeTarget = undefined;
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}
