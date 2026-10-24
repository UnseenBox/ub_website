# BONK Progression — “One More Room” Design

**Date:** 2026-10-23  
**Revised:** 2026-10-24 after builder review  
**Status:** APPROVED — 2026-10-24. Build via TDD from the implementation plan.  
**Scope:** the campaign, run flow, results, lobby, store, daily shift, collection, save data, and CrazyGames package.

---

## 1. The problem

BONK already has the bones of a progression game:

- a 50-room campaign with five acts and 20 bosses;
- 11 Edge definitions with stacking effects;
- a Star Ledger with nine permanent rewards;
- scrap, abilities, discoveries, challenges, contracts, and a daily challenge;
- save fields for an active run, run floor, streak, boosts, and score.

Almost none of it is reachable. The player clears rooms, sees a receipt, and goes back to the key wall. `offerEdges`/`chooseEdge` are unreachable, `continueRun` has no button, the Store is a static “SOON” rack, Daily and Descend have no entries, and the Ledger is only inferred from a results line. Only 390 scrap of permanent sinks exist. The five proposed upgrade tracks raise that to 26,810, enough to make scrap matter across several campaigns. The HUD shows saved scrap, not the scrap earned in the current room. A player cannot see or feel a build.

The fix is not another game. It is to wire the dormant systems into one readable loop, then make every step loud enough to want the next one.

## 2. The promise

- **Every room clear moves the run forward; every second room and every boss gives a real choice.** Three Edges, pick one, keep it for the run. Each Edge caps at three stacks, so the choice never becomes an infinite counter.
- **Every run visibly gets stronger.** The HUD, lobby, pause screen, and results all show the floor, streak, score, and current build.
- **Failure still pays forward.** Meta progress is permanent, and an ordinary room failure keeps the run’s build. The failed room itself pays no salvage, so failure still costs something.
- **There is always a next unlock in sight.** The lobby shows the next star reward or the next affordable store item.
- **There is a reason to come back tomorrow.** A daily room, a streak, and a day-7 legendary Edge.
- **The collection is a story of stupidity.** The Evidence Board turns discoveries into a completable book.
- **No parallel currency.** Scrap and stars keep doing the work.

Success looks like: a player clears room 1, takes an Edge, immediately presses **NEXT ROOM** to see what the Edge does; room 2’s receipt says **NEXT EDGE · ROOM 3**, so the next choice is always one room away; after a failure they press **RETRY** because the build is still there; the next day they open the lobby to see the daily chip and the next star reward.

## 3. Goals and non-goals

### Goals

1. Make the Edge draft the main reward on draft rooms.
2. Make the active run impossible to lose track of.
3. Give scrap enough permanent sinks for multiple campaigns, not just one.
4. Make the Star Ledger a visible 27-star track, with the 150 campaign stars shown as a separate completion stat.
5. Give the daily challenge an entry point that does not threaten the active run.
6. Make the discovery collection completable and readable.
7. Keep the existing 50-room campaign, boss schedule, final-victory and daily victory screens simplified, no cutscenes, and the three-spike Kid crest exactly as they are.
8. Keep the CrazyGames package current, small, and functional.

### Non-goals

- No new currency, battle pass, loot boxes, or timed shop.
- No new rooms, bosses, heroes, pets, or Edge definitions in this pass. The existing 11 Edges are enough once the draft cadence drops to roughly 30–35 offers and stacks cap at three. Hero/pet unlocks are a later layer.
- No online leaderboards or accounts.
- No new cutscenes or story campaign.
- No procedural changes to the 50-room campaign or the 20-boss schedule.
- No mid-run home-upgrade store. Powers remain available from the pause menu; home upgrades are bought from the flat between runs.
- No respec. Purchases are permanent and final.
- No modal on reload. A pending Edge offer is persisted and auto-resolves to its first card so the run never loses a reward.

## 4. The loop

```
HOME
  ├─ CONTINUE RUN ──► ROOM ──► CLEAR ──► RESULTS (stars, scrap, run stats; draft on draft rooms)
  │                                      ├─ PICK EDGE ──► NEXT ROOM ──► …
  │                                      ├─ HOME ──► run saved
  │                                      └─ REPLAY ROOM ──► new run (confirm)
  │
  ├─ PLAY / KEY WALL ──► start a new run at the selected room
  ├─ DAILY SHIFT ──► one special room ──► daily receipt ──► HOME (campaign run untouched)
  ├─ STORE ──► spend scrap on permanent home upgrades / powers
  ├─ ROOMS ──► key wall, LEDGER tab, EVIDENCE tab
  └─ CHARACTERS / SETTINGS
```

Failure path:

```
ROOM ──► FAIL ──► RESULTS (build kept, streak reset, retry)
                    ├─ RETRY ──► same room, same build
                    └─ HOME ──► run saved at that floor
```

Final path:

```
ROOM 50 ──► FINAL VICTORY ──► run ends; stars, ledger, collection remain
```

### First ten minutes

1. The first-visit flow still drops the player straight into room 1 and teaches by doing.
2. Room 1 clears. The receipt now has a **TAKE AN EDGE** side panel with three cards. The primary button says **PICK AN EDGE** and is disabled. The player picks one; the button becomes **NEXT ROOM**.
3. Room 2 starts with the HUD showing `STREAK 1`, `EDGE 1`, and the room scrap in the wallet. The next room teaser on the results screen said exactly where they were going.
4. Room 2 clears without a draft. The receipt stays simple and shows **NEXT EDGE · ROOM 3**; the next choice is visible before the player can lose track of it.
5. The lobby’s goal strip shows the next star reward or the cheapest upgrade. The Store is now a real store.

### A return session

- The daily chip is ready. It shows the streak and starts the daily room without touching the campaign run.
- The lobby still shows **CONTINUE RUN** at the saved floor.
- The Star Ledger tab shows the next 27-star reward and how many stars are missing, with the 150-star campaign total beside it.
- The Evidence Board shows the missing recipes as clues.

## 5. Run model

### 5.1 What a run is

A campaign run starts when the player starts a campaign room from the lobby, key wall, or first-visit flow. It carries:

- `runFloor` — the next room index (0-based);
- `runStreak` — consecutive campaign rooms cleared without failing;
- `runBoosts` — Edge ids; duplicates are stacks, each Edge capped at three;
- `runScore` — the score carried into the next floor;
- `runInsuranceUsed` — whether FINE PRINT has spent its charge;
- `runOffer` — up to three offered Edge ids while a draft is pending, so a reload can auto-resolve it;
- hero, permanent upgrades, and meta progress from the save.

A daily room is **not** a campaign run. It never mutates `runFloor`, `runStreak`, `runBoosts`, or `runScore`, and it never ends the campaign run. A player can do the daily in the middle of a campaign run and return to **CONTINUE RUN** afterward.

### 5.2 Continue

The lobby is the run’s home base.

- If `runActive` is true and the floor is valid, the big button says **CONTINUE RUN** and its subline says `FLOOR 12 · STREAK 4 · 3 TYPES · 12,400`.
- Pressing it calls `Game.continueRun()`, not `playFrom()`.
- The key wall opens on the active floor and pins a small **RUN IN PROGRESS** banner. Selecting the active floor and pressing **ENTER ROOM** continues; selecting a different floor changes the button to **START NEW RUN** and shows “CURRENT RUN ENDS.”
- Starting a new run is explicit and needs a second tap. It resets floor, streak, boosts, score, the pending offer, and the FINE PRINT charge, but keeps stars, scrap, upgrades, discoveries, contracts, and the daily streak.
- The room sheet’s ENTER button should actually start the room, not just close the sheet. Today it only closes; this pass fixes that.

