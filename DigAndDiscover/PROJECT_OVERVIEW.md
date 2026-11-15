# Dig & Discover: Project Overview

> **Which version is this?** This is the **friend's version** (git author `Imad`), imported from GitHub on 2026-11-15 and now the **main project** we keep working on. It is built on top of our own earlier version (working day, vertical mining, forced cutting, camera scrolling) and adds a store, levels, goals, ten layers, deposits, ads, sampled audio and a hand-illustrated world. Our pre-import version is saved untouched at `D:\WebGames\DigAndDiscover_BACKUP_pre-friend-version_2026-11-15`.
> **Since the import (2026-11-15) the game went through the "rock-first update"**: rocks are the only reliable income, the old cash-paying curios were replaced by a **finds** system (artifacts that pay only when sold, collection items, junk), the clock is back, the UI uses painted icons instead of emoji, there are 43 minerals including worthless ones, and a **finance layer** (daily household bills, weekly debt instalments, a 30-day deadline and a game over with restart) was added. Where an older paragraph below still says "curio", read it as the finds system described in section 11.
> Jump to **section 9** for the status and handoff, **section 10** for a commit-by-commit list of everything the friend added, and **section 11** for the rock-first update.

## 1. The game in brief

**Dig & Discover** is a casual 2D incremental game for players aged 13 and up, playable in the browser on desktop or phone. It is inspired by videos of people digging up ordinary-looking rocks and sawing them open to see whether there are crystals inside.

### The story (kept in the background)
You play an ordinary father with a geology degree who never found the career he hoped for. He has a family, bills and taxes, so he turns what he knows into a living: a small, independent rock prospector with an old shovel, limited stamina and a patch of ground to explore. Every working day matters, because there is a family waiting at home. There are no cutscenes or dialogue. The story shows up as small touches: a little cottage on the horizon, a family photo and a warm one-line message at the end of each day. The tone stays grounded and light.

### The fantasy
You start at the top of an underground deposit and dig **down** through **ten** geological layers. You uncover mystery rocks, take them to the workshop, cut them open on a saw and sell what you find. A rock's outside never reliably tells you what's inside: a dull grey cobble might hide an emerald, and a sparkly egg might be plain stone. Rocks are the business. Now and then the ground also coughs up a **find**: a valuable artifact you can sell later, a collectible for your album, or plain junk. Money buys better tools and upgrades, pays the household bills and the weekly instalment of the family's debt, finishing goals levels you up, and when you reach bedrock you can **relocate to a new, richer and tougher deposit** and keep going.

| | |
| --- | --- |
| Genre | Casual incremental / collection game |
| Platform | Web browser (desktop and mobile) |
| Engine | Phaser 3 (WebGL, with Canvas fallback) |
| Language | TypeScript |
| Build tool | Vite |
| Art | Almost all generated in code at startup (Canvas 2D). The only image files are the pickaxe coin `src/assets/ui/coin.png` and optional PNG overrides for store icons (that folder is empty apart from its README). Icons (`art/UiIcons.ts`), minerals, finds and everything else are painted in code |
| Font | **Rye** (vintage woodtype slab, `@fontsource/rye`), used everywhere |
| Audio | 14 MP3 samples in `src/audio/samples/` (including looping background music), plus a few synthesized cues, all through the Web Audio API |
| Saving | Progress is saved to `localStorage` (see section 2, "Saving") |
| Ads | Rewarded and midgame ads through the CrazyGames SDK, only in the `crazygames` build mode |
| Run | Double-click `Play Dig and Discover.bat` |

---

## 2. Core gameplay loop

```
 ┌── start of day, 7:00 AM ─────────────────────────────────────────────┐
 │                                                                      │
 │   DIG down ──► find rocks (+ the odd find) ──► WORKSHOP ──► CUT & SELL │
 │      ▲                 │                                  │          │
 │      │                 └─► XP, goals, level-ups           │          │
 │      │                                                    ▼          │
 │      └──── STORE: tools and upgrades ◄──────── money ◄────┘          │
 │                                                                      │
 └── 5:00 PM: day ends ──► end-of-day summary ──► START NEXT DAY ───────┘
 At bedrock: RELOCATE to a new deposit (ground starts over, richer and harder)
```

### The working day
- Every day runs from **7:00 AM to 5:00 PM** and the clock runs while you work, in the dig site and in the workshop. A small clock pill (day number, time, a thin progress bar) sits at the top centre of the HUD; on narrow screens (under 520 px) it moves to its own row under the goal pill so the money pill and buttons never cover it. The sky also warms and darkens through the day.
- A day is short on purpose: one in-game hour is **24 real seconds**, so a day takes 4 minutes (`clock.secondsPerHour` in `GameConfig.ts`). For quick testing add `?secondsPerHour=3` to the URL.
- The clock advances by real elapsed milliseconds, never by frame count. It holds still while the **store, goals, collection or relocate card** is open, and while an ad is playing.
- At **5:00 PM** digging stops and anything already in motion finishes cleanly. **If rocks are still in your bag, you are walked to the workshop and must cut and sell every one of them before the day can end**; there is no way back to the dig site until the bag is empty. Rocks are never sold for you. Once the bag is empty, the **end-of-day summary** appears after a short pause.
- **START NEXT DAY** advances the day counter, resets the clock to 7:00 AM and refills stamina. Money, tools, upgrades, rocks in your bag and the excavation are all kept.

### Phase A: Digging (top to bottom)
- The game opens straight onto the surface. There is no menu and almost no text: pictures and numbers do the talking.
- **The shovel follows the mouse cursor** (smoothed, leaning into movement, kept above the ground). Click to swing, hold to keep digging, or press `Space` to dig exactly at the cursor.
- Each swing carves a visible crater, throws out debris and **lowers the floor**. A swing always bites into the exposed floor of the hole, so progress is strictly top-down.
- **The camera never jumps because of a stray tap.** It only moves down to keep the hole on screen as you dig deeper. A tap on ground that is out of view does nothing (no stamina spent). Taps just beside the hole snap to its floor. Look around with the **mouse wheel** (also `Up`/`Down`, `PageUp`/`PageDown`, or a finger drag). A **"Back to the hole"** chip appears while the hole is off screen; click it (or press `Space`) to return.
- **Touch model (phones):** a press no longer swings. A quick tap digs once on release, a steady press digs while held, a drag scrolls 1:1 with the finger and glides on release, and a second finger is ignored. The shovel follows the finger sideways and rests while the view scrolls. Phones also get small vibrations (`navigator.vibrate`) and fewer particles with a softer screen shake.
- Deeper ground is harder. A swing removes less depth, costs more stamina and feels heavier. A tool bites at full strength once its **power is at least the layer's hardness**; a weaker tool falls off steeply (see section 3).
- Whenever a swing turns up a rock, it appears half-buried in the floor of your shaft with progress dots. A few more swings free it and it pops into your bag.
- Whenever a swing turns up a **find** (never on the same swing as a rock), a dark silhouette with a coloured "?" (gold artifact, teal collection item, grey junk) sits in the floor, and a few swings free it; a card then names it (see "Finds").

