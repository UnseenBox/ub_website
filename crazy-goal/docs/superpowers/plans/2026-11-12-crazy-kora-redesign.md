# CRAZY KORA — Audit, Redesign and Implementation Blueprint

Written 2026-11-12 against `main` at commit `6579b23` (Free Kicks integrated). Author role: design lead and architect. The developer (Sonnet 5.5) implements the work; the executable handoff is in [`2026-11-12-sonnet-handoff.md`](2026-11-12-sonnet-handoff.md).

**Evidence legend.** `VERIFIED` means checked in code or in the running game during this audit. `REPORTED` means read from code by the audit's helpers and not re-checked line by line; re-read before editing. `ASSUMPTION` means a design judgement without data (there is no analytics and no playtest data). Line numbers are as of `6579b23` and will drift as the work proceeds.

---

## 1. Executive assessment

### The short version

The engines are good and the game around them is not. Classic has a careful fixed-step physics engine with headless level validation, a clean event and feedback architecture, 100 levels that all have a verified route, and one genuinely original hook: **the crazier the route, the bigger the score**. Free Kicks is a second, well-built engine with validated cards, a real tutorial and accessibility work. They sit inside a shell that does not reward the hook, has a broken economy, and treats the second mode as a separate game bolted onto the menu.

The "messy and disconnected" feeling is real, and it does not come from the visual style. **The systems do not reinforce each other.** Score, stars, coins, chapters, skins and the two modes each make sense alone, and none of them pushes the player toward the thing that makes the game special.

### Strengths worth protecting

- **Physics and feel.** 240 Hz fixed step, interpolated render, kinematic movers (README "Physics"). `Feedback.ts` owns all the juice, so feel can be tuned without touching gameplay. Do not rewrite this.
- **Headless levels.** `Level` knows nothing about drawing, and `__cg.sweep(n)` proves a level can be solved. This is the tool that makes content work safe.
- **The style-score idea.** `StyleRecognizer.ts` labels such as PINBALL WIZARD, OFF THE TAXI and CHAIN REACTION are the game's identity. "How crazy can you score?" is a strong tagline.
- **Free Kicks engineering.** Validated make rates (`free-kicks/tools/validate.js`), a pure seeded generator (`drawQuick(seed)`, `free-kicks.js:944`), a three-step tutorial, reduced motion, RTL, and clean `start`/`stop`.
- **Localization.** English and Arabic throughout, with RTL.
- **Careful portal integration.** Ads only at natural breaks, and no reward on `adError` (`src/portal/Portal.ts`).

### The biggest problems, ranked

1. **The hook is invisible and unrewarded.** `VERIFIED`
   - The 2★/3★ targets live only in level data (`data/levels/houma.ts`, e.g. `stars: [1400, 2600]` on houma 1). The gameplay HUD never shows them; the score plaque was removed in `09e07cf`. The result card draws three stars and nothing about what the next star needs (`src/ui/HUD.ts:322-456`).
   - Any goal earns 1★ (`ScoreSystem.ts:25-28`).
   - Any goal unlocks the next level (`Game.ts:447`: `goals > 0`).
   - Chapters are display labels and gate nothing (`Overlay.ts:63-78`).
   - The result: the optimal strategy is "get it in any way, press NEXT". The player can finish all 100 levels without learning the scoring, and that is how the game ends up feeling like 100 similar alleys.
2. **The economy is broken.** `VERIFIED`
   - Every goal pays `max(5, round(total/100))` coins (`Game.ts:938-941`, `Cards.ts:43`), including replays of a cleared level.
   - The in-level coin (+10) comes back on every retry (`Game.ts:1000`: `coinTaken = false`).
   - Replaying houma 1 farms roughly 24 coins per three-second shot. Coins have no value, so boosts have no value, so the shop has no meaning.
   - The only coin sink is boosts. Boosts help solve puzzles, so their main use undermines the puzzle.
3. **Free Kicks is a separate game stapled on.** `VERIFIED`
   - It is reached through a GAME MODES button injected by a `MutationObserver` on the whole `document.body` (`game-modes.js:704-733`).
   - In the dev build that button renders as near-invisible pale text. Its background is a hard-coded hashed file name, `url("./button-blank-e8whuoAb.png")` (`game-modes.css:22`), which does not exist in `free-kicks/`; the dev server returns `text/html` for it.
   - The chooser repeats CLASSIC, which only clicks LET'S PLAY (`game-modes.js:613-623`).
   - Free Kicks stars count toward nothing. It pays no coins, ignores the selected ball skin (`free-kicks.js:75` is a hard-coded `SKIN`), reads mute once from the Classic save, and has its own `AudioContext`.
   - It is excluded from the CrazyGames build (`vite.config.ts`), the main distribution channel.
4. **Repetition.** `REPORTED`
   - 95 of 100 levels use the centred goal; only five use `goalAt` (`houma.ts:109, 137, 264, 344, 362`).
   - 80 levels start the ball at (800, 1010).
   - The level overhaul plan asked for about a third with moved goals (`2026-11-06-level-design-overhaul.md:255`).
   - Chapters 4–9 add no new mechanic.
5. **First impression clutter.** `VERIFIED`
   - Houma 1 shows the HARISSA / MAGNET / RUBBER boost column with prices while the player has 0 coins (`AbilityBar.ts:101`).
   - The menu shows STARS 0 / 300, three icon buttons, a big PLAY, the broken GAME MODES and DUEL A FRIEND. Seven targets compete before the first shot.
   - Classic's onboarding is a text pill and a ghost ball on houma 1 only (`HUD.ts:65, 221-226`).
