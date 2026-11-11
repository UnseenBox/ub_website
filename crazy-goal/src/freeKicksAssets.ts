/**
 * Hands the hashed asset URLs Vite produces to the Free Kicks module.
 *
 * Free Kicks (crazy-goal/free-kicks/) is plain browser JavaScript that is not bundled: it is
 * copied next to the build and loaded by <script defer> after this entry module has run. It
 * cannot import assets, so this file imports them (`?url`, the same imports Game.ts uses, so
 * every URL is the one the build already emits) and publishes them as `window.CrazyKoraAssets`.
 * Free Kicks falls back to quiet/no art when a name is missing.
 */
import arcadeStarUrl from './assets/ui/arcade-star.png?url';
import courtyardUrl from './assets/ui/courtyard.webp?url';
import sfxSheetUrl from './assets/sfx.wav?url';
import clickUrl from '../assets/sfx/click.mp3?url';
import glassTapUrl from '../assets/sfx/glass tap.mp3?url';
import goalUrl from '../assets/sfx/GOAL.mp3?url';
import kickBallUrl from '../assets/sfx/kick the Ball.mp3?url';
import meowUrl from '../assets/sfx/funny Meow.mp3?url';
import metalUrl from '../assets/sfx/metal.mp3?url';
import powerUpUrl from '../assets/sfx/power up.mp3?url';
import stoneUrl from '../assets/sfx/rock.mp3?url';
import tinUrl from '../assets/sfx/tin.mp3?url';
import whistleUrl from '../assets/sfx/whistle.mp3?url';

export interface CrazyKoraAssets {
  star: string;
  courtyard: string;
  /** The classic sound sheet (a WAV); Free Kicks reads its own offsets from it. */
  sfxSheet: string;
  /** Standalone recordings by the names Classic's SoundLibrary uses. */
  clips: Record<string, string>;
}

declare global {
  interface Window {
    CrazyKoraAssets?: CrazyKoraAssets;
  }
}

window.CrazyKoraAssets = {
  star: arcadeStarUrl,
  courtyard: courtyardUrl,
  sfxSheet: sfxSheetUrl,
  clips: {
    click: clickUrl,
    glass_tap: glassTapUrl,
    goal: goalUrl,
    kick_ball: kickBallUrl,
    meow: meowUrl,
    metal: metalUrl,
    power_up: powerUpUrl,
    stone: stoneUrl,
    tin: tinUrl,
    whistle: whistleUrl,
  },
};
