import Phaser from "phaser";
import {
  ASSET_KEY_BG_MAIN_OFFICE,
  ASSET_KEY_GUEST_MANIFEST,
  ASSET_KEY_YUUKA_BODY,
  ASSET_KEY_YUUKA_THIGH,
  ASSET_PATH_BG_MAIN_OFFICE,
  ASSET_PATH_GUEST_MANIFEST,
  ASSET_PATH_YUUKA_BODY,
  ASSET_PATH_YUUKA_THIGH,
  GUEST_ACTION_SHAKE_ROT_RAD,
  GUEST_ACTION_SHAKE_X_PX,
  GUEST_BASE_TEXTURE_SIZE,
  GUEST_BOB_AMPLITUDE_PX,
  GUEST_CINEMATIC_ACTION_MS,
  GUEST_CINEMATIC_ENTER_MS,
  GUEST_CINEMATIC_EXIT_MS,
  GUEST_CINEMATIC_SKIP_FADE_MS,
  GUEST_ENTER_OFFSCREEN_MARGIN_PX,
  GUEST_ENTER_OFFSCREEN_MULT,
  GUEST_TARGET_HEIGHT_RATIO,
  GUEST_TARGET_X_RATIO,
  PLACEHOLDER_YUUKA_COLOR,
  RENDER_BG_COLOR,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  START_THIGH_CM,
  YUUKA_BASE_SCALE,
  YUUKA_FADEOUT_MS,
  YUUKA_FOOT_GAP_PX,
  YUUKA_GIANT_LOG_A,
  YUUKA_LEVEL_GROWTH_ANIM_MS,
  YUUKA_LOWER_MAX_MULT_L10,
  YUUKA_SEAM_OVERLAP_PX,
  YUUKA_TRANSITION_DURATION_MS,
  YUUKA_TRANSITION_SHAKE_MAX_PX,
  YUUKA_UPPER_JOINT_FROM_TOP_PX,
} from "../core/constants";
import { decodeLog } from "../core/logger";
import { getStage } from "../core/stage";
import type { GameState } from "../core/types";
import { GuestAudioPlayer } from "./guestAudio";
import {
  guestAssetKeyFromLogNameKey,
  guestTextureKey,
  normalizeGuestManifest,
  resolveGuestAssetUrl,
  type GuestAssetKey,
  type GuestManifest,
} from "./guestManifest";

interface RenderSnapshot {
  stage: number;
  thighCm: number;
}

interface GuestCinematicRuntime {
  actor: Phaser.GameObjects.Container;
  sprite?: Phaser.GameObjects.Image;
  footY: number;
  startX: number;
  targetX: number;
  bobTween?: Phaser.Tweens.Tween;
  moveTween?: Phaser.Tweens.Tween;
  actionTween?: Phaser.Tweens.Tween;
}

interface GuestActorBundle {
  actor: Phaser.GameObjects.Container;
  sprite?: Phaser.GameObjects.Image;
  displayWidth: number;
}

type RenderMode = "normal" | "transition" | "giant";

class YuukaScene extends Phaser.Scene {
  private snapshot: RenderSnapshot = {
    stage: 1,
    thighCm: START_THIGH_CM,
  };

  private mode: RenderMode = "normal";
  private prevStage = 1;
  private didInitVisual = false;
  private scaleTween?: Phaser.Tweens.Tween;
  private transitionTween?: Phaser.Tweens.Tween;
  private transitionShakeTween?: Phaser.Tweens.Tween;
  private upperFadeTween?: Phaser.Tweens.Tween;
  private giantBaseScale11?: number;

  private bgSprite?: Phaser.GameObjects.Image;
  private upperSprite?: Phaser.GameObjects.Image;
  private lowerSprite?: Phaser.GameObjects.Image;
  private yuukaPlaceholder?: Phaser.GameObjects.Rectangle;