6. **Fragile save.** `VERIFIED` A version mismatch silently erases the whole save (`SaveManager.ts:35`). Any change to the save shape done the obvious way would wipe every player.
7. **Smaller defects.** `REPORTED`
   - Coins are collectable in duel streets, because there is no `shotRule` guard on the pickup.
   - `Overlay.ts:427` shows an untranslated 🔒 emoji.
   - `Overlay.ts:366`: the skin aria label reads just "BEST".
   - The Legend set and Expert cards are unreachable (`game-modes.js:467` filters them out).
   - `onSetEnd` is never passed.
   - The README contradicts the code: it says settings, music and ads are "not built yet", and it describes `Music.ts` as in use.

### Untapped potential

- **The style score makes highlight moments, and players share those.** A five-bounce PINBALL WIZARD is a story; "I scored" is not.
- **Free Kicks already has a pure, validated, seeded generator.** A daily challenge that is identical for everyone costs almost nothing to build on it, and it gives the reason to come back tomorrow that the game lacks today.
- **Duels already exist,** with async play, invite links and cards. That is unusual for a web trick-shot game. They only work on unseenbox.com, which is fine as the social layer of the site build.

---

## 2. The two-mode decision

### The two modes, honestly

| | Classic (houmas) | Free Kicks |
|---|---|---|
| Fantasy | Street trick-shot artist | Set-piece specialist |
| Skill | **Creative routing.** Reading the street, banking, timing movers | **Execution.** Precise aim, power, choosing ground or air, bend |
| Camera / physics | Top-down, rolling, 2D | One arena, 2.5D (height `z`), curve |
| Structure | 100 handcrafted puzzles, free retries | Runs of five kicks, stars by goals out of 5, seeded Quick Five |
| Session shape | Long, progress-driven | Short, replay-driven |
| Failure | Free and instant | Costs a kick in the run (real tension) |
| Content scale | Large, finite, handcrafted | Small handcrafted set plus a generator |

They are not two versions of one game. They train different skills, have different pacing, and use different physics models. They also share everything that matters for identity: the drag-back-and-release gesture, Mimi in goal, the ball, the street-football tone, the Unbounded type and the palette.

### Option A — merge into one experience: rejected

Merging means one gameplay. Free kicks would have to become level types inside the Classic map, or Classic mechanics would have to enter the arena. In both cases one engine absorbs the other's physics: rolling top-down vs `z`-height plus bend, and two separate collision and keeper models. That is a rewrite of a validated engine, the "different skill" value is lost, and the result is a weaker version of both. Inserting free-kick levels into the 100-level map would also break Free Kicks' run structure (five kicks with real stakes), which is the best tension in the product. The cost is high and the dilution is certain.

### Option B — keep them fully separate: rejected (this is the current state)

This is what exists today, and it is the main source of the disconnected feeling:

- The second mode is hidden one tap deep behind an unexplained label.
- Its rewards are worthless to the rest of the game.
- It ignores the player's ball and live mute.
- It looks like a different product's HUD.

Separation also means the second mode never benefits from Classic's retention systems, and Classic never benefits from Free Kicks' replay engine. The two compete for a menu slot instead of feeding each other.

### Option C — hybrid with defined roles: **chosen**

**One game, one career, two ways to play. Shared everything except gameplay.**

- **Shared:** one wallet (Kora Coins), one star total, one ball (the selected skin is used in both), one settings and mute, one menu shell and navigation pattern, one set of design tokens, one portal / gameplay-signal path.
- **Separate:** gameplay, physics, level / card content, HUD controls specific to each mode.
- **Defined roles,** so the player always knows why both exist:
  - **Classic is the campaign,** the long progression spine where creativity and style are rewarded: "find the craziest way in".
  - **Free Kicks is the skill arcade and the daily,** short runs where execution is rewarded: "nail it in five kicks". It hosts the **Daily Kick**, the reason to open the game every day.
  - **Duels are the social layer** (site build only) and stay as they are.
- **Discovery:** Free Kicks is a peer tile on the main menu, visible from the first launch but locked. It opens after the player scores in houma 3, with a short unlock moment. By then the player knows the drag-back gesture both modes share. The intermediate GAME MODES screen is removed.

**Why C beats the others for this game.** It is the only option that:

- fixes the disconnected feeling (shared economy and shell);
- keeps the best part of each mode (no physics merge);
- gives each mode a job the other cannot do (campaign vs daily skill runs);
- costs proportionate engineering: a bridge object, not a rewrite.

Retention improves because Free Kicks adds a daily habit loop, and both modes feed the same skin track. Monetization improves because both modes feed one wallet with one set of rewarded-ad moments. Development complexity stays contained because Free Kicks keeps its isolation rule; it talks to Classic only through one published interface.

**What must not happen under C:**

- Do not port Free Kicks to TypeScript or into the Vite bundle.
- Do not change either mode's physics.
- Do not add a third mode.

---

## 3. The game vision

**CRAZY KORA: street-football trick shots. Score any way you can, then score crazier.**

How it feels:

- The first ten seconds: one big PLAY, a street, a ball. Drag back, let go, GOAL. The result card says "1,180 — ★. Bounce it off a wall for ★★ (1,400)."
- The player retries because now they have a target, finds the bank shot, gets ★★ and coins, and NEXT HOUMA is one tap away.
- Each chapter asks for enough stars to open the next street. The player can never clear the campaign without engaging with style, and is never blocked hard; any goal still clears a level.
- After houma 3, the Free Kicks tile lights up: five kicks against the wall and Mimi, a different and tense skill test. The stars and coins earned there count toward the same balls.
- Every day there is a Daily Kick: the same five kicks for everyone. The result is a shareable line of five ⚽/❌, with a streak counter.
- Coins buy boosts when stuck (and a stuck player is offered one by rewarded ad). Stars unlock balls. Nothing is pay-to-win; everything is earnable.

