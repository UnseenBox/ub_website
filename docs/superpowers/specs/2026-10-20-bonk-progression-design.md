# BONK — The Eviction Ladder

**Progression redesign for the BONK campaign**
**Date:** 2026-10-20
**Status:** Draft for approval
**Source:** `everything-is-a-weapon/` (Vite + TypeScript canvas game)
**Save version:** 4 → 5

---

## 0. One-page summary

Room 1 is a tightly staged tutorial. After it, players say the game is boring; the only moment that produces adrenaline is the boss entrance. The game already ends rooms 2–9 with a boss, so the problem is not boss frequency. The problem is that the room before the boss has no build, the boss arrival is not tied to anything the player did, the boss fight is not readable, and the reward is a score screen.

The redesign turns every floor into a short escalating incident:

**promise → arrival → escalation → boss → choice → next**

- **Heat** rises as the player causes chaos. At 34% and 67% the building reacts. At 100% the boss crashes in.
- The boss gets a real entrance card, a health bar, phase feedback, and a slow-mo defeat.
- After every clear, the player picks one of three **Edges** — run-long perks that change how the next floor plays. Picking an Edge is how they continue.
- The menu sells the next floor, a daily contract, and a star ledger. The Depths is the endless tail.

The campaign stays nine handcrafted rooms. No new rooms, boss art, enemy types, backend, or monetization pressure are required.

---

## 1. Why this change

### What the player feels now

- The tutorial hands out a new toy every minute, then confetti, then the BIG RED BUTTON.
- Room 2 drops them into a normal room. The next surprise is a boss at the end, but nothing in the room promises it, and the reward is a score card.
- The only peak is the two seconds when the boss walks in.

### What the redesign changes

- The boss is visible from the first second of the floor, as a promise on the heat meter.
- The room escalates toward it. The player's own chaos makes it arrive faster.
- The boss arrival is a produced moment, not a spawn event.
- The clear pays out a choice that changes the next floor.
- The next floor is one tap away, with its boss already named.

### Success looks like

- A new player who clears room 1 starts room 2 in the same session.
- A session is a chain of floors, not a room then menu.
- Players come back for the daily contract and the next star milestone.
- The boss entrance is the climax of a build, not the only good two seconds.

---

## 2. What exists today (facts from the code)

- **9 handcrafted rooms.** Room 1 is a staged tutorial (`Tutorial.ts`). Rooms 2–9 each have a unique boss: `chairman`, `flusher`, `kraken`, `fridgezilla`, `piano`, `mower`, `mom`, `house`. The boss is added in `Game.enterRoom` at `latest regular enemy delay + 4s`. It is not tied to player actions.
- **Linear unlocks.** `save.unlockedRoom` is the highest startable room. Clearing room N sets it to N+1. `save.deepest` tracks the deepest clear; `save.roomStars` stores best stars per room.
- **3 stars:** clear + bonus challenge + style (`starsFor` in `Campaign.ts`). Stars currently only feed `campaignProgress` and the menu percentage.
- **Scrap and abilities.** Kills drop scrap; `ABILITIES` has three permanent powers (`blast`, `overdrive`, `freeze`). The results screen offers one affordable ability.
- **Contracts and daily exist but are buried.** `CONTRACTS` pay once for lifetime totals. `dailyChallenge()` generates a room, but the main menu never opens it. `lastDaily`/`dailyStreak` are saved.
- **Results screen** shows score, stars, challenge, first-clear scrap, an ability offer, and a next-room teaser.
- **Boss juice already exists:** `bossWalk`, `knock`, `bossRoar`, `hud.banner`, camera shake, boss phases and unique attacks. Music has intensity layers 0–3.
- **No run-level choices, no heat/escalation, no boss health bar, no meta reward track.**
- Save is v4 with a `migrate`/`sanitize` pipeline in `SaveManager.ts`.

**Key correction:** the campaign already has a boss in every room 2–9. This design does **not** add a second boss to those rooms. It changes when and how the existing boss arrives, and it makes the room before it an escalation.

---

## 3. Goals, non-goals, anti-goals

