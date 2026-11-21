// On phones the browser's address bar and toolbars leave the game in a small
// window. Ask for real full screen (and landscape) on the first tap, which is the
// user gesture browsers require. Android Chrome and most Android browsers support
// this; iPhone Safari has no page full screen, so it keeps the add-to-home-screen route.

type FullscreenTarget = {
  requestFullscreen?: (options?: { navigationUI?: 'hide' | 'show' | 'auto' }) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export interface PhoneFullscreenDeps {
  isPhone: boolean;
  target: FullscreenTarget;
  isFullscreen: () => boolean;
  lockLandscape: () => Promise<void> | void;
}

/** Try once to enter full screen. Returns true if the browser accepted the request. */
export async function enterPhoneFullscreen(deps: PhoneFullscreenDeps): Promise<boolean> {
  if (!deps.isPhone || deps.isFullscreen()) return false;
  const t = deps.target;
  try {
    if (t.requestFullscreen) await t.requestFullscreen({ navigationUI: 'hide' });
    else if (t.webkitRequestFullscreen) await t.webkitRequestFullscreen();
    else return false;
  } catch {
    return false;
  }
  try {
    await deps.lockLandscape();
  } catch {
    /* orientation lock is optional */
  }
  return true;
}

/**
 * Wire the first-tap request. Keeps trying on later taps until a request is accepted
 * or the browser has no full-screen support; after the player leaves full screen
 * themselves it does not ask again.
 */
export function installPhoneFullscreen(): void {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  const el = document.documentElement as HTMLElement & FullscreenTarget;
  const isPhone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (!isPhone || (!el.requestFullscreen && !el.webkitRequestFullscreen)) return;
  let done = false;
  const onTap = (): void => {
    if (done) return;
    void enterPhoneFullscreen({
      isPhone,
      target: el,
      isFullscreen: () => !!(doc.fullscreenElement || doc.webkitFullscreenElement),
      lockLandscape: () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'),
    }).then((ok) => {
      if (ok) {
        done = true;
        window.removeEventListener('pointerup', onTap, true);
      }
    });
  };
  // pointerup counts as a user activation; touchstart does not.
  window.addEventListener('pointerup', onTap, true);
}