  private guestManifest: GuestManifest = {};
  private readonly guestAudio = new GuestAudioPlayer();
  private activeGuest?: GuestCinematicRuntime;

  private debugEnabled = false;
  private debugGraphics?: Phaser.GameObjects.Graphics;

  preload(): void {
    this.load.image(ASSET_KEY_BG_MAIN_OFFICE, ASSET_PATH_BG_MAIN_OFFICE);
    this.load.image(ASSET_KEY_YUUKA_BODY, ASSET_PATH_YUUKA_BODY);
    this.load.image(ASSET_KEY_YUUKA_THIGH, ASSET_PATH_YUUKA_THIGH);
    this.load.json(ASSET_KEY_GUEST_MANIFEST, ASSET_PATH_GUEST_MANIFEST);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(RENDER_BG_COLOR);
    this.loadGuestManifest();
    this.queueGuestTexturesFromManifest();

    if (this.textures.exists(ASSET_KEY_BG_MAIN_OFFICE)) {
      this.bgSprite = this.add.image(0, 0, ASSET_KEY_BG_MAIN_OFFICE);
      this.bgSprite.setOrigin(0.5, 0.5);
      this.bgSprite.setDepth(0);
      this.syncBackgroundToPanel();
    }

    if (this.hasSplitTextures()) {
      const centerX = this.getCenterX();
      const footY = this.getFootY();

      this.lowerSprite = this.add.image(centerX, footY, ASSET_KEY_YUUKA_THIGH);
      this.lowerSprite.setOrigin(0.5, 1);
      this.lowerSprite.setDepth(1);

      this.upperSprite = this.add.image(centerX, footY, ASSET_KEY_YUUKA_BODY);
      this.upperSprite.setOrigin(0.5, 0);
      this.upperSprite.setDepth(2);
    }

    this.yuukaPlaceholder = this.add.rectangle(
      RENDER_WIDTH / 2,
      RENDER_HEIGHT / 2,
      320,
      420,
      PLACEHOLDER_YUUKA_COLOR,
    );
    this.yuukaPlaceholder.setDepth(1);

    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(9);
    this.input.keyboard?.on("keydown-D", () => {
      this.debugEnabled = !this.debugEnabled;
      this.updateDebugOverlay();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyActiveGuest(true);
      this.guestAudio.destroy();
      this.stopScaleTween();
      this.stopTransitionTweens();
    });

    this.redraw();
  }

  setSnapshot(snapshot: RenderSnapshot): void {
    this.snapshot = snapshot;
    if (this.sys.isActive()) {
      this.redraw();
    }
  }

  playGuestCinematic(guestKey: GuestAssetKey): void {
    if (!this.sys.isActive()) return;
    if (this.activeGuest) {
      this.skipActiveGuestWithFade();
    }
    this.startGuestCinematic(guestKey);
  }

  private redraw(): void {
    const { stage } = this.snapshot;

    const splitReady = this.hasSplitTextures() && Boolean(this.upperSprite) && Boolean(this.lowerSprite);
    this.lowerSprite?.setVisible(splitReady);
    this.upperSprite?.setVisible(splitReady);
    this.yuukaPlaceholder?.setVisible(!splitReady);

    if (!splitReady) {
      this.stopScaleTween();
      this.stopTransitionTweens();
      this.mode = "normal";
      this.giantBaseScale11 = undefined;
      this.didInitVisual = false;
      this.updateDebugOverlay();
      this.prevStage = stage;
      return;
    }

    if (stage <= 10) {
      this.stopTransitionTweens();
      this.mode = "normal";
      this.giantBaseScale11 = undefined;
      this.applyNormalVisual(stage);
    } else if (this.prevStage === 10 && this.mode !== "giant" && this.mode !== "transition") {
      this.startTransitionFromStage10To11();
    } else if (this.mode === "giant") {
      this.applyGiantScale(stage);
    } else if (this.mode === "transition") {
      // Transition tween drives scale and positioning until completion.
    } else {
      this.mode = "giant";
      this.upperSprite?.setVisible(false);
      this.upperSprite?.setAlpha(0);
      if (this.giantBaseScale11 === undefined) {
        this.giantBaseScale11 = this.getStage11BaseLowerScale();
      }
      this.applyGiantScale(stage);
    }

    this.prevStage = stage;
  }