### Goals

- Make each floor a 90–150 second three-act incident: arrival, escalation, boss.
- Give the player a meaningful choice after every clear that changes the next floor.
- Make the next floor, the next star milestone, and tomorrow's contract visible at all times.
- Preserve the handcrafted rooms, story, heroes, pets, abilities, and boss content.
- Work on desktop, mobile touch, and portal builds. Respect reduced shake and high contrast.
- Increase session length and day-2 return without dark patterns.

### Non-goals

- New rooms, new boss art, new enemy types, multiplayer, online leaderboards, backend.
- A branching roguelite map.
- Rewriting the tutorial's lesson plan.
- More ads or new monetization pressure.
- Permanent power that trivializes the campaign.

### Anti-goals

- A reward screen that feels like a spreadsheet.
- Grinding the same room for currency with no new decision.
- A heat meter that punishes slow players with an unavoidable death.
- Blocking the critical path behind stars.
- Long unskippable cutscenes before every floor.

---

## 4. The new loop

### Floor = one incident

1. **Promise (0–5s).** The entry card names the floor, the boss waiting at the end, and the bonus objective. The HUD heat meter starts at 0 with the boss's mug at the end. The player knows what is coming.
2. **Arrival (0–45s).** Regular movers arrive. The player fights, throws, chains, and uses the room.
3. **Escalation (heat 34 / 67).** The building reacts. At 34 the remaining crew rushes in. At 67 the room itself loses it (a hazard surge or furniture collapse). Music intensity rises; lights and camera react.
4. **Boss (heat 100).** The entrance card slams in: slow-mo, roar, shake, door burst. The boss fight has a health bar, phase callouts, and a mid-fight arena event. Defeat is slow-mo plus confetti.
5. **Payout.** Victory card with score, stars, scrap, and streak. Then three Edge cards. Pick one to continue.
6. **Next.** The next floor loads. Its boss is already named on the heat meter.

### Run lifecycle

- A **run** starts when the player presses PLAY on a floor. `playFrom(index)` clears `runBoosts`, sets `runFloor = index`, `runStreak = 0`, `runScore = 0`, `runActive = true`.
- `nextRoom()` advances `runFloor` **when the room is cleared**, before the Edge pick. The Edge pick only adds to `runBoosts`.
- **Campaign fail:** `runActive` stays true, `runBoosts` stay, `runStreak = 0`. RETRY continues the same run. HOME then CONTINUE returns to the failed floor with the same Edges.
- **Depths fail:** the run ends. `runActive = false`, `runBoosts = []`, `runScore = 0`. `deepest` records the deepest floor **cleared**. DESCEND starts a new run at the next unbeaten floor (`deepest + 1`) with no Edges.
- **REPLAY on a win:** starts a new run at that floor, clearing Edges. This is the "master this floor" action, kept separate from the continue loop.
- **PLAY from the menu:** if the selected floor equals `runFloor` and `runActive`, it continues the run. Any other floor starts a new run. The button says CONTINUE RUN or NEW RUN accordingly.
- **Returning to menu** keeps `runActive` true and the current `runScore`. CONTINUE resumes at `runFloor`.
- **Campaign → Depths:** after room 9, the Edge pick calls `nextRoom()` into the first Depths floor with the same run and Edges. DESCEND from the menu is a separate new Depths run at `deepest + 1`.
- **Daily** is a separate one-room mode. It does not touch the active run.
- The Depths is the same run structure, with `runFloor` beyond the handcrafted count.

### Why this should be more addictive

- The player is always 60–90 seconds away from a named boss entrance.
- The boss entrance is followed immediately by a choice that changes the next floor.
- The choice is followed immediately by the next floor, with its threat already visible.
- The menu shows the next milestone and the daily contract, so there is always a reason to come back.

---

## 5. Heat

### State

```ts
interface HeatState {
  heat: number;              // 0..100
  tier: 0 | 1 | 2;           // 0 below 34, 1 at 34, 2 at 67
  enforcerReleased: boolean; // true once the boss/enforcer is released
  elapsed: number;
}
```

