// The CrazyGames SDK, kept at arm's length (adapted from crazy-goal's Portal).
//
// Everything is a no-op unless this is the CrazyGames build and the SDK loaded and
// reports a live environment, so the same code runs on itch.io, the website and in
// local previews with no change. Ads only ever run between missions or when the
// player asks for a rewarded one, never in the middle of a fight.

import { audio } from '../audio/AudioManager';
import type { KeyValueStore } from '../systems/Profile';
import { midgameAllowed, rewardAllowed, rewardWait } from './adRules';

/** The portal this build targets: '' (website, itch.io) or 'crazygames'. */
export const PORTAL: string = import.meta.env.VITE_PORTAL ?? '';
/** Ad breaks and rewarded ads only when the build switches them on (Full Launch). */
export const ADS_ON: boolean = import.meta.env.VITE_ADS === 'on';

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
/** The SDK logs gameplay calls closer together than this (ms) as errors. */
const GAMEPLAY_GAP_MS = 1000;
/** How long to wait for a fallback fetch of the SDK, then how long to keep looking for it (seconds). */
const SDK_FETCH_MS = 15000;
const SDK_WATCH_S = 30;

interface AdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

export interface CrazySdk {
  init(): Promise<unknown>;
  readonly environment: string;
  readonly game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    readonly settings?: { readonly muteAudio?: unknown } | null;
    addSettingsChangeListener?(fn: () => void): void;
  };
  readonly ad: { requestAd(type: 'midgame' | 'rewarded', callbacks?: AdCallbacks): void };
  /** The data module: the localStorage shape, saved to the cloud for signed-in players. */
  readonly data?: KeyValueStore | null;
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazySdk };
  }
}

export interface PortalConfig {
  portal: string;
  adsOn: boolean;
}

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

const nowS = (): number => Date.now() / 1000;

export class Portal {
  private sdk: CrazySdk | null = null;
  private playing = false;
  private sentPlaying = false;
  private sentAt = 0;
  private gameplayTimer = 0;
  private adOpen = false;
  private loading = false;
  private ready = false;
  private lastMidgame = 0;
  private lastReward = 0;
  private muteWatcher: ((muted: boolean) => void) | null = null;
  /** Ads switched on for a test SDK (development only). */
  private forceAds = false;
  /** Called once with the SDK's cloud data store (the profile merges itself into it). */
  onCloud: ((store: KeyValueStore) => void) | null = null;

  constructor(private readonly cfg: PortalConfig = { portal: PORTAL, adsOn: ADS_ON }) {}

  get isCrazyGames(): boolean {
    return this.cfg.portal === 'crazygames';
  }

  /** Boots the SDK in the background; never blocks the game. */
  async init(): Promise<void> {
    if (!this.isCrazyGames) return;
    try {
      // The build's own script tag normally has the SDK in place; fetch it only when it is missing.
      let sdk = window.CrazyGames?.SDK ?? null;
      if (!sdk) {
        try {
          await loadScript(SDK_URL, SDK_FETCH_MS);
        } catch {
          /* too slow or blocked: keep looking below */
        }
        sdk = window.CrazyGames?.SDK ?? null;
      }
      if (!sdk) sdk = await this.watchForSdk();
      if (sdk) await this.attach(sdk);
    } catch {
      this.sdk = null;
    }
  }

