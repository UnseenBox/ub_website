// The game's typefaces are bundled in public/fonts and declared in index.html. Phaser
// draws text with whatever is loaded when it is made, so the game waits for them first.

/** Every face and size the game draws with (the bold Saira is used for emphasis). */
const FACES = ['400 40px "Saira Stencil One"', '400 16px "Saira"', '700 16px "Saira"'];

/** Resolves once the faces are ready, or after `timeoutMs` so a slow network never blocks play. */
export function loadGameFonts(timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const loaded = Promise.all(FACES.map((face) => document.fonts.load(face))).then(
    () => undefined,
    () => undefined,
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([loaded, timeout]);
}
