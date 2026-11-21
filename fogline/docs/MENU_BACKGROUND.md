# Main menu background image

Status: approved for implementation.

## Intent

Use the supplied cinematic `Main Menu.png` as the Fogline title-screen
background so the menu matches the provided art instead of the procedural
backdrop.

## Approaches considered

1. **Full-screen supplied background, remove duplicate title (recommended).**
   Load the image at boot, draw it across the 16:9 menu, drop the procedural
   scenery and the built-in FOGLINE/subtitle text, and keep buttons/controls on
   a light dimmer. The supplied logo becomes the only title.
2. **Image behind the existing UI unchanged.** Fastest, but the FOGLINE title
   appears twice and the procedural skyline shows through around the image.
3. **Replace the whole menu with the image.** Loses deploy/settings controls and
   the test-loadout notice, so it is not suitable.

## Implementation

- Copy `D:\Fogline\UI\Main Menu.png` byte-for-byte to
  `fogline/src/assets/main-menu.png` (≈2.4 MB; 16:9, matches the 1280×720 view).
- In `BootScene`, import the PNG and load it with the texture key `menu_bg`,
  exported as `MENU_BG_TEXTURE` so `MenuScene` and tests share one name.
- In `MenuScene.create`, draw `menu_bg` at `(0,0)` with
  `setDisplaySize(VIEW.width, VIEW.height)`. Remove the `backdrop`, `clouds`,
  `ground`, `parapet`, `frame` layers and the `FOGLINE` / subtitle text objects.
- Reduce the full-screen dimmer from `0.45` to `0.25` so the art stays visible
  while buttons remain readable. Keep the control panel, buttons, test-mode
  notice, best-run line and footer. Update the footer to stop claiming all art
  is procedural.
- `Battlefield` and the in-game backdrop are untouched.

## Tests

- `MENU_BG_TEXTURE === 'menu_bg'`.
- `main-menu.png` exists in `src/assets` via Vite's `import.meta.glob`.
- Existing tests remain green.
- Browser: title screen shows the supplied image full-bleed with one logo,
  buttons and control list readable, no missing-texture errors.

## Non-goals

- Re-encoding or cropping the supplied PNG.
- Changing gameplay rendering, weapon views, audio or controls.
- Moving menu buttons or changing their behaviour.