The pause menu still offers **MAIN MENU**, but when a run is active the label reads **MAIN MENU · RUN SAVED**. This is the “I’ll come back” promise.

### 5.3 Failure

**Recommended design call:** an ordinary room failure keeps the run and the build. It resets the streak and the score to the start of the failed room. `RETRY` restarts the same room with the same Edges. The run only ends on the final victory or when the player explicitly starts a new run.

Why:

- The campaign is 50 rooms. Losing a 40-room build to one bad room is a rage-quit, not a lesson.
- It makes the Edge draft feel like ownership. The build is the player’s toy; the room is the challenge.
- It fits the kid-friendly, “one more go” tone.
- The cost is real: the failed room pays **no salvage and no score**, the streak multiplier from CROWD PLEASER collapses, the room best is not set, and the run score rolls back to the start of the failed room. The player still wants to avoid failure.

This is the one decision that changes the stakes enough to flag for explicit approval. If the user wants harsher stakes, the alternative is “one free retry per run, then the run ends”; it is a small change to `Run.recordFail` and the results copy, but it complicates the save and the retry flow.

Implementation consequences:

- `Run.recordFail` resets `runStreak` to 0 and `runScore` to `scoreAtRoomStart`; it does not end the run.
- `Game.retryAfterFail` always restarts the current room (daily or campaign) except for the ad path. The old `index >= handcraftedCount` “end the run” branch goes away.
- `RoomSummary.run.ended` is true only for the final victory. The failure screen shows **EDGES KEPT · STREAK RESET** and **NO SALVAGE**.
- `runActive` remains true after a failure, so **CONTINUE RUN** resumes the failed room.
- The final room can also be retried with the build. The run ends on victory.
- Failure does not update `highScore`, `roomBests`, stars, or contract counters. `bestChain` may still update because it is a personal record, but it never pays scrap.
- `REPLAY ROOM` and starting a different key-wall floor need a second tap before they can wipe a build.

### 5.4 Score and room bests

The score is cumulative across the run. The results screen should show both:

- **RUN SCORE** — the big number, which is the score carried through the run;
- **THIS ROOM** — the delta earned in the room just played.

Per-room bests should use the **room score**, not the carried run total. The current code stores `this.score.score` (cumulative) in `roomBests`, so a late-run room always beats an early room regardless of how well it was played. Fix this in the same pass:

- `roomScore = this.score.score - this.scoreAtRoomStart`;
- `roomBests[id].score` compares and stores `roomScore`;
- `RoomSummary` gets `roomScore` and `isNewRoomBest`;
- the results screen can show a small **NEW ROOM BEST** line when it applies.

Because every existing `roomBests` value was written as a cumulative run score, v6 clears the old table once. Stars, high score, discoveries, and scrap are kept. The key wall starts collecting honest room scores from the first v6 clear. This is a deliberate one-time reset, not a data loss bug.

This keeps the key wall’s `BEST` honest once Edges make scores grow.

### 5.5 Run visibility

**Lobby:** continue button, run subline, and goal strip.

**HUD:** the health plate gets a compact run line under the health track:

- `STREAK 4` in lime when above 0, grey at 0;
- `EDGE 3` in lavender, meaning three Edge types owned, not three stack copies;
- hidden in daily mode; the room tag already shows `D`.

The room tag continues to show the floor number. The score chip continues to show the cumulative run score. The scrap slip shows **saved scrap + scrap earned in this room**, not just saved scrap, and pulses when the room total changes. On failure it snaps back to saved scrap and the results screen says **NO SALVAGE**. This makes the wallet feel live without pretending a failed room paid out.

**Pause:** a compact **CURRENT RUN** section above the powers shop shows floor, streak, run score, and the owned Edges with stacks. This is the “what am I carrying?” reference. It should be readable at a glance, not a wall of text.

**Results:** a run chip in the meta row and a build/teaser side panel (section 12).

## 6. Edge draft

### 6.1 Cadence

The draft is frequent enough to feel like the reward for playing, and rare enough that every choice matters.

- After **room 1**, so the system is taught immediately.
- Then after **every second room** (1-based odd rooms: 1, 3, 5, …). Room 2’s receipt points at room 3.
- After **every boss room**, even when the second-room cadence would skip it.
- Not after a daily room clear.
- Not after a failure.
- Not after the final room.
- A non-draft victory shows **NEXT EDGE · ROOM N** or **NEXT EDGE · BOSS** in its results strip, so the next choice is always visible.

This yields roughly 30–35 offers across a 50-room campaign, not 49. With 11 Edges and a three-stack cap, the pool is 33 picks deep; a full run can just about exhaust it, and no offer is ever a dead duplicate.

Each offer has up to three cards, one from each category (heavy, slick, greed), produced by `offerEdges(rng, forceRare, forceLegendary, owned)`.

- An Edge at **three stacks** is excluded from offers. If a category has no unmaxed Edge, that category is omitted; if all categories are maxed, no offer is generated and the results screen says **BUILD MAXED**.
- **Boss rooms** force one premium (rare or legendary) card in a randomly chosen category. Today `offerEdges` always upgrades heavy; that becomes a deliberate random pick so boss drafts do not all look the same.
- **Daily day 7** sets `dailyRareEdge`; the next campaign draft forces one **legendary** card and consumes the flag.
- A boss room and the daily flag can overlap. The offer then contains one boss rare and one daily legendary in different categories, so the day-7 reward is never wasted.
- Duplicates stack up to three. The card shows the current stack and what the next stack becomes: `NEW`, `OWNED ×1 → ×2`, or `OWNED ×2 → ×3`.
- The offer is generated in `Game.summarize` after `recordClear`, before the summary is returned.
- The offer uses the room’s RNG state, so it is deterministic for a given playthrough.
- The offer ids are persisted as `runOffer` so a reload can auto-resolve the draft; the chosen id alone goes into `runBoosts`.
- `dailyRareEdge` is consumed only when an offer is actually generated. If the next draft would be after the final room, the flag waits for the next run.

### 6.2 Draft UI

The results panel already has dormant CSS for this: `.b2-report__side`, `.b2-report__edges`, `.b2-edge`, rarity borders, and the next-room teaser. Use it instead of inventing a new overlay.

Layout on a normal victory:

- The panel drops `b2-report--simple` when an offer exists and uses the two-column report grid.
- Left side: the receipt (score, stars, challenge, first clear, contracts, ledger, discoveries).
- Right side, top to bottom:
  1. **TAKE AN EDGE** — up to three stacked cards. This is the first thing in the side column.
  2. **YOUR BUILD** — owned Edges with stacks, or “NO EDGES YET.”
  3. **NEXT** — the next room teaser with the room number, name, and a BOSS tag when relevant.
- The primary button starts as **PICK AN EDGE** and is disabled. After a pick it becomes **NEXT ROOM** with the chevron.
- `REPLAY ROOM` and `HOME` remain available but are secondary. When a draft is pending, `HOME` reads **HOME · SKIP EDGE**; a first tap changes it to **TAP AGAIN TO SKIP** so a stray tap cannot throw away the Edge.

Each card shows:

- category kicker: `HEAVY`, `SLICK`, or `GREED`;
- rarity: `COMMON`, `RARE`, or `LEGENDARY`, plus a left border color;
- name;
- one-line effect;
- a short flavor line;
- stack state: `NEW` or `OWNED ×2 → ×3`.

Interaction:

