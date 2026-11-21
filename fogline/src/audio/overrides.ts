import { audio } from './AudioManager';

const ROOT = 'audio/fogline';

/**
 * Recorded SFX supplied for Fogline. These replace the synthesized placeholders
 * for the same keys as soon as the first click unlocks the AudioContext.
 * Paths are relative to the page so the static build also works from a subfolder.
 */
export function registerFoglineOverrides(): void {
  const gunshot = `${ROOT}/gun-1.mp3`;
  for (const key of ['shot_service', 'shot_m4', 'shot_m249', 'shot_m32']) {
    audio.registerOverride(key, gunshot);
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
