# BONK Run Progression — Implementation Plan

**Spec:** [`docs/superpowers/specs/2026-10-20-bonk-progression-design.md`](../specs/2026-10-20-bonk-progression-design.md)
**Working directory:** `everything-is-a-weapon/` unless a path says otherwise.
**Goal:** Make every room feel like an escalating incident with a readable boss arrival, a run-long reward choice, and a visible reason to start the next room. Keep the nine handcrafted rooms and their story.
**Save version:** 4 → 5.
**Primary metric:** playtime and return visits, not short-term ad impressions.

---

## Architecture

Five layers, built in this order:

1. **Save + run model.** A v5 save stores the active run (`runActive`, `runFloor`, `runStreak`, `runBoosts`, `runScore`, `runInsuranceUsed`) plus Ledger and daily fields. `Run.ts` owns every run transition so the rules are testable without a canvas.
2. **Incident layer.** `Heat.ts` turns player chaos into a 0–100 meter with events at 34/67/100. `Incidents.ts` defines **Headliners** (the existing campaign bosses) and **Enforcers** (scaled elite regulars). `RoomManager` releases the incident at heat 100 and spawns it with an arrival card.
3. **Run rewards.** `Edges.ts` defines the 11 run-long cards. `EdgeSystem.ts` turns stacks into multipliers and one-shot effects. `ResultsScreen` offers one HEAVY, one SLICK, and one GREED card after every non-daily clear.
4. **Retention layer.** `StarLedger.ts` turns 27 stars into permanent small bonuses. `Daily.ts` turns the daily into a 7-day streak with a rare-Edge hook. `MainMenu` surfaces the next floor, the daily, the Ledger, and the Depths.
5. **Feedback + telemetry.** HUD heat/boss bars, arrival cards, analytics events, and a balance pass.

The existing `Game` remains the orchestrator. New pure modules never import `Game`; they receive the small state objects they need. This keeps tests fast and prevents accidental DOM access.

### New files

| File | Responsibility |
|---|---|
| `src/gameplay/Heat.ts` | Pure heat meter, tier events, release/surge decision. |
| `src/gameplay/Incidents.ts` | Headliner/Enforcer specs, pending-enemy type, release/rush helpers. |
| `src/gameplay/Edges.ts` | Edge catalogue, seeded offers, stack counts, starting Edge. |
| `src/gameplay/EdgeSystem.ts` | Owned-stack multipliers, per-floor flags, insurance. |
| `src/gameplay/Run.ts` | Pure run lifecycle: start, clear, fail, choose Edge, end, sanitize. |
| `src/gameplay/StarLedger.ts` | Nine star milestones, claims, permanent bonuses. |
| `src/gameplay/Daily.ts` | Seven-day daily streak, rewards, settle/status. |

### Modified integration points

`Game.ts` (orchestration), `RoomManager.ts` (release + spawn), `SaveManager.ts` (v5), `ResultsScreen.ts` + `UI.ts` (Edge cards, run/daily feedback), `MainMenu.ts` (run strip, daily, Ledger, Depths), `HUD.ts` (heat, boss, arrival), `ScoreSystem.ts` (Edge/ledger multipliers), `Enemy.ts` (damage modifiers, incident tag), `Player.ts` (movement, dash, insurance), `Tutorial.ts` (skip flag), `Pets.ts` (Cat frenzy), `Abilities.ts` (Ledger cooldown), `EnemyArt.ts` (Enforcer crown), `styles.css`, `AnalyticsManager.ts`, `package.json`.

### Do not touch

`src/gameplay/ImpactSystem.ts` already contains uncommitted user work. Edge damage modifiers live in `Enemy.takeImpact`/`Enemy.damage`, not in `ImpactSystem`.

---

## Global Constraints

- **Preserve the nine handcrafted rooms and all story text.** No new rooms, no new bosses.
- **Every non-tutorial, non-survival, non-daily room gets exactly one incident:** a Headliner in campaign rooms 2–9, an Enforcer in non-boss Depths rooms, a Headliner in boss Depths rooms.
- **Headliners are existing bosses.** `RoomDefinition.boss` stays the source of truth. `bossesBeaten`, the 100-scrap boss bonus, and boss star eligibility apply to Headliners only.
- **Enforcers are scaled regulars.** They use an existing regular `EnemyType` with a custom name and scaled HP/speed. They do **not** increment `bossesBeaten`, award 100 scrap, write stars, or change `unlockedRoom`. They do increment `enforcersBeaten`.
- **Stars are written only by the nine handcrafted rooms.** `starRewardsClaimed` is a separate Ledger state. Depths, daily, and Enforcers never add stars.
- **Survival rooms keep their timer and spawn no incident.** Heat 100 triggers a final hazard surge instead.
- **Daily is a separate one-room mode.** It must not clear, advance, or spend the active campaign/Depths run or its Edges. `EdgeSystem.active` is false during daily.
- **Ads keep the current cadence.** No new interstitial before the Edge choice, after a clear, on retry, or on death.
- **Depths death ends the run, but not before the rewarded continue decision.** `summarize` reports `runEnded`; it does not clear save state. `retryAfterFail`/`abandonRun` clear; `continueWithReward` keeps Edges.
- **Target floor length is 60–120 seconds** in rooms 2–9, with a 0–40s regular phase, a 5.2s boss walk, and a 20–50s boss fight.
- **TypeScript strict.** No `any`; no non-null assertions added where a guard is possible. Keep imports ordered like the surrounding file.
- **No new art assets.** Edge cards, heat meter, boss bar, arrival card, and menu sections are DOM + CSS.
- **Preserve user work.** The tree already has uncommitted edits in `Game.ts`, `Enemy.ts`, `Player.ts`, and `ImpactSystem.ts`. Never `git checkout` those files. Read the diff first. If a task must edit one, stage only this plan's hunks, or ask the user to commit their work first.

---

## Implementation Decisions Resolved Here

These clarify the spec where implementation exposed an edge case:

1. **`runFloor` clamp:** valid while `runFloor <= max(unlockedRoom, deepest + 1, Master Key start 18)`. The spec's `unlockedRoom` clamp alone would invalidate a legitimate Depths run, because `unlockedRoom` stops at 9; without the Master Key ceiling it would also reject a floor-19 run on reload.
2. **Depths fail is a deferred end:** `summarize(false)` on a Depths room sets `runEnded: true` but leaves save state intact. `continueWithReward()` keeps it. Only `retryAfterFail()` (new run) or `abandonRun()` (home) calls `endRun`.
3. **`dailyRareEdge` is consumed on Edge pick, not on offer generation.** A refresh or HOME on the results screen must not waste the day-7 reward.
4. **Room 1's third star uses a per-attempt flag.** `save.tutorialSkipped` is historical/analytics; `Game.tutorialSkippedThisRoom` decides the star. Replaying room 1 without SKIP can recover the star, so 27★ is never permanently missable.
5. **`descendStart` returns a 0-based room index.** First Depths floor is index `9` (displayed floor 10); 27★ Master Key starts at index `18` (displayed floor 19).
6. **`unlockedRoom` advances only for handcrafted rooms.** `deepest` advances for both handcrafted and Depths floors. The menu's "next floor" uses `runFloor` for an active run, otherwise `unlockedRoom`.
7. **Per-floor Edge flags reset on `loadRoom`; insurance does not.** `HEADLINE ACT`, `GLASS CANNON`, and `SECOND WIND` armour are per floor. `FINE PRINT` is once per run and persists through campaign retries.
8. **Save v5 adds `runInsuranceUsed`.** Without it, an insurance charge could be reused by reloading.

---

## Review Focus

An implementer should stop and ask if any of these are true:

1. **A v4 save loses progress or unlocks.** Load a real v4 payload; `unlockedRoom`, `roomStars`, `scrap`, `abilities`, `tutorial`, `deepest`, and settings must survive. New fields default safely. Test first.
2. **Daily touches the active run.** Start a run, reach an Edge, return to the menu, play the daily, then CONTINUE. The floor, score, streak, and Edges must be identical. `runActive` must not flip.
3. **Depths death clears Edges before the ad.** On the fail screen, `save.runBoosts` and `runActive` must still be intact; only RETRY/HOME end the run. The rewarded continue must keep them.
4. **An Enforcer leaks into boss progression.** Kill one in a non-boss Depths room: `bossesBeaten` unchanged, no +100 scrap boss bonus, no stars, `enforcersBeaten` +1, final room considered cleared. The HUD may show its small boss bar.
5. **Heat spawns a boss in tutorial or survival, or blocks a clear.** Room 1 has no heat UI and no incident. A survival room at heat 100 creates a fire surge, not a pending boss; the timer still clears. No room can end with a pending incident that never spawns.

---

## Pre-flight (do this before Task 1)

1. From the repo root, run `git status --short` and `git diff --stat`.
2. Confirm the four modified files: `everything-is-a-weapon/src/core/Game.ts`, `src/entities/Enemy.ts`, `src/entities/Player.ts`, `src/gameplay/ImpactSystem.ts`.
3. Save a backup patch outside the tree:
   `git diff -- everything-is-a-weapon/src/core/Game.ts everything-is-a-weapon/src/entities/Enemy.ts everything-is-a-weapon/src/entities/Player.ts everything-is-a-weapon/src/gameplay/ImpactSystem.ts > ..\user-wip-before-bonk-progression.patch`
4. Ask the user to commit those files, or agree that this plan may stage only its own hunks. Do **not** start editing until this is settled.
5. Baseline commands, all from `everything-is-a-weapon/`:
   - `npm run typecheck`
   - `npm run test:physics`
6. If either baseline fails, record the failure. Do not fix unrelated failures in this plan.

---

## Phase 1 — Foundation: save, Edges, run model

### Task 1 — Save v5 + a unit-test harness

**Files:** `package.json`, `package-lock.json`, `src/save/SaveManager.ts`, `src/save/SaveManager.test.ts`

**Step 1: Add Vitest.** From `everything-is-a-weapon/` run `npm install -D vitest`. Add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Do not add jsdom. Every test in this plan is a pure Node test; UI is verified in the browser. Vitest's default include pattern picks up `src/**/*.test.ts`.

**Step 2: Write the failing migration test first.** Create `src/save/SaveManager.test.ts` with an in-memory `PortalStorage`:

```ts
class MemoryStorage implements PortalStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  setItem(key: string, value: string): void { this.map.set(key, value); }
  removeItem(key: string): void { this.map.delete(key); }
}
```

Tests, exact names:

- `migrates a v4 save without losing progress`: raw payload with `version: 4`, `unlockedRoom: 5`, `deepest: 6`, `scrap: 420`, `abilities: ['blast','freeze']`, `roomStars: { 'room-1': 3 }`, `tutorial: 'done'`. Assert `SAVE_VERSION === 5`, all old values unchanged, and every v5 field has its default.
- `starts a fresh save with v5 run defaults`: `runActive === false`, `runFloor === 0`, `runStreak === 0`, `runBoosts === []`, `runScore === 0`, `runInsuranceUsed === false`, `starRewardsClaimed === []`, `tutorialSkipped === false`, `dailyRareEdge === false`, `enforcersBeaten === 0`.
- `keeps duplicate run boosts because Edges stack`: raw `runBoosts: ['heavy_hands','heavy_hands','quick_feet']`; after load, the array is unchanged.
- `drops unknown ability ids and keeps known ids`: `abilities: ['blast','not_real']` becomes `['blast']`.
- `round-trips an active run`: set `runActive`, `runFloor`, `runStreak`, `runBoosts`, `runScore`, `runInsuranceUsed`; `write()` then load with a new manager; all values equal.
- `sanitizes invalid numbers`: `runFloor: -3`, `runStreak: NaN`, `runScore: -10` become finite non-negative defaults.