- Click/tap a card. The chosen card gets a lime border/`TAKEN` stamp; the other cards dim and disable.
- A live status line says “HEAVY HANDS TAKEN · NEXT ROOM UNLOCKED.”
- The primary button enables. Focus moves to the primary button after the pick.
- On entry, `UI.show` must not focus the disabled primary. The first Edge card carries `data-autofocus` and receives focus instead.
- Keyboard shortcuts `1`/`2`/`3` pick the corresponding card while the results screen is focused. This is a nice speedrun/desktop detail, not a requirement.
- `Game.chooseEdge(id)` guards against double picks. `Game.nextRoom()` refuses to advance while a draft is pending, so the `R` fast-restart shortcut cannot skip the choice.
- If the player goes HOME without picking, the run continues at the next floor without that Edge. The offer is forfeited and `runOffer` is cleared. The two-tap label makes that explicit. No modal trap.
- If the page reloads while an offer is pending, `runOffer` auto-grants its first card on load. The player loses the choice but not the reward.
- If the player chooses REPLAY ROOM, they start a new run and lose the build. The results screen shows “STARTS A NEW RUN · EDGES LOST” under the actions when a run is active, and the button needs a second tap.

Accessibility:

- Cards are real `<button>` elements with full `aria-label` text: name, rarity, effect, stack.
- The chosen card uses `aria-pressed="true"` or `aria-disabled="true"`; the status is `aria-live="polite"`.
- Rarity is never conveyed by color alone; the word is always present.
- Reduced-motion users get the state change without the stagger/pop.
- On mobile, the `side` area moves above the detailed notes so the choice is visible before the small print. The panel body scrolls; the action row stays outside the scroll.

### 6.3 Starting Edge

The Star Ledger’s `HEAD START` and `HEAD START II` already seed an Edge in `playFrom`. Keep that.

- On a new run, add the highest unlocked starting Edge (common, then rare replacement).
- It is part of the build and can be stacked by a draft up to the three-stack cap.
- It is shown in the results build list and the pause run section.
- It does not apply retroactively to an active run when the Ledger reward is claimed mid-run.

### 6.4 Edge content changes

- Rename the **display name** of `cat_frenzy` to **PET FRENZY** and its effect to “Your pet hits 50% harder.” Keep the internal id for save compatibility. The cat’s existing frenzy attack-speed bonus stays; the Edge now speaks to every hero instead of only the cat.
- Apply the Edge multiplier to every pet damage path: cat scratches, cat swipes, dog bites, parrot pecks, and hamster bowl strikes. Today only the cat uses it. A hero-specific Edge that does nothing for three of four heroes is a trap.
- Add the permanent **PET TRAINING** upgrade multiplier on top (section 8). A single `Game.petDamageMultiplier()` that composes `edges.petFrenzyMultiplier()` and the upgrade level keeps the four call sites consistent.
- The existing `cat_frenzy` id stays valid in old `runBoosts`; no migration is needed for the id. The display layer changes.

## 7. Star Ledger

### 7.1 What it is

The Star Ledger is the permanent star track: nine milestones from 3 to 27 stars. The campaign has 3 stars per room and 150 total, but the Ledger deliberately ends at 27; the 150-star total is a separate completion stat, not a promise that every star buys a Ledger reward. It already auto-claims and pays. This pass makes both numbers visible and honest.

Milestones (unchanged):

| Stars | Name | Reward |
|---:|---|---|
| 3 | SCRAP STIPEND | +100 scrap |
| 6 | CROWD FAVOURITE | +15% score |
| 9 | HEAD START | start each run with a common Edge |
| 12 | SCRAP STIPEND II | +150 scrap |
| 15 | SALVAGE RIGHTS | +20% scrap |
| 18 | HEAD START II | start each run with a rare Edge |
| 21 | SCRAP STIPEND III | +200 scrap |
| 24 | QUICK HANDS | -15% ability cooldowns |
| 27 | MASTER KEY | DESCEND begins at Depths depth 10 (floor 19) |

### 7.2 Screen

Add a **LEDGER** tab to the flat sheet.

- Head: `STAR LEDGER`, `12 / 27` for the reward track, and a progress bar to 27.
- A secondary line: `CAMPAIGN STARS · 12 / 150` with its own thin meter. It is a completion stat, not a reward track.
- A highlighted **NEXT REWARD** strip: `18★ · HEAD START II · START WITH A RARE EDGE · 6 STARS TO GO`.
- A vertical receipt of all nine milestones. Each row:
  - star threshold and star icon;
  - name;
  - reward text;
  - status: `PAID` (lime check), `NEXT` (highlighted), or `LOCKED` (dim).
- Footnote: “Stars come from clearing rooms, bonus objectives, and style. Rewards are paid automatically at the results desk.”
- If all nine are paid: “ALL LEDGER REWARDS CLAIMED. THE LEASE IS YOURS.” The 150-star line remains for completionists, with no dead claim button.

No manual claim button in normal play. `claimLedger` still runs on clear. The screen reflects state; it does not need a mutation path.

When a clear crosses one or more milestones, the results screen adds a loud **STAR LEDGER** strip with the reward name and `+100 SCRAP`, then counts the wallet up. This is the reward moment; it should not be buried in the small print.

The ledger screen is also reachable from the lobby goal strip when the current goal is a star reward. The goal strip opens the sheet directly on the LEDGER tab.

## 8. Store and permanent upgrades

### 8.1 The store is real now

The lobby’s STORE nav opens a new full screen, not the static “SOON” rack in settings. The static rack is removed from settings.

The store has two tabs:

- **HOME UPGRADES** — permanent stat upgrades bought with scrap;
- **POWERS** — the three existing abilities, with the same costs and effects as the pause shop.

The store header shows the scrap wallet and a one-line promise: “SALVAGE IN. PERMANENT POWER OUT.” If a run is active, a small note says “YOUR RUN IS SAVED. UPGRADES APPLY WHEN YOU CONTINUE.”

### 8.2 Upgrade tracks

Five tracks, each with clear levels, pips, and a next cost. Effects apply immediately to the next room; the current room is not retroactively changed (the store is lobby-only).

| Id | Name | Effect per level | Max | Costs |
|---|---|---|---:|---|
| `door` | REINFORCED DOOR | +1 max heart | 2 | 400, 1,600 |
| `scrap` | SCRAP SENSE | +10% scrap from defeated intruders | 4 | 200, 600, 1,500, 3,500 |
| `cooldown` | LIGHT FINGERS | -7% ability cooldowns | 4 | 250, 750, 1,800, 4,000 |
| `score` | CROWD WORK | +5% score | 4 | 220, 650, 1,500, 3,500 |
| `pet` | PET TRAINING | +12% pet damage | 4 | 240, 700, 1,600, 3,800 |

Why these caps and costs:

- **Max hearts 2 levels** (5 → 7) keeps the HUD’s heart row readable on phones. Eight hearts plus the HP number is too tight in the 230px mobile plate. Seven is the safe ceiling, so the door is the only two-level track and its second level is expensive.
- **Scrap** is deliberately only “from intruders.” It does not multiply first-clear bonuses, daily bonuses, contracts, or Ledger scrap. This prevents the meta economy from compounding itself. Four levels is +40%.
- **Cooldown** stacks multiplicatively with the Ledger’s 15% reduction. Four levels plus the Ledger is `0.93^4 × 0.85 = 0.636×`, strong but not a win button.
- **Score** stacks with the Ledger’s 15% and combo/streak multipliers. It is the “bragging” track and is priced slightly cheaper than the economic tracks.
- **Pet** makes the companion a real build choice and gives the four heroes a shared investment. Four levels is +48% pet damage.

