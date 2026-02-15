import Phaser from "phaser";

export interface AudioChannelConfig {
  bgmVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  masterMuted: boolean;
}

type AudioChannel = "bgm" | "sfx" | "voice";

export class PhaserAudioManager {
  private config: AudioChannelConfig;
  private readonly scene: Phaser.Scene;
  private readonly activeByChannel: Record<AudioChannel, Set<Phaser.Sound.BaseSound>> = {
    bgm: new Set(),
    sfx: new Set(),
    voice: new Set(),
  };
  private readonly soundMeta = new Map<Phaser.Sound.BaseSound, { channel: AudioChannel; baseVolume: number }>();

  constructor(scene: Phaser.Scene, initialConfig: AudioChannelConfig) {
    this.scene = scene;
    this.config = { ...initialConfig };
    this.scene.sound.setMute(this.config.masterMuted);
  }

  setConfig(next: AudioChannelConfig): void {
    this.config = { ...next };
    this.scene.sound.setMute(this.config.masterMuted);
    this.applyChannelVolumes();
  }

  playSfx(keyOrUrl: string, options?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound | null {
    return this.play("sfx", keyOrUrl, options);
  }

  playVoice(keyOrUrl: string, options?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound | null {
    return this.play("voice", keyOrUrl, options);
  }

  playBgm(keyOrUrl: string, options?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound | null {
    return this.play("bgm", keyOrUrl, options);
  }

  stopAndDestroy(sound?: Phaser.Sound.BaseSound): void {
    if (!sound) return;
    sound.stop();
    sound.destroy();
  }

  destroy(): void {
    const channels: AudioChannel[] = ["bgm", "sfx", "voice"];
    for (const channel of channels) {
      for (const sound of this.activeByChannel[channel]) {
        sound.stop();
        sound.destroy();
      }
      this.activeByChannel[channel].clear();
    }
    this.soundMeta.clear();
  }

  private play(
    channel: AudioChannel,
    keyOrUrl: string,
    options?: Phaser.Types.Sound.SoundConfig,
  ): Phaser.Sound.BaseSound | null {
    if (!this.scene.cache.audio.exists(keyOrUrl)) return null;

    const baseVolume = options?.volume ?? 1;
    const sound = this.scene.sound.add(keyOrUrl, {
      ...options,
      volume: this.resolveVolume(channel, baseVolume),
    });
    this.track(channel, sound, baseVolume);
    sound.play();
    return sound;
  }

  private resolveVolume(channel: AudioChannel, baseVolume: number): number {
    if (this.config.masterMuted) return 0;
    if (channel === "bgm") return baseVolume * this.config.bgmVolume;
    if (channel === "voice") return baseVolume * this.config.voiceVolume;
    return baseVolume * this.config.sfxVolume;
  }

  private track(channel: AudioChannel, sound: Phaser.Sound.BaseSound, baseVolume: number): void {
    this.activeByChannel[channel].add(sound);
    this.soundMeta.set(sound, { channel, baseVolume });

    const detach = () => {
      this.activeByChannel[channel].delete(sound);
      this.soundMeta.delete(sound);
    };
    sound.once("complete", detach);
    sound.once("destroy", detach);
  }

  private applyChannelVolumes(): void {
    for (const [sound, meta] of this.soundMeta.entries()) {
      const volume = this.resolveVolume(meta.channel, meta.baseVolume);
      const withSetVolume = sound as unknown as { setVolume?: (value: number) => unknown };
      if (typeof withSetVolume.setVolume === "function") {
        withSetVolume.setVolume(volume);
        continue;
      }
      (sound as unknown as { volume: number }).volume = volume;
    }
  }
}