Heat is owned by a new `HeatSystem` (`src/gameplay/Heat.ts`), reset per room.

### Gain

| Source | Heat |
|---|---:|
| Passive | +0.6/s |
| Regular enemy defeated | +7 |
| Chain event | +10 |
| Hazard kill | +12 |
| Multi-kill | +8 |
| Player takes damage | +5 |

- Heat never decreases.
- If all regular enemies are dead before 100, heat accelerates at **+20/s** until 100, so the boss always gets its entrance.
- If the room passes **90 seconds**, passive gain becomes **+5/s** until 100. The landlord gets impatient; the floor cannot stall forever.
- Target floor length: **60–120 seconds**. Regular phase 20–50 seconds; boss phase 30–60 seconds. Rooms 2–9 have only 2–4 regular enemies, so object destruction and chains are the main heat sources, not raw kill count.
- An active player reaches 100 in **40–70 seconds**. A passive player reaches it by about **110 seconds**.

### Thresholds

**34 — THEY NOTICED**
- All pending regular enemies get `delay = min(delay, elapsed + 2)`.
- Banner: `THEY NOTICED` / `the rest of the crew is rushing`.
- Knock sound, small camera shake, music intensity 2.
- Heat bar label appears.

**67 — THE ROOM LOSES IT**
- One themed hazard event, telegraphed by a 1-second floor marker and sound:
  - Water room: energize an existing water zone, or burst a pipe and create one.
  - Fire room: ignite a flammable object near the center.
  - Office/living: drop a heavy object (table, wardrobe, crate) from above.
  - Fallback: a power surge that electrifies water or ignites paper.
- Banner: `THE ROOM LOSES IT` / the event name.
- Alarm sound, camera shake, music intensity 3.
- The event must not instantly kill the player. It is a spectacle and a weapon, not a cheap hit.

**100 — INCOMING**
- Release the boss/enforcer.
- If regular enemies remain, they stay. The boss joins the fight.
- The room clears only when the boss and every regular enemy are down.

### HUD

- A thin heat bar sits under the line-up. Left: `HEAT`; right: the boss's mug and name.
- Fill color goes yellow → orange → red; the bar pulses at each tier.
- At 100 the bar fills red and shakes.
- The bar is an ARIA progressbar with `aria-valuenow`; tier labels are text, not color alone.
- On mobile the bar is compact and sits above the line-up.

---

## 6. Boss arrival and boss fight

### Arrival

The boss is added to the room's pending list at room start with a high delay, so its mug is visible in the line-up from the first second. At heat 100 its delay is set to 0.

The existing boss sounds fire (`bossWalk`, `knock`, `bossRoar`), plus:

- 0.2s slow-mo and 0.6 camera shake.
- A dedicated **INCOMING** card: small red `ENFORCER` or `HEADLINER` stamp, the boss name in ransom letters, a one-line threat, and the boss mug. 2.2 seconds; any input skips it.
- The generic `bossBanner` is suppressed when the incident card is shown, so the screen is not doubled.
- Music intensity 3 and a brief low-pass drop.

### Boss fight

- A **boss health bar** appears at the top centre when a boss is alive. It replaces the line-up while the boss is on screen. It shows the boss name, a segmented bar, and phase pips.
- Phase changes flash the bar and show the phase announce. Existing `Enemy.applyPhases` already announces; add a `BOSS_PHASE` event or poll `phaseIndex` in the HUD.
- At 50% HP, trigger the room's arena event once: a hazard surge, a furniture collapse, or a fire/water event. This keeps the second half of the fight different from the first.
- On defeat: 0.35s slow-mo, confetti, stamp, boss title banner, exit door opens.
- Boss HP is unchanged for campaign bosses. The fight is made readable, not longer.

### Headliner vs Enforcer

