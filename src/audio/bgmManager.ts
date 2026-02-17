import {
  ASSET_PATH_BGM_MANIFEST,
  BGM_CATEGORIES,
  BGM_CONTEXT_GAP_MS,
  BGM_DEFAULT_CROSSFADE_MS,
  BGM_GAME_EARLY_MAX_STAGE,
  BGM_GAME_END_MAX_STAGE,
  BGM_GAME_LATE_MAX_STAGE,
  BGM_GAME_MID_MAX_STAGE,
  BGM_HARD_SWITCH_CROSSFADE_MS,
  BGM_MAX_LOAD_RETRIES,
} from "../core/constants";

type BgmCategory = (typeof BGM_CATEGORIES)[number];
type BgmManifest = Record<BgmCategory, string[]>;

export type BgmScreen = "lobby" | "leaderboard" | "game" | "result";

export interface BgmContext {
  screen: BgmScreen;
  stage?: number;
}

const SILENT_WAV_DATA_URI = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

function createEmptyManifest(): BgmManifest {
  return {
    lobby: [],
    leaderboard: [],
    gameearly: [],
    gamemid: [],
    gamelate: [],
    gameend: [],
    gamefinal: [],
    result: [],
  };
}

function normalizeRelativePath(value: string): string {
  return value.replace(/^\/+/, "");
}

function isSupportedAudioPath(value: string): boolean {
  return /\.(mp3|ogg|wav)$/i.test(value);
}

function normalizeManifest(input: unknown): BgmManifest {
  const normalized = createEmptyManifest();
  if (!input || typeof input !== "object") return normalized;
  const source = input as Record<string, unknown>;

  for (const category of BGM_CATEGORIES) {
    const rawList = Array.isArray(source[category]) ? source[category] : [];
    const list = rawList
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeRelativePath(item))
      .filter((item) => item.length > 0 && isSupportedAudioPath(item))
      .sort((a, b) => a.localeCompare(b));
    normalized[category] = list;
  }

  return normalized;
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function createAudioElement(): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = "auto";
  audio.loop = false;
  return audio;
}

export class BgmManager {
  private manifest = createEmptyManifest();
  private manifestPromise: Promise<void> | null = null;
  private loaded = false;

  private readonly bagByCategory: BgmManifest = createEmptyManifest();

  private readonly audioA = createAudioElement();
  private readonly audioB = createAudioElement();
  private activeSlot: "a" | "b" | null = null;
  private activeCategory: BgmCategory | null = null;
  private desiredCategory: BgmCategory = "lobby";

  private bgmVolume = 0.5;
  private masterMuted = false;
  private unlocked = false;
  private unlocking = false;
  private switchToken = 0;

  private readonly fadeRafByAudio = new Map<HTMLAudioElement, number>();
  private readonly fadeVersionByAudio = new Map<HTMLAudioElement, number>();
  private readonly fadeFactorByAudio = new Map<HTMLAudioElement, number>([
    [this.audioA, 0],
    [this.audioB, 0],
  ]);
  private readonly unlockProbe = new Audio(SILENT_WAV_DATA_URI);

  constructor() {
    this.unlockProbe.preload = "auto";

    this.audioA.addEventListener("ended", () => {
      void this.handleTrackEnded(this.audioA);
    });
    this.audioB.addEventListener("ended", () => {
      void this.handleTrackEnded(this.audioB);
    });
  }

  setVolume(bgmVolume: number, masterMuted: boolean): void {
    this.bgmVolume = Number.isFinite(bgmVolume) ? Math.max(0, Math.min(1, bgmVolume)) : 0.5;
    this.masterMuted = masterMuted;
    this.applyVolumes();
  }

  setContext(context: BgmContext): void {
    const nextCategory = this.resolveCategory(context);
    const changed = nextCategory !== this.desiredCategory;
    this.desiredCategory = nextCategory;

    void this.ensureManifestLoaded();

    if (changed) {
      void this.switchToDesiredCategory({ includeGap: true });
      return;
    }

    if (this.unlocked && !this.getActiveAudio()) {
      void this.switchToDesiredCategory({ includeGap: false });
    }
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (!this.getActiveAudio()) {
        void this.switchToDesiredCategory({ includeGap: false });
      }
      return;
    }
    if (this.unlocking) return;
    this.unlocking = true;

