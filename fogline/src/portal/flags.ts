// What kind of build and device this is. Kept free of the game and of Phaser, so any
// module may ask.

/** The portal this build targets: '' (website, itch.io) or 'crazygames'. */
export const PORTAL: string = import.meta.env.VITE_PORTAL ?? '';
/** True in the build made for CrazyGames, which has rules of its own. */
export const CRAZY = PORTAL === 'crazygames';

export type DeviceKind = 'desktop' | 'tablet' | 'mobile';

let reported: DeviceKind | null = null;

/** The portal's own word on the device (the SDK's system info). Anything else is ignored. */
export function setDeviceKind(kind: unknown): void {
  reported = kind === 'desktop' || kind === 'tablet' || kind === 'mobile' ? kind : null;
}

export function deviceKind(): DeviceKind | null {
  return reported;
}

/** True for a laptop or desktop the portal has named as one: no phone controls, even if it has a touch screen. */
export function isDesktop(): boolean {
  return reported === 'desktop';
}

/**
 * A phone or tablet. The portal's word comes first, since many laptops have touch screens;
 * without it, a finger as the main pointer decides.
 */
export function isHandheld(): boolean {
  if (reported) return reported !== 'desktop';
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
}