- **Headliner** = a handcrafted campaign boss (rooms 2–9). Uses boss art, phases, the boss health bar, and the INCOMING card. Counts as a boss: `hasBoss = true`, `bossesBeaten++`, 100-scrap first clear, RENT COLLECTOR progress, and the next-floor mug.
- **Enforcer** = a non-campaign mini-boss. A scaled elite regular (`heavy`, `shield`, `hurler`, etc.) with a custom name, 2.5× HP, 1.15× speed, a crown badge, a single-segment health bar, and the INCOMING card. It uses the boss entrance sounds. It does **not** count as a boss: `hasBoss = false`, `hasEnforcer = true`, no `bossesBeaten`, no 100-scrap bonus, no RENT COLLECTOR progress.
- **Room 1 (tutorial):** no boss or Enforcer in phase 1. The tutorial already ends with the BIG RED BUTTON and confetti. The first Edge choice is the bridge into room 2. A scripted Foreman is a phase-2 idea.
- **Depths:** every third room keeps its existing Headliner. Other kill-all Depths rooms get an Enforcer at heat 100.
- **Daily:** a generated room. If it has a Headliner, use it; otherwise add an Enforcer. The daily should feel like a full incident.
- **Survival rooms:** generated rooms with a `survive` objective keep their timer and do **not** spawn a Headliner or Enforcer. At heat 100 they get a final hazard surge (the same themed event) and the timer still wins. This preserves the existing objective and avoids a timer that auto-kills the boss.

---

## 7. Edges (post-clear rewards)

### What

After every cleared campaign or depths floor, offer **three Edge cards**, one from each category:

- **HEAVY** — offense.
- **SLICK** — defense and utility.
- **GREED** — economy and score.

Pick one to continue. Edges last for the run and stack. Rarity: **common 65%, rare 30%, legendary 5%**. At least one card is rare or better; if the roll produces three commons, upgrade one to rare. Duplicates stack their effect.

### V1 cards

| Category | Name | Rarity | Effect |
|---|---|---|---|
| HEAVY | HEAVY HANDS | common | +25% impact damage. |
| HEAVY | CHAIN GANG | rare | Chains deal +35% damage and grant +25% more heat. |
| HEAVY | DEMOLITION | rare | Hazard damage +50%. |
| HEAVY | THROWN AWAY | legendary | The first object you throw each floor explodes on impact (40 damage, small radius). |
| SLICK | SECOND WIND | common | Start each floor with 1 bubble-wrap armour. |
| SLICK | QUICK FEET | common | +12% move speed, +10% dash distance. |
| SLICK | INSURANCE | rare | Survive one fatal hit per run at 2 HP. |
| SLICK | BEST FRIEND | rare | Pet frenzy lasts 50% longer. |
| GREED | SCAVENGER | common | +50% scrap from kills. |
| GREED | CROWD PLEASER | rare | +25% score; +10% more per consecutive clear without a retry. |
| GREED | HEADLINE | legendary | The first kill of each floor triggers a free explosion/chain. |

The list is data-driven so more cards can be added without UI work. Effects that stack are additive; caps: move speed +30%, scrap +150%, ability cooldown −50%.

### Rules

- Edges are run-only. A new run clears them.
- On fail, Edges stay for the retry, but the clear streak resets.
- The choice is required to continue. There is no skip.
- The offer is drawn from a run RNG, not the room seed. One per category; no duplicate card in the same offer.
- The first offer shows a one-line coach: `PICK ONE. IT LASTS THIS RUN.`

### Where

- Integrated into the victory screen, above the small `REPLAY`/`HOME` links.
- Tapping a card applies it and immediately calls `nextRoom()`. The pick *is* the next action.
- The card shows name, category, rarity, effect, and a one-line flavour. Rarity gets a colour and a text label. Legendary gets confetti and a sting.
- On mobile, the three cards stack vertically or scroll horizontally; tap to pick.
- On a failed run there are no cards. Show `EDGES KEPT` and `STREAK LOST` instead.

### Run state

Add to save v5:

```ts
runActive: boolean;
runFloor: number;        // next floor to play
runStreak: number;       // consecutive clears without a retry
runBoosts: string[];     // Edge ids
runScore: number;        // score carried across floors
dailyRareEdge: boolean;  // day-7 daily reward: next Edge offer has a rare+
```

