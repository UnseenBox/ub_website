// When Fogline may show an ad. Pure, so the rules are tested without the SDK.
//
// CrazyGames asks for midgame breaks no closer than three minutes apart, only at
// natural pauses, and never in the first minutes of a new player's session.
// Rewarded ads are always the player's choice; a short gap stops them being spammed.

/** Seconds between midgame breaks (CrazyGames minimum is 180). */
export const MIDGAME_GAP_S = 180;
/** No midgame break until the player has won this many missions: the first minutes stay clean. */
export const MIDGAME_MIN_WINS = 3;
/** Seconds between rewarded ads. */
export const REWARD_GAP_S = 45;
/** Share of the bunker a "reinforcements" ad restores, once per mission. */
export const REVIVE_SHARE = 0.5;
/** Extra starting cash on a retry after a loss, for a rewarded ad. */
export const RETRY_CASH_BONUS = 0.5;

export interface AdState {
  /** The build has ads switched on and the SDK is live. */
  adsReady: boolean;
  /** An ad is already open. */
  adOpen: boolean;
  /** Seconds since epoch now, and when the last break of this kind ran (0 = never). */
  now: number;
  last: number;
}

export function midgameAllowed(s: AdState & { wins: number }): boolean {
  if (!s.adsReady || s.adOpen) return false;
  if (s.wins < MIDGAME_MIN_WINS) return false;
  return s.last <= 0 || s.now - s.last >= MIDGAME_GAP_S;
}

export function rewardAllowed(s: AdState): boolean {
  if (!s.adsReady || s.adOpen) return false;
  return s.last <= 0 || s.now - s.last >= REWARD_GAP_S;
}

/** Seconds until a rewarded ad may run again (0 = now). */
export function rewardWait(now: number, last: number): number {
  return last <= 0 ? 0 : Math.max(0, Math.ceil(REWARD_GAP_S - (now - last)));
}
