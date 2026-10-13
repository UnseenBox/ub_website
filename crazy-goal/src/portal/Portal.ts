import { BOOST_COSTS } from '../abilities/Cards';
import type { Game } from '../core/Game';

/** The store portal this build targets: '' (unseenbox and other portals), 'crazygames'. */
export const PORTAL: string = import.meta.env.VITE_PORTAL ?? '';
export const isCrazyGames = PORTAL === 'crazygames';

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
/** How long boot waits for the SDK before playing on without it. */
const SDK_TIMEOUT = 3000;
/** Seconds between rewarded-ad offers. */
const REWARD_COOLDOWN = 90;
const REWARD_KEY = 'crazy-goal-rewarded-at';
const LOCALE_KEY = 'crazygames-locale-applied';

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
  };
  readonly ad: {
    requestAd(type: 'midgame' | 'rewarded', callbacks?: AdCallbacks): void;
  };
  readonly user?: {
    readonly systemInfo?: { readonly locale?: unknown } | null;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazySdk };
  }
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

/**
 * The CrazyGames SDK, kept at arm's length. Everything here is a no-op unless the
 * SDK loaded and reports a live environment, so the same build runs on itch.io,
 * portals and file previews with zero behaviour change. Ads only ever run in
 * solo free play, never in a duel, and never while the ball is live.
 */
export class Portal {
  private sdk: CrazySdk | null = null;
  private playing = false;
  private adOpen = false;
  private heldMuted = false;

  /** Boots the SDK in the background; never blocks the game. */
  async init(): Promise<void> {
    try {
      if (!window.CrazyGames?.SDK) await loadScript(SDK_URL, SDK_TIMEOUT);
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      await sdk.init();
      // Every call throws outside local and crazygames environments.
      if (sdk.environment === 'local' || sdk.environment === 'crazygames') this.sdk = sdk;
    } catch {
      this.sdk = null;
    }
  }

  /** True once the SDK is live (local dev counts: calls show test overlays). */
  get live(): boolean {
    return this.sdk !== null;
  }

  /** Video ads can be requested right now. */
  get ads(): boolean {
    return this.sdk !== null && !this.adOpen;
  }

  loadingStart(): void {
    try {
      this.sdk?.game.loadingStart();
    } catch {
      /* reporting must never break the game */
    }
  }

  loadingStop(): void {
    try {
      this.sdk?.game.loadingStop();
    } catch {
      /* reporting must never break the game */
    }
  }

  gameplayStart(): void {
    if (this.playing) return;
    this.playing = true;
    try {
      this.sdk?.game.gameplayStart();
    } catch {
      /* reporting must never break the game */
    }
  }

  gameplayStop(): void {
    if (!this.playing) return;
    this.playing = false;
    try {
      this.sdk?.game.gameplayStop();
    } catch {
      /* reporting must never break the game */
    }
  }

  /**
   * A midgame break between levels. Returns false when there is no ad path and the
   * caller should carry on at once; otherwise freezes the game and calls `done`
   * when the ad finishes or fails, and the caller carries on then.
   */
  midroll(game: Game, done: () => void): boolean {
    if (!this.ads || game.duel.active || game.shotRule !== 'free' || game.duelScore) {
      done();
      return false;
    }
    this.adOpen = true;
    this.hold(game, true);
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      this.adOpen = false;
      this.hold(game, false);
      done();
    };
    try {
      this.sdk?.ad.requestAd('midgame', { adFinished: finish, adError: finish });
    } catch {
      finish();
    }
    return true;
  }

  /** Seconds until another rewarded ad may be offered, 0 when one can be now. */
  rewardCooldown(): number {
    try {
      const at = Number(localStorage.getItem(REWARD_KEY) ?? 0);
      return Math.max(0, REWARD_COOLDOWN - (Date.now() / 1000 - at));
    } catch {
      return 0;
    }
  }

  /**
   * A rewarded break for coins. `grant` runs only on a finished ad, never on error.
   * Returns false when no ad can be shown (caller should say to try later).
   */
  rewarded(game: Game, grant: () => void): boolean {
    if (!this.ads || game.duel.active || game.shotRule !== 'free' || this.rewardCooldown() > 0) return false;
    try {
      localStorage.setItem(REWARD_KEY, String(Date.now() / 1000));
    } catch {
      /* the cooldown simply will not persist */
    }
    this.adOpen = true;
    this.hold(game, true);
    let settled = false;
    const finish = (paid: boolean): void => {
      if (settled) return;
      settled = true;
      this.adOpen = false;
      this.hold(game, false);
      if (paid) grant();
    };
    try {
      this.sdk?.ad.requestAd('rewarded', { adFinished: () => finish(true), adError: () => finish(false) });
    } catch {
      finish(false);
    }
    return true;
  }

  /** The player's locale from the SDK, if it knows one. */
  locale(): string | null {
    try {
      const locale = this.sdk?.user?.systemInfo?.locale;
      return typeof locale === 'string' ? locale : null;
    } catch {
      return null;
    }
  }

  /** Applies the SDK locale once: Arabic players start in Arabic, everyone else in English. */
  applyLocale(): void {
    if (!isCrazyGames) return;
    try {
      if (sessionStorage.getItem(LOCALE_KEY) || localStorage.getItem('crazy-goal-lang')) return;
      const locale = this.locale();
      if (locale && locale.toLowerCase().startsWith('ar')) {
        localStorage.setItem('crazy-goal-lang', 'ar');
        sessionStorage.setItem(LOCALE_KEY, '1');
        location.reload();
      }
    } catch {
      /* English it is */
    }
  }

  /** Freeze for an ad: no input, no sound, shop hidden. Not the pause card. */
  private hold(game: Game, on: boolean): void {
    if (on) {
      this.gameplayStop();
      this.heldMuted = game.audio.muted;
      game.audio.setMuted(true);
      game.paused = true;
      game.abilities.refresh(BOOST_COSTS);
    } else {
      game.audio.setMuted(this.heldMuted);
      game.paused = false;
      game.abilities.refresh(BOOST_COSTS);
    }
  }
}

/** The one portal for the page. Gameplay code talks to this and nothing else. */
export const portal = new Portal();