  private applyNormalVisual(stage: number): void {
    if (!this.upperSprite || !this.lowerSprite) return;
    const lowerScale = YUUKA_BASE_SCALE * this.scaleMultForStage(stage);

    this.upperSprite.setVisible(true);
    this.upperSprite.setAlpha(1);
    this.animateSplitScaleTo(YUUKA_BASE_SCALE, lowerScale, true);
  }

  private startTransitionFromStage10To11(): void {
    if (!this.upperSprite || !this.lowerSprite) return;
    this.stopScaleTween();
    this.stopTransitionTweens();
    this.mode = "transition";

    const lowerMult10 = this.scaleMultForStage(10);
    const base = YUUKA_BASE_SCALE;
    this.upperSprite.setVisible(true);
    this.upperSprite.setAlpha(1);
    this.upperSprite.setScale(base);
    this.lowerSprite.setScale(base * lowerMult10);
    this.syncPositions();

    const lowerNativeH = this.getLowerNativeHeight();
    // Stage 11 target:
    // (lowerTopY + 10 * lowerScale) == 0
    // => footY - (nativeH * lowerScale) + 10 * lowerScale == 0
    // => lowerScale == footY / (nativeH - 10)
    // kTarget converts the stage10 lower scale to that target scale.
    const kTargetRaw = this.getFootY() / ((lowerNativeH - 10) * base * lowerMult10);
    const kTarget = Math.max(1, kTargetRaw);
    this.startTransitionShake();

    this.transitionTween = this.tweens.addCounter({
      from: 1,
      to: kTarget,
      duration: YUUKA_TRANSITION_DURATION_MS,
      ease: Phaser.Math.Easing.Quadratic.Out,
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 1;
        this.upperSprite?.setScale(base * k);
        this.lowerSprite?.setScale(base * lowerMult10 * k);
        this.syncPositions();
      },
      onComplete: () => {
        this.transitionTween = undefined;
        this.upperFadeTween = this.tweens.add({
          targets: this.upperSprite,
          alpha: 0,
          duration: YUUKA_FADEOUT_MS,
          onComplete: () => {
            if (!this.lowerSprite || !this.upperSprite) return;
            this.upperFadeTween = undefined;
            this.upperSprite.setVisible(false);
            this.mode = "giant";
            if (this.giantBaseScale11 === undefined) {
              this.giantBaseScale11 = this.getStage11BaseLowerScale();
            }
            this.applyGiantScale(this.snapshot.stage);
          },
        });
      },
    });
  }

  private applyGiantScale(stage: number): void {
    if (!this.upperSprite || !this.lowerSprite) return;
    const base11 = this.giantBaseScale11 ?? this.getStage11BaseLowerScale();
    this.giantBaseScale11 = base11;
    const progress = Math.max(0, stage - 11);
    const lowerScale = base11 + YUUKA_GIANT_LOG_A * Math.log1p(progress);

    this.upperSprite.setVisible(false);
    this.animateSplitScaleTo(this.upperSprite.scaleX || YUUKA_BASE_SCALE, lowerScale, true);
  }

  private scaleMultForStage(stage: number): number {
    if (stage <= 1) return 1;
    if (stage >= 10) return YUUKA_LOWER_MAX_MULT_L10;
    const t01 = (stage - 1) / 9;
    return Math.pow(YUUKA_LOWER_MAX_MULT_L10, t01);
  }

  private syncPositions(): void {
    if (!this.upperSprite || !this.lowerSprite) return;
    const centerX = this.getCenterX();
    const footY = this.getFootY();

    this.lowerSprite.setPosition(centerX, footY);

    // Joint math:
    // lowerTopY = footY - lowerDisplayHeight
    // upperY = lowerTopY - (upperJointFromTop * upperScale) + seamOverlap
    const lowerTopY = footY - this.lowerSprite.displayHeight;
    const upperScale = this.upperSprite.scaleY;
    const upperY =
      lowerTopY - YUUKA_UPPER_JOINT_FROM_TOP_PX * upperScale + YUUKA_SEAM_OVERLAP_PX;
    this.upperSprite.setPosition(centerX, upperY);

    this.updateDebugOverlay();
  }

  private updateDebugOverlay(): void {
    if (!this.debugGraphics) return;
    this.debugGraphics.clear();
    if (!this.debugEnabled) return;

    const footY = this.getFootY();
    const centerX = this.getCenterX();
    this.debugGraphics.lineStyle(2, 0x51f5ff, 0.9);
    this.debugGraphics.lineBetween(0, footY, RENDER_WIDTH, footY);

    if (!this.lowerSprite) return;
    const jointY = footY - this.lowerSprite.displayHeight;
    this.debugGraphics.lineStyle(2, 0xffaa4a, 0.9);
    this.debugGraphics.lineBetween(0, jointY, RENDER_WIDTH, jointY);
    this.debugGraphics.fillStyle(0xff3f6c, 1);
    this.debugGraphics.fillCircle(centerX, jointY, 4);
  }

  private stopTransitionTweens(): void {
    this.transitionTween?.stop();
    this.transitionTween = undefined;
    this.transitionShakeTween?.stop();
    this.transitionShakeTween = undefined;
    this.cameras.main.setScroll(0, 0);
    this.upperFadeTween?.stop();
    this.upperFadeTween = undefined;
  }

  private stopScaleTween(): void {
    this.scaleTween?.stop();
    this.scaleTween = undefined;
  }

  private animateSplitScaleTo(
    targetUpperScale: number,
    targetLowerScale: number,
    allowAnimation: boolean,
  ): void {
    if (!this.upperSprite || !this.lowerSprite) return;

    const currentUpperScale = this.upperSprite.scaleX || targetUpperScale;
    const currentLowerScale = this.lowerSprite.scaleX || targetLowerScale;
    const changed =
      Math.abs(currentUpperScale - targetUpperScale) > 0.0001 ||
      Math.abs(currentLowerScale - targetLowerScale) > 0.0001;
    const shouldAnimate = allowAnimation && this.didInitVisual && changed;

    this.stopScaleTween();

    if (!shouldAnimate) {
      this.upperSprite.setScale(targetUpperScale);
      this.lowerSprite.setScale(targetLowerScale);
      this.syncPositions();
      this.didInitVisual = true;
      return;
    }

    const tweenState = {
      upper: currentUpperScale,
      lower: currentLowerScale,
    };

    this.scaleTween = this.tweens.add({
      targets: tweenState,
      upper: targetUpperScale,
      lower: targetLowerScale,
      duration: YUUKA_LEVEL_GROWTH_ANIM_MS,
      ease: Phaser.Math.Easing.Quadratic.Out,
      onUpdate: () => {
        this.upperSprite?.setScale(tweenState.upper);
        this.lowerSprite?.setScale(tweenState.lower);
        this.syncPositions();
      },
      onComplete: () => {
        this.scaleTween = undefined;
        this.upperSprite?.setScale(targetUpperScale);
        this.lowerSprite?.setScale(targetLowerScale);
        this.syncPositions();
      },
    });
    this.didInitVisual = true;
  }

  private startTransitionShake(): void {
    this.transitionShakeTween?.stop();
    this.transitionShakeTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: YUUKA_TRANSITION_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        const envelope = Math.sin(Math.PI * progress);
        const amplitude = YUUKA_TRANSITION_SHAKE_MAX_PX * envelope;
        const jitterX = Phaser.Math.FloatBetween(-amplitude, amplitude);
        const jitterY = Phaser.Math.FloatBetween(-amplitude * 0.35, amplitude * 0.35);
        this.cameras.main.setScroll(jitterX, jitterY);
      },
      onComplete: () => {
        this.transitionShakeTween = undefined;
        this.cameras.main.setScroll(0, 0);
      },
    });
  }

  private hasSplitTextures(): boolean {
    return this.textures.exists(ASSET_KEY_YUUKA_BODY) && this.textures.exists(ASSET_KEY_YUUKA_THIGH);
  }

  private getCenterX(): number {
    return RENDER_WIDTH / 2;
  }

  private getFootY(): number {
    return RENDER_HEIGHT - YUUKA_FOOT_GAP_PX;
  }

  private getLowerNativeHeight(): number {
    const texture = this.textures.get(ASSET_KEY_YUUKA_THIGH);
    const source = texture?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!source) return 515;
    const nativeHeight =
      "naturalHeight" in source ? source.naturalHeight : "height" in source ? source.height : 515;
    return nativeHeight > 0 ? nativeHeight : 515;
  }

  private getStage11BaseLowerScale(): number {
    const lowerNativeH = this.getLowerNativeHeight();
    const denominator = Math.max(lowerNativeH - 10, 1);
    return this.getFootY() / denominator;
  }

  private syncBackgroundToPanel(): void {
    if (!this.bgSprite) return;
    const texture = this.textures.get(ASSET_KEY_BG_MAIN_OFFICE);
    const source = texture?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!source) return;

    const nativeWidth =
      "naturalWidth" in source ? source.naturalWidth : "width" in source ? source.width : 0;
    const nativeHeight =
      "naturalHeight" in source ? source.naturalHeight : "height" in source ? source.height : 0;
    if (nativeWidth <= 0 || nativeHeight <= 0) return;

    // Keep original aspect ratio: fit by panel height, then clip overflow on left/right.
    const scale = RENDER_HEIGHT / nativeHeight;
    this.bgSprite.setScale(scale);
    this.bgSprite.setPosition(RENDER_WIDTH / 2, RENDER_HEIGHT / 2);
  }

  private loadGuestManifest(): void {
    if (!this.cache.json.exists(ASSET_KEY_GUEST_MANIFEST)) {
      this.guestManifest = {};
      return;
    }
    const raw = this.cache.json.get(ASSET_KEY_GUEST_MANIFEST);
    this.guestManifest = normalizeGuestManifest(raw);
  }

  private queueGuestTexturesFromManifest(): void {
    let hasQueued = false;
    const entries = Object.entries(this.guestManifest) as [GuestAssetKey, GuestManifest[GuestAssetKey]][];
    for (const [guestKey, entry] of entries) {
      if (!entry?.image) continue;
      const textureKey = guestTextureKey(guestKey);
      if (this.textures.exists(textureKey)) continue;
      this.load.image(textureKey, resolveGuestAssetUrl(entry.image));
      hasQueued = true;
    }
    if (hasQueued) {
      this.load.start();
    }
  }

  private startGuestCinematic(guestKey: GuestAssetKey): void {
    const footY = this.getFootY();
    const baseScale = (RENDER_HEIGHT * GUEST_TARGET_HEIGHT_RATIO) / GUEST_BASE_TEXTURE_SIZE;
    const targetX = RENDER_WIDTH * GUEST_TARGET_X_RATIO;
    const actorBundle = this.createGuestActor(guestKey, baseScale, footY);
    const startX =
      RENDER_WIDTH + actorBundle.displayWidth * GUEST_ENTER_OFFSCREEN_MULT + GUEST_ENTER_OFFSCREEN_MARGIN_PX;
    actorBundle.actor.setPosition(startX, footY);
    actorBundle.sprite?.setFlipX(false);
    const runtime: GuestCinematicRuntime = {
      actor: actorBundle.actor,
      sprite: actorBundle.sprite,
      footY,
      startX,
      targetX,
    };
    this.activeGuest = runtime;

    const voiceUrls = this.getGuestVoiceUrls(guestKey);
    this.guestAudio.playRandom(voiceUrls);

    runtime.bobTween = this.startGuestBob(runtime);
    runtime.moveTween = this.tweens.add({
      targets: runtime.actor,
      x: targetX,
      duration: GUEST_CINEMATIC_ENTER_MS,
      ease: Phaser.Math.Easing.Cubic.Out,
      onComplete: () => {
        if (this.activeGuest !== runtime) return;
        runtime.moveTween = undefined;
        this.stopGuestBob(runtime);
        this.startGuestAction(runtime);
      },
    });
  }

  private startGuestAction(runtime: GuestCinematicRuntime): void {
    runtime.actionTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: GUEST_CINEMATIC_ACTION_MS,
      onUpdate: () => {
        runtime.actor.x = runtime.targetX + Phaser.Math.FloatBetween(-GUEST_ACTION_SHAKE_X_PX, GUEST_ACTION_SHAKE_X_PX);
        runtime.actor.rotation = Phaser.Math.FloatBetween(
          -GUEST_ACTION_SHAKE_ROT_RAD,
          GUEST_ACTION_SHAKE_ROT_RAD,
        );
      },
      onComplete: () => {
        if (this.activeGuest !== runtime) return;
        runtime.actionTween = undefined;
        runtime.actor.x = runtime.targetX;
        runtime.actor.rotation = 0;
        this.startGuestExit(runtime);
      },
    });
  }

  private startGuestExit(runtime: GuestCinematicRuntime): void {
    runtime.sprite?.setFlipX(true);
    runtime.bobTween = this.startGuestBob(runtime);
    runtime.moveTween = this.tweens.add({
      targets: runtime.actor,
      x: runtime.startX,
      duration: GUEST_CINEMATIC_EXIT_MS,
      ease: Phaser.Math.Easing.Cubic.In,
      onComplete: () => {
        if (this.activeGuest !== runtime) return;
        runtime.moveTween = undefined;
        this.stopGuestRuntime(runtime);
        runtime.actor.destroy();
        this.activeGuest = undefined;
      },
    });
  }

  private skipActiveGuestWithFade(): void {
    if (!this.activeGuest) return;
    const runtime = this.activeGuest;
    this.stopGuestRuntime(runtime);
    this.activeGuest = undefined;
    this.guestAudio.stopImmediate();

    this.tweens.add({
      targets: runtime.actor,
      alpha: 0,
      duration: GUEST_CINEMATIC_SKIP_FADE_MS,
      onComplete: () => runtime.actor.destroy(),
    });
  }

  private destroyActiveGuest(immediate: boolean): void {
    if (!this.activeGuest) return;
    const runtime = this.activeGuest;
    this.stopGuestRuntime(runtime);
    this.activeGuest = undefined;
    if (immediate) {
      runtime.actor.destroy();
      this.guestAudio.stopImmediate();
      return;
    }
    this.skipActiveGuestWithFade();
  }

  private stopGuestRuntime(runtime: GuestCinematicRuntime): void {
    runtime.moveTween?.stop();
    runtime.moveTween = undefined;
    runtime.actionTween?.stop();
    runtime.actionTween = undefined;
    this.stopGuestBob(runtime);
    runtime.actor.rotation = 0;
  }

  private startGuestBob(runtime: GuestCinematicRuntime): Phaser.Tweens.Tween {
    runtime.actor.y = runtime.footY;
    return this.tweens.addCounter({
      from: -GUEST_BOB_AMPLITUDE_PX,
      to: GUEST_BOB_AMPLITUDE_PX,
      duration: 90,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: (tween) => {
        runtime.actor.y = runtime.footY + (tween.getValue() ?? 0);
      },
    });
  }

  private stopGuestBob(runtime: GuestCinematicRuntime): void {
    runtime.bobTween?.stop();
    runtime.bobTween = undefined;
    runtime.actor.y = runtime.footY;
  }

  private createGuestActor(
    guestKey: GuestAssetKey,
    baseScale: number,
    footY: number,
  ): GuestActorBundle {
    const actor = this.add.container(0, footY);
    actor.setDepth(4);
    actor.setAlpha(1);
    actor.setScale(baseScale, baseScale);

    const textureKey = guestTextureKey(guestKey);
    if (this.textures.exists(textureKey)) {
      const image = this.add.image(0, 0, textureKey);
      image.setOrigin(0.5, 1);
      image.setFlipX(false);
      actor.add(image);
      return {
        actor,
        sprite: image,
        displayWidth: image.displayWidth * Math.abs(baseScale),
      };
    }

    const placeholder = this.add.rectangle(0, 0, GUEST_BASE_TEXTURE_SIZE, GUEST_BASE_TEXTURE_SIZE, 0x141923, 0.9);
    placeholder.setOrigin(0.5, 1);
    const label = this.add.text(0, -GUEST_BASE_TEXTURE_SIZE * 0.45, guestKey.toUpperCase(), {
      color: "#f3f6ff",
      fontSize: "40px",
      fontFamily: "sans-serif",
    });
    label.setOrigin(0.5);

    actor.add([placeholder, label]);
    return {
      actor,
      displayWidth: GUEST_BASE_TEXTURE_SIZE * Math.abs(baseScale),
    };
  }

  private getGuestVoiceUrls(guestKey: GuestAssetKey): string[] {
    const voices = this.guestManifest[guestKey]?.voices ?? [];
    return voices.map((voicePath) => resolveGuestAssetUrl(voicePath));
  }
}

