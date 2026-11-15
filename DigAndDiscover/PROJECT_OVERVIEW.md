# Dig & Discover: Project Overview

## 1. The game in brief

**Dig & Discover** is a casual 2D incremental game for players aged 13 and up, playable in the browser on desktop or phone. It is inspired by videos of people digging up ordinary-looking rocks and sawing them open to see whether there are crystals inside.

### The story (kept in the background)
You play an ordinary father with a geology degree who never found the career he hoped for. He has a family, bills and taxes, so he turns what he knows into a living: a small, independent rock prospector with an old shovel, limited stamina and a patch of ground to explore. Every working day matters, because there is a family waiting at home. There are no cutscenes or dialogue. The story shows up as small touches: a little house on the horizon, a family photo and a warm one-line message at the end of each day. The tone stays grounded and light.

### The fantasy
You start at the top of an underground deposit and dig **down** through five geological layers. You uncover mystery rocks, take them to the workshop, cut them open on a saw and sell what you find. A rock's outside never reliably tells you what's inside. A dull grey cobble might hide an emerald, and a sparkly egg might be plain stone. That uncertainty is the hook.

This is a **prototype**: a small, polished foundation for later features such as upgrades, new tools, family expenses and new locations.

| | |
| --- | --- |
| Genre | Casual incremental / collection game |
| Platform | Web browser (desktop and mobile) |
| Engine | Phaser 3 (WebGL, with Canvas fallback) |
| Language | TypeScript |
| Build tool | Vite |
| Art | Generated in code at startup (no image files) |
| Audio | Synthesized with the Web Audio API (no sound files) |
| Run | Double-click `Play Dig and Discover.bat` |

---

## 2. Core gameplay loop

```
 ┌── start of day, 7:00 AM ─────────────────────────────────────────────┐
 │                                                                      │
 │   DIG down ──► find rocks ──► WORKSHOP ──► CUT & REVEAL ──► SELL    │
 │      ▲                                                     │         │
 │      └───────────────── repeat while the clock runs ◄──────┘         │
 │                                                                      │
 └── 5:00 PM: day ends ──► end-of-day summary ──► START NEXT DAY ───────┘
```

### The working day
- Every day runs from **7:00 AM to 5:00 PM**. The clock starts at 7:00 AM and runs while you work, in the dig site and in the workshop.
- The prototype day is short on purpose: one in-game hour is **24 real seconds**, so a day takes 4 minutes. This is one setting (`clock.secondsPerHour` in `GameConfig.ts`). For quick testing you can also add `?secondsPerHour=3` to the URL.
- The clock advances by real elapsed milliseconds, never by frame count, so it runs the same on slow and fast machines.
- At **5:00 PM** digging stops. Anything already in motion finishes cleanly (a swing completes, a rock that is popping out reaches your bag). **If rocks are still in your bag, you are taken to the workshop and must cut and sell every one of them before the day can end**: the button shows "N rocks left" and there is no way back to the dig site until the bag is empty. Rocks are never sold for you. Once the bag is empty, the **end-of-day summary** appears after a short pause.
- **START NEXT DAY** advances the day counter, resets the clock to 7:00 AM and refills stamina. Money, rocks in your bag and the excavation are all kept. The player never loses progress overnight.

### Phase A: Digging (top to bottom)
- The game opens straight onto the surface, with a small "Tap to dig!" hint. There is no menu.
- Click or tap to swing the shovel (hold to keep digging, or press `Space`). You can tap anywhere along the ground: a swing always bites into the exposed floor of the hole at that spot, so progress is always top-down.
- Each swing carves a visible crater, throws out debris and **lowers the floor**. Repeated swings in one place make a visible shaft, and the camera follows you down.
- **The camera never jumps because of a stray tap.** It only moves down to keep the hole on screen as you dig deeper. A tap on the wall or on ground that is out of view does nothing (no stamina spent) and shows "Aim at the floor of your hole!". Taps just beside the hole snap to its floor. You can look around with the **mouse wheel** (arrow keys and `PageUp`/`PageDown` also work, a finger drag scrolls on touch). A **"Back to the hole"** chip appears while the hole is off screen; click it (or press `Space`) to return.
- Deeper ground is harder (see layers below). A swing removes less depth, costs more stamina and feels heavier and slower. The starter shovel struggles in the deep layers by design.
- Whenever a swing turns up a rock, it appears half-buried in the floor of your shaft with a few progress dots. A few more swings near it free it and it pops into your bag.

