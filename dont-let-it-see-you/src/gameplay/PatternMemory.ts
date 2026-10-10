/**
 * Deterministic habit counters. No learning, no models: just tallies of what the
 * player keeps doing, which is enough to make the Analyst *feel* like it is
 * catching on, and enough for late rooms to set traps around a favourite trick.
 */
export class PatternMemory {
  private readonly counts = new Map<string, number>();
  /** Counts that survive between attempts at the same room. */
  private readonly persistent = new Map<string, number>();

  note(key: string, amount = 1): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + amount);
    this.persistent.set(key, (this.persistent.get(key) ?? 0) + amount);
  }

  count(key: string): number {
    return this.persistent.get(key) ?? 0;
  }

  /** Counts within the current attempt only. */
  countThisAttempt(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  /** The habit the player leans on hardest, for the results screen flavour. */
  favourite(prefix: string): { key: string; count: number } | null {
    let best: { key: string; count: number } | null = null;
    for (const [key, count] of this.persistent) {
      if (!key.startsWith(prefix)) continue;
      if (!best || count > best.count) best = { key, count };
    }
    return best;
  }

  /** Called when a room restarts: the attempt tally resets, the habit does not. */
  beginAttempt(): void {
    this.counts.clear();
  }

  /** Called when leaving a room entirely. */
  resetAll(): void {
    this.counts.clear();
    this.persistent.clear();
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.persistent);
  }
}