export class YuukaRenderer {
  private readonly scene: YuukaScene;
  private readonly game: Phaser.Game;
  private initializedLogCursor = false;
  private processedLogCount = 0;

  constructor(parentId: string) {
    this.scene = new YuukaScene("yuuka-scene");
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      width: RENDER_WIDTH,
      height: RENDER_HEIGHT,
      parent: parentId,
      backgroundColor: RENDER_BG_COLOR,
      scene: this.scene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
  }

  render(state: GameState): void {
    this.scene.setSnapshot({
      stage: getStage(state.thighCm),
      thighCm: state.thighCm,
    });
    this.handleGuestTrigger(state);
  }

  destroy(): void {
    this.game.destroy(true);
  }

  private handleGuestTrigger(state: GameState): void {
    if (!this.initializedLogCursor) {
      this.initializedLogCursor = true;
      this.processedLogCount = state.logs.length;
      return;
    }

    const guestKey = this.consumeLatestGuestFromNewLogs(state);
    if (guestKey) {
      this.scene.playGuestCinematic(guestKey);
    }
  }

  private consumeLatestGuestFromNewLogs(state: GameState): GuestAssetKey | null {
    if (state.logs.length < this.processedLogCount) {
      this.processedLogCount = 0;
    }

    let latestGuestKey: GuestAssetKey | null = null;
    for (let i = this.processedLogCount; i < state.logs.length; i += 1) {
      const payload = decodeLog(state.logs[i]);
      if (!payload || payload.key !== "log.guest") continue;
      const nameKeyValue = payload.params?.nameKey;
      if (typeof nameKeyValue !== "string") continue;
      const guestKey = guestAssetKeyFromLogNameKey(nameKeyValue);
      if (!guestKey) continue;
      latestGuestKey = guestKey;
    }

    this.processedLogCount = state.logs.length;
    return latestGuestKey;
  }
}