How the systems connect:

```
           Classic (campaign)                    Free Kicks (skill + daily)
   goals ─► Crazy Score ─► stars ◄──── shared ────► stars ◄─ goals in a 5-kick run
               │            │                         │
               │            ├─► chapter gates         ├─► next stage / Legend
               │            └─► BALL TRACK (skins) ◄──┘
               ▼
   first-clear & star-upgrade coins ─► WALLET ◄─ stage first clears, Daily Kick
                                        │
                                        └─► boosts (assist when stuck)
   rewarded ad ──► free boost when stuck | double first-clear coins
```

---

## 4. The new player experience

### Navigation

```
Splash (≥1.1 s)
└─ MAIN MENU
   ├─ top bar:  ⚙ settings · coin pill · star pill (n / 315)
   ├─ logo (smaller than today)
   ├─ ▶ LET'S PLAY  — continue Classic at the furthest open houma; subline "HOUMA 7 · NEW GROUNDS"
   ├─ mode tiles (two, side by side)
   │   ├─ HOUMAS   — courtyard art, "37 ★" and chapter progress  → Level map
   │   └─ FREE KICKS — arena art, "STAGE 2" or 🔒 "SCORE IN HOUMA 3", "DAILY ●" dot when today's Daily Kick is unplayed → Free Kicks hub
   └─ secondary row: BALLS · DUEL A FRIEND (site build only)

Level map  → chapter headers with gate progress ("16 ★ TO OPEN") → level tile → Classic level
Free Kicks hub → DAILY KICK card · PLAY next stage · stage list · QUICK FIVE · FREE PLAY → arena
Every screen's BACK returns one level up; Esc does the same.
```

Removed: the GAME MODES button, the CHOOSE YOUR PLAY screen, and the duplicate CLASSIC card.

### First session, step by step (target timings)

| # | Moment | What happens | Friction removed |
|---|---|---|---|
| 1 | Launch | Splash, then menu. Only LET'S PLAY is emphasised. FREE KICKS tile is visibly locked with its condition. | Seven equal targets reduced to one hero |
| 2 | Houma 1 (≈10 s) | Ghost-ball hint as today. No boost column. A target strip under the top bar: `★ GOAL · ★★ 1,400 · ★★★ 2,600`. | Clutter; invisible targets |
| 3 | First goal | Result card adds the **next-star line**: "★★ at 1,400 — try bouncing it off a wall". Coins for the first clear fly to the coin pill. | The player now knows why to retry |
| 4 | Houma 2–3 | One-time contextual tips (bank bonus, mechanic labels), each shown once and stored in the save. | The scoring system is taught, not hidden |
| 5 | Houma 3 cleared | Unlock card: "FREE KICKS IS OPEN — five kicks, a wall, and Mimi." [TRY IT] [KEEP GOING]. | Second mode discovered at the right time |
| 6 | Houma 6 | The boost column appears with a one-time intro and **one free MAGNET**. | Boosts introduced when they mean something |
| 7 | End of chapter 1 | Chapter 2 needs 16 ★. The level map shows the gate and which levels still have stars to gain. | Stars become the progression currency |
| 8 | Any time | A new ball unlocks: toast, plus a NEW dot on BALLS. | Skin track becomes visible |

### Returning player

The menu shows: LET'S PLAY (continue), the DAILY ● dot on Free Kicks, star progress to the next ball, and the chapter gate. Each is one tap away.

---

## 5. Prioritized roadmap (overview)

Phases are ordered by dependency first, then by impact. Effort is S (under half a day), M (one to two days) or L (three or more days).

| Phase | Task | Impact | Effort | Depends on |
|---|---|---|---|---|
| 0 | 0.1 Test harness + pure progression module | Enables everything safely | M | — |
| 0 | 0.2 Save v2 with migration, never wipe | Protects every player | S | 0.1 |
| 1 | 1.1 Show score targets (HUD strip, next-star line, level tiles) | **Highest:** makes the hook real | M | 0.1 |
| 1 | 1.2 Coin economy fix (first clear, star upgrades, coin once) | High | M | 0.2 |
| 1 | 1.3 Chapter star gates (with grandfathering) | High | S | 0.2, 1.1 |
| 1 | 1.4 Onboarding: scoring tips, boost bar gated to houma 6, free first MAGNET | High | M | 1.1, 1.2 |
| 1 | 1.5 Shell bridge `window.CrazyKoraShell` | Enables the hybrid | M | 0.2 |
| 1 | 1.6 Free Kicks joins the career (stars, coins, skin, live mute, portal signals) | High | M | 1.5 |
| 2 | 2.1 New main menu, remove GAME MODES | High | M | 1.5, 1.6 |
| 2 | 2.2 Free Kicks unlock moment after houma 3 | Medium | S | 2.1 |
| 2 | 2.3 Shared design tokens | Medium | S | — |
| 2 | 2.4 Level map with chapter gates | Medium | M | 1.3 |
| 2 | 2.5 Free Kicks HUD consistency (settings access, back pattern) | Medium | S | 1.5 |
| 2 | 2.6 Defect sweep (emoji, aria, duel coin leak, README) | Low–medium | S | — |
| 3 | 3.1 Daily Kick (date seed, share line, streak) | **High retention** | M | 1.6, 2.1 |
| 3 | 3.2 Legend stage reachable | Medium | S | 1.6 |
| 3 | 3.3 Level variety pass, chapters 1–2 | Medium–high | L | 1.1 |
| 3 | 3.4 Ball unlock moments | Medium | S | 1.6 |
| 4 | 4.1 Rewarded-ad moments redesign | Revenue | M | 1.2, 1.4 |
| 4 | 4.2 Free Kicks in the CrazyGames build (**needs owner sign-off**) | Revenue / content | S | 1.6, 4.1 |
| 4 | 4.3 Analytics sink on the EventBus (provider-agnostic) | Tuning | S | — |