    try {
      this.unlockProbe.muted = true;
      this.unlockProbe.volume = 0;
      this.unlockProbe.currentTime = 0;
      await this.unlockProbe.play();
      this.unlockProbe.pause();
      this.unlockProbe.currentTime = 0;
      this.unlocked = true;
    } catch {
      this.unlocked = false;
    } finally {
      this.unlocking = false;
      this.unlockProbe.muted = false;
    }

    if (this.unlocked) {
      this.applyVolumes();
      void this.switchToDesiredCategory({ includeGap: false });
    }
  }

  destroy(): void {
    this.switchToken += 1;
    this.cancelFade(this.audioA);
    this.cancelFade(this.audioB);
    this.stopAudio(this.audioA);
    this.stopAudio(this.audioB);
    this.activeSlot = null;
    this.activeCategory = null;
  }

  private async ensureManifestLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.manifestPromise) {
      await this.manifestPromise;
      return;
    }

    this.manifestPromise = (async () => {
      try {
        const response = await fetch(ASSET_PATH_BGM_MANIFEST, { cache: "no-cache" });
        if (!response.ok) {
          this.manifest = createEmptyManifest();
          return;
        }
        const payload = await response.json();
        this.manifest = normalizeManifest(payload);
      } catch {
        this.manifest = createEmptyManifest();
      } finally {
        this.loaded = true;
      }
    })();

    await this.manifestPromise;
  }

  private resolveCategory(context: BgmContext): BgmCategory {
    if (context.screen === "lobby") return "lobby";
    if (context.screen === "leaderboard") return "leaderboard";
    if (context.screen === "result") return "result";

    const stage = Math.max(1, Math.round(context.stage ?? 1));
    if (stage <= BGM_GAME_EARLY_MAX_STAGE) return "gameearly";
    if (stage <= BGM_GAME_MID_MAX_STAGE) return "gamemid";
    if (stage <= BGM_GAME_LATE_MAX_STAGE) return "gamelate";
    if (stage <= BGM_GAME_END_MAX_STAGE) return "gameend";
    return "gamefinal";
  }

  private async switchToDesiredCategory(options: { includeGap: boolean }): Promise<void> {
    const targetCategory = this.desiredCategory;
    const token = ++this.switchToken;

    await this.ensureManifestLoaded();
    if (token !== this.switchToken) return;
    if (!this.unlocked) return;

    const oldAudio = this.getActiveAudio();
    const oldCategory = this.activeCategory;
    const categoryChanged = oldCategory !== null && oldCategory !== targetCategory;
    const fadeMs = this.resolveCrossfadeMs(targetCategory);

    if (oldAudio && !oldAudio.paused && categoryChanged) {
      await this.fadeAudio(oldAudio, this.getFadeFactor(oldAudio), 0, fadeMs, token);
      if (token !== this.switchToken) return;
      this.stopAudio(oldAudio);
      this.setFadeFactor(oldAudio, 0);
      this.applyVolumeToAudio(oldAudio);

      if (options.includeGap) {
        await this.delay(BGM_CONTEXT_GAP_MS);
        if (token !== this.switchToken) return;
      }
    }

    if (oldCategory === targetCategory && oldAudio && !oldAudio.paused) {
      return;
    }

    const started = await this.startNextTrackInCategory(targetCategory, token, fadeMs);
    if (!started) {
      this.activeCategory = targetCategory;
      this.activeSlot = null;
    }
  }

  private async handleTrackEnded(audio: HTMLAudioElement): Promise<void> {
    if (this.getActiveAudio() !== audio) return;
    if (!this.unlocked) return;
    const category = this.activeCategory;
    if (!category) return;
    if (category !== this.desiredCategory) {
      void this.switchToDesiredCategory({ includeGap: true });
      return;
    }

    const token = ++this.switchToken;
    await this.startNextTrackInCategory(category, token, this.resolveCrossfadeMs(category));
  }

  private async startNextTrackInCategory(category: BgmCategory, token: number, fadeMs: number): Promise<boolean> {
    const tracks = this.manifest[category];
    if (!tracks || tracks.length === 0) return false;

    const nextAudio = this.getInactiveAudio();
    const maxAttempts = Math.max(1, Math.min(BGM_MAX_LOAD_RETRIES, tracks.length));

    for (let i = 0; i < maxAttempts; i += 1) {
      if (token !== this.switchToken) return false;
      const relativePath = this.pickNextTrack(category);
      if (!relativePath) return false;
      const started = await this.playOnAudio(nextAudio, `/assets/bgm/${normalizeRelativePath(relativePath)}`, token);
      if (!started) continue;

      this.setActiveAudio(nextAudio);
      this.activeCategory = category;
      this.setFadeFactor(nextAudio, 0);
      this.applyVolumeToAudio(nextAudio);
      await this.fadeAudio(nextAudio, 0, 1, fadeMs, token);
      return true;
    }

    return false;
  }

  private pickNextTrack(category: BgmCategory): string | null {
    const tracks = this.manifest[category];
    if (!tracks || tracks.length === 0) return null;
    if (tracks.length === 1) return tracks[0];

    let bag = this.bagByCategory[category];
    if (bag.length === 0) {
      bag = [...tracks];
      shuffleInPlace(bag);
      this.bagByCategory[category] = bag;
    }

    return bag.pop() ?? null;
  }

  private async playOnAudio(audio: HTMLAudioElement, url: string, token: number): Promise<boolean> {
    this.cancelFade(audio);
    this.stopAudio(audio);
    audio.src = url;
    this.setFadeFactor(audio, 0);
    this.applyVolumeToAudio(audio);

    try {
      await audio.play();
      if (token !== this.switchToken) {
        this.stopAudio(audio);
        return false;
      }
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        // Autoplay can be blocked again on some platforms; retry unlock on next gesture.
        this.unlocked = false;
      }
      this.stopAudio(audio);
      return false;
    }
  }

  private stopAudio(audio: HTMLAudioElement): void {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // ignore seek failures on not-ready elements
    }
  }

  private resolveCrossfadeMs(category: BgmCategory): number {
    if (category === "gameend" || category === "gamefinal") {
      return BGM_HARD_SWITCH_CROSSFADE_MS;
    }
    return BGM_DEFAULT_CROSSFADE_MS;
  }

  private getActiveAudio(): HTMLAudioElement | null {
    if (this.activeSlot === "a") return this.audioA;
    if (this.activeSlot === "b") return this.audioB;
    return null;
  }

  private getInactiveAudio(): HTMLAudioElement {
    if (this.activeSlot === "a") return this.audioB;
    return this.audioA;
  }

  private setActiveAudio(audio: HTMLAudioElement): void {
    this.activeSlot = audio === this.audioA ? "a" : "b";
  }

  private getFadeFactor(audio: HTMLAudioElement): number {
    return this.fadeFactorByAudio.get(audio) ?? 0;
  }

  private setFadeFactor(audio: HTMLAudioElement, factor: number): void {
    this.fadeFactorByAudio.set(audio, Math.max(0, Math.min(1, factor)));
  }

  private effectiveVolume(): number {
    return this.masterMuted ? 0 : this.bgmVolume;
  }

  private applyVolumes(): void {
    this.applyVolumeToAudio(this.audioA);
    this.applyVolumeToAudio(this.audioB);
  }

  private applyVolumeToAudio(audio: HTMLAudioElement): void {
    audio.volume = this.effectiveVolume() * this.getFadeFactor(audio);
  }

  private cancelFade(audio: HTMLAudioElement): void {
    const rafId = this.fadeRafByAudio.get(audio);
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId);
      this.fadeRafByAudio.delete(audio);
    }
    const nextVersion = (this.fadeVersionByAudio.get(audio) ?? 0) + 1;
    this.fadeVersionByAudio.set(audio, nextVersion);
  }

  private fadeAudio(
    audio: HTMLAudioElement,
    from: number,
    to: number,
    durationMs: number,
    token: number,
  ): Promise<void> {
    this.cancelFade(audio);
    if (durationMs <= 0 || from === to) {
      this.setFadeFactor(audio, to);
      this.applyVolumeToAudio(audio);
      return Promise.resolve();
    }

    const version = (this.fadeVersionByAudio.get(audio) ?? 0) + 1;
    this.fadeVersionByAudio.set(audio, version);

    return new Promise((resolve) => {
      const startedAt = performance.now();
      const tick = (now: number) => {
        if (token !== this.switchToken) {
          resolve();
          return;
        }
        if (this.fadeVersionByAudio.get(audio) !== version) {
          resolve();
          return;
        }

        const t = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
        const factor = from + (to - from) * t;
        this.setFadeFactor(audio, factor);
        this.applyVolumeToAudio(audio);

        if (t >= 1) {
          this.fadeRafByAudio.delete(audio);
          resolve();
          return;
        }
        const raf = requestAnimationFrame(tick);
        this.fadeRafByAudio.set(audio, raf);
      };

      const raf = requestAnimationFrame(tick);
      this.fadeRafByAudio.set(audio, raf);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}
