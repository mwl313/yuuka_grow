import { buildShareUrl, fetchLeaderboard, submitRun } from "../api/leaderboardApi";
import type { LeaderboardItem, LeaderboardSort, RankEntry } from "../api/leaderboardApi";
import { BgmManager } from "../audio/bgmManager";
import { applyEat, applyGuest, applyWork } from "../core/actions";
import {
  applyCardToMultipliers,
  BUFF_CARD_STAGE_MILESTONES,
  generateBuffCards,
} from "../core/buffSystem";
import { getGuestCheatEntries, type GuestOutcomeEffect } from "../core/guests";
import {
  APP_VERSION,
  ASSET_KEYS_GIANT_BG,
  AUTHOR_NAME,
  DEFAULT_NICKNAME,
  EAT_BASE_COST,
  EAT_COST_PER_CM,
  GIANT_TRIGGER_STAGE_INTERVAL,
  GIANT_TRIGGER_STAGE_START,
  IP_LABEL,
  NOA_WORK_CHARGES,
  VOLUME_STEP,
  WORK_BASE_MONEY,
  WORK_DAY_SLOPE,
} from "../core/constants";
import { checkImmediateBankrupt, toBaseEndCategory } from "../core/endings";
import { ENDING_DEFS, selectEnding } from "../core/endingsTable";
import { getGuestCost } from "../core/guestCost";
import { decodeLog, pushLog } from "../core/logger";
import { defaultRng } from "../core/rng";
import { getStage } from "../core/stage";
import { createInitialState } from "../core/state";
import type {
  BuffCardSelection,
  GameState,
  LanguageCode,
  RunResult,
  SaveData,
  Settings,
  StepResult,
} from "../core/types";
import { formatNumber, getLanguage, onLanguageChange, setLanguage, t } from "../i18n";
import { YuukaRenderer } from "../render/yuukaRenderer";
import {
  clearAllNewFlags,
  getCollection,
  hasEnding,
  recordEnding,
  type EndingCollectionMap,
} from "../storage/endingCollection";
import { loadSaveData, recordRunResult, saveData } from "../storage/save";
import { loadSettings, saveSettings } from "../storage/settings";
import { getEndingCondition, getEndingTitle } from "../shared/endingMeta";
import { UiAnimController } from "./anim/uiAnimController";
import { CardManager } from "./cardManager";
import { clearPanelTransition, hidePanelWithTransition, showPanelWithTransition } from "./transition/panelTransition";
import { TransitionManager } from "./transition/transitionManager";
import { hapticGameOver, hapticLobbyTap, hapticStageBgTransition, hapticStageUp } from "./haptics";

type ScreenId = "lobby" | "game" | "score" | "leaderboard" | "endingBook";

interface UiRefs {
  lobby: HTMLElement;
  game: HTMLElement;
  score: HTMLElement;
  leaderboard: HTMLElement;
  endingBook: HTMLElement;
  settingsModal: HTMLElement;
  nicknameModal: HTMLElement;
  creditsModal: HTMLElement;
  guideModal: HTMLElement;
  endingOverlay: HTMLElement;
  endingConditionOverlay: HTMLElement;
  btnStart: HTMLButtonElement;
  btnSettings: HTMLButtonElement;
  btnNickname: HTMLButtonElement;
  btnLeaderboard: HTMLButtonElement;
  btnCredits: HTMLButtonElement;
  btnGuide: HTMLButtonElement;
  btnEndingBook: HTMLButtonElement;
  btnCloseSettings: HTMLButtonElement;
  btnCloseCredits: HTMLButtonElement;
  btnCloseGuide: HTMLButtonElement;
  btnNicknameApply: HTMLButtonElement;
  btnNicknameCancel: HTMLButtonElement;
  nicknameInput: HTMLInputElement;
  btnWork: HTMLButtonElement;
  btnEat: HTMLButtonElement;
  btnGuest: HTMLButtonElement;
  actionHintWork: HTMLElement;
  actionHintEat: HTMLElement;
  actionHintGuest: HTMLElement;
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
  btnEndingBookBack: HTMLButtonElement;
  btnEndingConditionClose: HTMLButtonElement;
  btnMiniLobby: HTMLButtonElement;
  btnMiniSound: HTMLButtonElement;
  btnMiniCheatSheet: HTMLButtonElement;
  btnCurrentBuffs: HTMLButtonElement;
  buffCardsOverlay: HTMLElement;
  buffCardsTitle: HTMLElement;
  buffCardsList: HTMLElement;
  btnBuffCardSkip: HTMLButtonElement;
  currentBuffsOverlay: HTMLElement;
  currentBuffsTitle: HTMLElement;
  currentBuffsSummary: HTMLElement;
  btnCloseCurrentBuffs: HTMLButtonElement;
  hudDay: HTMLElement;
  hudCredits: HTMLElement;
  hudStress: HTMLElement;
  hudThigh: HTMLElement;
  hudStage: HTMLElement;
  hudSlotMorning: HTMLElement;
  hudSlotNoon: HTMLElement;
  hudSlotEvening: HTMLElement;
  hudSlotMorningLabel: HTMLElement;
  hudSlotNoonLabel: HTMLElement;
  hudSlotEveningLabel: HTMLElement;
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
  endingBookTitle: HTMLElement;
  endingBookProgress: HTMLElement;
  endingBookBody: HTMLElement;
  endingConditionTitle: HTMLElement;
  endingConditionBody: HTMLElement;
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
  creditsTitle: HTMLElement;
  creditsBody: HTMLElement;
  guideTitle: HTMLElement;
  guideBody: HTMLElement;
  cheatSheetModal: HTMLElement;
  cheatSheetTitle: HTMLElement;
  cheatSheetNote: HTMLElement;
  cheatSheetList: HTMLElement;
  btnCloseCheatSheet: HTMLButtonElement;
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

const TURN_SLOT_KEYS = ["morning", "noon", "evening"] as const;
const ACTION_INPUT_COOLDOWN_MS = 300;
const ENDING_TRANSITION_DELAY_MS = 700;
const PANEL_TRANSITION_DURATION_MS = 520;
const LOG_EMOJI_PREFIX: Record<"work" | "eat" | "guest" | "system", string> = {
  work: "💼 ",
  eat: "🍚 ",
  guest: "🎲 ",
  system: "⚠️ ",
};
const GUEST_SPRITE_KEY_BY_ID: Record<string, string> = {
  teacher: "sensei",
};

export class UiController {
  private readonly root: HTMLElement;
  private readonly refs: UiRefs;
  private renderer: YuukaRenderer | null = null;
  private readonly bgmManager = new BgmManager();
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
  private endingCollection: EndingCollectionMap = {};
  private uiAnimController!: UiAnimController;
  private readonly transitionManager = new TransitionManager();
  private readonly cardManager = new CardManager(BUFF_CARD_STAGE_MILESTONES);
  private renderedRawLogs: string[] = [];
  private readonly creditNumberFormatter = new Intl.NumberFormat("ko-KR");
  private endingPanelMode: "normal" | "preview" = "normal";
  private activeEndingPanelId: string | null = null;
  private endingDexSessionNewIds = new Set<string>();
  private lastHapticStage: number | null = null;
  private lastHapticGiantBgIndex: number | null = null;
  private hasRunEndHapticFired = false;
  private isInputLocked = false;
  private processingBuffMilestones = false;
  private activeBuffCardChoices: BuffCardSelection[] | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = this.buildLayout();
    this.refs = this.collectRefs();
    this.save = ensureValidOngoingState(loadSaveData());
    this.endingCollection = getCollection();
    this.state = this.save.state;
    this.settings = loadSettings();
    this.bgmManager.setVolume(this.settings.bgmVolume, this.settings.masterMuted);
    this.initUiAnimators();

    this.applyLabels();
    this.bindEvents();
    this.syncSettingsUi();
    this.renderGameUi(true);
    this.renderLeaderboard();
    this.showScreen("lobby");
    onLanguageChange(() => this.handleLanguageChanged());
    saveData(this.save);
  }