- `playFrom(index)` starts a new run: clears `runBoosts`, sets `runFloor = index`, `runStreak = 0`, `runScore = 0`, `runActive = true`.
- `nextRoom()` increments `runFloor` and records the picked Edge.
- `summarize(cleared)` on a clear increments `runStreak` and stores `runScore = score.score`; on a fail resets `runStreak` to 0 but keeps `runBoosts` and the score at the start of the failed floor.
- `toMenu()` keeps `runActive` true and keeps `runScore`. The menu shows CONTINUE RUN at `runFloor`.
- Selecting a different floor from the menu starts a new run from that floor. The PLAY button says `NEW RUN` in that case.
- If `runActive` and `runFloor > unlockedRoom`, clamp to `unlockedRoom`.
- If the tab closes after a clear but before the Edge pick, the run continues at the next floor with the old Edges; the unclaimed Edge is lost. Acceptable.
- Other v5 fields: `starRewardsClaimed: string[]`, `tutorialSkipped: boolean`, `dailyRareEdge: boolean`, `enforcersBeaten: number`.

---

## 8. The ladder (main menu)

The menu should sell three things: **the next floor**, **today's contract**, and **the next star milestone**.

### Main screen

- **Header:** logo, tagline, gear.
- **Run strip:** if a run is active, `RUN · FLOOR 4/9 · STREAK 3 · 2 EDGES` with a big `CONTINUE` button. Otherwise, `START A RUN` with the selected floor.
- **Next floor card:** the selected/next floor as a big key tag with the floor name, the boss mug and boss name, the bonus objective, and a `NEXT` ribbon. This replaces the current map button as the main focus.
- **Today's Contract card:** date, generated room name, bonus objective, reward, and streak. If done, `DONE TODAY · back tomorrow` plus the streak.
- **The Ledger strip:** 9 milestone tickets; the next one is highlighted with `★ 7/9`.
- **Heroes:** keep the four hero cards.
- **Action bar:** `PLAY FLOOR N` / `CONTINUE RUN`, hero summary.
- **The Depths card:** after room 9, a dark card with `DEEPEST FLOOR` and `DESCEND`.

### Full ladder

- Keep the existing map overlay pattern. It becomes **THE BUILDING**: floors grouped by act, vertical, with:
  - key tag number, name, boss mug, stars, best score.
  - locked tiles face-down with `clear floor N`.
  - the next floor has a red `NEXT` ribbon and pulses.
  - completed floors get a stamp; 3-star floors get a gold border.
  - boss floors are taller and darker.
- The main screen focuses on the next floor; the full building is one tap away. This keeps mobile tidy.

### First-run guidance

- The first time the player enters room 2, the heat meter shows a one-line coach: `CAUSE TROUBLE. HE'LL COME TO YOU.`
- The first Edge offer shows `PICK ONE. IT LASTS THIS RUN.`
- The first Ledger milestone shows a toast: `LEDGER: 3★ — 100 SCRAP.`
- The first daily card gets a `NEW` tag.

---

## 9. The Ledger (star track)

Total stars 0–27. Milestones auto-claim when reached; a toast/card appears on the results screen. Rewards are permanent but small.

| Stars | Reward |
|---:|---|
| 3 | 100 scrap |
| 6 | +15% score |
| 9 | Start each run with a random common Edge |
| 12 | 200 scrap |
| 15 | +20% scrap from kills |
| 18 | Start each run with a random rare Edge |
| 21 | 300 scrap |
| 24 | Ability cooldowns −15% |
| 27 | MASTER KEY: the Depths start at floor 10; gold nameplate on the menu |

- `starRewardsClaimed: string[]` in save v5.
- `claimStarRewards(save)` runs after stars update, in `summarize`.
- Effects are read by `Game`/`ScoreSystem`/`Abilities`; no new currency.
- Stars never gate the critical path. The Ledger is optional power and bragging rights.
- The Ledger is visible on the menu as a strip of tickets with the next reward highlighted.

**Star eligibility**

