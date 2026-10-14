/**
 * Advertising abstraction. The game only ever talks to AdManager; which network (if any)
 * is behind it is decided once at startup by the portal (src/platform). No ad SDK is
 * referenced from gameplay code.
 *
 * To plug in another network, implement AdProvider (see README, "How to add an ad provider").
 */
export type AdPlacement = 'room_complete' | 'retry_after_failures' | 'second_chance' | 'bonus_challenge';

export interface AdProvider {
  readonly name: string;
  /**
   * Who decides how often interstitials appear. `self`: this file's own limits apply.
   * `portal`: the host throttles requests itself, so the game asks at every natural break.
   */
  readonly pacing: 'self' | 'portal';
  /**
   * Optional: how soon after a visit starts the first interstitial may be requested, in
   * seconds. Defaults to SECONDS_BEFORE_FIRST_INTERSTITIAL for networks that demand a
   * long first-play grace period; a portal whose catalogue norm is an ad at every break
   * sets a shorter one.
   */
  readonly firstInterstitialDelaySeconds?: number;
  initialize(): Promise<void>;
  isAvailable(kind: 'interstitial' | 'rewarded'): boolean;
  /**
   * Resolves when the ad has closed, or straight away if none was shown.
   * `onStart` must be called at the moment an ad actually begins to play.
   */
  showInterstitial(placement: AdPlacement, onStart: () => void): Promise<void>;
  /** Resolves true only if the player earned the reward. */
  showRewarded(placement: AdPlacement, onStart: () => void): Promise<boolean>;
}

export interface AdHooks {
  /** An ad has been asked for: stop the player pressing anything until it is settled. */
  onRequest(): void;
  /** An ad has actually started playing: mute the game. */
  onAdStart(): void;
  /** The ad that started has finished. */
  onAdEnd(): void;
  /** The request is over, whether or not anything was shown. */
  onSettled(): void;
}

const ROOMS_BETWEEN_INTERSTITIALS = 3;
const MIN_SECONDS_BETWEEN_INTERSTITIALS = 120;
const FAILURES_BEFORE_INTERSTITIAL = 3;
/** No interstitial this early in a visit, whoever is pacing: the player has to have played first. */
const SECONDS_BEFORE_FIRST_INTERSTITIAL = 75;

export class AdManager {
  private ready = false;
  private roomsSinceAd = 0;
  private failuresSinceAd = 0;
  private lastInterstitialAt = -Infinity;
  private readonly sessionStart = performance.now() / 1000;
  private hooks: AdHooks = { onRequest() {}, onAdStart() {}, onAdEnd() {}, onSettled() {} };

  constructor(private readonly provider: AdProvider) {}

  setHooks(hooks: AdHooks): void {
    this.hooks = hooks;
  }

  async initialize(): Promise<void> {
    try {
      await this.provider.initialize();
      this.ready = true;
    } catch (error) {
      console.warn(`[ads] provider "${this.provider.name}" failed to initialize; continuing without ads.`, error);
    }
  }

  isAvailable(kind: 'interstitial' | 'rewarded'): boolean {
    return this.ready && this.provider.isAvailable(kind);
  }

  /** Never called mid-action: only from the results screen between rooms. */
  async onRoomComplete(): Promise<void> {
    this.roomsSinceAd++;
    this.failuresSinceAd = 0;
    const due = this.provider.pacing === 'portal' ? 1 : ROOMS_BETWEEN_INTERSTITIALS;
    if (this.roomsSinceAd >= due) await this.interstitial('room_complete');
  }

  /** Called when the player retries after failing. */
  async onRetryAfterFailure(): Promise<void> {
    this.failuresSinceAd++;
    const due = this.provider.pacing === 'portal' ? 1 : FAILURES_BEFORE_INTERSTITIAL;
    if (this.failuresSinceAd >= due) await this.interstitial('retry_after_failures');
  }

  private async interstitial(placement: AdPlacement): Promise<void> {
    if (!this.isAvailable('interstitial')) return;
    const now = performance.now() / 1000;
    const firstAdFloor = this.provider.firstInterstitialDelaySeconds ?? SECONDS_BEFORE_FIRST_INTERSTITIAL;
    if (now - this.sessionStart < firstAdFloor) return;
    if (this.provider.pacing === 'self' && now - this.lastInterstitialAt < MIN_SECONDS_BETWEEN_INTERSTITIALS) return;
    await this.run(async (onStart) => {
      await this.provider.showInterstitial(placement, onStart);
      this.lastInterstitialAt = performance.now() / 1000;
      this.roomsSinceAd = 0;
      this.failuresSinceAd = 0;
      return true;
    });
  }

  async showRewarded(placement: AdPlacement): Promise<boolean> {
    if (!this.isAvailable('rewarded')) return false;
    return this.run((onStart) => this.provider.showRewarded(placement, onStart));
  }

  /** Wraps one ad request: input is blocked for the whole of it, audio only while an ad plays. */
  private async run(show: (onStart: () => void) => Promise<boolean>): Promise<boolean> {
    let started = false;
    this.hooks.onRequest();
    try {
      return await show(() => {
        if (started) return;
        started = true;
        this.hooks.onAdStart();
      });
    } catch (error) {
      console.warn('[ads] ad request failed', error);
      return false;
    } finally {
      if (started) this.hooks.onAdEnd();
      this.hooks.onSettled();
    }
  }
}