Run `npx vitest run src/save/SaveManager.test.ts`. It must fail because the fields/version do not exist.

**Step 3: Implement v5.** In `SaveManager.ts`:

```ts
export const SAVE_VERSION = 5;
```

Add to `SaveData`:

```ts
runActive: boolean;
runFloor: number;
runStreak: number;
runBoosts: string[];
runScore: number;
runInsuranceUsed: boolean;
starRewardsClaimed: string[];
tutorialSkipped: boolean;
dailyRareEdge: boolean;
enforcersBeaten: number;
```

`defaults()` sets those to `false, 0, 0, [], 0, false, [], false, false, 0`. `migrate()` gains a version-5 branch that sets exactly those defaults and preserves everything else. `sanitize()` must:

- keep `runBoosts` as a string array **without deduping** (duplicates are stacks);
- use `stringArray` + `new Set` for `starRewardsClaimed`;
- clamp `runFloor`, `runStreak`, `runScore`, `enforcersBeaten` to finite integers ≥ 0 (use the existing `number`/`int` helpers or a local clamp);
- default `runActive`, `runInsuranceUsed`, `tutorialSkipped`, `dailyRareEdge` to booleans;
- leave `unlockedRoom` and `deepest` semantics unchanged.

Do not import `Edges.ts` here. Edge IDs are filtered later by `Run.sanitizeRun`, which keeps SaveManager independent of gameplay.

**Step 4: Pass + verify.**

- `npx vitest run src/save/SaveManager.test.ts` green.
- `npm run typecheck` green.
- Commit only `package.json`, `package-lock.json`, `SaveManager.ts`, `SaveManager.test.ts`: `feat: add save v5 run state and unit tests`.

---

### Task 2 — Edge catalogue and seeded offers

**Files:** `src/gameplay/Edges.ts`, `src/gameplay/Edges.test.ts`

**Step 1: Define the data.** `Edges.ts` imports only `type Rng` from `../core/Random` (the same module `Game` and `RoomGenerator` use). It exports:

```ts
export type EdgeCategory = 'heavy' | 'slick' | 'greed';
export type EdgeRarity = 'common' | 'rare' | 'legendary';
export type EdgeId =
  | 'heavy_hands' | 'chain_reaction' | 'headline_act'
  | 'quick_feet' | 'second_wind' | 'glass_cannon'
  | 'scrap_luck' | 'crowd_pleaser' | 'magnate'
  | 'cat_frenzy' | 'fine_print';

export interface EdgeDefinition {
  readonly id: EdgeId;
  readonly category: EdgeCategory;
  readonly rarity: EdgeRarity;
  readonly name: string;
  readonly effect: string;
  readonly flavor: string;
}
```

Catalogue (exact effects; numbers live here only):

| id | category | rarity | name | effect | flavor |
|---|---|---|---|---|---|
| `heavy_hands` | heavy | common | HEAVY HANDS | +25% impact and hazard damage. | “Swing like the deposit is refundable.” |
| `chain_reaction` | heavy | rare | CHAIN REACTION | +35% damage from the second chain link onward. | “One thing. Then another.” |
| `headline_act` | heavy | legendary | HEADLINE ACT | Your next Headliner takes 30% more damage. Once per floor. | “They came for the finale. Give them one.” |
| `quick_feet` | slick | common | QUICK FEET | +12% move speed and +20% dash speed. | “The floor is lava. Keep moving.” |
| `second_wind` | slick | rare | SECOND WIND | Start every floor with 1 bubble-wrap armour. | “You get one free mistake.” |
| `glass_cannon` | slick | legendary | GLASS CANNON | +25% move speed, but the next hit you take deals double damage. | “Nothing behind you matters.” |
| `scrap_luck` | greed | common | SCRAP LUCK | +20% scrap from everything. | “Everything is worth something.” |
| `crowd_pleaser` | greed | rare | CROWD PLEASER | Score multiplier grows with your run streak. | “The crowd remembers a streak.” |
| `magnate` | greed | legendary | MAGNATE | +40% scrap, but -10% score. | “You can’t spend applause.” |
| `cat_frenzy` | greed | rare | CAT FRENZY | The cat attacks twice as fast and hits 50% harder. | “The cat has opinions.” |
| `fine_print` | greed | common | FINE PRINT | Your next fatal hit leaves you at 1 HP. Once per run. | “There is always a clause.” |

`EDGE_BY_ID: Record<EdgeId, EdgeDefinition>`, `EDGE_IDS: EdgeId[]`, `isEdgeId(value: string): value is EdgeId`.

**Step 2: Offer functions.**

```ts
export function offerEdges(rng: Rng, forceRare: boolean): EdgeDefinition[];
export function startingEdge(rng: Rng, rarity: EdgeRarity): EdgeDefinition;
export function edgeStacks(boosts: readonly string[], id: EdgeId): number;
```

`offerEdges` must return exactly 3 definitions, one from each category, no duplicate ids. Use the first random index per category; when `forceRare`, prefer a rare/legendary in the first category that has one, then fill the others normally. It must not mutate RNG state outside the calls required. `startingEdge` filters the catalogue by rarity and picks one with `rng.int(0, list.length - 1)`; if the pool is empty, fall back to common.

**Step 3: Tests.** `Edges.test.ts` exact cases:

- `has 11 unique edges and covers every category/rarity pairing used above`;
- `offers exactly one heavy, one slick, one greed, with no duplicates` over 50 seeded RNGs;
- `forceRare puts at least one rare or legendary in the offer`;
- `startingEdge returns the requested rarity`;
- `edgeStacks counts duplicates` (`['heavy_hands','heavy_hands','quick_feet']` → 2 for `heavy_hands`).

Run `npx vitest run src/gameplay/Edges.test.ts`, implement until green, then `npm run typecheck` and commit: `feat: add Edge card catalogue and seeded offers`.

---

### Task 3 — EdgeSystem: stacks, multipliers, one-shot flags

**Files:** `src/gameplay/EdgeSystem.ts`, `src/gameplay/EdgeSystem.test.ts`

**Step 1: Define the state and interface.** `EdgeSystem` is pure. It takes a small object, not `Game`:

```ts
export interface EdgeRunState {
  runBoosts: string[];
  runStreak: number;
  runInsuranceUsed: boolean;
}

export class EdgeSystem {
  constructor(private readonly state: EdgeRunState) {}
  setActive(active: boolean): void;
  stacks(id: EdgeId): number;
  impactDamageMultiplier(chainLink: number): number;
  hazardDamageMultiplier(): number;
  headlineDamageMultiplier(isHeadliner: boolean): number;
  markHeadlineHit(): void;
  moveSpeedMultiplier(): number;
  dashSpeedMultiplier(): number;
  scoreMultiplier(streak?: number): number;
  scrapMultiplier(): number;
  armorAtFloorStart(): number;
  petFrenzyMultiplier(): number;
  consumeInsurance(): boolean;
  consumeGlassCannon(): boolean;
  beginFloor(): void;
}
```

Rules:

- `setActive(false)` makes every multiplier neutral (1), `armorAtFloorStart()` 0, `petFrenzyMultiplier()` 1, and every `consume*` false. `stacks()` returns 0 while inactive. This is the daily gate.
- `beginFloor()` resets only the per-floor flags (`headlineUsed`, `glassCannonUsed`). `setActive` calls it.
- `impactDamageMultiplier(link)`: `1 + 0.25 * heavyHands`, then chain reaction `if (link >= 2) *= 1 + 0.35 * chainReaction`. This is for all impact damage; Headliner damage is a separate multiplier applied in `Enemy.damage`.
- `hazardDamageMultiplier()`: `1 + 0.25 * heavyHands`.
- `headlineDamageMultiplier(isHeadliner)`: returns 1.30 while `isHeadliner && !headlineUsed`, else 1. It **does not** consume. `markHeadlineHit()` sets `headlineUsed = true` after damage lands. This keeps speculative UI reads safe.
- `moveSpeedMultiplier()`: `1 + 0.12 * quickFeet + 0.25 * glassCannon`, capped at 1.45.
- `dashSpeedMultiplier()`: `1 + 0.20 * quickFeet`.
- `scoreMultiplier(streak = state.runStreak)`: crowd multiplier `min(3, 1 + n * (0.25 + 0.10 * min(5, max(0, streak))))` when `crowd_pleaser` is owned, else 1; then multiply by `(1 - 0.10 * magnate)`. This is the single source of truth for the Magnate penalty.
- `scrapMultiplier()`: `(1 + 0.20 * scrapLuck) * (1 + 0.40 * magnate)`.
- `armorAtFloorStart()`: `second_wind` stacks.
- `petFrenzyMultiplier()`: `1 + 0.5 * catFrenzy`; the pet integration also uses a 2× attack-rate multiplier when stacks > 0 (damage stacks, attack speed does not).
- `consumeInsurance()`: `false` if inactive, `false` if `state.runInsuranceUsed`, else set true and return true.
- `consumeGlassCannon()`: `false` if inactive or already used; set `glassCannonUsed = true` and return true. Used by the next hit taken. This flag resets on `beginFloor`.

**Step 2: Tests.** Exact cases:

- `no edges are neutral` (all multipliers 1, armour 0, pet 1, insurance false).
- `heavy_hands stacks additively` (2 stacks → 1.5 impact; 1 stack → 1.25 hazard).
- `chain_reaction only applies from link 2`.
- `quick_feet and glass_cannon stack and cap movement at 1.45`.
- `crowd_pleaser scales with streak and caps at 3`.
- `scrap_luck and magnate multiply scrap and reduce score` (magnate score penalty).
- `second_wind grants one armour per stack at floor start`.
- `fine_print is once per run` (first consume true, second false).
- `headline_act applies once per floor` (multiplier 1.3, mark, then 1; `beginFloor` makes it 1.3 again).
- `glass_cannon doubles exactly the next hit` (consume true, then false; `beginFloor` resets).
- `inactive EdgeSystem ignores daily cards` (set active false; all neutral, consume false; set active true and the same state works again).

Run `npx vitest run src/gameplay/EdgeSystem.test.ts`, implement, typecheck, commit: `feat: add Edge run modifiers`.

### Task 4 — Apply Edge effects to combat, movement, scrap, pets, insurance

**Files:** `src/core/Game.ts`, `src/entities/Enemy.ts`, `src/entities/Player.ts`, `src/entities/Cat.ts`, `src/gameplay/ScoreSystem.ts`

This is an integration task. Its correctness test is the manual matrix at the end plus the Task 3 unit tests. Read `git diff` on `Game.ts`, `Enemy.ts`, and `Player.ts` first; preserve every unrelated hunk.