### Stamina
- You are an ordinary man: a small tank, slow recovery. Max **100**, one swing costs **7** at the surface (more in harder layers). That is only 14 swings from a full tank.
- After you stop digging for 0.8 seconds, stamina refills at **7 per second**. Fully rested takes about 14 seconds.
- Starting stamina, regeneration, tank size and cost are all in `GameConfig.ts`, ready for future upgrades.
- The bar changes color as it drains, shimmers while refilling, and flashes with a "Too tired!" message when empty.
- Each new day starts rested. Exhaustion does not carry over.

### Phase B: Collecting
- The bag has **5 slots**. Uncut rocks show a `?` badge.
- The action button shows progress (`Find rocks 1/3`). It becomes a pulsing **Workshop** button once you have 3 uncut rocks, or when the bag is full.
- If the bag is full, a rock you freed waits in the ground and pops out after you sell something.

### Phase C: Cutting
- In the workshop, the first uncut rock flies onto the cutting machine. Tap any other rock in your bag to swap it in.
- Press **CUT IT OPEN!** The saw spins down through the rock. The rock wobbles, then splits into two halves that show the inside. The celebration grows with rarity:

| Rarity | Reveal effects |
| --- | --- |
| Common | Dust puff, small chime ("womp" sound for plain stone) |
| Uncommon | Colored sparkles, glitter |
| Rare | Screen flash, light rays, screen shake |
| Epic | Short dramatic pause, bigger rays and shake, low boom |
| Legendary | All of the above, plus confetti, a fanfare and a rainbow-tinted label |

### Phase D: Selling
- The info card shows the rarity badge, the mineral's name, a flavor line and a value that counts up.
- Press **SELL**: coins fly to the money counter, a `+$` label floats up and the counter rolls up smoothly.

### Phase E: End of day
- The summary card shows the day number, hours worked, rocks discovered today, rocks processed today, money earned today, total discoveries, and underground progress (depth in metres, current layer and a bar across all five layers). It also shows your savings, a small family photo and one short message that depends on how the day went.

### Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Dig | Click or tap (hold to repeat) | `Space` |
| Look around the shaft | Mouse wheel, or drag a finger | `Up` / `Down`, `PageUp` / `PageDown` |
| Back to the hole | "Back to the hole" chip | `Space` |
| Go to the workshop | Workshop button | `Enter` |
| Choose a rock | Tap a bag slot | `1`–`5` |
| Cut / Sell | Card button | `Space` |
| Back to digging | Back to Dig button | `Esc` |
| Start the next day | START NEXT DAY button | `Enter` or `Space` |
| Mute | Speaker button | `M` |

---

## 3. The underground: layers, depth and the old shovel

The deposit is a side view cross-section, about **31 metres** deep (80 field units = 1 m). Layers are plain data in `src/data/layers.ts`: add, remove, reorder or rebalance them and everything adapts (digging, terrain painting, depth gauge, labels, discovery odds).

| # | Layer | Hardness | Efficiency* | Swings to cross* | Stamina per swing | Look and feel |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Surface Soil | 1.4 | 71% | ~12 | 7.0 | Warm light-brown soil, roots and small pale pebbles, soft crumbly debris |
| 2 | Compact Soil | 3.2 | 31% | ~36 | 8.0 | Redder clay with pale clay streaks and round pebbles, chunkier dirt |
| 3 | Hard Earth | 5.5 | 18% | ~69 | 9.5 | Grey-tan dry earth with dark cracks and chipped slabs, the shovel clanks |
| 4 | Rocky Soil | 8 | 13% | ~104 | 11.2 | Dark umber with large embedded angular boulders and gravel, sparks fly |
| 5 | Deep Mineral Deposit | 12 | 10% | ~140 | 14.0 | Deep blue-purple rock with glowing cyan and violet crystal veins, crystal sparks |

