import type { AdPlacement, AdProvider } from '../ads/AdManager';
import type { Portal } from './Portal';

/**
 * The GameMonetize.com HTML5 SDK (https://api.gamemonetize.com/sdk.js) speaks through
 * `window.SDK_OPTIONS.onEvent`, which has to be defined before their loader script runs,
 * so the `gamemonetize` build mode puts a small config script in the page head that
 * forwards every event here (see gameMonetizeSdk in vite.config.ts).
 */
interface SdkEvent {
  name: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    SDK_OPTIONS?: { gameId: string; onEvent(event: SdkEvent): void };
    __GM_EVENTS__?: string[];
    __GM_ON_EVENT__?: ((event: SdkEvent) => void) | null;
    sdk?: GameMonetizeSdk;
  }
}

/** The one method of the SDK this game uses; ads are Google IMA videos the SDK plays itself. */
interface GameMonetizeSdk {
  showBanner(): void;
}

const AD_SETTLE_TIMEOUT_MS = 90_000;

/**
 * gamemonetize.com. Interstitial video ads only: their SDK has no rewarded format with a
 * completion callback, so the game's "watch ad to continue" button stays hidden here.
 * Their catalogue norm is an ad at every natural break (their SDK paces nothing itself),
 * so the game asks at each one, held back 45 seconds at the start of a visit.
 */
export class GameMonetizePortal implements Portal {
  readonly name = 'gamemonetize';
  readonly managesScreen = false;
  readonly storage = null;
  readonly ads: AdProvider;
  private sdk: GameMonetizeSdk | null = null;
  private ready = false;
  private blocked = false;
  /** True between SDK_GAME_PAUSE and SDK_GAME_START: an ad is on screen. */
  private adPlaying = false;
  private adSettle: (() => void) | null = null;
  /** The showBanner caller's onStart, held until the SDK confirms the ad is playing. */
  private pendingOnStart: (() => void) | null = null;
  private muteListener: ((muted: boolean) => void) | null = null;

  constructor() {
    this.ads = {
      name: 'gamemonetize',
      // Ask at every natural break — this also makes their "Verify Game" pass quickly,
      // because the verifier completes once it has seen an ad request in the session.
      pacing: 'portal',
      initialize: async () => {
        // The config script in the head already wired __GM_ON_EVENT__ in the constructor;
        // SDK_READY, if it came before the game booted, was replayed there.
        this.ready = true;
      },
      isAvailable: (kind) => this.ready && this.sdk !== null && !this.blocked && kind === 'interstitial',
      showInterstitial: (_placement: AdPlacement, onStart: () => void) => this.showBanner(onStart),
      // No rewarded format: the promise never resolves true, and the button is already hidden.
      showRewarded: (_placement: AdPlacement, _onStart: () => void) => Promise.resolve(false),
      firstInterstitialDelaySeconds: 45,
    };

    // The README's one mandatory rule: mute on SDK_GAME_PAUSE, resume on SDK_GAME_START.
    window.__GM_ON_EVENT__ = (event) => this.onEvent(event);
    for (const name of window.__GM_EVENTS__ ?? []) this.onEvent({ name });
  }

  async init(): Promise<void> {
    // The loader script runs asynchronously, and SDK_READY alone does not prove the global
    // was assigned before this class existed, so poll briefly for `window.sdk` instead of
    // trusting the event. Without it there would be no ads at all, and their verifier
    // would never see a request.
    const deadline = Date.now() + 10_000;
    while (!this.sdk && Date.now() < deadline) {
      this.sdk = window.sdk ?? null;
      if (!this.sdk) await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
    }
    if (!this.sdk) console.warn('[gamemonetize] SDK script did not load; running without it.');
  }

  private onEvent(event: SdkEvent): void {
    switch (event?.name) {
      case 'SDK_READY':
        this.sdk = window.sdk ?? null;
        break;
      case 'SDK_BLOCKED':
        this.blocked = true;
        break;
      case 'SDK_GAME_PAUSE':
        // An advertisement is about to cover the game.
        if (!this.adPlaying) {
          this.adPlaying = true;
          this.pendingOnStart?.();
          this.muteListener?.(true);
        }
        break;
      case 'SDK_GAME_START':
        // The advertisement is done, whether it played or was skipped for lack of fill.
        this.sdk = this.sdk ?? window.sdk ?? null;
        if (this.adPlaying) {
          this.adPlaying = false;
          this.muteListener?.(false);
        }
        this.adSettle?.();
        break;
      default:
        break;
    }
  }

  /**
   * `sdk.showBanner()` is fire-and-forget: the SDK asks Google IMA for a video, plays it over
   * the page and announces the two ends of it through the events above. The promise here
   * settles when SDK_GAME_START arrives, or after a safety timeout so the player is never
   * left stuck behind a request that died quietly.
   */
  private showBanner(onStart: () => void): Promise<void> {
    const sdk = this.sdk ?? window.sdk ?? null;
    if (!sdk) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let settled = false;
      let reported = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        this.adSettle = null;
        this.pendingOnStart = null;
        window.clearTimeout(timer);
        if (this.adPlaying) {
          this.adPlaying = false;
          this.muteListener?.(false);
        }
        resolve();
      };
      const timer = window.setTimeout(finish, AD_SETTLE_TIMEOUT_MS);
      this.adSettle = finish;
      // `showBanner()` only starts the fetch; the SDK says an ad is truly on screen
      // with SDK_GAME_PAUSE, which arrives here through onEvent and calls onStart.
      this.pendingOnStart = () => {
        if (reported) return;
        reported = true;
        onStart();
      };
      try {
        sdk.showBanner();
      } catch (error) {
        console.warn('[gamemonetize] ad request failed', error);
        finish();
      }
    });
  }

  loadingStart(): void {}
  loadingStop(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  celebrate(): void {}
  reportProgress(): void {}
  setContext(): void {}

  onMuteChange(listener: (muted: boolean) => void): void {
    this.muteListener = listener;
    listener(this.adPlaying);
  }
}