**Step 1: Own the system in `Game`.** Import `EdgeSystem` and add:

```ts
readonly edges: EdgeSystem;
```

Assign it immediately after `this.save = new SaveManager(...)`:

```ts
this.edges = new EdgeSystem(this.save.data);
```

Do not construct it as a field initializer; it needs `save`. Add `private devEdges: EdgeId[] = [];` next to it (used by the DEV hook in Step 6).

**Step 2: Activate per room.** In `loadRoom(def, index, daily)` (find the method; it is the one that resets score, abilities, tutorial, HUD), add:

```ts
this.edges.setActive(!daily);
if (import.meta.env.DEV && this.devEdges.length > 0 && !daily) {
  this.save.data.runBoosts = [...this.devEdges];
}
this.edges.beginFloor();
this.score.resetRoom(this.scoreAtRoomStart);
```

`setActive` calls `beginFloor`; the extra call is harmless and documents the per-floor reset. The DEV block applies `?edges=` **after** `playFrom` has cleared the run, otherwise the hook would be erased by `startRun`. In `loadRoom`, after `this.player = new Player(this.room.def.playerStart.x, this.room.def.playerStart.y)`, add:

```ts
this.player.armor = this.edges.armorAtFloorStart();
```

If `loadRoom` currently resets `score` in another place, keep one reset. The score at room start must remain `scoreAtRoomStart`.

**Step 3: Damage hooks.**

- `Enemy.takeImpact(...)`: after the shield/helmet calculation and before `this.damage(...)`, multiply `damage` by `game.edges.impactDamageMultiplier(chain ? chain.steps.length : 0)`. Do not apply the Headliner multiplier here; `Enemy.damage` handles it for every damage source.
- `Enemy.damage(game, amount, cause)`: build the final amount in this order:
  1. if `cause.type === 'hazard'` (and `zone`/`fire`/`electric` if that is how hazards are labelled in this codebase), multiply by `game.edges.hazardDamageMultiplier()`;
  2. multiply by `game.edges.headlineDamageMultiplier(this.type.boss === true)`;
  3. if it is a Headliner and the multiplier was 1.3, call `game.edges.markHeadlineHit()` after the damage is applied.
  Do not double-apply in `ImpactSystem.ts`.
- `ScoreSystem.onEnemyDefeated`: compute `const baseScrap = enemy.type.boss ? 150 : 12 + Math.round(enemy.type.scoreBonus / 10);` then `stats.scrap += Math.round(baseScrap * game.edges.scrapMultiplier());`.
- `ScoreSystem.award`: multiply the final points by `game.edges.scoreMultiplier(game.save.data.runStreak)` before rounding. Keep the combo multiplier separate.
- Multi-kill heat is a later task; do not add heat yet.

**Step 4: Movement and the next-hit contract.**

- `Player.update`: `let speed = MOVE_SPEED * game.edges.moveSpeedMultiplier();`, keeping rage/held/charging/slow multipliers after it.
- Dash: `b.vx = this.dashX * DASH_SPEED * game.edges.dashSpeedMultiplier();` and the same for `vy`.
- `Player.hurt`:
  - Before applying `amount`, if `game.edges.consumeGlassCannon()` returns true, double `amount` and show `GLASS CANNON` popup.
  - If the hit would reduce `hp` to 0 and `game.edges.consumeInsurance()` returns true, set `hp = 1`, `armor = 1`, play a stamp/heartbeat, emit `INSURANCE` popup, call `game.save.write()`, and return false (survived). The second `armor = 1` is a deliberate extra beat so the next hit is not instantly fatal; if that feels too strong in tuning, use `armor = 0` and tune later.
  - Keep the existing invulnerability/dash checks before this block.

**Step 5: Cat frenzy.** In `Cat.ts`, when `game.edges.stacks('cat_frenzy') > 0`:
- multiply `SCRATCH_DAMAGE` and `SWIPE_DAMAGE` in the two `damage` calls by `game.edges.petFrenzyMultiplier()`;
- while the tuna frenzy timer is active, decrement `swipeCooldown` with `dt * 2` instead of `dt` (or halve the reset cooldown). Damage stacks with duplicate cards; attack speed stays 2×. Add a one-line comment explaining that.

**Step 6: Dev-only test hook.** Add `private devEdges: EdgeId[] = [];` to `Game`. In `Game.start()` after `this.save.load()` and before the first-visit branch:

```ts
if (import.meta.env.DEV) {
  const edges = new URLSearchParams(location.search).get('edges');
  if (edges) this.devEdges = edges.split(',').filter(isEdgeId);
}
```

The `loadRoom` DEV block from Step 2 applies them after each run reset. This lets a tester open `?edges=heavy_hands,quick_feet` without editing localStorage. It is dead code in production builds. Do not write the save after the hook; a later natural save will persist it, which is fine for testing.

**Step 7: Manual matrix.** Start `npm run dev`, clear the save, and verify:

1. With `?edges=heavy_hands`, a thrown object hurts more than the same throw without it.
2. With `?edges=quick_feet`, movement and dash are visibly faster.
3. With `?edges=second_wind`, every room starts with one armour pip.
4. With `?edges=fine_print`, a fatal hit leaves 1 HP once; a second fatal hit kills.
5. With `?edges=glass_cannon`, the first hit taken deals double; after a room reload, it is armed again.
6. With `?edges=cat_frenzy` and a cat, tuna makes the cat visibly faster and harder-hitting.
7. Kill a boss with `?edges=headline_act`; the first hit after entering the floor is 30% higher, later hits are normal.

**Step 8:** `npm run typecheck`, then commit the five modified source files with only your hunks: `feat: apply Edge modifiers to combat`.

> If `Game.ts`, `Enemy.ts`, or `Player.ts` still contain uncommitted user changes you cannot separate, stop and ask the user before committing.

---

## Phase 2 — Incident: heat and Headliners

### Task 5 — Pure heat model

**Files:** `src/gameplay/Heat.ts`, `src/gameplay/Heat.test.ts`

**Interface:**

```ts
export type HeatEvent =
  | { kind: 'tier'; tier: 1 | 2 }
  | { kind: 'release' }
  | { kind: 'surge' };

export interface HeatRoomView {
  elapsed: number;
  pending: ReadonlyArray<{ incident?: unknown }>;
  incidentSpec: unknown | null;
  survive: number | null;
}
export interface HeatEnemyView {
  defeated: boolean;
  incident: 'headliner' | 'enforcer' | null;
}

export class HeatSystem {
  heat: number;
  tier: 0 | 1 | 2;
  active: boolean;
  released: boolean;
  reset(room: HeatRoomView): void;
  add(amount: number): void;
  update(dt: number, room: HeatRoomView, enemies: readonly HeatEnemyView[], emit: (event: HeatEvent) => void): void;
}
```

Constants exported for tuning: `TIER_1 = 34`, `TIER_2 = 67`, `MAX_HEAT = 100`, `PASSIVE = 0.6`, `LATE = 5` after 90s, `EMPTY = 20` when no regulars are pending or alive.

`reset(room)` sets heat 0, tier 0, `active = room.incidentSpec !== null || room.survive !== null`, `released = false`. `update` does nothing if inactive or released. Rate = passive + late (if `elapsed > 90`) + empty (if no non-incident pending and no non-incident alive). Add `rate * dt`, clamp to 100. Emit tier 1/2 once when crossing. At 100 set `released = true` and emit `release` if `incidentSpec` is non-null, otherwise `surge`. Never emit the same tier twice.

Tests, exact:

- `tutorial room is cold` (null incident, null survive; 120s; heat 0).
- `crosses tier 1 and tier 2 at 34 and 67`; `add(34)` + `update(0)` emits tier 1; `add(33)` emits tier 2.
- `releases the incident at 100`.
- `surges instead of releasing in a survival room`.
- `accelerates when no regulars remain`.
- `accelerates after 90 seconds`.
- `does not release twice`.

Run `npx vitest run src/gameplay/Heat.test.ts`, implement, typecheck, commit: `feat: add heat meter model`.

---

### Task 6 — Incidents, heat wiring, and the arrival card

**Files:** `src/gameplay/Incidents.ts`, `src/gameplay/Incidents.test.ts`, `src/gameplay/RoomManager.ts`, `src/gameplay/Room.ts` (only if a type needs exporting), `src/core/Game.ts`, `src/entities/Enemy.ts`, `src/ui/HUD.ts`, `src/ui/UI.ts`, `src/styles.css`, `src/analytics/AnalyticsManager.ts`

**Step 1: Define incidents.** `Incidents.ts`:

```ts
export interface IncidentSpec {
  kind: 'headliner' | 'enforcer';
  name: string;
  line: string;
  baseType: EnemyTypeId;
  hpScale: number;
  speedScale: number;
}
export interface PendingEnemy {
  type: EnemyTypeId;
  delay: number;
  incident?: IncidentSpec;
}
export const INCIDENT_WALK_LEAD = 4.7;
export const INCIDENT_RELEASE_LEAD = 5.2;
export const ENFORCER_NAMES = [...];
```

`headlinerSpec(type: EnemyTypeId): IncidentSpec` reads `ENEMY_TYPES[type]`, uses `bossBanner ?? name.toUpperCase()`, a line from the existing boss data (or a short fallback), `baseType = type`, scales 1.
`enforcerSpec(index: number): IncidentSpec` cycles a six-entry roster:
`THE FOREMAN` (heavy), `THE BAILIFF` (shield), `THE INSPECTOR` (hurler), `THE NIGHT SHIFT` (fast), `THE CONTRACTOR` (bulwark), `THE COLLECTOR` (helmet).
`hpScale = min(3, 2.2 + max(0, index - 7) * 0.05)`, `speedScale = 1.15`.

`releaseIncident(room: { elapsed: number; pending: PendingEnemy[]; bossReleased: boolean }): boolean` finds the first pending incident, sets its delay to `elapsed + INCIDENT_RELEASE_LEAD`, sets `bossReleased = true`, sorts `pending` by delay, returns true. Do not set delay to 0: the `RoomManager` uses the remaining delay to play the boss-walk sample and door knock before the spawn.

`rushRegulars(room, lead = 2)`: for every pending spec without `incident`, set `delay = min(delay, elapsed + lead)`; sort. Leave the incident alone.

Tests:

- `headlinerSpec returns the boss name and banner`.
- `enforcerSpec(0) is the Foreman at 2.2 HP`; `enforcerSpec(7) is 2.2`; `enforcerSpec(20)` caps at 3.0.
- `releaseIncident sets a walk-in delay and marks the room`.
- `rushRegulars moves only regulars`.
- `releaseIncident returns false when there is no incident`.