Total upgrade sink: **26,810 scrap**. Plus 390 for the three powers: **27,200 scrap**. A clean 50-room campaign pays roughly 10,000–12,000 scrap after kills, first clears, contracts, and Ledger scrap, so maxing the catalog is a three-run goal; failures and partial runs stretch it to four or five. Early tiers stay affordable: the first purchase on every track is 200–400 scrap.

Before locking these numbers, run a scripted economy pass against the real enemy scrap table and a median clear. If max-out lands under three full runs, raise the final-tier costs rather than nerfing payouts.

### 8.3 Integration

- `door`: `Player` constructor takes a `maxHp` parameter (default 5); `Game.loadRoom` passes `5 + upgradeLevel('door')`. `hp` initializes to `maxHp`. HUD already reads `player.maxHp`.
- `scrap`: multiply `ScoreSystem.onEnemyDefeated`’s scrap by `upgradeScrapMultiplier(save)` alongside the Edge and Ledger multipliers.
- `cooldown`: multiply `AbilitySystem.cooldownFor` by `upgradeCooldownMultiplier(save)` alongside the Ledger multiplier.
- `score`: multiply `ScoreSystem.award` by `upgradeScoreMultiplier(save)`.
- `pet`: multiply all pet damage calls by `Game.petDamageMultiplier()`, which composes the Edge and upgrade multipliers.
- All purchases call `save.write()`; no purchase can take scrap below zero.
- A purchase updates the store in place: scrap wallet, level pips, effect line, next cost, and buy state. No full-screen rebuild, so focus and scroll survive.

### 8.4 Store UI

- Panel width ~1040px, scrollable body, actions in a grid.
- Each upgrade card uses the existing `.b2-shop-card` look with a new icon wrap:
  - REINFORCED DOOR — key icon;
  - SCRAP SENSE — coin icon;
  - LIGHT FINGERS — power-dash icon;
  - CROWD WORK — trophy icon;
  - PET TRAINING — a pet icon (hamster/parrot/cat/dog; use the selected hero’s pet or a generic paw). Reuse existing pet art; no new asset is required.
- Card content:
  - name and level pips (`●●○○` for a four-level track, `●○` for the door);
  - current effect, then “NEXT: +1 MAX HEART” or the next tier’s exact effect;
  - cost with coin icon, or `MAXED` stamp;
  - `BUY` button, disabled with reason `NEEDS 200 SCRAP` when unaffordable.
- The powers tab reuses the pause shop card visuals. Extract a shared `buildAbilityCard` helper so the two screens cannot drift.
- A top **NEXT UNLOCK** strip shows the cheapest unowned power or next upgrade. This is the same goal object used by the lobby strip.
- Buying plays a short unlock/stamp sound and pulses the card lime. The scrap wallet counts down; the card’s next state appears.
- Mobile: one column, large tap targets, tabs remain visible, the body scrolls.

### 8.5 Next unlock goal

A pure helper (`nextUnlock`) computes one goal from the save:

1. The next unreached Star Ledger milestone when it is **within three stars**. Stars are the rarer, more emotional reward; they get the strip when the player is close.
2. Otherwise the cheapest **affordable** unowned power or next upgrade. If one is affordable, the player can act now.
3. Otherwise the next unreached Star Ledger milestone.
4. Otherwise the cheapest **unaffordable** unowned power or next upgrade.
5. Otherwise “EVERYTHING UNLOCKED.”

The goal has: kind (`store` or `ledger`), kicker (`READY TO BUY`, `NEXT STAR`, `SAVE UP`, `DONE`), name, detail, progress 0–100, and an action.

- Store goal: progress is `scrap / cost`.
- Ledger goal: progress is `ledgerStars / milestone.stars`, not the 150-star campaign total.
- Done: 100%.

The store’s NEXT UNLOCK strip also shows the next 27-star milestone as a secondary chip, so the player never forgets the star track while shopping.

The lobby strip and the store’s NEXT UNLOCK strip use the same helper, so they cannot disagree.

## 9. Daily shift

### 9.1 Entry

Add a compact **DAILY SHIFT** chip to the lobby top row, beside the scrap chip. It is visible on mobile even when the left stat column is hidden.

- Not played today: `DAILY SHIFT · PLAY` + `STREAK 3`.
- Already played today: `DAILY DONE · PRACTICE` + `STREAK 3`. The label separates status from action; clicking starts a practice replay with no reward.
- Day 7 pending: a persistent `LEGENDARY EDGE READY` tag in the daily chip and the pause menu until the next draft consumes it.

The chip calls `game.playDaily()`. It does not touch the active campaign run. The daily room is the existing fixed-seed `dailyChallenge()` room.

### 9.2 Rules

- Daily rooms do not use Edges (`edges.setActive(false)` as today). The daily is a pure room-skill test.
- No Edge draft after a daily.
- First clear of the day:
  - advances the daily streak (consecutive calendar days) or resets to 1;
  - pays `min(50, 10 + streak * 10)` scrap;
  - pays the room’s in-room scrap;
  - counts one room clear and the lifetime kills/chains/hazard kills once;
  - checks contracts once.
- Replay of the same day:
  - no streak change;
  - no daily bonus;
  - **no in-room scrap**;
  - no lifetime counters, no contract progress;
  - results say **PRACTICE · NO REWARD**.
- Day 7 (and every 7th streak day) sets `dailyRareEdge = true` on the first clear, granting a guaranteed **legendary** card on the next campaign Edge draft. If a boss draft already forces a rare, the offer contains both a rare and a legendary in different categories, so the flag is not wasted. The results screen says **LEGENDARY EDGE UNLOCKED**; the lobby and pause menu show `LEGENDARY EDGE READY` until the draft uses it.
- Daily failure: retry the daily, or home. It pays no scrap and changes no counters. The campaign run remains untouched.
- Daily results button: **DONE**. It returns to the menu, not the next campaign room.

This fixes three existing economy leaks: replaying the daily currently pays the bonus every time, increments `roomsCleared`/lifetime counters every time, and pays in-room scrap every time.

### 9.3 Daily results

The existing result panel is reused, with daily-specific meta:

- `D` room tag and “daily challenge” label;
- **DAILY STREAK** chip (e.g., `3 DAYS`);
- **DAILY BONUS +40 SCRAP** line;
- **LEGENDARY EDGE UNLOCKED** line on day 7;
- **PRACTICE · NO REWARD** line on a replay;
- the room’s challenge and score;
- **DONE** action.

The daily should feel like a small, complete ritual, not a second campaign.

## 10. Collection book (Evidence Board)

### 10.1 Fix the duplicate first

`trip_hazard` is defined twice in `Discoveries.ts`:

- line 96: gadget, robot hoover;
- line 138: style, hamster ball.

The hamster unlock currently uses the gadget id, leaving the style entry unreachable. Rename the hamster one to `hamster_trip`, title **HAMSTER TRIP** (or keep the title but unique id), and update `Pets.ts` to unlock `hamster_trip`. The gadget hoover keeps `trip_hazard`.

After the fix, `DISCOVERIES.length`, `DISCOVERY_BY_ID.size`, and the lobby count all agree at **166**. Add a uniqueness regression test. `SaveManager` already dedupes `discoveries` on load, so old duplicate strings cannot inflate the contract count; keep that behavior and cover it.

Existing saves that triggered the hamster ball before the fix received the gadget id. They will not retroactively gain the new style entry. The Evidence Board shows it as missing until earned again; this is a documented one-time gap, not a reason to over-grant.

### 10.2 Entry

Add an **EVIDENCE** tab to the flat sheet. Make the lobby’s **BAD IDEAS FOUND** stat a button that opens the sheet on that tab.

The stat currently shows `${count} / ${total}+`; remove the `+`. The book is completable.

### 10.3 Screen

