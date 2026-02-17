const DEFAULT_ENTER_CLASS = "overlay--enter-rise";
const DEFAULT_EXIT_CLASS = "overlay--exit-fall";
const DEFAULT_DURATION_MS = 520;

const hideTimers = new WeakMap<HTMLElement, number>();

interface PanelTransitionOptions {
  enterClass?: string;
  exitClass?: string;
  durationMs?: number;
}

function resolveEnterClass(options?: PanelTransitionOptions): string {
  return options?.enterClass ?? DEFAULT_ENTER_CLASS;
}

function resolveExitClass(options?: PanelTransitionOptions): string {
  return options?.exitClass ?? DEFAULT_EXIT_CLASS;
}

function resolveDurationMs(options?: PanelTransitionOptions): number {
  return options?.durationMs ?? DEFAULT_DURATION_MS;
}

function clearHideTimer(overlay: HTMLElement): void {
  const existing = hideTimers.get(overlay);
  if (existing !== undefined) {
    window.clearTimeout(existing);
    hideTimers.delete(overlay);
  }
}

export function clearPanelTransition(overlay: HTMLElement, options?: PanelTransitionOptions): void {
  clearHideTimer(overlay);
  overlay.classList.remove(resolveEnterClass(options), resolveExitClass(options));
}

export function showPanelWithTransition(overlay: HTMLElement, options?: PanelTransitionOptions): void {
  clearPanelTransition(overlay, options);
  overlay.classList.remove("hidden");
  const enterClass = resolveEnterClass(options);
  // Force reflow to restart transition on repeated openings.
  void overlay.offsetWidth;
  overlay.classList.add(enterClass);
}

export function hidePanelWithTransition(overlay: HTMLElement, options?: PanelTransitionOptions): void {
  if (overlay.classList.contains("hidden")) {
    clearPanelTransition(overlay, options);
    return;
  }

  clearHideTimer(overlay);
  const enterClass = resolveEnterClass(options);
  const exitClass = resolveExitClass(options);
  overlay.classList.remove(enterClass);
  overlay.classList.add(exitClass);

  const timer = window.setTimeout(() => {
    overlay.classList.add("hidden");
    overlay.classList.remove(exitClass);
    hideTimers.delete(overlay);
  }, resolveDurationMs(options));
  hideTimers.set(overlay, timer);
}