**Step 2: Room runtime.** In `RoomManager.ts`:
- `RoomRuntime` adds `incidentSpec: IncidentSpec | null`, `incidentEnemy: Enemy | null`, `bossReleased: boolean`, `heatEnabled: boolean`, and `hasEnforcer: boolean`. Keep `hasBoss`/`bossType` but set them from the incident: `hasBoss = incident?.kind === 'headliner'`, `hasEnforcer = incident?.kind === 'enforcer'`, `bossType = incident?.baseType ?? null`.
- `build` accepts `(game, def, index, daily, incident: IncidentSpec | null)`. Map `def.enemies` to `PendingEnemy` with no incident. Add the incident as one extra pending spec with `delay: Number.POSITIVE_INFINITY`. Sort. `totalEnemies++` if an incident exists. Set `incidentSpec`, `bossReleased = false`, `heatEnabled = incident !== null || Boolean(def.objective && def.objective.kind === 'survive')`.
- `updateSpawns` must treat a pending incident like any other enemy: boss-walk lead uses `next.delay - elapsed < INCIDENT_WALK_LEAD` (import the constant; remove the local duplicate). For a Headliner, keep the boss roar. For an Enforcer, play a shorter roar with the base type and the `bossRoar` API; do not use the boss title banner.
- On spawn, set `enemy.incident = spec.incident.kind` (add the field to `Enemy`), `room.incidentEnemy = enemy`, and call `game.hud.incoming(spec.incident.kind.toUpperCase(), spec.incident.name, spec.incident.line, spec.type)`. For a Headliner, set the name to the boss name. For an Enforcer, construct a scaled `EnemyType` copy:
  ```ts
  const base = ENEMY_TYPES[spec.type];
  const scaled = {
    ...base,
    name: spec.incident.name,
    hp: Math.round(base.hp * spec.incident.hpScale),
    speed: base.speed * spec.incident.speedScale,
  };
  ```
  Spawn with `game.spawnEnemyType(scaled, ...)`. Do not set `boss: true`. Skip the extra Depths regular scaling for incident specs (`!spec.incident`) because the Enforcer already carries its depth scale.
- Existing generic boss scheduling is replaced by the incident; keep `bossSpecFor` exported for `MainMenu`/tutorial compatibility, but `Game.enterRoom` no longer appends a boss on its own.

**Step 3: Enemy tag.** `Enemy` adds `incident: 'headliner' | 'enforcer' | null = null`. No behavior change beyond the tag; damage scaling and HUD use it.

**Step 4: Game wiring.** Add `readonly heat = new HeatSystem()` (or assign in constructor) and:
- `Game.spawnEnemy` delegates to a new `spawnEnemyType(type: EnemyType, x, y, dirX = -1, dirY = 0): Enemy`, which constructs and pushes. This is needed for the scaled Enforcer copy.
- Add a private `incidentFor(def: RoomDefinition, index: number, daily: boolean): IncidentSpec | null`:
  - daily: `def.objective?.kind === 'survive' ? null : enforcerSpec(0)`;
  - handcrafted (`index < rooms.handcraftedCount`): `def.boss ? headlinerSpec(def.boss) : null` (room 1 is tutorial and has no boss);
  - Depths: `def.boss ? headlinerSpec(def.boss) : (def.objective?.kind === 'survive' ? null : enforcerSpec(index))`.
- Change `loadRoom` to `loadRoom(def, index, daily, incident: IncidentSpec | null = null)` and pass `incident` to `this.rooms.build(this, def, index, daily, incident)`. `toMenu` and the `start()` backdrop call it with the default null.
- `Game.enterRoom` computes `const incident = this.incidentFor(def, index, daily);` **before** `loadRoom`, then calls `this.loadRoom(def, index, daily, incident)`. Remove the old `bossSpecFor` boss append. `restartRoom`/`nextRoom`/`playDaily` all go through `enterRoom`, so they recompute the incident. After building: `this.heat.reset(this.room); this.tutorialSkippedThisRoom = false;` (the latter is Task 9, but add the field now if convenient).
- `Game.wireHeat()` must be called from the constructor right after `this.wireFunnel()`; otherwise the bus never feeds the meter.
- `Game.tick` calls `this.heat.update(dt, this.room, this.enemies, (event) => this.onHeatEvent(event))` when `state === 'playing'`, after `rooms.updateSpawns` and before `updateRoomOutcome`.
- `Game.wireHeat()` subscribes to the bus:
  - `ENEMY_DEFEATED`: `heat.add(cause.type === 'hazard' || cause.type === 'fire' ? 12 : 7)`.
  - `PLAYER_HIT`: `heat.add(5)`.
  - `CHAIN`: `heat.add(10)`.
  - `OBJECT_BROKEN`: `heat.add(2)`.
  - `OBJECT_HIT` with `impulse >= 1400`: add 0.5, capped at 4 per second by a `objectHeatWindow` + timer. Reset the window every second in `tick`.
- `Game.onHeatEvent(event)`:
  - tier 1: `rooms.rushRegulars(this.room)`; `hud.banner('THEY NOTICED', 'the door is getting louder', 2)`; `analytics.track('heat_tier', { tier: 1, room: ... })`.
  - tier 2: `this.incidentSurge(false)`; `hud.banner('THE ROOM IS LOSING IT', 'watch the floor', 2)`; analytics.
  - release: `rooms.releaseIncident(this.room)`; if it returns false, `this.incidentSurge(true)`.
  - surge: `this.incidentSurge(true)`.
- `Game.incidentSurge(final: boolean)` spawns 1 (or 2 if final) fire zones at random floor points, with a ring, embers, a low explosion, and camera shake. Use `this.zones.spawn(this, 'fire', x, y, final ? 40 : 30, { ttl: final ? 6 : 4.5 })` (verify the exact `ZoneManager.spawn` signature). Do not damage the player directly; the zone does the work.
- `Game.completeRoom` and `summarize` later must use `room.hasBoss` (Headliner) for the 100-scrap bonus, `bossesBeaten`, and boss analytics; `room.hasEnforcer` for `enforcersBeaten`.

**Step 5: `GameUi` arrival card.** Add to `GameUi`:

```ts
incoming(kicker: string, title: string, sub: string, type: EnemyTypeId): void;
```

`NULL_UI` gets a no-op. `UI` implements `incoming` and delegates to the HUD. The HUD method (Task 7) builds the DOM; this task may add a minimal version and Task 7 polish it.

**Step 6: Tests + manual.**

- `npx vitest run src/gameplay/Incidents.test.ts` green.
- `npm run typecheck` green.
- Start a room 2 run. Ordinary enemies die; the heat bar is not visible yet, but the boss must walk in after the heat reaches 100. Use a temporary console/analytics check or wait for Task 7 to see the bar. Confirm the boss does not spawn in room 1.
- Kill the boss; the room clears.
- Die before the boss: the room does not clear with a pending incident.

Commit in two parts:
1. `feat: add incident specs and room release`
2. `feat: wire heat to boss releases`

### Task 7 — HUD: heat meter, boss bar, Enforcer crown, arrival card

**Files:** `src/ui/HUD.ts`, `src/ui/UI.ts`, `src/rendering/EnemyArt.ts`, `src/styles.css`

**Step 1: Heat meter.** Add a `heatBox` to the HUD, positioned under the room tag, and an `updateHeat(game)` called from `HUD.frame` while the HUD is visible:

- Hide unless `game.heat.active && game.state === 'playing'` (also allow `failed`/`cleared` if the bar is still animating; hide on menu).
- Label `HEAT`, percentage `Math.floor(game.heat.heat)`, name from `game.room.incidentSpec?.name ?? 'FINAL SURGE'`.
- `.heat-track > .heat-fill` width = clamped heat; tier class on the box: `tier-0`, `tier-1`, `tier-2`, `released`.
- Tier copy: `QUIET`, `THEY NOTICED`, `THE ROOM IS LOSING IT`, `INBOUND`.
- Cache the last heat/tier/name so DOM writes happen only when changed.
- `HUD.reset()` clears/hides it.

**Step 2: Boss bar.** Add `bossBox` and `updateBoss(game)`:

- Source: `game.room.incidentEnemy`. Hide if null, defeated, or `game.state !== 'playing'`.
- Name from `boss.type.name` (this is the custom Enforcer name or Headliner name). A small `HEADLINER`/`ENFORCER` tag from `boss.incident`.
- Fill = `clamp(boss.hp / boss.type.hp, 0, 1) * 100%`.
- Phase pips only for Headliners with `boss.type.phases`: build once per boss type, mark `lit` from `boss.phaseIndex`, and set `data-kind` for colour.
- Cache `uid:hp:phase` to avoid per-frame DOM writes.

**Step 3: Arrival card.** Implement `HUD.incoming(kicker, title, sub, type)`:

- If `ANNOUNCEMENTS_VISIBLE` is false, return (match existing announcement behavior).
- Build a torn card with a mugshot: `mug mug-${type}` using `ENEMY_TYPES[type].color`, the kicker (`HEADLINER`/`ENFORCER`), a `ransom()` title, and the line in italics.
- Add `.show`; clear any existing `incomingTimer`; set 2.4s. `HUD.frame` decrements and removes `.show`.
- `HUD.reset()` removes `.show` and clears the timer.
- The card must not block pointer events (`pointer-events: none`).

**Step 4: Lineup identity.** Change `Mug` to carry `incident: 'headliner' | 'enforcer' | null` and a `title`. `buildLineup` sets it from `spec.incident`; append the incident spec last. `crossOut` accepts the `Enemy` (not just type id) and matches both `type.id` and `incident`, so a regular `heavy` cannot cross out the Foreman mug. Add `mug boss`/`mug enforcer` classes and a small crown glyph for Enforcers.

**Step 5: EnemyArt crown.** In the enemy draw path (after the body and before the overhead UI), if `enemy.incident === 'enforcer'`, draw a small three-point gold crown above the head, with a 1px dark outline and a subtle bob using the existing enemy animation time. Keep it cheap: no new canvas, no image. The crown must scale with the enemy radius and sit above the health/telegraph, not under it.

**Step 6: CSS.** Add a new section near the existing `.lineup` rules:

- `.hud-heat` centered under `.hud-top`, small uppercase label, 140px track, fill with a hot gradient; `.tier-1` amber, `.tier-2` orange/red, `.released` pulsing red.
- `.hud-boss` top-center, z-index below the arrival card, name in the ransom display, track with pips; Headliner red, Enforcer amber.
- `.hud-incoming` center-screen, torn paper, ink border, stamp rotation, 0.25s pop; kicker, name, sub.
- `.mug.boss`, `.mug.enforcer`, `.mug-crown`.
- Respect `prefers-reduced-motion`: reduce the pop/pulse to opacity changes. Keep high-contrast overrides.

**Step 7: Manual.** With `?edges=` off:

- Room 1: no heat bar, no boss bar, no arrival.
- Room 2: heat moves; tier labels at 34/67; at 100 the Headliner walks in, the INCOMING card appears, the boss bar fills.
- A non-boss Depths room: an Enforcer card/bar/crown; kill it and confirm no boss-defeat presentation.
- A survival room: heat bar, no boss bar, final surge at 100.
- On fail, heat/boss bars hide; on results/menu, they are gone.
- Mobile 390×844: heat and boss bars do not overlap the health/lineup; Edge cards (later) stack.

Run `npm run typecheck`, then commit: `feat: add heat and boss HUD`.

---

## Phase 3 — Run loop: Edges, persistence, Ledger, daily

### Task 8 — Pure run model