- Only the nine handcrafted rooms write `roomStars`; Depths and daily clears do not. This guarantees the Ledger total is 0–27.
- Room 1 has no `challenge`, so it gets a special third star: **finish the lesson plan without pressing SKIP**. Add `tutorialSkipped` to save v5 (reset on a tutorial replay). The challenge star text is `FINISH THE LESSON PLAN`; it pays no scrap, just the star.
- `campaignProgress` continues to use the nine rooms and 27 stars.

**Why these rewards:** they reward replaying floors for 3 stars, they are easy to explain, and none of them removes the need to play well.

---

## 10. Today's Contract (daily)

Surface the existing `dailyChallenge()`.

### Menu card

- Title: `TODAY'S CONTRACT`.
- Subtitle: the generated room name and bonus objective.
- Streak: `🔥 3`.
- Reward: the day's scrap (and the day-7 rare Edge).
- Button: `PLAY`.
- If `lastDaily === todayKey()`: `DONE TODAY · back tomorrow` plus the streak.

### Streak rewards

| Day | Reward |
|---:|---|
| 1 | 40 scrap |
| 2 | 60 scrap |
| 3 | 80 scrap |
| 4 | 100 scrap |
| 5 | 120 scrap |
| 6 | 150 scrap |
| 7 | 250 scrap + a guaranteed rare Edge for the next run |
| 8+ | wraps to day 1 reward; the streak count keeps going for bragging |

- The daily uses the heat/boss system. It should feel like a full incident, not a side mode.
- **The daily is independent of the active run.** `playDaily()` does not modify `runActive`, `runBoosts`, or `runScore`. It does not use the run's Edges; it is tuned as a standalone challenge with a weaker Enforcer (or no Enforcer in survival rooms).
- **Day-7 reward:** set `dailyRareEdge = true`. The next Edge offer from any campaign or Depths run has a guaranteed rare-or-better card. The flag is consumed when that offer is generated. It is not applied to the daily itself.
- Fix the current exploit: the daily bonus is awarded **once per day**. Replaying the daily can still chase a high score, but it does not pay the daily bonus again.
- Keep the existing ad policy; do not add ads to the daily results.

---

## 11. The Depths (endless tail)

- Keep the existing generated endless mode; surface it.
- After room 9, a `THE DEPTHS` card on the menu with `DEEPEST FLOOR` and `DESCEND`.
- Every floor uses heat. Every third floor has a Headliner. Other kill-all floors get an Enforcer at heat 100.
- Edges persist across the descent. Death ends the run and clears Edges; `deepest` records the deepest floor **cleared**. DESCEND starts a new run at `deepest + 1` with no Edges.
- The 27★ Master Key starts DESCEND at **Depths depth 10** (floor 19), skipping the first nine depths floors.
- This is the "play as long as possible" mode. No new content required; it reuses the generator and bosses.

---

## 12. Data and code map

### New files

- `src/gameplay/Heat.ts` — heat state, tiers, events, boss release, run-streak integration.
- `src/gameplay/Edges.ts` — Edge definitions, categories, rarity, offer generation, effect lookup.
- `src/gameplay/StarLedger.ts` — milestones, claim logic, effect queries.
- `src/gameplay/Daily.ts` — reward table and streak helpers (or extend `Campaign.ts`).
- `src/ui/EdgeCards.ts` — the 3-card choice UI used by `ResultsScreen`.
- `src/ui/ThreatCard.ts` — optional; the INCOMING card can live in `HUD.ts`.

### Modified files

