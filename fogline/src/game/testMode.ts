// Development/testing convenience. A dev server starts with a full loadout so
// every weapon and ability can be exercised without grinding; add ?dev=0 to
// play the normal balance. Production builds stay normal unless ?dev=1 is used.

/** True when the test loadout should be granted at the start of a run. */
export function isTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  const dev = new URLSearchParams(window.location.search).get('dev');
  if (dev === '0') return false;
  return import.meta.env.DEV || dev !== null;
}
