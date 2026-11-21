import { sfx } from '../audio/Sfx';

/**
 * The CrazyGames SDK, kept at arm's length. Build for the portal with
 * `npm run build:crazygames` (vite mode "crazygames", Full Launch, ads on) or
 * `npm run build:crazygames-basic` (mode "crazygames-basic", Basic Launch: the SDK still reports
 * loading and gameplay, but CrazyGames disables ads there, so no ad offers are shown at all).
 * Every other build never downloads the SDK and shows no ad offers.
 *
 * While developing (`npm run dev`, or any build opened with ?mockads) a fake
 * 3-second "ad" stands in so the whole reward flow can be tested.
 */
const MODE = import.meta.env.MODE;
export const isCrazyGames = MODE === 'crazygames' || MODE === 'crazygames-basic';
/** Basic Launch build: no ad offers, whatever the SDK says. */
const ADS_OFF = MODE === 'crazygames-basic' || (import.meta.env.DEV && !new URLSearchParams(window.location.search).has('mockads'));

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const SDK_TIMEOUT = 3000;
/** Minimum seconds between two rewarded offers being playable. */
const REWARD_COOLDOWN = 20;
/** CrazyGames asks for at least three minutes between midgame breaks. */
const MIDGAME_COOLDOWN = 180;

interface AdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

interface CrazySdk {
  init(): Promise<unknown>;
  readonly environment: string;
  readonly game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    readonly settings?: { muteAudio?: boolean; disableChat?: boolean };
    addSettingsChangeListener(listener: (settings: { muteAudio?: boolean; disableChat?: boolean }) => void): void;
  };
  readonly ad: {
    requestAd(type: 'midgame' | 'rewarded', callbacks?: AdCallbacks): void;
    hasAdblock?(): Promise<boolean>;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazySdk };
  }
}

const mockEnabled = (): boolean => {
  try {
    return import.meta.env.DEV || new URLSearchParams(window.location.search).has('mockads');
  } catch {
    return false;
  }
};

const loadScript = (url: string, timeout: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    const timer = window.setTimeout(() => reject(new Error('sdk timeout')), timeout);
    tag.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    tag.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('sdk failed'));
    };
    tag.src = url;
    document.head.append(tag);
  });

class Portal {
  private sdk: CrazySdk | null = null;
  private playing = false;
  private open = false;
  private lastRewardedAt = 0;
  private lastMidgameAt = Date.now() / 1000;
  private readonly mock = mockEnabled();
  private forcedMute = false;
  private muteListeners: Array<(muted: boolean) => void> = [];
  private loading = false;
  /** The SDK said ads are off for this session (Basic Launch, kids mode) or an ad blocker is running. */
  private noAds = false;

  /** Boots the SDK in the background; never blocks the game. */
  async init(): Promise<void> {
    if (!isCrazyGames) return;
    try {
      if (!window.CrazyGames?.SDK) await loadScript(SDK_URL, SDK_TIMEOUT);
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      await sdk.init();
      if (sdk.environment !== 'local' && sdk.environment !== 'crazygames') return;
      this.sdk = sdk;
      this.applySdkSettings(sdk.game.settings);
      try {
        sdk.game.addSettingsChangeListener((s) => this.applySdkSettings(s));
      } catch {
        /* older SDK without settings updates */
      }
      if (this.loading) sdk.game.loadingStart();
      if (this.playing) sdk.game.gameplayStart();
      void this.checkAdblock(sdk);
    } catch {
      this.sdk = null;
    }
  }

  /** Players with an ad blocker play normally; only the ad offers go away (an offer that does nothing is not allowed). */
  private async checkAdblock(sdk: CrazySdk): Promise<void> {
    try {
      if (await sdk.ad.hasAdblock?.()) this.noAds = true;
    } catch {
      /* unknown: keep offering, a failed request is handled when it happens */
    }
  }

  /** `adError` carries a code: adsDisabled and adblock mean no offer will ever work this session. */
  private noteAdError(error: unknown): void {
    const code = (error as { code?: string } | null | undefined)?.code;
    if (code === 'adsDisabled' || code === 'adblock') this.noAds = true;
  }

  /** Loading progress for the portal, while the game boots. */
  loadingStart(): void {
    this.loading = true;
    try {
      this.sdk?.game.loadingStart();
    } catch {
      /* reporting must never break the game */
    }
  }