- `src/save/SaveManager.ts` — v5 fields, migration, sanitize.
- `src/core/Game.ts` — run state, heat integration, boss release, Edge application, summary fields, star claims, daily rewards, continue/new-run flow.
- `src/gameplay/RoomManager.ts` — boss/enforcer in pending at room start, heat release, compressed waves, generated-room enforcer.
- `src/gameplay/Room.ts` — optional `enforcer`/`headliner` metadata on `RoomEnemySpec` (custom name, HP scale, crown flag).
- `src/gameplay/Campaign.ts` — per-room threat metadata (display name, entrance line), ledger constants.
- `src/ui/HUD.ts` — heat bar, boss health bar, INCOMING card, boss mug.
- `src/ui/ResultsScreen.ts` — Edge cards, streak, Ledger toast, daily streak, next-floor teaser.
- `src/ui/MainMenu.ts` — run strip, next-floor card, daily card, Ledger strip, building overlay, Depths card.
- `src/ui/UI.ts` — wire Edge pick/continue, daily, new run, continue.
- `src/styles.css` — heat bar, boss bar, incoming card, Edge cards, ladder, ledger, daily card.
- `src/audio/AudioManager.ts` / `Music.ts` — reuse existing boss sounds and intensity; add a small rarity sting only if a clip exists, otherwise synth.

### Reuse

- Boss art, behaviour, and phases.
- `ZoneManager` for the 67% hazard event.
- `RoomManager.pending` for scheduling.
- `ScoreSystem` for scrap/score; add multipliers.
- `Abilities` for cooldown/power Edges.
- `Player` for speed, armour, insurance.
- `Pets` for frenzy duration.
- `Ads`/`Portal` unchanged.

---

## 13. Exact behaviours and numbers

- Heat passive: 0.6/s. After 90s: 5/s. All regulars dead before 100: 20/s.
- Heat sources: kill +7, chain +10, hazard kill +12, multi-kill +8, player damage +5, object broken +2, hard object impact +0.5 (capped at +4/s).
- Tier thresholds: 34, 67, 100.
- Tier 1: all pending regular enemies get `delay = min(delay, elapsed + 2)`.
- Tier 2: one themed hazard event, 1s telegraph.
- Tier 3: release boss/enforcer; it is in the line-up from room start.
- Campaign boss HP: unchanged.
- Enforcer HP: 40% of base boss HP, +5% per depth beyond 9, capped at 70%. Use an elite regular for the tutorial/depths early; use a boss type where the player is strong.
- Boss health bar: segmented by phase thresholds; phase pips; name.
- Edge rarity: 65/30/5; at least one rare+ per offer.
- Edge caps: move speed +30%, scrap +150%, cooldown −50%.
- Star Ledger: as table above.
- Daily: as table above; one bonus per day.
- Scrap economy: keep current kill scrap and first-clear bonuses; Ledger grants 100–300; abilities cost 120–150. A player should afford an ability within 2–3 rooms.
- Run streak: +1 per clear; fail resets to 0. `CROWD PLEASER` reads it.
- Every 3 consecutive clears: +25 scrap (small streak payout). Every 5: one guaranteed rare Edge in the next offer. These are optional; tune after playtest.

---

## 14. UX and accessibility

- All new UI is keyboard navigable. Edge cards are buttons; focus moves to the first card.
- Heat bar is a progressbar with text tiers.
- Rarity has a text label, not just colour.
- Reduced shake: no camera shake; card animations become fades; slow-mo shortened or disabled.
- High contrast: heat bar uses text and pattern; card borders are strong.
- Mobile: Edge cards stack; heat bar compact; boss bar top-centre; INCOMING card short.
- Text voice: lower-case room names, ransom-note banners, dry landlord lines. Edge names are shouted; flavour lines are deadpan.
- No new unskippable cutscenes. The INCOMING card is skippable by any input.

---

## 15. Telemetry

Track with the existing `AnalyticsManager`:

- `run_start`, `run_continue`, `run_end` (reason, floor, streak, edges).
- `heat_tier` (tier, room, seconds).
- `boss_arrive` (heat, seconds, room).
- `boss_defeat` (seconds, damage taken).
- `edge_offer` (ids), `edge_pick` (id, rarity, floor).
- `star_milestone` (stars, reward).
- `daily_start`, `daily_clear` (streak).
- `floor_retry` (fail count).

Use these to tune heat rates, drop-off, and Edge pick distribution.

---

## 16. Success measures

- Room 1 → room 2 continuation rate (the current drop-off).
- Median floors per session; sessions per week.
- Edge pick distribution: no card above 40%.
- Retry rate after fail; daily return rate.
- 3-star rate per floor.
- Target: +50% median session length; +25% day-2 return (baseline to be measured).

