# Dig & Discover

A 2D rock-mining and crystal-discovery web game. You play an ordinary father with a geology degree who makes a living as a small independent prospector: dig down through ten layers of ground, cut rocks open at the workshop and sell what you find. Rocks are the business, and the family has bills and a debt to the bank to pay. Now and then you also dig up a find (a valuable artifact to sell, a collectible for your album, or plain junk). Spend your earnings in the store, finish goals to level up and, when you reach bedrock, move on to a richer and tougher deposit. Every working day runs from 7:00 AM to 5:00 PM, and every month you must clear the debt that fell due or the run ends.

Built with **Phaser 3** (WebGL with an automatic Canvas fallback), **TypeScript** and **Vite**. Almost all artwork is painted in code at startup. The game also uses a set of supplied MP3 sound effects and background music, one coin image and the **Rye** font.

For a full tour of the game and every script, see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md). Section 9 there has the current status, what is verified and what is next, and section 10 lists everything the friend added on top of our first version.

This is the **friend's version, imported on 2026-11-15, and it is now the main project**. Our earlier version is saved as `DigAndDiscover_BACKUP_pre-friend-version_2026-11-15` next to this folder.

The game is kept in the website repo: [UnseenBox/ub_website](https://github.com/UnseenBox/ub_website), folder `DigAndDiscover/`. The website plays the built copy in `public/arcade/dig-and-discover/`.

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
npm install              # install dependencies
npm run dev              # dev server with hot reload at http://localhost:5173 (test ads enabled)
npm run build            # type-check and build for production into dist/
npm run build:crazygames # same, for the CrazyGames portal (real ads) into dist-crazygames/
npm run preview          # serve the production build at http://localhost:4173
npm run typecheck        # TypeScript check only
```

`dist/` is a static site. You can host it anywhere; it uses relative paths.

**URL options:** `?secondsPerHour=3` makes one in-game hour last 3 real seconds (default 24, a 4-minute day). `?reset` clears the saved progress. `?mockads` shows fake 3-second test ads in any build.

**Backups:** `backups/2026-11-15_friend-version-before-rockfirst-update/` (in the website repo copy of this folder) holds the build that was live before the rock-first update, with its own README on how to restore it.

**Publishing to the website:** run `npm run build`, then copy `dist/` over `public/arcade/dig-and-discover/` in the website repository (keep its `poster.jpg`). The site serves that build, not this source folder.

## How to play

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Dig | Click (hold to keep digging). On a phone: quick tap, or a steady press | `Space` (digs at the cursor) |
| Look around | Mouse wheel (drag a finger on touch) | `Up` / `Down`, `PageUp` / `PageDown` |
| Back to the hole | "Back to the hole" chip | `Space` |
| Go to the workshop | **Workshop** button (works from your first rock; pulses at 3 rocks) | `Enter` |
| Put a rock on the bench | Tap a rock in your bag | `1`-`5` |
| Cut / Sell | Buttons on the card | `Space` |
| Back to digging | **Back to Dig** button | `Esc` |
| Store | Store button | `S` |
| Goals | Goal pill under the top bar | `G` |
| Finds (collection, artifacts to sell, junk) | Album button | `C` |
| Debt ledger | Ledger chip under the top bar | `L` |
| Start the next day | **START NEXT DAY** button | `Enter` / `Space` |
| Mute | Speaker button | `M` |

**The day.** The clock starts at 7:00 AM and the working day ends at 5:00 PM. At closing time digging stops, and any rocks still in your bag must be cut and sold in the workshop before the day can end. Then an end-of-day summary appears. **START NEXT DAY** resets the clock and refills stamina. Money, tools, upgrades and level are kept and saved.

**The dig.** You start at the top of a deep deposit and dig downward through ten layers: Surface Soil, Compact Soil, Hard Earth, Rocky Soil, Deep Mineral Deposit, Fossil Bed, Buried Ruins, Frozen Cavern, Magma Veins and Heart of the Earth. The deeper you go, the harder the ground, the more stamina a swing costs and the more your finds are worth. Rocks turn up at random, with better odds of rare finds deeper down, but never a guarantee. The shovel follows your mouse.

**Finds.** Now and then (never on the same swing as a rock) a swing unearths a buried object, shown as a dark silhouette with a "?" until you dig it free. There are 71: **artifacts** (old coins, helmets, relics; they have a condition and a price, they wait in the Finds screen and pay only when you sell them there), **collection items** (toys and oddities for your album, they never pay) and **junk** (counted, never paid). Nothing a find does gives money on the spot; rocks stay the business.

**The household and the debt.** At the end of each day the household bills (food, water, electricity, other) come out of your money; what you cannot pay is carried to the next day and shown in red. You also owe the bank $250,000, and an instalment falls due every 7 days. Open the **debt ledger** (`L` or the chip under the top bar) to pay. A month is 30 days: if debt is still overdue when you start day 31, it is **Game Over** and you must press **Restart**, which resets the whole run (only the sound setting is kept). Clear it and the next month starts with a bigger schedule.

**The store.** Spend money on better tools (they unlock by level and must be strong enough for the layer you are in), scanners that help you find rocks, and upgrades for stamina and digging. **Goals** (three at a time) and **XP** raise your prospector level.

**Bedrock.** Dig out the last layer and you can relocate to a new deposit: the ground starts over, harder and richer, and everything you own comes along.

## Project structure

```
DigAndDiscover/
├─ Play Dig and Discover.bat   one-click build and run
├─ index.html                  page shell
├─ vite.config.ts / postcss.config.mjs / tsconfig.json / package.json
└─ src/
   ├─ main.ts                  Phaser game config (WebGL/Canvas, resize mode, scene list, ad SDK start)
   ├─ ads/Portal.ts            CrazyGames SDK wrapper (rewarded and midgame ads, test ads in dev)
   ├─ config/
   │  ├─ GameConfig.ts         global tuning (stamina, clock, world size, rocks, ...)
   │  └─ Theme.ts              the Rye font, palette, button colors, text styles
   ├─ data/                    data-driven content
   │  ├─ layers.ts             the ten layers: hardness, look, feel, discovery odds, value multiplier
   │  ├─ tools.ts              digging tools, scanners and upgrade effects
   │  ├─ store.ts              the store catalogue: prices, levels, icons
   │  ├─ goals.ts              goal types, onboarding and rewards
   │  ├─ finds.ts              the 71 finds (artifacts, collection, junk), conditions, chances, XP
   │  ├─ economy.ts            household bills, debt, instalments, the 30-day month
   │  ├─ deposits.ts           deposit names, tints and the multipliers per deposit
   │  ├─ dayMessages.ts        end-of-day lines
   │  ├─ rarities.ts           six rarity tiers (incl. Worthless), colors
   │  ├─ minerals.ts           the 43 minerals: style, palette, value range, depth gating
   │  └─ exteriors.ts          outside looks (deliberately unrelated to the inside)
   ├─ core/
   │  ├─ GameState.ts          shared state, store purchases, event bus and event names
   │  ├─ Random.ts             seeded PRNG and weighted picking
   │  └─ types.ts
   ├─ systems/                 pure gameplay logic, no rendering
   │  ├─ ClockSystem.ts        the 7 AM to 5 PM working-day clock
   │  ├─ DayCycleSystem.ts     day counter, working/closing/summary phases, daily tallies
   │  ├─ ExcavationSystem.ts   heightmap excavation, hardness, depth, bedrock, reset
   │  ├─ DiscoverySystem.ts    chance that a swing finds a rock (scanner bonus)
   │  ├─ FindSystem.ts         chance and pick of a find, items, the finds inventory
   │  ├─ FinanceSystem.ts      household bills, debt instalments, the month deadline (pure logic)
   │  ├─ ProgressSystem.ts     level, XP, goals, owned tools, upgrades, save and load
   │  ├─ RockGenerator.ts      weighted rarity, then mineral, exterior, size, value
   │  ├─ StaminaSystem.ts      spend, rest delay, regeneration, upgrades, daily reset
   │  ├─ InventorySystem.ts    fixed 5-slot bag
   │  └─ EconomySystem.ts      money, rewards and selling
   ├─ art/                     procedural canvas artwork
   │  ├─ TextureFactory.ts     shared textures (shovel, saw, machine, particles, ...)
   │  ├─ StrataArt.ts          the ten underground layers
   │  ├─ ScenicArt.ts          the illustrated sky, ridges and soil texture
   │  ├─ SurfaceArt.ts         cottage, tree, woodpile, signpost and mine head-frame
   │  ├─ IconArt.ts            star and saw-blade icons
   │  ├─ StoreArt.ts           store icons (PNG override in assets/store)
   │  ├─ FindArt.ts            painted pictures of the 71 finds
   │  ├─ UiIcons.ts            the 41 painted UI icons (uiIcon('cash'))
   │  ├─ FamilyPhoto.ts        the family photo on the end-of-day card
   │  ├─ RockArt.ts            per-rock outside and cross-section textures
   │  ├─ InteriorArt.ts        one painter per interior style (geode, gem, opal, ...)
   │  └─ paint.ts              color and shape helpers
   ├─ audio/
   │  ├─ Sfx.ts                sample playback and synthesized cues, music, persistent mute
   │  ├─ samples/*.mp3         14 supplied sound files and the background music
   │  └─ README.md             which sample plays when, and how to replace one
   ├─ assets/                  ui/coin.png, plus drop-in PNG overrides for store icons
   ├─ ui/                      HUD widgets and the shared responsive layout
   └─ scenes/
      ├─ BootScene.ts          paints textures, starts the game
      ├─ DigScene.ts           the excavation: terrain, shaft, rocks, finds, camera, shovel, input
      ├─ WorkshopScene.ts      bench, saw, reveal celebration, selling
      ├─ HudScene.ts           money, goals, depth gauge, stamina, bag, scene switching, ads
      ├─ EndOfDayScene.ts      end-of-day summary and START NEXT DAY
      ├─ StoreScene.ts         tools and upgrades store
      ├─ GoalsScene.ts         level, XP and the three goals
      ├─ CollectionScene.ts    the Finds screen (collection, artifacts to sell, junk)
      ├─ LedgerScene.ts        the debt card and payments
      ├─ GameOverScene.ts      reason and the Restart button
      └─ RelocateScene.ts      the bedrock card that offers a new deposit
```

## Main gameplay systems

- **Working day.** `ClockSystem` runs the 7:00 AM to 5:00 PM clock from real elapsed time (never frame count). `DayCycleSystem` moves through `working`, `closing` and `summary`. In `closing`, new swings are refused, running animations finish, and the player is sent to the workshop to cut and sell every rock left in the bag; the summary opens only once the bag is empty.
- **Excavation.** The ground is one `RenderTexture` that each swing erases an ellipse from, with a darker copy of the same strata behind it. The logical depth is a small heightmap in `ExcavationSystem`; both are updated from the same carved ellipse. Swings always bite into the exposed floor, so progress is strictly top-down. The camera follows the shaft down but never jumps because of a stray tap; scroll with the mouse wheel to look around.
- **Layers and hardness.** Each layer in `data/layers.ts` has hardness, a stamina multiplier, a value multiplier, its own colors, stones and details, its own debris and sounds, and its own discovery odds. A swing's efficiency is `(tool power / layer hardness) ^ 1.4`, so a tool too weak for the layer digs very little.
- **Tools, store and upgrades.** `data/tools.ts` and `data/store.ts` define nine digging tools, two scanners and six upgrades (one endless). `GameState.buyTool()` and `buyUpgrade()` apply them. The strongest owned tool is always the one in hand.
- **Progression.** `ProgressSystem` tracks prospector level and XP (cuts, new layers, goals, finds), the three goals and the save file (`localStorage`).
- **Finances.** `FinanceSystem` (numbers in `data/economy.ts`) settles the household bill when the day summary opens, issues a debt instalment every 7 days and checks the month on day 30; `GameState` wires it to the end-of-day card, the ledger, Game Over and `resetRun()`.
- **Rocks and finds.** A swing may turn up a rock (chance and rarity weights depend on the layer) or, on a swing without a rock, a find (`FindSystem`). A rock sits half-buried until you free it with a few more swings. `RockGenerator` rolls the rarity first, then a mineral, then an independent exterior, so a glittery outside is only a weak hint.
- **Deposits.** At bedrock the player can relocate: harder (+40% per deposit), richer (+50%), stronger tools (+4%), a cash bonus, and everything owned comes along.
- **Ads.** Rewarded and midgame ads exist only in the CrazyGames build or when testing (`npm run dev` or `?mockads`).
- **Inventory, workshop and selling.** A 5-slot bag, a cutting machine with a rarity-scaled reveal, and coins flying into a money counter.

## Tuning

Start in `src/config/GameConfig.ts` for stamina, the clock and the world, `src/data/layers.ts` for hardness, looks and discovery odds per layer, `src/data/tools.ts` and `src/data/store.ts` for tools, upgrades and prices, `src/data/goals.ts` for goals, `src/data/finds.ts` for finds, `src/data/economy.ts` for bills, debt and the month, and `src/data/deposits.ts` for the endgame multipliers. To add a mineral, add an entry to `minerals.ts`. To add a new kind of interior look, add a painter to `art/InteriorArt.ts`. To replace a store icon, drop a square PNG named after its id into `src/assets/store/`. To change a sound, keep its filename in `src/audio/samples/` (see the audio README).

## Performance notes

- All terrain is one texture and a small heightmap. Digging never creates per-dirt objects.
- Every texture is painted once (rocks when they find). Rock textures are freed after the rock is sold.
- Particle emitters and effect sprites are created once and reused.
- Per-frame work is minimal. The stamina bar and depth gauge only redraw when their displayed value changes, and there is no per-frame text redraw.
- Long frames are clamped. The game loop pauses on its own in background tabs, and audio is suspended while the tab is hidden.
- The store list uses a scissor camera instead of a stencil mask.
- The layout is recomputed on resize. Phones get a stacked layout, larger touch targets and fewer particles.