**Deliberately not in the plan:**

- Merging physics, or porting Free Kicks to TS.
- New mechanics.
- Online leaderboards (they need a server and anti-cheat; the share line covers the social need for now).
- Energy or lives systems.
- Battle passes.
- Loot boxes.
- Android IAP. This is a valid later step (remove ads, coin packs) once the economy has proven itself; it needs a store-billing plugin and a product decision.

---

## 6. Technical specifications by task

General rules for every task:

- Strings: English is written in code and `tr()` translates it (`src/core/i18n.ts`). Every new Classic string needs an Arabic entry. Free Kicks strings go in `COPY` (`game-modes.js`) and `RUN_STRINGS` (`free-kicks.js`), then run `node free-kicks/tools/check-strings.js`.
- `free-kicks.js` and `free-kicks.css` are **CRLF**; `game-modes.*` are LF. Never `sed -i` them.
- Do not change Free Kicks physics constants or cards. If that happens anyway, the validator must be rerun (`docs/FREE_KICKS.md` §13).
- `npm run build` (which type-checks) must pass after every task.

---

### Phase 0 — Safety net

#### 0.1 Test harness and a pure progression module
- **Objective:** progression and economy rules must be testable without a browser before they change.
- **Current situation:** Classic has no unit tests (`VERIFIED`: no `*.test.ts` under `crazy-goal/src`). The rules live inside `Game.ts`: unlock at `:447`, coins at `:938-941`, coin pickup at `:864-868` and `:1000`.
- **Proposed solution:**
  - Add `vitest` as a dev dependency, with `"test": "vitest run"` in `crazy-goal/package.json`. This is the same runner the sibling project `everything-is-a-weapon` uses.
  - Create `src/progression/Progression.ts` with pure functions: `isLevelUnlocked(save, levels, index)`, `chapterOf(index)`, `chapterGate(chapter)`, `totalStars(save, fkStars)`, `coinsForGoal({firstClear, oldStars, newStars, total})`, `nextStarTarget(level, best)`.
  - Move the `CHAPTERS` table from `Overlay.ts:63-78` here, and have Overlay import it.
- **Files:** `crazy-goal/package.json`, new `src/progression/Progression.ts`, new `src/progression/Progression.test.ts`, `src/ui/Overlay.ts`, `src/core/Game.ts`.
- **Implementation:** at first, extract the current behaviour unchanged, and have `Game.isUnlocked` delegate to it. Behaviour changes come in later tasks, each with tests.
- **Acceptance:** `npm test` passes. The game behaves exactly as before; play houma 1–3 to check.
- **Testing:** unit tests of the current rules (any goal unlocks; coins = `max(5, round(total/100))`).

#### 0.2 Save version 2 with migration
- **Objective:** never lose a player's progress.
- **Current situation:** `SaveManager.ts:35` returns `fresh()` on any version other than 1.
- **Proposed solution:**
  - `VERSION = 2`.
  - `parse` accepts v1 and migrates it: keep everything, and add the new fields with defaults.
  - An unknown *future* version still parses the known fields rather than wiping.
  - New fields:
    - `levels[id].coin: boolean` (the level coin has been collected);
    - `levels[id].paidStars: number` (stars already paid in coins; migrate as `stars`, so nobody is paid twice);
    - `tips: string[]` (one-time tips seen);
    - `boostIntro: boolean`;
    - `freeBoosts: Partial<Record<Boost, number>>`;
    - `fk: { coinsPaid: Record<stageId, number> }`;
    - `daily: { lastDate: string, streak: number, results: Record<date, string> }`;
    - `seenSkins: string[]`.
- **Files:** `src/save/SaveManager.ts`, a new test `src/save/SaveManager.test.ts`.
- **Acceptance:** a v1 save JSON fixture loads with identical levels, coins and skin, and gains the defaults. Garbage JSON still gives `fresh()`.
- **Testing:** unit tests for v1 → v2, v2 round trip, unknown version, corrupt JSON.

---

### Phase 1 — Structure and core loop

#### 1.1 Make the score targets visible
- **Objective:** the player always knows what the next star needs.
- **Current situation:** the targets exist only in data (`houma.ts`, `stars: [2★, 3★]`). The gameplay HUD has no score plaque since `09e07cf`. The result card (`HUD.ts:323-456`) shows earned stars and NEW BEST only.
- **Proposed solution:**
  1. **Target strip** under the top bar during `ready`/`aiming`: three small star pips with thresholds (`★ GOAL · ★★ 1,400 · ★★★ 2,600`). Pips already earned on this level are filled. It hides during flight so the shot stays clean. Draw it on the canvas in `HUD.ts`, styled like the existing pills.
  2. **Next-star line** on the result card under the stars:
     - `★★ AT 1,400`, plus a hint chosen by `nextStarTarget`: "bounce it off a wall" when the goal had 0 bounces, "use the street" when no mechanic label, otherwise "go crazier".
     - At 3★: "PERFECT HOUMA".
     - A miss shows nothing new.
  3. **Level tiles** (`Overlay.showLevels`, `Overlay.ts:377-432`): show best score, and target of the next star when the level has under 3★.
