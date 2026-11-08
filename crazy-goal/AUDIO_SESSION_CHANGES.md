# Crazy Goal — audio/SFX session changes

Date: 2026-11-08 (local session)

## SFX/assets wired (`crazy-goal/assets/sfx`)
- `bg music.mp3` → looping background music on the music bus (`loadMusic`).
- `GOAL.mp3` → goal sting (clip `goal`).
- `kick the Ball.mp3` → kick sound on shot release.
- `power up.mp3` → plays when charging starts (`aimStart`); **stops** on kick/release or cancel/drop (`audio.stop('power_up')`).
- `hrissa ability.mp3` / `magnet ability.mp3` / `rubber ability.mp3` → ability boost SFX; played on **activation/arming** and on boost launch.
- `funny Meow.mp3` → cat meow (cat save, cat trick, and ball hitting the cat).
- `click.mp3` → menu/UI button taps (Overlay button hook) and existing click uses.
- `drop.mp3`, `glass tap.mp3` (`glass_tap`), `glass_break.mp3`, `metal.mp3`, `planquw.mp3` (`plank`), `rock.mp3` (`stone`), `tin.mp3`, `whistle.mp3`, `wood.mp3` → loaded as clips replacing corresponding sheet/sound uses.

## Audio engine changes
- `AudioManager`: `loadClip`/`loadMusic` standalone clips; clip priority over sheet in `play()`; looping music on music bus; track active sources + `stop(name)`; trim leading (and trailing, non-music) silence on decoded clips; `PlayOptions.duration` to cap playback; global `SFX_LEVEL`/lower `MUSIC_LEVEL` to reduce harshness; `tone()`/`swell()` made no-ops (no synthetic/procedural SFX).
- `SoundLibrary`: uses asset clips above; GOAL SFX stops on **Next houma** (`Game.nextLevel()`); removed synthetic alarm/horn/boom/meow-fallback/swell/tone behavior (assets/sfx only). Rock/wall (`stone`) plays at full (trimmed) length.

## Volumes
- Lowered defaults: sound `0.3`, music `0.2` (`SaveManager`, `AudioManager`). Existing saved user settings are preserved.

## Touched files
- `crazy-goal/src/audio/AudioManager.ts`, `crazy-goal/src/audio/SoundLibrary.ts`, `crazy-goal/src/core/Game.ts`, `crazy-goal/src/feedback/Feedback.ts`, `crazy-goal/src/save/SaveManager.ts`, `crazy-goal/src/ui/Overlay.ts`
- `crazy-goal/assets/sfx/*` (new/updated recordings)
- `public/arcade/crazy-goal/*` (rebuilt & synced web deploy)
