# Sound effects

Fourteen cues play MP3 samples from this folder, and one MP3 loops as the
background music. The rest — `timesUp`, `newDay`, `dayEnd`, `place` — are
synthesized in `Sfx.ts`.

| Source file | Project file | Cue | Plays when |
| --- | --- | --- | --- |
| `Dig.mp3` | `dig.mp3` | `dig()` | Every shovel impact on dirt |
| `click.mp3` | `click.mp3` | `click()` | UI buttons and keyboard shortcuts |
| `coin.mp3` | `coin.mp3` | `coin()` | Coins flying into the money counter |
| `denied.mp3` | `denied.mp3` | `denied()` | Disabled button, or digging at nothing |
| `exhausted.mp3` | `exhausted.mp3` | `tired()` | A swing refused because stamina is empty |
| `soil level Up.mp3` | `soil-level-up.mp3` | `layerEnter()` | Entering a new soil/stone layer (replaced `layer-enter.mp3`) |
| `money collect.mp3` | `money-collect.mp3` | `collect()` | Rock first appears in the dirt, and again when it lands in the bag |
| `Rock found.mp3` | `rock-found.mp3` | `discover()` | Buried rock popping free |
| `Saw.mp3` | `saw.mp3` | `startSaw()` | Workshop cutting loop |
| `Sell.mp3` | `sell.mp3` | `sell()` | Sale celebration |
| `tool hits the Rock.mp3` | `tool-hit.mp3` | `dig(true)` | Shovel striking an embedded rock directly |
| `reaveal inside the rock.mp3` | `reveal.mp3` | `reveal()` | Cutting-bench reveal of a rock worth $15 or more |
| `rock under 15 Dollar.mp3` | `rock-under-15.mp3` | `reveal()` | Cutting-bench reveal of a rock worth under $15 |
| `bg music.mp3` | `music.mp3` | (background) | Loops across the whole game, starts on the first gesture, quiet under the SFX |

Notes:

- A direct rock strike no longer also plays the synthesized metallic tick;
  `tool-hit.mp3` carries that moment on its own. Dirt swings keep `dig.mp3`.
- `reveal()` splits on the rock's value, not on the dud flag: anything
  worth under $15 gets `rock-under-15.mp3`, everything else gets the reveal
  piece. The old synthesized dud sting is retired. Tier still drives the
  visual celebration (flash, shake, rays, burst, confetti).
- The music loops everywhere (dig, workshop, end-of-day), fades in over
  about a second, pauses when the tab is hidden, and honours the mute button
  like everything else. `MUSIC_GAIN` in `Sfx.ts` sets how far under the SFX
  it sits.

## Processing

The copies here were trimmed and levelled once, from the originals:

- Leading/trailing silence below `-45 dB` removed, except `saw.mp3` which
  must loop unchanged.
- `reveal.mp3` and `music.mp3` were cut at hand-measured points so their
  internal musical pauses survive; `music.mp3` ends at about 38.95 s so the
  loop has no dead air.
- Peak normalised to `-1.5 dB`.
- 44.1 kHz stereo, 160 kbps MP3.

Loudness balance between cues lives in `SAMPLE_GAIN` in `Sfx.ts`, not in the
files. If a replacement sounds too quiet or loud next to the others, change
that table first.

## Replacing a file

Keep the project filename and drop the new audio in place. `Sfx.ts` imports
the files by name, so no code change is needed unless the cue mapping changes.
Then rebuild the game and copy the result to the website:

```bash
cd DigAndDiscover
npm run build
```

Copy `DigAndDiscover/dist/` over `public/arcade/dig-and-discover/` in the
website repository. The live site serves that build, not the source folder.