- **Files:** `src/ui/HUD.ts`, `src/ui/Overlay.ts`, `src/progression/Progression.ts`, `src/core/i18n.ts`.
- **Dependencies:** 0.1.
- **Acceptance:** on houma 1 the strip reads 1,400 / 2,600. After a 0-bounce goal the card says how to get ★★. RTL works in Arabic. The strip never overlaps the boost column or the pause button from 320×568 to 1920×1080.
- **Testing:** unit-test `nextStarTarget`. Manual check on houma 1, 25 and 100, in EN and AR, portrait and landscape.

#### 1.2 Fix the coin economy
- **Objective:** coins are earned by progress, not farming.
- **Current situation:** every goal pays coins (`Game.ts:938-941`); the coin respawns per retry (`Game.ts:1000`); duel streets also pay the pickup (`REPORTED`, no `shotRule` guard at `Game.ts:864-868`).
- **Proposed solution (tunable constants in `Progression.ts`):**

  | Source | Coins | Rule |
  |---|---|---|
  | First clear of a level | `max(10, round(total/100))` | Once per level (`goals` was 0) |
  | Each new star on a level | +10 per star above `paidStars` | Then `paidStars = stars` |
  | Level coin | +10 | Once per level ever (`coin` flag). After that it is drawn as a faint outline and pays nothing |
  | Replay goal, no new star | 0 | The result card shows no coin line |
  | Duel streets | 0 | No coin is drawn in duels |

  Boost prices stay as they are (15 / 20 / 15, `Cards.ts:36-40`).
- **Files:** `src/core/Game.ts` (`collectCoin`, `scoreGoal`, `resetShot`), `src/levels/coinPlacement.ts`, `src/rendering/*`, wherever the coin is drawn (search for `coinX`), `src/ui/HUD.ts` (coin line), `src/progression/Progression.ts`.
- **Dependencies:** 0.2.
- **Acceptance:**
  - Scoring houma 1 ten times pays coins once.
  - Improving ★ to ★★★ pays +20.
  - The coin is collectable once and stays collected after a reload.
  - Duel streets show no coin.
- **Testing:** unit tests for `coinsForGoal`. In the dev console, use `__cg.level(1)`, then `__cg.shoot`, several times, and check the coins.

#### 1.3 Chapter star gates
- **Objective:** stars become the currency of progression, so the style score matters.
- **Current situation:** levels open on any goal; chapters gate nothing.
- **Proposed solution:**
  - Inside a chapter, unlock stays as today: a goal on level i−1 opens level i.
  - The first level of chapter `c ≥ 2` additionally requires `totalClassicStars ≥ GATE_PER_CHAPTER × (c − 1)`, with `GATE_PER_CHAPTER = 16` (12 levels × 1★ = 12, so 4 extra stars per chapter). Chapter 9 (THE FINALS) needs 128 of the 288 stars available before it.
  - **Grandfathering:** a chapter in which any level already has `goals > 0` stays open forever.
- **Files:** `src/progression/Progression.ts`, `src/core/Game.ts` (`isUnlocked`, `furthestUnlocked`, `nextLevel`), `src/ui/Overlay.ts` (locked tile text).
- **Dependencies:** 0.2, 1.1 (targets must be visible before stars gate anything).
- **Acceptance:** with a fresh save, houma 13 is locked after clearing 1–12 with exactly 12★, and opens at 16★. An old save with progress in chapter 5 keeps chapters 1–5 open. NEXT HOUMA on the last level of a chapter whose gate is unmet opens the level map scrolled to the gate, not a locked level.
- **Testing:** unit tests for gates and grandfathering. Manual check of the transition at houma 12.
- **ASSUMPTION:** 16 is a starting value. Tune it with analytics (4.3).

#### 1.4 Onboarding that teaches the score
- **Objective:** teach "crazier scores more" in the first three houmas, and introduce boosts when they matter.
- **Current situation:** a pill and a ghost on houma 1 only (`HUD.ts:65, 221-226`). The boost column shows from houma 1 with disabled cards (`AbilityBar.ts:40-108`).
- **Proposed solution:**
  - One-time tips stored in `save.tips`, each a short pill in the existing pill style, dismissed by the next shot:
    - `bank` (houma 2, before the first shot): "Bounce it off a wall — every bounce multiplies your score."
    - `labels` (first goal using a mechanic): "OFF THE TAXI! Using the street earns bonus points."
    - `chain` (first CHAIN REACTION): "Three different things in one shot — CHAIN REACTION."
  - The boost column is hidden until houma 6. On first reaching it, show a one-time intro card ("BOOSTS: stuck? Burn through, pull it in, or bounce forever") and grant `freeBoosts.magnet = 1`. A free charge shows "FREE" instead of a price.
- **Files:** `src/ui/AbilityBar.ts`, `src/ui/HUD.ts`, `src/core/Game.ts`, `src/core/i18n.ts`, `src/save/SaveManager.ts`.
- **Dependencies:** 1.1, 1.2.
- **Acceptance:** a fresh save sees no boost column on houmas 1–5. Each tip appears exactly once across reloads. The free MAGNET is consumed on use and not refunded as coins.
- **Testing:** manual run of a fresh save through houma 6, in EN and AR.

#### 1.5 The shell bridge `window.CrazyKoraShell`
- **Objective:** Free Kicks takes part in the career without importing Classic.
- **Current situation:**
  - `src/freeKicksAssets.ts` publishes only asset URLs.
  - Free Kicks reads `crazy-goal-save` directly for volume (`free-kicks.js:1457-1459`, `REPORTED`).
  - `game-modes.js` finds the Classic DOM by class names and a body-wide `MutationObserver`.
