# Dig & Discover

A 2D rock-mining and crystal-discovery web game prototype. You play an ordinary father with a geology degree who makes a living as a small independent prospector: dig down through the ground, cut rocks open at the workshop and sell what you find. Every working day runs from 7:00 AM to 5:00 PM.

Built with **Phaser 3** (WebGL with an automatic Canvas fallback), **TypeScript** and **Vite**. All artwork and sound effects are generated in code, so the game downloads no images or audio.

For a full tour of the game and every script, see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

---

## Quick start (Windows)

Double-click **`Play Dig and Discover.bat`**. It:

1. Checks that Node.js is installed.
2. Installs dependencies (first run only).
3. Builds the production bundle into `dist/`.
4. Starts a local server and opens the game in your browser (default `http://localhost:4173`).

Keep the window open while you play. Close it to stop the server.

## Manual commands

You need Node.js 18 or newer.

```bash
npm install          # install dependencies
npm run dev          # dev server with hot reload at http://localhost:5173
npm run build        # type-check and build for production into dist/
npm run preview      # serve the production build at http://localhost:4173
```

`dist/` is a static site. You can host it anywhere; it uses relative paths.

**Shorter days for testing:** add `?secondsPerHour=3` to the URL (for example `http://localhost:5173/?secondsPerHour=3`) to make one in-game hour last 3 real seconds. The default is 24 seconds (a 4-minute working day).

## How to play

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Dig | Click or tap the ground (hold to keep digging) | `Space` |
| Look around | Mouse wheel (drag a finger on touch) | `Up` / `Down`, `PageUp` / `PageDown` |
| Back to the hole | "Back to the hole" chip | `Space` |
| Go to the workshop | **Workshop** button (unlocks at 3 rocks) | `Enter` |
| Put a rock on the bench | Tap a rock in your bag | `1`–`5` |
| Cut / Sell | Buttons on the card | `Space` |
| Back to digging | **Back to Dig** button | `Esc` |
| Start the next day | **START NEXT DAY** button | `Enter` / `Space` |
| Mute | Speaker button | `M` |

**The day.** The clock starts at 7:00 AM and the working day ends at 5:00 PM. At closing time digging stops, and any rocks still in your bag must be cut and sold in the workshop before the day can end. Then an end-of-day summary appears. **START NEXT DAY** resets the clock and refills stamina. Your money, rocks and the shaft you dug are all kept.

**The dig.** You start at the top of a deep deposit and dig downward through five layers: Surface Soil, Compact Soil, Hard Earth, Rocky Soil and the Deep Mineral Deposit. The deeper you go, the harder the ground: your old shovel removes less depth per swing and each swing costs more stamina. Rocks turn up at random, with better odds of rare finds deeper down, but never a guarantee.

## Project structure

