import { buildShareUrl, fetchLeaderboard, submitRun } from "../api/leaderboardApi";
import type { LeaderboardItem, LeaderboardSort, RankEntry } from "../api/leaderboardApi";
import { applyEat, applyGuest, applyWork } from "../core/actions";
import { APP_VERSION, AUTHOR_NAME, DEFAULT_NICKNAME, IP_LABEL, VOLUME_STEP } from "../core/constants";
import { checkImmediateBankrupt } from "../core/endings";
import { decodeLog } from "../core/logger";
import { defaultRng } from "../core/rng";
import { getStage } from "../core/stage";
import { createInitialState } from "../core/state";
import type { GameState, LanguageCode, RunResult, SaveData, Settings, StepResult } from "../core/types";
import { formatNumber, getLanguage, onLanguageChange, setLanguage, t } from "../i18n";
import { YuukaRenderer } from "../render/yuukaRenderer";
import { loadSaveData, recordRunResult, saveData } from "../storage/save";
import { loadSettings, saveSettings } from "../storage/settings";

type ScreenId = "lobby" | "game" | "score" | "leaderboard";

interface UiRefs {
  lobby: HTMLElement;
  game: HTMLElement;
  score: HTMLElement;
  leaderboard: HTMLElement;
  settingsModal: HTMLElement;
  nicknameModal: HTMLElement;
  endingOverlay: HTMLElement;
  btnStart: HTMLButtonElement;
  btnSettings: HTMLButtonElement;
  btnNickname: HTMLButtonElement;
  btnLeaderboard: HTMLButtonElement;
  btnCloseSettings: HTMLButtonElement;
  btnNicknameApply: HTMLButtonElement;
  btnNicknameCancel: HTMLButtonElement;
  nicknameInput: HTMLInputElement;
  btnWork: HTMLButtonElement;
  btnEat: HTMLButtonElement;
  btnGuest: HTMLButtonElement;
  btnContinue: HTMLButtonElement;
  btnRetry: HTMLButtonElement;
  btnBack: HTMLButtonElement;
  btnUploadShare: HTMLButtonElement;
  uploadResultOverlay: HTMLElement;
  btnUploadResultClose: HTMLButtonElement;
  btnUploadResultShare: HTMLButtonElement;
  btnUploadResultLobby: HTMLButtonElement;
  btnLeaderSortCredit: HTMLButtonElement;
  btnLeaderSortThigh: HTMLButtonElement;
  btnLeaderBack: HTMLButtonElement;
  btnMiniLobby: HTMLButtonElement;
  btnMiniSound: HTMLButtonElement;
  hudDay: HTMLElement;
  hudCredits: HTMLElement;
  hudStress: HTMLElement;
  hudThigh: HTMLElement;
  hudStage: HTMLElement;
  hudActions: HTMLElement;
  logs: HTMLUListElement;
  endingTitle: HTMLElement;
  endingDesc: HTMLElement;
  scoreEnding: HTMLElement;
  scoreThigh: HTMLElement;
  scoreDay: HTMLElement;
  scoreCredits: HTMLElement;
  scoreStress: HTMLElement;
  scoreRankCreditPopup: HTMLElement;
  scoreRankThighPopup: HTMLElement;
  scoreUploadStatus: HTMLElement;
  lobbyNickname: HTMLElement;
  leaderboardStatus: HTMLElement;
  leaderboardBody: HTMLTableSectionElement;
  bgmRange: HTMLInputElement;
  sfxRange: HTMLInputElement;
  voiceRange: HTMLInputElement;
  languageLabel: HTMLElement;
  languageSelect: HTMLSelectElement;
  confirmOverlay: HTMLElement;
  confirmText: HTMLElement;
  btnConfirmYes: HTMLButtonElement;
  btnConfirmNo: HTMLButtonElement;
  uploadResultTitle: HTMLElement;
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

interface UploadedMeta {
  shareId: string;
  credit: RankEntry;
  thigh: RankEntry;
}

function sanitizeNickname(raw: string): string {
  const trimmed = raw.trim();
  const filtered = trimmed.replace(/[^A-Za-z0-9\u3131-\u318E\uAC00-\uD7A3 ]+/g, "");
  const clipped = filtered.slice(0, 12).trim();
  return clipped.length > 0 ? clipped : DEFAULT_NICKNAME;
}

function formatRankLine(entry: RankEntry): { percent: string; rank: string; total: string } {
  const percent = Number.isFinite(entry.percentileTop ?? NaN) ? Number(entry.percentileTop).toFixed(1) : "?";
  const rank = Number.isFinite(entry.rank ?? NaN) ? formatNumber(Number(entry.rank)) : "?";
  const total = Number.isFinite(entry.total ?? NaN) ? formatNumber(Number(entry.total)) : "?";
  return {
    percent,
    rank,
    total,
  };
}

function createRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class UiController {
  private readonly root: HTMLElement;
  private readonly refs: UiRefs;
  private renderer: YuukaRenderer | null = null;
  private state: GameState;
  private save: SaveData;
  private settings: Settings;
  private latestResult: RunResult | null = null;
  private uploadedMeta: UploadedMeta | null = null;
  private currentRunId = createRunId();
  private activeScreen: ScreenId = "lobby";
  private isUploading = false;
  private leaderboardSort: LeaderboardSort = "credit";
  private leaderboardItems: LeaderboardItem[] = [];
  private leaderboardLoading = false;
  private leaderboardError: string | null = null;

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
    this.renderLeaderboard();
    this.showScreen("lobby");
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
            <p id="lobby-nickname" class="lobby-foot"></p>
            <div class="stack-buttons">
              <img id="lobby-dance" class="lobby-dance" src="/assets/lobby/yuuka_dance.gif" alt="" />
              <button id="btn-start" class="skin-button font-title"></button>
              <button id="btn-settings" class="skin-button font-title"></button>
              <button id="btn-nickname" class="skin-button font-title"></button>
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
            <span id="hud-actions"></span>
            <button id="btn-mini-lobby" class="mini-hud-button font-title" type="button">L</button>
            <button id="btn-mini-sound" class="mini-hud-button font-title" type="button">S</button>
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
            <p id="score-upload-status" class="score-upload-status"></p>
            <div class="stack-buttons">
              <button id="btn-retry" class="skin-button font-title"></button>
              <button id="btn-back" class="skin-button font-title"></button>
              <button id="btn-upload-share" class="skin-button font-title"></button>
            </div>
          </div>
        </section>

        <section id="screen-leaderboard" class="screen">
          <div class="skin-panel score-card leaderboard-card">
            <h2 id="leaderboard-title" class="font-title"></h2>
            <div class="leaderboard-sort">
              <button id="btn-leader-sort-credit" class="skin-button font-title"></button>
              <button id="btn-leader-sort-thigh" class="skin-button font-title"></button>
            </div>
            <p id="leaderboard-status" class="leaderboard-status"></p>
            <div class="leaderboard-table-wrap">
              <table class="leaderboard-table">
                <thead>
                  <tr>
                    <th id="leader-col-nickname"></th>
                    <th id="leader-col-credits"></th>
                    <th id="leader-col-thigh"></th>
                    <th id="leader-col-ending"></th>
                    <th id="leader-col-days"></th>
                    <th id="leader-col-submitted"></th>
                  </tr>
                </thead>
                <tbody id="leaderboard-body"></tbody>
              </table>
            </div>
            <button id="btn-leader-back" class="skin-button font-title"></button>
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
              <span id="settings-voice"></span>
              <input id="settings-voice-range" type="range" min="0" max="1" step="${VOLUME_STEP}" />
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

        <div id="nickname-modal" class="overlay hidden">
          <div class="skin-panel modal-card">
            <h2 id="nickname-title" class="font-title"></h2>
            <label class="settings-row">
              <span id="nickname-label"></span>
              <input id="nickname-input" type="text" maxlength="12" />
            </label>
            <div class="confirm-actions">
              <button id="btn-nickname-apply" class="skin-button font-title"></button>
              <button id="btn-nickname-cancel" class="skin-button font-title"></button>
            </div>
          </div>
        </div>

        <div id="confirm-overlay" class="overlay hidden">
          <div class="skin-panel modal-card confirm-card">
            <p id="confirm-text"></p>
            <div class="confirm-actions">
              <button id="btn-confirm-yes" class="skin-button font-title"></button>
              <button id="btn-confirm-no" class="skin-button font-title"></button>
            </div>
          </div>
        </div>

        <div id="upload-result-overlay" class="overlay hidden">
          <div class="skin-panel modal-card confirm-card upload-result-card">
            <button id="btn-upload-result-close" class="upload-result-close" type="button">X</button>
            <h2 id="upload-result-title" class="font-title"></h2>
            <p id="score-rank-credit-popup" class="score-rank-line"></p>
            <p id="score-rank-thigh-popup" class="score-rank-line"></p>
            <div class="confirm-actions">
              <button id="btn-upload-result-share" class="skin-button font-title"></button>
              <button id="btn-upload-result-lobby" class="skin-button font-title"></button>
            </div>
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
      leaderboard: pick("screen-leaderboard"),
      settingsModal: pick("settings-modal"),
      nicknameModal: pick("nickname-modal"),
      endingOverlay: pick("ending-overlay"),
      btnStart: pick("btn-start"),
      btnSettings: pick("btn-settings"),
      btnNickname: pick("btn-nickname"),
      btnLeaderboard: pick("btn-leaderboard"),
      btnCloseSettings: pick("btn-close-settings"),
      btnNicknameApply: pick("btn-nickname-apply"),
      btnNicknameCancel: pick("btn-nickname-cancel"),
      nicknameInput: pick("nickname-input"),
      btnWork: pick("btn-work"),
      btnEat: pick("btn-eat"),
      btnGuest: pick("btn-guest"),
      btnContinue: pick("btn-continue"),
      btnRetry: pick("btn-retry"),
      btnBack: pick("btn-back"),
      btnUploadShare: pick("btn-upload-share"),
      uploadResultOverlay: pick("upload-result-overlay"),
      btnUploadResultClose: pick("btn-upload-result-close"),
      btnUploadResultShare: pick("btn-upload-result-share"),
      btnUploadResultLobby: pick("btn-upload-result-lobby"),
      btnLeaderSortCredit: pick("btn-leader-sort-credit"),
      btnLeaderSortThigh: pick("btn-leader-sort-thigh"),
      btnLeaderBack: pick("btn-leader-back"),
      btnMiniLobby: pick("btn-mini-lobby"),
      btnMiniSound: pick("btn-mini-sound"),
      hudDay: pick("hud-day"),
      hudCredits: pick("hud-credits"),
      hudStress: pick("hud-stress"),
      hudThigh: pick("hud-thigh"),
      hudStage: pick("hud-stage"),
      hudActions: pick("hud-actions"),
      logs: pick("log-list"),
      endingTitle: pick("ending-title"),
      endingDesc: pick("ending-desc"),
      scoreEnding: pick("score-ending"),
      scoreThigh: pick("score-thigh"),
      scoreDay: pick("score-day"),
      scoreCredits: pick("score-credits"),
      scoreStress: pick("score-stress"),
      scoreRankCreditPopup: pick("score-rank-credit-popup"),
      scoreRankThighPopup: pick("score-rank-thigh-popup"),
      scoreUploadStatus: pick("score-upload-status"),
      lobbyNickname: pick("lobby-nickname"),
      leaderboardStatus: pick("leaderboard-status"),
      leaderboardBody: pick("leaderboard-body"),
      bgmRange: pick("settings-bgm-range"),
      sfxRange: pick("settings-sfx-range"),
      voiceRange: pick("settings-voice-range"),
      languageLabel: pick("settings-language"),
      languageSelect: pick("settings-language-select"),
      confirmOverlay: pick("confirm-overlay"),
      confirmText: pick("confirm-text"),
      btnConfirmYes: pick("btn-confirm-yes"),
      btnConfirmNo: pick("btn-confirm-no"),
      uploadResultTitle: pick("upload-result-title"),
    };
  }

  private applyLabels(): void {
    this.setText("lobby-title", t("app.title"));
    this.setText("lobby-version", t("lobby.version", { version: APP_VERSION }));
    this.setText("lobby-disclaimer", t("lobby.disclaimer"));
    this.setText("lobby-credits", t("lobby.credits", { author: AUTHOR_NAME }));
    this.setText("lobby-ip", t("lobby.ip", { ip: IP_LABEL }));
    this.setText("lobby-nickname", t("lobby.nicknameCurrent", { nickname: this.settings.nickname }));

    this.refs.btnStart.textContent = t("menu.start");
    this.refs.btnSettings.textContent = t("menu.options");
    this.refs.btnNickname.textContent = t("lobby.btnNickname");
    this.refs.btnLeaderboard.textContent = t("lobby.btnLeaderboard");
    this.refs.btnWork.textContent = t("game.action.work");
    this.refs.btnEat.textContent = t("game.action.eat");
    this.refs.btnGuest.textContent = t("game.action.guest");
    this.refs.btnContinue.textContent = t("ending.continue");
    this.refs.btnRetry.textContent = t("score.btnRetry");
    this.refs.btnBack.textContent = t("score.btnBack");
    this.refs.btnUploadShare.textContent = this.isUploading
      ? t("score.uploading")
      : this.uploadedMeta
        ? t("score.btnUploadedView")
        : t("score.btnUploadShare");
    this.refs.btnCloseSettings.textContent = t("settings.close");
    this.refs.uploadResultTitle.textContent = t("score.uploadCompleteTitle");
    this.refs.btnUploadResultShare.textContent = t("score.popupShare");
    this.refs.btnUploadResultLobby.textContent = t("score.popupLobby");
    this.refs.btnLeaderSortCredit.textContent = t("leaderboard.sort.credit");
    this.refs.btnLeaderSortThigh.textContent = t("leaderboard.sort.thigh");
    this.refs.btnLeaderBack.textContent = t("leaderboard.back");

    this.setText("settings-title", t("options.title"));
    this.setText("settings-bgm", t("settings.bgm"));
    this.setText("settings-sfx", t("settings.sfx"));
    this.setText("settings-voice", t("settings.voice"));
    this.refs.languageLabel.textContent = t("options.language.label");
    this.setSelectOptionText(this.refs.languageSelect, "ko", t("options.language.ko"));
    this.setSelectOptionText(this.refs.languageSelect, "en", t("options.language.en"));
    this.setSelectOptionText(this.refs.languageSelect, "ja", t("options.language.ja"));
    this.refs.confirmText.textContent = t("confirm.abandon.message");
    this.refs.btnConfirmYes.textContent = t("confirm.yes");
    this.refs.btnConfirmNo.textContent = t("confirm.no");
    this.setText("nickname-title", t("nickname.title"));
    this.setText("nickname-label", t("nickname.label"));
    this.refs.nicknameInput.placeholder = t("nickname.placeholder");
    this.refs.btnNicknameApply.textContent = t("nickname.apply");
    this.refs.btnNicknameCancel.textContent = t("nickname.cancel");

    this.setText("score-title", t("result.title"));
    this.setText("score-label-ending", t("result.ending"));
    this.setText("score-label-thigh", t("result.finalThigh"));
    this.setText("score-label-day", t("result.dayReached"));
    this.setText("score-label-credits", t("result.finalCredits"));
    this.setText("score-label-stress", t("result.finalStress"));
    this.setText("leaderboard-title", t("leaderboard.title"));
    this.setText("leader-col-nickname", t("leaderboard.col.nickname"));
    this.setText("leader-col-credits", t("leaderboard.col.credits"));
    this.setText("leader-col-thigh", t("leaderboard.col.thigh"));
    this.setText("leader-col-ending", t("leaderboard.col.ending"));
    this.setText("leader-col-days", t("leaderboard.col.days"));
    this.setText("leader-col-submitted", t("leaderboard.col.submitted"));
    this.setText("log-title", t("log.title"));
    this.updateSoundToggleUi();
    this.updateScoreMeta();
    this.renderLeaderboard();
  }

  private bindEvents(): void {
    [
      this.refs.btnStart,
      this.refs.btnSettings,
      this.refs.btnNickname,
      this.refs.btnLeaderboard,
      this.refs.btnCloseSettings,
      this.refs.btnNicknameApply,
      this.refs.btnNicknameCancel,
      this.refs.btnWork,
      this.refs.btnEat,
      this.refs.btnGuest,
      this.refs.btnContinue,
      this.refs.btnRetry,
      this.refs.btnBack,
      this.refs.btnUploadShare,
      this.refs.btnUploadResultClose,
      this.refs.btnUploadResultShare,
      this.refs.btnUploadResultLobby,
      this.refs.btnLeaderSortCredit,
      this.refs.btnLeaderSortThigh,
      this.refs.btnLeaderBack,
      this.refs.btnMiniLobby,
      this.refs.btnMiniSound,
      this.refs.btnConfirmYes,
      this.refs.btnConfirmNo,
    ].forEach(wireButtonState);

    this.refs.btnStart.addEventListener("click", () => this.startGame());
    this.refs.btnSettings.addEventListener("click", () => this.openSettings(true));
    this.refs.btnNickname.addEventListener("click", () => this.openNicknameModal(true));
    this.refs.btnLeaderboard.addEventListener("click", () => {
      void this.openLeaderboard();
    });
    this.refs.btnCloseSettings.addEventListener("click", () => this.openSettings(false));
    this.refs.btnNicknameApply.addEventListener("click", () => this.applyNickname());
    this.refs.btnNicknameCancel.addEventListener("click", () => this.openNicknameModal(false));
    this.refs.nicknameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.applyNickname();
      }
    });
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
    this.refs.btnUploadShare.addEventListener("click", () => {
      void this.handleUploadShareClick();
    });
    this.refs.btnUploadResultClose.addEventListener("click", () => this.openUploadResultPopup(false));
    this.refs.btnUploadResultLobby.addEventListener("click", () => {
      this.openUploadResultPopup(false);
      this.showScreen("lobby");
    });
    this.refs.btnUploadResultShare.addEventListener("click", () => {
      void this.shareResult();
    });
    this.refs.btnLeaderSortCredit.addEventListener("click", () => {
      void this.changeLeaderboardSort("credit");
    });
    this.refs.btnLeaderSortThigh.addEventListener("click", () => {
      void this.changeLeaderboardSort("thigh");
    });
    this.refs.btnLeaderBack.addEventListener("click", () => this.showScreen("lobby"));
    this.refs.btnMiniLobby.addEventListener("click", () => this.openAbandonConfirm(true));
    this.refs.btnMiniSound.addEventListener("click", () => this.toggleMasterMute());
    this.refs.btnConfirmYes.addEventListener("click", () => this.confirmAbandon());
    this.refs.btnConfirmNo.addEventListener("click", () => this.openAbandonConfirm(false));

    this.refs.bgmRange.addEventListener("input", () => this.updateSettingsFromInputs());
    this.refs.sfxRange.addEventListener("input", () => this.updateSettingsFromInputs());
    this.refs.voiceRange.addEventListener("input", () => this.updateSettingsFromInputs());
    this.refs.languageSelect.addEventListener("change", () => this.updateSettingsFromInputs());
    this.refs.uploadResultOverlay.addEventListener("click", (event) => {
      if (event.target === this.refs.uploadResultOverlay) {
        this.openUploadResultPopup(false);
      }
    });
  }

  private syncSettingsUi(): void {
    this.refs.bgmRange.value = String(this.settings.bgmVolume);
    this.refs.sfxRange.value = String(this.settings.sfxVolume);
    this.refs.voiceRange.value = String(this.settings.voiceVolume);
    this.refs.languageSelect.value = this.settings.language;
    this.refs.nicknameInput.value = this.settings.nickname;
    this.updateSoundToggleUi();
  }

  private updateSettingsFromInputs(): void {
    const language = this.normalizeLanguage(this.refs.languageSelect.value);
    this.settings = {
      bgmVolume: Number(this.refs.bgmRange.value),
      sfxVolume: Number(this.refs.sfxRange.value),
      voiceVolume: Number(this.refs.voiceRange.value),
      masterMuted: this.settings.masterMuted,
      language,
      nickname: this.settings.nickname,
    };
    setLanguage(language);
    saveSettings(this.settings);
    this.renderer?.updateAudioSettings(this.settings);
  }

  private startGame(): void {
    this.resetForNewRun();
    this.showScreen("game");
    this.openAbandonConfirm(false);
    this.ensureRenderer();
    this.renderer?.updateAudioSettings(this.settings);
    this.renderGameUi();
    this.toggleEnding(false);
  }

  private retryGame(): void {
    this.startGame();
  }

  private resetForNewRun(): void {
    this.state = createInitialState();
    this.latestResult = null;
    this.uploadedMeta = null;
    this.currentRunId = createRunId();
    this.isUploading = false;
    this.openUploadResultPopup(false);
    this.save = {
      ...this.save,
      state: this.state,
    };
    saveData(this.save);
  }

  private openSettings(open: boolean): void {
    this.refs.settingsModal.classList.toggle("hidden", !open);
  }

  private openNicknameModal(open: boolean): void {
    this.refs.nicknameModal.classList.toggle("hidden", !open);
    if (open) {
      this.refs.nicknameInput.value = this.settings.nickname;
      this.refs.nicknameInput.focus();
      this.refs.nicknameInput.select();
    }
  }

  private applyNickname(): void {
    this.settings = {
      ...this.settings,
      nickname: sanitizeNickname(this.refs.nicknameInput.value),
    };
    saveSettings(this.settings);
    this.openNicknameModal(false);
    this.applyLabels();
  }

  private openAbandonConfirm(open: boolean): void {
    this.refs.confirmOverlay.classList.toggle("hidden", !open);
  }

  private openUploadResultPopup(open: boolean): void {
    this.refs.uploadResultOverlay.classList.toggle("hidden", !open);
  }

  private confirmAbandon(): void {
    this.openAbandonConfirm(false);
    this.toggleEnding(false);
    this.resetForNewRun();
    this.showScreen("lobby");
  }

  private toggleMasterMute(): void {
    this.settings = {
      ...this.settings,
      masterMuted: !this.settings.masterMuted,
    };
    saveSettings(this.settings);
    this.updateSoundToggleUi();
    this.renderer?.updateAudioSettings(this.settings);
  }

  private updateSoundToggleUi(): void {
    this.refs.btnMiniSound.classList.toggle("muted", this.settings.masterMuted);
  }

  private showScreen(screen: ScreenId): void {
    this.activeScreen = screen;
    this.refs.lobby.classList.toggle("active", screen === "lobby");
    this.refs.game.classList.toggle("active", screen === "game");
    this.refs.score.classList.toggle("active", screen === "score");
    this.refs.leaderboard.classList.toggle("active", screen === "leaderboard");
  }

  private async openLeaderboard(): Promise<void> {
    this.showScreen("leaderboard");
    await this.loadLeaderboard();
  }

  private ensureRenderer(): void {
    if (this.renderer) return;
    this.renderer = new YuukaRenderer("render-host", this.settings);
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
    this.uploadedMeta = null;
    this.isUploading = false;
    this.openUploadResultPopup(false);
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

    this.refs.hudDay.textContent = t("hud.day", { day: this.state.day });
    this.refs.hudCredits.textContent = t("hud.credits", { credits: formatNumber(this.state.money) });
    this.refs.hudStress.textContent = t("hud.stress", { stress: this.state.stress });
    this.refs.hudThigh.textContent = t("hud.thighCm", { thigh: Math.round(this.state.thighCm) });
    this.refs.hudStage.textContent = t("hud.stage", { stage });
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
    this.updateScoreMeta();
  }

  private updateScoreMeta(messageKey?: string): void {
    this.refs.btnUploadShare.textContent = this.isUploading
      ? t("score.uploading")
      : this.uploadedMeta
        ? t("score.btnUploadedView")
        : t("score.btnUploadShare");
    this.refs.btnUploadShare.disabled = this.isUploading || !this.latestResult;

    if (this.uploadedMeta) {
      const credit = formatRankLine(this.uploadedMeta.credit);
      const thigh = formatRankLine(this.uploadedMeta.thigh);
      this.refs.scoreRankCreditPopup.textContent = t("score.rank.credit", credit);
      this.refs.scoreRankThighPopup.textContent = t("score.rank.thigh", thigh);
    } else {
      const pendingCredit = t("score.rank.pending.credit");
      const pendingThigh = t("score.rank.pending.thigh");
      this.refs.scoreRankCreditPopup.textContent = pendingCredit;
      this.refs.scoreRankThighPopup.textContent = pendingThigh;
    }

    this.refs.scoreUploadStatus.textContent = messageKey ? t(messageKey) : "";
  }

  private async handleUploadShareClick(): Promise<void> {
    if (!this.latestResult) return;
    if (this.uploadedMeta) {
      this.openUploadResultPopup(true);
      return;
    }
    await this.uploadResult();
  }

  private async uploadResult(): Promise<void> {
    if (!this.latestResult || this.isUploading) return;
    this.isUploading = true;
    this.updateScoreMeta();
    let statusKey = "score.upload.failed";

    try {
      const response = await submitRun({
        runId: this.currentRunId,
        nickname: this.settings.nickname,
        endingCategory: this.latestResult.endingId,
        endingId: this.latestResult.endingId,
        survivalDays: this.latestResult.dayReached,
        finalCredits: Math.round(this.latestResult.finalMoney),
        finalThighCm: Math.round(this.latestResult.finalThighCm),
        finalStage: getStage(this.latestResult.finalThighCm),
        submittedAtClient: new Date().toISOString(),
        clientVersion: APP_VERSION || "dev",
      });

      this.uploadedMeta = {
        shareId: response.shareId,
        credit: response.rank.credit,
        thigh: response.rank.thigh,
      };
      statusKey = "score.upload.success";
      this.openUploadResultPopup(true);
    } catch (error) {
      console.error(error);
    } finally {
      this.isUploading = false;
      this.updateScoreMeta(statusKey);
    }
  }

  private buildShareText(): string {
    if (!this.latestResult) return t("score.share.text.base");
    if (!this.uploadedMeta) return t("score.share.text.base");
    const creditTop = Number.isFinite(this.uploadedMeta.credit.percentileTop ?? NaN)
      ? Number(this.uploadedMeta.credit.percentileTop).toFixed(1)
      : "?";
    const thighTop = Number.isFinite(this.uploadedMeta.thigh.percentileTop ?? NaN)
      ? Number(this.uploadedMeta.thigh.percentileTop).toFixed(1)
      : "?";
    return t("score.share.text.withRank", {
      nickname: this.settings.nickname,
      credits: formatNumber(this.latestResult.finalMoney),
      thigh: formatNumber(this.latestResult.finalThighCm),
      creditTop,
      thighTop,
    });
  }

  private async shareResult(): Promise<void> {
    if (!this.latestResult) return;
    if (!this.uploadedMeta?.shareId) {
      this.updateScoreMeta("score.share.needUpload");
      return;
    }

    const url = buildShareUrl(this.uploadedMeta.shareId);
    const title = t("result.share");
    const text = this.buildShareText();

    try {
      if ("share" in navigator && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        this.updateScoreMeta("score.share.done");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        this.updateScoreMeta("score.share.copied");
        return;
      }

      window.prompt(t("score.share.manual"), url);
      this.updateScoreMeta("score.share.done");
    } catch (error) {
      console.error(error);
      this.updateScoreMeta("score.share.failed");
    }
  }

  private async changeLeaderboardSort(sort: LeaderboardSort): Promise<void> {
    if (this.leaderboardSort === sort && this.leaderboardItems.length > 0 && !this.leaderboardError) return;
    this.leaderboardSort = sort;
    await this.loadLeaderboard();
  }

  private async loadLeaderboard(): Promise<void> {
    this.leaderboardLoading = true;
    this.leaderboardError = null;
    this.renderLeaderboard();

    try {
      const response = await fetchLeaderboard(this.leaderboardSort, 100);
      this.leaderboardItems = response.items;
    } catch (error) {
      console.error(error);
      this.leaderboardError = t("leaderboard.error");
      this.leaderboardItems = [];
    } finally {
      this.leaderboardLoading = false;
      this.renderLeaderboard();
    }
  }

  private renderLeaderboard(): void {
    this.refs.btnLeaderSortCredit.classList.toggle("active", this.leaderboardSort === "credit");
    this.refs.btnLeaderSortThigh.classList.toggle("active", this.leaderboardSort === "thigh");
    this.refs.leaderboardBody.innerHTML = "";

    if (this.leaderboardLoading) {
      this.refs.leaderboardStatus.textContent = t("leaderboard.loading");
      return;
    }

    if (this.leaderboardError) {
      this.refs.leaderboardStatus.textContent = this.leaderboardError;
      return;
    }

    if (this.leaderboardItems.length === 0) {
      this.refs.leaderboardStatus.textContent = t("leaderboard.empty");
      return;
    }

    this.refs.leaderboardStatus.textContent = "";
    for (const item of this.leaderboardItems) {
      const row = document.createElement("tr");
      row.append(
        this.createLeaderboardCell(item.nickname),
        this.createLeaderboardCell(formatNumber(item.final_credits)),
        this.createLeaderboardCell(`${formatNumber(item.final_thigh_cm)}cm`),
        this.createLeaderboardCell(this.getEndingLabel(item.ending_id)),
        this.createLeaderboardCell(formatNumber(item.survival_days)),
        this.createLeaderboardCell(this.formatSubmittedDate(item.submitted_at_server)),
      );
      this.refs.leaderboardBody.append(row);
    }
  }

  private createLeaderboardCell(value: string): HTMLTableCellElement {
    const cell = document.createElement("td");
    cell.textContent = value;
    return cell;
  }

  private getEndingLabel(endingId: string): string {
    const key = `ending.${endingId}.title`;
    const translated = t(key);
    if (!translated.startsWith("[[missing:")) return translated;
    return endingId;
  }

  private formatSubmittedDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString();
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