---

## 17. Build order

1. Save v5 + run state + Edge data (no UI yet).
2. Heat system + boss release + tier events + HUD meter.
3. Boss arrival card + health bar + phase/defeat feedback.
4. Edge offer UI + results integration + apply effects.
5. Menu: continue run + next-floor card + daily card + Ledger strip + building overlay.
6. Star Ledger + daily rewards.
7. Depths/daily integration.
8. Telemetry, tuning, playtest.

Phase 2 after playtest: scripted tutorial Foreman, more Edges, floor mastery/contract variants, local leaderboards, more boss intro polish.

---

## 18. My calls (builder can proceed)

- Reuse existing campaign bosses as Headliners. Do not add a second boss to rooms 2–9.
- Do not add a boss or Enforcer to the tutorial in phase 1. The first Edge choice is the bridge to room 2.
- Enforcers are scaled elite regulars. They do not count as bosses, do not trigger `bossesBeaten` or the 100-scrap bonus, and use a single-segment health bar.
- Survival rooms keep their timer and do not spawn a Headliner or Enforcer. Heat 100 is a final hazard surge.
- Edges are run-only; no permanent Edge tree.
- The Edge choice is required to continue; no skip.
- Stars never gate the critical path. Only the nine handcrafted rooms write stars.
- Room 1's third star is `FINISH THE LESSON PLAN` (no SKIP).
- Campaign fail keeps Edges on retry. Depths fail ends the run and clears Edges.
- REPLAY on a win starts a new run at that floor.
- Daily is independent of the active run, uses no run Edges, and does not touch run state. Day-7 reward is a `dailyRareEdge` flag consumed by the next Edge offer.
- Keep the existing ad policy; do not add ad pressure.
- Daily streak uses the existing `dailyStreak`; no new currency.
- Ledger rewards are permanent but small; no new art.
- Run state and run score persist in save v5; returning to menu pauses the run.
- The 27★ Master Key starts DESCEND at Depths depth 10 (floor 19), not campaign floor 10.
- The main screen focuses on the next floor; the full building is an overlay.

## 19. Needs your approval

1. **Depths death rule.** Recommended: campaign retry keeps Edges; a Depths death ends the run and clears Edges, then DESCEND starts at the next unbeaten floor. Alternative: all retries keep Edges, which is friendlier but removes the Depths' stakes.
2. **Ledger power.** Recommended: small permanent power (scrap, score, starting armour/Edge, cooldown). Alternative: cosmetic-only, which is purer but a weaker reason to chase 3 stars.
3. **Ad frequency.** Recommended: keep the current policy; do not add an interstitial before the Edge choice or on retry. Alternative: reduce interstitials to protect the "one more floor" flow.

Everything else in this document is my call and is written into the design.

---

## 20. Test plan

- `npm run typecheck` (tsc --noEmit) after each phase.
- `npm run test:physics` to ensure the simulation still passes.
- Manual flow:
  - Fresh save → tutorial → room 2 → boss at heat 100 → Edge pick → room 3.
  - Fail a room → retry keeps Edges, streak resets.
  - Return to menu mid-run → CONTINUE runs at the right floor.
  - Clear room 9 → Depths card → descend → boss every third floor.
  - Daily: play once → streak +1; replay same day → no second bonus.
  - Ledger: reach 3★ → reward claims once; reload → no double claim.
  - Mobile viewport: Edge cards, heat bar, boss bar, building overlay.
  - Reduced shake / high contrast toggles.
  - Save v4 fixture → loads with no active run, no Ledger claims.
- Analytics: events fire once per action; no duplicate `boss_arrive`.

---

## 21. Open items for the plan

- Exact room-by-room threat names and entrance lines.
- Exact Edge flavour text.
- Enemy count/delay tuning per room after the heat system is playable.
- Whether the tutorial Foreman is needed in phase 2.
- Whether the Depths should use a different Edge pool or the same pool.
- Whether the daily should offer a one-off Edge for the next run (phase 2 idea).