**Files:** `src/gameplay/Run.ts`, `src/gameplay/Run.test.ts`

**Interface and rules:**

```ts
export interface RunState {
  runActive: boolean;
  runFloor: number;
  runStreak: number;
  runBoosts: string[];
  runScore: number;
  runInsuranceUsed: boolean;
}

export function startRun(save: RunState, index: number): void;
export function recordClear(save: RunState, index: number, score: number): void;
export function recordFail(save: RunState, index: number, scoreAtStart: number, handcraftedCount: number): { ended: boolean };
export function chooseEdge(save: RunState, id: EdgeId): void;
export function endRun(save: RunState): void;
export function sanitizeRun(save: RunState, unlockedRoom: number, deepest: number, maxFloor?: number): void;
```

- `startRun`: `runActive = true`, `runFloor = max(0, floor(index))`, `runStreak = 0`, `runBoosts = []`, `runScore = 0`, `runInsuranceUsed = false`.
- `recordClear`: `runActive = true`, `runFloor = index + 1`, `runStreak += 1`, `runScore = max(0, score)`.
- `recordFail`: `runStreak = 0`, `runScore = max(0, scoreAtStart)`, `ended = index >= handcraftedCount`. It does **not** clear `runActive` or `runBoosts`. The caller decides whether to call `endRun` after the ad/retry decision.
- `chooseEdge`: `runBoosts.push(id)`; duplicates are legal.
- `endRun`: `runActive = false`, `runBoosts = []`, `runScore = 0`, `runStreak = 0`, `runInsuranceUsed = false`.
- `sanitizeRun`: filter `runBoosts` with `isEdgeId` (preserve duplicates), clamp `runFloor`/`runStreak`/`runScore` to finite non-negative integers, and set `runActive = false` if `runFloor > Math.max(maxFloor ?? 0, unlockedRoom, deepest + 1)`. The optional `maxFloor` exists for the 27★ Master Key start at floor 19; without it, a legitimate Master Key run would be rejected on reload. Do not reset `runFloor` unless invalid. This is the clamp correction described above.

Tests, exact:

- `startRun resets the run and keeps Edges out`.
- `clearing room 1 advances the floor and streak and stores the score`.
- `recordFail keeps the run and Edges for a campaign room` (`ended: false`).
- `recordFail marks a Depths room as ended but does not clear state`.
- `chooseEdge allows duplicates`.
- `endRun clears everything`.
- `sanitizeRun drops unknown Edges but keeps duplicate known ones`.
- `sanitizeRun accepts the first Depths floor` (`unlockedRoom 9`, `deepest 9`, `runFloor 9`).
- `sanitizeRun accepts a failed Room 10 floor` (`deepest 9`, `runFloor 10`).
- `sanitizeRun accepts a Master Key floor 19` (`unlockedRoom 9`, `deepest 9`, `runFloor 18`, `maxFloor 18`).
- `sanitizeRun rejects a jump past the next floor`.

Run `npx vitest run src/gameplay/Run.test.ts`, implement, typecheck, commit: `feat: add run progression model`.

### Task 9 — Run lifecycle in `Game` (clear, fail, continue, retry, daily isolation)

**Files:** `src/core/Game.ts`, `src/gameplay/Tutorial.ts`, `src/gameplay/Run.ts` (imports only)

Read the current `Game.ts` diff before editing. Apply these changes around the existing methods; do not reorder unrelated code.

**Step 1: Summary fields.** Extend `RoomSummary`:

```ts
runStreak: number;
runFloor: number;
runEnded: boolean;
edgeOffer: EdgeDefinition[];
```

Import `type EdgeDefinition` from `../gameplay/Edges`. Add private `pendingEdgeOffer: EdgeDefinition[] = []` and public `tutorialSkippedThisRoom = false` to `Game`.

**Step 2: Start / select / continue.**

- In `start()`, after `this.save.load()`:

```ts
sanitizeRun(this.save.data, this.save.data.unlockedRoom, this.save.data.deepest);
```

Then the dev hook from Task 4. Do **not** auto-continue an active run; the menu will offer CONTINUE in Task 13. The first-visit branch is unchanged.

- `playFrom(index)`:

```ts
startRun(this.save.data, index);
this.pendingEdgeOffer = [];
this.tutorialSkippedThisRoom = false;
this.scoreAtRoomStart = 0;
this.consecutiveFailures = 0;
this.save.write();
this.enterRoom(this.rooms.definition(index), index, false);
```

This is the only method that clears Edges. `playLesson` still calls `playFrom(0)`, which starts a fresh run. That reset must be explicit: in `PauseMenu`, when `save.runActive`, label the lesson action `REPLAY LESSON · ends this run` (or hide it if the player is past room 1). Do not let a practice replay silently erase Edges.

- `continueRun()`:

```ts
const save = this.save.data;
if (!save.runActive) return;
this.scoreAtRoomStart = save.runScore;
this.pendingEdgeOffer = [];
this.consecutiveFailures = 0;
this.enterRoom(this.rooms.definition(save.runFloor), save.runFloor, false);
```

- `playSelected(index)`:

```ts
playSelected(index: number): void {
  const save = this.save.data;
  if (save.runActive && index === save.runFloor) this.continueRun();
  else this.playFrom(index);
}
```

- `descend()`:

```ts
descend(): void {
  this.playFrom(descendStart(this.save.data, this.save.data.deepest));
}
```

`descendStart` arrives in Task 11; until then use `Math.max(this.rooms.handcraftedCount, this.save.data.deepest)` (0-based first Depths floor) and replace it in Task 11.

- `playDaily()`: set `scoreAtRoomStart = 0`, `pendingEdgeOffer = []`, `tutorialSkippedThisRoom = false`, `consecutiveFailures = 0`, then `enterRoom(dailyChallenge(new Date()).room, 0, true)`. Do not call `startRun`, do not touch `runBoosts`/`runFloor`/`runScore`/`runStreak`, do not call `edges.setActive` directly (loadRoom does it with `daily`).

**Step 3: `enterRoom`.** Keep the incident build from Task 6. Remove the old boss append block (lines 380–390). After `loadRoom`, call `this.heat.reset(this.room)`. Reset `tutorialSkippedThisRoom = false`. Do not modify run save fields here.

**Step 4: Room 1 skip flag.** In `Tutorial.skip()` after the early return:

```ts
this.game.markTutorialSkipped();
```

Add to `Game`:

```ts
markTutorialSkipped(): void {
  this.save.data.tutorialSkipped = true;
  this.tutorialSkippedThisRoom = true;
  this.save.write();
}
```

The save flag is historical. The star uses `tutorialSkippedThisRoom`, which `loadRoom` resets, so a replay without SKIP can recover the third star.

**Step 5: Rewrite `summarize`.**

Keep the existing score/highscore/bestChain/scrap lines. Then:

```ts
const isHandcrafted = !this.room.daily && this.room.index < this.rooms.handcraftedCount;
```

For a cleared non-daily room:

- Capture `const wasUnlocked = save.unlockedRoom; const wasDeepest = save.deepest;` **before** any updates. Use these for `firstClear` and `next.isNew`.
- `recordClear(save, this.room.index, this.score.score)`.
- `save.roomsCleared++`; add `totalKills`, `totalChains`, `totalHazardKills`.
- `if (this.room.hasBoss) save.bossesBeaten++;`
- `if (this.room.hasEnforcer) save.enforcersBeaten++;`
- `const firstClear = isHandcrafted ? wasUnlocked <= this.room.index : wasDeepest <= this.room.index;`
- Compute `challengePassed` and `challengeText` before stars:
  - room 1 (`isHandcrafted && index === 0`): text `finish the lesson plan`, passed `!this.tutorialSkippedThisRoom`;
  - otherwise `challengeText = challenge?.text ?? null`, passed `challengeBonus > 0`.
- `const { stars } = starsFor(this.score.stats, challengePassed);`
- `prevStars = isHandcrafted ? save.roomStars[def.id] ?? 0 : 0`; `isNewBestStars = cleared && isHandcrafted && stars > prevStars`.
- Write `save.roomStars[def.id]` only if `isHandcrafted` and (`isNewBestStars` or undefined with stars > 0).
- First-clear scrap: if `firstClear` and !daily, `firstClearBonus = this.room.hasBoss ? 100 : 40; save.scrap += firstClearBonus;`.
- `if (isHandcrafted) save.unlockedRoom = Math.max(save.unlockedRoom, this.room.index + 1);`
- `save.deepest = Math.max(save.deepest, this.room.index + 1);`
- Update `save.roomBests[id]` for every non-daily clear (including Depths).
- Generate the Edge offer only for non-daily clears:
  ```ts
  this.pendingEdgeOffer = offerEdges(this.rng, save.dailyRareEdge);
  ```
  Do not consume `dailyRareEdge` here.
- `runStreak = save.runStreak`, `runFloor = save.runFloor`, `runEnded = false`.

For a failed non-daily room:

- `const failed = recordFail(save, this.room.index, this.scoreAtRoomStart, this.rooms.handcraftedCount);`
- `this.pendingEdgeOffer = [];`
- `runEnded = failed.ended`; do **not** call `endRun` here. The ad/retry decision comes later.
- `edgeOffer = []`.

For a daily clear:

- Keep the existing daily streak/scrap block for now (Task 12 replaces it with `Daily.ts`).
- `this.pendingEdgeOffer = []`; `runEnded = false`; no run fields; no stars; no `unlockedRoom`/`deepest`; no `bossesBeaten`.
- `runStreak`/`runFloor` are the active run's values, untouched.

For a daily fail: no run changes; `runEnded = false`; `edgeOffer = []`.

`next` only for `cleared && !daily`. Build it with the existing `briefingFor`, and use:
```ts
mover: def.boss
  ?? (index >= this.rooms.handcraftedCount && def.objective?.kind !== 'survive'
      ? enforcerSpec(index).baseType
      : def.enemies[def.enemies.length - 1]?.type ?? 'basic')
```
`isNew = isHandcrafted ? wasUnlocked < index : wasDeepest <= index` (the pre-clear values; otherwise the current clear would always make the next room look old).

Return the new fields:
```ts
runStreak: save.runStreak,
runFloor: save.runFloor,
runEnded,
edgeOffer: this.pendingEdgeOffer,
```

`save.write()` stays at the end, after all star/ledger/daily changes. The `challengeText`/`challengePassed` fields use the computed values.

**Step 6: Edge pick.** Add:

```ts
chooseEdge(id: EdgeId): boolean {
  if (!this.pendingEdgeOffer.some((edge) => edge.id === id)) return false;
  chooseEdge(this.save.data, id);
  this.save.data.dailyRareEdge = false;
  this.pendingEdgeOffer = [];
  this.save.write();
  return true;
}
```

This consumes the day-7 rare flag only when the player actually picks a card. It does not advance the floor.

**Step 7: `nextRoom` / replay / retry / abandon.**

- `nextRoom`:
  - Keep the ad.
  - If `this.room.daily` -> `toMenu()`.
  - `this.scoreAtRoomStart = this.score.score;`
  - `const next = this.save.data.runFloor;` (not `room.index + 1`).
  - `this.pendingEdgeOffer = [];`
  - `this.enterRoom(this.rooms.definition(next), next, false);`