- **Proposed solution:** a new `src/shell/Shell.ts`, created in `main.ts` after `new Game(...)`, publishes:

  ```ts
  interface CrazyKoraShell {
    version: 1;
    lang: 'en' | 'ar';
    wallet: { coins(): number; earn(n: number, reason: string): void };
    stars: { classic(): number; freeKicks(): number; total(): number; max(): number };
    fk: { recordStage(stageId: string, stars: number): number /* coins paid */ };
    skin(): { id: string; colors: { base: string; patch: string; seam?: string } };
    audio: { muted(): boolean; volume(): number; onChange(cb: (muted: boolean, volume: number) => void): () => void };
    portal: { gameplayStart(): void; gameplayStop(): void };
    openSettings(): void;
    menu: { registerModeTile(id: 'freeKicks', open: () => void): void; refresh(): void };
  }
  ```

  - Classic owns all writes to `crazy-goal-save`; Free Kicks never writes it.
  - Free Kicks progress stays in `crazy-kora-fk-progress`. The shell reads it (read-only) for `stars.freeKicks()`.
  - `freeKicksAssets.ts` stays as it is, and the shell is added next to it.
- **Files:** new `src/shell/Shell.ts`, `src/main.ts`, `src/core/Game.ts` (expose what the shell needs, without moving logic), `src/ball/Skins.ts` (colours for the bridge).
- **Dependencies:** 0.2.
- **Acceptance:** `window.CrazyKoraShell` exists before the deferred Free Kicks scripts run (same ordering argument as `CrazyKoraAssets`, `docs/FREE_KICKS.md` §2). Muting in Classic fires `onChange`.
- **Testing:** unit-test the shell with a fake Game, if practical. Otherwise check in the dev console.

