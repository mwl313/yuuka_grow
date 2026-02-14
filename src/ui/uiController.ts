import { applyEat, applyGuest, applyWork } from "../core/actions";
import { APP_VERSION, AUTHOR_NAME, IP_LABEL, VOLUME_STEP } from "../core/constants";
import { checkImmediateBankrupt } from "../core/endings";
import { decodeLog } from "../core/logger";
import { defaultRng } from "../core/rng";
import { getComparisonKind, getStage } from "../core/stage";
import { createInitialState } from "../core/state";
import type { GameState, LanguageCode, RunResult, SaveData, Settings, StepResult } from "../core/types";
import { formatNumber, getLanguage, onLanguageChange, setLanguage, t } from "../i18n";
import { YuukaRenderer } from "../render/yuukaRenderer";
import { parseShareQuery, buildShareRelativeUrl } from "../share/shareLink";
import { loadSaveData, recordRunResult, saveData } from "../storage/save";
import { loadSettings, saveSettings } from "../storage/settings";
import { applyTheme } from "./theme/themeManager";

type ScreenId = "lobby" | "game" | "score";

interface UiRefs {
  lobby: HTMLElement;
  game: HTMLElement;
  score: HTMLElement;
  settingsModal: HTMLElement;
  endingOverlay: HTMLElement;
  btnStart: HTMLButtonElement;
  btnSettings: HTMLButtonElement;
  btnLeaderboard: HTMLButtonElement;
  btnCloseSettings: HTMLButtonElement;
  btnWork: HTMLButtonElement;
  btnEat: HTMLButtonElement;
  btnGuest: HTMLButtonElement;
  btnContinue: HTMLButtonElement;
  btnRetry: HTMLButtonElement;
  btnBack: HTMLButtonElement;
  btnShare: HTMLButtonElement;
  hudDay: HTMLElement;
  hudCredits: HTMLElement;
  hudStress: HTMLElement;
  hudThigh: HTMLElement;
  hudStage: HTMLElement;
  hudCompare: HTMLElement;
  hudActions: HTMLElement;
  logs: HTMLUListElement;
  endingTitle: HTMLElement;
  endingDesc: HTMLElement;
  scoreEnding: HTMLElement;
  scoreThigh: HTMLElement;
  scoreDay: HTMLElement;
  scoreCredits: HTMLElement;
  scoreStress: HTMLElement;
  bgmRange: HTMLInputElement;
  sfxRange: HTMLInputElement;
  themeSelect: HTMLSelectElement;
  languageLabel: HTMLElement;
  languageSelect: HTMLSelectElement;
}

function wireButtonState(button: HTMLButtonElement): void {
  button.classList.add("idle");
  button.addEventListener("pointerdown", () => button.classList.add("pressed"));
  const clearPressed = () => button.classList.remove("pressed");
  button.addEventListener("pointerup", clearPressed);
  button.addEventListener("pointerleave", clearPressed);
}

function ensureValidOngoingState(data: SaveData): SaveData {
  const bankrupt = checkImmediateBankrupt(data.state);
  if (!bankrupt) return data;
  return {
    ...data,
    state: createInitialState(),
  };
}

export class UiController {
  private readonly root: HTMLElement;
  private readonly refs: UiRefs;
  private renderer: YuukaRenderer | null = null;
  private state: GameState;
  private save: SaveData;
  private settings: Settings;
  private latestResult: RunResult | null = null;
  private activeScreen: ScreenId = "lobby";

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = this.buildLayout();
    this.refs = this.collectRefs();
    this.save = ensureValidOngoingState(loadSaveData());
    this.state = this.save.state;
    this.settings = loadSettings();

