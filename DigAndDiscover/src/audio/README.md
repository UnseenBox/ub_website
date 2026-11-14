# Sound effects

Ten cues play MP3 samples from this folder. Five cues are still synthesized
in `Sfx.ts`: `timesUp`, `newDay`, `dayEnd`, `place`, and the tier fanfares in
`reveal`.

| Source file | Project file | Cue | Plays when |
| --- | --- | --- | --- |
| `Dig.mp3` | `dig.mp3` | `dig()` | Every shovel impact |
| `click.mp3` | `click.mp3` | `click()` | UI buttons and keyboard shortcuts |
| `coin.mp3` | `coin.mp3` | `coin()` | Coins flying into the money counter |
| `denied.mp3` | `denied.mp3` | `denied()` | Disabled button, or digging at nothing |
| `exhausted.mp3` | `exhausted.mp3` | `tired()` | A swing refused because stamina is empty |
| `layer enter.mp3` | `layer-enter.mp3` | `layerEnter()` | Entering a new soil/stone layer |
| `money collect.mp3` | `money-collect.mp3` | `collect()` | Rock first appears in the dirt, and again when it lands in the bag |
| `Rock found.mp3` | `rock-found.mp3` | `discover()` | Buried rock popping free |
| `Saw.mp3` | `saw.mp3` | `startSaw()` | Workshop cutting loop |
| `Sell.mp3` | `sell.mp3` | `sell()` | Sale celebration |

## Processing

The copies here were trimmed and levelled once, from the originals:

- Leading and trailing silence below `-45 dB` removed (except `saw.mp3`,
  which must loop).
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