- `replayRoom()`: `this.playFrom(this.room.index);` (new run at the cleared floor, Edges cleared).
- `retryAfterFail()`:
  ```ts
  if (this.waitingForAd) return;
  await this.ads.onRetryAfterFailure();
  if (this.room.daily) { this.restartRoom(); return; }
  if (this.room.index >= this.rooms.handcraftedCount) {
    const index = this.room.index;
    endRun(this.save.data);
    this.save.write();
    this.playFrom(index);
    return;
  }
  this.restartRoom();
  ```
- `abandonRun()`:
  ```ts
  if (this.save.data.runActive) {
    endRun(this.save.data);
    this.save.write();
  }
  this.toMenu();
  ```
  Use this from the results HOME action when `summary.runEnded` is true (Task 10).
- `toMenu()` unchanged except it must not call `endRun`. It keeps the active run.
- `continueWithReward()` unchanged in behavior. On a Depths fail it leaves `runActive` and `runBoosts` intact, so the revived run continues. Do not call `endRun` before the ad.

**Step 8: Manual control test (console allowed).**

1. Clear room 1. In the console, read the save: `runActive true`, `runFloor 1`, `runStreak 1`, `edgeOffer` length 3. The results screen still ignores the offer at this point.
2. Press NEXT: room 2 starts from `runFloor`, not a hardcoded index.
3. Fail room 2: `runActive true`, `runBoosts` unchanged, `runStreak 0`, `runEnded false`; RETRY restarts room 2.
4. Fail a Depths room: `runEnded true`, but `runActive`/`runBoosts` still intact on the fail screen. Rewarded CONTINUE keeps them; RETRY starts a new run with empty Edges; HOME ends the run.
5. Start a run, choose an Edge via console (`game.chooseEdge('heavy_hands')` after a clear), then `game.playDaily()`: `runBoosts`/`runFloor`/`runScore` unchanged during and after the daily.
6. Skip room 1 once, clear it, then replay room 1 without SKIP and confirm the third star can be earned.

`npm run typecheck` + `npx vitest run src/gameplay/Run.test.ts`; commit: `feat: persist runs and resolve Edge offers`.

### Task 10 — Results screen: Edge choice, run strip, ended-run messaging

**Files:** `src/ui/ResultsScreen.ts`, `src/ui/UI.ts`, `src/styles.css`

**Step 1: Actions.** Add to `ResultsActions`:

```ts
pickEdge(id: EdgeId): void;
```

Import `type EdgeId` from `../gameplay/Edges`.

**Step 2: Victory card.**

- Near the room tag, show the run progress when not daily:
  `RUN · FLOOR ${summary.runFloor + 1} · STREAK ${summary.runStreak}`. Use a small `.victory-run` line; hide when `runStreak === 0 && runFloor === 0`. `runFloor` is 0-based in save data; the UI is 1-based.
- Keep the existing challenge stat ticket only when `summary.challengeBonus > 0`. Room 1's lesson star sets `challengePassed` but has no points bonus, so it must not render a `+0` ticket; the star row already shows it.
- After the tickets and power offer, before the next-door teaser, add the Edge choice when `summary.edgeOffer.length > 0`:
  - heading `CHOOSE ONE · IT STACKS FOR THE RUN`;
  - a `.edge-cards` container with one button per card;
  - each button has `edge-card edge-${category} edge-${rarity}`, a category kicker (`HEAVY`/`SLICK`/`GREED`), a rarity tag, the name, the effect, and the flavor;
  - on click: set `disabled = true`; call `actions.pickEdge(edge.id)`.
- When `summary.edgeOffer.length > 0`, **do not** append the NEXT button. The Edge card is the next action. Keep `↻ REPLAY` and `⌂ HOME`.
- Daily: keep the `DONE` button. No Edge cards.
- If the player has no offer (e.g., legacy/failed), keep the old NEXT behavior.
- Add `summary.ledgerClaims` display in Task 11; leave a comment where it will go.

**Step 3: Fail card.**

- The fail sheet currently has `EVICTED`; keep it.
- Add a line under the fields:
  - `summary.runEnded` → `RUN ENDED · EDGES LOST` (the rewarded CONTINUE remains the explicit exception; the line is still true if they leave).
  - else → `EDGES KEPT · RUN STREAK RESET`.
- Daily fail: no run line.
- The RETRY/HOME actions below decide whether the run actually ends.

**Step 4: `UI.ts` wiring.**

Extend the `buildResults` call:

```ts
pickEdge: (id) => {
  if (!game.chooseEdge(id)) return;
  void game.nextRoom();
},
```

Change `retry`:

```ts
retry: () => (summary.cleared
  ? (summary.daily ? game.restartRoom() : game.replayRoom())
  : void game.retryAfterFail()),
```

Daily REPLAY must reload the same daily room, not start a campaign room 1; `restartRoom` preserves `this.room.daily`.

Change `home`:

```ts
home: () => (summary.runEnded ? game.abandonRun() : game.toMenu()),
```

`show()` focus fallback:

```ts
screen.querySelector<HTMLButtonElement>('button.primary, button.edge-card')?.focus({ preventScroll: true });
```

**Step 5: CSS.** Add near `.victory-*`:

- `.victory-run` small stamped line.
- `.edge-cards` 3-column grid, stacks to 1 column under 760px.
- `.edge-card` torn-card button, text left-aligned, `min-height: 150px`, hover lift, focus ring.
- `.edge-heavy` rust/red, `.edge-slick` teal, `.edge-greed` gold.
- `.edge-rare`/`.edge-legendary` border/foil treatment; keep it readable in high-contrast.
- `.edge-kicker`, `.edge-rarity`, `.edge-name`, `.edge-effect`, `.edge-flavor`.
- `.run-ended`/`.edges-kept` sheet line.

**Step 6: Manual.**

1. Clear room 1 with no SKIP. Results shows 3 Edge cards; NEXT is gone. Click HEAVY HANDS: the ad (if any) plays, room 2 starts, and the save has `runBoosts: ['heavy_hands']`.
2. Clear room 2, pick a duplicate HEAVY HANDS. It stacks (test the multiplier in Task 4).
3. Press REPLAY on a victory: a new run starts at that room with empty Edges.
4. Fail campaign room 2: `EDGES KEPT`, RETRY keeps the Edge and restarts room 2.
5. Fail Depths: `RUN ENDED`; rewarded CONTINUE keeps the Edge; RETRY starts a new run with no Edges; HOME ends the run.
6. Daily clear: DONE, no Edge cards; the campaign run is untouched.

`npm run typecheck`; commit: `feat: offer Edge cards on results`.

---

### Task 11 — Star Ledger

**Files:** `src/gameplay/StarLedger.ts`, `src/gameplay/StarLedger.test.ts`, `src/core/Game.ts`, `src/gameplay/ScoreSystem.ts`, `src/gameplay/Abilities.ts`, `src/ui/HUD.ts`, `src/ui/ResultsScreen.ts`, `src/ui/PauseMenu.ts`

**Step 1: Data.** Use a 9-entry table:

| threshold | id | name | reward |
|---|---|---|---|
| 3 | `scrap_3` | SCRAP STIPEND | +100 scrap |
| 6 | `score_6` | CROWD FAVOURITE | +15% score |
| 9 | `edge_9` | HEAD START | start each run with a common Edge |
| 12 | `scrap_12` | SCRAP STIPEND II | +150 scrap |
| 15 | `scrap_15` | SALVAGE RIGHTS | +20% scrap |
| 18 | `edge_18` | HEAD START II | start each run with a rare Edge |
| 21 | `scrap_21` | SCRAP STIPEND III | +200 scrap |
| 24 | `cooldown_24` | QUICK HANDS | -15% ability cooldowns |
| 27 | `master_key` | MASTER KEY | DESCEND begins at Depths depth 10 (floor 19) |

**Step 2: Interface.** Import `totalStars` from `./Campaign` (the existing function) rather than exporting a second one; `MainMenu` already imports that name.

```ts
export interface LedgerState {
  roomStars: Record<string, number>;
  starRewardsClaimed: string[];
  scrap: number;
}
export interface LedgerMilestone {
  id: string;
  stars: number;
  name: string;
  reward: string;
  scrap: number;
}
export const LEDGER: readonly LedgerMilestone[];
export function ledgerClaimed(state: LedgerState, id: string): boolean;
export function ledgerBonus(state: LedgerState, id: string): boolean;
export function pendingLedger(state: LedgerState): LedgerMilestone[];
export function claimLedger(state: LedgerState): LedgerMilestone[];
export function ledgerScoreMultiplier(state: LedgerState): number;
export function ledgerScrapMultiplier(state: LedgerState): number;
export function ledgerCooldownMultiplier(state: LedgerState): number;
export function startingEdgeRarity(state: LedgerState): EdgeRarity | null;
export function descendStart(state: LedgerState, deepest: number): number;
```

Rules:

- `totalStars` sums **best** stars per room; `roomStars` is a map, so sum values, clamp each 0–3.
- `pendingLedger` returns milestones not in `starRewardsClaimed` with `totalStars >= threshold`, ascending.
- `claimLedger` pushes each id, adds its `scrap` to `state.scrap`, returns claims. Scrap milestones pay once. `SCRAP STIPEND II/III` replace, not stack with, the previous? They **stack** as separate one-time claims; +100/+150/+200 all eventually pay.
- `ledgerBonus` returns true only if claimed.
- `ledgerScoreMultiplier`: 1.15 if `score_6`, else 1.
- `ledgerScrapMultiplier`: 1.20 if `scrap_15`, else 1.
- `ledgerCooldownMultiplier`: 0.85 if `cooldown_24`, else 1.
- `startingEdgeRarity`: `edge_18` → `'rare'`; else `edge_9` → `'common'`; else null. Rare wins.
- `descendStart`: `const base = Math.max(9, deepest); return ledgerBonus(state, 'master_key') ? Math.max(18, base) : base;` This is 0-based. 9 displays floor 10; 18 displays floor 19.

Tests:

- `claims the 3-star stipend once` (scrap +100, second claim empty).
- `does not claim before the threshold`.
- `claims all crossed milestones in order`.
- `score, scrap, cooldown multipliers only with their badges`.
- `starting Edge is common at 9 and rare at 18`.
- `descendStart uses first Depths floor` (deepest 9 → 9) and `Master Key starts at floor 19` (deepest 9 → 18).
- `Master Key does not move an existing deeper run backward` (deepest 20 → 20).

**Step 3: Integrate.**

- `Game.summarize` computes `const ledgerClaims = cleared && !daily ? claimLedger(save) : [];` **after** `roomStars` updates and **before** `save.write()`. Add `ledgerClaims: LedgerMilestone[]` to `RoomSummary` and return the local.
- `Game.playFrom` after `startRun` and **before** the `this.save.write()` added in Task 9:

```ts
const rarity = startingEdgeRarity(this.save.data);
if (rarity) this.save.data.runBoosts.push(startingEdge(this.rng, rarity).id);
```