  private buildLayout(): string {
    return `
      <div class="app-shell font-plain">
        <section id="screen-lobby" class="screen">
          <div class="skin-panel ui-panel ui-panel--accented lobby-card">
            <button id="btn-settings" class="lobby-gear-button ui-btn ui-btn--icon font-title" type="button" aria-label=""></button>
            <h1 id="lobby-title" class="font-title"></h1>
            <p id="lobby-version"></p>
            <p id="lobby-nickname" class="lobby-foot"></p>
            <div class="lobby-visual">
              <img id="lobby-dance" class="lobby-dance" src="/assets/lobby/yuuka_dance.gif" alt="" />
            </div>
            <div class="lobby-menu">
              <button id="btn-start" class="skin-button ui-btn ui-btn--primary font-title lobby-primary-button"></button>
              <div class="lobby-secondary-grid">
                <button id="btn-nickname" class="skin-button ui-btn ui-btn--secondary font-title"></button>
                <button id="btn-leaderboard" class="skin-button ui-btn ui-btn--secondary font-title"></button>
                <button id="btn-credits" class="skin-button ui-btn ui-btn--secondary font-title"></button>
                <button id="btn-guide" class="skin-button ui-btn ui-btn--secondary font-title"></button>
              </div>
              <button id="btn-ending-book" class="skin-button ui-btn ui-btn--secondary font-title lobby-ending-book-button"></button>
            </div>
            <p id="lobby-disclaimer" class="lobby-disclaimer"></p>
            <p id="lobby-credits" class="lobby-foot"></p>
            <p id="lobby-ip" class="lobby-foot"></p>
          </div>
        </section>

        <section id="screen-game" class="screen">
          <div class="skin-panel ui-panel game-main-card">
            <div class="game-hud-header">
              <div class="hud-row">
                <span id="hud-day" class="hud-item"></span>
                <span id="hud-credits" class="hud-item hud-item--right"></span>
              </div>
              <div class="hud-row">
                <span id="hud-stress" class="hud-item hud-item--stress"></span>
                <span id="hud-thigh" class="hud-item hud-item--right"></span>
              </div>
              <div class="game-hud-footer">
                <div class="hud-slots">
                  <span id="hud-slot-morning" class="hud-chip ui-chip">
                    <span class="hud-chip-icon">☀</span>
                    <span id="hud-slot-morning-label"></span>
                  </span>
                  <span id="hud-slot-noon" class="hud-chip ui-chip">
                    <span class="hud-chip-icon">🍱</span>
                    <span id="hud-slot-noon-label"></span>
                  </span>
                  <span id="hud-slot-evening" class="hud-chip ui-chip">
                    <span class="hud-chip-icon">🌙</span>
                    <span id="hud-slot-evening-label"></span>
                  </span>
                </div>
                <span id="hud-stage" class="hud-stage-badge ui-chip"></span>
              </div>
            </div>

            <div id="render-host" class="render-host"></div>

            <div class="game-log-panel">
              <div class="log-header">
                <h2 id="log-title" class="font-title"></h2>
                <div class="log-header-controls">
                  <button id="btn-current-buffs" class="skin-button ui-btn ui-btn--secondary font-title current-buffs-button" type="button">현재 버프</button>
                  <button id="btn-mini-lobby" class="mini-log-button ui-btn ui-btn--icon font-title" type="button" aria-label="Back">←</button>
                  <button id="btn-mini-sound" class="mini-log-button ui-btn ui-btn--icon font-title" type="button" aria-label="Sound">🔊</button>
                  <button id="btn-mini-cheatsheet" class="mini-log-button ui-btn ui-btn--icon font-title" type="button" aria-label="게스트 치트시트">ℹ️</button>
                </div>
              </div>
              <div class="log-body">
                <ul id="log-list"></ul>
              </div>
            </div>
          </div>

          <div class="action-hints" aria-hidden="true">
            <span id="action-hint-work" class="action-hint action-hint--work"></span>
            <span id="action-hint-eat" class="action-hint action-hint--eat"></span>
            <span id="action-hint-guest" class="action-hint action-hint--guest"></span>
          </div>

          <div class="game-controls">
            <button id="btn-work" class="skin-button ui-btn ui-btn--secondary font-title"></button>
            <button id="btn-eat" class="skin-button ui-btn ui-btn--secondary font-title"></button>
            <button id="btn-guest" class="skin-button ui-btn ui-btn--secondary font-title"></button>
          </div>
        </section>

        <section id="screen-score" class="screen">
          <div class="skin-panel ui-panel score-card">
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
              <button id="btn-retry" class="skin-button ui-btn ui-btn--secondary font-title"></button>
              <button id="btn-back" class="skin-button ui-btn ui-btn--secondary font-title"></button>
              <button id="btn-upload-share" class="skin-button ui-btn ui-btn--primary font-title"></button>
            </div>
          </div>
        </section>

        <section id="screen-leaderboard" class="screen">
          <div class="skin-panel ui-panel score-card leaderboard-card">
            <h2 id="leaderboard-title" class="font-title"></h2>
            <div class="leaderboard-sort">
              <button id="btn-leader-sort-credit" class="skin-button ui-btn ui-btn--secondary font-title"></button>
              <button id="btn-leader-sort-thigh" class="skin-button ui-btn ui-btn--secondary font-title"></button>
            </div>
            <p id="leaderboard-status" class="leaderboard-status"></p>
            <div class="leaderboard-table-wrap ui-panel">
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
            <button id="btn-leader-back" class="skin-button ui-btn ui-btn--secondary font-title"></button>
          </div>
        </section>

        <section id="screen-ending-book" class="screen">
          <div class="skin-panel ui-panel score-card ending-book-card">
            <h2 id="ending-book-title" class="font-title"></h2>
            <p id="ending-book-progress" class="ending-book-progress"></p>
            <div class="ending-book-table-wrap ui-panel">
              <div class="endingdex-head">
                <div id="ending-book-col-name" class="endingdex-head-cell endingdex-head-cell--name"></div>
                <div id="ending-book-col-achieved" class="endingdex-head-cell"></div>
                <div id="ending-book-col-condition" class="endingdex-head-cell"></div>
                <div id="ending-book-col-desc" class="endingdex-head-cell"></div>
              </div>
              <div id="ending-book-body" class="endingdex-body"></div>
            </div>
            <button id="btn-ending-book-back" class="skin-button ui-btn ui-btn--secondary font-title"></button>
          </div>
        </section>

        <div id="ending-overlay" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card">
            <h2 id="ending-title" class="font-title"></h2>
            <p id="ending-desc"></p>
            <button id="btn-continue" class="skin-button ui-btn ui-btn--primary font-title"></button>
          </div>
        </div>

        <div id="ending-condition-overlay" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card">
            <h2 id="ending-condition-title" class="font-title"></h2>
            <p id="ending-condition-body" class="ending-condition-body"></p>
            <button id="btn-ending-condition-close" class="skin-button ui-btn ui-btn--secondary font-title"></button>
          </div>
        </div>

        <div id="settings-modal" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card">
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
            <button id="btn-close-settings" class="skin-button ui-btn ui-btn--secondary font-title"></button>
          </div>
        </div>

        <div id="nickname-modal" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card">
            <h2 id="nickname-title" class="font-title"></h2>
            <label class="settings-row">
              <span id="nickname-label"></span>
              <input id="nickname-input" type="text" maxlength="12" />
            </label>
            <div class="confirm-actions">
              <button id="btn-nickname-apply" class="skin-button ui-btn ui-btn--primary font-title"></button>
              <button id="btn-nickname-cancel" class="skin-button ui-btn ui-btn--pink font-title"></button>
            </div>
          </div>
        </div>

        <div id="credits-modal" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card">
            <h2 id="credits-title" class="font-title"></h2>
            <div id="credits-body" class="modal-temp-body"></div>
            <button id="btn-close-credits" class="skin-button ui-btn ui-btn--secondary font-title"></button>
          </div>
        </div>

        <div id="guide-modal" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card">
            <h2 id="guide-title" class="font-title"></h2>
            <div id="guide-body" class="modal-temp-body"></div>
            <button id="btn-close-guide" class="skin-button ui-btn ui-btn--secondary font-title"></button>
          </div>
        </div>

        <div id="cheatsheet-modal" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card cheatsheet-card">
            <h2 id="cheatsheet-title" class="font-title"></h2>
            <p id="cheatsheet-note" class="cheatsheet-note"></p>
            <div id="cheatsheet-list" class="cheatsheet-list"></div>
            <button id="btn-close-cheatsheet" class="skin-button ui-btn ui-btn--secondary font-title"></button>
          </div>
        </div>

        <div id="buff-cards-overlay" class="overlay hidden buff-cards-overlay">
          <div class="skin-panel ui-panel modal-card panel-transition-card buff-cards-panel">
            <h2 id="buff-cards-title" class="font-title card-modal-title">랜덤 버프 타임!</h2>
            <div id="buff-cards-list" class="buff-cards-list"></div>
            <button id="btn-buff-card-skip" class="skin-button ui-btn ui-btn--secondary font-title">스킵</button>
          </div>
        </div>

        <div id="current-buffs-overlay" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card current-buffs-card">
            <h2 id="current-buffs-title" class="font-title">현재 버프</h2>
            <div id="current-buffs-summary" class="current-buffs-summary"></div>
            <button id="btn-close-current-buffs" class="skin-button ui-btn ui-btn--secondary font-title">닫기</button>
          </div>
        </div>

        <div id="confirm-overlay" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card confirm-card">
            <p id="confirm-text"></p>
            <div class="confirm-actions">
              <button id="btn-confirm-yes" class="skin-button ui-btn ui-btn--primary font-title"></button>
              <button id="btn-confirm-no" class="skin-button ui-btn ui-btn--pink font-title"></button>
            </div>
          </div>
        </div>

        <div id="upload-result-overlay" class="overlay hidden">
          <div class="skin-panel ui-panel modal-card panel-transition-card confirm-card upload-result-card">
            <button id="btn-upload-result-close" class="upload-result-close ui-btn ui-btn--icon" type="button">X</button>
            <h2 id="upload-result-title" class="font-title"></h2>
            <p id="score-rank-credit-popup" class="score-rank-line"></p>
            <p id="score-rank-thigh-popup" class="score-rank-line"></p>
            <div class="confirm-actions">
              <button id="btn-upload-result-share" class="skin-button ui-btn ui-btn--primary font-title"></button>
              <button id="btn-upload-result-lobby" class="skin-button ui-btn ui-btn--secondary font-title"></button>
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
      endingBook: pick("screen-ending-book"),
      settingsModal: pick("settings-modal"),
      nicknameModal: pick("nickname-modal"),
      creditsModal: pick("credits-modal"),
      guideModal: pick("guide-modal"),
      endingOverlay: pick("ending-overlay"),
      endingConditionOverlay: pick("ending-condition-overlay"),
      btnStart: pick("btn-start"),
      btnSettings: pick("btn-settings"),
      btnNickname: pick("btn-nickname"),
      btnLeaderboard: pick("btn-leaderboard"),
      btnCredits: pick("btn-credits"),
      btnGuide: pick("btn-guide"),
      btnEndingBook: pick("btn-ending-book"),
      btnCloseSettings: pick("btn-close-settings"),
      btnCloseCredits: pick("btn-close-credits"),
      btnCloseGuide: pick("btn-close-guide"),
      btnNicknameApply: pick("btn-nickname-apply"),
      btnNicknameCancel: pick("btn-nickname-cancel"),
      nicknameInput: pick("nickname-input"),
      btnWork: pick("btn-work"),
      btnEat: pick("btn-eat"),
      btnGuest: pick("btn-guest"),
      actionHintWork: pick("action-hint-work"),
      actionHintEat: pick("action-hint-eat"),
      actionHintGuest: pick("action-hint-guest"),
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
      btnEndingBookBack: pick("btn-ending-book-back"),
      btnEndingConditionClose: pick("btn-ending-condition-close"),
      btnMiniLobby: pick("btn-mini-lobby"),
      btnMiniSound: pick("btn-mini-sound"),
      btnMiniCheatSheet: pick("btn-mini-cheatsheet"),
      btnCurrentBuffs: pick("btn-current-buffs"),
      buffCardsOverlay: pick("buff-cards-overlay"),
      buffCardsTitle: pick("buff-cards-title"),
      buffCardsList: pick("buff-cards-list"),
      btnBuffCardSkip: pick("btn-buff-card-skip"),
      currentBuffsOverlay: pick("current-buffs-overlay"),
      currentBuffsTitle: pick("current-buffs-title"),
      currentBuffsSummary: pick("current-buffs-summary"),
      btnCloseCurrentBuffs: pick("btn-close-current-buffs"),
      hudDay: pick("hud-day"),
      hudCredits: pick("hud-credits"),
      hudStress: pick("hud-stress"),
      hudThigh: pick("hud-thigh"),
      hudStage: pick("hud-stage"),
      hudSlotMorning: pick("hud-slot-morning"),
      hudSlotNoon: pick("hud-slot-noon"),
      hudSlotEvening: pick("hud-slot-evening"),
      hudSlotMorningLabel: pick("hud-slot-morning-label"),
      hudSlotNoonLabel: pick("hud-slot-noon-label"),
      hudSlotEveningLabel: pick("hud-slot-evening-label"),
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
      endingBookTitle: pick("ending-book-title"),
      endingBookProgress: pick("ending-book-progress"),
      endingBookBody: pick("ending-book-body"),
      endingConditionTitle: pick("ending-condition-title"),
      endingConditionBody: pick("ending-condition-body"),
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
      creditsTitle: pick("credits-title"),
      creditsBody: pick("credits-body"),
      guideTitle: pick("guide-title"),
      guideBody: pick("guide-body"),
      cheatSheetModal: pick("cheatsheet-modal"),
      cheatSheetTitle: pick("cheatsheet-title"),
      cheatSheetNote: pick("cheatsheet-note"),
      cheatSheetList: pick("cheatsheet-list"),
      btnCloseCheatSheet: pick("btn-close-cheatsheet"),
    };
  }

  private initUiAnimators(): void {
    this.uiAnimController = new UiAnimController({
      counters: {
        credits: {
          initialValue: this.state.money,
          onWrite: (value) => {
            this.refs.hudCredits.textContent = t("hud.credits", {
              credits: this.creditNumberFormatter.format(value),
            });
          },
        },
        stress: {
          initialValue: this.state.stress,
          onWrite: (value) => {
            this.refs.hudStress.textContent = t("hud.stress", { stress: value });
          },
        },
        thigh: {
          initialValue: Math.round(this.state.thighCm),
          onWrite: (value) => {
            this.refs.hudThigh.textContent = t("hud.thighCm", { thigh: value });
          },
        },
      },
      charsPerSecond: 60,
      onLogLineFinished: () => this.scrollLogsToBottom(),
    });
  }

  private refreshHudCountersText(): void {
    this.uiAnimController.syncCounterText();
  }

  private applyLabels(): void {
    this.setText("lobby-title", t("app.title"));
    this.setText("lobby-version", t("lobby.version", { version: APP_VERSION }));
    this.setText("lobby-disclaimer", t("lobby.disclaimer"));
    this.setText("lobby-credits", t("lobby.credits", { author: AUTHOR_NAME }));
    this.setText("lobby-ip", t("lobby.ip", { ip: IP_LABEL }));
    this.setText("lobby-nickname", t("lobby.nicknameCurrent", { nickname: this.settings.nickname }));

    this.refs.btnStart.textContent = t("menu.start");
    this.refs.btnSettings.textContent = "⚙️";
    this.refs.btnSettings.setAttribute("aria-label", t("lobby.btnSettingsIconLabel"));
    this.refs.btnNickname.textContent = t("lobby.btnNickname");
    this.refs.btnLeaderboard.textContent = t("lobby.btnLeaderboard");
    this.refs.btnCredits.textContent = t("lobby.btnCredits");
    this.refs.btnGuide.textContent = t("lobby.btnGuide");
    this.updateEndingBookButtonLabel();
    this.refs.hudSlotMorningLabel.textContent = t("turn.morning");
    this.refs.hudSlotNoonLabel.textContent = t("turn.noon");
    this.refs.hudSlotEveningLabel.textContent = t("turn.evening");
    this.refs.btnWork.textContent = t("game.action.work");
    this.refs.btnEat.textContent = t("game.action.eat");
    this.refs.btnGuest.textContent = t("game.action.guest");
    this.updateEndingPanelPrimaryButtonLabel();
    this.refs.btnRetry.textContent = t("score.btnRetry");
    this.refs.btnBack.textContent = t("score.btnBack");
    this.refs.btnUploadShare.textContent = this.isUploading
      ? t("score.uploading")
      : this.uploadedMeta
        ? t("score.btnUploadedView")
        : t("score.btnUploadShare");
    this.refs.btnCloseSettings.textContent = t("settings.close");
    this.refs.btnCloseCredits.textContent = t("settings.close");
    this.refs.btnCloseGuide.textContent = t("settings.close");
    this.refs.uploadResultTitle.textContent = t("score.uploadCompleteTitle");
    this.refs.btnUploadResultShare.textContent = t("score.popupShare");
    this.refs.btnUploadResultLobby.textContent = t("score.popupLobby");
    this.refs.btnLeaderSortCredit.textContent = t("leaderboard.sort.credit");
    this.refs.btnLeaderSortThigh.textContent = t("leaderboard.sort.thigh");
    this.refs.btnLeaderBack.textContent = t("leaderboard.back");
    this.refs.endingBookTitle.textContent = t("endingDex.title");
    this.refs.btnEndingBookBack.textContent = t("endingBook.back");
    this.setText("ending-book-col-name", t("endingDex.colName"));
    this.setText("ending-book-col-achieved", t("endingDex.colAchieved"));
    this.setText("ending-book-col-condition", t("endingDex.colCondition"));
    this.setText("ending-book-col-desc", t("endingDex.colDesc"));
    this.refs.btnEndingConditionClose.textContent = t("endingDex.btnClose");

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
    this.refs.creditsTitle.textContent = t("credits.title");
    this.renderCreditsBody();
    this.refs.guideTitle.textContent = t("guide.title");
    this.renderGuideBody();
    this.refs.cheatSheetTitle.textContent = t("cheatsheet.title");
    this.refs.cheatSheetNote.textContent = t("cheatsheet.note");
    this.refs.btnCloseCheatSheet.textContent = t("cheatsheet.close");
    this.refs.btnMiniCheatSheet.setAttribute("aria-label", t("cheatsheet.title"));
    this.renderGuestCheatSheet();
    this.refs.btnCurrentBuffs.textContent = "현재 버프";
    this.refs.buffCardsTitle.textContent = t("buff.cardTitle");
    this.refs.btnBuffCardSkip.textContent = "스킵";
    this.refs.currentBuffsTitle.textContent = t("buff.currentTitle");
    this.refs.btnCloseCurrentBuffs.textContent = "닫기";
    this.renderCurrentBuffsOverlay();

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
    this.refreshHudCountersText();
    this.updateSoundToggleUi();
    this.updateScoreMeta();
    this.renderLeaderboard();
    this.renderEndingBook();
  }

  private updateEndingPanelPrimaryButtonLabel(): void {
    this.refs.btnContinue.textContent =
      this.endingPanelMode === "preview" ? t("ending.previewBack") : t("ending.continue");
  }

  private getEndingBookCounts(): { collected: number; total: number } {
    const total = ENDING_DEFS.length;
    let collected = 0;
    for (const ending of ENDING_DEFS) {
      if (hasEnding(ending.id, this.endingCollection)) {
        collected += 1;
      }
    }
    return { collected, total };
  }

  private updateEndingBookButtonLabel(): void {
    this.refs.btnEndingBook.textContent = t("lobby.btnEndingBook");
  }

  private renderGuideBody(): void {
    const body = t("guide.body");
    const sections = body
      .split(/\r?\n\s*\r?\n/g)
      .map((section) => section.trim())
      .filter((section) => section.length > 0);

    const headingSet = new Set(["행동", "주의", "Actions", "Caution", "行動", "注意"]);
    this.refs.guideBody.innerHTML = "";

    for (const section of sections) {
      const block = document.createElement("p");
      block.className = "guide-block";
      if (headingSet.has(section)) {
        block.classList.add("guide-block--heading");
        block.textContent = section;
      } else {
        const html = this.formatGuideSectionHtml(section);
        if (html) {
          block.innerHTML = html;
        } else {
          block.textContent = section;
        }
      }
      this.refs.guideBody.append(block);
    }
  }

  private renderCreditsBody(): void {
    const body = t("credits.body");
    const sections = body
      .split(/\r?\n\s*\r?\n/g)
      .map((section) => section.trim())
      .filter((section) => section.length > 0);

    this.refs.creditsBody.innerHTML = "";
    for (const section of sections) {
      const block = document.createElement("p");
      block.className = "credits-block";
      const lines = section
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      for (const line of lines) {
        const lineEl = document.createElement("span");
        lineEl.className = "credits-line";
        const labelMatch = line.match(/^([^:]+:)\s*(.+)$/);
        if (labelMatch) {
          const label = document.createElement("strong");
          label.className = "credits-label";
          label.textContent = labelMatch[1];
          const value = document.createElement("span");
          value.className = "credits-value";
          value.textContent = ` ${labelMatch[2]}`;
          lineEl.append(label, value);
        } else {
          lineEl.textContent = line;
        }
        block.append(lineEl);
      }
      this.refs.creditsBody.append(block);
    }
  }

  private formatGuideSectionHtml(section: string): string | null {
    const match = section.match(/^(💼|🍚|🎲)\s*([^:]+):\s*(.+)$/);
    if (!match) return null;

    const [, emoji, actionName, rawEffects] = match;
    const effects = rawEffects
      .split("/")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const renderedEffects = effects
      .map((part) => this.formatGuideEffectPart(part))
      .join(" / ");

    return `${emoji} <strong class="guide-action-name">${this.escapeHtml(actionName)}</strong>: ${renderedEffects}`;
  }

  private getGuideEffectToneClass(part: string): "guide-effect-good" | "guide-effect-bad" | "" {
    const hasUp = part.includes("↑");
    const hasDown = part.includes("↓");
    if (!hasUp && !hasDown) return "";

    const isStress = /스트레스|stress|ストレス/i.test(part);
    const isCredit = /크레딧|credit|credits|クレジット/i.test(part);
    const isThigh = /허벅지|thigh|太もも/i.test(part);

    if (isStress) {
      return hasDown ? "guide-effect-good" : "guide-effect-bad";
    }

    if (isCredit || isThigh) {
      return hasUp ? "guide-effect-good" : "guide-effect-bad";
    }

    return "";
  }

  private formatGuideEffectPart(part: string): string {
    const toneClass = this.getGuideEffectToneClass(part);
    const highlighted = this.highlightGuideRainbowText(part);
    if (!toneClass) return highlighted;
    return `<span class="${toneClass}">${highlighted}</span>`;
  }

  private highlightGuideRainbowText(part: string): string {
    const ranges: Array<{ start: number; end: number }> = [];

    const koIndex = part.indexOf("랜덤 효과");
    if (koIndex >= 0) {
      ranges.push({ start: koIndex, end: koIndex + "랜덤 효과".length });
    }

    const enLower = part.toLowerCase();
    const enNeedle = "random effect";
    const enIndex = enLower.indexOf(enNeedle);
    if (enIndex >= 0) {
      ranges.push({ start: enIndex, end: enIndex + enNeedle.length });
    }

    const jaIndex = part.indexOf("ランダム効果");
    if (jaIndex >= 0) {
      ranges.push({ start: jaIndex, end: jaIndex + "ランダム効果".length });
    }

    if (ranges.length === 0) {
      return this.escapeHtml(part);
    }

    ranges.sort((a, b) => a.start - b.start);
    const selected = ranges[0];
    const before = this.escapeHtml(part.slice(0, selected.start));
    const target = this.escapeHtml(part.slice(selected.start, selected.end));
    const after = this.escapeHtml(part.slice(selected.end));
    return `${before}<span class="guide-rainbow">${target}</span>${after}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private renderGuestCheatSheet(): void {
    const entries = getGuestCheatEntries();
    this.refs.cheatSheetList.innerHTML = "";

    for (const entry of entries) {
      const card = document.createElement("article");
      card.className = "cheatsheet-item";

      const avatarWrap = document.createElement("div");
      avatarWrap.className = "cheatsheet-avatar";
      const fallback = document.createElement("span");
      fallback.className = "cheatsheet-avatar-fallback";
      fallback.textContent = "?";
      const avatar = document.createElement("img");
      avatar.className = "cheatsheet-avatar-image";
      avatar.alt = t(`guest.${entry.guestId}.name`);
      const spriteKey = GUEST_SPRITE_KEY_BY_ID[entry.guestId] ?? entry.guestId;
      avatar.src = `/assets/guests/${spriteKey}/${spriteKey}.png`;
      avatar.addEventListener("load", () => {
        fallback.style.display = "none";
      });
      avatar.addEventListener("error", () => {
        avatar.style.display = "none";
        fallback.style.display = "inline-flex";
      });
      avatarWrap.append(fallback, avatar);

      const content = document.createElement("div");
      content.className = "cheatsheet-content";
      const name = document.createElement("h3");
      name.className = "cheatsheet-name";
      name.textContent = t(`guest.${entry.guestId}.name`);
      content.append(name);

      const lines = this.buildGuestCheatLines(entry.outcomes);
      for (const lineText of lines) {
        const line = document.createElement("p");
        line.className = "cheatsheet-line";
        line.textContent = lineText;
        content.append(line);
      }

      card.append(avatarWrap, content);
      this.refs.cheatSheetList.append(card);
    }
  }

  private buildGuestCheatLines(outcomes: readonly GuestOutcomeEffect[]): string[] {
    if (outcomes.length <= 1) {
      return [this.formatGuestCheatEffect(outcomes[0])];
    }
    return outcomes.map((effect) => {
      const label = this.resolveGuestOutcomeLabel(effect.outcomeId);
      return `${label}: ${this.formatGuestCheatEffect(effect)}`;
    });
  }

  private resolveGuestOutcomeLabel(outcomeId: string): string {
    if (outcomeId === "success" || outcomeId === "jackpot") return t("cheatsheet.outcome.success");
    if (outcomeId === "loss" || outcomeId === "slip") return t("cheatsheet.outcome.fail");
    return t("cheatsheet.outcome.default");
  }

  private formatGuestCheatEffect(effect: GuestOutcomeEffect): string {
    const parts: string[] = [];
    if (effect.thighPct !== 0) {
      parts.push(
        `${t("cheatsheet.stat.thigh")} ${this.formatSignedPercent(effect.thighPct)}`,
      );
    }
    if (effect.moneyPct !== 0) {
      parts.push(
        `${t("cheatsheet.stat.credit")} ${this.formatSignedPercent(effect.moneyPct)}`,
      );
    }
    if (effect.stressDelta !== 0) {
      parts.push(
        `${t("cheatsheet.stat.stress")} ${this.formatSignedInteger(effect.stressDelta)}`,
      );
    }
    if (effect.refreshNoaCharges) {
      parts.push(t("cheatsheet.workBuff", { count: String(NOA_WORK_CHARGES) }));
    }
    if (parts.length === 0) {
      return t("cheatsheet.noEffect");
    }
    return parts.join(" / ");
  }

  private formatSignedPercent(value: number): string {
    const percent = Math.round(value * 100);
    return `${percent >= 0 ? "+" : ""}${percent}%`;
  }

  private formatSignedInteger(value: number): string {
    const rounded = Math.round(value);
    const formatted = this.creditNumberFormatter.format(Math.abs(rounded));
    return `${rounded >= 0 ? "+" : "-"}${formatted}`;
  }

  private bindEvents(): void {
    this.root.addEventListener(
      "pointerdown",
      () => {
        void this.bgmManager.unlock();
      },
      { passive: true },
    );

    [
      this.refs.btnStart,
      this.refs.btnSettings,
      this.refs.btnNickname,
      this.refs.btnLeaderboard,
      this.refs.btnCredits,
      this.refs.btnGuide,
      this.refs.btnEndingBook,
      this.refs.btnEndingConditionClose,
      this.refs.btnCloseSettings,
      this.refs.btnCloseCredits,
      this.refs.btnCloseGuide,
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
      this.refs.btnEndingBookBack,
      this.refs.btnMiniLobby,
      this.refs.btnMiniSound,
      this.refs.btnMiniCheatSheet,
      this.refs.btnCurrentBuffs,
      this.refs.btnBuffCardSkip,
      this.refs.btnCloseCurrentBuffs,
      this.refs.btnCloseCheatSheet,
      this.refs.btnConfirmYes,
      this.refs.btnConfirmNo,
    ].forEach(wireButtonState);

    this.refs.btnStart.addEventListener("click", () => this.startGame());
    this.refs.btnSettings.addEventListener("click", () => this.openSettings(true));
    this.refs.btnNickname.addEventListener("click", () => this.openNicknameModal(true));
    this.refs.btnLeaderboard.addEventListener("click", () => {
      void this.openLeaderboard();
    });
    this.refs.btnCredits.addEventListener("click", () => this.openCreditsModal(true));
    this.refs.btnGuide.addEventListener("click", () => this.openGuideModal(true));
    this.refs.btnEndingBook.addEventListener("click", () => {
      void this.openEndingBook();
    });
    this.refs.btnEndingConditionClose.addEventListener("click", () => {
      this.setOverlayOpen(this.refs.endingConditionOverlay, false);
    });
    this.refs.btnCloseSettings.addEventListener("click", () => this.openSettings(false));
    this.refs.btnCloseCredits.addEventListener("click", () => this.openCreditsModal(false));
    this.refs.btnCloseGuide.addEventListener("click", () => this.openGuideModal(false));
    this.refs.btnNicknameApply.addEventListener("click", () => this.applyNickname());
    this.refs.btnNicknameCancel.addEventListener("click", () => this.openNicknameModal(false));
    this.refs.nicknameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.applyNickname();
      }
    });
    this.refs.btnWork.addEventListener("click", () => this.handleActionClick(() => applyWork(this.state)));
    this.refs.btnEat.addEventListener("click", () => this.handleActionClick(() => applyEat(this.state)));
    this.refs.btnGuest.addEventListener("click", () => this.handleActionClick(() => applyGuest(this.state, defaultRng)));
    this.refs.btnContinue.addEventListener("click", () => {
      if (this.endingPanelMode === "preview") {
        this.toggleEnding(false);
        this.showScreen("endingBook");
        return;
      }
      void this.transitionManager.transitionTo("score", {
        type: "slide",
        direction: "left",
        onMid: () => {
          this.toggleEnding(false);
          this.showScreen("score");
          this.renderScore();
        },
      });
    });
    this.refs.btnRetry.addEventListener("click", () => this.retryGame());
    this.refs.btnBack.addEventListener("click", () => {
      void this.transitionToLobby();
    });
    this.refs.btnUploadShare.addEventListener("click", () => {
      void this.handleUploadShareClick();
    });
    this.refs.btnUploadResultClose.addEventListener("click", () => this.openUploadResultPopup(false));
    this.refs.btnUploadResultLobby.addEventListener("click", () => {
      this.openUploadResultPopup(false);
      void this.transitionToLobby();
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
    this.refs.btnLeaderBack.addEventListener("click", () => {
      void this.transitionToLobby();
    });
    this.refs.btnEndingBookBack.addEventListener("click", () => {
      void this.transitionToLobby();
    });
    this.refs.btnMiniLobby.addEventListener("click", () => this.openAbandonConfirm(true));
    this.refs.btnMiniSound.addEventListener("click", () => this.toggleMasterMute());
    this.refs.btnMiniCheatSheet.addEventListener("click", () => this.openCheatSheetModal(true));
    this.refs.btnCurrentBuffs.addEventListener("click", () => this.openCurrentBuffsOverlay(true));
    this.refs.btnBuffCardSkip.addEventListener("click", () => {
      void this.resolveBuffCardSelection(undefined);
    });
    this.refs.btnCloseCurrentBuffs.addEventListener("click", () => this.openCurrentBuffsOverlay(false));
    this.refs.btnCloseCheatSheet.addEventListener("click", () => this.openCheatSheetModal(false));
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
    this.refs.creditsModal.addEventListener("click", (event) => {
      if (event.target === this.refs.creditsModal) {
        this.openCreditsModal(false);
      }
    });
    this.refs.guideModal.addEventListener("click", (event) => {
      if (event.target === this.refs.guideModal) {
        this.openGuideModal(false);
      }
    });
    this.refs.cheatSheetModal.addEventListener("click", (event) => {
      if (event.target === this.refs.cheatSheetModal) {
        this.openCheatSheetModal(false);
      }
    });
    this.refs.currentBuffsOverlay.addEventListener("click", (event) => {
      if (event.target === this.refs.currentBuffsOverlay) {
        this.openCurrentBuffsOverlay(false);
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
    this.bgmManager.setVolume(this.settings.bgmVolume, this.settings.masterMuted);
  }

  private startGame(): void {
    hapticLobbyTap();
    void this.bgmManager.unlock();
    this.resetForNewRun();
    this.openAbandonConfirm(false);
    this.ensureRenderer();
    this.renderer?.updateAudioSettings(this.settings);
    this.renderGameUi(true);
    this.toggleEnding(false);
    void this.transitionManager.transitionTo("game", {
      type: "slide",
      direction: "left",
      onMid: () => this.showScreen("game"),
    });
  }

  private retryGame(): void {
    this.startGame();
  }

  private resetForNewRun(): void {
    this.uiAnimController.forceFinalizeAll("reset");
    this.state = createInitialState();
    this.resetBuffCardUiState();
    const stage = getStage(this.state.thighCm);
    this.lastHapticStage = stage;
    this.lastHapticGiantBgIndex = this.getGiantBgIndexForStage(stage);
    this.hasRunEndHapticFired = false;
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
    this.setOverlayOpen(this.refs.settingsModal, open);
  }

  private openNicknameModal(open: boolean): void {
    if (open && this.activeScreen === "lobby") {
      hapticLobbyTap();
    }
    this.setOverlayOpen(this.refs.nicknameModal, open);
    if (open) {
      this.refs.nicknameInput.value = this.settings.nickname;
      this.refs.nicknameInput.focus();
      this.refs.nicknameInput.select();
    }
  }

  private openCreditsModal(open: boolean): void {
    if (open && this.activeScreen === "lobby") {
      hapticLobbyTap();
    }
    this.setOverlayOpen(this.refs.creditsModal, open);
  }

  private openGuideModal(open: boolean): void {
    if (open && this.activeScreen === "lobby") {
      hapticLobbyTap();
    }
    this.setOverlayOpen(this.refs.guideModal, open);
  }

  private openCheatSheetModal(open: boolean): void {
    if (open && this.isInputLocked) return;
    if (open) {
      this.renderGuestCheatSheet();
    }
    this.setOverlayOpen(this.refs.cheatSheetModal, open);
  }

  private openCurrentBuffsOverlay(open: boolean): void {
    if (open && this.isInputLocked) return;
    if (open) {
      this.renderCurrentBuffsOverlay();
    }
    this.setOverlayOpen(this.refs.currentBuffsOverlay, open);
  }

  private setInputLocked(locked: boolean): void {
    this.isInputLocked = locked;
    this.refs.game.classList.toggle("input-locked", locked);
  }

  private registerBuffMilestones(stage: number): void {
    const hitSet = new Set(this.state.milestonesHit);
    const newlyHit = this.cardManager.registerStage(stage, hitSet);
    if (newlyHit.length === 0) return;

    this.state = {
      ...this.state,
      milestonesHit: [...hitSet].sort((a, b) => a - b),
    };
    this.save = {
      ...this.save,
      state: this.state,
    };
    saveData(this.save);
  }

  private resetBuffCardUiState(): void {
    this.activeBuffCardChoices = null;
    this.cardManager.reset();
    this.setInputLocked(false);
    this.setBuffCardControlsEnabled(false);
    clearPanelTransition(this.refs.buffCardsOverlay);
    this.refs.buffCardsOverlay.classList.add("hidden");
  }

  private async tryShowNextBuffCard(): Promise<void> {
    if (this.processingBuffMilestones) return;
    if (this.activeScreen !== "game") return;
    this.processingBuffMilestones = true;
    try {
      while (this.activeScreen === "game") {
        const milestone = this.cardManager.dequeueReadyMilestone();
        if (milestone === undefined) break;

        const stage = getStage(this.state.thighCm);
        const cards = generateBuffCards(milestone, this.state.day, stage, defaultRng.next01);
        this.activeBuffCardChoices = cards;
        this.cardManager.setCardOverlayActive(true);
        this.setInputLocked(true);
        this.renderBuffCardChoices(cards);
        this.setBuffCardControlsEnabled(false);
        await this.animateBuffCardOverlay(true);
        this.setBuffCardControlsEnabled(true);
        break;
      }
    } finally {
      this.processingBuffMilestones = false;
    }
  }

  private renderBuffCardChoices(cards: BuffCardSelection[]): void {
    this.refs.buffCardsList.innerHTML = "";
    for (const card of cards) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "skin-button ui-btn ui-btn--secondary buff-card-option";
      button.addEventListener("click", () => {
        void this.resolveBuffCardSelection(card.id);
      });

      const rarity = document.createElement("div");
      rarity.className = `buff-card-rarity buff-card-rarity--${card.rarityLabel.toLowerCase()}`;
      rarity.textContent = card.rarityLabel;

      const buffLine = document.createElement("p");
      buffLine.className = "buff-card-line buff-card-line--buff";
      buffLine.textContent = this.formatEffectLine(card.buff.key, card.buff.delta);

      const debuffLine = document.createElement("p");
      debuffLine.className = "buff-card-line buff-card-line--debuff";
      debuffLine.textContent = this.formatEffectLine(card.debuff.key, card.debuff.delta);

      button.append(rarity, buffLine, debuffLine);
      this.refs.buffCardsList.append(button);
    }
  }

  private async resolveBuffCardSelection(selectedCardId?: string): Promise<void> {
    const cards = this.activeBuffCardChoices;
    if (!cards) return;
    this.setBuffCardControlsEnabled(false);
    const selected = selectedCardId ? cards.find((card) => card.id === selectedCardId) : undefined;

    await this.animateBuffCardOverlay(false);
    this.cardManager.setCardOverlayActive(false);
    this.activeBuffCardChoices = null;

    if (selected) {
      this.state = {
        ...this.state,
        buffs: applyCardToMultipliers(this.state.buffs, selected),
        buffHistory: [selected, ...this.state.buffHistory],
      };
      this.state = {
        ...this.state,
        logs: this.state.logs,
      };
    }

    if (selected) {
      this.state = pushLog(this.state, "log.buffCard.pick", {
        buff: this.formatEffectLine(selected.buff.key, selected.buff.delta),
        debuff: this.formatEffectLine(selected.debuff.key, selected.debuff.delta),
        rarity: selected.rarityLabel,
      }, "system");
    } else {
      this.state = pushLog(this.state, "log.buffCard.skip", undefined, "system");
    }

    this.renderLogs(true);
    this.renderCurrentBuffsOverlay();
    this.save = {
      ...this.save,
      state: this.state,
    };
    saveData(this.save);
    this.setInputLocked(false);
    void this.tryShowNextBuffCard();
  }

  private setBuffCardControlsEnabled(enabled: boolean): void {
    this.refs.btnBuffCardSkip.disabled = !enabled;
    const optionButtons = this.refs.buffCardsList.querySelectorAll<HTMLButtonElement>(".buff-card-option");
    optionButtons.forEach((button) => {
      button.disabled = !enabled;
    });
  }

  private async animateBuffCardOverlay(open: boolean): Promise<void> {
    const overlay = this.refs.buffCardsOverlay;
    if (open) {
      showPanelWithTransition(overlay);
      await new Promise<void>((resolve) => window.setTimeout(resolve, PANEL_TRANSITION_DURATION_MS));
      return;
    }
    hidePanelWithTransition(overlay);
    await new Promise<void>((resolve) => window.setTimeout(resolve, PANEL_TRANSITION_DURATION_MS));
  }

  private renderCurrentBuffsOverlay(): void {
    const formatMult = (value: number): string => `x${value.toFixed(2)}`;
    const summaryLines = [
      `${t("buff.creditGain")} ${formatMult(this.state.buffs.creditGainMult)}`,
      `${t("buff.thighGain")} ${formatMult(this.state.buffs.thighGainMult)}`,
      `${t("buff.stressGain")} ${formatMult(this.state.buffs.stressGainMult)}`,
      `${t("buff.makiProb")} ${formatMult(this.state.buffs.makiWinProbMult)}`,
      `${t("buff.koyukiProb")} ${formatMult(this.state.buffs.koyukiWinProbMult)}`,
      `${t("buff.guestCost")} ${formatMult(this.state.buffs.guestCostMult)}`,
      `${t("buff.eatCost")} ${formatMult(this.state.buffs.eatCostMult)}`,
      `${t("buff.noEatPenalty")} ${formatMult(this.state.buffs.noEatPenaltyMult)}`,
    ];
    this.refs.currentBuffsSummary.innerHTML = "";
    for (const line of summaryLines) {
      const row = document.createElement("p");
      row.className = "current-buffs-summary-line";
      row.textContent = line;
      this.refs.currentBuffsSummary.append(row);
    }
  }

  private getBuffLabelKey(effectType: string): string {
    switch (effectType) {
      case "creditGainMult":
        return "buff.creditGain";
      case "thighGainMult":
        return "buff.thighGain";
      case "stressGainMult":
        return "buff.stressGain";
      case "koyukiWinProbMult":
        return "buff.koyukiProb";
      case "makiWinProbMult":
        return "buff.makiProb";
      case "guestCostMult":
        return "buff.guestCost";
      case "eatCostMult":
        return "buff.eatCost";
      case "noEatPenaltyMult":
        return "buff.noEatPenalty";
      default:
        return effectType;
    }
  }

  private formatEffectLine(effectType: string, delta: number): string {
    const labelKey = this.getBuffLabelKey(effectType);
    const label = labelKey.startsWith("buff.") ? t(labelKey) : labelKey;
    const percent = `${Math.round(Math.abs(delta) * 100)}%`;
    const dirKey = delta >= 0 ? "common.increase" : "common.decrease";
    const direction = t(dirKey);
    const lang = getLanguage();
    if (lang === "en") {
      return `${label} ${direction} ${percent}`;
    }
    return `${label} ${percent} ${direction}`;
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
    if (open && this.isInputLocked) return;
    this.setOverlayOpen(this.refs.confirmOverlay, open);
  }

  private openUploadResultPopup(open: boolean): void {
    this.setOverlayOpen(this.refs.uploadResultOverlay, open);
  }

  private confirmAbandon(): void {
    this.openAbandonConfirm(false);
    this.toggleEnding(false);
    this.resetForNewRun();
    void this.transitionToLobby();
  }

  private toggleMasterMute(): void {
    if (this.isInputLocked && this.activeScreen === "game") return;
    this.settings = {
      ...this.settings,
      masterMuted: !this.settings.masterMuted,
    };
    saveSettings(this.settings);
    this.updateSoundToggleUi();
    this.renderer?.updateAudioSettings(this.settings);
    this.bgmManager.setVolume(this.settings.bgmVolume, this.settings.masterMuted);
  }

  private updateSoundToggleUi(): void {
    this.refs.btnMiniSound.classList.toggle("muted", this.settings.masterMuted);
    this.refs.btnMiniSound.textContent = this.settings.masterMuted ? "🔇" : "🔊";
  }

  private showScreen(screen: ScreenId): void {
    this.activeScreen = screen;
    this.refs.lobby.classList.toggle("active", screen === "lobby");
    this.refs.game.classList.toggle("active", screen === "game");
    this.refs.score.classList.toggle("active", screen === "score");
    this.refs.leaderboard.classList.toggle("active", screen === "leaderboard");
    this.refs.endingBook.classList.toggle("active", screen === "endingBook");
    this.updateBgmContext();
  }

  private async openLeaderboard(): Promise<void> {
    hapticLobbyTap();
    await this.transitionManager.transitionTo("leaderboard", {
      type: "slide",
      direction: "left",
      onMid: () => this.showScreen("leaderboard"),
    });
    await this.loadLeaderboard();
  }

  private async openEndingBook(): Promise<void> {
    hapticLobbyTap();
    this.snapshotAndClearEndingDexNewFlags();
    this.renderEndingBook();
    await this.transitionManager.transitionTo("endingBook", {
      type: "slide",
      direction: "left",
      onMid: () => this.showScreen("endingBook"),
    });
  }

  private ensureRenderer(): void {
    if (this.renderer) return;
    this.renderer = new YuukaRenderer("render-host", this.settings);
    this.renderer.onBackgroundTransitionStateChanged((isTransitioning) => {
      this.cardManager.setTransitioning(isTransitioning);
      if (!isTransitioning) {
        void this.tryShowNextBuffCard();
      }
    });
  }

  private handleActionClick(runAction: () => StepResult): void {
    if (this.isInputLocked) return;
    void this.bgmManager.unlock();
    const shouldStartCooldown = this.uiAnimController.onActionUserInput();
    this.handleStep(runAction());
    if (shouldStartCooldown) {
      this.uiAnimController.setCooldown(ACTION_INPUT_COOLDOWN_MS);
    }
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
    const endedAt = new Date(runResult.endedAtIso);
    const safeEndedAt = Number.isNaN(endedAt.getTime()) ? new Date() : endedAt;
    const selected = selectEnding(
      this.state,
      toBaseEndCategory(runResult.endingCategory),
      safeEndedAt,
      (endingId) => hasEnding(endingId, this.endingCollection),
    );
    const finalizedRun: RunResult = {
      ...runResult,
      endedAtIso: safeEndedAt.toISOString(),
      endingCategory: selected.category,
      endingId: selected.id,
    };
    this.endingCollection = recordEnding(finalizedRun.endingId, finalizedRun.endedAtIso, this.endingCollection);
    this.renderEndingBook();
    this.latestResult = finalizedRun;
    this.uploadedMeta = null;
    this.isUploading = false;
    this.openUploadResultPopup(false);
    this.save = recordRunResult(
      {
        ...this.save,
        state: this.state,
      },
      finalizedRun,
    );
    saveData(this.save);
    this.bgmManager.playDeathOneShot();
    this.renderEndingPanel(finalizedRun.endingId, "normal");
    const preShakeTarget = this.refs.game.querySelector<HTMLElement>(".game-main-card") ?? this.refs.game;
    void (async () => {
      if (!this.hasRunEndHapticFired) {
        this.hasRunEndHapticFired = true;
        hapticGameOver();
      }
      await this.transitionManager.playPreShake(preShakeTarget, 260);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, ENDING_TRANSITION_DELAY_MS);
      });
      this.openEndingWithRise();
    })();
  }

  private transitionToLobby(): Promise<void> {
    this.clearEndingDexPreviewState();
    this.toggleEnding(false);
    return this.transitionManager.transitionTo("lobby", {
      type: "slide",
      direction: "right",
      onMid: () => this.showScreen("lobby"),
    });
  }

  private toggleEnding(open: boolean): void {
    if (open) {
      showPanelWithTransition(this.refs.endingOverlay);
    } else {
      // Ending overlay closes via screen transition flow, so skip exit animation.
      clearPanelTransition(this.refs.endingOverlay);
      this.refs.endingOverlay.classList.add("hidden");
    }
    if (!open) {
      this.endingPanelMode = "normal";
      this.activeEndingPanelId = null;
      this.updateEndingPanelPrimaryButtonLabel();
    }
    this.refs.btnWork.disabled = open;
    this.refs.btnEat.disabled = open;
    this.refs.btnGuest.disabled = open;
  }

  private openEndingWithRise(): void {
    this.toggleEnding(true);
  }

  private setOverlayOpen(overlay: HTMLElement, open: boolean): void {
    if (open) {
      showPanelWithTransition(overlay);
      return;
    }
    hidePanelWithTransition(overlay);
  }

  private renderEndingPanel(endingId: string, mode: "normal" | "preview"): void {
    this.endingPanelMode = mode;
    this.activeEndingPanelId = endingId;
    this.refs.endingTitle.textContent = t(`ending.${endingId}.title`);
    const desc = t(`ending.${endingId}.desc`);
    if (!desc.startsWith("[[missing:")) {
      this.refs.endingDesc.textContent = desc;
    } else {
      const condition = t(`ending.${endingId}.condition`);
      this.refs.endingDesc.textContent =
        condition.startsWith("[[missing:") ? getEndingCondition(endingId, getLanguage()) : condition;
    }
    this.updateEndingPanelPrimaryButtonLabel();
  }

  private renderGameUi(forceLogRefresh = false): void {
    const stage = getStage(this.state.thighCm);

    this.refs.hudDay.textContent = t("hud.day", { day: this.state.day });
    this.refs.hudStage.textContent = t("hud.stage", { stage });
    this.uiAnimController.setCounterTarget("credits", Math.round(this.state.money));
    this.uiAnimController.setCounterTarget("stress", Math.round(this.state.stress));
    this.uiAnimController.setCounterTarget("thigh", Math.round(this.state.thighCm));
    this.updateActionSlots(this.state.actionsRemaining);
    this.updateStressDangerState(this.state.stress, this.state.stress100Days);

    this.refs.btnWork.disabled = this.state.actionsRemaining <= 0;
    this.refs.btnEat.disabled = this.state.actionsRemaining <= 0;
    this.refs.btnGuest.disabled = this.state.actionsRemaining <= 0;
    this.updateActionHints(stage);

    this.renderLogs(forceLogRefresh);
    this.renderer?.render(this.state);
    if (this.activeScreen === "game") {
      this.registerBuffMilestones(stage);
      const giantBgIndex = this.getGiantBgIndexForStage(stage);
      const stageIncreased = this.lastHapticStage !== null && stage > this.lastHapticStage;
      const bgTransitioned =
        this.lastHapticGiantBgIndex !== null &&
        giantBgIndex > this.lastHapticGiantBgIndex;

      if (bgTransitioned) {
        hapticStageBgTransition();
      } else if (stageIncreased) {
        hapticStageUp();
      }

      this.lastHapticStage = stage;
      this.lastHapticGiantBgIndex = giantBgIndex;
      this.updateBgmContext(stage);
      void this.tryShowNextBuffCard();
    }
  }

  private getGiantBgIndexForStage(stage: number): number {
    if (stage < GIANT_TRIGGER_STAGE_START) return 0;
    const rank = Math.floor((stage - GIANT_TRIGGER_STAGE_START) / GIANT_TRIGGER_STAGE_INTERVAL) + 1;
    return Math.min(rank, ASSET_KEYS_GIANT_BG.length);
  }

  private updateBgmContext(stageOverride?: number): void {
    if (this.activeScreen === "leaderboard") {
      this.bgmManager.setContext({ screen: "leaderboard" });
      return;
    }

    if (this.activeScreen === "score") {
      this.bgmManager.setContext({ screen: "result" });
      return;
    }

    if (this.activeScreen === "game") {
      const stage = stageOverride ?? getStage(this.state.thighCm);
      this.bgmManager.setContext({ screen: "game", stage });
      return;
    }

    this.bgmManager.setContext({ screen: "lobby" });
  }

  private updateActionSlots(actionsRemaining: number): void {
    const usedCount = Math.max(0, Math.min(TURN_SLOT_KEYS.length, TURN_SLOT_KEYS.length - actionsRemaining));
    const slots = [this.refs.hudSlotMorning, this.refs.hudSlotNoon, this.refs.hudSlotEvening];
    for (let i = 0; i < slots.length; i += 1) {
      const isUsed = i < usedCount;
      const isActive = i === usedCount && usedCount < slots.length;
      slots[i].classList.toggle("hud-chip--used", isUsed);
      slots[i].classList.toggle("ui-chip--used", isUsed);
      slots[i].classList.toggle("hud-chip--active", isActive);
      slots[i].classList.toggle("ui-chip--active", isActive);
    }
  }

  private updateActionHints(stage: number): void {
    const workBaseGain = WORK_BASE_MONEY + this.state.day * WORK_DAY_SLOPE;
    const workExpectedGain = Math.round(
      workBaseGain *
        (this.state.noaWorkCharges > 0 ? 1.5 : 1) *
        this.state.buffs.creditGainMult,
    );
    const eatExpectedCost = Math.round(
      (EAT_BASE_COST + this.state.thighCm * EAT_COST_PER_CM) *
        this.state.buffs.eatCostMult,
    );
    const guestCost = Math.round(getGuestCost(stage) * this.state.buffs.guestCostMult);

    this.refs.actionHintWork.textContent = `+${this.creditNumberFormatter.format(workExpectedGain)}`;
    this.refs.actionHintEat.textContent = `-${this.creditNumberFormatter.format(eatExpectedCost)}`;
    this.refs.actionHintGuest.textContent = `-${this.creditNumberFormatter.format(guestCost)}`;
  }

  private updateStressDangerState(stress: number, stress100Days: number): void {
    const target = this.refs.hudStress;
    if (stress < 100) {
      target.classList.remove("hud-stress--danger", "hud-stress--shadow", "hud-stress--critical", "hud-stress--critical-max");
      target.style.removeProperty("--stress-danger-color");
      target.style.removeProperty("--stress-danger-shadow-alpha");
      target.style.removeProperty("--stress-danger-shake");
      return;
    }

    const ratio = Math.max(0, Math.min(1, stress100Days / 10));
    const red = Math.round(48 + 182 * ratio);
    const green = Math.round(36 - 24 * ratio);
    const blue = Math.round(48 - 24 * ratio);
    const shadowAlpha = (0.08 + ratio * 0.42).toFixed(3);
    const shakePx = (0.4 + ratio * 1.2).toFixed(2);

    // Day 1~7 at stress 100: keep color warning only, no shadow/pulse.
    const shadowEnabled = stress100Days > 7;
    target.classList.add("hud-stress--danger");
    target.classList.toggle("hud-stress--shadow", shadowEnabled);
    target.classList.toggle("hud-stress--critical", stress100Days >= 8);
    target.classList.toggle("hud-stress--critical-max", stress100Days >= 9);
    target.style.setProperty("--stress-danger-color", `rgb(${red}, ${green}, ${blue})`);
    target.style.setProperty("--stress-danger-shadow-alpha", shadowAlpha);
    target.style.setProperty("--stress-danger-shake", `${shakePx}px`);
  }

  private renderLogs(forceRefresh = false): void {
    const logs = this.state.logs;
    const cooldownActive = this.uiAnimController.isCooldownActive();

    if (logs.length === 0) {
      this.uiAnimController.clearLogTypewriter();
      this.renderedRawLogs = [];
      this.refs.logs.innerHTML = "";
      const empty = document.createElement("li");
      empty.className = "log-empty";
      empty.textContent = `${LOG_EMOJI_PREFIX.system}${t("log.empty")}`;
      this.refs.logs.append(empty);
      this.scrollLogsToBottom();
      return;
    }

    const canAppendOnly =
      !forceRefresh &&
      logs.length >= this.renderedRawLogs.length &&
      this.renderedRawLogs.every((value, index) => value === logs[index]);

    if (!canAppendOnly) {
      this.uiAnimController.clearLogTypewriter();
      this.refs.logs.innerHTML = "";
      for (const line of logs) {
        const item = document.createElement("li");
        item.className = "log-line";
        item.textContent = this.formatLogLine(line);
        this.refs.logs.append(item);
      }
      this.renderedRawLogs = logs.slice();
      this.scrollLogsToBottom();
      return;
    }

    if (logs.length === this.renderedRawLogs.length) {
      return;
    }

    this.uiAnimController.finalizeCurrentLogLine();
    if (this.refs.logs.querySelector(".log-empty")) {
      this.refs.logs.innerHTML = "";
    }

    const appended = logs.slice(this.renderedRawLogs.length);
    for (const line of appended) {
      const item = document.createElement("li");
      item.className = "log-line";
      this.refs.logs.append(item);
      const text = this.formatLogLine(line);
      if (cooldownActive) {
        item.textContent = text;
      } else {
        item.textContent = "";
        this.uiAnimController.appendLogLine(item, text);
      }
    }
    this.renderedRawLogs = logs.slice();
    this.scrollLogsToBottom();
  }

  private scrollLogsToBottom(): void {
    requestAnimationFrame(() => {
      this.refs.logs.scrollTop = this.refs.logs.scrollHeight;
    });
  }

  private formatLogLine(line: string): string {
    const payload = decodeLog(line);
    if (!payload) return `${LOG_EMOJI_PREFIX.system}${line}`;
    const prefix = this.resolveLogPrefix(payload);
    const params = payload.params ?? {};

    if (payload.key === "log.work") {
      return `${prefix}${t(payload.key, {
        credits: formatNumber(Number(params.credits)),
        stress: Number(params.stress),
      })}`;
    }

    if (payload.key === "log.workNoa") {
      return `${prefix}${t(payload.key, {
        credits: formatNumber(Number(params.credits)),
        stress: Number(params.stress),
        charges: Number(params.charges),
      })}`;
    }

    if (payload.key === "log.eat") {
      return `${prefix}${t(payload.key, {
        credits: formatNumber(Number(params.credits)),
        thigh: Number(params.thigh),
        stress: Number(params.stress),
      })}`;
    }

    if (payload.key === "log.guest") {
      const nameKey = String(params.nameKey ?? "");
      const effectKey = String(params.effectKey ?? "");
      return `${prefix}${t(payload.key, {
        name: t(nameKey),
        effect: t(effectKey),
      })}`;
    }

    return `${prefix}${t(payload.key, params)}`;
  }

  private resolveLogPrefix(payload: { key: string; kind?: string }): string {
    if (payload.kind === "work") return LOG_EMOJI_PREFIX.work;
    if (payload.kind === "eat") return LOG_EMOJI_PREFIX.eat;
    if (payload.kind === "guest") return LOG_EMOJI_PREFIX.guest;
    if (payload.kind === "system") return LOG_EMOJI_PREFIX.system;

    if (payload.key === "log.work" || payload.key === "log.workNoa") return LOG_EMOJI_PREFIX.work;
    if (payload.key === "log.eat") return LOG_EMOJI_PREFIX.eat;
    if (payload.key === "log.guest") return LOG_EMOJI_PREFIX.guest;
    return LOG_EMOJI_PREFIX.system;
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
        endingCategory: this.latestResult.endingCategory,
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

  private renderEndingBook(): void {
    this.refs.endingBookBody.innerHTML = "";
    const { collected, total } = this.getEndingBookCounts();
    this.refs.endingBookProgress.textContent = t("endingDex.progress", {
      x: formatNumber(collected),
      y: formatNumber(total),
    });
    this.updateEndingBookButtonLabel();

    for (const ending of ENDING_DEFS) {
      const entry = this.endingCollection[ending.id];
      const unlocked = Boolean(entry);
      const showNewBadge = unlocked && (entry.isNew || this.endingDexSessionNewIds.has(ending.id));
      const row = document.createElement("div");
      row.className = unlocked ? "endingdex-row" : "endingdex-row endingdex-row--locked";

      const nameCell = document.createElement("div");
      nameCell.className = "endingdex-cell endingdex-cell--name";
      if (unlocked) {
        const nameWrap = document.createElement("span");
        nameWrap.className = "ending-book-name";
        nameWrap.textContent = t(ending.titleKey);
        nameCell.append(nameWrap);
        if (showNewBadge) {
          const badge = document.createElement("span");
          badge.className = "ending-book-new ui-badge--new";
          badge.textContent = "NEW";
          nameCell.append(badge);
        }
      } else {
        nameCell.textContent = t("endingDex.unknown");
      }

      const achievedCell = document.createElement("div");
      achievedCell.className = "endingdex-cell endingdex-cell--achieved";
      achievedCell.textContent = unlocked ? t("endingDex.achieved") : t("endingDex.notAchieved");
      achievedCell.classList.add("ending-book-achieved");
      achievedCell.classList.add(unlocked ? "is-achieved" : "is-missed");

      const conditionCell = document.createElement("div");
      conditionCell.className = "endingdex-cell endingdex-cell--button endingdex-cell--condition";
      const conditionButton = document.createElement("button");
      conditionButton.type = "button";
      conditionButton.className = "skin-button ui-btn ui-btn--secondary font-title ending-book-view-button";
      conditionButton.textContent = t("endingDex.btnView");
      conditionButton.addEventListener("click", () => {
        this.openEndingConditionPopup(ending.id, unlocked);
      });
      conditionCell.append(conditionButton);

      const actionCell = document.createElement("div");
      actionCell.className = "endingdex-cell endingdex-cell--button endingdex-cell--desc";
      const viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.className = "skin-button ui-btn ui-btn--secondary font-title ending-book-view-button";
      viewButton.textContent = unlocked ? t("endingDex.btnView") : "🔒";
      viewButton.disabled = !unlocked;
      if (unlocked) {
        viewButton.addEventListener("click", () => {
          this.renderEndingPanel(ending.id, "preview");
          this.toggleEnding(true);
        });
      }
      actionCell.append(viewButton);

      row.append(nameCell, achievedCell, conditionCell, actionCell);
      this.refs.endingBookBody.append(row);
    }
  }

  private openEndingConditionPopup(endingId: string, unlocked: boolean): void {
    this.refs.endingConditionTitle.textContent = unlocked ? t(`ending.${endingId}.title`) : t("endingDex.unknown");
    const condition = t(`ending.${endingId}.condition`);
    this.refs.endingConditionBody.textContent =
      condition.startsWith("[[missing:") ? getEndingCondition(endingId, getLanguage()) : condition;
    this.setOverlayOpen(this.refs.endingConditionOverlay, true);
  }

  private snapshotAndClearEndingDexNewFlags(): void {
    this.endingDexSessionNewIds.clear();
    for (const [endingId, entry] of Object.entries(this.endingCollection)) {
      if (entry.isNew) {
        this.endingDexSessionNewIds.add(endingId);
      }
    }
    // Clear persisted NEW flags once the dex is opened.
    this.endingCollection = clearAllNewFlags(this.endingCollection);
  }

  private clearEndingDexPreviewState(): void {
    this.endingDexSessionNewIds.clear();
    this.endingCollection = clearAllNewFlags(this.endingCollection);
  }

  private createLeaderboardCell(value: string): HTMLTableCellElement {
    const cell = document.createElement("td");
    cell.textContent = value;
    return cell;
  }

  private getEndingLabel(endingId: string): string {
    return getEndingTitle(endingId, getLanguage());
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
    }
    if (this.activeEndingPanelId) {
      this.renderEndingPanel(this.activeEndingPanelId, this.endingPanelMode);
    }
  }
}
