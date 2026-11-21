import { audio } from './AudioManager';

const ROOT = 'audio/fogline';

/** Supplied shot recordings, one per firearm. */
export const WEAPON_SHOT_FILES = {
  shot_service: `${ROOT}/gun-1.mp3`,
  shot_m4: `${ROOT}/gun-2.mp3`,
  shot_m249: `${ROOT}/gun-3.mp3`,
  shot_m32: `${ROOT}/rocket-launch.mp3`,
} as const;

/** Supplied impact recordings for projectile weapons. */
export const WEAPON_IMPACT_FILES = {
  rocket_impact: `${ROOT}/rocket-explosion.mp3`,
} as const;

/**
 * Recorded SFX supplied for Fogline. These replace the synthesized placeholders
 * for the same keys as soon as the first click unlocks the AudioContext.
 * Paths are relative to the page so the static build also works from a subfolder.
 */
export function registerFoglineOverrides(): void {
  for (const [key, url] of Object.entries(WEAPON_SHOT_FILES)) {
    audio.registerOverride(key, url);
  }
  for (const [key, url] of Object.entries(WEAPON_IMPACT_FILES)) {
    audio.registerOverride(key, url);
  }

  const reload = `${ROOT}/gun-reload.mp3`;
  for (const key of ['reload_service', 'reload_m4', 'reload_m249', 'reload_m32']) {
    audio.registerOverride(key, reload);
  }

  const kill = `${ROOT}/kill-4.mp3`;
  for (const key of ['death_0', 'death_1', 'death_2']) {
    audio.registerOverride(key, kill);
  }

  audio.registerOverride('ui_hover', `${ROOT}/hover.mp3`);
  audio.registerOverride('ui_click', `${ROOT}/click.mp3`);

  // No "Kill sfx 3" was supplied; "killing sfx" serves as the third cue.
  audio.registerOverride('headshot_confirm', [
    `${ROOT}/kill-1.mp3`,
    `${ROOT}/kill-2.mp3`,
    `${ROOT}/killing.mp3`,
  ]);
}
