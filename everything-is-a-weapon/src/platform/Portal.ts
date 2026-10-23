import type { AdProvider } from '../ads/AdManager';
import { MockAdProvider } from '../ads/MockAdProvider';

/** The three calls of localStorage the save file needs; a portal may supply its own. */
export interface PortalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Wherever the game is being hosted. A games portal wants to know when play starts and
 * stops, wants its own ads, its own mute switch and its own save storage; the game talks
 * to this interface and never to a portal's SDK directly.
 *
 * Which one is used is decided by the build (see createPortal in ./index.ts). The plain web
 * build gets WebPortal, where every call is a no-op.
 */
export interface Portal {
  readonly name: string;
  /** Loads and starts the portal's SDK. Never rejects: on failure the portal goes quiet. */
  init(): Promise<void>;
  readonly ads: AdProvider;
  /** Null means "use the browser's own localStorage". */
  readonly storage: PortalStorage | null;
  /** The portal has its own fullscreen button and rotate-your-phone prompt. */
  readonly managesScreen: boolean;
  loadingStart(): void;
  loadingStop(): void;
  /** The player is in control of the hero. */
  gameplayStart(): void;
  /** Menu, pause, results. */
  gameplayStop(): void;
  /** A rare, real achievement: the portal may throw confetti. */
  celebrate(): void;
  /** 0..100: how far through the hand-made rooms the player has got. */
  reportProgress(percent: number): void;
  /** Attached to feedback players send through the portal. Null clears it. */
  setContext(context: Record<string, string | number> | null): void;
  /** Calls back now, and again whenever the portal's own mute switch changes. */
  onMuteChange(listener: (muted: boolean) => void): void;
}

export class WebPortal implements Portal {
  readonly name = 'web';
  readonly ads: AdProvider = new MockAdProvider();
  readonly storage = null;
  readonly managesScreen = false;
  async init(): Promise<void> {}
  loadingStart(): void {}
  loadingStop(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  celebrate(): void {}
  reportProgress(): void {}
  setContext(): void {}
  onMuteChange(listener: (muted: boolean) => void): void {
    listener(false);
  }
}
