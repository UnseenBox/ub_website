import { CrazyGamesPortal } from './CrazyGamesPortal';
import { GameMonetizePortal } from './GameMonetizePortal';
import { WebPortal, type Portal } from './Portal';

/**
 * Picks the host for this build. `vite build --mode crazygames` produces the CrazyGames
 * build, `vite build --mode gamemonetize` the GameMonetize.com build; everything else (the
 * studio website, Vercel, local development) is the plain web.
 */
export function createPortal(): Portal {
  if (import.meta.env.MODE === 'crazygames') return new CrazyGamesPortal();
  if (import.meta.env.MODE === 'gamemonetize') return new GameMonetizePortal();
  return new WebPortal();
}

export type { Portal, PortalStorage } from './Portal';