  loadingStop(): void {
    this.loading = false;
    try {
      this.sdk?.game.loadingStop();
    } catch {
      /* reporting must never break the game */
    }
  }

  /** The portal's own mute setting; it overrides the in-game sound toggle. */
  get muteForced(): boolean {
    return this.forcedMute;
  }

  onMuteForced(listener: (muted: boolean) => void): void {
    this.muteListeners.push(listener);
  }

  private applySdkSettings(settings?: { muteAudio?: boolean }): void {
    const muted = !!settings?.muteAudio;
    if (muted === this.forcedMute) return;
    this.forcedMute = muted;
    for (const listener of this.muteListeners) listener(muted);
  }

  /** A video ad is on screen right now: the game should hold still. */
  get adOpen(): boolean {
    return this.open;
  }

  /** Whether any kind of ad (real or test) can be shown at all in this build. */
  get hasAds(): boolean {
    return !ADS_OFF && !this.noAds && (this.sdk !== null || this.mock);
  }

  /** Seconds until another rewarded ad may be offered. */
  get rewardedWait(): number {
    return Math.max(0, Math.ceil(REWARD_COOLDOWN - (Date.now() / 1000 - this.lastRewardedAt)));
  }

  /** Rewarded offers should be visible and pressable. */
  get rewardedReady(): boolean {
    return this.hasAds && !this.open && this.rewardedWait === 0;
  }

  /** CrazyGames wants to know exactly when the player is actually playing. */
  setPlaying(playing: boolean): void {
    if (playing === this.playing) return;
    this.playing = playing;
    try {
      if (playing) this.sdk?.game.gameplayStart();
      else this.sdk?.game.gameplayStop();
    } catch {
      /* reporting must never break the game */
    }
  }

  /**
   * A rewarded ad. `grant` runs only if the ad finished. Returns false when no ad
   * can be shown right now (the caller should simply not offer it).
   */
  rewarded(grant: () => void, settled?: (granted: boolean) => void): boolean {
    if (!this.rewardedReady) return false;
    this.lastRewardedAt = Date.now() / 1000;
    this.lastMidgameAt = this.lastRewardedAt;
    this.run('rewarded', (paid) => {
      if (paid) grant();
      settled?.(paid);
    });
    return true;
  }

  /**
   * A midgame break at a natural pause (the start of a new day). Returns false when
   * there is nothing to show and the caller should carry on at once.
   */
  midgame(done: () => void): boolean {
    if (!this.hasAds || this.open) return false;
    const now = Date.now() / 1000;
    if (now - this.lastMidgameAt < MIDGAME_COOLDOWN) return false;
    this.lastMidgameAt = now;
    this.run('midgame', () => done());
    return true;
  }

  private run(type: 'midgame' | 'rewarded', finished: (paid: boolean) => void): void {
    // The game holds still from the request until adFinished or adError (the player cannot progress meanwhile).
    this.open = true;
    // Sound goes quiet only when the ad really starts (not on the request: it may never come), and only for
    // the ad: the player's own sound setting is never touched.
    let muted = false;
    const mute = (): void => {
      if (muted) return;
      muted = true;
      sfx.holdForAd(true);
    };
    let settled = false;
    const finish = (paid: boolean): void => {
      if (settled) return;
      settled = true;
      this.open = false;
      if (muted) sfx.holdForAd(false);
      finished(paid);
    };
    if (this.sdk) {
      try {
        this.sdk.ad.requestAd(type, {
          adStarted: mute,
          adFinished: () => finish(true),
          adError: (error) => {
            this.noteAdError(error);
            finish(false);
          },
        });
      } catch {
        finish(false);
      }
    } else {
      mute();
      mockAd(type, () => finish(true));
    }
  }
}

/** A stand-in "ad" for local testing: dims the page for three seconds. */
function mockAd(type: string, done: () => void): void {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'background:rgba(10,6,2,0.92);color:#fff;font:400 28px Rye,Georgia,serif;text-align:center;gap:12px';
  const title = document.createElement('div');
  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:16px;opacity:.7';
  sub.textContent = 'Test ad - the real CrazyGames ad plays here';
  box.append(title, sub);
  document.body.append(box);
  let left = 3;
  const tick = (): void => {
    title.textContent = `Ad (${type}) ${left}...`;
    if (left <= 0) {
      box.remove();
      done();
      return;
    }
    left--;
    window.setTimeout(tick, 1000);
  };
  tick();
}

export const portal = new Portal();