This applies to a new campaign/Depths run, not daily. The EdgeSystem is active when the room loads; the write persists the starting card.
- `Game.descend` uses `descendStart(this.save.data, this.save.data.deepest)`.
- Update the `Game.start` validation call to pass the Master Key ceiling:
  ```ts
  const masterKey = ledgerBonus(this.save.data, 'master_key') ? 18 : 0;
  sanitizeRun(this.save.data, this.save.data.unlockedRoom, this.save.data.deepest,
    Math.max(this.save.data.unlockedRoom, this.save.data.deepest + 1, masterKey));
  ```
  This keeps a floor-19 Master Key run valid after a reload.
- `ScoreSystem.award` multiplies by `ledgerScoreMultiplier(this.game.save.data)`.
- `ScoreSystem.onEnemyDefeated` multiplies scrap by `ledgerScrapMultiplier`.
- `AbilitySystem.cooldownFor` / the cooldown setter uses `ledgerCooldownMultiplier`. Add a public method if needed; do not change the per-room reset behavior.
- `Game.summarize` `ledgerClaims` for the results screen. In `ResultsScreen`, after the tickets, add `.victory-ledger` lines: `★ LEDGER · <name> · <reward>`. If a claim awarded scrap, show it; the scrap is already in the purse.
- `PauseMenu` ability cooldown display should use the same multiplier; if it reads a raw constant, update it. Read the file before editing.
- `HUD` ability cooldown ring/timer should read the effective cooldown, not the base; update the one place that computes it.

**Step 4: Dev-only star hook.** In `Game.start` inside the DEV block, support `?stars=27`:

```ts
if (new URLSearchParams(location.search).get('stars') === '27') {
  for (const def of HANDCRAFTED_ROOMS) this.save.data.roomStars[def.id] = 3;
  this.save.data.unlockedRoom = this.rooms.handcraftedCount;
  this.save.data.deepest = Math.max(this.save.data.deepest, this.rooms.handcraftedCount);
  claimLedger(this.save.data); // DEV ONLY: make Master Key testable without a full 27-star run
}
```

Import `HANDCRAFTED_ROOMS` and `claimLedger`. This is for manual verification; it does not write the save.

**Step 5: Manual.**

- With `?stars=27`, open the menu (Task 13) or console: `claimLedger` should claim all nine and pay 100+150+200 scrap; `descendStart` is 18; a new run starts with a rare Edge.
- With `?stars=9`, a new run starts with a common Edge.
- Kill enemies with 6★/15★/24★ claimed and observe score/scrap/cooldown changes.
- Earn 3 stars naturally on room 1 and see the claim on the results screen.
- Confirm the Ledger never writes stars and the Depths never add stars.

`npx vitest run src/gameplay/StarLedger.test.ts` + `npm run typecheck`; commit: `feat: add star ledger rewards`.

### Task 12 — Daily streak rewards

**Files:** `src/gameplay/Daily.ts`, `src/gameplay/Daily.test.ts`, `src/core/Game.ts`, `src/ui/ResultsScreen.ts`

**Step 1: Data and interface.**

```ts
export interface DailyState {
  lastDaily: string;
  dailyStreak: number;
  dailyRareEdge: boolean;
  scrap: number;
}
export interface DailyReward {
  day: number;
  scrap: number;
  rareEdge: boolean;
  label: string;
}
export interface DailySettlement {
  alreadyDone: boolean;
  streak: number;
  reward: DailyReward;
  scrap: number;
  rareEdge: boolean;
}
export interface DailyStatus {
  doneToday: boolean;
  streak: number;
  nextStreak: number;
  next: DailyReward;
}

export function dailyReward(day: number): DailyReward;
export function settleDaily(state: DailyState, date?: Date): DailySettlement;
export function dailyStatus(state: DailyState, date?: Date): DailyStatus;
```

Seven-day table: `20, 30, 40, 50, 60, 75, 100` scrap; day 7 also `rareEdge: true`. `dailyReward` wraps day 8 → day 1. Use local calendar keys (`YYYY-MM-DD`) and yesterday arithmetic; do **not** use UTC keys.

`settleDaily`:

- if `state.lastDaily === today`: return `alreadyDone: true`, `scrap: 0`, `rareEdge: false`, current streak;
- else streak = `lastDaily === yesterday ? dailyStreak + 1 : 1`;
- set `state.dailyStreak = streak`, `state.lastDaily = today`;
- `const day = ((streak - 1) % 7) + 1; const reward = dailyReward(day);`
- `state.scrap += reward.scrap`; if `reward.rareEdge` set `state.dailyRareEdge = true`;
- return `{ alreadyDone:false, streak, reward, scrap: reward.scrap, rareEdge: reward.rareEdge }`.

`dailyStatus`:

- `doneToday = state.lastDaily === today`;
- `streak = state.dailyStreak`;
- `nextStreak = doneToday ? streak + 1 : state.lastDaily === yesterday ? streak + 1 : 1` (display for tomorrow/before playing);
- `next = dailyReward(((nextStreak - 1) % 7) + 1)`;
- return.

Tests:

- `day 8 wraps to day 1` and every day 1–7 has the expected scrap.
- `first ever daily starts a streak at 1`.
- `consecutive days increment`.
- `same day pays nothing twice`.
- `missing a day resets to 1`.
- `day 7 sets the rare Edge flag`.
- `day 8 pays day-1 scrap on a new day`.
- `settle adds scrap and status reflects done/next`.

**Step 2: Replace the daily block in `Game.summarize`.** Delete the old `todayKey`/`yesterdayKey` streak formula and call:

```ts
const settled = settleDaily(save);
dailyBonus = settled.scrap;
```

Keep `save.roomsCleared++` and lifetime kill/chain/hazard totals for a daily clear. Do not touch `runActive`, `runFloor`, `runStreak`, `runScore`, `runBoosts`, stars, `unlockedRoom`, or `deepest`.

`RoomSummary` adds:

```ts
dailyStreak: number;
dailyAlreadyDone: boolean;
dailyRareEdge: boolean;
```

Set from `save.dailyStreak`, `settled.alreadyDone`, `settled.rareEdge`. For non-daily, use `save.dailyStreak`, false, false. The `dailyRareEdge` summary field means "today's reward granted the rare flag", not the persistent flag (the persistent flag may be saved for a later offer).

**Step 3: Results feedback.** In `buildVictory` when daily:

- show `DAILY STREAK · N` near the objective;
- if `dailyAlreadyDone`, show `TODAY'S CONTRACT ALREADY PAID`;
- if `dailyRareEdge`, show `RARE EDGE UNLOCKED FOR THE NEXT OFFER`;
- keep the scrap line `+${dailyBonus}` only when > 0.

**Step 4: Menu status.** Exported `dailyStatus` is consumed in Task 13. Do not add UI here.

**Step 5: Manual.**

- Clear daily twice in one day (allow retry): the second pays 0 and says already paid.
- Use a dev-only date? Prefer unit tests for consecutive days. In the browser, verify the streak increments when `lastDaily` in localStorage is yesterday.
- Verify the campaign run is unchanged after a daily (Task 9 check).
- Day 7: set `lastDaily` to yesterday and `dailyStreak` to 6 in localStorage, clear daily, then clear a campaign room and confirm the Edge offer contains a rare.

`npx vitest run src/gameplay/Daily.test.ts` + `npm run typecheck`; commit: `feat: add daily contract streak rewards`.

---

## Phase 4 — Menu, telemetry, release

### Task 13 — Main menu: run strip, next card, daily, Ledger, Depths

**Files:** `src/ui/MainMenu.ts`, `src/ui/UI.ts`, `src/ui/PauseMenu.ts` (lesson label only), `src/styles.css`

**Step 1: Actions.** Extend `MenuActions`:

```ts
continueRun(): void;
daily(): void;
descend(): void;
```

Keep `play(index)`. In `UI.showMenu`:

```ts
continueRun: () => { this.hud.reset(); goFullscreenOnPhones(game); game.continueRun(); },
daily: () => { this.hud.reset(); goFullscreenOnPhones(game); game.playDaily(); },
descend: () => { this.hud.reset(); goFullscreenOnPhones(game); game.descend(); },
play: (index) => { this.hud.reset(); goFullscreenOnPhones(game); game.playSelected(index); },
```

**Step 2: Selection state.** At the top of `buildMainMenu`:

```ts
const resumeRoom = save.runActive ? save.runFloor : save.unlockedRoom;
const daily = dailyChallenge(new Date());
const dailyInfo = dailyStatus(save);
const stars = totalStars(save.roomStars);
const ledgerNext = LEDGER.find((m) => !ledgerClaimed(save, m.id) && stars >= m.stars)
  ?? LEDGER.find((m) => !ledgerClaimed(save, m.id))
  ?? null;
const descendAt = descendStart(save, save.deepest);
```

`openThrough` keeps `tester ? total + 60 : save.unlockedRoom`, but the selected tile is `resumeRoom` (clamped through the available rail). This is what makes CONTINUE land on the right floor.

**Step 3: Run strip after the header.** Add a `.rm-run` section before rooms:

- Active run: `RUN IN PROGRESS`, `FLOOR ${save.runFloor + 1}`, `STREAK ${save.runStreak}`, `EDGES ${save.runBoosts.length}`; a primary-ish `CONTINUE` button calls `actions.continueRun`.
- No run: `NEXT · FLOOR ${resumeRoom + 1}` and a `PLAY` button calls `actions.play(resumeRoom)`.
- If the selected room is not the run floor and a run is active, show `NEW RUN · EDGES RESET` in the action summary.

**Step 4: Daily card.** After the run strip or after rooms, add `.rm-daily`:

- title `DAILY CONTRACT`, room name, objective (`SURVIVE Ns` or the room objective).
- `STREAK ${dailyInfo.streak}` and today's/next reward `+${dailyInfo.next.scrap}`; day 7 `+ RARE EDGE`.
- If `dailyInfo.doneToday`: button `DONE TODAY` disabled, class `done`; else `▶ PLAY DAILY` calls `actions.daily`.
- The card must state that the daily does not spend the active run: `one room · your run waits`.

**Step 5: Ledger section.** Add `.rm-ledger`:

- header `STAR LEDGER · ${stars}/27`.
- nine tickets; each shows the star threshold and name; claimed tickets get a stamp, the next unclaimed gets `NEXT`.
- hover title includes the reward; if `ledgerNext` exists, the next reward line under the row reads `NEXT · ${ledgerNext.name} at ${ledgerNext.stars}★ — ${ledgerNext.reward}`; otherwise show `ALL LEDGER REWARDS CLAIMED`.
- claim is automatic on results; the menu is informational.
- If `ledgerBonus(save, 'master_key')`, add `MASTER KEY` class to the 27 ticket and the Depths card.

**Step 6: Depths card.** Add `.rm-depths`:

- If `save.unlockedRoom >= total` or tester: title `THE DEPTHS`, `deepest ${save.deepest}`, `NEXT FLOOR ${descendAt + 1}`, and `DESCEND` button calls `actions.descend`. If `descendAt >= 18`, show `MASTER KEY · STARTING AT FLOOR 19`. If a run is active, add `NEW RUN · EDGES RESET` so DESCEND is never a silent reset.
- Otherwise: `THE DEPTHS · clear all nine rooms to descend`, disabled/locked.
- The Depths card should not call `actions.play` directly; use `actions.descend` so the Ledger start is applied.

