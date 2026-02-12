import Phaser from "phaser";
import {
  ASSET_KEY_BUILDING,
  ASSET_KEY_CAR,
  ASSET_KEY_CHAIR,
  ASSET_KEY_DESK,
  ASSET_KEY_PERSON,
  ASSET_KEY_YUUKA,
  ASSET_PATH_BUILDING,
  ASSET_PATH_CAR,
  ASSET_PATH_CHAIR,
  ASSET_PATH_DESK,
  ASSET_PATH_PERSON,
  ASSET_PATH_YUUKA,
  PLACEHOLDER_COMPARE_COLOR,
  PLACEHOLDER_TEXT_COLOR,
  PLACEHOLDER_YUUKA_COLOR,
  RENDER_BG_COLOR,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  START_THIGH_CM,
} from "../core/constants";
import { getComparisonKind, getStage } from "../core/stage";
import type { ComparisonKind, GameState } from "../core/types";
import { t } from "../i18n";

interface RenderSnapshot {
  stage: number;
  thighCm: number;
}

class YuukaScene extends Phaser.Scene {
  private snapshot: RenderSnapshot = {
    stage: 1,
    thighCm: START_THIGH_CM,
  };

  private yuukaSprite?: Phaser.GameObjects.Image;
  private yuukaPlaceholder?: Phaser.GameObjects.Rectangle;
  private compareSprite?: Phaser.GameObjects.Image;
  private comparePlaceholder?: Phaser.GameObjects.Rectangle;
  private labelYuuka?: Phaser.GameObjects.Text;
  private labelStage?: Phaser.GameObjects.Text;
  private labelThigh?: Phaser.GameObjects.Text;
  private labelCompare?: Phaser.GameObjects.Text;

  preload(): void {
    this.load.image(ASSET_KEY_YUUKA, ASSET_PATH_YUUKA);
    this.load.image(ASSET_KEY_CHAIR, ASSET_PATH_CHAIR);
    this.load.image(ASSET_KEY_DESK, ASSET_PATH_DESK);
    this.load.image(ASSET_KEY_PERSON, ASSET_PATH_PERSON);
    this.load.image(ASSET_KEY_CAR, ASSET_PATH_CAR);
    this.load.image(ASSET_KEY_BUILDING, ASSET_PATH_BUILDING);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(RENDER_BG_COLOR);
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

    this.labelYuuka = this.add.text(RENDER_WIDTH / 2, RENDER_HEIGHT * 0.16, t("render.labelYuuka"), {
      color: PLACEHOLDER_TEXT_COLOR,
      fontSize: "30px",
      fontFamily:
        'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
    });
    this.labelYuuka.setOrigin(0.5, 0.5);
    this.labelYuuka.setDepth(5);

    this.labelStage = this.add.text(RENDER_WIDTH / 2, RENDER_HEIGHT * 0.24, "", {
      color: PLACEHOLDER_TEXT_COLOR,
      fontSize: "24px",
      fontFamily:
        'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
    });
    this.labelStage.setOrigin(0.5, 0.5);
    this.labelStage.setDepth(5);

    this.labelThigh = this.add.text(RENDER_WIDTH / 2, RENDER_HEIGHT * 0.31, "", {
      color: PLACEHOLDER_TEXT_COLOR,
      fontSize: "22px",
      fontFamily:
        'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
    });
    this.labelThigh.setOrigin(0.5, 0.5);
    this.labelThigh.setDepth(5);

    this.labelCompare = this.add.text(RENDER_WIDTH * 0.82, RENDER_HEIGHT * 0.9, "", {
      color: PLACEHOLDER_TEXT_COLOR,
      fontSize: "20px",
      fontFamily:
        'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
    });
    this.labelCompare.setOrigin(0.5, 0.5);
    this.labelCompare.setDepth(5);

    this.redraw();
  }

  setSnapshot(snapshot: RenderSnapshot): void {
    this.snapshot = snapshot;
    if (this.sys.isActive()) {
      this.redraw();
    }
  }

  private redraw(): void {
    const { stage, thighCm } = this.snapshot;
    const hasYuukaTexture = this.textures.exists(ASSET_KEY_YUUKA);
    if (hasYuukaTexture) {
      if (!this.yuukaSprite) {
        this.yuukaSprite = this.add.image(RENDER_WIDTH / 2, RENDER_HEIGHT / 2, ASSET_KEY_YUUKA);
        this.yuukaSprite.setDepth(1);
      }
      this.yuukaSprite.setVisible(true);
      this.yuukaSprite.setDisplaySize(340, 460);
    } else if (this.yuukaSprite) {
      this.yuukaSprite.setVisible(false);
    }
    if (this.yuukaPlaceholder) {
      this.yuukaPlaceholder.setVisible(!hasYuukaTexture);
    }

    this.labelStage?.setText(t("render.stage", { stage }));
    this.labelThigh?.setText(t("render.thigh", { thigh: Math.round(thighCm) }));

    const comparison = getComparisonKind(stage);
    if (!comparison) {
      this.compareSprite?.setVisible(false);
      this.comparePlaceholder?.setVisible(false);
      this.labelCompare?.setVisible(false);
      return;
    }

    this.labelCompare?.setVisible(true);
    this.labelCompare?.setText(t(`render.compare.${comparison}`));

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
    if (this.comparePlaceholder) {
      this.comparePlaceholder.setVisible(!hasTexture);
    }
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
