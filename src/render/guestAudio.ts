export class GuestAudioPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private fadeTimerId: number | null = null;

  playRandom(voiceUrls: string[]): void {
    if (voiceUrls.length === 0) return;
    const index = Math.floor(Math.random() * voiceUrls.length);
    const selected = voiceUrls[index];
    if (!selected) return;

    this.stopImmediate();
    const audio = new Audio(selected);
    audio.preload = "auto";
    audio.volume = 1;
    void audio.play().catch(() => undefined);
    audio.onended = () => {
      if (this.currentAudio === audio) {
        this.currentAudio = null;
      }
    };
    this.currentAudio = audio;
  }

  stopImmediate(): void {
    this.clearFadeTimer();
    if (!this.currentAudio) return;
    this.currentAudio.pause();
    this.currentAudio.currentTime = 0;
    this.currentAudio = null;
  }

  fadeOutAndStop(durationMs: number): void {
    if (!this.currentAudio) return;
    if (durationMs <= 0) {
      this.stopImmediate();
      return;
    }

    this.clearFadeTimer();
    const audio = this.currentAudio;
    const startVolume = audio.volume;
    const startTime = performance.now();

    this.fadeTimerId = window.setInterval(() => {
      if (this.currentAudio !== audio) {
        this.clearFadeTimer();
        return;
      }

      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const nextVolume = Math.max(0, startVolume * (1 - progress));
      audio.volume = nextVolume;

      if (progress >= 1) {
        this.stopImmediate();
      }
    }, 16);
  }

  destroy(): void {
    this.stopImmediate();
  }

  private clearFadeTimer(): void {
    if (this.fadeTimerId === null) return;
    window.clearInterval(this.fadeTimerId);
    this.fadeTimerId = null;
  }
}
