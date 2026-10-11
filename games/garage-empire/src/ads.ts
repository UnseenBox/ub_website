// Portal ad integration (CrazyGames SDK v3), mirroring the studio's other games.
// Ads are strictly optional: the full game plays with no ads, and a failed SDK
// load never blocks gameplay. Only gameplay signals + celebration are wired;
// rewarded placements are a documented next step, not a progression gate.

interface CrazySdk {
  init(): Promise<void>
  game: { gameplayStart(): void; gameplayStop(): void; happytime(): void }
}

function crazySdk(): CrazySdk | undefined {
  return (window as unknown as { CrazyGames?: { SDK: CrazySdk } }).CrazyGames?.SDK
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

let ready = false

export const ads = {
  async init(): Promise<void> {
    try {
      if (import.meta.env.VITE_AD_PROVIDER === 'crazygames') {
        await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js')
        await crazySdk()?.init()
        ready = true
      }
    } catch (e) {
      console.warn('[ads] init failed, continuing without ads', e)
    }
  },
  gameplayStart(): void {
    if (ready) {
      try {
        crazySdk()?.game.gameplayStart()
      } catch { /* ignore */ }
    }
  },
  gameplayStop(): void {
    if (ready) {
      try {
        crazySdk()?.game.gameplayStop()
      } catch { /* ignore */ }
    }
  },
  happy(): void {
    if (ready) {
      try {
        crazySdk()?.game.happytime()
      } catch { /* ignore */ }
    }
  },
}
