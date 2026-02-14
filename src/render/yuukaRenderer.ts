import Phaser from "phaser";
import {
  ASSET_KEY_BUILDING,
  ASSET_KEY_CAR,
  ASSET_KEY_CHAIR,
  ASSET_KEY_DESK,
  ASSET_KEY_PERSON,
  ASSET_KEY_YUUKA_BODY,
  ASSET_KEY_YUUKA_THIGH,
  ASSET_PATH_YUUKA_BODY,
  ASSET_PATH_YUUKA_THIGH,
  PLACEHOLDER_COMPARE_COLOR,
  PLACEHOLDER_YUUKA_COLOR,
  RENDER_BG_COLOR,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  START_THIGH_CM,
  YUUKA_BASE_SCALE,
  YUUKA_FADEOUT_MS,
  YUUKA_FOOT_GAP_PX,
  YUUKA_GIANT_GROWTH_PER_STAGE,
  YUUKA_LOWER_MAX_MULT_L10,
  YUUKA_SEAM_OVERLAP_PX,
  YUUKA_TRANSITION_DURATION_MS,
  YUUKA_UPPER_JOINT_FROM_TOP_PX,
} from "../core/constants";
import { getComparisonKind, getStage } from "../core/stage";
import type { ComparisonKind, GameState } from "../core/types";

interface RenderSnapshot {
  stage: number;
  thighCm: number;
}

type RenderMode = "normal" | "transition" | "giant";

class YuukaScene extends Phaser.Scene {
  private snapshot: RenderSnapshot = {
    stage: 1,
    thighCm: START_THIGH_CM,
  };

  private mode: RenderMode = "normal";
  private prevStage = 1;
  private transitionTween?: Phaser.Tweens.Tween;
  private upperFadeTween?: Phaser.Tweens.Tween;
  private giantBaseLowerScaleAtStage11?: number;

  private upperSprite?: Phaser.GameObjects.Image;
  private lowerSprite?: Phaser.GameObjects.Image;
  private yuukaPlaceholder?: Phaser.GameObjects.Rectangle;
  private compareSprite?: Phaser.GameObjects.Image;
  private comparePlaceholder?: Phaser.GameObjects.Rectangle;

  private debugEnabled = false;
  private debugGraphics?: Phaser.GameObjects.Graphics;

  preload(): void {
    this.load.image(ASSET_KEY_YUUKA_BODY, ASSET_PATH_YUUKA_BODY);
    this.load.image(ASSET_KEY_YUUKA_THIGH, ASSET_PATH_YUUKA_THIGH);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(RENDER_BG_COLOR);

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

    this.comparePlaceholder = this.add.rectangle(
      RENDER_WIDTH * 0.82,
      RENDER_HEIGHT * 0.78,
      120,
      120,
      PLACEHOLDER_COMPARE_COLOR,
    );
    this.comparePlaceholder.setDepth(2);

    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(9);
    this.input.keyboard?.on("keydown-D", () => {
      this.debugEnabled = !this.debugEnabled;
      this.updateDebugOverlay();
    });

    this.redraw();
  }

  setSnapshot(snapshot: RenderSnapshot): void {
    this.snapshot = snapshot;
    if (this.sys.isActive()) {
      this.redraw();
    }
  }

  private redraw(): void {
    const { stage } = this.snapshot;

    const splitReady = this.hasSplitTextures() && Boolean(this.upperSprite) && Boolean(this.lowerSprite);
    this.lowerSprite?.setVisible(splitReady);
    this.upperSprite?.setVisible(splitReady);
    this.yuukaPlaceholder?.setVisible(!splitReady);

    if (!splitReady) {
      this.stopTransitionTweens();
      this.mode = "normal";
      this.giantBaseLowerScaleAtStage11 = undefined;
      this.updateComparison(stage);
      this.updateDebugOverlay();
      this.prevStage = stage;
      return;
    }

    if (stage <= 10) {
      this.stopTransitionTweens();
      this.mode = "normal";
      this.giantBaseLowerScaleAtStage11 = undefined;
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
      if (this.giantBaseLowerScaleAtStage11 === undefined) {
        this.giantBaseLowerScaleAtStage11 = YUUKA_BASE_SCALE * this.scaleMultForStage(10);
      }
      this.applyGiantScale(stage);
    }

    this.updateComparison(stage);
    this.prevStage = stage;
  }

  private applyNormalVisual(stage: number): void {
    if (!this.upperSprite || !this.lowerSprite) return;
    const lowerScale = YUUKA_BASE_SCALE * this.scaleMultForStage(stage);

    this.upperSprite.setVisible(true);
    this.upperSprite.setAlpha(1);
    this.upperSprite.setScale(YUUKA_BASE_SCALE);
    this.lowerSprite.setScale(lowerScale);

    this.syncPositions();
  }

  private startTransitionFromStage10To11(): void {
    if (!this.upperSprite || !this.lowerSprite) return;
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
    // kTarget is where lowerTopY reaches panel top (y=0): footY - (nativeH * base * lowerMult10 * k) <= 0.
    const kTargetRaw = this.getFootY() / (lowerNativeH * base * lowerMult10);
    const kTarget = Math.max(1, kTargetRaw);

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
            this.giantBaseLowerScaleAtStage11 = this.lowerSprite.scaleX;
            this.applyGiantScale(this.snapshot.stage);
          },
        });
      },
    });
  }

  private applyGiantScale(stage: number): void {
    if (!this.upperSprite || !this.lowerSprite) return;
    const base11 =
      this.giantBaseLowerScaleAtStage11 ?? YUUKA_BASE_SCALE * this.scaleMultForStage(10);
    const extraStages = Math.max(0, stage - 11);
    const lowerScale = base11 * Math.pow(YUUKA_GIANT_GROWTH_PER_STAGE, extraStages);

    this.upperSprite.setVisible(false);
    this.lowerSprite.setScale(lowerScale);
    this.syncPositions();
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

  private updateComparison(stage: number): void {
    const comparison = getComparisonKind(stage);
    if (!comparison) {
      this.compareSprite?.setVisible(false);
      this.comparePlaceholder?.setVisible(false);
      return;
    }

    const textureKey = this.resolveComparisonTexture(comparison);
    const hasTexture = this.textures.exists(textureKey);
    if (hasTexture) {
      if (!this.compareSprite) {
        this.compareSprite = this.add.image(RENDER_WIDTH * 0.82, RENDER_HEIGHT * 0.78, textureKey);
        this.compareSprite.setDepth(2);
      } else {
        this.compareSprite.setTexture(textureKey);
      }
      this.compareSprite.setVisible(true);
      this.compareSprite.setDisplaySize(120, 120);
    } else if (this.compareSprite) {
      this.compareSprite.setVisible(false);
    }

    this.comparePlaceholder?.setVisible(!hasTexture);
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
    this.upperFadeTween?.stop();
    this.upperFadeTween = undefined;
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

  private resolveComparisonTexture(kind: ComparisonKind): string {
    if (kind === "chair") return ASSET_KEY_CHAIR;
    if (kind === "desk") return ASSET_KEY_DESK;
    if (kind === "person") return ASSET_KEY_PERSON;
    if (kind === "car") return ASSET_KEY_CAR;
    return ASSET_KEY_BUILDING;
  }
}

export class YuukaRenderer {
  private readonly scene: YuukaScene;
  private readonly game: Phaser.Game;

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
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