- Head: `THE EVIDENCE BOARD`, `37 / 166`, progress bar.
- Filter row: `ALL`, `IMPACT`, `ELECTRIC`, `FIRE`, `FLOOR`, `AIR`, `GADGET`, `STYLE`. Each filter shows a found/total count, e.g. `IMPACT 6/18`; buttons use `aria-pressed` and are horizontally scrollable on mobile. The count is the orientation device for a 166-card board.
- Grid of cards, sorted by group then original order.
- Found card:
  - group color strip;
  - discovery title;
  - the recipe as a cause → effect strip;
  - a small `FILED` stamp.
- Missing card:
  - `???` title;
  - the recipe still visible as a clue, dimmed;
  - a lock mark;
  - `aria-label` explains it is locked and reads the clue.
- The recipe is deliberately shown for missing entries. The recipes are vague (“ANYTHING”, “INTRUDER”), so they are clues, not spoilers. This turns the book into a to-do list of stupid ideas.
- Filtering only re-renders the grid; the count and head stay put.
- Empty filter state: “NO EVIDENCE IN THIS DRAWER YET.”

No extra currency or reward track here. The `EVIDENCE BOARD` contract at 30 discoveries already pays scrap, and completion is its own trophy.

## 11. Lobby flow

### 11.1 Top row

Left to right:

- **NIGHT SHIFT** room chip (existing), selected room number and hero pair.
- **DAILY SHIFT** chip (new, compact, button).
- **SCRAP** chip (existing).

`justify-content: space-between` with `flex-wrap: wrap` on small screens. At 360px the night chip takes the first row and the daily and scrap chips share the second; the daily chip must never disappear. At `max-height: 560px`, the hero drops to `26vh`, the logo to `10vh`, and the goal strip becomes a single 24–28px line with its detail and meter hidden. Priority order is `PLAY > daily > goal > stats`.

### 11.2 Left column

Two stat cards, now interactive:

- **ROOMS UNLOCKED** → opens the key wall tab.
- **BAD IDEAS FOUND** → opens the Evidence tab.

Both are `<button>` elements with the existing stat styling, hover/focus states, and `aria-label`s. The column is hidden below 600px, so the tabs and daily chip carry the same access there.

### 11.3 Center

The selected hero only. No pets, no roster strip. This is unchanged and must stay.

### 11.4 Play area

- Big button:
  - no active run: **PLAY**;
  - active run: **CONTINUE RUN**.
- A small run subline under the label when active: `FLOOR 12 · STREAK 4 · 3 TYPES · 12,400`.
- A **NEXT UNLOCK** strip under the button:
  - kicker: `READY TO BUY`, `NEXT STAR`, `SAVE UP`, or `DONE`;
  - title and detail;
  - a thin progress bar;
  - click opens the Store or the Ledger tab.
- If the next Ledger milestone is within three stars, the strip switches to **NEXT STAR** even when a store item is affordable. Stars otherwise disappear behind the scrap economy.
- The strip is full width on mobile, under the big button, so progression is visible even with the left column hidden.

The strip should be compact: one line of kicker/title, one line of detail, one 6px meter. It should not compete with PLAY. On short screens it collapses to the kicker and title only.

### 11.5 Navigation

Keep HOME, ROOMS, CHARACTERS, STORE, SETTINGS.

- STORE now opens the real store screen.
- SETTINGS is settings only; the static shop rack is removed.
- No new nav item. Daily lives in the top chip; Ledger/Evidence live in the flat sheet.

### 11.6 Flat sheet

Rename the sheet’s kicker from `RUN SETUP` to `YOUR FLAT` and the title from `MODE` to `THE PLAN`. Tabs:

1. **ROOMS**
2. **CHARACTERS**
3. **LEDGER**
4. **EVIDENCE**

Tab behavior:

- `aria-selected`, `tabIndex`, and `hidden` panes are managed together.
- Left/right arrows cycle tabs and move focus.
- The sheet opens on the requested tab (`openMode('ledger')`, etc.).
- The hero-pick rebuild still reopens CHARACTERS.
- The tabs row is horizontally scrollable on narrow screens; labels do not wrap into two lines.
- The mode body scrolls; the panel stays within the viewport.

### 11.7 Key wall changes

- If a run is active, the pane opens on `runFloor` rather than `unlockedRoom`.
- A **RUN IN PROGRESS** strip above the key wall shows `FLOOR 12 · STREAK 4 · 3 TYPES`.
- The footer button label updates with the selection:
  - active run, selected floor === runFloor: **CONTINUE RUN**;
  - active run, different floor: **START NEW RUN**;
  - no active run: **ENTER ROOM**.
- When a different floor is selected, the hint says `STARTS A NEW RUN · CURRENT RUN ENDS`, and the first press changes the button to **TAP AGAIN TO START** rather than ending the run immediately.
- `onEnter` actually calls `actions.play(choice.index)` after closing the sheet. It does not require a second PLAY press.
- The big PLAY/CONTINUE button and the key wall both call `Game.playSelected`, so the continue/new-run rule is identical.

## 12. Results screen

### 12.1 Victory with an Edge offer

This is the centerpiece. Keep the receipt aesthetic, but make the choice the loudest thing on the page. The visual direction is the existing BONK 2.0 night-shift kit — navy, cream, lime, lavender, the display face, the bill/receipt structure, the key wall. Do not introduce a second palette, a new typeface, or generic rounded cards. One moment gets the boldness: the Edge draft. The store, Ledger, and Evidence screens stay quiet, dense, and legible.

- Panel: `b2-report` without `--simple`.
- Meta: room tag, room name, and a `b2-report__run` chip: `RUN · FLOOR 12 · STREAK 4`.
- Hero: big run score, `CHAOS POINTS`, and a small `THIS ROOM +2,340` line.
- Marks: stars, challenge, first clear, contracts, ledger, daily (when applicable), discoveries. When Ledger milestones are claimed, a **STAR LEDGER** strip is the first note, not the last.
- Side:
  - **TAKE AN EDGE**: up to three cards, as described in section 6. This is first.
  - **YOUR BUILD**: owned Edges with stacks; max 4 visible lines, then `+N MORE`.
  - **NEXT**: next room number/name, BOSS tag if relevant, key art. `ROOM 13 · THE KITCHEN` is a concrete invitation.
- Actions:
  - `PICK AN EDGE` (primary, disabled) → `NEXT ROOM` after pick;
  - `REPLAY ROOM` (blue);
  - `HOME · SKIP EDGE` (lavender) while pending, then `HOME`; the skip needs a second tap.
- A small note under the actions when a run is active: `REPLAY STARTS A NEW RUN · EDGES LOST`.
- The ribbon and stamp stay. The stamp sound plays once.
- The Edge cards enter with a short stagger after the ribbon; the chosen card pops. Do not animate the whole report on every frame.
- Focus enters on the first Edge card (`data-autofocus`), not the disabled primary. After a pick, focus moves to the enabled primary.

If the offer is missing because `Game.chooseEdge` has no pending draft, the cards show a disabled state and the primary becomes **NEXT ROOM** with a note “EDGE OFFER EXPIRED.” This should be rare: a reload normally auto-grants the first offered Edge through `runOffer`. The run is never blocked by a stale offer.

### 12.2 Victory without an offer

