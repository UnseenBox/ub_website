# BONK! — Recovery & Improvement Master Plan (for Claude Sonnet)

Status: audit complete, nothing implemented. Written 2026-11-12 against the repository at
`D:\UnseenBox\everything-is-a-weapon`. **Revision 2 (same day):** re-verified against HEAD `901dc37`
plus the current uncommitted working tree; corrections are marked **[REV2]** (see 0.2, C1b, C3c, T0.1,
T1.2) and three appendices were added (A system map, B analytics coverage matrix, C baseline and
experiment plan).

How to read this document: every claim is labelled **CONFIRMED** (I read the code, ran a tool, or
did arithmetic on numbers you gave me) or **HYPOTHESIS** (plausible, not yet provable with the
data we have). Every file path below was opened or listed during the audit.

---------------------------------------------------------------------------------------------------

## PART 0 — Evidence base, limits, and one warning

### 0.1 What I could and could not see
* I received the analytics as **numbers in your message**. The three screenshots themselves did not
  reach me, so I could not check dashboard definitions, date ranges, or segment filters. Every
  funnel conclusion below uses only the numbers you typed.
* I did not play the game on a phone, did not test on the CrazyGames QA tool, and have no access to
  the CrazyGames game page (title, screenshots, description as published). Store-page findings are
  hypotheses until compared with the live page.
* I inspected: `package.json`, `vite.config.ts`, `src/main.ts`, `src/platform/*`,
  `src/analytics/AnalyticsManager.ts`, `src/core/Game.ts` (start-up, room flow, analytics calls),
  `src/core/constants.ts`, `src/gameplay/{Room,RoomDefinitions,RoomGenerator,Tutorial,Edges,
  NightShift,Campaign,Run,Endless,Incidents,Abilities}.ts`, `src/entities/EnemyTypes.ts`,
  `src/input/TouchInput.ts`, `src/ui/screens/{hud,lobby,characters}.ts`, `src/interactions/*Rules.ts`
  (rule ids), `src/hazards/Zone.ts`, `covers/cover-landscape-1920x1080.png`, `CRAZYGAMES.md`,
  the built `dist-crazygames/index.html`, and ran `tsc` and the test suite.
* Baseline health (**[REV2] re-run on the current working tree: tsc exit 0; 39 files passed, 1 skipped**):
  `npx tsc --noEmit` clean; `npx vitest run` = **293 passed, 1 skipped** (the skipped
  one is the opt-in balance bot, `BALANCE=1 npx vitest run src/balance`).

### 0.2 WARNING — the working tree is not clean and someone else is editing it  [REV2]
**[REV2]** The menu animation pass is now committed (`901dc37`). What is still **uncommitted**
(27 modified files + new files) is the owner's **"Night Shift" effort**, documented in
`docs/superpowers/plans/2026-11-11-bonk-night-shift.md`:
* **P = POWER, Esc = pause** (`src/input/KeyboardMouseInput.ts`, `InputManager.ts`, `Abilities.ts`).
* **Action-first room 1**: `Tutorial.LESSONS = ['throw','power','free']`, pan equipped at spawn
  (`Player.equip`), movers 1 / 2 / 5 (`src/gameplay/Tutorial.ts`, `RoomDefinitions.ts`).
* **Branching run with doors**: `src/gameplay/NightShift.ts` (**untracked, new**),
  `src/ui/screens/doors.ts`, `src/ui-kit/bonk2/doors.css` (**untracked, new**), plus `Run.ts`,
  `SaveManager.ts` (`runDoors`, `runPath`, `runSeed`, `runArmor`), `Game.openDoors/chooseDoor`.
Consequence: **HEAD alone does not contain doors.** Everything this plan says about doors, the
tutorial and P-key power describes the working tree, not a commit.

Sonnet must start with `git status`. **Precondition: the owner commits (or tags) the Night Shift work
first.** Sonnet must not revert, reformat or "tidy" those edits, and must work on a new branch
(`git switch -c bonk-recovery`). If the owner has not committed them, stop after reading and ask.
Tasks that touch the same files are flagged **[CONFLICT-RISK]**.

---------------------------------------------------------------------------------------------------

## PART 1 — Executive diagnosis

### 1.1 The funnel, with arithmetic (all CONFIRMED arithmetic on your numbers)

| Step | Count | Step conversion | Reading |
|---|---|---|---|
| Impressions | 183,000 | – | |
| Visited | 1,743 | 0.9% CTR (183K x 0.9% = ~1,650, matches) | **The volume ceiling.** |
| Loading started | 520 | **29.8%** of visits | 70% never start loading. |
| Playing started | 473 | 91% of loading | Loading itself loses only ~9% overall. |
| Played 1 min | 258 | **54.5%** of playing | **45% of people who got control quit inside a minute.** |
| Played 10 min | 38 | 14.7% of the 1-min group | |
| Played 30 min | 10 | 26% of the 10-min group | |
| Played 60 min | 3 | 30% of the 30-min group | |

* "Gameplay conversion 14.80%" is exactly 258 / 1,743, i.e. **1-minute plays divided by visits**.
  So the desktop 39.64% and mobile 9.39% figures use a **different denominator** (probably loaded or
  started players). Do not average them; do not compare them to 14.80%. (HYPOTHESIS about which
  denominator; the 14.80% match is CONFIRMED.)
* D1 retention 0.75% desktop / 1.16% mobile on ~400 players is **3 to 5 people**. It is real as a
  direction (it is very low) but statistically meaningless as a number. 430 total plays is far too
  little to A/B test anything small. Decisions must lean on code facts and large effects.
* Pattern: people who survive the first minute and reach 10 minutes mostly keep going (26-30% step
  conversion later). The leak is **before** the hook, not after it. That points at: the store page,
  the first minute, and mobile start-up cost. It does **not** point at "not enough content".

### 1.2 Confirmed findings (code and artefacts)

