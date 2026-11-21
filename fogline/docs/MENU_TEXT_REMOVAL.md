# Remove menu control text

Status: approved for implementation.

## Intent

Simplify the title screen after the supplied background was added by removing
the keyboard/mouse help block that still covers the bottom of the artwork.

## Implementation

- Delete the `controls` array, its dark panel rectangle and the text object in
  `MenuScene.create`.
- Keep the background image, dimmer, DEPLOY/FULLSCREEN buttons, test-mode
  notice, best-run line and footer unchanged.
- Keep all keyboard shortcuts functional; only the on-screen explanation goes.

## Approaches

1. **Remove text and empty panel (recommended).** Cleanest result; the artwork
   is fully visible and no empty box is left behind.
2. **Remove text but keep the panel.** Leaves an unexplained empty rectangle,
   so it is worse visually.
3. **Fade the text after a few seconds.** More code and the text still appears
   initially, which the user asked to remove.

## Tests

- A source check confirms `MOUSE          aim` no longer appears in `MenuScene`.
- Existing tests stay green.
- Browser: title screen shows the image with no control block; buttons and
  other menu text remain.

## Non-goals

- Changing menu buttons, shortcuts or any gameplay UI.
- Changing the background image or dimmer.