- **Normal non-draft clear:** keep the simplified single-column report. Add the run chip, score, stars, and notes, then a compact **NEXT** strip at the bottom: `ROOM 13 · THE KITCHEN` plus `NEXT EDGE · ROOM 14`, `NEXT EDGE · BOSS`, or `BUILD MAXED`. Actions: NEXT ROOM, REPLAY ROOM, HOME. No cards, no side column.
- **Final victory:** keep the simplified single-column report. Add the run chip (`RUN COMPLETE · 50 FLOORS`) and a compact `50 FLOORS · 3 TYPES · 8 STACKS · 98,200 RUN SCORE` line. No cards, no side panel. Actions: REPLAY ROOM, HOME.
- **Daily:** keep the simplified report, with daily streak/bonus/rare-edge lines. Action: DONE.
- **Story/tutorial room 1:** it has an offer, so it uses the draft layout. The receipt may also show the lesson result; keep it below the stars, not in the choice’s way.

### 12.3 Failure

Keep the incident-report look, but add the run context:

- Meta run chip: `RUN · FLOOR 12 · STREAK 0`.
- Big bill remains the attempt’s chaos points.
- A **RUN REPORT** block:
  - `RUN SCORE` (the score kept, reset to the start of the room);
  - `EDGES` as types and stacks (`3 TYPES · 5 STACKS`) plus the top 3 build lines;
  - `NEXT GOAL` from the goal helper (star or store);
  - a red **NO SALVAGE** line: the failed room pays no scrap.
- Run note:
  - normal failure: **EDGES KEPT · STREAK RESET**;
  - if the run truly ended (not expected on ordinary failure): **RUN ENDED · EDGES LOST**.
- Actions: RETRY (primary), CONTINUE ad when available, HOME.
- The failure screen should feel like a setback with a plan, not a dead end. The `NEXT GOAL` line is the “one more room” hook after a loss.

### 12.4 Mobile results

- The report body is a single column and scrolls; the actions stay outside the scroll.
- Order: meta, score, **side (TAKE AN EDGE → build → next room)**, marks/notes. The CSS grid at `max-width: 860px` must move `side` before `marks`, not after it. The choice must not be buried under the small print.
- The Edge cards are full-width and at least 44px tall.
- The primary action is visible without scrolling if the viewport is tall enough; otherwise the scroll is obvious.
- Focus the first Edge card on entry when an offer exists (`data-autofocus`). After a pick, focus the primary button.

## 13. Feedback and juice

- **Scrap:** the HUD wallet counts saved + room scrap and pulses on a gain. On failure it snaps back to saved scrap with a red **NO SALVAGE** line. The results wallet line counts up; the store wallet counts down on a buy.
- **Stars:** render three separate star glyphs, popping in one at a time after the score count-up. The existing one-string star line can stay as a fallback for screen readers, but the visual should pop. A newly claimed Ledger milestone gets its own **STAR LEDGER** strip and a short scrap count-up.
- **Edges:** cards stagger in, hover lifts, pick pops and stamps `TAKEN`. A short paper/click sound; no new audio assets required. Use existing `paper`, `stamp`, `pickup`, or `roomClear` sounds.
- **Next room:** the key teaser gets a small lime border and a “NEXT” kicker. It is the last thing the eye lands on before the primary button. On non-draft clears, the same strip carries **NEXT EDGE · ROOM N**.
- **Goal strip:** when a purchase becomes affordable, the strip gets `is-ready` and a lime pulse. Do not animate it forever; one pulse on screen entry.
- **Streak:** the HUD `STREAK` chip flips to lime after each clear; at 0 it is grey. The results run chip shows the streak.
- **One loud moment:** the Edge draft is the only large entrance animation on results. Everything else is quiet receipt motion.
- **Reduced motion:** all new transforms/animations respect `prefers-reduced-motion: reduce`. The state changes remain.
- **Copy:** short, loud, kid-readable. Avoid tooltips as the only explanation. No sarcasm that requires reading the flavor text.
- **No confetti** except the existing final-first-clear celebration. The draft is the reward; do not cover the cards with particles.

## 14. Save v6

`SAVE_VERSION` becomes **6**.

Add:

```ts
/** Permanent home-upgrade levels by id (new in version 6). */
upgrades: Record<string, number>;
/** Up to three offered Edge ids while a draft is pending (new in version 6). */
runOffer: string[];
```

Defaults: `{}` and `[]`.

Migration:

```ts
if (version < 6) {
  raw.upgrades = {};
  raw.runOffer = [];
  // Old room bests were cumulative run scores, not room scores.
  raw.roomBests = {};
  version = 6;
}
```

Sanitize:

- import `UPGRADES` from `gameplay/Upgrades.ts`;
- accept only known ids;
- clamp each to `0..maxLevel`;
- store only positive levels (positive-only is smaller and simpler);
- keep unknown fields out;
- clamp every `runBoosts` id to at most three copies; drop unknown ids; preserve duplicates up to the cap;
- sanitize `runOffer` to known Edge ids, at most three, unique; clear it when `runActive` is false.

`cat_frenzy` stays valid in old `runBoosts`; the sanitizer caps it at three like every other Edge.

The active offer is persisted because losing a reward to a reload is worse than a tiny save field. A small `runOffer` array is enough; the results screen rebuilds the cards from the Edge definitions.

Migration tests:

- v5 save with a run, stars, scrap, and discoveries loads with `upgrades: {}`, `runOffer: []`, and all old fields intact except `roomBests`, which is reset.
- v6 save round-trips upgrade levels and a pending offer.
- negative, fractional, huge, and unknown upgrade values clamp/drop.
- `runBoosts` drops unknown ids, caps duplicates at three, and preserves valid duplicates up to the cap.
- `runOffer` drops unknown/duplicate ids and is cleared when no run is active.
- `SAVE_VERSION` is 6.

## 15. Technical integration

### 15.1 New pure modules

- `src/gameplay/Upgrades.ts`
  - `UpgradeId`, `UpgradeDefinition`, `UPGRADES`, `UPGRADE_BY_ID`;
  - `upgradeLevel(save, id)`, `nextUpgradeCost(save, id)`, `maxUpgradeLevel(save, id)`;
  - `buyUpgrade(save, id): string`;
  - multipliers: `upgradeScrapMultiplier`, `upgradeCooldownMultiplier`, `upgradeScoreMultiplier`, `upgradePetMultiplier`;
  - `maxHealthBonus`.
- `src/gameplay/Progression.ts` (or a small helper in `Upgrades.ts` / `StarLedger.ts`)
  - `nextUnlock(save, totalStars): UnlockGoal`.
  - Keep it pure and unit-tested. The lobby, store, and results use it.
- `src/gameplay/Edges.ts` cadence helpers:
  - `EDGE_STACK_CAP = 3`;
  - `shouldOfferEdge(index, boss): boolean` — true for room 1, odd 1-based rooms, and every boss room before the final;
  - `offerEdges(rng, forceRare, forceLegendary, owned)` — filters maxed Edges, randomizes the premium category, and can force a second premium.
- `src/gameplay/Discoveries` fix + uniqueness test.

### 15.2 Game

- `pendingDraft: { room: number; offer: EdgeDefinition[] } | null` (session view of `save.runOffer`).
- `chooseEdge(id): string` — validates active draft, room, and offered id; calls the run helper; writes save; clears `runOffer` and the draft.
- `nextRoom()` — refuses while `pendingDraft` exists. The results UI disables the button; this is the safety net for the `R` shortcut.
- `summarize()`:
  - compute `roomScore` before mutating run score;
  - pay `score.stats.scrap` on a campaign clear and a first daily clear; failure and daily replay pay zero;
  - update `highScore` only on a clear, and not on a daily replay;
  - generate the offer only on draft rooms: rooms 1, 3, 5, …, and every boss room before the final;
  - force rare on boss rooms and legendary on `dailyRareEdge`;
  - consume `dailyRareEdge` only when an offer is generated;
  - write the offered ids to `save.runOffer`;
  - populate `run` summary, `offer`, `nextRoom`, `nextEdge`, `ledgerNext`, `ledgerStars`, `totalStars`, `dailyStreak`, `dailyReplay`, `dailyRareEdgeGranted`, `roomScore`, `isNewRoomBest`.
