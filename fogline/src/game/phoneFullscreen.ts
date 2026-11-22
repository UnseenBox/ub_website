// Full screen without a button. Browsers only allow entering full screen after a user
// gesture (a tap, click or key press), so the game asks on the very first one. On
// phones it also asks for landscape. Once the game is full screen the request stops;
// if the player leaves full screen, F (or the menu button) brings it back.

type FullscreenTarget = {
  requestFullscreen?: (options?: { navigationUI?: 'hide' | 'show' | 'auto' }) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export interface FullscreenDeps {
  target: FullscreenTarget;
  isFullscreen: () => boolean;
  isPhone: boolean;
  lockLandscape: () => Promise<void> | void;
}

/** Try to enter full screen. Returns true once the browser has accepted the request. */
export async function enterFullscreen(deps: FullscreenDeps): Promise<boolean> {
  if (deps.isFullscreen()) return true;
  const t = deps.target;
  try {
    if (t.requestFullscreen) await t.requestFullscreen({ navigationUI: 'hide' });
    else if (t.webkitRequestFullscreen) await t.webkitRequestFullscreen();
    else return false;
  } catch {
    return false;
  }
  if (deps.isPhone) {
    try {
      await deps.lockLandscape();
    } catch {
      /* orientation lock is optional */
    }
  }
  return true;
}

/** Wire the automatic request: the first tap, click or key press puts the game full screen. */
export function installAutoFullscreen(): void {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  const el = document.documentElement as HTMLElement & FullscreenTarget;
  if (!el.requestFullscreen && !el.webkitRequestFullscreen) return;
  const isPhone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const deps: FullscreenDeps = {
    target: el,
    isPhone,
    isFullscreen: () => !!(doc.fullscreenElement || doc.webkitFullscreenElement),
    lockLandscape: () =>
      (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'),
  };
  const events = ['pointerdown', 'keydown'] as const;
  const ask = (): void => {
    void enterFullscreen(deps).then((ok) => {
      if (!ok) return;
      for (const e of events) window.removeEventListener(e, ask, true);
    });
  };
  for (const e of events) window.addEventListener(e, ask, true);
}
