# Phone controls and aiming

Fogline is played on a phone held horizontally. The whole 1280×720 scene, including
the HUD, stays visible (Phaser `Scale.FIT`), with no scrolling, zooming or
browser-chrome clipping.

## Aiming (all devices)

- The crosshair is exactly where the pointer is. On desktop that is the mouse; on a
  phone it is the thumb-dragged crosshair described below. There is no hidden offset.
- The gun is rotated so the barrel axis points straight at the crosshair, and the muzzle
  sits on that line a short distance in front of it. Shots, the grenade target and the
  orbital strike all use the crosshair position.
- M1A: `barrelAlign` in `data/weapons.ts` (`tailX/tailY` mark the stock end of the
  photo's rifle axis; `anchorY` is a far-away point that keeps the aim lines nearly
  parallel, so the photo only turns a few degrees as the crosshair sweeps the screen).
  `entities/viewModelPose.ts` does the maths. The stock stays near the bottom of the
  screen while the muzzle moves with the crosshair.

## Touch layout

| Control | Where | What it does |
| --- | --- | --- |
| Aim | Anywhere on the left half above the HUD | Drag to move the crosshair: it moves with the thumb, at once (relative, 2.2× sensitivity). No aim assistance |
| FIRE | Large round button, bottom right (or anywhere on the right half) | Hold to fire; release to stop. A reload ring runs around it |
| RLD | Round button above-left of FIRE | Reload |
| II | Top left | Pause |
| SHOP | Top left, next to pause | Armory (pauses combat) |
| DEPLOY | Pill, bottom centre | Appears between waves; starts the next wave |
| HUD slots | Bottom panel | Tap weapons, ammo mods, support strikes and bunker defences |
| Tools | Round buttons down the right edge | Special tools won from side quests |

The right half never aims, so the firing thumb cannot disturb the sights. Aim and
fire work at the same time with two thumbs.

The on-screen controls show on coarse-pointer devices, or after the first touch on a
hybrid laptop, and switch off again when a mouse is moved there. Keyboard hints in
button labels and banners (`[SPACE]`, `[ENTER]`, ...) are dropped on touch.

## Files

- `src/game/touchControls.ts`: layout, hit tests, relative aim maths, `keyHint`.
- `src/ui/TouchUI.ts`: draws the buttons, the AIM hint and the DEPLOY pill.
- `src/game/GameScene.ts`: routes touch pointers (aim drag, buttons) and picks the crosshair.
- `src/entities/viewModelPose.ts`: barrel alignment.

## Tests

`npm run test` covers the relative aim and clamping, button hit tests, that every button
sits on the battlefield clear of the HUD, that the M1A barrel points at the crosshair at
eight positions across the screen, and that its rotation stays small.

## Non-goals

- Edge-to-edge dynamic aspect-ratio rendering.
- Forcing orientation lock (browsers do not allow it from a page).
