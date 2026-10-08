/**
 * Picking a game from a tile is a request to play it, so the player on the game's page
 * starts by itself. This lives in module state on purpose: it only survives a client-side
 * navigation, so a fresh page load (a shared link, a search result) never autostarts.
 */
let pending: { slug: string; at: number } | null = null;

const FRESH_FOR_MS = 15_000;

export function requestAutostart(slug: string) {
  pending = { slug, at: Date.now() };
}

/** Touch devices are left out: there the game opens as its own page, on the visitor's tap. */
export function wantsAutostart(slug: string): boolean {
  if (!pending || pending.slug !== slug || Date.now() - pending.at > FRESH_FOR_MS) return false;
  return !window.matchMedia("(pointer: coarse)").matches;
}

export function clearAutostart() {
  pending = null;
}
