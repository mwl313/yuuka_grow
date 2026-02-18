export class CardManager {
  private readonly milestones: readonly number[];
  private readonly pendingMilestones: number[] = [];
  private isTransitioning = false;
  private isCardOverlayActive = false;

  constructor(milestones: readonly number[]) {
    this.milestones = [...milestones].sort((a, b) => a - b);
  }

  reset(): void {
    this.pendingMilestones.length = 0;
    this.isTransitioning = false;
    this.isCardOverlayActive = false;
  }

  setTransitioning(isTransitioning: boolean): void {
    this.isTransitioning = isTransitioning;
  }

  setCardOverlayActive(active: boolean): void {
    this.isCardOverlayActive = active;
  }

  registerStage(stage: number, milestonesHit: Set<number>): number[] {
    const newlyHit: number[] = [];
    for (const milestone of this.milestones) {
      if (stage < milestone) break;
      if (milestonesHit.has(milestone)) continue;
      milestonesHit.add(milestone);
      this.pendingMilestones.push(milestone);
      newlyHit.push(milestone);
    }
    return newlyHit;
  }

  dequeueReadyMilestone(): number | undefined {
    if (this.isTransitioning || this.isCardOverlayActive) return undefined;
    return this.pendingMilestones.shift();
  }

  hasPending(): boolean {
    return this.pendingMilestones.length > 0;
  }
}

