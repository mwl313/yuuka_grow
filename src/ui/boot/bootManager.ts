import "./boot.css";

const BOOT_BG_COLOR = "#000";
const FADE_IN_MS = 400;
const STABLE_MS = 200;
const BLINK_ON_MS = 120;
const BLINK_OFF_MS = 80;
const BLINK_REPEAT_COUNT = 2;
const BLINK_FINAL_ON_MS = 160;
const HOLD_BEFORE_DIVE_MS = 280;
const DIVE_MS = 480;
const LOGO_PRE_FADE_MS = 120;
const OVERLAY_FADE_OUT_MS = 150;
const DIVE_SCALE_FALLBACK = 4.4;
const PADDING_PX = 24;

const GAMEBOY_W = 694;
const GAMEBOY_H = 1151;
const HOLE_X = 160;
const HOLE_Y = 144;
const HOLE_W = 375;
const HOLE_H = 343;

const HOLE_LEFT_PCT = (HOLE_X / GAMEBOY_W) * 100;
const HOLE_TOP_PCT = (HOLE_Y / GAMEBOY_H) * 100;
const HOLE_WIDTH_PCT = (HOLE_W / GAMEBOY_W) * 100;
const HOLE_HEIGHT_PCT = (HOLE_H / GAMEBOY_H) * 100;
const HOLE_CENTER_X_PCT = ((HOLE_X + HOLE_W / 2) / GAMEBOY_W) * 100;
const HOLE_CENTER_Y_PCT = ((HOLE_Y + HOLE_H / 2) / GAMEBOY_H) * 100;

const FRAME_SRC = "/assets/boot/boot_gameboy.webp";
const LOGO_SRC = "/assets/boot/boot_gddlogo.webp";
const BEEP_MAIN_VOLUME = 0.045;
const BEEP_ATTACK_MS = 5;
const BEEP_RELEASE_MS = 10;

declare global {
  interface Window {
    __yuukaBootPlayed?: boolean;
    __yuukaBootRunning?: Promise<void>;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", done, { once: true });
  });
}

function isMasterMuted(): boolean {
  const maybeAnyWindow = window as unknown as Record<string, unknown>;
  const maybeConfig = maybeAnyWindow.__yuukaAudioConfig;
  if (maybeConfig && typeof maybeConfig === "object") {
    const muted = (maybeConfig as Record<string, unknown>).masterMuted;
    if (typeof muted === "boolean") return muted;
  }
  return false;
}

let bootAudioContext: AudioContext | null = null;

