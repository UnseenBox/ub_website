import type { AdPlacement, AdProvider } from './AdManager';

/**
 * Development provider. Logs what a real portal SDK would have been asked to do
 * and resolves immediately, so the boundaries where ads *would* appear are
 * visible during development without any network calls.
 *
 * It reports itself unavailable outside development, so a production build never
 * shows a placeholder.
 */
export class MockAdProvider implements AdProvider {
  readonly name = 'mock';
  private ready = false;

  async initialize(): Promise<void> {
    this.ready = import.meta.env.DEV;
    if (this.ready) {
      console.info('[ads] mock provider ready; breaks will be logged, not shown');
    }
  }

  isAvailable(): boolean {
    return this.ready;
  }

  async showInterstitial(placement: AdPlacement): Promise<void> {
    console.info(`[ads] interstitial would run here: ${placement}`);
  }

  async showRewarded(placement: AdPlacement): Promise<boolean> {
    console.info(`[ads] rewarded would run here: ${placement}`);
    return true;
  }
}
