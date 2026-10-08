// One small interface over the ad networks, picked at build time with
// VITE_AD_PROVIDER. The game only ever asks for two things: a rewarded ad
// (the player chose to watch it for a hint or an extra try) and an
// interstitial between practice rounds.

/** `unavailable` means no ad could be shown; the game grants the reward anyway. */
export type RewardResult = 'rewarded' | 'skipped' | 'unavailable'

interface AdProvider {
  init(): Promise<void>
  rewarded(placement: string): Promise<RewardResult>
  interstitial(placement: string): Promise<void>
  gameplayStart(): void
  gameplayStop(): void
  /** A moment of celebration, which some portals use as a signal. */
  happy(): void
}

const noop = () => {}

function loadScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v)
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

const none: AdProvider = {
  init: async () => {},
  rewarded: async () => 'unavailable',
  interstitial: async () => {},
  gameplayStart: noop,
  gameplayStop: noop,
  happy: noop,
}

/** A fake ad overlay so the whole flow can be played and tested locally. */
const dev: AdProvider = {
  ...none,
  rewarded: (placement) => fakeAd(`Rewarded ad · ${placement}`, true),
  interstitial: async (placement) => {
    await fakeAd(`Interstitial · ${placement}`, false)
  },
}

function fakeAd(label: string, skippable: boolean): Promise<RewardResult> {
  return new Promise((resolve) => {
    const el = document.createElement('div')
    el.className = 'fake-ad'
    el.innerHTML = `<div class="fake-ad-box"><p class="fake-ad-tag">AD</p><p>${label}</p><p class="fake-ad-count">3</p>${
      skippable ? '<button type="button" class="btn ghost">Close (no reward)</button>' : ''
    }</div>`
    document.body.appendChild(el)
    let left = 3
    const count = el.querySelector('.fake-ad-count')!
    const finish = (r: RewardResult) => {
      clearInterval(timer)
      el.remove()
      resolve(r)
    }
    const timer = setInterval(() => {
      left--
      count.textContent = String(left)
      if (left <= 0) finish('rewarded')
    }, 1000)
    el.querySelector('button')?.addEventListener('click', () => finish('skipped'))
  })
}

// --- CrazyGames SDK v3: https://docs.crazygames.com/sdk/html5-v3/ ---

interface CrazySdk {
  init(): Promise<void>
  ad: {
    requestAd(
      type: 'midgame' | 'rewarded',
      callbacks: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void },
    ): void
  }
  game: { gameplayStart(): void; gameplayStop(): void; happytime(): void }
}

function crazySdk(): CrazySdk | undefined {
  return (window as unknown as { CrazyGames?: { SDK: CrazySdk } }).CrazyGames?.SDK
}

const crazygames: AdProvider = {
  async init() {
    await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js')
    await crazySdk()?.init()
  },
  rewarded(placement) {
    const sdk = crazySdk()
    if (!sdk) return Promise.resolve('unavailable')
    return new Promise((resolve) => {
      sdk.ad.requestAd('rewarded', {
        adFinished: () => resolve('rewarded'),
        adError: (e) => {
          console.warn('[ads] rewarded', placement, e)
          resolve('unavailable')
        },
      })
    })
  },
  interstitial(placement) {
    const sdk = crazySdk()
    if (!sdk) return Promise.resolve()
    return new Promise((resolve) => {
      sdk.ad.requestAd('midgame', {
        adFinished: () => resolve(),
        adError: (e) => {
          console.warn('[ads] midgame', placement, e)
          resolve()
        },
      })
    })
  },
  gameplayStart: () => crazySdk()?.game.gameplayStart(),
  gameplayStop: () => crazySdk()?.game.gameplayStop(),
  happy: () => crazySdk()?.game.happytime(),
}

// --- Google H5 Games Ads (Ad Placement API): https://developers.google.com/ad-placement ---

interface AdBreakDone {
  breakStatus: string
}

interface AdBreakConfig {
  type: 'reward' | 'next'
  name: string
  beforeAd?: () => void
  afterAd?: () => void
  beforeReward?: (showAdFn: () => void) => void
  adDismissed?: () => void
  adViewed?: () => void
  adBreakDone?: (info: AdBreakDone) => void
}

type AdsQueue = { push(o: unknown): void }

function adBreak(config: AdBreakConfig): void {
  const w = window as unknown as { adsbygoogle?: AdsQueue }
  w.adsbygoogle?.push(config)
}

const h5: AdProvider = {
  async init() {
    const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
    if (!client) throw new Error('VITE_ADSENSE_CLIENT is not set')
    const w = window as unknown as { adsbygoogle?: unknown[] }
    w.adsbygoogle = w.adsbygoogle || []
    const attrs: Record<string, string> = { crossorigin: 'anonymous', 'data-ad-frequency-hint': '120s' }
    if (import.meta.env.VITE_ADSENSE_TEST === 'on') attrs['data-adbreak-test'] = 'on'
    await loadScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`, attrs)
    ;(w.adsbygoogle as AdsQueue).push({ preloadAdBreaks: 'on', sound: 'off' })
  },
  rewarded(placement) {
    return new Promise((resolve) => {
      let result: RewardResult = 'unavailable'
      adBreak({
        type: 'reward',
        name: placement,
        beforeReward: (showAdFn) => {
          result = 'skipped'
          showAdFn()
        },
        adViewed: () => (result = 'rewarded'),
        adDismissed: () => (result = 'skipped'),
        adBreakDone: () => resolve(result),
      })
    })
  },
  interstitial(placement) {
    return new Promise((resolve) => adBreak({ type: 'next', name: placement, adBreakDone: () => resolve() }))
  },
  gameplayStart: noop,
  gameplayStop: noop,
  happy: noop,
}

const PROVIDERS: Record<string, AdProvider> = { none, dev, crazygames, h5 }

const requested = (import.meta.env.VITE_AD_PROVIDER as string | undefined) ?? (import.meta.env.DEV ? 'dev' : 'none')
let provider: AdProvider = PROVIDERS[requested] ?? none

/** Interstitials are capped so practice never feels like an ad wall. Shorter in dev to test the flow. */
const INTERSTITIAL_GAP_MS = import.meta.env.DEV ? 15_000 : 120_000
const sessionStart = Date.now()
let lastInterstitial = 0
/** Calls before the SDK finishes loading are ignored rather than queued. */
let ready = false

export const ads = {
  async init(): Promise<void> {
    try {
      await provider.init()
    } catch (e) {
      // An ad blocker or a failed SDK must never stop the game from loading.
      console.warn('[ads] init failed, continuing without ads', e)
      provider = none
    }
    ready = true
  },
  rewarded: async (placement: string): Promise<RewardResult> => {
    if (!ready) return 'unavailable'
    provider.gameplayStop()
    return provider.rewarded(placement)
  },
  /** Shows an interstitial only if the cap allows it; never in the first minutes of a session. */
  async maybeInterstitial(placement: string): Promise<void> {
    const now = Date.now()
    if (!ready || now - sessionStart < INTERSTITIAL_GAP_MS || now - lastInterstitial < INTERSTITIAL_GAP_MS) return
    lastInterstitial = now
    provider.gameplayStop()
    await provider.interstitial(placement)
  },
  gameplayStart: () => ready && provider.gameplayStart(),
  gameplayStop: () => ready && provider.gameplayStop(),
  happy: () => ready && provider.happy(),
}