async function playBootBeep(frequencyHz: number, durationMs: number): Promise<void> {
  if (isMasterMuted()) return;

  try {
    const ctx =
      bootAudioContext ??
      new (window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    bootAudioContext = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const durationSec = durationMs / 1000;
    const attackSec = Math.min(BEEP_ATTACK_MS / 1000, durationSec * 0.4);
    const releaseSec = Math.min(BEEP_RELEASE_MS / 1000, durationSec * 0.5);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = frequencyHz;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(BEEP_MAIN_VOLUME, now + attackSec);
    gain.gain.setValueAtTime(BEEP_MAIN_VOLUME, now + Math.max(attackSec, durationSec - releaseSec));
    gain.gain.linearRampToValueAtTime(0, now + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.01);
  } catch {
    // Ignore autoplay / unsupported failures.
  }
}

function createBootOverlay(): {
  overlay: HTMLDivElement;
  wrap: HTMLDivElement;
  screen: HTMLDivElement;
  frameImage: HTMLImageElement;
  logoImage: HTMLImageElement;
} {
  const overlay = document.createElement("div");
  overlay.id = "boot-overlay";
  overlay.style.setProperty("--boot-bg-color", BOOT_BG_COLOR);
  overlay.style.setProperty("--boot-padding-px", `${PADDING_PX}px`);
  overlay.style.setProperty("--boot-fade-in-ms", `${FADE_IN_MS}ms`);
  overlay.style.setProperty("--boot-dive-ms", `${DIVE_MS}ms`);

  const wrap = document.createElement("div");
  wrap.className = "boot-gb-wrap";
  wrap.style.transformOrigin = `${HOLE_CENTER_X_PCT}% ${HOLE_CENTER_Y_PCT}%`;

  const frameImage = document.createElement("img");
  frameImage.className = "boot-gb-frame";
  frameImage.src = FRAME_SRC;
  frameImage.alt = "";
  frameImage.decoding = "async";
  frameImage.loading = "eager";

  const screen = document.createElement("div");
  screen.className = "boot-gb-screen";
  screen.style.left = `${HOLE_LEFT_PCT}%`;
  screen.style.top = `${HOLE_TOP_PCT}%`;
  screen.style.width = `${HOLE_WIDTH_PCT}%`;
  screen.style.height = `${HOLE_HEIGHT_PCT}%`;

  const screenContent = document.createElement("div");
  screenContent.className = "boot-gb-screen-content";

  const fill = document.createElement("div");
  fill.className = "boot-gb-screen-fill";

  const logoImage = document.createElement("img");
  logoImage.className = "boot-gb-logo";
  logoImage.src = LOGO_SRC;
  logoImage.alt = "";
  logoImage.decoding = "async";
  logoImage.loading = "eager";

  screenContent.append(fill, logoImage);
  screen.append(screenContent);
  wrap.append(screen, frameImage);
  overlay.append(wrap);

  return {
    overlay,
    wrap,
    screen,
    frameImage,
    logoImage,
  };
}

function setScreenOn(screen: HTMLDivElement, on: boolean): void {
  screen.classList.toggle("is-on", on);
}

async function waitAnimationDone(animation: Animation): Promise<void> {
  try {
    await animation.finished;
  } catch {
    // Ignore canceled/interrupted animation errors.
  }
}

async function runDiveTransition(params: {
  overlay: HTMLDivElement;
  wrap: HTMLDivElement;
  logoImage: HTMLImageElement;
}): Promise<void> {
  const { overlay, wrap, logoImage } = params;
  const overlayRect = overlay.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const logoRect = logoImage.getBoundingClientRect();
  const originY = wrapRect.top + (wrapRect.height * HOLE_CENTER_Y_PCT) / 100;

  // Solve s from: originY + (logoBottom - originY) * s = overlayBottom
  const denominator = logoRect.bottom - originY;
  const computedScale =
    denominator > 0
      ? (overlayRect.bottom - originY) / denominator
      : DIVE_SCALE_FALLBACK;
  const diveScale =
    Number.isFinite(computedScale) && computedScale > 1
      ? computedScale
      : DIVE_SCALE_FALLBACK;

  const wrapAnim = wrap.animate([{ transform: "scale(1)" }, { transform: `scale(${diveScale})` }], {
    duration: DIVE_MS,
    easing: "cubic-bezier(0.65, 0, 0.9, 0.35)",
    fill: "forwards",
  });
  await waitAnimationDone(wrapAnim);

  const logoFadeAnim = logoImage.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: LOGO_PRE_FADE_MS,
    easing: "ease-out",
    fill: "forwards",
  });
  await waitAnimationDone(logoFadeAnim);

  const overlayFadeAnim = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: OVERLAY_FADE_OUT_MS,
    easing: "ease",
    fill: "forwards",
  });
  await waitAnimationDone(overlayFadeAnim);
}

async function playBootSequence(): Promise<void> {
  const { overlay, wrap, screen, frameImage, logoImage } = createBootOverlay();
  document.body.append(overlay);

  try {
    await Promise.race([Promise.all([waitForImage(frameImage), waitForImage(logoImage)]), delay(1200)]);

    await nextFrame();
    wrap.classList.add("is-visible");
    await delay(FADE_IN_MS);
    await delay(STABLE_MS);
    setScreenOn(screen, false);

    for (let i = 0; i < BLINK_REPEAT_COUNT; i += 1) {
      setScreenOn(screen, true);
      if (i === 0) {
        void playBootBeep(880, 60);
      }
      await delay(BLINK_ON_MS);
      setScreenOn(screen, false);
      await delay(BLINK_OFF_MS);
    }

    setScreenOn(screen, true);
    void playBootBeep(660, 90);
    await delay(BLINK_FINAL_ON_MS);
    await delay(HOLD_BEFORE_DIVE_MS);

    await runDiveTransition({ overlay, wrap, logoImage });
  } finally {
    overlay.remove();
  }
}

export async function maybeRunBootThen(onComplete: () => void): Promise<void> {
  if (window.__yuukaBootPlayed) {
    onComplete();
    return;
  }

  if (!window.__yuukaBootRunning) {
    window.__yuukaBootRunning = (async () => {
      await playBootSequence();
      window.__yuukaBootPlayed = true;
    })().finally(() => {
      window.__yuukaBootRunning = undefined;
    });
  }

  await window.__yuukaBootRunning;
  onComplete();
}