#### 1.6 Free Kicks joins the career
- **Objective:** what the player does in Free Kicks counts.
- **Proposed solution (all in `free-kicks/`, through `window.CrazyKoraShell` when present, with today's behaviour as the fallback when absent):**
  - **Stars and coins:**
    - Wire `onSetEnd` (exists, unused: `free-kicks.js:2263`). Pass it from `game-modes.js:592-600` and call `shell.fk.recordStage(stageId, stars)`.
    - The shell pays 10 coins per new star above `fk.coinsPaid[stageId]`, plus a first-clear bonus of 20.
    - The stage-complete card shows the coins earned.
  - **Ball skin:** replace the hard-coded `SKIN` (`free-kicks.js:75`) with `shell.skin().colors` at `start()`.
  - **Audio:** subscribe to `shell.audio.onChange` and update the `AudioBus` master gain live. Remove the direct read of `crazy-goal-save`.
  - **Portal:**
    - `gameplayStart` on the first aim of a kick.
    - `gameplayStop` on stage-complete, back and pause.
    - No ads inside Free Kicks runs.
  - **Star total:** the menu star pill shows `total()` out of `max()` (300 + 15 campaign Free Kicks stars). Skin thresholds (`Skins.ts`) stay unchanged and are measured against the total.
- **Files:** `free-kicks/free-kicks.js` (CRLF), `free-kicks/game-modes.js`, `src/shell/Shell.ts`, `src/ui/Overlay.ts` (star pill), `src/core/Game.ts:335, 342, 422-423` (star total for skins).
- **Dependencies:** 1.5.
- **Acceptance:**
  - Clearing Free Kicks stage 1 with 4 goals adds 2★ to the menu total and pays 40 coins (20 + 2×10). Replaying with 4 goals pays 0.
  - The selected skin is the ball in the arena.
  - Muting in Classic mutes Free Kicks on its next sound without a restart.
- **Testing:**
  - `node free-kicks/tools/tests/progress.test.js`
  - `node free-kicks/tools/tests/physics.test.js`
  - `node free-kicks/tools/check-strings.js`
  - `node free-kicks/tools/sync-cards.js --check`
  - `node free-kicks/tools/validate.js --check`
  - Plus four enter/exit cycles: one `AudioContext` closed per visit (`docs/FREE_KICKS.md` §12).

---

### Phase 2 — Navigation, interface and visual cohesion

#### 2.1 New main menu; remove GAME MODES
- **Objective:** one clear hero action and two visible ways to play.
- **Current situation:** the menu is built in `Overlay.ts:160-223`. GAME MODES is injected by `game-modes.js:704-733` (body-wide `MutationObserver`). Its background asset is broken in dev (`game-modes.css:22`). The CHOOSE YOUR PLAY screen (`game-modes.js:348-400`) duplicates Classic.
- **Proposed solution:** the layout in §4.
  - `Overlay` builds the two mode tiles. The HOUMAS tile reuses the courtyard art currently on the menu. The FREE KICKS tile calls the function registered through `shell.menu.registerModeTile`.
  - `game-modes.js` registers `openFreeKicks` and opens its hub directly.
  - Delete `injectMenuEntry`, `watchMenu`, the modes screen and the `.gm-entry` CSS, including the hashed URL.
  - The hub's BACK goes to the main menu.
  - LET'S PLAY gets a DOM subline with the continue target. The current `.menu-play` is image art without text (`REPORTED`, `styles.css:1244-1271`); keep the image.
  - The top-left HOUMA and BALLS icons move: HOUMA becomes the tile, and BALLS goes to the secondary row.
- **Files:** `src/ui/Overlay.ts`, `src/styles.css`, `free-kicks/game-modes.js`, `free-kicks/game-modes.css`, `src/core/i18n.ts`.
- **Dependencies:** 1.5, 1.6.
- **Acceptance:**
  - No `MutationObserver` remains in `game-modes.js`.
  - The menu fits without scrolling at 320×568 (allowing a short scroll only below 360 px tall), 375×812, 430×932, 768×1024 and 1920×1080, in EN and AR.
  - Every button is reachable by Tab.
  - Esc in the hub returns to the menu.
  - Free Kicks opens in one tap from the menu.
- **Testing:** screenshots at the listed sizes in both languages, plus a full keyboard pass.

#### 2.2 Free Kicks unlock moment
- **Objective:** discover the second mode at the right time.
- **Proposed solution:**
  - Free Kicks is locked until `houma-03` has `goals > 0`; grandfather any save with Free Kicks progress.
  - On the first result after that goal, show an unlock card over the result: "FREE KICKS IS OPEN — Five kicks. One wall. Mimi in goal." [TRY IT] [KEEP GOING].
  - TRY IT opens the hub, and the Free Kicks tutorial runs as today.
- **Files:** `src/ui/Overlay.ts`, `src/core/Game.ts`, `src/progression/Progression.ts`, `src/core/i18n.ts`.
- **Acceptance:** fresh save: the tile shows "SCORE IN HOUMA 3" and does nothing on tap except shake and show the hint. The card appears exactly once.

#### 2.3 Shared design tokens
- **Objective:** one visual language.
- **Current situation:** `.gm-root` and `.fk-*` copy hex values into their own variables (`game-modes.css:78-89`, `free-kicks.css:9-16`, `REPORTED`). Classic tokens are in `styles.css:1-17`.
- **Proposed solution:** define each `--gm-*` and `--fk-*` as `var(--classic-token, <current hex>)`, so they follow Classic and still work alone. Do not restyle Free Kicks screens beyond what the shared tokens change.
- **Acceptance:** changing `--sun` in `styles.css` changes the Free Kicks accents. There are no visual regressions in a screenshot comparison of the hub and arena.

#### 2.4 Level map with chapter gates
- **Proposed solution:** the chapter header in `Overlay.showLevels` shows `★ 23 / 36` and, for a locked chapter, "16 ★ TO OPEN — you have 14". Each level tile shows a badge for its next star target (from 1.1) and a coin dot if the coin is uncollected (from 1.2). Replace the 🔒 emoji (`Overlay.ts:427`) with the existing lock styling or an SVG.
- **Acceptance:** a player blocked by a gate can see which levels still have stars to gain, at a glance.

#### 2.5 Free Kicks HUD consistency
- **Proposed solution:** add a settings / pause affordance to the Free Kicks HUD that calls `shell.openSettings()` and returns to the arena (sound, music, language). Keep its BACK. Keep the GROUND / AIR and bend controls exactly as they are.
- **Acceptance:** volume changed from inside Free Kicks applies immediately and persists.

#### 2.6 Defect sweep
- Fix the skin aria label (`Overlay.ts:366`).
- Stop coin drawing and pickup in duels (if not already done by 1.2).
- Update `README.md`:
  - remove the "Not built yet" line and the "Connecting ads and analytics" section claims;
  - fix the `Music.ts` statement and the garbled sentence at `:58`;
  - document modes, economy and the shell.
- Update `docs/FREE_KICKS.md` §2, §10 and §14 for the shell (Free Kicks no longer reads `crazy-goal-save`).
- **Acceptance:** the docs match the code. `npm run build` is clean.

---

### Phase 3 — Engagement and retention

#### 3.1 Daily Kick
- **Objective:** a reason to return every day, and something to share.
- **Current situation:** `drawQuick(seed)` (`free-kicks.js:944`) is pure and validated (`check-quick.js`: 20,000 draws obey every rule). Quick Five is locked behind a star on stage 3.
- **Proposed solution:**
  - Seed: `seedForDate(YYYY-MM-DD local)`, a deterministic mapping into the `SEED_CHARS` alphabet (`free-kicks.js:906`). It is the same for every player on that date.
  - A DAILY KICK card at the top of the hub, available once Free Kicks is open (not gated on stage 3).
  - **One scored attempt per day.** Later plays are practice and are marked as such.
  - The result card shows the five outcomes as a line (`⚽⚽❌⚽⚽`), the streak, and a SHARE button. SHARE uses `navigator.share`, falls back to the clipboard, and puts the date, the line and the game URL in the text. Never use an external service.
  - Streak: +1 if yesterday was played; the record is in `save.daily` through the shell.
  - Pays 5 coins per goal + 25 for 5/5. The menu tile shows a DAILY ● dot until today's attempt is done.
- **Files:** `free-kicks/free-kicks.js`, `free-kicks/game-modes.js`, `src/shell/Shell.ts`, `src/save/SaveManager.ts`.
- **Acceptance:**
  - Two browsers on the same date get the same five kicks.
  - A reload cannot reset the scored attempt.
  - Midnight rollover uses local time.
  - The share text has no personal data.
- **Testing:** unit-test `seedForDate` for determinism and for the alphabet. Run `check-quick.js` unchanged.

#### 3.2 Legend stage
- **Proposed solution:** show `legend-future` as stage 6, "LEGEND", in the hub, unlocked by 1★ on stage 5. The data and unlock rule already exist (`free-kicks.js:867-868`); only the hub filter (`game-modes.js:467`) hides it. Use the universal 3/4/5 star rule, which is what the code implements. The 2/3/4 exception described in `docs/FREE_KICKS.md` §9 stays unimplemented.
- **Acceptance:** after 1★ on stage 5 the Legend row is playable and its stars count in the total (the maximum becomes 318).

#### 3.3 Level variety pass for chapters 1–2
- **Objective:** the first 24 levels, where retention is decided, should not look like the same alley.
- **Current situation:** in the whole game, 95/100 levels use the centred goal and 80 share the start (800, 1010) (`REPORTED`).
- **Proposed solution:** in houmas 2–24, move the goal (`goalAt`) on at least 8 levels and the ball start on at least 8, without changing which mechanic each level introduces. For every edited level:
  - run `__cg.sweep(n)`;
  - require at least 3 distinct scoring routes, and a 3★ route reachable at 1° aim steps;
  - re-set `stars` thresholds only if the sweep requires it, recording old → new in `docs/2026-11-07-level-overhaul-validation.md`.
- **Files:** `data/levels/houma.ts`, the validation doc.
- **Acceptance:** a validation table for every edited level is added to the doc. No level is impossible.

#### 3.4 Ball unlock moments
- **Proposed solution:**
  - When the star total crosses a skin's `need`, show a toast after the result card ("NEW BALL: <name>" with a [USE IT] action), and add a NEW dot on BALLS until the skins screen is opened (`save.seenSkins`).
  - The result card shows "3 ★ to the next ball".
- **Acceptance:** each unlock is shown exactly once, including unlocks earned in Free Kicks.

---

### Phase 4 — Commercial optimisation

#### 4.1 Rewarded-ad moments
- **Current situation:** the only rewarded ad is +30 coins in the pause menu, with a 90 s cooldown (`Game.ts:637-643`, `Portal.ts:12`). Midrolls run at NEXT HOUMA from level index 2, every 180 s (`Portal.ts:16-18`).
- **Proposed solution:** keep the midroll rules. Replace the pause-menu offer with moments where the player actually wants help:
  1. **Stuck assist:** after 4 misses on one level in a session, a small chip appears over the boost column: "STUCK? FREE MAGNET ▶". The ad grants a `freeBoosts.magnet` charge. Coins remain the no-ad alternative.
  2. **Double first-clear coins:** on the result card of a first clear only, "×2 COINS ▶".
  - No reward on `adError`.
  - Never during aiming, flight or a celebration, and never in duels or inside a Free Kicks run.
  - Respect the existing cooldown.
  - Keep the pause +30 offer as a fallback only if the owner wants it.
- **Files:** `src/portal/Portal.ts`, `src/core/Game.ts`, `src/ui/AbilityBar.ts`, `src/ui/HUD.ts`, `src/ui/Overlay.ts`.
- **Acceptance:** on CrazyGames local mode (the SDK test overlays), each offer appears only in its moment and grants only on `adFinished`.

#### 4.2 Free Kicks in the CrazyGames build — **owner decision required**
- **Current situation:** `vite.config.ts` excludes Free Kicks from `--mode crazygames`. `docs/FREE_KICKS.md` §14 says this must stay so unless explicitly requested.
- **Recommendation:** include it once 1.6 and 4.1 are done. It adds the Daily Kick and a second mode to the main distribution channel at a negligible size cost.
- **Implementation:**
  - Remove the `mode !== 'crazygames'` guard in `freeKicks()`.
  - Make sure all portal signals go through the shell.
  - Run `npm run build:crazygames`.
  - Check the size budget (README: initial download about 6 MB, limit 20 for the mobile homepage).
- **Do not start this task without the owner's written approval.**

#### 4.3 Analytics sink
- **Proposed solution:** add `src/analytics/Analytics.ts`, a subscriber on the existing `EventBus`, as the README already suggests. Its events:
  - `level_start`, `level_goal {stars, score, attempts}`, `level_gate_blocked`;
  - `fk_stage_end`, `daily_done`;
  - `boost_used`, `ad_offer` / `ad_done`.

  The provider interface has a console provider in dev and a no-op in production until the owner picks a provider. This is what tunes `GATE_PER_CHAPTER`, the coin values and the stuck threshold.
- **Acceptance:** in dev, the console shows the funnel for a fresh-save session. Production sends nothing.

---

## 7. Testing and QA

**Automated (after every task):**
- `npm run build` (includes `tsc --noEmit`).
- `npm test` (from 0.1).

**Free Kicks tool suite** (after any `free-kicks/` change):
- `node free-kicks/tools/sync-cards.js --check`
- `node free-kicks/tools/check-strings.js`
- `node free-kicks/tools/check-quick.js`
- `node free-kicks/tools/tests/physics.test.js`
- `node free-kicks/tools/tests/progress.test.js`
- `node free-kicks/tools/validate.js --check`

**Per-phase manual pass** (dev server: `npm run dev`, or `.claude/launch.json` → `crazy-kora-dev` on port 5184):

| Phase | Script |
|---|---|
| 0 | Load a v1 save fixture (paste it into `localStorage['crazy-goal-save']`), reload, and check that levels, coins and skin are intact |
| 1 | Fresh save: houma 1–13 (targets, tips, coins once, boost intro at 6, gate at 13). Then Free Kicks stage 1: stars and coins land, the skin shows, mute is live |
| 2 | Menu at five sizes × EN/AR; Tab and Esc through every screen; FK tile lock and unlock card; level map gate display |
| 3 | Daily Kick on two browsers with the same date; reload during the run; share text; streak across a mocked date change; Legend unlock; sweep output for each edited level |
| 4 | CrazyGames local SDK: midroll, stuck offer, ×2 offer, `adError` path; `npm run build:crazygames` only after approval |

**Regression guards:**
- Duels still play end to end against the site API (`npm run dev` with the site on port 3210).
- An itch / static build of `dist/` runs from a sub-folder.
- `public/arcade/crazy-goal/` is refreshed only when the owner asks for a deploy.
