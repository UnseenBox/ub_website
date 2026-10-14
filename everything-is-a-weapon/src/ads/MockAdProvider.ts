import type { AdPlacement, AdProvider } from './AdManager';

/**
 * Development stand-in. It never renders anything that looks like an ad: by default it
 * reports that nothing is available, so the plain web build simply has no ads.
 * Add `?mockads=1` to the URL in development to exercise the reward flow (calls are
 * logged and resolve after a short delay).
 */
export class MockAdProvider implements AdProvider {
  readonly name = 'mock';
  readonly pacing = 'self' as const;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = import.meta.env.DEV && new URLSearchParams(window.location.search).has('mockads');
  }

  async initialize(): Promise<void> {
    if (this.enabled) console.info('[ads:mock] enabled: ad calls are simulated, nothing is displayed.');
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  async showInterstitial(placement: AdPlacement, onStart: () => void): Promise<void> {
    console.info(`[ads:mock] interstitial requested at "${placement}"`);
    onStart();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  async showRewarded(placement: AdPlacement, onStart: () => void): Promise<boolean> {
    console.info(`[ads:mock] rewarded ad requested at "${placement}", granting reward`);
    onStart();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return true;
  }
}