**Step 7: Tiles and action bar.**

- Add `NEXT` to the tile meta when `entry.index === resumeRoom`; add class `next`.
- `describe` sets `playSub`:
  - if `save.runActive && entry.index === save.runFloor`: `CONTINUE · FLOOR ${entry.index + 1}`;
  - else: `NEW RUN · FLOOR ${entry.index + 1}`.
- `playBtn` label: `▶ CONTINUE` when `save.runActive && selected === save.runFloor`, else `▶ PLAY`.
- The button always calls `actions.play(selected)`; `UI` routes through `playSelected`.
- If the player picks a different room while a run is active, the action summary shows `NEW RUN · EDGES RESET` so the choice is explicit. Do not block it.

**Step 8: CSS.** Add near `.rm-*`:

- `.rm-run` a torn ticket strip, flex row, stats in monospace, `CONTINUE` aligned right.
- `.rm-daily` a red/orange contract card; disabled state desaturated; 7-day pips.
- `.rm-ledger` a receipt strip; nine small tickets; `.claimed`, `.next`, `.master-key` gold foil; wrap on mobile.
- `.rm-depths` a dark card with a gold keyhole/MASTER KEY treatment.
- `.rm-tile.next` a tape arrow; responsive: run strip stacks, daily/ledger/depths full width, Edge/menu buttons at least 44px tall.

**Step 9: Manual.**

- Fresh save: no run strip CONTINUE; PLAY starts room 1.
- Clear room 1, pick an Edge, go HOME: the strip shows CONTINUE FLOOR 2; clicking it resumes with the Edge, same score/streak.
- Pick a different floor: the action warns NEW RUN; starting clears Edges.
- Daily: card shows streak/reward; playing leaves the run strip unchanged; after the daily, CONTINUE is still there.
- Ledger: at 3★ the 3 ticket is claimed and scrap was paid; at 27 the Master Key ticket and Depths card are gold.
- Tester `?unlock`: all rooms + depths cards work; `?stars=27` + `?unlock` starts DESCEND at floor 19.
- Mobile 390×844: run strip/daily/ledger do not cover the play button; the map still opens.

`npm run typecheck`; commit: `feat: rebuild the main menu around the run`.

### Task 14 — Analytics and funnel events

**Files:** `src/analytics/AnalyticsManager.ts`, `src/core/Game.ts`, `src/gameplay/RoomManager.ts`, `src/gameplay/Tutorial.ts`

Add these names to the `AnalyticsEventName` union (keep the existing names):

```ts
'run_start' | 'run_continue' | 'run_end'
| 'edge_offer' | 'edge_pick'
| 'heat_tier' | 'boss_arrive' | 'boss_defeat'
| 'daily_start' | 'daily_clear' | 'daily_already_paid'
| 'ledger_claim' | 'tutorial_skip'
```

Track exactly:

- `playFrom`: `run_start { floor, source: 'menu'|'tester'|'lesson' }` — use a simple `source` string; do not add a new event for every entry point.
- `continueRun`: `run_continue { floor, streak, edges }`.
- `abandonRun`: `run_end { reason: 'home', floor, streak }`.
- Depths `retryAfterFail`: `run_end { reason: 'depths_fail', floor, streak }` before starting the new run.
- `summarize` clear with an Edge offer: `edge_offer { floor, ids: offer.map(e => e.id).join(',') }`; if `dailyRareEdge`, include `rare: true`.
- `chooseEdge`: `edge_pick { id, floor, category, rarity, owned: save.runBoosts.filter(x => x === id).length }`.
- `onHeatEvent` tier 1/2: `heat_tier { tier, room, seconds: Math.round(room.elapsed) }`.
- `RoomManager` incident spawn: `boss_arrive { kind, name, floor: room.index + 1, seconds: Math.round(room.elapsed) }`.
- `completeRoom` when `room.hasBoss`: `boss_defeat { name, floor, seconds: Math.round(this.score.stats.time) }`.
- `playDaily`: `daily_start { streak, day }`.
- `summarize` daily clear: `daily_clear { streak, scrap, rareEdge }`; if `settled.alreadyDone`, `daily_already_paid { streak }` instead of `daily_clear` for the bonus.
- `claimLedger` result: `ledger_claim { id, stars, scrap }` for each.
- `markTutorialSkipped`: `tutorial_skip { room: 1 }`.

No network sink is added. The existing console sink is enough; these events make QA and later tuning possible.

`npm run typecheck`; commit: `feat: add progression analytics`.

---

### Task 15 — Balance pass, full verification, and the published mirror

**Files:** `src/gameplay/Heat.ts`, `src/gameplay/Incidents.ts`, `src/gameplay/Edges.ts`, `src/gameplay/StarLedger.ts`, `src/gameplay/Daily.ts`, `src/styles.css` (only if mobile fixes are needed)

**Step 1: Tune the first-pass numbers.** Start with the constants in the plan; adjust only the central tables, never scatter magic numbers:

- Heat: `PASSIVE 0.6`, `LATE 5` after 90s, `EMPTY 20`, tiers 34/67/100. Target: regular phase 0–40s, boss walk 5.2s, boss fight 20–50s, clear 60–120s.
- Heat sources: kill 7, hazard 12, chain 10, player hit 5, object broken 2, object hit 0.5 capped at 4/s.
- Enforcer HP scale 2.2 + 0.05 per floor after index 7, cap 3.0; speed 1.15.
- Edge damage: +25% heavy, +35% chain from link 2, +30% Headliner once/floor; movement +12%/+20% dash, cap 1.45; scrap +20%/+40%; score crowd streak +25% +10%/streak, cap 3×.
- Ledger: +15% score, +20% scrap, −15% cooldown; starting Edge at 9/18; Master Key floor 19.
- Daily: 20/30/40/50/60/75/100 + rare on day 7.

Record the actual room times from `room_complete` events for rooms 2–9. If a room is under 60s, lower passive/empty heat slightly or delay the boss release; if over 120s, raise the kill/object heat. Do not solve pacing by adding enemies to handcrafted rooms.

**Step 2: Automated gates.**

From `everything-is-a-weapon/`:

```powershell
npm test
npm run typecheck
npm run test:physics
npm run build
```

All must pass. If `npm test` includes only the new unit tests, that is expected; the physics smoke script remains separate.

**Step 3: Manual acceptance matrix.** Use a fresh save first, then `?unlock` and `?stars=27` for the late-game checks. Test desktop and a 390×844 phone viewport.

1. **Room 1 tutorial:** no heat/boss UI. Finish without SKIP; results stars 3 (if style earned), 3 Edge cards. Pick HEAVY; room 2 starts with `runBoosts` length 1.
2. **Rooms 2–9:** each has a unique Headliner. Heat moves, tier banners fire at 34/67, the boss walks in at 100, INCOMING + boss bar, clear in 60–120s. The next door teases the next boss.
3. **Edge loop:** after every non-daily clear, exactly one HEAVY/SLICK/GREED, no duplicates; picking one starts the next room; duplicates stack; REPLAY starts a new run at that floor with no Edges.
4. **Campaign fail:** EDGES KEPT; RETRY restarts the same floor with the same Edges; HOME then CONTINUE returns to the failed floor with the same score/streak/Edges.
5. **Depths:** clear room 9; Edge pick; next floor is depth 10. Death says RUN ENDED; rewarded CONTINUE keeps the run; RETRY starts a new run with no Edges; HOME ends it. DESCEND starts at the first unbeaten floor.
6. **Enforcer:** a non-boss Depths room has an Enforcer; INCOMING ENFORCER, crown, small boss bar; killing it does not increment `bossesBeaten`, does not pay the 100-scrap boss bonus, and adds no stars. `enforcersBeaten` increments.
7. **Survival:** heat bar, no boss bar; at 100 a final fire surge, no pending boss; timer still clears the room.
8. **Daily:** card shows streak/reward; playing does not touch the active run; after it, CONTINUE is exactly where it was; day 7 grants a rare Edge in the next offer; a second daily same day pays 0.
9. **Ledger:** claims at 3/6/9/12/15/18/21/24/27; scrap pays once; 6★ score, 15★ scrap, 24★ cooldown visible; 9★ common and 18★ rare starting Edges; 27★ Master Key starts DESCEND at floor 19.
10. **Room 1 star recovery:** SKIP first, clear for 2 stars; replay lesson/room without SKIP, earn 3; 27★ remains reachable.
11. **Presentation:** heat/boss bars never overlap health/lineup on mobile; Edge cards stack; arrival card does not block input; reduced-motion setting still animates legibly.
12. **Ads:** no new interstitial before Edge choice, retry, death, or daily. The existing room-complete/retry cadence is unchanged.

**Step 4: Rebuild the published arcade mirror.** The site serves a copy at `public/arcade/bonk`. From the repo root, after `npm run build` in the game:

```powershell
Copy-Item everything-is-a-weapon\dist\index.html public\arcade\bonk\index.html -Force
Remove-Item public\arcade\bonk\assets -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item everything-is-a-weapon\dist\assets public\arcade\bonk\assets -Recurse -Force
Remove-Item public\arcade\bonk\sfx -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item everything-is-a-weapon\dist\sfx public\arcade\bonk\sfx -Recurse -Force
```

Keep `public/arcade/bonk/poster.jpg`; do not mirror-delete it. If the site uses a different copy step, use that instead and say so in the commit.

**Step 5:** `git status --short`; ensure no unintended files. Commit: `chore: balance and verify BONK progression`.

---

## Suggested Commit Sequence

1. `feat: add save v5 run state and unit tests`
2. `feat: add Edge card catalogue and seeded offers`
3. `feat: add Edge run modifiers`
4. `feat: apply Edge modifiers to combat`
5. `feat: add heat meter model`
6. `feat: add incident specs and room release`
7. `feat: wire heat to boss releases`
8. `feat: add heat and boss HUD`
9. `feat: add run progression model`
10. `feat: persist runs and resolve Edge offers`
11. `feat: offer Edge cards on results`
12. `feat: add star ledger rewards`
13. `feat: add daily contract streak rewards`
14. `feat: rebuild the main menu around the run`
15. `feat: add progression analytics`
16. `chore: balance and verify BONK progression`

Each commit must leave `npm run typecheck` green. If a task's manual check cannot pass, stop and fix before the next task.

---

## Done Criteria

- A new player finishes room 1, chooses an Edge, and immediately wants room 2.
- Rooms 2–9 each build to a named Headliner arrival and a 60–120s clear.
- Every clear offers a real run-long choice; Edges stack and are visible in play.
- The menu always answers: **what is next, why now, and what am I risking?** Continue, daily, Ledger, and Depths are all one click away.
- A campaign fail keeps Edges; a Depths death ends the run only after the rewarded-continue decision.
- Enforcers are elite regulars, not bosses, and never leak into boss/star progression.
- Save v4 progress survives the v5 migration; daily never clobbers an active run.
- `npm test`, `npm run typecheck`, `npm run test:physics`, and `npm run build` pass; the manual matrix above is signed off.

