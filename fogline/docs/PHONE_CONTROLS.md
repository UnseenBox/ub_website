# Phone controls and landscape layout

Status: approved for implementation.

## Intent

Make Fogline playable on a phone held horizontally: aim with the left thumb,
fire with the right thumb, and keep the whole battlefield and HUD visible
without page scrolling, zooming or browser-chrome clipping.

## Approaches considered

1. **Split touch pointers, keep fixed 16:9 battlefield (recommended).**
   Add multi-touch input, map left-half drag to the crosshair and right-half hold
   to firing, and tighten the page/viewport CSS around Phaser's existing FIT
   scaling. Lowest risk: no camera, art or HUD layout changes, and the M1A aim
   contract stays intact.
2. **Dynamic RESIZE canvas edge-to-edge.** Fill any aspect ratio by redrawing
   the battlefield/HUD for each viewport size. Best use of screen space, but
   would require reworking perspective, HUD anchors and generated textures.
3. **Virtual stick + fire button.** A joystick-style aim and a single circular
   fire button. Familiar to some players, but it changes how aiming feels and
   adds UI not requested here.

Approach 1 is the one proposed here.

## Control mapping

- On touch devices, the game accepts up to three simultaneous pointers.
- **Left half of the battlefield**: touch/drag moves the crosshair to the
  finger. The gun aim is solved as the inverse of the existing aim offsets, so
  the M1A muzzle remains exactly 80 px below the crosshair and all view models
  keep their fixed offset.
- **Right half of the battlefield, above the HUD**: hold to fire. Release to
  stop. A touch on the HUD does not fire.
- Mouse and keyboard controls are unchanged: mouse aims, left click fires,
  right click reloads.
- A first touch unlocks audio, as today.

## Responsive layout

- `index.html` viewport: `width=device-width, initial-scale=1,
  maximum-scale=1, user-scalable=no, viewport-fit=cover`.
- Page/CSS: `100dvh` height, `touch-action: none`, `overscroll-behavior: none`,
  no selection/callout, canvas fills the fixed game container.
- Keep Phaser `Scale.FIT` + `CENTER_BOTH`: the full 1280×720 scene, including
  the bottom HUD, stays visible with uniform letterboxing on wider phones.
- Show a simple portrait "Rotate to landscape" hint via CSS when the viewport
  is portrait and coarse-pointer.

## Visual hint

Two faint labels, `AIM` on the left and `FIRE` on the right, appear near the
bottom of the battlefield on coarse-pointer devices. They fade out after the
first successful touch so they do not obscure play.

## Files

- Modify: `fogline/index.html`
- Modify: `fogline/src/main.ts`
- Add: `fogline/src/game/touchControls.ts`
- Modify: `fogline/src/game/GameScene.ts`
- Modify: `fogline/src/systems/logic.test.ts`
- Modify: `fogline/docs/PHONE_CONTROLS.md` (new short doc)

## Tests

- `touchGunAim(200, 300)` inverts the offsets to `(350, 380)`; applying the
  normal crosshair offset returns `(200, 300)`.
- `touchGunAim` clamps to the battlefield (`x ≤ 1280`, `y ≤ hudTop`).
- `isAimTouch` / `isFireTouch` classify the two halves and reject HUD-area fire.
- Existing 33 tests, including the M1A muzzle-gap tests, keep passing.
- Browser: in landscape touch emulation, left drag moves the crosshair under
  the finger, right hold fires and releases stop firing, the HUD remains
  clickable, and no touch gesture scrolls or zooms the page.

## Non-goals

- Changing weapon balance, enemy behaviour or audio.
- Edge-to-edge dynamic aspect-ratio rendering.
- Forcing orientation lock (browsers do not allow it from a page).
- Changing desktop mouse/keyboard behaviour.
