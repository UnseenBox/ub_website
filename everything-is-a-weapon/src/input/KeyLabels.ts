/**
 * What is printed on the player's own keys. The game reads physical key positions
 * (`event.code`), so movement is on the same four keys on every keyboard; but those keys
 * say WASD on a QWERTY board and ZQSD on a French AZERTY one, and the on-screen hints
 * should say what the player can actually see in front of them.
 */

const MOVE_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const;

interface KeyboardLayoutMap {
  get(code: string): string | undefined;
}
interface NavigatorWithKeyboard {
  keyboard?: { getLayoutMap?(): Promise<KeyboardLayoutMap> };
}

let moveKeys = 'WASD';
const listeners: Array<() => void> = [];

/** The four movement keys as labelled on this keyboard, e.g. "WASD" or "ZQSD". */
export function moveKeysLabel(): string {
  return moveKeys;
}

/** Calls back if a better answer arrives after the first paint. */
export function onKeyLabelsChange(listener: () => void): void {
  listeners.push(listener);
}

function set(label: string): void {
  if (label === moveKeys || label.length !== 4) return;
  moveKeys = label;
  for (const listener of listeners) listener();
}

/** Without access to the layout, the browser language is a fair guess for the common case. */
function guessFromLanguage(): string {
  const language = (navigator.language || 'en').toLowerCase();
  // France and Belgium type on AZERTY; French Canada and Switzerland do not.
  return language === 'fr' || language === 'fr-fr' || language === 'fr-be' || language === 'nl-be' ? 'ZQSD' : 'WASD';
}

/** Asks the browser which characters sit on the movement keys. Safe to call anywhere. */
export function detectKeyLabels(): void {
  set(guessFromLanguage());
  const keyboard = (navigator as NavigatorWithKeyboard).keyboard;
  if (!keyboard?.getLayoutMap) return;
  // Not available in every browser, and an embedding page may forbid it: both are fine.
  keyboard
    .getLayoutMap()
    .then((map) => {
      const label = MOVE_CODES.map((code) => map.get(code) ?? '').join('').toUpperCase();
      if (/^[A-Z]{4}$/.test(label)) set(label);
    })
    .catch(() => {});
}