- On load, if `runActive` and `runOffer` contains a valid id, auto-grant the first one into `runBoosts`, clear `runOffer`, and write. The lobby does not show a modal.
- `playSelected()` already continues when `index === runFloor`; the UI now calls it from both PLAY and the key wall.
- `playDaily()` unchanged except the summary/daily fixes.
- `retryAfterFail()` always restarts the current room (campaign or daily); remove the “end run after handcrafted rooms” branch. Set `scoreAtRoomStart = save.runScore` before restarting so the retry does not inherit the failed attempt’s score.
- `buyAbility` stays; add `buyUpgrade`.
- `petDamageMultiplier()` composes Edge + upgrade multipliers.
- `loadRoom`: create the player with `5 + maxHealthBonus(save)`.
- `toMenu`: clear `pendingDraft` and `runOffer` (an explicit HOME skip); do not end the run.
- `abandonRun`: still available for the final/ended path; clear `runOffer`.

### 15.3 RoomSummary additions

Keep the existing fields and add a nested run block to avoid a dozen flat fields:

```ts
run: {
  floor: number;          // 1-based room just played
  nextFloor: number | null; // 1-based next room, null at final
  streak: number;
  score: number;          // cumulative run score
  types: number;          // distinct Edges owned
  stacks: number;         // total stack copies
  boosts: string[];       // build before the offer
  ended: boolean;
};
roomScore: number;
isNewRoomBest: boolean;
offer: EdgeDefinition[];  // empty on non-draft rooms, failures, daily, final
nextRoom: { number: number; name: string; boss: boolean } | null;
nextEdge: { number: number; boss: boolean } | null; // next draft room, or null
ledgerNext: LedgerMilestone | null;
ledgerStars: number;      // 0..27
totalStars: number;       // 0..150
dailyStreak: number;
dailyReplay: boolean;
dailyRareEdgeGranted: boolean;
noSalvage: boolean;       // failure or daily replay
```

The exact shape can be adjusted to reduce churn, but the UI needs all of this information. Do not make the results screen recompute save state; the summary is the contract.

### 15.4 UI

- `MenuActions` becomes `play(roomIndex)`, `store()`, `settings()`, `daily()`, `hero(id)`.
- `UI.showMenu` calls `game.playSelected(index)` for play, `game.playDaily()` for daily, and routes `store` to `buildStore`.
- `UI.showSummary` adds `chooseEdge: (id) => game.chooseEdge(id)`.
- `UI.show` focuses `[data-autofocus]` first; otherwise it focuses `button.primary` only when it is not disabled. This prevents a draft screen from opening with focus on a dead button.
- New screens:
  - `src/ui/screens/store.ts`
  - `src/ui/screens/ledger.ts` (or a pane builder)
  - `src/ui/screens/evidence.ts`
  - shared `src/ui/screens/shopCards.ts` for ability cards (optional but preferred).
- `lobby.ts`: daily chip, goal strip, clickable stats, play/continue label, mode tabs, room sheet start behavior.
- `rooms.ts`: run banner, active-floor resume, enter-label logic, `onEnter` starts, second-tap new-run confirm.
- `results.ts`: draft side panel, run chip, build list, next teaser, next-Edge line, failure run block, focus management.
- `hud.ts`: run line, live scrap, pulse, no-salvage snap-back.
- `pause.ts`: current-run section; rare-edge-ready tag; shared ability card if extracted.
- `settings.ts`: remove the static shop tab/rack.
- `UI.ts`: store route; summary chooseEdge; menu actions; autofocus rule.
- CSS: reuse the existing `.b2-report__side`, `.b2-edge`, `.b2-report__next`, `.b2-shop-card`, `.b2-meter`, `.b2-chip` styles. Add only:
  - lobby daily chip, goal strip, clickable stat states, short-height rules at 640×360;
  - mode tab overflow;
  - store level pips / next-unlock strip;
  - ledger track and campaign-star secondary meter;
  - evidence grid/filter with per-group counts;
  - results build lines, disabled primary, mobile `side` before `marks`, card stagger;
  - HUD run line/live scrap pulse/no-salvage state.

### 15.5 Player / pets / score / abilities

- `Player` constructor: `(x, y, maxHp = 5)`, assign `this.maxHp` and `this.hp`. Update tests/mocks that construct `new Player(x, y)` — the default keeps them working.
- `ScoreSystem.award`: add upgrade score multiplier.
- `ScoreSystem.onEnemyDefeated`: add upgrade scrap multiplier.
- `AbilitySystem.cooldownFor`: add upgrade cooldown multiplier.
- `Pets.ts` / `Cat.ts`: use `game.petDamageMultiplier()` in the five damage calls. Remove the cat-only edge multiplier calls in favor of the composed method.
- `Edges.ts`: display rename only; keep `cat_frenzy` id. `offerEdges` gains the owned-stack filter, random premium category, and optional legendary force; `EDGE_STACK_CAP = 3` lives beside it.
- `EdgeSystem.ts`: floor `scoreMultiplier` at 0.25 even though the three-stack cap prevents a negative magnate multiplier in normal play.
- `Run.ts`: failure keeps the run; `RunState` gains `runOffer`; `startRun`/`endRun` clear it; cap/sanitize stacks; update tests.
- `Discoveries.ts` / `Pets.ts`: duplicate fix.

### 15.6 Room bests

- In `summarize`, compute `roomScore` before `recordClear`/`recordFail`.
- Compare/store `roomScore` in `roomBests` only on a clear; keep the chain max logic.
- Add `isNewRoomBest` and show it in the results notes.
- Do not change global `highScore` semantics: it remains the best cumulative run score, but it only updates on a clear, never on a failure.
- The v6 migration clears the old cumulative `roomBests` table once; see section 14.

## 16. Test plan

### Unit

- `Upgrades.test.ts`: definitions, exact costs, max levels, buy success/failure, multipliers, max HP, 27,200 total sink test.
- `Progression.test.ts`: next unlock priority, star goal within three stars wins, affordable store goal, star goal fallback, save-up goal, done.
- `Run.test.ts`: failure resets streak/score and keeps `runActive`; clear advances floor/streak; `startRun` resets; `sanitizeRun` caps Edge stacks at three.
- `SaveManager.test.ts`: v6 migration, `roomBests` reset, upgrade sanitize, `runOffer` sanitize, duplicate Edge preservation/cap, unknown Edge drop, version.
- `Edges.test.ts`: `PET FRENZY` display name/effect; 11 ids; offer categories; maxed Edge excluded; boss premium category varies; day-7 legendary + boss rare can coexist; `EDGE_STACK_CAP` is 3.
- `StarLedger.test.ts`: next milestone helper if added; existing claims unchanged; 27-star track is distinct from 150 total.
- `Discoveries.test.ts`: 166 entries, unique ids, `hamster_trip` exists, duplicate gone.
- `Game`/summary: add focused tests for `roomScore`/room bests, no scrap on failure, no high score on failure, no scrap/counters on daily replay, draft cadence, and auto-granting `runOffer` on load. If the architecture makes full Game setup heavy, extract the pure decision helpers and test those.

### DOM / component