### Stamina
- Base tank **100**, one swing costs **7** at the surface times the layer's stamina multiplier (1.0 up to 3.8 in the deepest layer) times the tool's stamina multiplier. After you stop digging for 0.8 seconds, stamina refills at **7 per second**.
- Store upgrades raise the tank (+20 per level), the refill (+1.5 per second per level) and cut the swing cost (-6% per level). All base numbers are in `GameConfig.ts`.
- The bar changes color as it drains and flashes when empty. Each new day starts rested.
- When stamina is under 20% and ads are available, a **watch-an-ad refill** button appears.

### Phase B: Collecting
- The bag has **5 slots**. Uncut rocks show a `?` badge (owners of the Deep Scanner see the rarity on the badge instead).
- The **workshop is usable from your first rock**. The action button shows progress (`0/3`) and becomes a pulsing **Workshop** button once you have 3 uncut rocks, or when the bag is full.
- If the bag is full, a rock you freed waits in the ground and pops out after you sell something.

### Phase C: Cutting
- In the workshop, the first uncut rock flies onto the cutting machine. Tap another rock in your bag (or press `1`-`5`) to swap it in.
- Press the cut button. The saw spins down through the rock, which then splits into two halves. The celebration grows with rarity:

| Rarity | Reveal effects |
| --- | --- |
| Common | Dust puff, small chime |
| Uncommon | Colored sparkles, glitter |
| Rare | Screen flash, light rays, screen shake |
| Epic | Short dramatic pause, bigger rays and shake |
| Legendary | All of the above, plus confetti and a rainbow-tinted label |

- **Sound of the reveal:** a rock worth **$15 or more** plays the long supplied reveal piece (`reveal.mp3`); a rock worth **under $15** plays `rock-under-15.mp3` instead. The visual celebration still follows the rarity tier.

### Phase D: Selling
- The info card shows the rarity, the mineral and a value that counts up. Press **SELL**: coins (the pickaxe coin image) fly to the money counter and the counter rolls up.
- For a rock worth **$30 or more**, a **"sell for double (watch an ad)"** button appears under SELL when ads are available.

### Phase E: End of day
- The summary card shows the day number, hours worked, rocks found and cut today, money earned today, total discoveries, depth progress, savings, the family photo and one short message that depends on how the day went.
- With ads available and money earned today, a **2x** button doubles today's earnings (rewarded ad). Pressing START NEXT DAY may first show a **midgame ad break** (at most once every 3 minutes, never in the first minutes).

### Progression: level, XP, goals
- **Prospector level.** XP needed to go from level L to L+1 is `round(60 x L^1.5)`. Each level-up pays `15 x L` cash and unlocks store items by level.
- **XP sources.** Cutting a rock (by rarity: 3 / 8 / 20 / 50 / 150), entering a new layer (`25 x layer index`, paid **once per deposit** so reloading cannot farm it), finishing a goal, and a find (artifact 5 / 12 / 30 / 70 / 200 by tier, collection 4 / 10 / 25 / 60 / 150 and doubled the first time, junk 1). `FIND_CONFIG.xpByTier` holds the numbers.
- **Goals.** Three are always active (shown as a pill under the top bar with a picture, a progress bar and two numbers). Finishing one pays cash and XP and a new one takes its place. The first six are a scripted tutorial that leads to the store: find 3 rocks, cut 2, earn $60, dig to 4 m, buy something, dig up a curio. After that goals are random, scaled to your level: find `4+2L` rocks, cut `3+2L`, earn about `60 x L^1.5`, dig up `1+L/3` curios, cut `1+L/4` Rare-or-better rocks, or dig 3 m deeper than your best. (The old "dig up a curio" goal is now "dig up a collectible" and pays XP only.) Reward is about `25+20L` cash and `20+6L` XP (some goal types pay more). Tap the pill (or press `G`) for the goals card.

