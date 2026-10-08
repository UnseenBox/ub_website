import { MockAdProvider } from './MockAdProvider';

export type AdPlacement = 'room-complete' | 'session-break' | 'rewarded-continue';

export interface AdProvider {
  readonly name: string;
  initialize(): Promise<void>;
  isAvailable(): boolean;
  showInterstitial(placement: AdPlacement): Promise<void>;
  /** Resolves true when the reward was earned. */
  showRewarded(placement: AdPlacement): Promise<boolean>;
}

/**
 * The only thing gameplay is allowed to know about advertising.
 *
 * No portal SDK is referenced anywhere else in the project. Swapping providers
 * means writing one class that satisfies AdProvider and handing it to `use`.
 *
 * The rules in here are not configuration, they are design: an ad never appears
 * during stealth, a detection, a chase or a puzzle. Only at the boundaries, and
 * only when a real stretch of play has happened since the last one.
 */
export class AdManager {
  private provider: AdProvider;
  private initialized = false;
  private lastBreakAt = 0;
  private roomsSinceBreak = 0;
  /** True while gameplay is live. A hard interlock, not a suggestion. */
  private gameplayActive = false;

  private static readonly MIN_SECONDS_BETWEEN = 150;
  private static readonly MIN_ROOMS_BETWEEN = 2;

  constructor(provider: AdProvider = new MockAdProvider()) {
    this.provider = provider;
    this.lastBreakAt = performance.now();
  }

  use(provider: AdProvider): void {
    this.provider = provider;
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.provider.initialize();
      this.initialized = true;
    } catch (err) {
      console.warn('[ads] provider failed to initialise, continuing without ads', err);
    }
  }

  setGameplayActive(active: boolean): void {
    this.gameplayActive = active;
  }

  noteRoomFinished(): void {
    this.roomsSinceBreak++;
  }

  isAvailable(): boolean {
    return this.initialized && this.provider.isAvailable();
  }

  /** Returns true when a break actually ran, so callers can resume cleanly. */
  async maybeShowInterstitial(placement: AdPlacement): Promise<boolean> {
    if (this.gameplayActive) return false;
    if (!this.isAvailable()) return false;
    const elapsed = (performance.now() - this.lastBreakAt) / 1000;
    if (elapsed < AdManager.MIN_SECONDS_BETWEEN) return false;
    if (this.roomsSinceBreak < AdManager.MIN_ROOMS_BETWEEN) return false;
    try {
      await this.provider.showInterstitial(placement);
      this.lastBreakAt = performance.now();
      this.roomsSinceBreak = 0;
      return true;
    } catch (err) {
      console.warn('[ads] interstitial failed', err);
      return false;
    }
  }

  async showRewarded(placement: AdPlacement): Promise<boolean> {
    if (this.gameplayActive) return false;
    if (!this.isAvailable()) return false;
    try {
      const earned = await this.provider.showRewarded(placement);
      if (earned) this.lastBreakAt = performance.now();
      return earned;
    } catch (err) {
      console.warn('[ads] rewarded failed', err);
      return false;
    }
  }

  get providerName(): string {
    return this.provider.name;
  }
}