\* With the starter shovel. Efficiency = tool power ÷ layer hardness (never below the tool's minimum). Swing cooldown also grows in harder ground (520 ms in surface soil, about 780 ms in the deepest layer).

Beyond the last layer lies bedrock that cannot be dug (for now). The whole deposit takes the starter shovel roughly 360 swings to cross, so reaching the bottom takes several working days.

**The old shovel** is the only tool and is defined as data in `src/data/tools.ts` (power, depth per swing, crater size, swing speed, stamina multiplier). It is rusty, slow and basic, but fully functional. Adding a tool later is just another entry. Buying tools is not implemented yet.

**Discovery odds** are also per layer (`discovery` in `layers.ts`). Each swing has a base chance to turn up a rock (about 9–12%) with a mild "pity" ramp that makes a long dry spell more likely to end. Nothing is guaranteed, so every swing is a small gamble. Rarity weights shift with depth, but deeper never means automatically valuable:

| Layer | Common | Uncommon | Rare | Epic | Legendary |
| --- | --- | --- | --- | --- | --- |
| Surface Soil | 78 | 17 | 4.5 | 0.5 | 0 |
| Compact Soil | 62 | 25 | 10 | 2.5 | 0.5 |
| Hard Earth | 50 | 27 | 15 | 6 | 2 |
| Rocky Soil | 40 | 27 | 20 | 9 | 4 |
| Deep Mineral Deposit | 28 | 26 | 24 | 15 | 7 |

### How the terrain works (efficiently)
- The ground is **one big texture** (a `RenderTexture`), not thousands of objects. Each swing erases an ellipse from it, revealing a darker copy of the same strata behind it (the wall of the shaft).
- The logical state is a **heightmap**: one floor height per 10-unit column (`ExcavationSystem`). A swing lowers the columns under the carved ellipse. The scene paints the very same ellipse, so what you see and what the game counts always match.
- The camera keeps one number, the field height it wants on its focus line. Digging below that line pulls it down; scrolling moves it freely; nothing else changes it. It eases toward that height and snaps to whole pixels so the terrain never shimmers.
- A swing is only accepted on ground that is on screen (`aim()` in `DigScene.ts`), so what you see is always what gets dug.
- The sky warms through the day: dawn tint in the morning, clear midday, golden late afternoon, with the sun moving across.

---

## 4. Content (data-driven)

All content is plain data in `src/data/`. To add new content, add an entry; no code changes are needed.

**Interiors (minerals)**, with fictional sale values:

| Rarity | Minerals | Value range |
| --- | --- | --- |
| Common | Ordinary Stone (dud), Quartz Cluster, Honey Calcite | $3 – $16 |
| Uncommon | Banded Agate, Amethyst Geode, Citrine Geode | $26 – $56 |
| Rare | Garnet, Fire Opal, Aquamarine | $95 – $175 |
| Epic | Emerald, Ruby, Sapphire | $310 – $470 |
| Legendary | Starfire Geode, Prismatic Heartstone, Nebula Celestine | $1,300 – $2,400 |

Larger rocks get a value bonus of up to about +15% (smaller rocks lose up to about 15%).

**Exteriors:** Dusty Nodule, Grey Cobble, Rusty Lump, Dark Basalt, Speckled Egg. Each rock's exterior is picked independently of what's inside.

**Interior art styles:** `plain`, `cluster`, `banded`, `geode`, `gem`, `opal`, `prism`. Each one has its own painter function.

---

## 5. Architecture

```
            ┌───────────────────────────────────────────────────┐
            │  GameState (singleton)                            │
            │  stamina · inventory · economy · excavation       │
            │  discovery · day cycle + clock · tool · stats     │
            │  event bus                                        │
            └──────────┬────────────────────────────────────────┘
          events ▲     │ reads / calls
   ┌───────────────┬───┼────────────────────┬─────────────────────┐
   │               │   ▼                    │                     │
 DigScene     WorkshopScene          HudScene (on top)     EndOfDayScene (overlay)
 (strata,     (bench, saw,           (money, day + clock,  (summary card,
  shaft,       reveal, sell)          depth gauge, tool,    family photo,
  rocks)                              stamina, bag, buttons) START NEXT DAY)
```

- **Systems** (`src/systems`) are pure logic with no Phaser rendering, so they are easy to test and extend.
- **Scenes** handle rendering and input. They talk to each other only through the `GameState` event bus.
- **Data** (`src/data`) and **config** (`src/config`) hold every tunable value and every piece of content.
- **Art** (`src/art`) paints every texture once with the Canvas 2D API.

---

## 6. Scripts and what each one does

### Root files
| File | Purpose |
| --- | --- |
| `Play Dig and Discover.bat` | One click: checks for Node.js, installs dependencies on the first run, builds the game, then starts a local server and opens the browser. |
| `index.html` | Page shell: viewport and touch settings, full-screen game container, loading text. |
| `package.json` | Dependencies (Phaser, the Fredoka font, TypeScript, Vite) and the `dev` / `build` / `preview` scripts. |
| `vite.config.ts` | Build settings: relative paths, dev and preview ports, Phaser split into its own bundle file. |
| `tsconfig.json` | Strict TypeScript settings. |
| `README.md` | Setup and run instructions. |

### `src/main.ts`
Entry point. Waits for the Fredoka font and for the window to have a real size, then creates the Phaser game: WebGL with automatic Canvas fallback, resize-to-fit mode, 2 touch pointers, and the scene order Boot → Dig → Workshop → HUD → End of Day. On the dev server only, it also exposes `window.__dd` (game and state) for debugging; this is removed from production builds.

### `src/config/`
| File | Purpose |
| --- | --- |
| `GameConfig.ts` | **Global gameplay numbers**: stamina, the working-day clock, closing-time timings, dig reach, bag size, the excavation world (width, surface line, bedrock, metres, camera), rock sizes, cut duration, starting money. |
| `Theme.ts` | Font family, color palette, button color sets, and helpers for building text styles (sharp text on high-DPI screens). |

### `src/data/`
| File | Purpose |
| --- | --- |
| `layers.ts` | The geological layers: thickness, hardness, stamina multiplier, look (colors, stones, detail), dig feel (debris tints, clang, shake, sparks) and discovery odds (chance, rarity weights, hits to free a rock). |
| `tools.ts` | Tool definitions. Holds the **Old Shovel**: power, depth per swing, crater size, swing and plunge time, stamina multiplier. |
| `dayMessages.ts` | The short, warm end-of-day lines and the rule that picks one from how much you earned. |
| `rarities.ts` | The 5 rarity tiers: weight, tier number, display colors, chance of a glittery exterior. |
| `minerals.ts` | Everything that can be inside a rock: rarity, weight, art style, colors, value range, flavor text, dud and glow flags. |
| `exteriors.ts` | Outside looks: colors, how lumpy, how flattened. |

### `src/core/`
| File | Purpose |
| --- | --- |
| `GameState.ts` | Shared state holding the stamina, inventory, economy, excavation, discovery and day-cycle systems, the equipped tool, stats, current mode, workshop-busy flag, an activity counter, and the **event bus**. `EVT` lists every event name. `tick()` advances time-based systems each frame and opens the summary at closing time. `startNextDay()` resets the clock and stamina. `subscribe()` registers a scene listener that is removed automatically when the scene shuts down. |
| `Random.ts` | Seeded random generator (mulberry32) plus helpers: random range, random integer, random pick, weighted pick. |
| `types.ts` | The `Rock` type (id, seed, exterior, hidden mineral, rarity, size, value, sparkly, cut) and `GameMode`. |

### `src/systems/` (pure logic)
| File | Purpose |
| --- | --- |
| `ClockSystem.ts` | The 7 AM – 5 PM clock. Advances by real milliseconds, gives progress 0–1, the "7:05 AM" label (rounded to 5 minutes) and hours worked. |
| `DayCycleSystem.ts` | Day counter, the `working → closing → summary` phase machine, today's tallies (found, processed, earned), and the `DaySummary` type. |
| `ExcavationSystem.ts` | The heightmap excavation. `dig()` applies one swing (efficiency from tool power and layer hardness) and returns the carved ellipse. Also depth in metres, current layer, bedrock limit and layer-entered events. |
| `DiscoverySystem.ts` | Per-swing chance to turn up a rock, with the mild pity ramp. |
| `RockGenerator.ts` | `generateRock()`: rolls rarity by weight (optionally the layer's weights), then a mineral of that rarity, then an independent exterior, a size, a value with size bonus, and the sparkle chance. `sizeLabel()` turns a size into Small, Medium or Large. |
| `StaminaSystem.ts` | Spending stamina (with a cost multiplier), the rest delay, regeneration, and `reset()` for a new day. |
| `InventorySystem.ts` | Fixed-slot bag: add, remove, `markCut`, `firstUncut`, counts, `isFull`. Rocks keep their slot until sold. |
| `EconomySystem.ts` | Money balance, total earned, `sell(rock)`. |

### `src/art/` (procedural graphics)
| File | Purpose |
| --- | --- |
| `paint.ts` | Canvas helpers: color math, smooth blob outlines, ellipses, stars, rounded rectangles, polygons, and `makeCanvasTexture()`. |
| `TextureFactory.ts` | Paints every shared texture at startup: crater holes and rims, particles, ring, shadow, coin, light ray, cloud, sky gradient, the **rusty old shovel**, saw blade, cutting machine. |
| `StrataArt.ts` | Paints the whole underground cross-section once: five layers with wavy boundaries, grain, embedded stones and layer-specific details (roots, clay streaks, cracks, boulders, glowing crystal veins), the grass line and bedrock. |
| `SurfaceArt.ts` | The little family home with a chimney, tree and mailbox on the horizon. |
| `FamilyPhoto.ts` | The framed family photo on the end-of-day card. |
| `RockArt.ts` | Per-rock textures: the outside and the cut cross-section. Textures are freed after the rock is sold. |
| `InteriorArt.ts` | One painter per interior style: crystal clusters, banded agate, geodes, faceted gems, opal, prism. |

### `src/audio/Sfx.ts`
Sound effects synthesized with the Web Audio API: dig thud (duller and with a metallic tick in harder ground), tired, discover, collect, place, click, saw motor and grinding loop, rarity-scaled reveal chimes, sell chime, coin ticks, plus the new day sounds (time's up bell, new day chime, end-of-day jingle, entering a new layer). Audio starts on the first tap or key press, pauses while the tab is hidden, and stays silent if unavailable. Mute is remembered in `localStorage`.

### `src/ui/`
| File | Purpose |
| --- | --- |
| `layout.ts` | `computeLayout()` works out the screen layout for any size, including the tool chip and depth gauge areas. Phones get a stacked layout; wide screens put the button beside the bag. |
| `ClockPill.ts` | Top-bar widget: sun icon, "DAY 3", the clock time and a thin bar for how much of the day has passed. Pulses calmly near closing time. |
| `DepthGauge.ts` | Slim vertical gauge on the right: layer-colored segments, a marker for where you are digging, a line for your deepest point and the layer name. |
| `ToolChip.ts` | Small chip in the tray showing the equipped tool's icon and name. |
| `Button.ts` | Chunky rounded button with a 3D edge, press squash, disabled state, optional pulse, and keyboard `trigger()`. |
| `InventorySlot.ts` | One bag slot: rock icon, `?` badge, rarity border and label once cut, "ON BENCH" state. |
| `StaminaBar.ts` | Lightning-bolt badge plus the bar. Redraws only when the value changes. |
| `MoneyCounter.ts` | Money display with a coin icon, a smooth count-up animation and `formatMoney()`. |
| `Toast.ts` | Single reusable pop-up message bubble. |

### `src/scenes/`
| File | Purpose |
| --- | --- |
| `BootScene.ts` | Paints the shared textures, starts the dig scene and the HUD. |
| `DigScene.ts` | The excavation site. Builds the sky, sun, clouds, hills, the home, the strata terrain and the shaft. Handles input, swings (timing runs on the scene clock), craters and layer-specific debris, discovery rolls and embedded rocks, the pop-out animation, the camera (follows you down, scrolls with wheel, keys and touch drag, "Back to the hole" chip), depth labels and the time-of-day sky. Refuses new swings after 5:00 PM. |
| `WorkshopScene.ts` | Workbench, cutting machine, saw blade and info card. Runs the bench steps (empty, placing, ready, cutting, revealed, selling). After closing time cutting stays open and the player must cut and sell every rock left in the bag; the card counts them down. |
| `HudScene.ts` | Always-on-top overlay: money, day and clock, stats pill, mute, depth gauge, tool, stamina, bag and action button. Runs the game clock each frame, shows the "Time's up!" banner and "Entering: …" layer banners, **walks the player to the workshop at closing time when rocks are left**, opens the end-of-day screen, and **switches between the dig site and the workshop** with a fade. |
| `EndOfDayScene.ts` | The summary overlay: stats count up, depth bar, family photo, a warm message and the START NEXT DAY button. Scales to fit any screen. |

---

## 7. Performance and quality notes
- WebGL is used first, with automatic Canvas fallback. The target is 60 FPS.
- All terrain is a single texture plus a small heightmap. Digging never creates per-dirt objects. Textures are painted once; particle emitters and effect sprites are created once and reused.
- Per-frame work is minimal: the clock, stamina and depth gauge only redraw when their displayed value changes, and the frame time is capped. The game loop and audio pause in background tabs, so the clock does not run while the tab is hidden.
- Event listeners are removed when scenes shut down, and rock textures are freed after sale, to prevent memory leaks.
- The layout adapts to any screen size and orientation. Phones get larger touch targets and a stacked layout.

---

## 8. Deliberately out of scope (for later)
Upgrade shop, equipment purchasing, skill trees, family expense, rent and tax payments, debt, multiple mining locations, equipment durability, complex geology simulation, quests, customers, multiplayer, saving to disk, monetization and advertisements. The structure (data-driven layers and tools, separate systems, central config) is set up so these can be added without rewriting the foundation.