### The store
- Open it with the store button (a "!" badge shows when something unlocked, useful and affordable is waiting) or the `S` key. The game holds still while it is open.
- **Tools tab:** shovels, digging tools and scanners (table below). Tools unlock by prospector level. The **tool in your hands is always the owned digging tool with the most power**; buying a weaker one is refused. Six "Placeholder Shovel" slots can be seen but not bought (empty slots for the friend's own designs).
- **Upgrades tab:** five upgrades with up to 8 levels each plus the endless **Master Digger** (+5% tool power per level, up to level 99).
- A **"watch an ad for cash"** row (worth `$50 + $25 x level`) appears in the store when ads are available.

| Tool | Power | Price | Unlocks at level | Other effects |
| --- | --- | --- | --- | --- |
| Old Shovel | 1 | free | 1 | starter |
| Iron Shovel | 2.2 | $180 | 2 | |
| Steel Shovel | 3.6 | $1,200 | 3 | |
| Hand Axe | 4.8 | $2,800 | 4 | faster swings |
| Golden Shovel | 6 | $5,500 | 5 | |
| Pickaxe | 7.5 | $9,000 | 6 | |
| Jackhammer | 10 | $26,000 | 8 | very fast, shallow swings |
| Diamond Shovel | 11 | $34,000 | 9 | |
| Power Drill | 15 | $75,000 | 11 | fastest swings, lowest stamina cost |
| Rock Scanner | - | $6,000 | 4 | +25% chance to find a rock |
| Deep Scanner | - | $45,000 | 9 | +50% find chance, shows rarity on uncut rocks |

| Upgrade | Per level | Base price (levels cost more: x growth) | Max level |
| --- | --- | --- | --- |
| Bigger Tank | +20 max stamina | $200 (x1.55) | 8 |
| Quick Recovery | +1.5 stamina per second | $260 (x1.55) | 8 |
| Efficient Swings | -6% stamina per swing | $340 (x1.6) | 8 |
| Digging Damage | +10% depth per swing | $300 (x1.6) | 8 |
| Swing Speed | -6% time between swings | $380 (x1.6) | 8 |
| Master Digger | +5% tool power | $12,000 (x1.2) | 99 |

### Finds (artifacts, collection items, junk)
Replaced the friend's 57 emoji "curios", which paid cash at once. Rocks stay the business; finds only add variety and surprise, and **no find ever pays money when it is dug up**.
- **71 finds** in `data/finds.ts`, painted in code (`art/FindArt.ts`): 29 **artifacts**, 26 **collection** items and 16 **junk**. Each has a tier (Common to Legendary), a first layer it can appear in and a one-line history.
- **When:** at most one find per swing, never on the same swing that turns up a rock, never while two buried objects are already waiting. The per-swing chances are small (artifact 0.4%, collection 0.7%, junk 1.2%, scaled per layer in `FIND_CONFIG`), so finds are rarer than rocks.
- **Artifacts** are stored (Finds screen, artifacts tab) and carry a **condition** (Poor 0.35x, Fair 0.7x, Good 1x, Fine 1.6x, Mint 2.6x) that scales their sale value (roughly $4 for a worn coin up to hundreds for a legendary piece; richer deposits raise it). **Selling them is the only way they become money**: the Sell button on a row or Sell all.
- **Collection items** are counted per item (found / total, silhouettes for the missing ones, tap one to read its story). **Junk** is only counted. Neither pays anything.
- XP only: a find gives a little XP (see Progression). The first collection item of a kind gives double.
- **Screens:** the pop-up card (`ui/FindCard.ts`: picture, name, category chip, stars, and for an artifact its condition and what it would fetch, never a "+$" line) and the **Finds screen** (album button or `C`, `scenes/CollectionScene.ts`, three icon tabs: collection, artifacts, junk).
- Saved in the save file; a restart clears them.

### The household and the debt
- Every working day ends with **household bills** (`data/economy.ts`: food $35, water $12, electricity $18, other $15 in month 1, growing x1.4 each month). They are deducted from your money when the day summary opens; what you cannot pay is **carried forward** as an outstanding bill and shown in red. Nothing is discarded.
- You owe the bank **$250,000**. An **instalment** (month 1: $2,500, growing x2.4 each month) falls due **every 7 days**. A missed instalment stays overdue and piles up.
- The month is **30 days**. When you press START NEXT DAY on day 30, any **overdue debt** ends the run: **Game Over**, with the reason on screen and a **Restart** button (no key can press it). If you are clear, the next month starts with a new, bigger schedule.
- The **debt ledger** (`L`, or the ledger chip under the top bar with a red or amber badge) shows debt, weekly payment, paid so far, overdue, next payment day, days left in the month, bills owed and your money. **Pay what is due** clears the carried household bills first, then the overdue instalment (with nothing due it reads **Pay ahead** and prepays the next instalment). **Pay all I can** pays bills, then the debt.
- **Restart** resets the whole run (money, day, dig, tools, upgrades, XP, bag, finds, bills, debt). Only the sound mute preference survives.
- All numbers live in `data/economy.ts`; the logic is the pure `systems/FinanceSystem.ts` (checks in `dev/finance-sim.ts`).

### Deposits: relocating at bedrock
- Digging out the last layer reaches **bedrock**, and a relocate card offers a fresh deposit (the prompt waits at least 20 s before reappearing if you say no).
- **Each new deposit** starts the ground over with its own name and colour wash (Hometown Quarry, Copper Hills, Misty Ravine, Sunset Canyon, Frostbite Fields, Dragon's Back, Moonlit Mesa, Thunder Gorge, then "II" versions), is **40% harder** per deposit, pays **50% more** for rocks and artifacts, makes every tool **4% stronger** per deposit, and pays a cash bonus of `$1,500 x deposit`. Money, tools, upgrades, level and the collection all carry over. Depth goals from the old hole are dropped.

### Rewarded ads (CrazyGames)
- Ads exist only in the portal build (`npm run build:crazygames`, mode `crazygames`) or in a local test (dev server, or `?mockads` in the URL, which shows a fake 3-second "ad"). A normal build never loads the SDK and never shows an offer.
- Offers: refill stamina (when under 20%), sell a rock for double (rock worth $30+), double the day's earnings (summary), free cash (store row), and a midgame break between days. A rewarded offer has a 20-second cooldown, midgame breaks are at least 3 minutes apart, and all sound is muted while an ad plays. The game reports `gameplayStart` / `gameplayStop` to the SDK.

### Saving
- Saved to `localStorage` under `dig-and-discover-save-v2` (older v1 saves are ignored): money, day number, rocks found and cut, XP, owned tools, upgrade levels, active goals, best depth, the finds inventory (artifacts held, collection and junk counts), the finance state (debt, instalments, carried bills, month and day in month, game over), the current deposit and the deepest layer already paid out. A run that ended in Game Over stays ended after a reload until Restart is pressed.
- **Not saved (from reading the code):** the dug shaft itself, the rocks in your bag and the time of day. Reloading restores your progress but starts the ground over.
- Add `?reset` to the URL to clear the save.

### Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Dig | Click (hold to repeat). Touch: quick tap, or steady press | `Space` (digs at the cursor) |
| Look around the shaft | Mouse wheel, or drag a finger | `Up` / `Down`, `PageUp` / `PageDown` |
| Back to the hole | "Back to the hole" chip | `Space` |
| Go to the workshop | Workshop button | `Enter` |
| Choose a rock | Tap a bag slot | `1`-`5` |
| Cut / Sell | Card buttons | `Space` |
| Back to digging | Back to Dig button | `Esc` |
| Store | Store button | `S` |
| Goals | Goal pill under the top bar | `G` |
| Collection | Album button | `C` |
| Close a card | Close button | `Esc` |
| Start the next day | START NEXT DAY button | `Enter` or `Space` |
| Mute | Speaker button | `M` |

---

## 3. The underground: layers, depth and tools

The deposit is a side-view cross-section, about **44 metres** deep (80 field units = 1 m), plus solid bedrock at the bottom. Layers are plain data in `src/data/layers.ts`: add, remove, reorder or rebalance them and everything adapts (digging, terrain painting, depth gauge, labels, discovery odds). The ground texture is sized so ten layers still fit a phone's texture limit.

| # | Layer | Thickness | Hardness | Stamina x | Value x | Rarity weights (C / U / R / E / L) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Surface Soil | 300 | 2.5 | 1.0 | 1.0 | 78 / 17 / 4.5 / 0.5 / 0 |
| 2 | Compact Soil | 340 | 5.8 | 1.15 | 1.0 | 62 / 25 / 10 / 2.5 / 0.5 |
| 3 | Hard Earth | 360 | 9.9 | 1.35 | 1.0 | 50 / 27 / 15 / 6 / 2 |
| 4 | Rocky Soil | 360 | 14.4 | 1.6 | 1.0 | 40 / 27 / 20 / 9 / 4 |
| 5 | Deep Mineral Deposit | 360 | 21.6 | 2.0 | 1.0 | 28 / 26 / 24 / 15 / 7 |
| 6 | Fossil Bed | 360 | 27 | 2.3 | 1.5 | 24 / 25 / 25 / 17 / 9 |
| 7 | Buried Ruins | 360 | 34 | 2.6 | 1.9 | 20 / 23 / 26 / 20 / 11 |
| 8 | Frozen Cavern | 360 | 43 | 3.0 | 2.4 | 17 / 21 / 26 / 23 / 13 |
| 9 | Magma Veins | 360 | 54 | 3.4 | 3.0 | 13 / 19 / 26 / 26 / 16 |
| 10 | Heart of the Earth | 380 | 68 | 3.8 | 4.0 | 8 / 16 / 26 / 29 / 21 |

Layers 1-5 are as in our earlier version except that hardness is about 1.8x higher (it was 1.4 / 3.2 / 5.5 / 8 / 12) and they are thinner (they were 340 / 440 / 500 / 520 / 560 units, so the old five-layer deposit was about 30 m deep). Layers 6-10 are new and each has its own strata art. **Value x** multiplies the sale price of rocks found in that layer (and stacks with the deposit's value bonus). Discovery odds per layer: base chance about 12% falling to 9%, a mild "pity" ramp of +0.8% per dry swing, and a cap of 26-30%. Nothing is ever guaranteed.

**How a swing works.** `efficiency = max(minEfficiency, min(1, toolPower / (layerHardness x depositHardness)) ^ 1.4)`, and the swing lowers the floor by `digDepth x efficiency` (crater width also shrinks a little when weak). So a tool with power below the layer's hardness loses depth steeply (the floor is 5% of full), and each layer wants a better tool instead of being ground out.

**Tools** are data in `src/data/tools.ts` (`TOOL_DEFS`: power, depth per swing, crater size, swing speed, stamina multiplier, tint) and the store catalogue is in `src/data/store.ts`. The in-world sprite is still the shovel, washed with the tool's tint, until real art exists. Upgrade effects are in `UPGRADE_EFFECTS`. The game's current tool is the store's best owned digging tool, with the Master Digger bonus and the deposit's 4% power bonus applied.

### How the terrain works (efficiently)
- The ground is **one big texture** (a `RenderTexture`), not thousands of objects. Each swing erases an ellipse from it, revealing a darker copy of the same strata behind it (the wall of the shaft).
- The logical state is a **heightmap**: one floor height per 10-unit column (`ExcavationSystem`). The scene paints the very same ellipse, so what you see and what the game counts always match.
- The camera keeps one number, the field height it wants on its focus line. Digging below that line pulls it down; scrolling moves it freely; nothing else changes it. It eases toward that height and snaps to whole pixels so the terrain never shimmers.
- A swing is only accepted on ground that is on screen (`aim()` in `DigScene.ts`), so what you see is always what gets dug.
- Surface scenery, a parallax backdrop of cut-paper ridges and the sky are painted once by `SurfaceArt.ts` and `ScenicArt.ts`; the soil gets sediment bands, geology marks, inked stones, worms and ant tunnels in the topsoil, mushrooms and a darker humus band under the grass.

---

## 4. Content (data-driven)

All content is plain data in `src/data/`. To add new content, add an entry; no code changes are needed.

**Interiors (minerals)**, with sale values before the layer and deposit multipliers:

| Rarity | Minerals | Value range |
| --- | --- | --- |
| Common | Ordinary Stone (dud), Quartz Cluster, Honey Calcite | $3 - $16 |
| Uncommon | Banded Agate, Amethyst Geode, Citrine Geode | $26 - $56 |
| Rare | Garnet, Fire Opal, Aquamarine | $95 - $175 |
| Epic | Emerald, Ruby, Sapphire | $310 - $470 |
| Legendary | Starfire Geode, Prismatic Heartstone, Nebula Celestine | $1,300 - $2,400 |

Larger rocks get a value bonus of up to about +15% (smaller rocks lose up to about 15%). Then the layer's **Value x** and the deposit's **+50% per deposit** apply.

**Exteriors:** Dusty Nodule, Grey Cobble, Rusty Lump, Dark Basalt, Speckled Egg. Each rock's exterior is picked independently of what's inside.

**Interior art styles:** `plain`, `cluster`, `banded`, `geode`, `gem`, `opal`, `prism`, each with its own painter.

**Finds:** `src/data/finds.ts` (71 entries, value ranges, conditions, chances and XP). **Finance:** `src/data/economy.ts`. **Goals:** `src/data/goals.ts`. **Store:** `src/data/store.ts`. **Deposits:** `src/data/deposits.ts` (names, tints and the four multiplier functions).

**Replacing art without code:** drop a square PNG (256x256) named after the id into `src/assets/store/` (for example `tool-iron-shovel.png`); it replaces the placeholder automatically. Ids are listed in the data files and the README in that folder. (The old `src/assets/curios/` override folder was removed with the curios; finds are painted in code.)

---

## 5. Architecture

```
            ┌───────────────────────────────────────────────────────────┐
            │  GameState (singleton)                                    │
            │  stamina · inventory · economy · excavation · discovery   │
            │  finds · finance · progress (level, goals, tools, save)   │
            │  · day                                                    │
            │  cycle + clock · stats · event bus                        │
            └──────────┬────────────────────────────────────────────────┘
          events ▲     │ reads / calls
   ┌───────────────┬───┼────────────────────┬─────────────────────┐
   │               │   ▼                    │                     │
 DigScene     WorkshopScene          HudScene (on top)     EndOfDayScene (overlay)
 (strata,     (bench, saw,           (money, goal pill,    (summary card,
  shaft,       reveal, sell)          depth gauge, stamina, family photo,
  rocks,                              bag, buttons, scene   START NEXT DAY,
  finds)                              switching, ads)       2x ad, midgame ad)

 Overlay cards that pause the game:  StoreScene · GoalsScene · CollectionScene (the Finds screen) · RelocateScene
 Finance overlays:  LedgerScene (debt card) · GameOverScene (reason + Restart)
 Ads:  src/ads/Portal.ts (CrazyGames SDK wrapper, test ads in dev)
```

- **Systems** (`src/systems`) are pure logic with no Phaser rendering, so they are easy to test and extend.
- **Scenes** handle rendering and input. They talk to each other only through the `GameState` event bus.
- **Data** (`src/data`) and **config** (`src/config`) hold every tunable value and every piece of content.
- **Art** (`src/art`) paints every texture once with the Canvas 2D API.
- **Scene order in `main.ts`** (also draw order): Boot, Dig, Workshop, Hud, EndOfDay, Store, Goals, Collection, Relocate.

---

## 6. Scripts and what each one does

### Root files
| File | Purpose |
| --- | --- |
| `Play Dig and Discover.bat` | One click: checks for Node.js, installs dependencies on the first run, builds the game, then starts a local server and opens the browser. |
| `index.html` | Page shell: viewport and touch settings, full-screen game container, loading text (in Rye). |
| `package.json` | Dependencies (Phaser, the Rye font, TypeScript, Vite) and scripts: `dev`, `build`, `build:crazygames` (portal build into `dist-crazygames/`), `preview`, `typecheck`. |
| `vite.config.ts` | Build settings: relative paths, dev and preview ports, Phaser split into its own bundle file. |
| `postcss.config.mjs` | Empty PostCSS config so this game does not inherit the website's Tailwind/PostCSS setup when it lives inside the `ub_website` repo. |
| `tsconfig.json` | Strict TypeScript settings. |
| `README.md` | Setup and run instructions. |

### `src/main.ts`
Entry point. Starts the ad SDK in the background (never blocks), waits for the Rye font and for the window to have a real size, then creates the Phaser game: WebGL with automatic Canvas fallback, resize-to-fit mode, 2 touch pointers, built-in Phaser audio disabled (sound goes through our own `Sfx` module), and the scene list above. On the dev server only it exposes `window.__dd` (game and state) for debugging; it is removed from production builds.

### `src/config/`
| File | Purpose |
| --- | --- |
| `GameConfig.ts` | **Global gameplay numbers**: stamina, the working-day clock, closing-time timings, dig reach and aim assist, bag size, the excavation world (width, surface line, bedrock, metres, camera), rock sizes, cut duration, starting money. |
| `Theme.ts` | The Rye font family, color palette, button color sets, and helpers for building text styles (sharp text on high-DPI screens). |

### `src/data/`
| File | Purpose |
| --- | --- |
| `layers.ts` | The ten geological layers: thickness, hardness, stamina multiplier, value multiplier, look (colors, stones, detail), dig feel (debris tints, clang, shake, sparks) and discovery odds (chance, rarity weights, hits to free a rock). |
| `tools.ts` | `TOOL_DEFS` (every buyable digging tool), `SCANNERS` (find bonus, shows rarity) and `UPGRADE_EFFECTS`. Also the Old Shovel / starter tool. |
| `store.ts` | The store catalogue: tool sections, upgrade sections, prices, growth, max levels, level requirements, icon styles; `upgradePrice()`. |
| `goals.ts` | Goal types, the six-goal onboarding, reward formulas, `rollGoal()`, goal icons and text. |
| `finds.ts` | The 71 finds (29 artifacts, 26 collection items, 16 junk): tier, first layer, history, value range, `CONDITIONS`, `CATEGORY_STYLE` and `FIND_CONFIG` (chances per swing, per-layer multipliers, XP). |
| `economy.ts` | `ECONOMY`: the household bill items, the debt, instalment size and interval, the 30-day month and the monthly growth; helpers `expenseItemsForMonth`, `installmentForMonth`. |
| `deposits.ts` | Deposit names and colour washes, plus `hardnessMult`, `valueMult`, `powerMult` and `relocationBonus`. |
| `dayMessages.ts` | The short, warm end-of-day lines and the rule that picks one from how much you earned. |
| `rarities.ts` | The 6 rarity tiers (Worthless, Common, Uncommon, Rare, Epic, Legendary): weight, tier number, display colors, chance of a glittery exterior. Worthless rocks are worth exactly $0. |
| `minerals.ts` | The 43 minerals (13 original, 30 fictional): rarity, weight, art style, colors, value range, flavor text, dud and glow flags, `minLayer` depth gating and a `reveal` effect style. |
| `exteriors.ts` | Outside looks: colors, how lumpy, how flattened. |

### `src/core/`
| File | Purpose |
| --- | --- |
| `GameState.ts` | Shared state holding every system, the equipped tool (with store upgrades applied), stats, current mode, workshop-busy flag, an activity counter and the **event bus**. `EVT` lists every event name (including `findFound`, `financeChanged`, `gameOver`, `runReset`, `bedrock`, `relocated`, `levelUp`, `goalDone`, `toolChanged`, `progressChanged`). `buyTool()` / `buyUpgrade()` return a `BuyResult`; `relocate()` starts the next deposit; `recordCut()` / `recordFindItem()` pay XP and notify goals (finds never pay cash); `sellArtifact()` / `sellAllArtifacts()` turn artifacts into money; the finance API is `settleFinance` (when the day summary opens), `payDebt` / `payDebtDue`, `ledger`, `startNextDay` (month check, game over) and `resetRun()` (full restart); `tick()` advances time-based systems each frame and opens the summary at closing time; `subscribe()` registers a scene listener that is removed automatically when the scene shuts down. |
| `Random.ts` | Seeded random generator (mulberry32) plus helpers. |
| `types.ts` | The `Rock` type and `GameMode`. |

### `src/systems/` (pure logic)
| File | Purpose |
| --- | --- |
| `ClockSystem.ts` | The 7 AM - 5 PM clock, advanced by real milliseconds. |
| `DayCycleSystem.ts` | Day counter, the `working -> closing -> summary` phase machine (with `canWork` and `canCut`), today's tallies and the `DaySummary` type. |
| `ExcavationSystem.ts` | The heightmap excavation. `dig()` applies one swing (efficiency from tool power, layer hardness and the deposit multiplier) and returns the carved ellipse. Depth in metres, current layer, bedrock (`atBottom`), `reset()` for a new deposit, layer-entered events. |
| `DiscoverySystem.ts` | Per-swing chance to turn up a rock, with the pity ramp and the scanners' find bonus. |
| `FindSystem.ts` | `FindSystem` (per-swing find roll by category and layer, item making with condition and value) and `FindsInventory` (artifacts held, collection and junk counts, sell, save and restore). No money is created here. |
| `FinanceSystem.ts` | Pure finance logic: itemised household bill, carried bills, weekly instalments, overdue, month check, `pay`, `payBills`, `payInstallment`, `view()` for the UI, save and restore. |
| `ProgressSystem.ts` | Level and XP, owned tools, upgrade levels, the three goals, deposit number and the **save and load** to `localStorage` (save key `dig-and-discover-save-v2`). |
| `RockGenerator.ts` | `generateRock()`: rarity (the layer's weights), mineral, independent exterior, size and value with the layer/deposit multiplier. |
| `StaminaSystem.ts` | Spending stamina (with cost multiplier), the rest delay, regeneration, store upgrades and `reset()` / `refill()`. |
| `InventorySystem.ts` | Fixed-slot bag: add, remove, `markCut`, `firstUncut`, counts, `isFull`. |
| `EconomySystem.ts` | Money balance, `earn`, `grant` (rewards that do not count as sales), `spend`, `sell(rock)`. |

### `src/art/` (procedural graphics)
| File | Purpose |
| --- | --- |
| `paint.ts` | Canvas helpers: color math, blobs, ellipses, stars, rounded rectangles, polygons, `makeCanvasTexture()`. |
| `TextureFactory.ts` | Paints every shared texture at startup: craters, particles, ring, shadow, light ray, saw blade, cutting machine, the old shovel and the tinted tool sprites. |
| `StrataArt.ts` | Paints the whole underground cross-section once: ten layers with wavy boundaries, grain, stones and layer-specific details, the grass line and bedrock. |
| `ScenicArt.ts` | The hand-illustrated backdrop: washed sky, sun with beams, flat-bottomed clouds, cut-paper ridges, and the soil's paper-grain and geology marks. |
| `SurfaceArt.ts` | Surface scenery: timber-framed cottage with a scalloped tile roof, storybook tree, woodpile, barrel, signpost and a mine head-frame with pulley, lantern and an ore cart of gems. |
| `IconArt.ts` | Custom painted star (level, rarity) and circular saw-blade icons. |
| `StoreArt.ts` | Painted store icons (shovel icons, upgrade glyphs, placeholders) and the `assets/store` PNG override. |
| `FindArt.ts` | Procedural pictures for all 71 finds (`ensureFindTexture`, `paintFind`, `paintSilhouette`). |
| `UiIcons.ts` | The 41 painted UI icons (`uiIcon('cash')` gives the texture key; contact sheet in `dev/icons-sheet.html`). |
| `FamilyPhoto.ts` | The framed family photo on the end-of-day card. |
| `RockArt.ts` | Per-rock textures: the outside and the cut cross-section (freed after sale). |
| `InteriorArt.ts` | One painter per interior style. |

### `src/audio/`
| File | Purpose |
| --- | --- |
| `Sfx.ts` | Plays the MP3 samples and synthesizes the remaining cues through the Web Audio API. Mute is remembered in `localStorage`; audio starts on the first tap or key press and pauses while the tab is hidden. `SAMPLE_GAIN` balances each cue's loudness and `MUSIC_GAIN` (0.32) sets the music level. Vibration patterns for phones live here too. |
| `samples/*.mp3` | 14 files: dig, click, coin, denied, exhausted, soil-level-up, money-collect, rock-found, saw, sell, tool-hit, reveal, rock-under-15 and the looping background music. |
| `README.md` | The table of which sample plays when, how they were processed, and how to replace one. |

Four cues stay synthesized: `timesUp`, `newDay`, `dayEnd`, `place`.

### `src/ads/Portal.ts`
The CrazyGames SDK wrapper: `portal.init()`, `rewarded()`, `midgame()`, `setPlaying()`, `rewardedReady`, `hasAds`. Test ads in dev or with `?mockads`.

### `src/ui/`
| File | Purpose |
| --- | --- |
| `layout.ts` | `computeLayout()` works out the screen layout for any size. Phones get a stacked layout; wide screens put the button beside the bag. |
| `GoalPill.ts` | Under the top bar: the level badge ringed by an XP arc, plus the closest goal (picture, progress bar, two numbers). Tapping opens the goals card. |
| `FindCard.ts` | The "what did I just dig up?!" card for a find: slides in, never pauses the game, goes away by itself, never shows a cash gain. |
| `ClockPill.ts` | The small day and time pill with a progress bar (top centre, or its own row on narrow screens). |
| `DepthGauge.ts` | Slim vertical gauge on the right: layer-colored segments, a marker for where you are digging and a line for your deepest point. |
| `Button.ts` | Chunky rounded button with a 3D edge, press squash, disabled state, pulse, and an optional picture beside its label. |
| `InventorySlot.ts` | One bag slot: rock icon, `?` badge, rarity border once cut, "on bench" state. |
| `StaminaBar.ts`, `MoneyCounter.ts`, `Toast.ts` | Stamina bar, money counter with the pickaxe coin and count-up, and a single reusable pop-up bubble. |

The old `ClockPill.ts` and `ToolChip.ts` widgets were removed when the HUD was quieted.

### `src/scenes/`
| File | Purpose |
| --- | --- |
| `BootScene.ts` | Paints the shared textures, starts the dig scene and the HUD. |
| `DigScene.ts` | The excavation site: sky, parallax backdrop, home and head-frame, strata terrain, shaft, swings, craters, debris, rock and find discovery (`embedFind` / `unearthFind`), the camera (follow, scroll, "Back to the hole" chip), the cursor-following shovel, touch gestures, depth labels and the bedrock event. |
| `WorkshopScene.ts` | Workbench, cutting machine, saw and info card; the bench steps (empty, placing, ready, cutting, revealed, selling); the "sell for double" ad offer; after closing time the player must cut and sell every rock left. |
| `HudScene.ts` | Always-on-top overlay: money, mute, store and collection buttons (with the "!" deal badge), goal pill, depth gauge, stamina, bag and action button. Runs the game clock each frame, shows banners, walks the player to the workshop at closing time, opens the end-of-day screen, switches between dig and workshop with a fade, opens the store/goals/collection/relocate cards, and shows the stamina-refill ad button. |
| `EndOfDayScene.ts` | Summary overlay with the 2x ad button, the family photo and START NEXT DAY (with the midgame ad). |
| `StoreScene.ts` | The store card with Tools and Upgrades tabs, prices, locks by level, purchases and the free-cash ad row (the list scrolls with a scissor camera for speed). |
| `GoalsScene.ts` | Level and XP, the three goals with rewards, the deposit line and a peek at what the next level unlocks. |
| `CollectionScene.ts` | The Finds screen (scene key `Collection`): collection, artifacts (Sell and Sell all, the only way artifacts pay) and junk tabs. |
| `LedgerScene.ts` | The debt card: debt, weekly payment, overdue, next payment, month deadline, bills owed, pay buttons. |
| `GameOverScene.ts` | The end of a run: reason, three stats and the Restart button (no key triggers it). |
| `RelocateScene.ts` | The bedrock card that offers the next deposit and shows what changes. |

---

## 7. Performance and quality notes
- WebGL is used first, with automatic Canvas fallback. The target is 60 FPS.
- All terrain is a single texture plus a small heightmap. Digging never creates per-dirt objects. Textures are painted once; particle emitters and effect sprites are created once and reused.
- Per-frame work is minimal: the clock, stamina and depth gauge only redraw when their displayed value changes (no per-frame text redraw; the stamina shimmer is throttled). The frame time is capped. The game loop and audio pause in background tabs.
- The store list uses a scissor camera instead of a stencil mask (about 3 fps became 48 fps).
- Event listeners are removed when scenes shut down, and rock textures are freed after sale.
- The layout adapts to any screen size and orientation. Phones get larger touch targets, a stacked layout, fewer particles and softer shake.
- The production bundle is about 1.7 MB of JavaScript (Phaser is 1.5 MB of that), about 1.6 MB of audio and a 119 KB coin image. Music alone is 780 KB.

---

## 8. Deliberately still out of scope
Family expenses, rent and tax payments, debt, equipment durability, complex geology simulation, customers or quests beyond goals, multiplayer, and saving the dug shaft. (Skill trees, the upgrade shop, equipment purchasing, multiple locations, saving progress and ads, which used to be on this list, now exist.)

---

## 9. Project status and handoff

*Written 2026-11-15 right after importing the friend's version. The rock-first update that followed the same day (finds, finances, icons, clock, 43 minerals) is described in section 11, which is the latest status; where this section says "curios", the finds system replaced them.*

### Versions and backups
| What | Where |
| --- | --- |
| **Main project (friend's version, keep working here)** | `D:\WebGames\DigAndDiscover` |
| **Our pre-import version (backup, do not edit)** | `D:\WebGames\DigAndDiscover_BACKUP_pre-friend-version_2026-11-15` (everything except `node_modules` and `dist`; run `npm install` there if it is ever needed) |
| GitHub source | `https://github.com/UnseenBox/ub_website`, folder `DigAndDiscover/`, branch `main` (imported at `fe5984e`) |
| Live copy on the website | `public/arcade/dig-and-discover/` in the same repo (`index.html`, `poster.jpg`, `assets/`) |

**The website serves the built game, not the source folder.** To publish changes: `npm run build`, then copy `dist/` over `public/arcade/dig-and-discover/` in the website repo (keep its `poster.jpg`). The game is listed on the site in `data/seed/playables.ts` (slug `dig-and-discover`, English / French / Arabic text and controls) and `lib/content/queries.ts` sorts playables by order, then newest first. The root `tsconfig.json` of the site must exclude `DigAndDiscover` (our earlier commit did this).

### What exists and works (verified by build, not full play-through)
- Everything from our earlier rounds: the 7 AM - 5 PM day, forced cutting at closing time, vertical mining, stamina, discovery, camera with wheel scrolling and "Back to the hole", end-of-day summary.
- Everything the friend added (section 10): store with 9 digging tools and 2 scanners and 6 upgrades, levels and XP, goals, 57 curios and a collection (later replaced by the finds system, section 11), ten layers, deposits, ads, sampled audio and music, the new art, Rye font, minimal-text HUD and the new touch model.
- `npm install`, `npm run build` (TypeScript check and Vite build) and `npm run preview` all pass on the imported version. The page loads, the HUD renders, the goals card opens and swings spend stamina, with no console errors.

### Not verified yet
- `Play Dig and Discover.bat` was not double-clicked end to end (the commands it runs were).
- No long real-time play session of the new content: relocation at bedrock, long multi-day play and the ad flow (mock ad) have not been exercised by me (store purchases, finds, the second day and the finance flow were checked in section 11). All numbers in this document come from reading the code. The friend reports tuning the pacing from a headless simulation.
- Touch on a real phone, and the CrazyGames build (`build:crazygames`), were not tested.
- The preview pane used for the smoke test was very small (433 x 350), so the hole itself was not seen on screen.

### Known gaps and stale text
- The dug shaft, bag contents and time of day are not saved (section 2, "Saving").
- Comments in `StoreScene.ts` and `data/store.ts` still say the store is "DISPLAY ONLY", and `data/tools.ts` says "only the starter shovel exists". The store is live; the comments are out of date. The original `README.md` also still says the game downloads no images or audio.
- Six "Placeholder Shovel" slots and the hand axe, pickaxe, jackhammer, drill and scanner icons are still placeholders waiting for real art.
- 15 source files differ from our backup only by line endings (the friend's copy uses Windows CRLF, ours used LF). The other 25 changed files have real content changes.

### Suggested next steps
1. Play through several days with the real `.bat` and fix anything the numbers did not predict.
2. Decide whether the dug shaft should be saved between visits.
3. Replace placeholder icons and the six placeholder shovels (PNG drop-in, no code).
4. Test on a real phone, and try `npm run build:crazygames` if the portal is a goal.
5. After any change, rebuild and copy `dist/` to `public/arcade/dig-and-discover/` so the live site updates.

### Working with the friend
The friend pushes to the same repo. **Before pushing our own changes, fetch the latest `DigAndDiscover/` from GitHub and compare**, so neither side overwrites the other. The memory note `dig-and-discover-repo` has the exact push steps for this machine (blobless sparse clone, push from the Terminal panel).

---

## 10. What the friend added (full list, oldest first)

Fourteen commits by `Imad`, 2026-11-14 to 2026-11-15, on top of our commit `869bc49`. Merged into `main` as `fe5984e`.

| Commit | What it added |
| --- | --- |
| `ef4dea9` | `postcss.config.mjs`: Vite no longer inherits the website's PostCSS config. |
| `15cb85a` | A supplied sample pack plays for ten sound cues (dig, click, coin, denied, exhausted, layer-enter, money-collect, rock-found, saw, sell). |
| `596b51a` | A first, display-only **store** (Tools and Upgrades tabs, PNG override folder `assets/store`). |
| `73ad2cf` | Samples for a direct rock strike (`tool-hit`), the cut reveal (`reveal`) and **background music** (`music`, looping across all scenes, fades in, honours mute). `src/audio/README.md` added. |
| `c87cad7` | The shovel follows the mouse cursor; `Space` digs at the cursor. |
| `ea1bbc8` | **Progression, goals, a working store and rewarded ads**: buying tools and upgrades changes the game, prospector level and XP, three endless goals with onboarding that leads to the store, the goal pill and goals card, progress saved to `localStorage` (`?reset` clears it), CrazyGames rewarded ads (refill stamina, sell for double, double the day, free cash, midgame break) and `npm run build:crazygames`. The store list got a scissor camera (3 fps to 48 fps). |
| `8912495` | **Ten layers** (new: Fossil Bed, Buried Ruins, Frozen Cavern, Magma Veins, Heart of the Earth) with new strata art and a value multiplier per layer. **Curios**: 54 at the time (57 now), the silhouette-and-burst reveal, the curio card, cash and XP, a goal type, milestone bonuses every 5 finds, and the **collection** screen (album button / `C`). Workshop usable from the first rock, aim shadow under the shovel, haptics on phones. |
| `3fa674b` | **Balance pass** from a headless simulation: weak tools fall off steeply (`efficiency^1.4`, floor 0.05), hardness about 1.8x, new tool prices, upgrades to 8 levels with steeper prices, softer stamina-regen and swing-speed gains, XP curve `60 x L^1.5`, level bonus `15 x L`, curio odds by depth and an even spread over categories, three more mythic curios, a slightly lower curio rate (about 2.5-3 per day). |
| `692e9dd` | **Relocation to a new deposit at bedrock** (+40% hardness, +50% value, +4% tool power, cash bonus, named and tinted deposits) and the endless **Master Digger** upgrade. Layer-entry XP paid once per deposit. Relocate card, deposit line on the goals card, 20 s prompt cool-down. Saved with the progress. |
| `1b2645a` | **Minimal text everywhere** (pictures and numbers replace words in the HUD, store, goals, collection, curios, workshop, end-of-day, relocate card and banners). **New touch model** (tap digs on release, press digs while held, drag scrolls 1:1 with a glide, second finger ignored). Fewer particles and softer shake on phones, no per-frame text redraw. |
| `93351b1` | **Hand-illustrated world** (`ScenicArt.ts`, new `SurfaceArt.ts`): cottage, storybook tree, woodpile, barrel, signpost, mine head-frame with an ore cart of gems, layered cut-paper ridges with parallax, washed sky, sun beams, flat-bottomed clouds, richer soil (sediment bands, lithology marks, worms, ant tunnels, mushrooms). New painted star and saw icons. Quieter HUD: bigger coin; the on-screen clock, tool badge and dig-streak popup removed. |
| `a4b140d` | `soil-level-up.mp3` replaces the layer-enter cue; `rock-under-15.mp3` plays for reveals worth under $15 (the synthesized dud sting is retired). |
| `b1198d1` | **Rye** font replaces Fredoka everywhere; the supplied pickaxe gold coin `assets/ui/coin.png` replaces the painted dollar coin. |
| `fe5984e` | Merge of the Dig & Discover branch into `main`. Alongside the game the friend also added the site files `public/arcade/dig-and-discover/*`, an entry in `data/seed/playables.ts` and a sort tweak in `lib/content/queries.ts`. |

**New source files** (not in our earlier version): `src/ads/Portal.ts`; `src/art/CurioArt.ts`, `IconArt.ts`, `ScenicArt.ts`, `StoreArt.ts`; `src/audio/README.md` and `src/audio/samples/*.mp3`; `src/assets/ui/coin.png` and the two `assets/*/README.md` files; `src/data/curios.ts`, `deposits.ts`, `goals.ts`, `store.ts`; `src/scenes/CollectionScene.ts`, `GoalsScene.ts`, `RelocateScene.ts`, `StoreScene.ts`; `src/systems/CurioSystem.ts`, `ProgressSystem.ts`; `src/ui/CurioCard.ts`, `GoalPill.ts`; `postcss.config.mjs`. **Removed:** `src/ui/ClockPill.ts`, `src/ui/ToolChip.ts`.

**Our earlier work is still in it:** forced cutting at closing time (`canCut`, `rocksLeft`, `closingTripDelayMs`), the scroll-based camera (`focusY`, wheel, keys, touch, "Back to the hole"), and aim assist. The friend's own copy of this document and of `README.md` had not been updated for any of the new content, so both were rewritten after the import.

---

## 11. Rock-first update (finished 2026-11-15)

The user asked to pull the game back to its core loop: **dig -> find rocks -> cut them -> reveal -> sell**, with rocks as the only reliable income, plus a richer discovery system and a family-finance pressure layer. Phases: 1 restore the core, 2 discovery, 3 finance, 4 test and balance. Everything below is merged into `main` of the local scratch repo and type-checks, builds (`npm run build`) and was looked at in the browser where noted.

### What changed
- **Clock restored** at the top centre of the HUD (`src/ui/ClockPill.ts`): day number, 7:00 AM to 5:00 PM, a thin progress bar. Time still advances from real elapsed milliseconds (frame time capped at 100 ms) and freezes while a card is open. Under 520 px wide it moves to its own row under the goal pill (otherwise the money pill and three buttons cover it); on wider screens it stays top centre and is pushed right when the money pill grows. The money pill itself shrinks its text when a huge amount would run under the buttons.
- **Separate rock scales** in `GAME_CONFIG.rock`: `discoveryScale 0.58` (rocks in the ground), `inventoryScale 0.74` (bag slots), `workshopScale 1.6` (unchanged, the workbench keeps its size).
- **No cash from collectibles or junk.** Nothing a swing digs up besides rocks pays money. Artifacts pay only when sold (see Finds). Cash still comes from rock sales, goal rewards, level-up bonuses, relocation bonuses and ads (the friend's systems).
- **Rock catalogue**: 43 minerals (13 old, 30 new fictional) in `data/minerals.ts` with `minLayer` depth gating and a `reveal` effect style, a **Worthless** rarity (value exactly $0, about 5-9 percent of rocks, six weights per layer in `data/layers.ts`), 12 new interior painters, 5 new exteriors. A worthless rock is cut without a celebration, the sell button turns into a bin icon and the sale shows a grey "$0". Preview page `dev/rocks-preview.html`.
- **Painted icons, no emoji.** `art/UiIcons.ts` has 41 icons (`uiIcon('cash')`). Every HUD, workshop, dig, store, goals, relocate, goal-pill, find and end-of-day element uses them. A search of `src/**/*.ts` finds no emoji, no `\u` escape and no non-ASCII character. Contact sheet `dev/icons-sheet.html`.
- **Finds** (see the "Finds" section in 2): 71 painted finds replace the 57 emoji curios. New `FindCard`, new Finds screen, `sellArtifact` / `sellAllArtifacts`, saved in the save file. The old curio files (`data/curios.ts`, `CurioSystem`, `CurioArt`, `CurioCard`, `assets/curios`) were deleted.
- **Finances** (see "The household and the debt" in 2): `data/economy.ts`, `systems/FinanceSystem.ts`, `LedgerScene`, `GameOverScene`, a rebuilt end-of-day card (itemised bills, carried bills, debt, deadline, pay button, START, 2x ad), a ledger chip under the top bar, key `L`, full `resetRun()`.

### Economy numbers and how they were checked
Household bill $80 a day in month 1 (x1.4 a month), debt $250,000, instalment $2,500 every 7 days in month 1 (x2.4 a month), 30-day months. `dev/econ-sim.ts` (a bot that digs, cuts and buys tools every evening; run with `npx esbuild dev/econ-sim.ts --bundle --platform=node --format=cjs --outfile=%TEMP%/econ-sim.cjs` then `node`, env `SKILL`, `SKILLS`, `INST`, `INSTG`, `EXP`, `EXPG`, `DAYS`) shows income snowballing from about $265 a day on days 1-3 to thousands from day 4-10 because of the friend's tool progression, so only month 1 is tight: a player who never upgrades loses, one who plays at 25 percent of the bot's efficiency survives 83 percent of the time, 35 percent and above always survive. It models the progression, not a human: **a real play-test of the first month is still the thing to do before trusting the balance.** `dev/finance-sim.ts` (pure `FinanceSystem` checks, 20 checks) passes.

### What was tested (by me, in the Browser pane)
- At 375x812: a real dig, a rock found, cut, revealed (Amethyst Geode, $38) and sold; the end-of-day card with itemised bills ($38 paid, $42 carried to the next day); the ledger (key `L`, closes with Esc); paying carried bills first; store open, upgrade purchase ($200 for Bigger Tank, next level $310); goals card; relocation card; the HUD clock and money pill layout (including $1.2 million).
- Game Over: forced by a debt left overdue on day 30, the reason text and stats, that Space, Enter, L, S, G, C and Esc do nothing there, and that a reload keeps the Game Over screen. Restart: full reset (money, day, debt, upgrades, XP and level, depth, bag, tool, finds) and the game playable again.
- Month rollover: with no debt overdue on day 30 the next month starts (month 2, instalment $6,000, daily bills about $112).
- Finds: one of each kind forced into the ground and dug out (card, silhouette "?" colours, no cash, money stayed $0), the Finds screen (three tabs, silhouettes, story line, paging, Sell, Sell all, money counting up), save and reload, restart clears them.
- Not exercised: a long real play session over several days and weeks, ads (mock ad), relocation purchase, behaviour on a real phone, performance with many finds, and the balance with a human player.

### Known gaps and notes
- Finds are rare (about 2.3 percent of swings in total), so a short session may show none; they were forced in tests. The per-swing chances are in `FIND_CONFIG` and can be raised.
- Level-up bonuses and relocation bonuses still pay cash that does not come from selling rocks (friend's design; finds give XP, which can lead to a level-up).
- Unpaid household bills never end the run by themselves (only overdue debt does), as specified; `Pay what is due` clears them.
- The CrazyGames build and the website copy in `public/arcade/dig-and-discover/` were NOT rebuilt or pushed. Nothing from this update is pushed to GitHub.

### How this update was built
A local scratch git repo lives in this folder (branch `main`, never pushed). Work was split between me (manager) and OpenCode workers in git worktrees under `D:\WebGames\_workers\` (`rocks`, `finance`, `finds`, `icons`, `iconwire`, `findwire`). The MiniMax free tier ran out mid-way, so the later workers used `omniroute/coding-fallback`; the finds worker was slow and left GameState / ProgressSystem done, so I finished DigScene, the find card, the Finds screen and the HUD wiring myself. Each worker branch was reviewed (type-check, build, browser) before merging. When pushing to GitHub, copy without `.git`.