    this.applyLabels();
    this.bindEvents();
    this.syncSettingsUi();
    this.renderGameUi();
    this.showScreen("lobby");
    void applyTheme(this.settings.themeId);
    onLanguageChange(() => this.handleLanguageChanged());
    saveData(this.save);
  }

  private buildLayout(): string {
    return `
      <div class="app-shell font-plain">
        <section id="screen-lobby" class="screen">
          <div class="skin-panel lobby-card">
            <h1 id="lobby-title" class="font-title"></h1>
            <p id="lobby-version"></p>
            <div class="stack-buttons">
              <img id="lobby-dance" class="lobby-dance" src="/assets/lobby/yuuka_dance.gif" alt="" />
              <button id="btn-start" class="skin-button font-title"></button>
              <button id="btn-settings" class="skin-button font-title"></button>
              <button id="btn-leaderboard" class="skin-button font-title"></button>
            </div>
            <p id="lobby-disclaimer" class="lobby-disclaimer"></p>
            <p id="lobby-credits" class="lobby-foot"></p>
            <p id="lobby-ip" class="lobby-foot"></p>
          </div>
        </section>

        <section id="screen-game" class="screen">
          <div class="skin-panel hud-grid">
            <span id="hud-day"></span>
            <span id="hud-credits"></span>
            <span id="hud-stress"></span>
            <span id="hud-thigh"></span>
            <span id="hud-stage" class="hud-accent"></span>
            <span id="hud-compare" class="hud-accent"></span>
            <span id="hud-actions"></span>
          </div>

          <div id="render-host" class="skin-panel render-host"></div>

          <div class="skin-panel log-panel">
            <h2 id="log-title" class="font-title"></h2>
            <ul id="log-list"></ul>
          </div>

          <div class="game-controls">
            <button id="btn-work" class="skin-button font-title"></button>
            <button id="btn-eat" class="skin-button font-title"></button>
            <button id="btn-guest" class="skin-button font-title"></button>
          </div>
        </section>

        <section id="screen-score" class="screen">
          <div class="skin-panel score-card">
            <h2 id="score-title" class="font-title"></h2>
            <ul class="score-list">
              <li class="score-row"><span class="score-label" id="score-label-ending"></span><span class="score-value" id="score-ending"></span></li>
              <li class="score-row"><span class="score-label" id="score-label-thigh"></span><span class="score-value" id="score-thigh"></span></li>
              <li class="score-row"><span class="score-label" id="score-label-day"></span><span class="score-value" id="score-day"></span></li>
              <li class="score-row"><span class="score-label" id="score-label-credits"></span><span class="score-value" id="score-credits"></span></li>
              <li class="score-row"><span class="score-label" id="score-label-stress"></span><span class="score-value" id="score-stress"></span></li>
            </ul>
            <div class="stack-buttons">
              <button id="btn-retry" class="skin-button font-title"></button>
              <button id="btn-back" class="skin-button font-title"></button>
              <button id="btn-share" class="skin-button font-title"></button>
            </div>
          </div>
        </section>

        <div id="ending-overlay" class="overlay hidden">
          <div class="skin-panel modal-card">
            <h2 id="ending-title" class="font-title"></h2>
            <p id="ending-desc"></p>
            <button id="btn-continue" class="skin-button font-title"></button>
          </div>
        </div>

        <div id="settings-modal" class="overlay hidden">
          <div class="skin-panel modal-card">
            <h2 id="settings-title" class="font-title"></h2>
            <label class="settings-row">
              <span id="settings-bgm"></span>
              <input id="settings-bgm-range" type="range" min="0" max="1" step="${VOLUME_STEP}" />
            </label>
            <label class="settings-row">
              <span id="settings-sfx"></span>
              <input id="settings-sfx-range" type="range" min="0" max="1" step="${VOLUME_STEP}" />
            </label>
            <label class="settings-row">
              <span id="settings-theme"></span>
              <select id="settings-theme-select">
                <option value="default"></option>
              </select>
            </label>
            <label class="settings-row">
              <span id="settings-language"></span>
              <select id="settings-language-select">
                <option value="ko"></option>
                <option value="en"></option>
                <option value="ja"></option>
              </select>
            </label>
            <button id="btn-close-settings" class="skin-button font-title"></button>
          </div>
        </div>
      </div>
    `;
  }

  private collectRefs(): UiRefs {
    const pick = <T extends HTMLElement>(id: string): T => {
      const target = this.root.querySelector<T>(`#${id}`);
      if (!target) throw new Error(`missing element ${id}`);
      return target;
    };

    return {
      lobby: pick("screen-lobby"),
      game: pick("screen-game"),
      score: pick("screen-score"),
      settingsModal: pick("settings-modal"),
      endingOverlay: pick("ending-overlay"),
      btnStart: pick("btn-start"),
      btnSettings: pick("btn-settings"),
      btnLeaderboard: pick("btn-leaderboard"),
      btnCloseSettings: pick("btn-close-settings"),
      btnWork: pick("btn-work"),
      btnEat: pick("btn-eat"),
      btnGuest: pick("btn-guest"),
      btnContinue: pick("btn-continue"),
      btnRetry: pick("btn-retry"),
      btnBack: pick("btn-back"),
      btnShare: pick("btn-share"),
      hudDay: pick("hud-day"),
      hudCredits: pick("hud-credits"),
      hudStress: pick("hud-stress"),
      hudThigh: pick("hud-thigh"),
      hudStage: pick("hud-stage"),
      hudCompare: pick("hud-compare"),
      hudActions: pick("hud-actions"),
      logs: pick("log-list"),
      endingTitle: pick("ending-title"),
      endingDesc: pick("ending-desc"),
      scoreEnding: pick("score-ending"),
      scoreThigh: pick("score-thigh"),
      scoreDay: pick("score-day"),
      scoreCredits: pick("score-credits"),
      scoreStress: pick("score-stress"),
      bgmRange: pick("settings-bgm-range"),
      sfxRange: pick("settings-sfx-range"),
      themeSelect: pick("settings-theme-select"),
      languageLabel: pick("settings-language"),
      languageSelect: pick("settings-language-select"),
    };
  }

  private applyLabels(): void {
    this.setText("lobby-title", t("app.title"));
    this.setText("lobby-version", t("lobby.version", { version: APP_VERSION }));
    this.setText("lobby-disclaimer", t("lobby.disclaimer"));
    this.setText("lobby-credits", t("lobby.credits", { author: AUTHOR_NAME }));
    this.setText("lobby-ip", t("lobby.ip", { ip: IP_LABEL }));

    this.refs.btnStart.textContent = t("menu.start");
    this.refs.btnSettings.textContent = t("menu.options");
    this.refs.btnLeaderboard.textContent = t("lobby.btnLeaderboard");
    this.refs.btnWork.textContent = t("game.action.work");
    this.refs.btnEat.textContent = t("game.action.eat");
    this.refs.btnGuest.textContent = t("game.action.guest");
    this.refs.btnContinue.textContent = t("ending.continue");
    this.refs.btnRetry.textContent = t("score.btnRetry");
    this.refs.btnBack.textContent = t("score.btnBack");
    this.refs.btnShare.textContent = t("result.share");
    this.refs.btnCloseSettings.textContent = t("settings.close");

    this.setText("settings-title", t("options.title"));
    this.setText("settings-bgm", t("settings.bgm"));
    this.setText("settings-sfx", t("settings.sfx"));
    this.setText("settings-theme", t("settings.theme"));
    this.refs.languageLabel.textContent = t("options.language.label");
    this.setSelectOptionText(this.refs.languageSelect, "ko", t("options.language.ko"));
    this.setSelectOptionText(this.refs.languageSelect, "en", t("options.language.en"));
    this.setSelectOptionText(this.refs.languageSelect, "ja", t("options.language.ja"));
    this.refs.themeSelect.options[0].textContent = t("settings.themeDefault");

    this.setText("score-title", t("result.title"));
    this.setText("score-label-ending", t("result.ending"));
    this.setText("score-label-thigh", t("result.finalThigh"));
    this.setText("score-label-day", t("result.dayReached"));
    this.setText("score-label-credits", t("result.finalCredits"));
    this.setText("score-label-stress", t("result.finalStress"));
    this.setText("log-title", t("log.title"));
  }

  private bindEvents(): void {
    [
      this.refs.btnStart,
      this.refs.btnSettings,
      this.refs.btnLeaderboard,
      this.refs.btnCloseSettings,
      this.refs.btnWork,
      this.refs.btnEat,
      this.refs.btnGuest,
      this.refs.btnContinue,
      this.refs.btnRetry,
      this.refs.btnBack,
      this.refs.btnShare,
    ].forEach(wireButtonState);

    this.refs.btnStart.addEventListener("click", () => this.startGame());
    this.refs.btnSettings.addEventListener("click", () => this.openSettings(true));
    this.refs.btnLeaderboard.addEventListener("click", () => this.openLeaderboardStub());
    this.refs.btnCloseSettings.addEventListener("click", () => this.openSettings(false));
    this.refs.btnWork.addEventListener("click", () => this.handleStep(applyWork(this.state)));
    this.refs.btnEat.addEventListener("click", () => this.handleStep(applyEat(this.state)));
    this.refs.btnGuest.addEventListener("click", () => this.handleStep(applyGuest(this.state, defaultRng)));
    this.refs.btnContinue.addEventListener("click", () => {
      this.toggleEnding(false);
      this.showScreen("score");
      this.renderScore();
    });
    this.refs.btnRetry.addEventListener("click", () => this.retryGame());
    this.refs.btnBack.addEventListener("click", () => this.showScreen("lobby"));
    this.refs.btnShare.addEventListener("click", () => this.shareResult());

    this.refs.bgmRange.addEventListener("input", () => this.updateSettingsFromInputs());
    this.refs.sfxRange.addEventListener("input", () => this.updateSettingsFromInputs());
    this.refs.themeSelect.addEventListener("change", () => this.updateSettingsFromInputs());
    this.refs.languageSelect.addEventListener("change", () => this.updateSettingsFromInputs());
  }

  private syncSettingsUi(): void {
    this.refs.bgmRange.value = String(this.settings.bgmVolume);
    this.refs.sfxRange.value = String(this.settings.sfxVolume);
    this.refs.themeSelect.value = this.settings.themeId;
    this.refs.languageSelect.value = this.settings.language;
  }

  private updateSettingsFromInputs(): void {
    const language = this.normalizeLanguage(this.refs.languageSelect.value);
    this.settings = {
      bgmVolume: Number(this.refs.bgmRange.value),
      sfxVolume: Number(this.refs.sfxRange.value),
      themeId: this.refs.themeSelect.value,
      language,
    };
    setLanguage(language);
    saveSettings(this.settings);
    void applyTheme(this.settings.themeId);
  }

  private startGame(): void {
    this.resetForNewRun();
    this.showScreen("game");
    this.ensureRenderer();
    this.renderGameUi();
    this.toggleEnding(false);
  }

  private retryGame(): void {
    this.startGame();
  }

  private resetForNewRun(): void {
    this.state = createInitialState();
    this.latestResult = null;
    this.save = {
      ...this.save,
      state: this.state,
    };
    saveData(this.save);
  }

  private openSettings(open: boolean): void {
    this.refs.settingsModal.classList.toggle("hidden", !open);
  }

  private openLeaderboardStub(): void {
    window.alert(t("lobby.leaderboardStub"));
  }

  private showScreen(screen: ScreenId): void {
    this.activeScreen = screen;
    this.refs.lobby.classList.toggle("active", screen === "lobby");
    this.refs.game.classList.toggle("active", screen === "game");
    this.refs.score.classList.toggle("active", screen === "score");
  }

  private ensureRenderer(): void {
    if (this.renderer) return;
    this.renderer = new YuukaRenderer("render-host");
  }

  private handleStep(result: StepResult): void {
    if (this.activeScreen !== "game") return;
    this.state = result.state;
    this.renderGameUi();

    if (result.ended) {
      this.onEnded(result.ended);
      return;
    }

    if (result.dayEnded) {
      this.save = {
        ...this.save,
        state: this.state,
      };
      saveData(this.save);
    }
  }

  private onEnded(runResult: RunResult): void {
    this.latestResult = runResult;
    this.save = recordRunResult(
      {
        ...this.save,
        state: this.state,
      },
      runResult,
    );
    saveData(this.save);
    this.refs.endingTitle.textContent = t(`ending.${runResult.endingId}.title`);
    this.refs.endingDesc.textContent = t(`ending.${runResult.endingId}.desc`);
    this.toggleEnding(true);
  }

  private toggleEnding(open: boolean): void {
    this.refs.endingOverlay.classList.toggle("hidden", !open);
    this.refs.btnWork.disabled = open;
    this.refs.btnEat.disabled = open;
    this.refs.btnGuest.disabled = open;
  }

  private renderGameUi(): void {
    const stage = getStage(this.state.thighCm);
    const comparison = getComparisonKind(stage);

    this.refs.hudDay.textContent = t("hud.day", { day: this.state.day });
    this.refs.hudCredits.textContent = t("hud.credits", { credits: formatNumber(this.state.money) });
    this.refs.hudStress.textContent = t("hud.stress", { stress: this.state.stress });
    this.refs.hudThigh.textContent = t("hud.thighCm", { thigh: Math.round(this.state.thighCm) });
    this.refs.hudStage.textContent = t("hud.stage", { stage });
    this.refs.hudCompare.textContent = comparison
      ? t("hud.compare", { target: t(`render.compare.${comparison}`) })
      : t("hud.compareNone");
    this.refs.hudActions.textContent = t("hud.actions", {
      actions: this.state.actionsRemaining,
    });

    this.refs.btnWork.disabled = this.state.actionsRemaining <= 0;
    this.refs.btnEat.disabled = this.state.actionsRemaining <= 0;
    this.refs.btnGuest.disabled = this.state.actionsRemaining <= 0;

    this.renderLogs();
    this.renderer?.render(this.state);
  }

  private renderLogs(): void {
    this.refs.logs.innerHTML = "";
    if (this.state.logs.length === 0) {
      const empty = document.createElement("li");
      empty.className = "log-empty";
      empty.textContent = t("log.empty");
      this.refs.logs.append(empty);
      this.scrollLogsToBottom();
      return;
    }

    for (const line of this.state.logs) {
      const item = document.createElement("li");
      item.className = "log-line";
      item.textContent = this.formatLogLine(line);
      this.refs.logs.append(item);
    }

    this.scrollLogsToBottom();
  }

  private scrollLogsToBottom(): void {
    requestAnimationFrame(() => {
      this.refs.logs.scrollTop = this.refs.logs.scrollHeight;
    });
  }

  private formatLogLine(line: string): string {
    const payload = decodeLog(line);
    if (!payload) return line;
    const params = payload.params ?? {};

    if (payload.key === "log.work") {
      return t(payload.key, {
        credits: formatNumber(Number(params.credits)),
        stress: Number(params.stress),
      });
    }

    if (payload.key === "log.workNoa") {
      return t(payload.key, {
        credits: formatNumber(Number(params.credits)),
        stress: Number(params.stress),
        charges: Number(params.charges),
      });
    }

    if (payload.key === "log.eat") {
      return t(payload.key, {
        credits: formatNumber(Number(params.credits)),
        thigh: Number(params.thigh),
        stress: Number(params.stress),
      });
    }

    if (payload.key === "log.guest") {
      const nameKey = String(params.nameKey ?? "");
      const effectKey = String(params.effectKey ?? "");
      return t(payload.key, {
        name: t(nameKey),
        effect: t(effectKey),
      });
    }

    return t(payload.key, params);
  }

  private renderScore(): void {
    if (!this.latestResult) return;
    this.refs.scoreEnding.textContent = t(`ending.${this.latestResult.endingId}.title`);
    this.refs.scoreThigh.textContent = t("format.cm", {
      value: formatNumber(this.latestResult.finalThighCm),
    });
    this.refs.scoreDay.textContent = t("format.day", {
      value: formatNumber(this.latestResult.dayReached),
    });
    this.refs.scoreCredits.textContent = t("format.credits", {
      value: formatNumber(this.latestResult.finalMoney),
    });
    this.refs.scoreStress.textContent = formatNumber(this.latestResult.finalStress);
  }

  private shareResult(): void {
    if (!this.latestResult) return;
    const url = buildShareRelativeUrl(this.latestResult);
    if (!parseShareQuery(url.split("?")[1] ? `?${url.split("?")[1]}` : "")) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      void navigator.clipboard.writeText(url);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  private setText(id: string, value: string): void {
    const target = this.root.querySelector<HTMLElement>(`#${id}`);
    if (target) target.textContent = value;
  }

  private normalizeLanguage(value: string): LanguageCode {
    if (value === "ko" || value === "ja" || value === "en") return value;
    return getLanguage();
  }

  private setSelectOptionText(select: HTMLSelectElement, value: string, text: string): void {
    const option = [...select.options].find((item) => item.value === value);
    if (option) {
      option.textContent = text;
    }
  }

  private handleLanguageChanged(): void {
    this.settings = {
      ...this.settings,
      language: getLanguage(),
    };
    saveSettings(this.settings);
    this.applyLabels();
    this.syncSettingsUi();
    this.renderGameUi();
    if (this.latestResult) {
      this.renderScore();
      this.refs.endingTitle.textContent = t(`ending.${this.latestResult.endingId}.title`);
      this.refs.endingDesc.textContent = t(`ending.${this.latestResult.endingId}.desc`);
    }
  }
}
