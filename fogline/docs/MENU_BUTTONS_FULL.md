# Full supplied menu button set

Status: approved for implementation.

## Intent

Replace the two title-screen buttons with all five supplied button slices,
using their baked labels as-is (no text drawn on top), and make each one do
something real.

## Button actions

| Baked label | Action |
| --- | --- |
| CONTINUE | Start the game |
| NEW GAME | Start the game (fresh run; no save data is erased) |
| ARMORY | Open the armory/shop |
| SETTINGS | Open a menu settings panel: volume sliders + fullscreen |
| STORE | Open the armory/shop (same shop, as requested) |

CONTINUE and NEW GAME both start a run because there is no mid-run save state;
NEITHER clears the best-wave/best-kills record. ARMORY and STORE both open the
same in-game armory.

## Approaches considered

1. **Five baked-label art buttons + menu-safe actions (recommended).** Uses all
   supplied art with no overlays. Requires a small settings scene and passing a
   flag into `GameScene` so the shop can open from the menu.
2. **Five art buttons but duplicate Deploy/Fullscreen actions.** Easier, but
   ARMORY/SETTINGS/STORE would be decorative, which the user rejected.
3. **Keep two buttons and overlay labels.** Explicitly rejected: no text on top.

## Implementation

- Register five frames from the 1536×1024 sheet in `BootScene`:
  `btn_continue`, `btn_new_game`, `btn_armory`, `btn_settings`, `btn_store`.
- Replace `imageButton` with `artButton(scene, x, y, w, h, frame, onClick, depth)`:
  draws only the frame with hover tint + existing hover/click audio. No patch,
  no text.
- `MenuScene` stacks the five art buttons on the right-centre of the title art.
  Keep background, dimmer, best-run line, footer, Enter deploy and F fullscreen.
- `GameScene.create(data)` accepts `{ openShop?: boolean }`; when set, it calls
  `openShop()` after setup. ARMORY/STORE use `scene.start('Game', { openShop: true })`.
- Add `SettingsScene` with volume sliders (SaveManager), a FULLSCREEN button and
  a BACK button. Register it in `main.ts`. SETTINGS launches it from the menu.
- Other scenes keep their procedural buttons.

## Constraints

- No text drawn on the five menu button slices.
- Use baked labels exactly as supplied.
- Shop and settings must work when opened from the title screen.
- No save records are cleared.
- Gameplay, weapons, enemies and audio mappings unchanged.

## Tests

- Asset/key tests for the five button frames.
- Source check that `MenuScene` uses five `artButton(` calls and has no
  `imageButton(` or patch/text overlay.
- Browser: all five buttons visible with baked labels, each click performs its
  action, settings sliders save, no console errors.

## Non-goals

- Adding new store content or purchases.
- Mid-run save/resume.
- Changing in-game HUD buttons.