```
DigAndDiscover/
├─ Play Dig and Discover.bat   one-click build and run
├─ index.html                  page shell
├─ vite.config.ts / tsconfig.json / package.json
└─ src/
   ├─ main.ts                  Phaser game config (WebGL/Canvas, resize mode, scene list)
   ├─ config/
   │  ├─ GameConfig.ts         global tuning (stamina, clock, world size, rocks, ...)
   │  └─ Theme.ts              fonts, palette, button colors, text styles
   ├─ data/                    data-driven content
   │  ├─ layers.ts             geological layers: hardness, look, feel, discovery odds
   │  ├─ tools.ts              digging tools (the Old Shovel)
   │  ├─ dayMessages.ts        end-of-day lines
   │  ├─ rarities.ts           rarity tiers, weights (60/25/10/4/1), colors
   │  ├─ minerals.ts           what can be inside a rock: style, palette, value range
   │  └─ exteriors.ts          outside looks (deliberately unrelated to the inside)
   ├─ core/
   │  ├─ GameState.ts          shared state, event bus and event names
   │  ├─ Random.ts             seeded PRNG and weighted picking
   │  └─ types.ts
   ├─ systems/                 pure gameplay logic, no rendering
   │  ├─ ClockSystem.ts        the 7 AM to 5 PM working-day clock
   │  ├─ DayCycleSystem.ts     day counter, working/closing/summary phases, daily tallies
   │  ├─ ExcavationSystem.ts   heightmap excavation, hardness and depth
   │  ├─ DiscoverySystem.ts    chance that a swing finds a rock
   │  ├─ RockGenerator.ts      weighted rarity, then mineral, exterior, size, value
   │  ├─ StaminaSystem.ts      spend, rest delay, regeneration, daily reset
   │  ├─ InventorySystem.ts    fixed 5-slot bag
   │  └─ EconomySystem.ts      money and selling
   ├─ art/                     procedural canvas artwork
   │  ├─ TextureFactory.ts     shared textures (old shovel, saw, machine, particles, ...)
   │  ├─ StrataArt.ts          the underground layers
   │  ├─ SurfaceArt.ts         the family home on the horizon
   │  ├─ FamilyPhoto.ts        the family photo on the end-of-day card
   │  ├─ RockArt.ts            per-rock outside and cross-section textures
   │  ├─ InteriorArt.ts        one painter per interior style (geode, gem, opal, ...)
   │  └─ paint.ts              color and shape helpers
   ├─ audio/Sfx.ts             synthesized Web Audio effects with persistent mute
   ├─ ui/                      HUD widgets and the shared responsive layout
   └─ scenes/
      ├─ BootScene.ts          paints textures, starts the game
      ├─ DigScene.ts           the excavation: strata terrain, shaft, rocks, camera
      ├─ WorkshopScene.ts      bench, saw, reveal celebration, selling
      ├─ HudScene.ts           money, day and clock, depth gauge, tool, stamina, bag, scene switching
      └─ EndOfDayScene.ts      end-of-day summary and START NEXT DAY
```

## Main gameplay systems

- **Working day.** `ClockSystem` runs the 7:00 AM to 5:00 PM clock from real elapsed time (never frame count). `DayCycleSystem` moves through `working`, `closing` and `summary`. In `closing`, new swings are refused, running animations finish, and the player is sent to the workshop to cut and sell every rock left in the bag; the summary opens only once the bag is empty. Money, rocks and excavation are never reset.
- **Excavation.** The ground is one `RenderTexture` that each swing erases an ellipse from, with a darker copy of the same strata behind it. The logical depth is a small heightmap in `ExcavationSystem`; both are updated from the same carved ellipse. Swings always bite into the exposed floor, so progress is strictly top-down. The camera follows the shaft down but never jumps because of a stray tap; scroll with the mouse wheel to look around.
- **Layers and hardness.** Each layer in `data/layers.ts` has hardness, a stamina multiplier, its own colors, stones and details, its own debris and sounds, and its own discovery odds. A swing's efficiency is the tool's power divided by the layer's hardness.
- **Stamina.** A small tank with slow recovery. Each swing costs stamina (more in harder layers). After a short rest it regenerates, and it is fully restored each morning.
- **Old shovel.** `data/tools.ts` defines the starter tool as data (power, depth per swing, crater size, swing speed). More tools can be added without touching the dig code; buying them is not implemented yet.
- **Rocks.** A swing may turn up a rock (chance and rarity weights depend on the layer). It sits half-buried in the floor of the shaft until you free it with a few more swings. `RockGenerator` rolls the rarity first, then a mineral, then an independent exterior, so a glittery outside is only a weak hint.
- **Inventory, workshop and selling.** Unchanged: a 5-slot bag, a cutting machine with a rarity-scaled reveal, and coins flying into a money counter.

## Tuning

Start in `src/config/GameConfig.ts` for stamina, the clock and the world, `src/data/layers.ts` for hardness, looks and discovery odds per layer, and `src/data/tools.ts` for the shovel. To add a mineral, add an entry to `minerals.ts`. To add a new kind of interior look, add a painter to `art/InteriorArt.ts`.

## Performance notes

- All terrain is one texture and a small heightmap. Digging never creates per-dirt objects.
- Every texture is painted once (rocks when they find). Rock textures are freed after the rock is sold.
- Particle emitters and effect sprites are created once and reused.
- Per-frame work is minimal. The clock, stamina bar and depth gauge only redraw when their displayed value changes.
- Long frames are clamped. The game loop pauses on its own in background tabs, and audio is suspended while the tab is hidden.
- The layout is recomputed on resize. Phones get a stacked layout with larger touch targets.
