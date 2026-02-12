import { DEFAULT_THEME_ID, THEME_SLICE_FALLBACK } from "../../core/constants";

interface ThemeConfig {
  id: string;
  slicePx: number;
  ui: {
    panel: string;
    buttonIdle: string;
    buttonHover: string;
    buttonPressed: string;
    modal: string;
  };
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`failed to load ${url}`));
    image.src = url;
  });
}

function applyThemeVars(config: ThemeConfig): void {
  const root = document.documentElement;
  root.style.setProperty("--theme-slice-px", String(config.slicePx || THEME_SLICE_FALLBACK));
  root.style.setProperty("--theme-panel-url", `url("${config.ui.panel}")`);
  root.style.setProperty("--theme-button-idle-url", `url("${config.ui.buttonIdle}")`);
  root.style.setProperty("--theme-button-hover-url", `url("${config.ui.buttonHover}")`);
  root.style.setProperty("--theme-button-pressed-url", `url("${config.ui.buttonPressed}")`);
  root.style.setProperty("--theme-modal-url", `url("${config.ui.modal}")`);
}

function setThemeReady(ready: boolean): void {
  document.documentElement.classList.toggle("theme-ready", ready);
  document.documentElement.classList.toggle("theme-fallback", !ready);
}

export async function applyTheme(themeId: string): Promise<void> {
  const safeThemeId = themeId || DEFAULT_THEME_ID;
  setThemeReady(false);

  try {
    const response = await fetch(`/themes/${safeThemeId}/theme.json`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("theme json missing");
    }

    const config = (await response.json()) as ThemeConfig;
    await Promise.all([
      preloadImage(config.ui.panel),
      preloadImage(config.ui.buttonIdle),
      preloadImage(config.ui.buttonHover),
      preloadImage(config.ui.buttonPressed),
      preloadImage(config.ui.modal),
    ]);

    applyThemeVars(config);
    setThemeReady(true);
  } catch {
    setThemeReady(false);
  }
}
