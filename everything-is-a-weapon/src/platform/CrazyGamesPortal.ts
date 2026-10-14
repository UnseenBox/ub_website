import type { AdPlacement, AdProvider } from '../ads/AdManager';
import type { Portal, PortalStorage } from './Portal';

/** The parts of the CrazyGames HTML5 SDK v3 this game uses. */
interface AdError {
  code?: string;
  message?: string;
}
interface AdCallbacks {
  adStarted(): void;
  adFinished(): void;
  adError(error: AdError): void;
}
interface GameSettings {
  muteAudio?: boolean;
}
interface CrazySdk {
  init(): Promise<void>;
  readonly environment: 'local' | 'crazygames' | 'disabled';
  readonly ad: {
    requestAd(type: 'midgame' | 'rewarded', callbacks: AdCallbacks): void;
    hasAdblock(): Promise<boolean>;
  };
  readonly game: {
    readonly settings: GameSettings;
    addSettingsChangeListener(listener: (settings: GameSettings) => void): void;
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    reportGameCompletedPercentage?(percent: number): void;
    setGameContext?(context: Record<string, string | number>): void;
    clearGameContext?(): void;
  };
  readonly data: PortalStorage;
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazySdk };
  }
}

const INIT_TIMEOUT_MS = 8000;

/**
 * crazygames.com. The SDK script is added to index.html by the `crazygames` build mode
 * (vite.config.ts), so `window.CrazyGames` exists before this code runs.
 *
 * Every SDK call is wrapped: if the script was blocked, the page is on a domain where the
 * SDK is disabled, or a single call throws, the game carries on without that feature.
 */
export class CrazyGamesPortal implements Portal {
  readonly name = 'crazygames';
  readonly managesScreen = true;
  readonly ads: AdProvider;
  readonly storage: PortalStorage;
  private sdk: CrazySdk | null = null;
  private adblock = false;
  /** Set once the portal has told us rewarded ads cannot be shown to this player. */
  private rewardedOff = false;
  private muteListener: ((muted: boolean) => void) | null = null;

  constructor() {
    this.ads = {
      name: 'crazygames',
      // CrazyGames spaces mid-game ads itself (at most one every three minutes) and simply
      // ignores a request that comes too soon, so the game asks at every natural break.
      pacing: 'portal',
      initialize: async () => {},
      isAvailable: (kind) => {
        if (!this.sdk) return false;
        // A reward button that cannot pay out must not be on screen.
        return kind === 'interstitial' || (!this.adblock && !this.rewardedOff);
      },
      showInterstitial: (_placement: AdPlacement, onStart: () => void) => this.request('midgame', onStart).then(() => undefined),
      showRewarded: (_placement: AdPlacement, onStart: () => void) => this.request('rewarded', onStart),
    };

    // Saves go through the SDK so they follow the player's CrazyGames account from device
    // to device; for guests the SDK keeps them in localStorage itself.
    const fallback = (): Storage => window.localStorage;
    this.storage = {
      getItem: (key) => {
        try {
          if (this.sdk) return this.sdk.data.getItem(key);
        } catch (error) {
          console.warn('[crazygames] could not read save from the data module', error);
        }
        return fallback().getItem(key);
      },
      setItem: (key, value) => {
        try {
          if (this.sdk) return this.sdk.data.setItem(key, value);
        } catch (error) {
          console.warn('[crazygames] could not write save to the data module', error);
        }
        fallback().setItem(key, value);
      },
      removeItem: (key) => {
        try {
          if (this.sdk) return this.sdk.data.removeItem(key);
        } catch (error) {
          console.warn('[crazygames] could not clear save in the data module', error);
        }
        fallback().removeItem(key);
      },
    };
  }

  async init(): Promise<void> {
    const sdk = window.CrazyGames?.SDK;
    if (!sdk) {
      console.warn('[crazygames] SDK script did not load; running without it.');
      return;
    }
    try {
      await Promise.race([
        sdk.init(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('SDK init timed out')), INIT_TIMEOUT_MS)),
      ]);
      if (sdk.environment === 'disabled') {
        console.warn('[crazygames] SDK is disabled on this domain; running without it.');
        return;
      }
      this.sdk = sdk;
    } catch (error) {
      console.warn('[crazygames] SDK failed to start; running without it.', error);
      return;
    }

    void sdk.ad
      .hasAdblock()
      .then((blocked) => (this.adblock = blocked))
      .catch(() => {});
    this.safe(() =>
      sdk.game.addSettingsChangeListener((settings) => this.muteListener?.(settings.muteAudio === true)),
    );
  }

  private safe(call: () => void): void {
    try {
      call();
    } catch (error) {
      console.warn('[crazygames] SDK call failed', error);
    }
  }

  /** Resolves true when the ad played to the end, false for anything else. */
  private request(type: 'midgame' | 'rewarded', onStart: () => void): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (result: boolean): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      try {
        sdk.ad.requestAd(type, {
          adStarted: onStart,
          adFinished: () => finish(true),
          adError: (error) => {
            // No fill, a cooldown, an ad blocker, or ads switched off during the Basic Launch.
            if (type === 'rewarded' && (error?.code === 'adblock' || error?.code === 'adsDisabledBasicLaunch')) {
              this.rewardedOff = true;
            }
            finish(false);
          },
        });
      } catch (error) {
        console.warn('[crazygames] ad request failed', error);
        finish(false);
      }
    });
  }

  loadingStart(): void {
    this.safe(() => this.sdk?.game.loadingStart());
  }

  loadingStop(): void {
    this.safe(() => this.sdk?.game.loadingStop());
  }

  gameplayStart(): void {
    this.safe(() => this.sdk?.game.gameplayStart());
  }

  gameplayStop(): void {
    this.safe(() => this.sdk?.game.gameplayStop());
  }

  celebrate(): void {
    this.safe(() => this.sdk?.game.happytime());
  }

  reportProgress(percent: number): void {
    this.safe(() => this.sdk?.game.reportGameCompletedPercentage?.(Math.round(Math.min(100, Math.max(0, percent)))));
  }

  setContext(context: Record<string, string | number> | null): void {
    this.safe(() => {
      if (context) this.sdk?.game.setGameContext?.(context);
      else this.sdk?.game.clearGameContext?.();
    });
  }

  onMuteChange(listener: (muted: boolean) => void): void {
    this.muteListener = listener;
    let muted = false;
    this.safe(() => (muted = this.sdk?.game.settings.muteAudio === true));
    listener(muted);
  }
}