- `results.test.ts`:
  - normal victory with an offer renders exactly 3 Edge buttons, primary disabled, choosing calls `chooseEdge`, after pick primary is enabled and labeled `NEXT ROOM`;
  - first card has `data-autofocus`; after pick focus moves to the primary;
  - non-draft victory renders the simple layout, no Edge buttons, and **NEXT EDGE · ROOM N**;
  - final/daily render the simple layout and no Edge buttons;
  - failure renders `EDGES KEPT · STREAK RESET`, `NO SALVAGE`, run score, and the action trio;
  - home label is `HOME · SKIP EDGE` while pending and needs a second tap;
  - Ledger claims render the **STAR LEDGER** strip.
- `lobby.test.ts`: selected hero unchanged; CONTINUE RUN label when active; PLAY when idle; daily labels (`DAILY SHIFT · PLAY`, `DAILY DONE · PRACTICE`); goal strip action and star priority; clickable evidence stat; `LEGENDARY EDGE READY`.
- `store.test.ts`: 5 upgrade cards, exact costs/levels, buy callback, disabled when unaffordable, in-place update, powers tab, next-unlock strip.
- `ledger.test.ts`: 9 rows, paid/next/locked states, 27-star progress and 150-star secondary line.
- `evidence.test.ts`: count, missing/found, filter, per-group counts, recipe clue, duplicate-safe total.
- `rooms.test.ts` (new if practical): active-floor resume, CONTINUE vs START NEW RUN label, enter starts, second-tap new-run confirm.
- `hud.test.ts` (new if practical): live scrap = saved + room; run line updates; daily hides run line; failure snaps back to saved scrap; seven hearts at 360px.
- A browser smoke test at 360×640 and 640×360 for the lobby, results draft, and store. If the project does not add a browser runner, capture manual screenshots and check them in review.

### Manual QA

1. Fresh save: room 1 tutorial → clear → draft → pick → next room; HUD shows streak/edge; results next teaser.
2. Cadence: room 2 clears without a draft and says **NEXT EDGE · ROOM 3**; room 3 drafts; a boss room drafts even when the cadence would skip it; room 50 does not draft.
3. Continue: clear room 2, HOME, lobby shows CONTINUE RUN; continue resumes the right floor and score; Edges persist.
4. Failure: fail a generated room; RETRY keeps the build; HOME preserves the run; `R` does not skip a pending Edge; the failed room pays no scrap and sets no high score/room best.
5. New run: select a different floor; second tap confirms; Edges reset; meta persists; REPLAY ROOM also confirms.
6. Stack cap: take the same Edge three times; it stops appearing in offers; the card labels `OWNED ×2 → ×3`.
7. Store: buy each upgrade; check hearts, scrap, cooldown, score, pet damage; max levels; unaffordable state; purchases persist after reload; total catalog is 27,200 scrap.
8. Ledger: reach 3/6/9 stars via `?stars` or play; claims pay once; screen shows 27-star track and 150-star total; HEAD START appears on a new run; claim banner is loud.
9. Daily: first clear pays/streak; replay pays no bonus/scrap/counters; day 7 legendary; boss overlap gives two premium cards; campaign run survives; daily failure.
10. Evidence: found/missing cards, filters with counts, 166 total, hamster trip unlock, lobby stat link.
11. Mobile 360×640 and 640×360: daily chip visible, flat sheet tabs scroll, results Edge cards above notes, actions visible, store one column, lobby goal strip does not push PLAY off-screen.
12. Accessibility: keyboard-only draft/store/tabs; screen-reader labels; focus first card then primary; reduced motion.
13. Save: inject v5; load; upgrades empty, room bests reset, old run/stars intact; v6 round-trip; reload mid-draft auto-grants the first card.
14. Builds: `npm test`, `npm run build`, `npm run build:crazygames`; package DOM smoke; update zip and `public/arcade/bonk`.

## 17. Balance notes

- Scrap income: roughly 150–300 per room from kills, plus 40/100 first clears, contracts, Ledger scrap, and daily scrap. A clean 50-room campaign is roughly 10,000–12,000. The 27,200 total sink is deliberately larger than one run: max-out is a three-run goal, stretched to four or five by failures and partial runs.
- Early economy: the first tier of every track costs 200–400, so a new player can buy something meaningful after a few rooms. The last tiers cost 3,500–4,000 and are the long-term chase.
- Edge power: about 30–35 drafts in a full run, with 11 Edges and a three-stack cap (33 slots). The build can just about max out, and the last few offers thin out rather than repeating forever. Boss rooms force a premium; boss premium categories are randomized.
- Boss premium cards: 19 boss drafts before the final (the 20th boss ends the run), and many bosses are the only draft in their stretch; enough to feel special without making legendaries routine.
- Pet training + PET FRENZY: 1.5 × 1.48 = 2.22× pet damage at max. Strong, but pets are situational and the investment competes with hearts/scrap/cooldowns.
- Cooldowns: Ledger 0.85 × store 0.93^4 = 0.636×. The abilities are already limited by per-room cooldowns; this is a fun end-game goal, not a win button.
- Max hearts: 7 total. This is the safe HUD ceiling and a meaningful survivability bump.
- Failure: no salvage, no high score, no room best, no stars, no contract progress. The build and meta progress survive; the failed attempt does not pay.

## 18. Risks and open decisions

### Decisions locked 2026-10-24

**Failure stakes:** keep the run and build on an ordinary failure. The failed room pays no salvage, score, high score, room best, stars, or contract progress. This is the implemented contract.

**Draft cadence:** room 1, every second room after it, and every boss (roughly 30–35 offers across the campaign). No new Edge definitions in this pass.

### Builder calls (defaults in this doc)

- Five upgrade tracks; door caps at 2, the other four at 4; total sink 27,200.
- Draft after room 1, every second room after it, and every boss room; no draft on daily, failure, or final.
- Edge stacks cap at 3; maxed Edges are excluded; boss premium categories are randomized.
- Day 7 forces a legendary and can coexist with a boss rare.
- `PET FRENZY` display rename; internal `cat_frenzy` id kept.
- The static settings shop is removed; STORE opens the real store.
- Daily replays are practice only and pay nothing; first clear counts.
- Evidence shows recipes for missing entries.
- Room bests use room score; v6 resets the old cumulative table once.
- A pending Edge offer is persisted as `runOffer` and auto-grants its first card on reload; HOME skips it explicitly.

### Known risks

- **HUD heart row:** 7 hearts is the tested ceiling; do not add a third max-HP level without a compact HUD redesign.
- **Results height:** the side panel adds height; the body must scroll and the action row must stay visible. Test 640×360. The mobile `side` must come before `marks` or the draft is buried.
- **Draft skip:** `R`/`nextRoom` must be guarded by `pendingDraft`; otherwise the keyboard shortcut bypasses the choice.
- **Double-pick:** the Game guard, not just the disabled DOM, must prevent two Edges.
- **Daily economy:** first-clear-only bonus, scrap, and counters must be enforced in `summarize`, or the daily is a scrap faucet.
- **Failure economy:** room scrap must be paid only on a clear; otherwise keep-the-build failure turns dying into a farm.
- **Cadence clarity:** non-draft rooms need a visible `NEXT EDGE` line, or the player will think the draft broke.
- **Economy tuning:** 27,200 is the design target, not a shipped guarantee. Run the scripted economy pass before locking final-tier costs.
- **Save size:** five upgrade levels plus three Edge ids; no storage risk.
- **CrazyGames:** no new external assets or network calls; the store/ledger/evidence are DOM/CSS only.

## 19. Approval

Approved on 2026-10-24 with both recommended options:

1. **Failure:** keep the run and build.
2. **Draft cadence:** room 1 + every second room + every boss.

The next step is the implementation plan (`writing-plans`), then TDD. The design is the contract; deviations need a documented reason and a test.