  private async watchForSdk(): Promise<CrazySdk | null> {
    for (let i = 0; i < SDK_WATCH_S; i++) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
      const sdk = window.CrazyGames?.SDK;
      if (sdk) return sdk;
    }
    return null;
  }

  /** Starts the SDK and replays the signals the game already sent, so a late start loses nothing. */
  private async attach(sdk: CrazySdk): Promise<void> {
    await sdk.init();
    // Every call throws outside the local and crazygames environments.
    if (sdk.environment !== 'local' && sdk.environment !== 'crazygames') return;
    this.sdk = sdk;
    try {
      if (this.ready) {
        sdk.game.loadingStart();
        sdk.game.loadingStop();
      } else if (this.loading) sdk.game.loadingStart();
    } catch {
      /* reporting must never break the game */
    }
    if (this.playing) this.syncGameplay();
    if (this.muteWatcher) this.attachMuteWatcher(sdk, this.muteWatcher);
    if (sdk.data && this.onCloud) {
      try {
        this.onCloud(sdk.data);
      } catch {
        /* the local save carries on */
      }
    }
  }

  /** Development only: plug in a stand-in SDK (with ads) to try the ad flows without the portal. */
  async debugAttach(sdk: CrazySdk, ads = true): Promise<void> {
    if (!import.meta.env.DEV) return;
    this.forceAds = ads;
    await this.attach(sdk);
  }

  /** The platform's own mute switch takes priority over the game's volume. */
  watchMute(apply: (muted: boolean) => void): void {
    this.muteWatcher = apply;
    if (this.sdk) this.attachMuteWatcher(this.sdk, apply);
  }

  private attachMuteWatcher(sdk: CrazySdk, apply: (muted: boolean) => void): void {
    try {
      const read = (): boolean => sdk.game.settings?.muteAudio === true;
      apply(read());
      sdk.game.addSettingsChangeListener?.(() => apply(read()));
    } catch {
      /* no mute signal: the game's own volume still works */
    }
  }

  get live(): boolean {
    return this.sdk !== null;
  }

  /** Video ads can be requested at all (build switch, live SDK, none open). */
  get adsReady(): boolean {
    return this.sdk !== null && (this.cfg.adsOn || this.forceAds) && !this.adOpen;
  }

  /** A rewarded ad can be offered right now (for showing or hiding its button). */
  get rewardReady(): boolean {
    return rewardAllowed({ adsReady: this.adsReady, adOpen: this.adOpen, now: nowS(), last: this.lastReward });
  }

  /** Seconds until the next rewarded ad may be offered. */
  rewardWait(): number {
    return rewardWait(nowS(), this.lastReward);
  }

  loadingStart(): void {
    this.loading = true;
    this.ready = false;
    this.call(() => this.sdk?.game.loadingStart());
  }

  loadingStop(): void {
    this.loading = false;
    this.ready = true;
    this.call(() => this.sdk?.game.loadingStop());
  }

  gameplayStart(): void {
    this.playing = true;
    this.syncGameplay();
  }

  gameplayStop(): void {
    this.playing = false;
    this.syncGameplay();
  }

  /** Sends the newest play state once, never closer than the SDK's gap to the last call. */
  private syncGameplay(): void {
    if (this.gameplayTimer) return;
    const wait = GAMEPLAY_GAP_MS - (Date.now() - this.sentAt);
    if (wait > 0) {
      this.gameplayTimer = window.setTimeout(() => {
        this.gameplayTimer = 0;
        this.syncGameplay();
      }, wait);
      return;
    }
    if (this.sentPlaying === this.playing) return;
    this.sentPlaying = this.playing;
    this.sentAt = Date.now();
    this.call(() => (this.playing ? this.sdk?.game.gameplayStart() : this.sdk?.game.gameplayStop()));
  }

  /** The portal's celebration: boss kills, finished acts, first three-star results. */
  happytime(): void {
    this.call(() => this.sdk?.game.happytime());
  }

  /**
   * A midgame break between missions. Returns false when none may run (the caller goes on
   * at once); otherwise mutes the game and calls `done` when the ad ends or fails.
   */
  midgame(wins: number, done: () => void): boolean {
    if (!midgameAllowed({ adsReady: this.adsReady, adOpen: this.adOpen, now: nowS(), last: this.lastMidgame, wins })) return false;
    this.lastMidgame = nowS();
    this.request('midgame', (_watched) => done());
    return true;
  }

  /**
   * A rewarded ad. `grant` runs only for an ad watched to the end; `settled` always runs once.
   * Returns false when none can be shown now.
   */
  rewarded(grant: () => void, settled?: (granted: boolean) => void): boolean {
    if (!this.rewardReady) return false;
    this.lastReward = nowS();
    this.request('rewarded', (watched) => {
      if (watched) grant();
      settled?.(watched);
    });
    return true;
  }

  private request(type: 'midgame' | 'rewarded', finish: (watched: boolean) => void): void {
    this.adOpen = true;
    const wasPlaying = this.playing;
    this.gameplayStop();
    audio.setHold('ad', true);
    let done = false;
    const end = (watched: boolean): void => {
      if (done) return;
      done = true;
      this.adOpen = false;
      audio.setHold('ad', false);
      if (wasPlaying) this.gameplayStart();
      finish(watched);
    };
    try {
      this.sdk!.ad.requestAd(type, { adFinished: () => end(true), adError: () => end(false) });
    } catch {
      end(false);
    }
  }

  private call(fn: () => void): void {
    try {
      fn();
    } catch {
      /* reporting must never break the game */
    }
  }
}

/** The one portal for the page. Game code talks to this and nothing else. */
export const portal = new Portal();