| ID | Finding | Evidence |
|---|---|---|
| C1 | **Production analytics goes nowhere.** `AnalyticsManager` only gets a console sink in DEV; nothing ever calls `addSink`. All ~30 event types (`first_input`, `first_throw`, `room_fail`...) are discarded in production. | `src/analytics/AnalyticsManager.ts` (constructor adds `ConsoleSink` only `if (import.meta.env.DEV)`); `grep addSink src` returns only the definition. |
| C1b **[REV2]** | **11 of the 34 declared event names are never emitted anywhere**: `run_start, run_continue, run_end, edge_offer, edge_pick, boss_arrive, boss_defeat, daily_start, daily_clear, ledger_claim, tutorial_skip`. They exist only in the `AnalyticsEventName` union. Emitted today (20): `game_start, room_start, room_complete, room_fail, first_input, first_grab, first_throw, first_hit, first_clear, object_grab, object_throw, object_break, enemy_defeat, chain_reaction, new_discovery, heat_tier, hero_unlock, challenge_complete, daily_complete, endless_over` (+ `session_end` on `pagehide`). So run-level, boss-level and Edge-level behaviour is not even *instrumented*, let alone collected. | `grep -rn "'<name>'" src` per name; only `src/core/Game.ts` emits (lines ~678, 1215, 1249, 1283, 1636). |
| C2 | **The CrazyGames build is 7.27 MB, 3.3x what the docs claim (2.2 MB).** 6.0 MB of it is base64 PNG. Four hero portraits (`src/assets/characters/{tenant,gran,kid,flatmate}.png`, 1064x1064 px, 0.71 to 1.06 MB each, ~5.0 MB once base64'd) are imported in `src/ui/screens/characters.ts` and displayed at <=360 px. | `dist-crazygames/index.html` = 7,269,530 bytes; scripted count of `data:image/png` = 6.01 MB; `CRAZYGAMES.md` says "about 2.2 MB". |
| C3 | **Every announcement banner is switched off**, including the ones that explain boss rules. `ANNOUNCEMENTS_VISIBLE = false` makes `hud.banner()` and `hud.incoming()` return immediately. It was a deliberate choice (commit `2d57b9a` "no announcement cards"). Floating `game.popup()` text still works (`TEXT_VISIBLE = true`). | `src/core/constants.ts`, `src/ui/screens/hud.ts` lines ~290 and ~313. |
| C3b | **Self-disclosure:** the 15 boss scripts I wrote in `src/entities/bossScripts/*.ts` teach their one core rule through `game.hud.banner(...)` ("BLOCK THE TRACK", "CUT THE CABLES", "RIDE THE WIND", "WATCH THE GAUGE", "MIND THE FUSE"...). **Those never appear on screen.** Earlier in this project I described them as visible. They are not. Only taunts (popups) and drawn telegraphs reach the player. | same flag; `grep "hud.banner" src/entities/bossScripts`. |
| C3c **[REV2]** | **The door-reward feedback is also swallowed.** `Game.chooseDoor` (src/core/Game.ts ~line 849) announces the reward through `hud.banner(door.reward.label, door.reward.detail, 2.2)`, which returns immediately while `ANNOUNCEMENTS_VISIBLE=false`. The player picks a door, an Edge/armour/scrap is silently applied (`applyDoorReward`), and nothing says what they got. Also `shouldOfferEdge()` (src/gameplay/Edges.ts:106) now has **no caller outside its own test**: the separate Edge-offer screen has been replaced by the door's Edge reward. | `src/core/Game.ts` `chooseDoor` / `applyDoorReward`; `grep -rn shouldOfferEdge src`. |
| C4 | **Only one non-extermination objective exists**, `'survive'`, and only in *generated* rooms. 41 of 50 campaign rooms are generated. | `src/gameplay/Room.ts` (`RoomObjective`), `src/gameplay/RoomGenerator.ts` ~line 641. |
| C5 | **The generator uses 4 of 17 hazard zone kinds** (`water`, `oil`, `fire`, `electric`). `ZoneKind` also defines `glass, foam, dirt, mud, wind, flour, slick, paint, trap, magnet, music, feathers, steam`, and the interaction rule files already contain rules for several (`magnet_pull`, `music_dance`, `steam_blind`, `feathers_fire`, `mousetrap_snap`...). Generated rooms therefore feel alike. | `src/hazards/Zone.ts`, `grep "kind:" src/gameplay/RoomGenerator.ts`, rule ids in `src/interactions/GadgetRules.ts`. |
| C6 | **All 11 Edges are stat or flag modifiers** (+25% damage, +12% speed, +20% scrap, one-time save...). None changes how you throw, grab, dodge or fight. | `src/gameplay/Edges.ts` (`EDGES`). The 3 hero powers are in `src/gameplay/Abilities.ts` (`blast`, `overdrive`, `freeze`). |
| C7 | **Room 1 uses one enemy type** (8 identical `basic` movers on a delay schedule 0.2 / 8 / 9 / 16 / 22 / 28 / 31 / 34 s) while the game has 14 mover types including `kaboom` (explodes on defeat), `fragile` (glass), `nested` (splits), `trolley` (long charge), `hurler`, `gnat`. | `src/gameplay/RoomDefinitions.ts` room-1; `src/entities/EnemyTypes.ts`. (Delays are the **committed** values; the working tree gates release by lesson, see 0.2.) |
| C8 | **First visit goes straight into room 1 with no menu** (good). Returning players get the lobby. | `Game.start()` in `src/core/Game.ts` (~line 380-390). |
| C9 | **The CrazyGames cover is calm and static.** Four sleepy heroes stand in a row, the movers sit at the edges, nothing is thrown, nothing collides, no motion cue. It sells "cute lineup", not "throw the furniture". | I viewed `covers/cover-landscape-1920x1080.png`. |
| C10 | **Interaction depth already exists.** ~79 interaction rules (`src/interactions/{HouseRules,GadgetRules,MoreRules}.ts`), 77 objects, chain-reaction tracking (`src/gameplay/Chain.ts`), fixed-step 120 Hz custom physics (`src/physics/*`, `FIXED_DT = 1/120`). The problem is **exposure**, not missing mechanics. | files named. |
| C11 | Bosses: handcrafted room 2 already ends in a boss (`boss: 'chairman'` in `RoomDefinitions.ts`), and the default is a boss every third room (comment on `RoomDefinition.boss` in `Room.ts`). A first-session player meets a boss in about 3 to 4 minutes, which is roughly the average playtime you measured. | `RoomDefinitions.ts`, `Room.ts`. |
| C12 | `portal.loadingStart()` is called only after `await portal.init()` (`src/main.ts` lines 64-65). Minor: the player-visible loading is dominated by downloading the 7.27 MB file before any JS runs, which this call cannot see. | `src/main.ts`. |
| C13 | Legacy shim files `src/ui/{HUD,MainMenu,PauseMenu,ResultsScreen}.ts` are 1-line re-exports. Harmless; leave them. | file reads. |

### 1.3 Hypotheses (cannot be proven with current data)
* **H1 (strong):** the 45% first-minute drop comes from a slow, repetitive, low-spectacle opening:
  one weapon, identical enemies arriving 8 to 34 s apart, a long staged tutorial. (Another session is
  already shortening it, which supports this.)
* **H2 (medium):** the 0.9% CTR and 70% visit-to-loading loss are page-level: a calm cover (C9), a long
  title, and no motion/preview that shows the throw-and-chain hook.
* **H3 (medium):** mobile's 9.39% conversion is partly start-up cost (C2 on cellular), partly controls
  and layout, partly the portrait/rotate friction. We cannot separate them without per-device
  load-time and first-input timings (needs C1 fixed).
* **H4 (medium):** D1 is ~1% because session 1 ends in a flat spot (room 2 boss spike or
  repetition) with no pull-forward ("I want to see what the next door/Edge does").
* **H5 (weak):** the 4-minute average playtime is "room 1 + room 2 boss + quit". The balance bot
  cannot judge boss rooms, so we do not know.

### 1.4 The five highest-impact changes (ordered by expected impact x confidence)
1. **Rebuild the first 90 seconds** (Part 4). Targets the 45% first-minute leak (H1).
2. **Cut the download from 7.3 MB to ~2.5 MB** (task T0.2). Targets mobile and slow connections (H3); it
   is also nearly free and nearly risk-free.
3. **New store assets: action cover, real-play screenshots, a 15 s preview GIF/video** (Part 7). Targets CTR and
   visit-to-loading (H2). External to the code.
4. **Make measurement real** (T0.1): a funnel log we can read, because we cannot manage what is
   discarded (C1).
5. **Make the rules readable and the build choices matter**: a compact rule hint (C3) and behaviour-changing Edges (C6) so
   run 2 and run 3 feel different from run 1 (H4).

Things I deliberately do **not** recommend: more bosses, more rooms, more heroes, more currencies.
The 50 rooms, 20+ bosses and 77 objects are under-used, not under-supplied.

---------------------------------------------------------------------------------------------------

## PART 2 — Target game experience

* **Fantasy:** you are a tired tenant in a pink dressing gown who turns a bedroom into a pinball
  table. The joy is **"I set that up and it went off"** (a thrown bottle fries three movers), not
  "I hit the red box 4 times".
* **First session (target 6-10 min):**
  0-5 s control, a mover already walking in. 5-20 s first throw lands with weight. 20-40 s first
  **room trick** (water + socket, multi-kill) that the player *causes*. 40-75 s climax (explosive mover
  + chain). 75-90 s clear, stars, one clear reward, one clear next step. Then 2-3 rooms that each
  ask a **different question** (Part 5). Session ends on a "one more room" beat, not a menu wall.
* **Replay loop:** run -> pick Edges that change *how* you play -> try a different route/door ->
  daily room with a shared seed -> unlock a hero. Build identity comes from behaviour Edges
  (ricochet, shockwave, boomerang), not from percentages.
* **Long-term motivation (already in the code, keep):** star ledger (`StarLedger.ts`), heroes
  (`HeroUnlocks.ts`), daily streak (`DailyStreak.ts`), endless (`Endless.ts`), discoveries (166).
  The plan adds no new currency.
* **Design principles for every task:** fun before complexity; no new text walls; no dark patterns
  (no fake urgency, no loss-aversion streak punishment beyond what `DailyStreak.ts` already does);
  keep the ink-and-ransom-note personality; keep camera shake and particle clutter low (the owner
  complained about both; `ParticleSystem` already has `EMIT_SCALE = 0.5`, `Camera` has shake damping).

---------------------------------------------------------------------------------------------------

## PART 3 — Implementation roadmap

Priority key: **P0** broken/blind/blocking, **P1** first-session conversion & early retention,
**P2** depth & variety, **P3** long-term. Complexity S (<0.5 day), M (1-2 days), L (3+ days).
Regression risk L/M/H. "Independent" means it can be built and shipped without the other tasks.

Execution order: T0.1 -> T0.2 -> T0.3 -> T1.1 -> T1.2 -> T1.3 -> T1.4 -> M1..M4 -> T2.1 -> T2.2 -> T2.3 -> T2.4 -> T2.5 -> P3.

### PHASE 0 — Measure and unblock (P0)

#### T0.1 — Make the funnel measurable [P0, M, risk L, independent]
* **Problem:** C1: no production sink, so nothing the game "tracks" can be read.
* **Files:** `src/analytics/AnalyticsManager.ts`; new `src/analytics/FunnelLog.ts`;
  `src/main.ts`; `src/core/Game.ts` (existing `analytics.track` calls at the `game_start`,
  `room_start`, `first_*`, `room_complete`, `room_fail` sites); `src/ui/screens/settings.ts`;
  `src/platform/CrazyGamesPortal.ts` (`setContext`).
* **Current:** `AnalyticsManager.track()` loops over `sinks[]`, which is empty in production.
* **Required:**
  1. New `FunnelLog implements AnalyticsSink`. It keeps, in `window.localStorage` under its **own key**
     `bonk/funnel/v1` (NOT in the save, so no save migration and no CrazyGames data-module sync):
     * counters by event name, a ring buffer of the last 200 events `{t, name, params}`,
     * a per-device `sessionIndex`, `firstSeenDay`, `lastSeenDay`, and per-session timestamps,
     * write throttled to at most once per 2 s and on `pagehide`.
  2. Register it in the `Game` constructor (or `main.ts`) in **all** builds, wrapped in try/catch
     (storage can throw in private mode).
  3. Add these events to `AnalyticsEventName` and emit them (names are final):
     `boot` {ms since navigation start via `performance.now()`, `portal`, `touch: boolean`, `dpr`},
     `gameplay_first` {ms since boot}, `first_input` (exists), `first_grab` (exists),
     `first_throw` (exists), `first_kill` {ms}, `first_chain` {ms, length} (hook the `CHAIN` bus
     event, `Game.ts` ~line 1901), `room_end` {room, outcome:'clear'|'fail'|'quit', seconds, hits_taken,
     kills, hazard_kills}, `death_cause` {room, cause} (Player.hurt already receives a cause string:
     the balance bot reads it from `PLAYER_HIT`, reuse that), `door_pick` {index, rewardKind, risk}
     (emit from `Game.chooseDoor`), `session_resume` {daysSinceLast}.
     **[REV2] Declared in the union but never emitted — wire these, do not re-declare:**
     `run_start` / `run_continue` (Game run start and the `save.runDoors.length > 0` resume path),
     `run_end` {outcome, rooms, score} (run clear / run fail), `edge_pick` {id, stacks} (inside
     `applyDoorReward`, Edge branch; `edge_offer` can be dropped because the offer screen no longer
     exists, see C3c), `boss_arrive` / `boss_defeat` {boss, seconds}, `daily_start` / `daily_clear`,
     `ledger_claim`, `tutorial_skip`.
  4. `perfSample` event every 30 s of play: `{fpsAvg, fpsP5, particles}` computed from the render loop
     (`src/core/GameLoop.ts`) so mobile performance becomes visible (see M2).
  5. Settings screen: a tiny "COPY DIAGNOSTICS" button (visible to everyone, harmless) that copies
     `JSON.stringify(funnel summary)` to the clipboard, so testers and friends can send you real
     numbers. No network calls.
  6. Optional, **off by default**: `HttpSink` posting batched events to `import.meta.env.VITE_ANALYTICS_URL`
     if defined. **Do not enable it for the CrazyGames build** until the owner has confirmed with
     CrazyGames that third-party analytics requests are allowed (I could not verify this; treat as a
     blocker question, not a default).
* **Acceptance:** in a production build (`npm run build:crazygames`, open `dist-crazygames/index.html`
  locally) playing room 1 produces a readable `bonk/funnel/v1` with `boot`, `gameplay_first`,
  `first_input/grab/throw/kill`, `room_end`; `JSON.parse` succeeds; storage failure does not throw
  (unit test with a throwing `Storage`).
* **Regression tests:** `src/analytics/FunnelLog.test.ts` (ring buffer cap, throttling, throwing
  storage, event counters); existing `Game.*-flow.test.ts` must still pass.
* **Success metric:** after one week of play we can state first-input, first-throw, first-kill and
  room-1 clear **medians** for desktop vs touch from diagnostics sent by testers; and CrazyGames'
  own dashboard keeps being the aggregate source.

#### T0.2 — Cut the download from 7.27 MB to <= 2.6 MB [P0, S, risk L, independent]
* **Problem:** C2.
* **Files:** `src/assets/characters/{tenant,gran,kid,flatmate}.png` -> `.webp`;
  `src/ui/screens/characters.ts` (4 imports, lines 5-8); `scripts/` (new
  `optimize-assets.py`); `CRAZYGAMES.md`; new `scripts/check-bundle-size.mjs`;
  `package.json` (`build:crazygames` post-step).
* **Required:**
  1. Pillow 12.1 is available in this environment (`python -c "import PIL"` worked). Write
     `scripts/optimize-assets.py` that resizes each hero PNG to **640 px longest side** and saves WebP
     quality 82 (expect ~40-70 KB each). Keep aspect ratio and transparency (RGBA).
  2. Replace the four imports with the `.webp` files; delete the PNGs only after the build is
     verified (keep them out of `src/`; archive under `assets/` if you want the originals).
  3. Audit the remaining base64 PNGs (largest after the heroes: 153 KB, 98 KB, 93 KB, 78 KB...) and
     convert any over ~60 KB that is not pixel-art to WebP.
  4. `check-bundle-size.mjs`: fail the build if `dist-crazygames/index.html` > 3,000,000 bytes (warn at
     2,600,000). Add it after `vite build` in the `build:crazygames` script.
  5. Fix the stale "about 2.2 MB" sentence in `CRAZYGAMES.md` with the real number.
* **Acceptance:** `dist-crazygames/index.html` <= 2.6 MB; the character screen and lobby render
  heroes identically at 1x and 2x (visual check at 360 px and 700 px height); no new console errors.
* **Regression tests:** `src/ui/screens/characters.test.ts` and `lobby.test.ts` pass;
  `tests/Game.prod-bundle.test.ts` pass; bundle-size script has a failing-case test.
* **Metric:** loading time (`boot` -> `gameplay_first`) on a throttled "Fast 3G" profile in Chrome
  DevTools before vs after: record both in the PR. Expect roughly 2.8x less to download.

#### T0.3 — A compact rule hint, because banners are off [P0/P1, S, risk L, **[CONFLICT-RISK]** hud.ts]
* **Problem:** C3 / C3b: boss rules and tutorial hints go through suppressed banners.
* **Decision:** do **not** flip `ANNOUNCEMENTS_VISIBLE` (a deliberate owner decision to remove big
  covering cards). Add a different, small thing.
* **Files:** `src/ui/screens/hud.ts` (new `hint(text, seconds)` next to `banner()`),
  `src/ui/UI.ts` (delegate `hint`), `src/ui-kit/bonk2/hud.css` (`.b2-hint`),
  `src/entities/bossScripts/*.ts` (15 files; mechanical change), `src/save/SaveManager.ts`
  (`hintsSeen: string[]`, default `[]`, sanitised).
* **Required:**
  1. `hint(text)`: one line, top-centre under the status chips, max width 70%, ~2.8 s, ink-outlined like
     the existing chips, `pointer-events: none`, never more than one at a time (a new hint replaces
     the old). Respects `prefers-reduced-motion`.
  2. In each boss script replace `game.hud.banner(A, B, s)` with `game.hud.hint(\`${A}: ${B}\`, s)` where
     `B` is non-empty (the rule). Pure-flavour banners (`B` empty, e.g. "BOILING OVER") become no-ops.
  2b. **[REV2]** Also route `Game.chooseDoor`'s reward announcement (`hud.banner(door.reward.label,
     door.reward.detail, 2.2)`, src/core/Game.ts ~line 849) through `hud.hint(...)`, so the player is told
     what the door gave them (C3c). Same for any other `hud.banner` call that carries *information*
     rather than flavour: `grep -n "hud.banner" src --include=*.ts` and triage each.
  3. Show each boss's **rule hint only the first time** the player meets that boss, stored as
     `hintsSeen: ['boss:train', ...]`. After that the telegraphs carry the fight.
* **Acceptance:** first meeting with Midnight Express shows "BLOCK THE TRACK: put something heavy on
  the rails to derail him" once; second meeting shows nothing. No banner box appears anywhere.
* **Tests:** extend `src/ui/screens/results.test.ts`-style DOM test: `hint()` renders, replaces, expires;
  `SaveManager.test.ts`: old saves without `hintsSeen` load.

### PHASE 1 — The first 90 seconds (P1)

#### T1.1 — Room 1 as a spectacle, not a lesson [P1, L, risk M, **[CONFLICT-RISK]** RoomDefinitions.ts / Tutorial.ts / Game.tutorial-flow.test.ts]
* **Problem:** H1 / C7. Full blueprint is **Part 4**. Summary: the committed room-1 data has 8 identical
  movers over ~34 s plus 7 lessons; the in-progress working tree already cuts the lessons to
  `throw -> power -> free`. Build on that, do not fight it. Coordinate with whoever owns it.
* **Files:** `src/gameplay/RoomDefinitions.ts` (room-1 block), `src/gameplay/Tutorial.ts`
  (`LESSONS`, `MOVERS`, the `free` step), `src/core/Game.tutorial-flow.test.ts`,
  `src/gameplay/Room.ts` only if a new spec field is needed (avoid).
* **Acceptance:** Part 4 acceptance list. Bot clear time for room 1 between 60 and 100 s.
* **Metric:** `first_throw` <= 12 s median, `first_kill` <= 20 s, `first_chain` <= 45 s, 1-minute
  retention (CrazyGames "Played 1 minute" / "Playing started") moves above the current 54.5%.

#### T1.2 — The reward and the next step after room 1 [P1, S, risk M, **[CONFLICT-RISK]** results.ts, Game.ts]
* **[REV2] Problem (corrected):** in the working tree the flow after room 1 is results card -> **three
  door cards** (`Game.openDoors` -> `hud.showDoors`, `src/ui/screens/doors.ts`,
  `src/gameplay/NightShift.ts` `buildDoors`) -> `chooseDoor` -> next room. There is **no separate Edge
  offer any more** (C3c): an Edge is one of the door reward kinds (`scrap | edge | armor`). HYPOTHESES:
  (a) the first doors screen is the player's first real decision and may overwhelm a newcomer;
  (b) because `chooseDoor`'s reward banner is suppressed, the player cannot tell what a door gave them
  (fixed by T0.3 item 2b). Door 1 of the first run should therefore be explained by its card alone.
* **Required (read first, then decide; experiment behind one boolean `FIRST_RUN_GENTLE` in
  `src/core/constants.ts`, default off until the owner has playtested):** open `NightShift.ts`
  `buildDoor/buildDoors` and `doors.ts`. For the first-ever run, step 0, make all three doors
  low-risk (no boss/hazard risk tag) with reward kinds shown by icon + one word, and guarantee one of
  them is an Edge (`heavy_hands`). Everything else unchanged. Do **not** reintroduce an Edge-offer screen.
* **Acceptance:** first-ever clear -> one results card -> three doors with no risk tag, one of
  them an Edge; after picking, a hint names the reward. Second and later runs unchanged (unit test on
  `buildDoors` with a "first run" flag and a regression test that normal runs are byte-identical).
* **Metric:** `room_end` for room 2 reached by >X% of room-1 clears (compare before/after in
  diagnostics). Because traffic is tiny, decide by code review plus tester observation, not statistics.

#### T1.3 — Impact and clear feedback budget [P1, S, risk L, independent]
* **Problem:** the final kill and the room clear should be the loudest moment, without more shake or
  particles.
* **Files:** `src/core/Game.ts` (`completeRoom`, `hitStop`, `popup`), `src/rendering/Camera.ts`,
  `src/audio/AudioManager.ts`.
* **Required:** (a) on the **last enemy kill of any room**: `hitStop(0.12)`, 0.35 s time-scale dip to 0.4
  (use the existing `timeScale()` hook in `Game.ts`), one `popup('CLEAR', ...)`, the existing
  `roomClear` sound; (b) on the **first multi-kill of a run** (>=2 kills from one cause): one-time
  popup "x2 / x3" in a larger size; (c) do **not** raise shake or particle caps. Budget: camera shake
  amplitude never above current `addShake(0.45)` used by `Player.hurt`.
* **Acceptance:** recorded clip shows the last kill reads clearly; `settings.reducedShake` still
  reduces to 0.2x; frame time unchanged (see M2).

#### T1.4 — Fix the first-input -> first-throw path [P1, S, risk L, independent]
* **Problem:** H1: time from control to first satisfying hit. In the committed Room 1 the pan is 220 px
  from the spawn ("far enough that getting it means walking"); the working tree puts it in hand.
* **Required:** keep the pan in hand at spawn (as the working tree does), first mover enters at
  <= 1.0 s, ring-glow guide on the mover (Tutorial `guide.line = 'ring'` exists), touch caption "HOLD,
  RELEASE" instead of text paragraphs. Confirm `Tutorial.ts` does not block movement or throws.
* **Acceptance:** `first_throw` <= 8 s for a player who follows the prompt (bot test).

### PHASE 2 — Mobile (P1/P2) — details in Part 6
* M1 payload (covered by T0.2), M2 performance telemetry + adaptive quality, M3 touch tuning pass,
  M4 mobile tutorial text and layout checks.

### PHASE 3 — Depth and variety (P2)

#### T2.1 — New room objectives from existing counters [P2, M, risk M, independent]
* **Problem:** C4: one objective kind, generated rooms only.
* **Files:** `src/gameplay/Room.ts` (`RoomObjective` union), `src/gameplay/RoomGenerator.ts`
  (~line 641, the `survive` selection), `src/core/Game.ts` (win-check where `survive` is evaluated;
  find with `grep -n "objective" src/core/Game.ts src/gameplay/Room*.ts`), `src/ui/screens/hud.ts`
  (objective chip), `src/gameplay/ScoreSystem.ts` (counters).
* **Required (3 kinds; every one derives from events the game already emits):**
  1. `{ kind: 'trick', hazardKills: N }`: win after N kills caused by hazard/chain (ScoreSystem already
     scores hazard kills, find the tally); movers keep arriving until then.
  2. `{ kind: 'chain', length: L }`: win when one chain reaches length L (the `CHAIN` bus event
     carries `length`).
  3. `{ kind: 'guard', objectId, seconds }`: protect one fragile object (`vase` or `teddy`) for the clock;
     movers prefer it as a target. **L complexity** because it needs an AI target override in
     `src/entities/Enemy.ts` (large file: add one `targetOverride` hook, do not refactor). Ship 1 and 2
     first; ship 3 only if the hook is < ~40 lines.
  4. Generator picks an objective for ~35% of generated rooms, never two in a row, never in boss rooms.
* **Acceptance:** each kind completes a room in a unit test; HUD shows "TRICKS 1/3"-style chip; failed
  objectives fall back to extermination after the clock so nobody is stuck.
* **Metric:** share of generated rooms with `objective` in diagnostics; `room_end` seconds variance
  goes up (rooms stop feeling identical).

#### T2.2 — Use the 13 unused hazard zone kinds as room gimmicks [P2, M, risk M, independent]
* **Problem:** C5.
* **Files:** `src/gameplay/RoomGenerator.ts` (zone placement block, ~lines 540-565),
  `src/hazards/Zone.ts`, `src/rendering/ZoneArt.ts` (verify art exists per kind), `src/interactions/*Rules.ts`
  (verify rules exist per kind), tests `RoomManager.test.ts` / generator tests.
* **Required:** add a `GIMMICKS` table keyed by theme kit, each = 1 zone kind + placement rule + one-line
  teaser (the `teaser` field already exists on `RoomDefinition` and shows on the door card):
  `wind` (a gust lane pushes thrown objects sideways: "the draught bends your throws"),
  `magnet` (a magnet pad pulls metal objects: `magnet_pull` rule exists),
  `slick`/`oil`+`fire` ("the floor is a fuse"), `foam` (extinguisher room), `glass` (broken glass strip),
  `music` (`music_dance` rule: movers dance, easy targets), `steam` (`steam_blind` rule),
  `feathers` (`feathers_fire`). Each generated room gets **at most one** gimmick so the player can read it.
* **Process rule:** for each zone kind, Sonnet must first confirm (a) it renders, (b) it has at least one
  interaction rule, (c) it cannot soft-lock the player. Drop any kind that fails; do not invent art.
* **Acceptance:** generator deterministic per seed (existing tests assert determinism); a snapshot test
  lists the gimmick per room index; no room can spawn a zone over the player start or door.

#### T2.3 — Edges that change how you play [P2, L, risk H, depends on T0.1]
* **Problem:** C6.
* **Files:** `src/gameplay/Edges.ts` (definitions, keep existing ids), `src/gameplay/EdgeSystem.ts`
  (runtime), `src/gameplay/ImpactSystem.ts` (impact hook), `src/entities/Player.ts` (throw/grab/dodge),
  `src/core/Events.ts` (bus events), `src/save/SaveManager.ts`/`src/gameplay/Run.ts` (`sanitizeRun`
  must drop unknown ids so old saves never crash), `src/ui/screens/doors.ts` and the Edge card screen.
* **Rules for the redesign:** keep the 11 existing ids (saves reference them); **append** new ids; keep
  `EDGE_STACK_CAP = 3`; three categories stay; every new Edge is a *behaviour*, defined per stack so it
  cannot multiply to absurdity; no Edge may exceed +100% of base damage from all sources combined
  (enforce in one clamp in the damage path, not per Edge).
* **Add 6 (priority order, each independently shippable):**
  1. **RICOCHET** (heavy, rare): a thrown object that hits an enemy bounces once toward the nearest
     other enemy within 260 px with 60% speed (stack 2: twice; stack 3: 80% speed). Hook: the impact
     handler in `ImpactSystem.ts`; mark the object `bounced` so it cannot loop. Note `ball_ricochet`
     and `trick_shot` rules already exist in `GadgetRules.ts`: read them first to avoid duplicating.
  2. **SHOCKWAVE** (heavy, rare): a full-charge throw (charge >= 0.9) that lands emits a 90 px ring that
     staggers (not damages) enemies; stack adds radius. Hook: `OBJECT_THROWN` event + landing.
  3. **BOOMERANG** (slick, rare): the first object you throw each room returns to your hand if it has not
     hit anything within 1.2 s. Hook: `Player` throw bookkeeping.
  4. **SLIPSTREAM** (slick, common): your dodge leaves a short `slick` zone (zone kind exists) that trips
     enemies; cooldown tied to the dodge cooldown.
  5. **HOT HANDS** (heavy, common): carried flammable objects ignite on contact with a mover (uses the
     fire zone/ignite path); you take no burn from your own carried object.
  6. **BIG SPENDER** (greed, rare): spend scrap at the next door for a free reroll of the door offers
     (reuses `NightShift.ts`). Pure economy, so it is a safe low-risk one.
* **Acceptance:** each has a deterministic unit test (set up two enemies, throw, assert second takes
  damage / ring staggers / object returns); no Edge can be taken more than 3 times; old saves with
  unknown ids load; Edge card text <= 60 characters.
* **Metric:** distribution of `edge_pick` ids per run (no single Edge > 35% of picks); `run_end` score
  variance by build.

#### T2.4 — Enemy variety in rooms 1 to 10 [P2, S, risk L, independent]
* **Problem:** C7 and the handcrafted rooms.
* **Files:** `src/gameplay/RoomDefinitions.ts` rooms 2 to 9; `src/entities/EnemyTypes.ts` (read only).
* **Required:** introduce **one new mover type per handcrafted room** in order: room 2 `fast` (exists),
  room 3 `fragile`, room 4 `kaboom`, room 5 `helmet`, room 6 `nested`, room 7 `trolley`, room 8 `hurler`,
  room 9 `shield`/`bulwark`. Each introduction is a single mover with the room's `teaser` naming it.
* **Acceptance:** each room lists its new type in `enemies`; balance bot clear rates do not drop more
  than 10 points versus `git stash` baseline (`BALANCE=1 BALANCE_SKILL=decent`).

#### T2.5 — Mode structure (evaluate NIGHT SHIFT, ENDLESS, DAILY) [P2, S, risk L]
* **Verdict (recommendation, not proof):** keep all three separate; do not merge. Change only
  **exposure**: for a returning player on the lobby, show PLAY prominent, show ENDLESS and DAILY from the
  start (they are cheap choices) but add a one-line label under each ("Endless: how deep can you go",
  "Daily: same room for everyone"). Daily already has a streak and unlocks a hero
  (`DailyStreak.ts`, `HeroUnlocks.ts`). Endless keeps its own best-floor stat (`endlessBestFloor`).
  **Progression sharing:** scrap and stars are shared (already true); Edges are per-run (already true).
  No change needed there.
* **File:** `src/ui/screens/lobby.ts` only. **[CONFLICT-RISK]** (in-progress menu work).

### PHASE 4 — Long term (P3)
* P3.1 Boss rule hints already covered by T0.3; later add a short "boss intro card" only if the owner
  reverses the banner decision.
* P3.2 Rebuild the five bosses still on the old design (Time-Thief `clock`, Toybox Titan `toybox`,
  Dishwasher Demon `dishwasher`, The House `house`, King of Cardboard `cardboard`) using the boss
  script pattern in `src/entities/bossScripts/BossScript.ts`. Do this only after T0.1 shows players
  actually reach them.
* P3.3 Optional external analytics sink (see T0.1 item 6) once CrazyGames confirms it is allowed.

---------------------------------------------------------------------------------------------------

## PART 4 — First-room blueprint: "THE BEDROOM, 3 A.M."

Goal: a 75 to 95 second encounter whose **fun does not depend on understanding anything**. Every beat is
a thing the player *does*, with a visible reward, escalating from "I threw a pan" to "I made the room
explode". It builds on the working-tree direction (`throw -> power -> free`) and on what room 1 already
contains. Room: 860 x 500 interior, `playerStart (470, 300)`, entrance top at x=640, wall socket at
(588, 12) (zone `electric`, `outlet: true`), exit left at y=300.

**Rule semantics to verify before building (read these, do not assume):** `bottle` break -> water zone;
water zone + `outlet` electric zone = zap (this is the existing `zap` lesson in `Tutorial.ts`);
`pillow_burst` and `feathers_fire` in `GadgetRules.ts`; `candle` emits a `fire` zone while tagged `lit`
(`ObjectDefinitions.ts`); `spraycan` "explodes near fire"; `kaboom` enemy `onDefeat: 'explode'`
(`EnemyTypes.ts`). If any behaves differently, adapt the beat but keep its intent.

### Timeline and composition (9 movers; counts were 8, one extra for the climax)

| Beat | Time | What happens | Movers | Player instruction (max 3 words, icon first) | Reward / feedback |
|---|---|---|---|---|---|
| A. The Pan | 0-12 s | Pan already in hand. First mover enters at **1.0 s** from the top door and walks a straight line at the player. | 1 `basic` | Touch: hold-and-release glyph, caption "THROW". Desktop: aim + hold/release glyph. | Kill = hit-stop, "BONK!" popup, +score, the pan clatters onto the rug and glows once so grabbing it again is obvious. |
| B. Anything | 12-30 s | Two movers enter 1.5 s apart (gated by the first kill, not a timer). A chair (330,190) and a ball (600,400) are glow-flagged as "new toys" (existing `spotlight` mechanism, `Tutorial.ts` first-visit glow). | 2 `basic` | One hint (T0.3): "ANYTHING IS A WEAPON". No text after. | Throwing a **different** object type for the first time gives its own comic word (existing `popup`). Two kills -> x2 pop. |
| C. The Trick | 30-55 s | Three movers queue in the doorway lane directly under the socket. A glow-flagged `bottle` sits next to the player. If the player has not thrown the bottle at the socket within 12 s, the guide ring points to the socket (existing `guide.line` support). | 3 `basic` in a tight line, 0.6 s apart | Guide ring on socket; hint "WET + SOCKET". | **The spectacle:** bottle breaks -> puddle -> `electric` zone -> 2 to 3 kills with one throw. `trick_shot`-style popup "x3", 0.12 s hit-stop, one sound, no extra shake. This is the memory the player takes away. |
| D. The Power | 55-70 s | Movers come faster: 2 `basic` + 1 **`kaboom`** (walks straight at the player, explodes on defeat). The BIG RED BUTTON grant moment (existing lesson `power`) happens here as the answer to "too many at once". | 2 `basic`, 1 `kaboom` | Touch caption "TAP POWER" (exists), desktop "AIM + P". | Pressing POWER clears the crowd; if the player kills the `kaboom` at range with a throw, the explosion catches a nearby mover (**chain** popup). |
| E. Finale | 70-90 s | Last mover is a **`trolley`** (long charge down the room). Lamp (790,160) and bed props are in the lane. | 1 `trolley` (+1 `fragile`, optional) | none | The last-kill dip (T1.3): hit-stop 0.12 s, 0.35 s slow-mo, "CLEAR". Then results. |

Total: 1 + 2 + 3 + 3 + 1 = **10** movers if the optional `fragile` is included; **9** without. Ship 9.
`room.totalEnemies` must match the list length (the existing `Tutorial.skip` path recomputes it, see
`Tutorial.ts` around the `room.pending.slice(skipped)` code).

### Object placement
Keep the current coordinates (they are walkable; the room header comment says every gap is walkable) and
change only these:
* `pan`: spawn **in hand** (working tree already does this).
* `bottle`: move to **(560, 300)** (near spawn, between the player and the socket) so beat C needs no walking.
* `candle`: optional, at **(740, 112)** with a `pillow` at (700,112): a pure-physics Easter egg
  (feathers + fire). Not part of any beat; do not tutorialise it.
* Remove nothing else. Lamp (790,160), alarm clock (300,110), teddy (740,400), shoe, book stay as clutter.

### Technical requirements
1. `src/gameplay/RoomDefinitions.ts` room-1 `enemies` list reordered/typed per the table, `delay` values only used
   as fallbacks (`WAITING` gating in `Tutorial.ts` decides actual release).
2. `src/gameplay/Tutorial.ts`: keep `LESSONS = ['throw','power','free']` but add a **`trick`** step between
   `throw` and `power` that releases beat C's three movers when the player has thrown twice, and ends
   when `ENEMY_DEFEATED` x2 happen within 1.5 s of an `electric` zone event **or** after a 25 s timeout
   (never soft-lock). Update `MOVERS` counts (1 / 2+3 / 3+1 / free).
3. No new enemy types, no new objects, no new art. Everything above exists today.
4. Update `src/core/Game.tutorial-flow.test.ts`: assert the order of lessons, that the bottle-on-socket path
   kills >= 2 movers, that the timeout path never soft-locks, that room 1 can be completed with only
   the pan thrown repeatedly (fallback), and that old saves with `tutorial: 'pet'|'zap'` map onto the new
   steps (the working tree already does this mapping, keep it).

### Acceptance (measurable)
* Balance bot (`BALANCE=1 BALANCE_SKILL=decent BALANCE_FROM=0 BALANCE_TO=0`): clears room 1 in 60 to 100 s,
  loses <= 2 hearts; `casual` bot clears >= 80% of 10 runs.
* `first_throw` <= 8 s, `first_kill` <= 15 s, `first_chain` (any multi-kill) <= 60 s in diagnostics from
  3 human testers (desktop and phone).
* A tester who ignores every prompt still clears the room by repeatedly throwing the pan (fallback proven).
* No banner box appears (C3); at most one hint on screen at a time.

---------------------------------------------------------------------------------------------------

## PART 5 — Gameplay and progression redesign

**Mandatory:** T0.3, T2.1 (kinds 1 and 2), T2.2, T2.3 (RICOCHET, SHOCKWAVE, BOOMERANG), T2.4.
**Optional experiments** (do last, ship only if tests and bot results are clean): T2.1 kind 3 (`guard`),
T2.3 items 4 to 6, T1.2 `FIRST_RUN_GENTLE`, T2.5 lobby captions.

**What I reject and why**
* Merging the three modes: they already have distinct incentives (run, depth, daily streak); merging
  removes the daily hook that costs nothing to keep.
* New heroes/bosses/rooms: C10/C11 show unused depth; the leak is earlier.
* Meta-currency inflation or stamina/energy mechanics: dark pattern, wrong fix.
* A full tutorial rewrite: the working tree is already shortening it; Part 4 only reshapes the content.
* Rewriting the physics or renderer: both work (293 tests, fixed step 120 Hz); no evidence of a problem.

**Room variety rule of thumb:** a player should be able to answer "what is different about this room?"
in one sentence from the door card `teaser`. T2.1 + T2.2 + T2.4 give each generated room one objective
**or** one gimmick **or** one new mover, never none and never three.

---------------------------------------------------------------------------------------------------

## PART 6 — Mobile and tablet

What exists (CONFIRMED, `src/input/TouchInput.ts`): floating move stick (`STICK_RADIUS = 52`), tap to
grab the highlighted object, hold-and-release to throw with auto-aim at the nearest intruder,
`Player.assistAim` using boss `aimPoints`, DODGE and DROP buttons, `(pointer: coarse)` detection.
The CrazyGames build sets `managesScreen = true`, so the game's own rotate prompt is off and
CrazyGames shows theirs. The renderer caps DPR (`MAX_DPR` in `src/rendering/Renderer.ts` line ~60).
The mobile controls are not the obvious problem; start-up weight and first-minute clarity are.

* **M1 Payload [P0]:** T0.2. Mobile is the segment most hurt by 7.27 MB.
* **M2 Performance telemetry + adaptive quality [P1, M, risk M]:** files `src/core/GameLoop.ts`,
  `src/particles/ParticleSystem.ts`, `src/rendering/Renderer.ts`, `src/analytics/FunnelLog.ts`.
  Sample frame times for 5 s windows; if p95 frame time > 24 ms for 10 s, step quality down one notch:
  (1) halve `EMIT_SCALE`, (2) drop DPR cap by 0.25 (min 1.0), (3) disable zone ambient particles. Never step
  back up inside a room. Log `perfSample` and the quality step. Acceptance: on a 4x CPU-throttled Chrome
  profile, p95 frame time stays under 24 ms after the adaptive steps; desktop never changes quality.
* **M3 Touch tuning pass [P1, M, risk L]:** make no change before measuring. Add to `FunnelLog` the touch
  `first_input`, `first_grab`, `first_throw` times; if touch `first_throw` median is > 2x desktop, adjust:
  (a) enlarge the grab target radius for the highlighted object by 20%, (b) make the throw button hit area at
  least 56 px, (c) keep DODGE and DROP >= 44 px with >= 12 px gap, (d) verify no HUD element sits under the
  thumb zones at 360x640, 390x844, 820x1180 (tablet). Use the dev server with
  `npm run dev:phone` and a real device if possible.
* **M4 Mobile tutorial adaptation [P1, S, risk L]:** captions are already touch-aware in `Tutorial.ts`
  (`touch ? 'TAP POWER' : 'AIM + P'`). Verify every Part 4 caption has a touch variant and fits in one
  line at 360 px width.
* **M5 Validation matrix:** Chrome DevTools device modes (iPhone SE, Pixel 7, iPad), one real Android and one
  real iPhone if available; each: cold load time on throttled 4G, room 1 completion, 3 minutes of play
  without a frame-rate collapse, audio unlock on first touch (`touchend` unlock exists in `main.ts`).

---------------------------------------------------------------------------------------------------

## PART 7 — CrazyGames optimisation

### 7.1 Game-side (code)
| Item | Problem | Change | Metric |
|---|---|---|---|
| Payload (T0.2) | C2 | 7.27 MB -> <= 2.6 MB | time `boot` -> `gameplay_first`; CrazyGames "Loading started -> Playing started" |
| First 90 s (Part 4) | H1 | new room 1 | "Played 1 minute / Playing started" (54.5% now) |
| Analytics (T0.1) | C1 | local funnel + diagnostics | presence of data |
| Rule hint (T0.3) | C3 | `hud.hint` | qualitative: testers can state each boss rule |
| `loadingStart` timing | C12 | leave as is; log `boot` ms instead | n/a |
| `gameplayStart/Stop` | CrazyGames' playtime buckets depend on them; `Game.setState` calls them on state change (~line 410) | keep; **do not** call `gameplayStart` during menus/doors/results; verify with the SDK's debug environment that start/stop pairs balance | CrazyGames "Played N minutes" funnel |

### 7.2 Store-side (needs the CrazyGames developer portal, no code)
* **Cover (CTR, H2):** replace the static lineup with an **action frame**: hero mid-throw, a chair in the
  air about to hit a cardboard mover, a puddle-and-socket spark in the background, 2 movers visibly
  reacting, "BONK!" title large. Rule: one focal action, readable at 200 px wide, high contrast, no more
  than 3 colours dominant. Produce all three sizes (`covers/` has landscape 1920x1080, portrait 800x1200,
  square 800x800).
* **Screenshots/preview (visit -> loading, H2):** 4 screenshots, each a *moment* (the electric kill, the Midnight
  Express derail, a boss telegraph, a 3-chain), plus a **15-second looping preview video/GIF** of Part 4's beat C.
* **Title/description:** keep the title decision documented in `CRAZYGAMES.md` (name-collision reasoning). First
  line of the description should be the hook ("Throw the furniture. Fry them with a puddle.") before the
  story. Verify tags: physics, funny, mobile.
* **Measure:** CTR and visit->loading in the CrazyGames dashboard over equal-length windows before and
  after the change. With ~183K impressions per period a CTR move from 0.9% to 1.2% is detectable;
  smaller is noise. Change the store assets **one at a time** if possible, otherwise accept that the cause
  is ambiguous.
* I am **not** promising any of this raises traffic; CrazyGames' own algorithm decides placement.

---------------------------------------------------------------------------------------------------

## PART 8 — Testing and validation

Always run, in this order, before reporting any task done:
1. `npx tsc --noEmit` (must be clean)
2. `npx vitest run` (baseline 293 passed, 1 skipped; no new failures; new tests per task)
3. `npm run build:crazygames` then `node scripts/check-bundle-size.mjs` (after T0.2)
4. Browser check with `npm run dev` (port from `.claude/launch.json`, `bonk-dev` = 5183): console free of errors.

| Area | How |
|---|---|
| Core mechanics / physics | `npm run test:physics` (`scripts/physics-smoke.ts`), existing `src/physics` and `src/interactions` tests; do not change tolerances. |
| Room generation | `RoomManager.test.ts`, `Navigation.test.ts`; add determinism and "no zone over start/door" tests (T2.2). |
| Bosses | `src/core/Game.endless-flow.test.ts` holds one flow test per scripted boss; keep them green. The balance bot cannot judge Kraken, Mom, Hydra, Cables, Junk: **human playtest required**. |
| Progression / saving | `SaveManager.test.ts`, `Run.test.ts`, `Progression.test.ts`; every new save field has a default and a "loads an old save" test. **Never** bump the save version without a migration. |
| Desktop controls | `KeyboardMouseInput` tests where present; manual: WASD, mouse aim, hold/release, right-click drop, Space dodge, P power, Esc pause. |
| Mobile controls | device-mode run through M5 matrix; record touch `first_*` timings. |
| Performance | DevTools Performance, 4x CPU throttle, 3 minutes of room 5+ with a boss; target p95 frame <= 24 ms after adaptive steps (proposed goal, not guaranteed). |
| CrazyGames integration | `npm run dev:crazygames` (port 5174) and the CrazyGames QA tool: SDK init, `loadingStart/Stop`, `gameplayStart/Stop` pairs, ad request at "next room" with ads off (Basic Launch) must not freeze, mute switch honoured, data-module save round trip. |
| Balance | `BALANCE=1 BALANCE_SKILL=<casual|decent|rusher|patient> BALANCE_FROM=n BALANCE_TO=n npx vitest run src/balance` before and after any content change; do not accept a >10-point clear-rate drop. |

**Statistical honesty:** with ~1.7K visits and ~470 plays per measurement period, a change must move a
rate by roughly **8+ percentage points on the 1-minute step** (n ~ 470: standard error ~ 2.3 pts) to be
distinguishable from noise, and D1 (3 to 5 people) cannot be A/B tested at all at this scale. Use before/after windows of
equal length, record in `docs/BONK_METRICS_LOG.md` (create it), and trust tester observation and the
bot for anything smaller. Targets (proposals only): Played-1-minute / Playing-started >= 65%; touch
`first_throw` median <= 12 s; CTR >= 1.2%; build size <= 2.6 MB.

---------------------------------------------------------------------------------------------------

## PART 9 — Copy-ready master prompt for Claude Sonnet

> You are Claude Sonnet working in the repository at `D:\UnseenBox\everything-is-a-weapon` (the BONK!
> game: Vite + TypeScript + Canvas 2D, custom physics, vitest). Your job is to execute
> `docs/BONK_SONNET_MASTER_PLAN.md` exactly as written.
>
> RULES
> 1. Read the whole plan first, then read `everything-is-a-weapon/CLAUDE.md` (token-efficiency rules) and
>    `CRAZYGAMES.md`. The repo-root `AGENTS.md` talks about Next.js; it does not apply to BONK (a Vite
>    project), ignore it.
> 2. Run `git status`. The working tree may contain the owner's uncommitted **Night Shift** work
>    (plan section 0.2: doors, P-key power, short tutorial; `NightShift.ts` and `doors.ts` are
>    untracked). Do not revert, reformat or "tidy" it. If it is still uncommitted, ask the owner to
>    commit it first and do only read-only work until they do. If a task is marked **[CONFLICT-RISK]**
>    and the target file is modified, stop and report the exact conflict, then continue with
>    independent tasks. Work on a new branch
>    `bonk-recovery`; commit per task with a clear message; never force-push; do not push or merge
>    unless the owner tells you to.
> 3. Follow the task order in plan Part 3. Before you modify any file, open it and the code that calls it.
>    Never invent a file path, function or event name: if the plan names something you cannot find, report
>    it as a blocker instead of guessing.
> 4. Implement real, production-quality code. No placeholders, no TODO stubs standing in for required
>    behaviour, no disabled tests. Keep changes modular and minimal; no unrelated refactors; keep
>    existing save compatibility (add defaults, never rename or remove save fields, never change the
>    save version without a migration and a test).
> 5. Respect the owner's standing preferences: **low camera shake and few particles**; no big covering
>    announcement cards (`ANNOUNCEMENTS_VISIBLE` stays `false`; use the new `hud.hint`); keep the
>    ink-and-ransom-note look.
> 6. After each task run, in order: `npx tsc --noEmit`, `npx vitest run`, and (for build-affecting tasks)
>    `npm run build:crazygames`. Fix every regression you caused. Do not run the full suite after
>    every tiny edit; run the smallest relevant test first, then the full suite once per task.
> 7. Never claim something works without verification. For UI or gameplay changes, start the dev server
>    (`npm run dev`), exercise the change in a browser, check the console, and describe what you
>    observed. If you could not verify something (for example a real phone), say so explicitly.
> 8. If a task cannot be completed safely (missing information, conflicting edits, an unconfirmed
>    external policy such as third-party analytics on CrazyGames), do not skip it silently and do not
>    stub it: report the precise blocker, what you did instead, and continue with the independent tasks.
> 9. At the end of each task report: files changed, what was verified and how, test results (counts),
>    remaining risks. At the end of the session give a table of every task ID with status DONE,
>    PARTIAL or BLOCKED and the reason.
>
> START with T0.1, T0.2, T0.3, then Part 4 (T1.1 to T1.4). Stop after Phase 1 and report before
> starting Phase 2, so the owner can playtest the new first 90 seconds.

---------------------------------------------------------------------------------------------------

## Appendix A — [REV2] System map (where each system lives; every path was listed or opened)

| System | Files |
|---|---|
| Boot, SDK, portal | `src/main.ts` (`loadingStart` line ~65, `loadingStop` ~87), `src/platform/{Portal,CrazyGamesPortal,GameMonetizePortal,index}.ts`, `src/ads/{AdManager,MockAdProvider}.ts` |
| Main loop | `src/core/GameLoop.ts` (fixed `FIXED_DT = 1/120`), `src/core/Game.ts` (1.9k lines: state machine, room flow, `setState` -> `gameplayStart/Stop` ~line 412, `openDoors/chooseDoor`, `completeRoom`, funnel flags `funnelInput/funnelHit`) |
| Physics | `src/physics/{PhysicsWorld,RigidBody,Collision,CollisionResolver,SpatialGrid}.ts`; objects `src/entities/PhysicsObject.ts`, `src/objects/*` (77 objects, `Materials.ts`) |
| Interactions / chains | `src/interactions/{InteractionSystem,InteractionRegistry,HouseRules,GadgetRules,MoreRules,Effects}.ts`, `src/gameplay/Chain.ts`, `ImpactSystem.ts` |
| Hazards | `src/hazards/{Zone,Fire,Water,Electricity}.ts`, art `src/rendering/ZoneArt.ts` |
| Enemies / bosses | `src/entities/{Enemy,EnemyTypes,Behaviors,Pets}.ts`, `src/entities/bossScripts/*Script.ts` (15 scripts, `BossScript.ts` base) |
| Rooms | `src/gameplay/{Room,RoomDefinitions,RoomGenerator,RoomManager,Navigation,Tutorial}.ts` |
| Run / progression | `src/gameplay/{NightShift,Run,Edges,EdgeSystem,Abilities,Campaign,Endless,Progression,StarLedger,Upgrades,Discoveries,ScoreSystem,Heat}.ts`, save `src/save/SaveManager.ts` |
| Input | `src/input/{InputManager,KeyboardMouseInput,TouchInput}.ts` |
| UI | `src/ui/screens/{lobby,hud,pause,results,doors,rooms,characters,settings,credits}.ts`, styles `src/ui-kit/bonk2/*.css`; shims `src/ui/{HUD,MainMenu,PauseMenu,ResultsScreen}.ts` |
| Analytics | `src/analytics/AnalyticsManager.ts` (no production sink: C1) |
| Rendering / audio | `src/rendering/*`, `src/particles/ParticleSystem.ts`, `src/audio/*` (all synthesised) |

**Preserve (works, tested, do not rewrite):** fixed-step physics, interaction rule engine, 15 boss
scripts, save sanitising, portal abstraction, input abstraction, the BONK 2.0 ink/ransom-note UI kit.
**Smells, leave alone unless a task needs them:** `Game.ts` and `Enemy.ts` are ~1.9k lines each;
`ui/{HUD,MainMenu,...}.ts` one-line shims; `shouldOfferEdge` dead code (C3c); 11 dead event names (C1b).
Build output folders (`dist`, `dist-*`, `*.zip`, `tmp_*.txt`, `_a.png`...) sit in the project root;
they are not source, do not edit them.

## Appendix B — [REV2] Can we measure what you asked about? (coverage matrix)

| You asked to measure | Today | After T0.1 |
|---|---|---|
| Game visited / loading started / loading completed | CrazyGames dashboard only (SDK `loadingStart/Stop` in `main.ts`); nothing local | `boot` {ms} adds our own load time |
| Gameplay started | `gameplayStart()` via `Game.setState` (CrazyGames) + `game_start` | `gameplay_first` {ms} |
| First movement | `first_input` emitted (Game.ts ~1283), discarded in prod | readable via FunnelLog |
| First successful throw / grab | `first_throw`, `first_grab` emitted | readable |
| First kill | **not tracked** (`enemy_defeat` fires every kill, no "first") | `first_kill` |
| First room completed | `first_clear`, `room_complete` {seconds} emitted | readable |
| First route (door) selection | **not tracked** | `door_pick` |
| First boss encountered | `boss_arrive` **declared, never emitted** | wire it |
| Run completed / failed | `run_end` **declared, never emitted**; `room_fail` emitted | wire it |
| Time in each room | `room_complete.seconds` (clears only) | `room_end.seconds` incl. fail/quit |
| Deaths and cause | `room_fail` without cause | `death_cause` |
| Upgrade (Edge) selection | `edge_pick` **declared, never emitted** | wire it in `applyDoorReward` |
| Return sessions | **not tracked** (CrazyGames shows D1 only) | `session_resume`, `sessionIndex` |
| Mobile vs desktop | not tagged | `boot.touch`, `perfSample` |

Rule: add only the events in this table; no per-frame or per-object events; one `perfSample` / 30 s.

## Appendix C — [REV2] Baseline and experiment plan

* **Baseline (from your numbers, no new claims):** visit->loading 29.8%, loading->playing 91%,
  playing->1 min 54.5%, 1->10 min 14.7%, 10->30 min 26%, 30->60 min 30%; CTR 0.9%; avg playtime 4m01s;
  D1 0.75% desktop / 1.16% mobile; mobile conversion 9.39% (denominator unknown). Freeze these in
  `docs/BONK_METRICS_LOG.md` **before** shipping anything, with the dashboard date range.
* **Order of change (so effects stay separable):** (1) T0.1 telemetry ships alone for one window;
  (2) T0.2 payload + T1.x first 90 s ship together (both act inside the game, measured by the same
  funnel steps, and a human cannot separate them at this traffic anyway); (3) store assets in a
  separate window (CTR and visit->loading only); (4) Phase 3 depth content one item per window.
* **Windows:** equal length, >= 7 days, same weekday mix. Primary metric per change: Playing->1 min
  for in-game changes (needs ~8+ points to beat noise at n~470), CTR for store changes.
* **Not testable at this scale:** D1 (3 to 5 people). Treat D1 as a direction to watch over several
  windows, never as a pass/fail gate.
* **Decision rule:** a change stays if the primary metric does not drop beyond noise **and** testers
  (5 people, think-aloud, desktop + phone) can state what to do without help in the first 20 s.

## Appendix D — Open questions for the owner (cannot be answered from the repository)
1. May CrazyGames builds send third-party analytics requests? (blocks the optional `HttpSink`, T0.1.6)
2. Which exact denominators do the dashboard's 39.64% and 9.39% use? (affects how mobile is judged)
3. **[REV2]** Will the owner commit the uncommitted Night Shift work (0.2) before Sonnet starts? Sonnet
   must not begin edits until it is committed.
4. Was `ANNOUNCEMENTS_VISIBLE = false` meant to hide *rule* messages too, or only the large cards?
   (T0.3 assumes only the large cards.)
5. Can you send the three dashboard screenshots again, plus the live CrazyGames page URL, so store-page
   hypotheses (H2) can be checked against what players actually see?
