# Supplied menu-button artwork

Status: approved for implementation.

## Intent

Replace the two procedural title-screen buttons with cropped slices of the
supplied `Post-Apocalyptic Military Menu Buttons.png`, while keeping the correct
DEPLOY and FULLSCREEN labels and behaviour.

## Approaches considered

1. **Crop two slices, cover baked text, overlay correct labels (recommended).**
   Keeps the menu actions exactly as they are and uses the supplied art.
2. **Use slices unchanged with their baked labels.** Would show NEW GAME /
   SETTINGS while the actions are still deploy / fullscreen, which is confusing.
3. **Rebuild a five-button menu to match the sheet.** Changes menu structure and
   requires new settings/armory actions from the title screen; out of scope.

## Implementation

- Copy `D:\Fogline\UI\Post-Apocalyptic Military Menu Buttons.png` byte-for-byte
  to `src/assets/menu-buttons.png` (1536×1024).
- Load it in `BootScene.preload()` as `menu_buttons`, and register two atlas
  frames from the dark, uniform button rows:
  - `btn_deploy` from the ARMORY row (approx. x 266, y 458, w 1002, h 136).
  - `btn_fullscreen` from the SETTINGS row (approx. x 263, y 630, w 1005, h 130).
- Add `ui/buttonArt.ts` exporting `imageButton(...)`, matching the existing
  `button(...)` signature. It draws the sliced frame, covers the baked label
  with a dark inset panel sampled from the same button's blank area where
  practical, draws the supplied label in STENCIL, and keeps hover/click audio.
- `MenuScene` uses `imageButton` for DEPLOY and FULLSCREEN. Shop, Pause and
  GameOver keep their existing procedural buttons.

## Constraints

- Button frame art is supplied; do not re-encode or redraw it.
- Labels must read `DEPLOY` and `FULLSCREEN`; actions and shortcuts unchanged.
- Keep button click/hover audio and hit areas.
- No changes to gameplay, weapons, enemies or audio mappings.

## Tests

- Asset/key tests for `menu_buttons`, `btn_deploy` and `btn_fullscreen`.
- Source check that `MenuScene` uses `imageButton` for its two buttons.
- Browser: title screen shows the supplied button art with clean labels, no
  baked text bleed, working hover/click and no console errors.

## Non-goals

- Adding CONTINUE / NEW GAME / STORE actions.
- Changing other scenes' buttons.
- Cropping or editing the source PNG on disk.
