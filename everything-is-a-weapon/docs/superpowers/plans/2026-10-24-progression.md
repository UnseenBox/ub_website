# BONK Progression — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BONK’s campaign progression reachable and legible: a real forked Edge draft, a run that survives ordinary failure, permanent home upgrades, a visible Star Ledger, a first-clear-only daily, a completable Evidence Board, and a lobby/key wall/HUD that always answer “what am I carrying and what is next?”

**Architecture:** Pure rules first (`Upgrades`, `Progression`, `RoomOutcome`, `Run`, `Edges`, save v6), then `Game` payout/draft orchestration, then DOM screens, then CSS and package verification. The DOM never recomputes save economy; `RoomSummary` is the results contract, and `nextUnlock` is the single source of truth for lobby/store goals.

**Tech Stack:** TypeScript, Vite, Vitest + happy-dom, DOM/CSS from `src/ui-kit/bonk2`, localStorage/CrazyGames SDK saves, no new runtime dependencies.

**Spec:** [`docs/superpowers/specs/2026-10-23-progression-design.md`](../specs/2026-10-23-progression-design.md) — approved 2026-10-24.

---

## Global Constraints

- Preserve the 50-room campaign and all 20 bosses exactly once. No new rooms, bosses, heroes, pets, or Edge definitions in this pass.
- Preserve the simplified victory screens, no cutscenes, and the three-spike Kid crest.
- Rewards are loud, readable, and kid-friendly. Use existing `scrap` and stars only. Do not add a second currency.
- Do not introduce external assets or network calls. Reuse the existing kit art, sounds, palette, display face, and CSS shapes.
- **Failure contract:** an ordinary failure keeps the run and build. The failed room pays no salvage, score, high score, room best, stars, or contract progress. The run score rolls back to the start of the failed room; the streak resets to 0.
- **Draft cadence:** after room 1, after every second room after it (0-based even indices), and after every boss room. Never after a daily, a failure, or the final room. `shouldOfferEdge(index, boss)` is the single cadence rule.
- **Boss rule wins:** room 2 is a boss, so it drafts under the boss rule. The first non-draft room is room 10 (`index 9`), and its results strip points to `NEXT EDGE · ROOM 11`.
- **“Within three stars” is strict:** `nextUnlock` treats a Ledger milestone as close only when `milestone.stars - stars < 3` (1 or 2 stars remaining). At 0 stars the first milestone is 3 away, so a store goal may win.
- Edge stacks cap at 3. Maxed Edges are excluded from offers. A category with no unmaxed Edge is omitted. All categories maxed produces no offer and `BUILD MAXED`.
- A boss draft forces one premium in a randomly chosen category. Day 7 forces one legendary; a boss rare and the daily legendary must occupy different categories so neither is wasted.
- `cat_frenzy` keeps its internal id; its display name becomes `PET FRENZY` and it applies to every pet.
- Daily first clear pays the daily bonus and in-room scrap and counts once. Daily replays are practice: no bonus, no scrap, no counters, no contract progress, no high score.
- Pending draft is persisted as `runOffer`; on reload it auto-grants its first card. `HOME` skips the draft explicitly after a second tap.
- Room bests use room-local score. Save v6 resets the old cumulative `roomBests` table once.
- The static settings shop is retired; `STORE` opens the real store screen.
- Do not commit `.screenshots`, `.superpowers`, `crazy-goal/assets/crazy-kora-svg-pack.zip`, or `reels/`.
- Keep the CrazyGames package current and usable. No product code is “done” until `npm test`, `npm run typecheck`, `npm run build`, and `npm run build:crazygames` pass.
- Every task ends with a focused test run and a commit. Never leave the tree red between tasks.
- **Known balance flag:** the spec’s pet note says `1.5 × 1.48 = 2.22×`, but three PET FRENZY stacks plus max PET TRAINING is actually `2.5 × 1.48 = 3.7×`. Implement the effect as written; flag the discrepancy for the later economy pass. Do not silently retune it in this pass.

---

## Review Focus

Reviewers should check these first:

1. **Cadence**: room 1 drafts; room 2 drafts because it is a boss; room 10 (index 9, non-boss) does not; every boss before the final does; room 50 never does.
2. **Failure economy**: no scrap, high score, room best, stars, or contract counters on a failed room; `runActive` stays true; retry keeps Edges and resets score/streak.
3. **Daily economy**: first clear pays once; replay pays no bonus, in-room scrap, counters, contracts, or high score.
4. **Save v6**: `upgrades`, `runOffer`, one-time `roomBests` reset, duplicate Edge cap, unknown-id drops, no data loss of stars/scrap/discoveries.
5. **Draft UI**: first card gets focus, primary is disabled until a pick, double pick is impossible in `Game`, `R` cannot skip a pending draft, HOME and REPLAY require a second tap.
6. **RoomSummary is the contract**: results does not recompute save state; `roomScore`, `run`, `offer`, `nextRoom`, `nextEdge`, `nextGoal`, `ledger*`, daily fields, and `noSalvage` are all present.
7. **Goal helper**: strict `< 3` star priority; affordable store goal beats a distant star; fallback order matches the spec.
8. **Economy**: exact costs, max levels, multipliers, and 27,200 total sink; purchases never take scrap below zero.
9. **Shared ability card**: pause and store use one helper, so costs/owned states cannot drift.
10. **Mobile results order**: `side` (draft) comes before `marks` at `max-width: 860px`; actions stay outside the scrolling body.
11. **Package**: one-file CrazyGames build, no new external fetches, zip refreshed, `public/arcade/bonk` refreshed, `CRAZYGAMES.md` count corrected to 166.

---

## Task Map

| Task | Deliverable |
|---:|---|
| 0 | Commit the already-verified hero art/package work |
| 1 | `Upgrades.ts` — permanent tracks, costs, multipliers, buy rules |
| 2 | `Progression.ts` — `nextUnlock` |
| 3 | `RoomOutcome.ts` — payout/counter decision table |
| 4 | `Edges.ts` — cadence, stack cap, maxed filtering, premium rules, PET FRENZY |
| 5 | Discoveries duplicate fix (`hamster_trip`) |
| 6 | `Run.ts` — keep-run failure, `runOffer`, stack cap, snapshot |
| 7 | Save v6 migration and sanitize |
| 8 | Player max HP and permanent multipliers at call sites |
| 9 | `Game.summarize` — payouts, room score/best, summary contract |
| 10 | `Game` draft lifecycle — persist, choose, guard, auto-grant, retry |
| 11 | Results screen — draft side panel, build, next teaser, run report |
| 12 | Store screen + shared ability cards + settings shop removal |
| 13 | Star Ledger screen |
| 14 | Evidence Board screen |
| 15 | Lobby shell — daily chip, goal strip, clickable stats, CONTINUE |
| 16 | Flat sheet — four tabs and keyboard behavior |
| 17 | Key wall — resume floor, run banner, enter-label rules, confirm |
| 18 | HUD — run line, live scrap, pulse, failure snap-back |
| 19 | Pause — current run, rare-edge tag, shared card |
| 20 | CSS, mobile order, reduced motion, visual QA |
| 21 | Final verification, docs, CrazyGames package refresh |

---

### Task 0: Commit the verified pre-plan work

**Files:** no product edits. This task only isolates the already-verified menu/art/package work from the progression diff.

- [ ] **Step 0.1: Confirm exactly what is uncommitted**

Run:

```powershell
git status --short
```

Expected: modified `CRAZYGAMES.md`, `README.md`, `bonk-crazygames.zip`, `dist-crazygames/index.html`, the four `character-*.png` icons, `lobby.css`, `rooms.css`, `characters.ts`, `lobby.ts`; deleted/added files under `../public/arcade/bonk`; untracked `src/ui/screens/characters.test.ts` and `src/ui/screens/lobby.test.ts`; plus forbidden untracked `.screenshots` entries.

- [ ] **Step 0.2: Re-run the baseline before committing**

Run:

```powershell
npm test
npm run build
npm run build:crazygames
```

Expected: all tests pass, both builds succeed.

- [ ] **Step 0.3: Stage only the verified work**

Do **not** use `git add -A`. Stage explicit paths:

```powershell
git add CRAZYGAMES.md README.md bonk-crazygames.zip dist-crazygames/index.html
git add src/ui-kit/bonk2/assets/icons/character-lime@2x.png src/ui-kit/bonk2/assets/icons/character-rose@2x.png src/ui-kit/bonk2/assets/icons/character-teal@2x.png src/ui-kit/bonk2/assets/icons/character-violet@2x.png
git add src/ui-kit/bonk2/lobby.css src/ui-kit/bonk2/rooms.css
git add src/ui/screens/characters.ts src/ui/screens/lobby.ts src/ui/screens/characters.test.ts src/ui/screens/lobby.test.ts
git add -A ../public/arcade/bonk
```

- [ ] **Step 0.4: Confirm the staged set excludes forbidden directories**

Run:

```powershell
git diff --cached --name-only
```

Expected: no `.screenshots`, `.superpowers`, `crazy-kora-svg-pack.zip`, or `reels/` paths.

- [ ] **Step 0.5: Commit**

```powershell
git commit -m "chore: update BONK hero art and CrazyGames package"
```

---

### Task 1: Permanent upgrade tracks

**Files:**
- Create: `src/gameplay/Upgrades.ts`
- Create: `src/gameplay/Upgrades.test.ts`

**Interfaces:**

```ts
export type UpgradeId = 'door' | 'scrap' | 'cooldown' | 'score' | 'pet';

export interface UpgradeState {
  scrap: number;
  upgrades: Record<string, number>;
}

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly name: string;
  readonly maxLevel: number;
  readonly costs: readonly number[];
  /** Existing kit icon key; the store maps it to an imported image. */
  readonly icon: 'key' | 'coin' | 'dash' | 'trophy' | 'pet';
}

export const UPGRADES: readonly UpgradeDefinition[];
export const UPGRADE_BY_ID: Record<UpgradeId, UpgradeDefinition>;

export function upgradeLevel(save: UpgradeState, id: UpgradeId): number;
export function isUpgradeMaxed(save: UpgradeState, id: UpgradeId): boolean;
export function nextUpgradeCost(save: UpgradeState, id: UpgradeId): number | null;
export function upgradeEffect(save: UpgradeState, id: UpgradeId): string;
export function nextUpgradeEffect(save: UpgradeState, id: UpgradeId): string;
/** '' on success, otherwise a short reason the UI can show. */
export function buyUpgrade(save: UpgradeState, id: UpgradeId): string;
export function maxHealthBonus(save: UpgradeState): number;
export function upgradeScrapMultiplier(save: UpgradeState): number;
export function upgradeCooldownMultiplier(save: UpgradeState): number;
export function upgradeScoreMultiplier(save: UpgradeState): number;
export function upgradePetMultiplier(save: UpgradeState): number;
```

**Exact catalog:**

| id | name | max | costs | effect |
|---|---|---:|---|---|
| `door` | `REINFORCED DOOR` | 2 | 400, 1600 | `+1 max heart` per level |
| `scrap` | `SCRAP SENSE` | 4 | 200, 600, 1500, 3500 | `+10% scrap from intruders` per level |
| `cooldown` | `LIGHT FINGERS` | 4 | 250, 750, 1800, 4000 | `-7% ability cooldowns` per level |
| `score` | `CROWD WORK` | 4 | 220, 650, 1500, 3500 | `+5% score` per level |
| `pet` | `PET TRAINING` | 4 | 240, 700, 1600, 3800 | `+12% pet damage` per level |

- [ ] **Step 1.1: Write the failing test**

Create `src/gameplay/Upgrades.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ABILITIES } from './Abilities';
import {
  UPGRADES, UPGRADE_BY_ID, buyUpgrade, isUpgradeMaxed, maxHealthBonus,
  nextUpgradeCost, nextUpgradeEffect, upgradeCooldownMultiplier, upgradeEffect,
  upgradeLevel, upgradePetMultiplier, upgradeScrapMultiplier, upgradeScoreMultiplier,
  type UpgradeState,
} from './Upgrades';

function state(overrides: Partial<UpgradeState> = {}): UpgradeState {
  return { scrap: 10000, upgrades: {}, ...overrides };
}

it('defines five tracks with the exact names, caps and costs', () => {
  expect(UPGRADES.map((u) => [u.id, u.name, u.maxLevel, u.costs])).toEqual([
    ['door', 'REINFORCED DOOR', 2, [400, 1600]],
    ['scrap', 'SCRAP SENSE', 4, [200, 600, 1500, 3500]],
    ['cooldown', 'LIGHT FINGERS', 4, [250, 750, 1800, 4000]],
    ['score', 'CROWD WORK', 4, [220, 650, 1500, 3500]],
    ['pet', 'PET TRAINING', 4, [240, 700, 1600, 3800]],
  ]);
  expect(UPGRADE_BY_ID.pet.icon).toBe('pet');
});

it('the whole catalog plus the three powers costs 27,200 scrap', () => {
  const upgrades = UPGRADES.flatMap((u) => u.costs).reduce((a, b) => a + b, 0);
  const powers = ABILITIES.map((a) => a.cost).reduce((a, b) => a + b, 0);
  expect(upgrades).toBe(26810);
  expect(upgrades + powers).toBe(27200);
});

it('clamps levels and reports the next cost/effect', () => {
  const save = state({ upgrades: { door: 1, scrap: 4 } });
  expect(upgradeLevel(save, 'door')).toBe(1);
  expect(upgradeLevel(save, 'scrap')).toBe(4);
  expect(isUpgradeMaxed(save, 'door')).toBe(false);
  expect(nextUpgradeCost(save, 'door')).toBe(1600);
  expect(isUpgradeMaxed(save, 'scrap')).toBe(true);
  expect(nextUpgradeCost(save, 'scrap')).toBeNull();
  expect(upgradeEffect(save, 'door')).toBe('6 MAX HEARTS');
  expect(nextUpgradeEffect(save, 'door')).toBe('+1 MAX HEART');
  expect(upgradeEffect(save, 'scrap')).toBe('+40% SCRAP FROM INTRUDERS');
});

it('buys once, deducts scrap, and refuses without mutating', () => {
  const save = state({ scrap: 500 });
  expect(buyUpgrade(save, 'door')).toBe('');
  expect(save.scrap).toBe(100);
  expect(save.upgrades.door).toBe(1);
  expect(buyUpgrade(save, 'door')).toBe('NEEDS 1600 SCRAP');
  expect(save.scrap).toBe(100);
  expect(save.upgrades.door).toBe(1);
});

it('never takes scrap below zero and reports maxed/unknown', () => {
  const save = state({ scrap: 0, upgrades: { door: 2 } });
  expect(buyUpgrade(save, 'door')).toBe('MAXED');
  expect(save.scrap).toBe(0);
  expect(buyUpgrade(save, 'nope' as never)).toBe('UNKNOWN UPGRADE');
  expect(save.scrap).toBe(0);
});

it('applies the exact multipliers and max-heart bonus', () => {
  const save = state({ upgrades: { door: 2, scrap: 4, cooldown: 4, score: 4, pet: 4 } });
  expect(upgradeScrapMultiplier(save)).toBeCloseTo(1.4, 10);
  expect(upgradeCooldownMultiplier(save)).toBeCloseTo(0.93 ** 4, 10);
  expect(upgradeScoreMultiplier(save)).toBeCloseTo(1.2, 10);
  expect(upgradePetMultiplier(save)).toBeCloseTo(1.48, 10);
  expect(maxHealthBonus(save)).toBe(2);
});
```

- [ ] **Step 1.2: Run the test and verify it fails**

Run:

```powershell
npx vitest run src/gameplay/Upgrades.test.ts
```

Expected: FAIL — `src/gameplay/Upgrades.ts` cannot be resolved.

- [ ] **Step 1.3: Implement `Upgrades.ts`**

Implementation notes:

```ts
const DEFS: readonly UpgradeDefinition[] = [
  { id: 'door', name: 'REINFORCED DOOR', maxLevel: 2, costs: [400, 1600], icon: 'key' },
  { id: 'scrap', name: 'SCRAP SENSE', maxLevel: 4, costs: [200, 600, 1500, 3500], icon: 'coin' },
  { id: 'cooldown', name: 'LIGHT FINGERS', maxLevel: 4, costs: [250, 750, 1800, 4000], icon: 'dash' },
  { id: 'score', name: 'CROWD WORK', maxLevel: 4, costs: [220, 650, 1500, 3500], icon: 'trophy' },
  { id: 'pet', name: 'PET TRAINING', maxLevel: 4, costs: [240, 700, 1600, 3800], icon: 'pet' },
];
```

- `upgradeLevel` floors finite non-negative values and clamps to `maxLevel`; unknown ids return 0.
- `buyUpgrade` returns `'MAXED'`, `` `NEEDS ${cost} SCRAP` ``, or `'UNKNOWN UPGRADE'`; only a success writes `upgrades[id] = level + 1` and subtracts the cost.
- Multipliers: `1 + 0.10 * scrap`, `0.93 ** cooldown`, `1 + 0.05 * score`, `1 + 0.12 * pet`.
- `upgradeEffect` strings: `N MAX HEARTS` where `N = 5 + door level`, `+X% SCRAP FROM INTRUDERS`, `-X% ABILITY COOLDOWNS`, `+X% SCORE`, `+X% PET DAMAGE`. For cooldowns, `X = Math.round((1 - 0.93 ** level) * 100)` so the display matches the compounding multiplier (7 / 14 / 20 / 25).
- `nextUpgradeEffect` strings: `+1 MAX HEART`, `+10% SCRAP`, `-7% ABILITY COOLDOWNS`, `+5% SCORE`, `+12% PET DAMAGE`; `MAXED` at cap.
- Store only positive levels; no side effects beyond the `save` argument.

- [ ] **Step 1.4: Run the test to verify it passes**

Run:

```powershell
npx vitest run src/gameplay/Upgrades.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 1.5: Commit**

```powershell
git add src/gameplay/Upgrades.ts src/gameplay/Upgrades.test.ts
git commit -m "feat: add permanent upgrade tracks"
```

---

### Task 2: Next unlock goal

**Files:**
- Create: `src/gameplay/Progression.ts`
- Create: `src/gameplay/Progression.test.ts`

**Interfaces:**

```ts
import type { UpgradeId } from './Upgrades';

export type UnlockKind = 'store' | 'ledger' | 'done';
export type UnlockKicker = 'READY TO BUY' | 'NEXT STAR' | 'SAVE UP' | 'DONE';

export interface UnlockGoal {
  kind: UnlockKind;
  kicker: UnlockKicker;
  name: string;
  detail: string;
  /** 0–100, integer. */
  progress: number;
  action: 'store' | 'ledger' | null;
}

export interface ProgressionState {
  scrap: number;
  abilities: string[];
  upgrades: Record<string, number>;
}

export function nextUnlock(save: ProgressionState, stars: number): UnlockGoal;
```

**Resolution locked in the plan:** “within three stars” means strictly fewer than 3 remaining. `remaining = milestone.stars - stars`; the star goal wins only when `remaining === 1 || remaining === 2`. At 0 stars the first milestone is 3 away and does **not** win.

Priority, exactly:

1. Next unreached Ledger milestone when `0 < remaining < 3`.
2. Cheapest affordable unowned power or next upgrade.
3. Next unreached Ledger milestone at any distance.
4. Cheapest unaffordable unowned power or next upgrade.
5. `EVERYTHING UNLOCKED`.

Tie-break: lower cost first; on a tie, powers before upgrades; within a group, catalog order. Powers come from `ABILITIES` (costs 150/120/120).

- [ ] **Step 2.1: Write the failing test**

Create `src/gameplay/Progression.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextUnlock, type ProgressionState } from './Progression';

function state(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return { scrap: 0, abilities: [], upgrades: {}, ...overrides };
}

it('puts a Ledger milestone first when fewer than three stars remain', () => {
  const goal = nextUnlock(state({ scrap: 10000 }), 1);
  expect(goal).toMatchObject({
    kind: 'ledger',
    kicker: 'NEXT STAR',
    name: 'SCRAP STIPEND',
    detail: '2 STARS TO GO · +100 SCRAP',
    progress: 33,
    action: 'ledger',
  });
});

it('does not treat exactly three remaining stars as close', () => {
  const goal = nextUnlock(state({ scrap: 500 }), 0);
  expect(goal.kind).toBe('store');
  expect(goal.kicker).toBe('READY TO BUY');
  expect(goal.name).toBe('SUGAR RUSH');
  expect(goal.detail).toBe('120 SCRAP · READY NOW');
});

it('picks the cheapest affordable store item', () => {
  const goal = nextUnlock(state({ scrap: 130, abilities: ['overdrive'] }), 0);
  expect(goal).toMatchObject({
    kind: 'store',
    kicker: 'READY TO BUY',
    name: 'DEEP FREEZE',
    detail: '120 SCRAP · READY NOW',
    progress: 100,
    action: 'store',
  });
});

it('falls back to the next star when nothing is affordable', () => {
  const goal = nextUnlock(state({ scrap: 10 }), 3);
  expect(goal).toMatchObject({
    kind: 'ledger',
    kicker: 'NEXT STAR',
    name: 'CROWD FAVOURITE',
    detail: '3 STARS TO GO · +15% SCORE',
    action: 'ledger',
  });
});

it('shows a save-up store goal when the star track is complete', () => {
  const goal = nextUnlock(state({ scrap: 10 }), 27);
  expect(goal).toMatchObject({
    kind: 'store',
    kicker: 'SAVE UP',
    name: 'SUGAR RUSH',
    detail: '10 / 120 SCRAP · 110 TO GO',
    progress: 8,
    action: 'store',
  });
});

it('reports done only when every power, upgrade and star is complete', () => {
  const maxed = state({
    scrap: 0,
    abilities: ['blast', 'overdrive', 'freeze'],
    upgrades: { door: 2, scrap: 4, cooldown: 4, score: 4, pet: 4 },
  });
  expect(nextUnlock(maxed, 27)).toEqual({
    kind: 'done',
    kicker: 'DONE',
    name: 'EVERYTHING UNLOCKED',
    detail: 'THE LEASE IS YOURS.',
    progress: 100,
    action: null,
  });
});
```

- [ ] **Step 2.2: Run the test and verify it fails**

```powershell
npx vitest run src/gameplay/Progression.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement `Progression.ts`**

Implementation notes:

- Import `ABILITIES` and `LEDGER`; import `UPGRADES`, `nextUpgradeCost` from `Upgrades`. `upgradeLevel` is not needed: `nextUpgradeCost` returns `null` at the cap.
- Build candidates as `{ kind: 'power' | 'upgrade', name, cost }`. The goal detail comes from the affordable/save-up rule below, not from per-candidate text.
- Select `cheapest` with `cost`, then power-before-upgrade, then catalog index.
- Store goal detail is `READY NOW` when affordable, otherwise `${scrap} / ${cost} SCRAP · ${cost - scrap} TO GO`.
- Ledger detail is `${remaining} STARS TO GO · ${milestone.reward.toUpperCase()}`.
- Ledger progress is `floor(100 * stars / milestone.stars)` clamped to 100; store progress is `floor(100 * scrap / cost)` clamped to 100.
- The next unreached milestone is the first `LEDGER` row whose `stars > stars`.
- Do not import `Game`, DOM, or save storage into this module.

- [ ] **Step 2.4: Run the test to verify it passes**

```powershell
npx vitest run src/gameplay/Progression.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 2.5: Commit**

```powershell
git add src/gameplay/Progression.ts src/gameplay/Progression.test.ts
git commit -m "feat: add next unlock goal helper"
```

---

### Task 3: Room outcome rules

**Files:**
- Create: `src/gameplay/RoomOutcome.ts`
- Create: `src/gameplay/RoomOutcome.test.ts`

**Interfaces:**

```ts
export interface RoomOutcome {
  cleared: boolean;
  daily: boolean;
  dailyReplay: boolean;
  paysSalvage: boolean;
  updatesHighScore: boolean;
  updatesRoomBest: boolean;
  awardsStars: boolean;
  countsClear: boolean;
  countsCounters: boolean;
  advancesRun: boolean;
  noSalvage: boolean;
}

export function roomOutcome(cleared: boolean, daily: boolean, dailyReplay: boolean): RoomOutcome;
```

**Decision table (locked):**

| Situation | salvage | high score | room best | stars | counters | advance run | no salvage |
|---|---|---|---|---|---|---|---|
| campaign clear | yes | yes | yes | yes | yes | yes | no |
| campaign failure | no | no | no | no | no | no | yes |
| daily first clear | yes | yes | no | no | yes | no | no |
| daily replay clear | no | no | no | no | no | no | yes |
| daily failure | no | no | no | no | no | no | yes |

`countsClear` is true for a campaign clear and a daily first clear; it is false for failures and daily replays. `countsCounters` gates lifetime kills/chains/hazard kills and contract progress.

- [ ] **Step 3.1: Write the failing test**

Create `src/gameplay/RoomOutcome.test.ts`:

```ts
import { expect, it } from 'vitest';
import { roomOutcome } from './RoomOutcome';

it('pays a campaign clear and advances the run', () => {
  expect(roomOutcome(true, false, false)).toEqual({
    cleared: true, daily: false, dailyReplay: false,
    paysSalvage: true, updatesHighScore: true, updatesRoomBest: true,
    awardsStars: true, countsClear: true, countsCounters: true,
    advancesRun: true, noSalvage: false,
  });
});

it('pays nothing for a campaign failure', () => {
  expect(roomOutcome(false, false, false)).toEqual({
    cleared: false, daily: false, dailyReplay: false,
    paysSalvage: false, updatesHighScore: false, updatesRoomBest: false,
    awardsStars: false, countsClear: false, countsCounters: false,
    advancesRun: false, noSalvage: true,
  });
});

it('pays the daily first clear once and never advances the campaign run', () => {
  expect(roomOutcome(true, true, false)).toMatchObject({
    paysSalvage: true, updatesHighScore: true, updatesRoomBest: false,
    awardsStars: false, countsClear: true, countsCounters: true,
    advancesRun: false, noSalvage: false,
  });
});

it('makes a daily replay pure practice', () => {
  expect(roomOutcome(true, true, true)).toEqual({
    cleared: true, daily: true, dailyReplay: true,
    paysSalvage: false, updatesHighScore: false, updatesRoomBest: false,
    awardsStars: false, countsClear: false, countsCounters: false,
    advancesRun: false, noSalvage: true,
  });
});

it('pays nothing for a daily failure', () => {
  expect(roomOutcome(false, true, false)).toMatchObject({
    paysSalvage: false, updatesHighScore: false, updatesRoomBest: false,
    awardsStars: false, countsClear: false, countsCounters: false,
    advancesRun: false, noSalvage: true,
  });
});
```

- [ ] **Step 3.2: Run the test and verify it fails**

```powershell
npx vitest run src/gameplay/RoomOutcome.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement `RoomOutcome.ts`**

Implement the table literally with a single return object per branch. Keep it dependency-free.

- [ ] **Step 3.4: Run the test to verify it passes**

```powershell
npx vitest run src/gameplay/RoomOutcome.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 3.5: Commit**

```powershell
git add src/gameplay/RoomOutcome.ts src/gameplay/RoomOutcome.test.ts
git commit -m "feat: add room outcome rules"
```

---

### Task 4: Edge cadence, stack cap, and premium offers

**Files:**
- Modify: `src/gameplay/Edges.ts`
- Modify: `src/gameplay/Edges.test.ts`
- Modify: `src/gameplay/EdgeSystem.ts`

**Interfaces:**

```ts
export const EDGE_STACK_CAP = 3;

/** Room 1, every 0-based even index after it, every boss before the final. */
export function shouldOfferEdge(index: number, boss: boolean): boolean;

export function offerEdges(
  rng: Rng,
  forceRare: boolean,
  forceLegendary: boolean,
  owned: readonly string[],
): EdgeDefinition[];
```

**Cadence table to test:**

| index | boss | offer? | why |
|---:|---|---|---|
| 0 | no | yes | room 1 |
| 1 | yes | yes | room 2 is a boss |
| 2 | no | yes | every second room |
| 3 | no | no | neither cadence nor boss |
| 9 | no | no | room 10 is the first non-draft room |
| 11 | yes | yes | late boss slot |
| 48 | no | yes | even index |
| 49 | yes | no | final room never drafts |

- [ ] **Step 4.1: Write the failing tests**

Replace the old `offerEdges` tests in `src/gameplay/Edges.test.ts` with focused cases (keep existing definition tests):

```ts
import { Rng } from '../core/Random';
import {
  EDGE_STACK_CAP, EDGES, offerEdges, shouldOfferEdge,
} from './Edges';

it('caps stacks at three', () => {
  expect(EDGE_STACK_CAP).toBe(3);
});

it.each([
  [0, false, true], [1, true, true], [2, false, true], [3, false, false],
  [9, false, false], [11, true, true], [48, false, true], [49, true, false],
])('shouldOfferEdge(%i, boss=%s) is %s', (index, boss, expected) => {
  expect(shouldOfferEdge(index, boss)).toBe(expected);
});

it('excludes a maxed category and omits it from the offer', () => {
  const owned = ['heavy_hands', 'heavy_hands', 'heavy_hands',
    'chain_reaction', 'chain_reaction', 'chain_reaction',
    'headline_act', 'headline_act', 'headline_act'];
  const offer = offerEdges(new Rng(7), false, false, owned);
  expect(offer).toHaveLength(2);
  expect(offer.every((edge) => edge.category !== 'heavy')).toBe(true);
});

it('returns no offer when every Edge is maxed', () => {
  const owned = EDGES.flatMap((edge) => [edge.id, edge.id, edge.id]);
  expect(offerEdges(new Rng(7), false, false, owned)).toEqual([]);
});

it('gives a boss premium card a category that varies with the seed', () => {
  const categories = new Set<string>();
  for (let seed = 1; seed <= 24; seed++) {
    const offer = offerEdges(new Rng(seed), true, false, []);
    const premium = offer.find((edge) => edge.rarity !== 'common');
    expect(premium).toBeDefined();
    categories.add(premium!.category);
  }
  expect(categories.size).toBeGreaterThan(1);
});

it('keeps a boss rare and a daily legendary in different categories', () => {
  const offer = offerEdges(new Rng(3), true, true, []);
  const rare = offer.filter((edge) => edge.rarity === 'rare');
  const legendary = offer.filter((edge) => edge.rarity === 'legendary');
  expect(rare.length).toBeGreaterThanOrEqual(1);
  expect(legendary.length).toBeGreaterThanOrEqual(1);
  expect(rare[0]!.category).not.toBe(legendary[0]!.category);
});

it('renames cat_frenzy to PET FRENZY without changing its id', () => {
  const edge = EDGES.find((e) => e.id === 'cat_frenzy')!;
  expect(edge.name).toBe('PET FRENZY');
  expect(edge.effect).toBe('Your pet hits 50% harder.');
});
```

- [ ] **Step 4.2: Run the test and verify it fails**

```powershell
npx vitest run src/gameplay/Edges.test.ts
```

Expected: FAIL — `shouldOfferEdge`/`EDGE_STACK_CAP` missing, `offerEdges` arity mismatch, PET FRENZY name old.

- [ ] **Step 4.3: Implement the cadence and offer rules**

Implementation notes:

- Import `FINAL_ROOM_INDEX` from `./Campaign`.
- `shouldOfferEdge`: `false` for `index < 0` or `index >= FINAL_ROOM_INDEX`; `true` for `index === 0`, `boss`, or `index % 2 === 0`. The final room is covered by the range check.
- Filter every category pool by `edgeStacks(owned, edge.id) < EDGE_STACK_CAP`.
- Choose a random eligible category for the legendary, then a different eligible category for the boss premium. When both flags are set, the boss card must be `rarity === 'rare'` (fall back to any premium if no rare is available), so the daily legendary is never downgraded.
- Fill every remaining category with a random eligible card. Omit empty categories.
- Use `rng.int(0, pool.length - 1)` for picks. Do not consume RNG for categories with no cards.
- Rename `cat_frenzy` display fields only; keep `id: 'cat_frenzy'`.
- In `EdgeSystem.scoreMultiplier`, floor the result at `0.25`:
  ```ts
  return Math.max(0.25, crowdMultiplier * (1 - 0.10 * this.stacks('magnate')));
  ```

- [ ] **Step 4.4: Update call sites so the tree type-checks**

`Game.summarize` (Task 9) will pass four arguments; for now update any existing test/helper calls to `offerEdges(rng, forceRare, false, [])`. Do not change `startingEdge`.

- [ ] **Step 4.5: Run the test to verify it passes**

```powershell
npx vitest run src/gameplay/Edges.test.ts
```

Expected: PASS.

- [ ] **Step 4.6: Commit**

```powershell
git add src/gameplay/Edges.ts src/gameplay/Edges.test.ts src/gameplay/EdgeSystem.ts
git commit -m "feat: cap and schedule edge drafts"
```

---

### Task 5: Make the hamster discovery unique

**Files:**
- Modify: `src/gameplay/Discoveries.ts`
- Modify: `src/entities/Pets.ts`
- Create: `src/gameplay/Discoveries.test.ts`

- [ ] **Step 5.1: Write the failing test**

Create `src/gameplay/Discoveries.test.ts`:

```ts
import { expect, it } from 'vitest';
import { DISCOVERIES } from './Discoveries';

it('has 166 discoveries with unique ids', () => {
  expect(DISCOVERIES).toHaveLength(166);
  expect(new Set(DISCOVERIES.map((d) => d.id)).size).toBe(166);
});

it('keeps both trip hazards, one gadget and one style', () => {
  const gadget = DISCOVERIES.find((d) => d.id === 'trip_hazard')!;
  const hamster = DISCOVERIES.find((d) => d.id === 'hamster_trip')!;
  expect(gadget.group).toBe('gadget');
  expect(gadget.recipe).toContain('ROBOT HOOVER');
  expect(hamster.group).toBe('style');
  expect(hamster.title).toBe('HAMSTER TRIP');
  expect(hamster.recipe).toContain('STEPS ON THE HAMSTER BALL');
});
```

- [ ] **Step 5.2: Run the test and verify it fails**

```powershell
npx vitest run src/gameplay/Discoveries.test.ts
```

Expected: FAIL — 165 unique ids, `hamster_trip` missing.

- [ ] **Step 5.3: Rename the duplicate and update the pet unlock**

- In `Discoveries.ts`, change the second `trip_hazard` (style, hamster ball) to `id: 'hamster_trip'`, `title: 'HAMSTER TRIP'`. Leave the gadget `trip_hazard` untouched.
- In `Pets.ts`, change the hamster bowl unlock from `trip_hazard` to `hamster_trip`. Search for the hamster-ball path and update only that call.
- Do not over-grant old saves; the spec accepts a one-time gap for players who triggered it before the fix.

- [ ] **Step 5.4: Run the test to verify it passes**

```powershell
npx vitest run src/gameplay/Discoveries.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5.5: Commit**

```powershell
git add src/gameplay/Discoveries.ts src/gameplay/Discoveries.test.ts src/entities/Pets.ts
git commit -m "fix: make hamster trip discovery unique"
```

---

### Task 6: Keep the run on failure and persist the offer

**Files:**
- Modify: `src/gameplay/Run.ts`
- Modify: `src/gameplay/Run.test.ts`

**Interfaces:**

```ts
export interface RunState {
  runActive: boolean;
  runFloor: number;
  runStreak: number;
  runBoosts: string[];
  runScore: number;
  runInsuranceUsed: boolean;
  /** Up to three offered Edge ids while a draft is pending (new in v6). */
  runOffer: string[];
}

export interface RunSnapshot {
  floor: number;      // 1-based room the run is on
  streak: number;
  score: number;
  types: number;      // distinct Edge ids
  stacks: number;     // total Edge copies
  boosts: string[];
}

export function startRun(save: RunState, index: number): void;
export function recordClear(save: RunState, index: number, score: number): void;

/** Resets streak and rolls the run score back to the room start. Never ends the run. */
export function recordFail(save: RunState, scoreAtStart: number): void;

/** False when this Edge is already at three stacks. */
export function chooseEdge(save: RunState, id: EdgeId): boolean;

export function endRun(save: RunState): void;
export function sanitizeRun(
  save: RunState,
  unlockedRoom: number,
  deepest: number,
  maxFloor?: number,
): void;

export function runSnapshot(save: RunState): RunSnapshot;
```

- [ ] **Step 6.1: Write the failing tests**

Update `src/gameplay/Run.test.ts`. First add `runOffer: []` to the `state()` helper defaults (the `RunState` interface now requires it), then add:

```ts
import { EDGE_STACK_CAP } from './Edges';

it('keeps the run and build on failure, resetting only streak and score', () => {
  const save = state({
    runActive: true, runFloor: 5, runStreak: 4,
    runBoosts: ['quick_feet', 'quick_feet'], runScore: 1200,
  });
  recordFail(save, 900);
  expect(save.runActive).toBe(true);
  expect(save.runFloor).toBe(5);
  expect(save.runStreak).toBe(0);
  expect(save.runScore).toBe(900);
  expect(save.runBoosts).toEqual(['quick_feet', 'quick_feet']);
});

it('starts and ends a run with no pending offer', () => {
  const save = state({ runOffer: ['heavy_hands'], runActive: true });
  startRun(save, 4);
  expect(save.runOffer).toEqual([]);
  save.runOffer = ['heavy_hands'];
  endRun(save);
  expect(save.runOffer).toEqual([]);
});

it('caps a chosen Edge at three stacks', () => {
  const save = state({ runActive: true, runBoosts: ['quick_feet', 'quick_feet'] });
  expect(chooseEdge(save, 'quick_feet')).toBe(true);
  expect(chooseEdge(save, 'quick_feet')).toBe(false);
  expect(save.runBoosts.filter((id) => id === 'quick_feet')).toHaveLength(EDGE_STACK_CAP);
});

it('sanitizes unknown ids and caps duplicates', () => {
  const save = state({
    runBoosts: ['quick_feet', 'nope', 'quick_feet', 'quick_feet', 'quick_feet'],
  });
  sanitizeRun(save, 50, 10, 50);
  expect(save.runBoosts).toEqual(['quick_feet', 'quick_feet', 'quick_feet']);
});

it('summarizes types, stacks and the 1-based floor for the UI', () => {
  const snap = runSnapshot(state({
    runActive: true, runFloor: 11, runStreak: 4, runScore: 12400,
    runBoosts: ['quick_feet', 'quick_feet', 'heavy_hands'],
  }));
  expect(snap).toEqual({
    floor: 12, streak: 4, score: 12400, types: 2, stacks: 3,
    boosts: ['quick_feet', 'quick_feet', 'heavy_hands'],
  });
});

it('drops a pending offer when sanitizing ends the run', () => {
  const save = state({ runActive: true, runFloor: 99, runOffer: ['heavy_hands'] });
  sanitizeRun(save, 0, 0, 1);
  expect(save.runActive).toBe(false);
  expect(save.runOffer).toEqual([]);
});
```

Remove the old `recordFail(..., handcraftedCount)` signature and its “ends generated runs” expectation.

- [ ] **Step 6.2: Run the test and verify it fails**

```powershell
npx vitest run src/gameplay/Run.test.ts
```

Expected: FAIL — arity mismatch, missing `runOffer`, `runSnapshot`, `chooseEdge` boolean.

- [ ] **Step 6.3: Implement `Run.ts`**

- Import `EDGE_STACK_CAP` and `edgeStacks` from `./Edges`.
- `startRun` and `endRun` set `runOffer = []`.
- `recordFail` sets `runActive = true`, `runStreak = 0`, `runScore = whole(scoreAtStart)`.
- `chooseEdge` returns false at the cap, otherwise pushes and returns true.
- `sanitizeRun` filters unknown ids while preserving order and at most three copies of each id.
- `sanitizeRun` sets `runOffer = []` when it invalidates the run (`runFloor > furthest`), so a dead run never pins an offer on the results screen.
- `runSnapshot` computes `types = new Set(runBoosts).size`, `stacks = runBoosts.length`, `floor = runFloor + 1`.

- [ ] **Step 6.4: Run the test to verify it passes**

```powershell
npx vitest run src/gameplay/Run.test.ts
```

Expected: PASS.

- [ ] **Step 6.5: Commit**

```powershell
git add src/gameplay/Run.ts src/gameplay/Run.test.ts
git commit -m "feat: keep runs on failure and persist edge offers"
```

---

### Task 7: Save v6

**Files:**
- Modify: `src/save/SaveManager.ts`
- Modify: `src/save/SaveManager.test.ts`

**Interfaces added to `SaveData`:**

```ts
/** Permanent home-upgrade levels by id (new in version 6). */
upgrades: Record<string, number>;
/** Up to three offered Edge ids while a draft is pending (new in version 6). */
runOffer: string[];
```

`SAVE_VERSION` becomes `6`. Defaults are `{}` and `[]`.

- [ ] **Step 7.1: Write the failing tests**

First update the existing suite so it describes v6 rather than v5:

- Rename `describe('SaveManager v5', ...)` to `describe('SaveManager v6', ...)`.
- In the v4 migration test, change `expect(SAVE_VERSION).toBe(5)` to `6` and add `expect(save.upgrades).toEqual({}); expect(save.runOffer).toEqual([]);`.
- In “starts a fresh save with v5 run defaults”, rename it to `starts a fresh save with v6 run and progression defaults`, and add the same two `upgrades`/`runOffer` expectations.
- Keep the v5 fixture saves in the remaining tests; each one now migrates through the v6 step without losing run state.

Then add to `src/save/SaveManager.test.ts`:

```ts
it('migrates a v5 save and resets only the cumulative room bests', () => {
  const save = loadRaw({
    version: 5,
    scrap: 900, highScore: 5000, discoveries: ['blunt_force'],
    roomStars: { 'room-1': 3 }, roomBests: { 'room-1': { score: 4200, chain: 6 } },
    runActive: true, runFloor: 4, runStreak: 2, runScore: 4200,
    runBoosts: ['quick_feet'], runOffer: ['heavy_hands'],
  });
  expect(SAVE_VERSION).toBe(6);
  expect(save.upgrades).toEqual({});
  expect(save.runOffer).toEqual([]);
  expect(save.roomBests).toEqual({});
  expect(save.roomStars).toEqual({ 'room-1': 3 });
  expect(save.scrap).toBe(900);
  expect(save.highScore).toBe(5000);
  expect(save.runBoosts).toEqual(['quick_feet']);
  expect(save.runActive).toBe(true);
});

it('round-trips v6 upgrade levels and a pending offer', () => {
  const save = loadRaw({
    version: 6, upgrades: { door: 2, scrap: 3 }, runActive: true,
    runOffer: ['heavy_hands', 'quick_feet'],
  });
  expect(save.upgrades).toEqual({ door: 2, scrap: 3 });
  expect(save.runOffer).toEqual(['heavy_hands', 'quick_feet']);
});

it('clamps/drops upgrade values and stores only positive known levels', () => {
  const save = loadRaw({
    version: 6,
    upgrades: { door: 99, scrap: -2, cooldown: 2.9, score: '3', pet: 4, nope: 2 },
  });
  expect(save.upgrades).toEqual({ door: 2, cooldown: 2, pet: 4 });
});

it('caps duplicate run Edges and drops unknown ids', () => {
  const save = loadRaw({
    version: 6, runActive: true,
    runBoosts: ['quick_feet', 'nope', 'quick_feet', 'quick_feet', 'quick_feet', 'heavy_hands'],
  });
  expect(save.runBoosts).toEqual(['quick_feet', 'quick_feet', 'quick_feet', 'heavy_hands']);
});

it('sanitizes runOffer to three known unique ids and clears it without a run', () => {
  const active = loadRaw({
    version: 6, runActive: true,
    runOffer: ['heavy_hands', 'heavy_hands', 'nope', 'quick_feet', 'scrap_luck', 'magnate'],
  });
  expect(active.runOffer).toEqual(['heavy_hands', 'quick_feet', 'scrap_luck']);
  const idle = loadRaw({ version: 6, runActive: false, runOffer: ['heavy_hands'] });
  expect(idle.runOffer).toEqual([]);
});
```

Expected migration behavior: every save with `version < 6` gets `upgrades = {}`, `runOffer = []`, and `roomBests = {}` exactly once. A v5 save in the test is already at v5, so it runs only the v6 step.

- [ ] **Step 7.2: Run the test and verify it fails**

```powershell
npx vitest run src/save/SaveManager.test.ts
```

Expected: FAIL — version 5, missing fields, room bests retained.

- [ ] **Step 7.3: Implement the migration and sanitize**

- Import `UPGRADES` and `isEdgeId`/`EDGE_STACK_CAP`.
- Add the v6 migration block after v5:
  ```ts
  if (version < 6) {
    raw.upgrades = {};
    raw.runOffer = [];
    // Old room bests were cumulative run scores, not room scores.
    raw.roomBests = {};
    version = 6;
  }
  ```
- `defaults()` includes `upgrades: {}` and `runOffer: []`.
- Sanitize helpers:
  ```ts
  function upgradeLevels(value: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (!isRecord(value)) return out;
    for (const def of UPGRADES) {
      const raw = value[def.id];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      const level = Math.min(def.maxLevel, Math.floor(raw));
      if (level > 0) out[def.id] = level;
    }
    return out;
  }

  function runEdges(value: unknown): string[] {
    const out: string[] = [];
    const counts = new Map<string, number>();
    for (const id of stringArray(value)) {
      if (!isEdgeId(id)) continue;
      const count = counts.get(id) ?? 0;
      if (count >= EDGE_STACK_CAP) continue;
      counts.set(id, count + 1);
      out.push(id);
    }
    return out;
  }

  function runOffer(value: unknown, active: boolean): string[] {
    if (!active) return [];
    const out: string[] = [];
    for (const id of stringArray(value)) {
      if (!isEdgeId(id) || out.includes(id)) continue;
      out.push(id);
      if (out.length === 3) break;
    }
    return out;
  }
  ```
- Compute `const runActive = data.runActive === true;` before the return object; use it for both `runActive` and `runOffer`.
- Keep `runBoosts` as duplicate-preserving `runEdges(...)`.

- [ ] **Step 7.4: Run the test to verify it passes**

```powershell
npx vitest run src/save/SaveManager.test.ts
```

Expected: PASS, all old + new tests.

- [ ] **Step 7.5: Commit**

```powershell
git add src/save/SaveManager.ts src/save/SaveManager.test.ts
git commit -m "feat: migrate saves to v6"
```

---

### Task 8: Max HP and permanent multipliers at the call sites

**Files:**
- Modify: `src/entities/Player.ts`
- Create: `src/entities/Player.test.ts`
- Modify: `src/core/Game.ts`
- Modify: `src/gameplay/ScoreSystem.ts`
- Modify: `src/gameplay/Abilities.ts`
- Modify: `src/entities/Pets.ts`
- Modify: `src/entities/Cat.ts`

**Interfaces:**

```ts
// Player
constructor(x: number, y: number, maxHp = 5);
readonly maxHp: number;
hp: number;

// Game
petDamageMultiplier(): number; // edges.petFrenzyMultiplier() * upgradePetMultiplier(save)
```

- [ ] **Step 8.1: Write the failing tests**

Create `src/entities/Player.test.ts`:

```ts
import { expect, it } from 'vitest';
import { Player } from './Player';

it('defaults to five hearts', () => {
  const player = new Player(0, 0);
  expect(player.maxHp).toBe(5);
  expect(player.hp).toBe(5);
});

it('starts at the upgraded max and revives to it', () => {
  const player = new Player(0, 0, 7);
  expect(player.maxHp).toBe(7);
  expect(player.hp).toBe(7);
  player.hp = 1;
  player.revive();
  expect(player.hp).toBe(7);
});
```

- [ ] **Step 8.2: Run the test and verify it fails**

```powershell
npx vitest run src/entities/Player.test.ts
```

Expected: FAIL — `maxHp` is fixed at 5 and the constructor accepts two arguments.

- [ ] **Step 8.3: Implement the Player change**

- Replace the field initializers with declarations:
  ```ts
  hp: number;
  readonly maxHp: number;
  ```
- In the constructor, accept `maxHp = 5`, then `this.maxHp = maxHp; this.hp = maxHp;` before any use.
- `revive()` already uses `this.maxHp`; no change.

- [ ] **Step 8.4: Apply upgrades at the simulation call sites**

- `Game.loadRoom`: `this.player = new Player(def.playerStart.x, def.playerStart.y, 5 + maxHealthBonus(this.save.data));`
- `ScoreSystem.award`: multiply the awarded score by `upgradeScoreMultiplier(this.game.save.data)`.
- `ScoreSystem.onEnemyDefeated`: multiply earned scrap by `upgradeScrapMultiplier(this.game.save.data)` alongside Edge/Ledger multipliers.
- `AbilitySystem.cooldownFor`: multiply by `upgradeCooldownMultiplier(this.game.save.data)` alongside the Ledger multiplier.
- Add `Game.petDamageMultiplier()` and use it at all five pet call sites:
  - cat scratch and cat swipe in `Cat.ts` (replace `game.edges.petFrenzyMultiplier()`);
  - dog bite, parrot peck, hamster bowl in `Pets.ts` (replace raw damage values).
- Keep the cat’s existing attack-speed frenzy behavior based on `cat_frenzy`; only the damage multiplier becomes shared.

- [ ] **Step 8.5: Run focused tests and typecheck**

```powershell
npx vitest run src/entities/Player.test.ts src/gameplay/Upgrades.test.ts
npm run typecheck
```

Expected: PASS and no type errors.

- [ ] **Step 8.6: Commit**

```powershell
git add src/entities/Player.ts src/entities/Player.test.ts src/core/Game.ts src/gameplay/ScoreSystem.ts src/gameplay/Abilities.ts src/entities/Pets.ts src/entities/Cat.ts
git commit -m "feat: apply max hp and permanent multipliers"
```

---

### Task 9: Pay only cleared rooms and record honest room scores

**Files:**
- Modify: `src/core/Game.ts`
- Create: `src/core/Game.progression-flow.test.ts`
- Modify: `src/core/Game.tutorial-flow.test.ts`

**`RoomSummary` contract additions:**

```ts
run: {
  floor: number;            // 1-based room just played
  nextFloor: number | null; // 1-based next room, null at final/failure/daily
  streak: number;
  score: number;            // cumulative run score after this room
  types: number;
  stacks: number;
  boosts: string[];         // build before the pending offer
  ended: boolean;           // true only on final victory
};
roomScore: number;
isNewRoomBest: boolean;
offer: EdgeDefinition[];    // empty on non-draft rooms, failures, daily, final
nextRoom: { number: number; name: string; boss: boolean } | null;
nextEdge: { number: number; boss: boolean } | null;
nextGoal: UnlockGoal;       // required by failure and lobby parity
ledgerNext: LedgerMilestone | null;
ledgerStars: number;        // 0..27
totalStars: number;         // 0..150
dailyStreak: number;
dailyReplay: boolean;
dailyRareEdgeGranted: boolean;
noSalvage: boolean;
buildMaxed: boolean;
```

`nextGoal` and `buildMaxed` are additions beyond the spec’s list; the failure screen needs a goal and the non-draft strip needs an honest “BUILD MAXED.”

- [ ] **Step 9.1: Write the failing Game tests**

Create `src/core/Game.progression-flow.test.ts`. Reuse the fake canvas/2D stub from `Game.tutorial-flow.test.ts` (copy the small helper; do not change the simulation). Add a private-access helper:

```ts
function summarize(game: Game, cleared: boolean, bonus = 0): RoomSummary {
  return (game as unknown as {
    summarize(c: boolean, b: number): RoomSummary;
  }).summarize(cleared, bonus);
}

function setRoomStart(game: Game, score: number): void {
  (game as unknown as { scoreAtRoomStart: number }).scoreAtRoomStart = score;
}
```

The new file needs the tutorial-flow file's `beforeEach`: `localStorage.clear()`, reset `document.body` to `<div id="hud"></div><div id="screens"></div>`, and stub `requestAnimationFrame`. Otherwise a save written by one test leaks into the next.

Tests:

```ts
it('pays no salvage, high score, room best, stars or counters on failure', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.playFrom(9); // room 10, non-draft
  const before = {
    scrap: game.save.data.scrap, highScore: game.save.data.highScore,
    cleared: game.save.data.roomsCleared, kills: game.save.data.totalKills,
  };
  game.score.score = 500;
  game.score.stats.scrap = 25;
  game.score.stats.kills = 4;
  game.score.stats.bestChain = 3;
  const summary = summarize(game, false);
  expect(summary.noSalvage).toBe(true);
  expect(summary.run.score).toBe(0);
  expect(game.save.data.scrap).toBe(before.scrap);
  expect(game.save.data.highScore).toBe(before.highScore);
  expect(game.save.data.roomBests).toEqual({});
  expect(game.save.data.roomsCleared).toBe(before.cleared);
  expect(game.save.data.totalKills).toBe(before.kills);
  expect(game.save.data.runActive).toBe(true);
  expect(game.save.data.runScore).toBe(0);
});

it('stores the room delta, not the carried run total, as the room best', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.playFrom(9);
  setRoomStart(game, 4000);
  game.save.data.runScore = 4000;
  game.score.score = 4500;
  game.score.stats.scrap = 25;
  const summary = summarize(game, true);
  expect(summary.roomScore).toBe(500);
  expect(summary.isNewRoomBest).toBe(true);
  expect(game.save.data.roomBests[summary.roomName]?.score).toBe(500);
  expect(game.save.data.highScore).toBe(4500);
  expect(summary.run.score).toBe(4500);
  expect(summary.offer).toEqual([]);
  expect(summary.nextEdge).toEqual({ number: 11, boss: false });
});
```

Use the actual room id from `game.room.def.id` instead of `summary.roomName` in the room-best assertion.

```ts
it('pays a daily first clear once and counts it', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.save.data.dailyStreak = 2;
  const scrap = game.save.data.scrap;
  const cleared = game.save.data.roomsCleared;
  const kills = game.save.data.totalKills;
  game.playDaily();
  game.score.score = 300;
  game.score.stats.scrap = 30;
  game.score.stats.kills = 2;
  const summary = summarize(game, true);
  expect(summary.dailyReplay).toBe(false);
  expect(summary.dailyBonus).toBe(40); // streak 3: 10 + 3 × 10
  expect(summary.run.ended).toBe(false);
  expect(game.save.data.scrap).toBe(scrap + 70); // 30 in-room + 40 bonus
  expect(game.save.data.roomsCleared).toBe(cleared + 1);
  expect(game.save.data.totalKills).toBe(kills + 2);
});

it('makes a daily replay pure practice', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.save.data.lastDaily = todayKey();
  game.playDaily();
  const scrap = game.save.data.scrap;
  const cleared = game.save.data.roomsCleared;
  const kills = game.save.data.totalKills;
  game.score.score = 300;
  game.score.stats.scrap = 30;
  game.score.stats.kills = 2;
  const summary = summarize(game, true);
  expect(summary.dailyReplay).toBe(true);
  expect(summary.dailyBonus).toBe(0);
  expect(summary.noSalvage).toBe(true);
  expect(game.save.data.scrap).toBe(scrap);
  expect(game.save.data.roomsCleared).toBe(cleared);
  expect(game.save.data.totalKills).toBe(kills);
});

it('grants the day-7 legendary and consumes it on the next campaign draft', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.save.data.dailyStreak = 6;
  game.playDaily();
  game.score.score = 100;
  const daily = summarize(game, true);
  expect(daily.dailyRareEdgeGranted).toBe(true);
  expect(game.save.data.dailyRareEdge).toBe(true);

  game.playFrom(0);
  game.score.score = 100;
  const draft = summarize(game, true);
  expect(draft.offer.some((edge) => edge.rarity === 'legendary')).toBe(true);
  expect(game.save.data.dailyRareEdge).toBe(false);
});
```

Add to `Game.tutorial-flow.test.ts`:
- room 1 clear has `summary.offer` length 3 and `save.runOffer` length 3.

The draft-resolution assertions (`nextRoom` guard, `chooseEdge`, advance) belong to Task 10.

- [ ] **Step 9.2: Run the tests and verify they fail**

```powershell
npx vitest run src/core/Game.progression-flow.test.ts src/core/Game.tutorial-flow.test.ts
```

Expected: FAIL — summary fields missing; failure pays salvage; daily replay pays.

- [ ] **Step 9.3: Rewrite `summarize` around `RoomOutcome`**

Implementation order inside `summarize`:

1. Capture `const index = this.room.index;`, `const daily = this.room.daily;`, `const wasDeepest = save.deepest;`, `const runStreak = save.runStreak;`, and `const build = [...save.runBoosts];` before any mutation (the final victory clears the live build and resets the streak). Keep the existing locals (`runEnded`, `dailyBonus`, star flags) before the branch chain and add `let dailyRareEdgeGranted = false;`.
2. Capture `roomScore = this.score.score - this.scoreAtRoomStart`.
3. Capture `dailyReplay = daily && save.lastDaily === todayKey()` **before** advancing the streak.
4. `const outcome = roomOutcome(cleared, daily, dailyReplay); const noSalvage = !outcome.paysSalvage;`
5. High score: `const isHighScore = outcome.updatesHighScore && this.score.score > save.highScore; if (isHighScore) save.highScore = this.score.score;` Never mutate `highScore` on failure or daily replay.
6. Always update `bestChain` (personal record, no payout).
7. `if (outcome.paysSalvage) save.scrap += this.score.stats.scrap;`
8. Campaign clear branch: `if (outcome.advancesRun) { ... }` (cleared, non-daily, non-final or final).
   - `recordClear(save, index, this.score.score);`
   - counters (`roomsCleared`, kills, chains, hazard kills, bosses/enforcers);
   - stars and `isNewBestStars`;
   - first-clear bonus 40/100 when `wasDeepest <= index` (`100` for a boss);
   - `unlockedRoom`, `deepest`;
   - room best from `roomScore`: `if (prev === undefined || roomScore > prev.score) save.roomBests[id] = { score: roomScore, chain: Math.max(this.score.stats.bestChain, prev?.chain ?? 0) };` otherwise keep the old entry untouched;
   - `if (index === FINAL_ROOM_INDEX) { endRun(save); }`.
9. Daily clear branch: `else if (cleared && daily) { ... }` (a daily never advances the campaign run).
   - `if (!dailyReplay)`: advance `lastDaily`/`dailyStreak` exactly as today; `dailyBonus = Math.min(50, 10 + save.dailyStreak * 10); save.scrap += dailyBonus;` then `dailyRareEdgeGranted = save.dailyStreak % 7 === 0; if (dailyRareEdgeGranted) save.dailyRareEdge = true;`.
   - `if (outcome.countsCounters)`: increment `roomsCleared` and lifetime kills/chains/hazard kills.
   - no stars, no first-clear bonus, no contracts outside `outcome.countsCounters`, no room best.
10. Failure branch: `else if (!daily) recordFail(save, this.scoreAtRoomStart);` (no `handcraftedCount`; a daily failure changes nothing).
11. Contracts: only when `outcome.countsCounters`.
12. Ledger claims: only when `outcome.awardsStars` (campaign clears). `const ledgerClaims = outcome.awardsStars ? claimLedger(save) : [];`
13. `const finale = cleared && !daily && index === FINAL_ROOM_INDEX; runEnded = finale;` (`runEnded` is the local declared before the branch chain). Failures never end runs; `recordFail` leaves `runActive` true.
14. Build `run` from the captured values, not from the post-`endRun` save:
    ```ts
    const run = {
      floor: index + 1,
      nextFloor: outcome.advancesRun && !finale ? index + 2 : null,
      streak: runStreak,
      score: cleared && !daily ? this.score.score : save.runScore,
      types: new Set(build).size,
      stacks: build.length,
      boosts: build,
      ended: runEnded,
    };
    ```
    (`nextFloor` is null on failure, daily, and the final victory; the failure screen resumes via `runFloor`, not `nextFloor`. `runStreak` is captured before `endRun` clears it.)
15. `const nextDef = outcome.advancesRun && !finale ? this.rooms.definition(index + 1) : null;` then `nextRoom = nextDef ? { number: index + 2, name: nextDef.name, boss: campaignBossType(index + 1, nextDef) !== null } : null`. Do not call `definition()` on failure, daily, or the final victory.
16. `nextGoal = nextUnlock(save, totalStars(save.roomStars))`.
17. Offer generation is detailed in Task 10; for this task generate it inline:
    ```ts
    const boss = campaignBossType(index, this.room.def) !== null;
    const draft = cleared && !daily && !finale && shouldOfferEdge(index, boss);
    const offer = draft
      ? offerEdges(this.rng, boss, save.dailyRareEdge, save.runBoosts)
      : [];
    if (draft && offer.length > 0) {
      save.runOffer = offer.map((edge) => edge.id);
      this.pendingDraft = { room: index, offer };
      if (save.dailyRareEdge) save.dailyRareEdge = false;
    } else {
      save.runOffer = [];
      this.pendingDraft = null;
    }
    ```
    `dailyRareEdge` is consumed only when an offer is actually generated; an all-maxed draft leaves the flag for the next run.
18. `buildMaxed = EDGES.every((edge) => edgeStacks(build, edge.id) >= EDGE_STACK_CAP)`.
19. `nextEdge = cleared && !daily && !finale ? firstDraftAfter(index) : null`; scan `index + 1 .. FINAL_ROOM_INDEX - 1` for the first `shouldOfferEdge(i, isBoss(i))`; return `{ number: i + 1, boss: isBoss(i) }`. (`isBoss(i) = campaignBossType(i, this.rooms.definition(i)) !== null`.)
20. `ledgerStars = Math.min(27, totalStars(save.roomStars))`; `ledgerNext` is the first milestone with `stars > totalStars(save.roomStars)`.
21. `dailyRareEdgeGranted` is the value set in the daily branch (false on campaign rooms and replays).
22. Write the save once, after all payout and draft mutations.
23. Add every new field to the returned `RoomSummary`: `run`, `roomScore`, `isNewRoomBest`, `offer`, `nextRoom`, `nextEdge`, `nextGoal`, `ledgerNext`, `ledgerStars`, `totalStars`, `dailyStreak`, `dailyReplay`, `dailyRareEdgeGranted`, `noSalvage`, `buildMaxed` (plus the existing `runEnded`).

Extend the `Edges` import with `EDGES, EDGE_STACK_CAP, edgeStacks, offerEdges, shouldOfferEdge, type EdgeDefinition`; extend the `Campaign` import with `totalStars`; import `nextUnlock, type UnlockGoal` from `../gameplay/Progression`. Add this private method to `Game` and call it from step 19:

```ts
private firstDraftAfter(index: number): { number: number; boss: boolean } | null {
  for (let i = index + 1; i < FINAL_ROOM_INDEX; i++) {
    const boss = campaignBossType(i, this.rooms.definition(i)) !== null;
    if (shouldOfferEdge(i, boss)) return { number: i + 1, boss };
  }
  return null;
}
```

Declare `pendingDraft` on `Game` in this task:

```ts
pendingDraft: { room: number; offer: EdgeDefinition[] } | null = null;
```

- [ ] **Step 9.4: Run the tests to verify they pass**

```powershell
npx vitest run src/core/Game.progression-flow.test.ts src/core/Game.tutorial-flow.test.ts
```

Expected: PASS. Task 10 adds the draft-resolution assertions.

- [ ] **Step 9.5: Update the results test fixture so the suite type-checks**

Add the new fields to the default summary in `src/ui/screens/results.test.ts`:

```ts
run: { floor: 50, nextFloor: null, streak: 12, score: 12345, types: 3, stacks: 5, boosts: [], ended: true },
roomScore: 2340, isNewRoomBest: false, offer: [], nextRoom: null, nextEdge: null,
nextGoal: { kind: 'done', kicker: 'DONE', name: 'EVERYTHING UNLOCKED', detail: 'THE LEASE IS YOURS.', progress: 100, action: null },
ledgerNext: null, ledgerStars: 12, totalStars: 12,
dailyStreak: 0, dailyReplay: false, dailyRareEdgeGranted: false,
noSalvage: false, buildMaxed: false,
```

- [ ] **Step 9.6: Run the full unit suite**

```powershell
npm test
```

Expected: PASS (some UI copy assertions may still be old; fix only fixture/type failures here).

- [ ] **Step 9.7: Commit**

```powershell
git add src/core/Game.ts src/core/Game.progression-flow.test.ts src/core/Game.tutorial-flow.test.ts src/ui/screens/results.test.ts
git commit -m "feat: pay only cleared rooms and record room scores"
```

---

### Task 10: Persist and resolve the Edge draft

**Files:**
- Modify: `src/core/Game.ts`
- Modify: `src/core/Game.tutorial-flow.test.ts`
- Modify: `src/core/Game.progression-flow.test.ts`

- [ ] **Step 10.1: Write the failing lifecycle tests**

Add to the tutorial-flow harness after the room 1 clear:

```ts
expect(game.pendingDraft?.offer).toHaveLength(3);
expect(game.save.data.runOffer).toEqual(game.pendingDraft!.offer.map((edge) => edge.id));
await game.nextRoom();
expect(game.state).toBe('cleared');
expect(game.room.index).toBe(0);
const chosen = game.pendingDraft!.offer[0]!;
expect(game.chooseEdge(chosen.id)).toBe('');
expect(game.save.data.runBoosts).toContain(chosen.id);
expect(game.save.data.runOffer).toEqual([]);
expect(game.pendingDraft).toBeNull();
expect(game.chooseEdge(chosen.id)).toBe('NO EDGE OFFER');
await game.nextRoom();
expect(game.room.index).toBe(1);
```

Add a reload test:

```ts
it('auto-grants the first persisted offer on load', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.save.data.runActive = true;
  game.save.data.runFloor = 3;
  // sanitizeRun keeps a run only when its floor is reachable from unlocked/deepest progress.
  game.save.data.unlockedRoom = 3;
  game.save.data.deepest = 2;
  game.save.data.runOffer = ['quick_feet', 'heavy_hands'];
  game.save.write();

  const reloaded = new Game(fakeCanvas());
  vi.spyOn(reloaded.loop, 'start').mockImplementation(() => {});
  reloaded.start();
  expect(reloaded.save.data.runActive).toBe(true);
  expect(reloaded.save.data.runFloor).toBe(3);
  expect(reloaded.save.data.runBoosts).toContain('quick_feet');
  expect(reloaded.save.data.runOffer).toEqual([]);
});
```

Add tests for `HOME` skip, retry, and upgrades:

```ts
it('HOME forfeits the pending offer without ending the run', () => {
  // ...clear room 1, then:
  game.toMenu();
  expect(game.pendingDraft).toBeNull();
  expect(game.save.data.runOffer).toEqual([]);
  expect(game.save.data.runActive).toBe(true);
});

it('retryAfterFail restarts the same room with the build intact', async () => {
  // ...fail a campaign room, record the build and index, then:
  const build = [...game.save.data.runBoosts];
  const index = game.room.index;
  await game.retryAfterFail();
  expect(game.room.index).toBe(index);
  expect(game.save.data.runBoosts).toEqual(build);
  expect(game.state).toBe('playing');
});

it('buys a permanent upgrade and writes the save', () => {
  game.save.data.scrap = 1000;
  expect(game.buyUpgrade('door')).toBe('');
  expect(game.save.data.upgrades.door).toBe(1);
  expect(game.save.data.scrap).toBe(600);
  expect(game.buyUpgrade('nope' as never)).toBe('UNKNOWN UPGRADE');
});
```

- [ ] **Step 10.2: Run the tests and verify they fail**

```powershell
npx vitest run src/core/Game.tutorial-flow.test.ts src/core/Game.progression-flow.test.ts
```

Expected: FAIL — `chooseEdge`, `buyUpgrade`, auto-grant missing; `nextRoom` advances despite a pending draft.

- [ ] **Step 10.3: Implement the lifecycle**

- `chooseEdge(id: string): string`:
  ```ts
  const draft = this.pendingDraft;
  if (!draft) return 'NO EDGE OFFER';
  if (draft.room !== this.room.index) return 'EDGE OFFER EXPIRED';
  if (!draft.offer.some((edge) => edge.id === id)) return 'EDGE NOT OFFERED';
  if (!chooseEdge(this.save.data, id as EdgeId)) return 'EDGE MAXED';
  this.save.data.runOffer = [];
  this.pendingDraft = null;
  this.save.write();
  return '';
  ```
  Import the Run helper under an alias (`chooseEdge as takeEdge`) to avoid the name clash.
- `nextRoom()` first line: `if (this.pendingDraft) return;`.
- In `Game.start()`, run this immediately **after** `sanitizeRun(...)` and **before** the first-visit check. Move the existing `const save = this.save.data;` (currently just before the first-visit check) above this block; do not declare it twice:
  ```ts
  const save = this.save.data;
  if (save.runActive && save.runOffer.length > 0) {
    // Auto-resolve a draft interrupted by a reload. Take the first grantable card;
    // an all-capped offer is discarded rather than pinned forever.
    for (const id of save.runOffer) if (takeEdge(save, id)) break;
    save.runOffer = [];
    this.save.write();
  }
  ```
  This runs before the menu/room load and never opens a modal.
- Add `!save.runActive` to the first-visit condition so a failed room-1 run is not restarted from scratch:
  ```ts
  if (!save.runActive && save.roomsCleared === 0 && save.unlockedRoom === 0 && save.discoveries.length === 0) {
    this.playFrom(0);
  } else { ... }
  ```
- `playFrom`: set `this.pendingDraft = null`; `startRun` clears `runOffer`.
- `toMenu`: `this.pendingDraft = null; if (save.runOffer.length > 0) { save.runOffer = []; this.save.write(); }`.
- `abandonRun`: clear `pendingDraft`, call `endRun`, write, then `toMenu`. (`endRun` already clears `runOffer`.)
- `retryAfterFail`:
  ```ts
  if (this.waitingForAd) return;
  await this.ads.onRetryAfterFailure();
  this.scoreAtRoomStart = this.room.daily ? 0 : this.save.data.runScore;
  this.restartRoom();
  ```
  Remove the generated-room `endRun` branch and the `handcraftedCount` argument. `restartRoom()` must keep the build: it calls `enterRoom()` directly, not `playFrom()`.
- `buyUpgrade(id: UpgradeId): string` delegates to `Upgrades.buyUpgrade(save, id)`, writes on `''`, returns the reason otherwise.
- `petDamageMultiplier()` from Task 8 remains.

- [ ] **Step 10.4: Run the tests to verify they pass**

```powershell
npx vitest run src/core/Game.tutorial-flow.test.ts src/core/Game.progression-flow.test.ts
```

Expected: PASS.

- [ ] **Step 10.5: Commit**

```powershell
git add src/core/Game.ts src/core/Game.tutorial-flow.test.ts src/core/Game.progression-flow.test.ts
git commit -m "feat: persist and resolve edge drafts"
```

---

### Task 11: Results — draft, build, next teaser, run report

**Files:**
- Modify: `src/ui/screens/results.ts`
- Modify: `src/ui/screens/results.test.ts`
- Modify: `src/ui/UI.ts`

**`ResultsActions` addition:**

```ts
/** '' on success; otherwise the reason the pick could not be applied. */
chooseEdge(id: string): string;
```

**Visual rules:**
- A normal victory with `offer.length > 0` uses `.b2-report` **without** `b2-report--simple`, with `.b2-report__side` as the second grid child.
- A non-draft victory, final, and daily keep the simple single-column report.
- Failure keeps the incident report and adds the run report block.
- The first Edge card carries `data-autofocus`; the primary starts disabled.
- HOME while a draft is pending reads `HOME · SKIP EDGE` and needs a second tap. REPLAY while a run is active needs a second tap.
- Ledger claims produce a loud `STAR LEDGER` strip before the small print.

- [ ] **Step 11.1: Write the failing DOM tests**

Replace the old “no Edge cards” expectations and add:

```ts
import { EDGE_BY_ID, type EdgeId } from '../../gameplay/Edges';

const edge = (id: EdgeId) => EDGE_BY_ID[id];
const offer = [edge('heavy_hands'), edge('quick_feet'), edge('scrap_luck')];
const draft = summary({
  offer,
  run: { floor: 3, nextFloor: 4, streak: 2, score: 4200, types: 2, stacks: 3, boosts: ['heavy_hands'], ended: false },
  nextRoom: { number: 4, name: 'THE BATHROOM', boss: false },
  nextEdge: { number: 5, boss: false },
});

it('renders the draft, disables the primary, and focuses the first card', () => {
  document.body.append(buildResults(draft, actions()));
  const cards = [...document.querySelectorAll<HTMLButtonElement>('button.b2-edge')];
  expect(cards).toHaveLength(3);
  expect(cards[0]!.dataset.autofocus).toBe('true');
  const primary = document.querySelector<HTMLButtonElement>('.b2-results__action.primary')!;
  expect(primary.disabled).toBe(true);
  expect(primary.textContent).toContain('PICK AN EDGE');
});

it('takes an Edge, stamps it, and enables NEXT ROOM', () => {
  const acts = actions();
  document.body.append(buildResults(draft, acts));
  document.querySelector<HTMLButtonElement>('button.b2-edge')!.click();
  expect(acts.chooseEdge).toHaveBeenCalledWith('heavy_hands');
  const primary = document.querySelector<HTMLButtonElement>('.b2-results__action.primary')!;
  expect(primary.disabled).toBe(false);
  expect(primary.textContent).toContain('NEXT ROOM');
  expect(document.querySelector('.b2-edge.is-taken')).toBeTruthy();
  expect(document.querySelector('[aria-live="polite"]')!.textContent).toContain('NEXT ROOM UNLOCKED');
});

it('recovers from an expired offer without blocking NEXT ROOM', () => {
  const acts = actions();
  acts.chooseEdge.mockReturnValue('NO EDGE OFFER');
  document.body.append(buildResults(draft, acts));
  document.querySelector<HTMLButtonElement>('button.b2-edge')!.click();
  expect(document.querySelector('.b2-report__draftstatus')!.textContent).toContain('EDGE OFFER EXPIRED');
  const primary = document.querySelector<HTMLButtonElement>('.b2-results__action.primary')!;
  expect(primary.disabled).toBe(false);
  expect(primary.textContent).toContain('NEXT ROOM');
  expect(document.querySelector('.b2-edge.is-taken')).toBeNull();
});

it('requires a second tap to skip a pending Edge', () => {
  const acts = actions();
  document.body.append(buildResults(draft, acts));
  const home = [...document.querySelectorAll<HTMLButtonElement>('.b2-results__action')]
    .find((b) => b.textContent?.includes('HOME'))!;
  home.click();
  expect(acts.home).not.toHaveBeenCalled();
  expect(home.textContent).toContain('TAP AGAIN TO SKIP');
  home.click();
  expect(acts.home).toHaveBeenCalledOnce();
});

it('drops the skip confirmation after an Edge is taken', () => {
  const acts = actions();
  document.body.append(buildResults(draft, acts));
  document.querySelector<HTMLButtonElement>('button.b2-edge')!.click();
  const home = [...document.querySelectorAll<HTMLButtonElement>('.b2-results__action')]
    .find((b) => b.textContent?.includes('HOME'))!;
  expect(home.textContent).toContain('HOME');
  expect(home.textContent).not.toContain('SKIP');
  home.click();
  expect(acts.home).toHaveBeenCalledOnce();
});

it('arms REPLAY ROOM when a live run would be lost', () => {
  const acts = actions();
  document.body.append(buildResults(summary({
    offer: [],
    run: { floor: 8, nextFloor: 9, streak: 1, score: 3000, types: 1, stacks: 2, boosts: ['heavy_hands'], ended: false },
    nextRoom: { number: 9, name: 'THE KITCHEN', boss: false },
  }), acts));
  const replay = [...document.querySelectorAll<HTMLButtonElement>('.b2-results__action')]
    .find((b) => b.textContent?.includes('REPLAY'))!;
  replay.click();
  expect(acts.retry).not.toHaveBeenCalled();
  expect(replay.textContent).toContain('TAP AGAIN · NEW RUN');
  replay.click();
  expect(acts.retry).toHaveBeenCalledOnce();
});

it('shows the next Edge line on a non-draft victory', () => {
  document.body.append(buildResults(summary({
    offer: [],
    nextRoom: { number: 11, name: 'THE HALLWAY', boss: false },
    nextEdge: { number: 11, boss: false },
  }), actions()));
  expect(document.querySelectorAll('button.b2-edge')).toHaveLength(0);
  expect(document.querySelector('.b2-report__nextedge')!.textContent).toContain('NEXT EDGE · ROOM 11');
});

it('shows BUILD MAXED when no draft remains', () => {
  document.body.append(buildResults(summary({ offer: [], nextEdge: null, buildMaxed: true }), actions()));
  expect(document.body.textContent).toContain('BUILD MAXED');
});

it('reports failure with no salvage, kept Edges and the next goal', () => {
  document.body.append(buildResults(summary({
    cleared: false, score: 900, offer: [], noSalvage: true,
    run: { floor: 12, nextFloor: null, streak: 0, score: 5000, types: 2, stacks: 5, boosts: ['quick_feet', 'quick_feet', 'heavy_hands'], ended: false },
    nextGoal: { kind: 'ledger', kicker: 'NEXT STAR', name: 'SCRAP STIPEND', detail: '2 STARS TO GO · +100 SCRAP', progress: 33, action: 'ledger' },
  }), actions()));
  expect(document.body.textContent).toContain('NO SALVAGE');
  expect(document.body.textContent).toContain('EDGES KEPT · STREAK RESET');
  expect(document.body.textContent).toContain('NEXT STAR · SCRAP STIPEND');
  expect(document.body.textContent).toContain('RUN SCORE');
});

it('keeps a daily failure to practice notes without the campaign run report', () => {
  document.body.append(buildResults(summary({
    cleared: false, daily: true, score: 900, noSalvage: true,
    run: { floor: 7, nextFloor: null, streak: 3, score: 5000, types: 2, stacks: 3, boosts: [], ended: false },
  }), actions()));
  expect(document.body.textContent).toContain('NO SALVAGE');
  expect(document.body.textContent).toContain('PRACTICE · NO REWARD');
  expect(document.querySelector('.b2-report__runreport')).toBeNull();
  expect(document.body.textContent).not.toContain('RUN · FLOOR');
});

it('puts a loud STAR LEDGER strip before the notes', () => {
  document.body.append(buildResults(summary({
    ledgerClaims: [{ id: 'scrap_3', stars: 3, name: 'SCRAP STIPEND', reward: '+100 scrap', scrap: 100 }],
  }), actions()));
  const strip = document.querySelector('.b2-report__ledger')!;
  expect(strip.textContent).toContain('STAR LEDGER');
  expect(strip.textContent).toContain('+100 scrap');
});

it('uses DONE for a daily and shows practice on a replay', () => {
  document.body.append(buildResults(summary({
    daily: true, dailyReplay: true, dailyStreak: 3, dailyBonus: 0,
  }), actions()));
  expect(document.body.textContent).toContain('PRACTICE · NO REWARD');
  expect(document.querySelector('.b2-results__action.primary')!.textContent).toContain('DONE');
});
```

`actions()` gains `chooseEdge: vi.fn(() => '')`. Drop the `: ResultsActions` return annotation so TypeScript infers the mock types — otherwise `acts.chooseEdge.mockReturnValue(...)` in the expired-offer test fails type-checking. The object is still assignable to `ResultsActions`. The default summary fixture gains all Task 9 fields.

- [ ] **Step 11.2: Run the tests and verify they fail**

```powershell
npx vitest run src/ui/screens/results.test.ts
```

Expected: FAIL — no Edge buttons, primary always enabled, no run report.

- [ ] **Step 11.3: Implement the results screen**

Helpers:

```ts
function runChip(summary: RoomSummary): HTMLElement {
  const text = summary.finale
    ? 'RUN COMPLETE · 50 FLOORS'
    : `RUN · FLOOR ${summary.run.floor} · STREAK ${summary.run.streak}`;
  return el('span', 'b2-chip b2-report__run', text);
}

function edgeStackLabel(owned: number): string {
  return owned === 0 ? 'NEW' : `OWNED ×${owned} → ×${owned + 1}`;
}
```

Draft side (the primary is built first so the panel can unlock it):

```ts
function buildDraftSide(
  summary: RoomSummary,
  actions: ResultsActions,
  primary: HTMLButtonElement,
  onTaken: () => void,
): HTMLElement {
  const side = el('div', 'b2-report__side');
  const edges = el('section', 'b2-report__edges');
  edges.append(el('h3', 'b2-label', 'TAKE AN EDGE'));
  const grid = el('div', 'b2-report__edgegrid');
  const cards: HTMLButtonElement[] = [];
  const status = el('p', 'b2-report__draftstatus', 'PICK ONE. THE RUN KEEPS IT.');
  status.setAttribute('aria-live', 'polite');
  for (const [index, edge] of summary.offer.entries()) {
    const owned = summary.run.boosts.filter((id) => id === edge.id).length;
    const card = el('button', `b2-edge b2-edge--${edge.category} b2-edge--${edge.rarity}`);
    card.type = 'button';
    card.dataset.edge = edge.id;
    if (index === 0) card.dataset.autofocus = 'true';
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', `${edge.name}, ${edge.rarity}, ${edge.effect}, ${edgeStackLabel(owned)}`);
    const top = el('span', 'b2-edge__top');
    top.append(
      el('span', 'b2-edge__kicker', edge.category.toUpperCase()),
      el('span', 'b2-edge__rarity', edge.rarity),
    );
    card.append(
      top,
      el('strong', 'b2-edge__name', edge.name),
      el('span', 'b2-edge__effect', edge.effect),
      el('span', 'b2-edge__flavor', edge.flavor),
      el('span', 'b2-edge__stack', edgeStackLabel(owned)),
    );
    card.addEventListener('click', () => {
      if (cards.some((c) => c.getAttribute('aria-pressed') === 'true')) return;
      const reason = actions.chooseEdge(edge.id);
      if (reason) {
        for (const other of cards) {
          other.disabled = true;
          other.setAttribute('aria-disabled', 'true');
        }
        status.textContent = reason === 'EDGE OFFER EXPIRED'
          ? 'EDGE OFFER EXPIRED · NEXT ROOM UNLOCKED.'
          : `EDGE OFFER EXPIRED · ${reason}`;
        primary.disabled = false;
        primary.querySelector('.b2-results__actionlabel')!.textContent = 'NEXT ROOM';
        onTaken();
        primary.focus();
        return;
      }
      card.setAttribute('aria-pressed', 'true');
      card.classList.add('is-taken');
      card.append(el('span', 'b2-edge__stamp', 'TAKEN'));
      for (const other of cards) {
        other.disabled = true;
        other.setAttribute('aria-disabled', 'true');
      }
      status.textContent = `${edge.name} TAKEN · NEXT ROOM UNLOCKED.`;
      primary.disabled = false;
      primary.querySelector('.b2-results__actionlabel')!.textContent = 'NEXT ROOM';
      onTaken();
      primary.focus();
    });
    cards.push(card);
    grid.append(card);
  }
  edges.append(grid, status);
  side.append(edges);
  side.append(buildBuildList(summary));
  if (summary.nextRoom) side.append(buildNextTeaser(summary.nextRoom));
  return side;
}
```

In `buildVictory`, create the primary before the body **only for a normal victory** (daily keeps its single `DONE` button; the finale keeps `REPLAY ROOM` / `HOME`):

```ts
const primary = summary.daily || summary.finale
  ? null
  : actionButton('NEXT ROOM', 'lime', actions.next, true);
if (primary) {
  chevron(primary);
  if (summary.offer.length > 0) {
    primary.disabled = true;
    primary.querySelector('.b2-results__actionlabel')!.textContent = 'PICK AN EDGE';
  }
}

const home = summary.offer.length > 0
  ? actionButton('HOME · SKIP EDGE', 'lavender', () => {})
  : actionButton('HOME', 'lavender', actions.home);
const skip = summary.offer.length > 0
  ? confirmAction(home, 'TAP AGAIN TO SKIP', 'HOME', actions.home)
  : null;

let replay: HTMLButtonElement | null = null;
if (!summary.daily) {
  const armedReplay = summary.run.boosts.length > 0 && !summary.run.ended;
  replay = armedReplay
    ? actionButton('REPLAY ROOM', 'blue', () => {})
    : actionButton('REPLAY ROOM', 'blue', actions.retry);
  if (armedReplay) confirmAction(replay, 'TAP AGAIN · NEW RUN', 'REPLAY ROOM', actions.retry);
}

const side = primary && summary.offer.length > 0
  ? buildDraftSide(summary, actions, primary, () => skip?.disarm())
  : null;
```

Then append `primary`, `replay`, and `home` to the actions row instead of creating them a second time. `buildDraftSide` can assume `primary` is non-null. The primary is only present on a normal victory, so the daily `DONE` and finale buttons stay exactly as they are.

`buildBuildList`: `YOUR BUILD`, up to four lines `${name} ×${stacks}`; `+N MORE`; empty `NO EDGES YET.` Resolve names via `EDGE_BY_ID`.

`buildNextTeaser`: `.b2-report__next.is-new`, kicker `NEXT`, `ROOM ${number} · ${name.toUpperCase()}`, `BOSS` tag when relevant.

Shared action helper for two-tap:

```ts
interface ConfirmHandle {
  /** Reverts to the original label and makes the next click non-destructive. */
  disarm(): void;
}

function confirmAction(
  button: HTMLButtonElement,
  confirmLabel: string,
  resetLabel: string,
  run: () => void,
): ConfirmHandle {
  let armed = false;
  let requireConfirm = true;
  const label = button.querySelector<HTMLElement>('.b2-results__actionlabel')!;
  button.addEventListener('click', () => {
    if (requireConfirm && !armed) {
      armed = true;
      label.textContent = confirmLabel;
      return;
    }
    run();
  });
  return {
    disarm() {
      requireConfirm = false;
      armed = false;
      label.textContent = resetLabel;
    },
  };
}
```

Use `HOME · SKIP EDGE` → `TAP AGAIN TO SKIP`; REPLAY ROOM → `TAP AGAIN · NEW RUN` when `summary.run.boosts.length > 0 && !summary.run.ended` (a final victory has no live run to lose, so its replay is one tap).

When a button needs confirmation, create it with a no-op click (`actionButton('HOME · SKIP EDGE', 'lavender', () => {})`) and attach `confirmAction(...)`. Do **not** also pass the real action to `actionButton`; otherwise the first tap fires the action before the confirmation. Taking an Edge (or discovering a stale offer) calls `skip?.disarm()`, so HOME immediately becomes a one-tap `HOME` once the draft is resolved.

Victory composition:

- Add `runChip` to meta when not daily.
- Big score uses `summary.score` for a daily and `summary.run.score` for a normal or final victory; the small line is `THIS ROOM +${formatScore(summary.roomScore)}`.
- If `summary.isNewRoomBest`, note `NEW ROOM BEST`.
- If `summary.offer.length > 0`: panel classes `b2-panel b2-report b2-report--draft` (remove `b2-report--simple`), body gets `meta`, `hero`, `side`, `marks` (in that DOM order; CSS reorders mobile).
- Else: `body.append(meta, hero, marks)` and a `.b2-report__nextedge` strip at the bottom when not final/daily. The strip carries `NEXT EDGE · ROOM N`, `NEXT EDGE · BOSS`, or `BUILD MAXED`.
- Final adds the `50 FLOORS · ${summary.run.types} TYPES · ${summary.run.stacks} STACKS · ${formatScore(summary.run.score)} RUN SCORE` line.
- Daily adds `DAILY STREAK` `${dailyStreak} DAYS`, `DAILY BONUS +N SCRAP`, `LEGENDARY EDGE UNLOCKED`, or `PRACTICE · NO REWARD`.
- Ledger claims: build `.b2-report__ledger` before `notes`, with `STAR LEDGER` and each `${name} · ${reward}`. Remove the old per-claim `noteLine('LEDGER', ...)` loop; do not show both.

Failure composition:

- Add `runChip` when not daily.
- After fields, append `.b2-report__runreport` only when not daily:
  - `RUN SCORE` `${formatScore(summary.run.score)}`
  - `EDGES` `${summary.run.types} TYPES · ${summary.run.stacks} STACKS` plus up to three build lines
  - `NEXT GOAL` `${nextGoal.kicker} · ${nextGoal.name}`
  - `.b2-report__nosalvage` `NO SALVAGE` + `THE FAILED ROOM PAID NOTHING.`
- A daily failure omits the run chip and the run report (the campaign run is untouched). Show only `.b2-report__nosalvage` with `NO SALVAGE` and `PRACTICE · NO REWARD.` so the daily still explains the zero payout.
- Run note: `EDGES KEPT · STREAK RESET` unless `summary.run.ended`, then `RUN ENDED · EDGES LOST`. Omit the run note for a daily.
- Actions stay RETRY / CONTINUE (if available) / HOME.

- [ ] **Step 11.4: Wire UI focus and chooseEdge**

- In `UI.showSummary`, pass `chooseEdge: (id) => game.chooseEdge(id)`.
- In `UI.show`, focus:
  ```ts
  const target = screen.querySelector<HTMLButtonElement>('[data-autofocus]')
    ?? screen.querySelector<HTMLButtonElement>('button.primary:not(:disabled)');
  target?.focus({ preventScroll: true });
  ```

- [ ] **Step 11.5: Run the results and Game tests**

```powershell
npx vitest run src/ui/screens/results.test.ts src/core/Game.tutorial-flow.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 11.6: Commit**

```powershell
git add src/ui/screens/results.ts src/ui/screens/results.test.ts src/ui/UI.ts
git commit -m "feat: build the results draft and run report"
```

---

### Task 12: The real store, shared ability cards, and settings cleanup

**Files:**
- Create: `src/ui/screens/shopCards.ts`
- Create: `src/ui/screens/shopCards.test.ts`
- Create: `src/ui/screens/store.ts`
- Create: `src/ui/screens/store.test.ts`
- Create: `src/ui/screens/settings.test.ts`
- Modify: `src/ui/screens/pause.ts`
- Modify: `src/ui/screens/settings.ts`
- Modify: `src/ui/screens/lobby.ts`
- Modify: `src/ui/screens/lobby.test.ts`
- Modify: `src/ui/UI.ts`

**Interfaces:**

```ts
// shopCards.ts — one ability card, used by both pause and store.
export interface AbilityCardOptions {
  /** Touch shows POWER instead of the keyboard key. */
  readonly touch: boolean;
  readonly owned: boolean;
  /** '' on success, otherwise the reason the purchase failed. */
  readonly buy: (id: AbilityId) => string;
  /** Called after a successful purchase so the host can refresh its wallet/goal. */
  readonly onBought?: (id: AbilityId) => void;
}
export function buildAbilityCard(def: AbilityDefinition, options: AbilityCardOptions): HTMLElement;

// store.ts
export interface StoreActions {
  /** '' on success, otherwise the reason. */
  buyUpgrade(id: UpgradeId): string;
  /** '' on success, otherwise the reason. */
  buyAbility(id: AbilityId): string;
  back(): void;
}
export function buildStore(game: Game, actions: StoreActions): HTMLElement;

// lobby.ts — final menu shape; STORE and SETTINGS are their own screens.
export interface MenuActions {
  play(roomIndex: number): void;
  /** Picks up the saved run at `runFloor`. Wired now; the lobby button uses it in Task 15. */
  continueRun(): void;
  /** Starts today's daily room. Wired now; the lobby chip uses it in Task 15. */
  daily(): void;
  store(): void;
  settings(): void;
  hero(id: HeroId): void;
}

// UI.ts
private showStore(): void;
```

**Store composition:**

- `<section class="b2-panel b2-store">` inside `screen store b2-stage b2-stage--navy`.
- Head: `THE STORE`, `SALVAGE IN. PERMANENT POWER OUT.`, a coin chip with `${scrap} SCRAP` (`.b2-store__wallet`), and a `BACK` button.
- If `save.runActive`, a note: `YOUR RUN IS SAVED. UPGRADES APPLY WHEN YOU CONTINUE.`
- Tabs `HOME UPGRADES` / `POWERS` using `class="b2-tabs b2-store__tabs"`, arrow-key behavior copied from settings.
- `NEXT UNLOCK` strip `.b2-store__goal`, built from `nextUnlock(save, totalStars(save.roomStars))`:
  - kicker, name, detail, `.b2-meter` fill at `goal.progress`;
  - secondary chip `STAR LEDGER · ${ledgerStars} / 27 · ${ledgerNext?.name ?? 'COMPLETE'}`. It is a static chip, not a button.
- Upgrades pane (`.b2-store__upgrades`): five `.b2-shop-card.b2-upgrade` cards in catalog order. Each card carries `data-upgrade="<id>"`.
- Powers pane (`.b2-store__powers`): `ABILITIES.map((def) => buildAbilityCard(def, { touch: false, owned, buy, onBought }))`, laid out with the store's own grid (do not reuse the pause grid class).
- Purchases update in place; never rebuild the screen.

**Upgrade card content:**

- icon wrap (`key`, `coin`, `power-dash`, `trophy`, and a pet icon);
- name and pips: `'●'.repeat(level) + '○'.repeat(max - level)`, `aria-label="${level} of ${max} levels"`;
- current effect from `upgradeEffect`;
- `NEXT: ${nextUpgradeEffect}` or `ALL TIERS BOUGHT`;
- coin cost + `BUY`, or a `MAXED` stamp;
- `BUY` disabled with `NEEDS ${cost} SCRAP` when unaffordable;
- `data-level` refreshed after purchase.

**Pet icon rule:** `tenant → pet-dachshund`, `flatmate → pet-ginger`, `gran → pet-parrot`, `kid → pet-hamster` (Waffle is the dachshund, Biscuit the ginger cat, Captain the parrot, Nugget the hamster). Import the four existing `pet-*.png` files; no new art.

- [ ] **Step 12.1: Write the failing shared-card test**

Create `src/ui/screens/shopCards.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { ABILITIES } from '../../gameplay/Abilities';
import { buildAbilityCard } from './shopCards';

const blast = ABILITIES.find((a) => a.id === 'blast')!;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('shows cost and buys through the callback', () => {
  const buy = vi.fn(() => '');
  const onBought = vi.fn();
  document.body.append(buildAbilityCard(blast, { touch: false, owned: false, buy, onBought }));
  const button = document.querySelector<HTMLButtonElement>('.b2-shop-card__buy')!;
  expect(button.textContent).toBe('BUY');
  button.click();
  expect(buy).toHaveBeenCalledWith('blast');
  expect(onBought).toHaveBeenCalledWith('blast');
  expect(document.querySelector('.b2-shop-card__owned')?.textContent).toBe('OWNED');
  expect(document.querySelector<HTMLButtonElement>('.b2-shop-card__buy')).toBeNull();
});

it('shows a failure reason, then recovers', () => {
  vi.useFakeTimers();
  document.body.append(buildAbilityCard(blast, { touch: true, owned: false, buy: () => 'NEEDS 150 SCRAP' }));
  const button = document.querySelector<HTMLButtonElement>('.b2-shop-card__buy')!;
  button.click();
  expect(button.textContent).toBe('NEEDS 150 SCRAP');
  expect(button.disabled).toBe(true);
  vi.advanceTimersByTime(1200);
  expect(button.textContent).toBe('BUY');
  expect(button.disabled).toBe(false);
  expect(document.querySelector('.b2-shop-card__key')!.textContent).toBe('POWER');
  vi.useRealTimers();
});

it('renders an owned card without a buy button', () => {
  document.body.append(buildAbilityCard(blast, { touch: false, owned: true, buy: () => '' }));
  expect(document.querySelector('.b2-shop-card__owned')).toBeTruthy();
  expect(document.querySelector('.b2-shop-card__buy')).toBeNull();
});
```

- [ ] **Step 12.2: Run it and verify it fails**

```powershell
npx vitest run src/ui/screens/shopCards.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 12.3: Extract `shopCards.ts` and use it in pause**

- Move the per-ability card construction and the `ABILITY_ICONS` map out of `pause.ts` into `shopCards.ts`.
- Keep the existing classes and accessible labels exactly: `Buy ${name} for ${cost} scrap: ${blurb}`.
- On success the card replaces the buy row with `OWNED` and calls `onBought`; on failure it shows the reason for 1100 ms.
- `pause.ts` keeps its scrap chip, title, grid, and lesson fold; only the card body moves. Pass `onBought: () => { scrapValue.textContent = String(game.save.data.scrap); }` so the pause wallet stays live.
- The store passes `touch: false`; the pause passes `game.input.touch`.

- [ ] **Step 12.4: Write the failing store test**

Create `src/ui/screens/store.test.ts`. Build a `Game` with the tutorial-flow fake canvas helper, start it with `loop.start` mocked, then call `buildStore`:

```ts
// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../../core/Game';
import { buildStore } from './store';
// Copy `fakeCanvas()` and `stub2d()` from `Game.tutorial-flow.test.ts`.

function store(game: Game, overrides: Partial<Parameters<typeof buildStore>[1]> = {}) {
  return buildStore(game, {
    buyUpgrade: (id) => game.buyUpgrade(id),
    buyAbility: (id) => game.buyAbility(id),
    back: vi.fn(),
    ...overrides,
  });
}

function boot(): Game {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  return game;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('shows the wallet, five upgrade tracks, and the next unlock', () => {
  const game = boot();
  game.save.data.scrap = 300;
  document.body.append(store(game));
  expect(document.querySelectorAll('[data-upgrade]')).toHaveLength(5);
  expect(document.querySelector('.b2-store__wallet')!.textContent).toContain('300');
  expect(document.querySelector('.b2-store__goal')!.textContent).toContain('READY TO BUY');
  expect(document.querySelector('[data-upgrade="door"]')!.textContent).toContain('NEEDS 400 SCRAP');
});

it('buys in place and updates pips, effect, wallet, and goal', () => {
  const game = boot();
  game.save.data.scrap = 1000;
  document.body.append(store(game));
  const card = document.querySelector<HTMLElement>('[data-upgrade="scrap"]')!;
  const button = card.querySelector<HTMLButtonElement>('.b2-shop-card__buy')!;
  button.click();
  expect(game.save.data.upgrades.scrap).toBe(1);
  expect(game.save.data.scrap).toBe(800);
  expect(card.dataset.level).toBe('1');
  expect(card.querySelector('.b2-upgrade__pips')!.textContent).toBe('●○○○');
  expect(card.textContent).toContain('+10% SCRAP FROM INTRUDERS');
  expect(card.textContent).toContain('NEXT: +10% SCRAP');
  expect(document.querySelector('.b2-store__wallet')!.textContent).toContain('800');
});

it('shows MAXED and no buy button at the cap', () => {
  const game = boot();
  game.save.data.scrap = 10000;
  game.save.data.upgrades.door = 2;
  document.body.append(store(game));
  const card = document.querySelector<HTMLElement>('[data-upgrade="door"]')!;
  expect(card.querySelector('.b2-shop-card__buy')).toBeNull();
  expect(card.textContent).toContain('MAXED');
  expect(card.textContent).toContain('7 MAX HEARTS');
});

it('switches to the powers tab and buys an ability', () => {
  const game = boot();
  game.save.data.scrap = 500;
  document.body.append(store(game));
  const powers = [...document.querySelectorAll<HTMLButtonElement>('.b2-tab')]
    .find((tab) => tab.textContent === 'POWERS')!;
  powers.click();
  expect(document.querySelectorAll('.b2-store__powers .b2-shop-card')).toHaveLength(3);
  const card = [...document.querySelectorAll<HTMLElement>('.b2-store__powers .b2-shop-card')]
    .find((node) => node.textContent!.includes('BIG RED BUTTON'))!;
  card.querySelector<HTMLButtonElement>('.b2-shop-card__buy')!.click();
  expect(game.save.data.abilities).toContain('blast');
  expect(game.save.data.scrap).toBe(350);
});

it('warns that upgrades apply when the run continues', () => {
  const game = boot();
  game.save.data.runActive = true;
  document.body.append(store(game));
  expect(document.body.textContent).toContain('YOUR RUN IS SAVED. UPGRADES APPLY WHEN YOU CONTINUE.');
});
```

- [ ] **Step 12.5: Run it and verify it fails**

```powershell
npx vitest run src/ui/screens/store.test.ts
```

Expected: FAIL — `store.ts` missing.

- [ ] **Step 12.6: Implement `store.ts`**

Implementation notes:

- Import `ABILITIES` from `../../gameplay/Abilities` and `buildAbilityCard` from `./shopCards`; do not import `ABILITY_ICONS` here (it lives in `shopCards.ts`).
- Import `UPGRADES`, `isUpgradeMaxed`, `nextUpgradeCost`, `nextUpgradeEffect`, `upgradeEffect`, `upgradeLevel` from `../../gameplay/Upgrades`; do not import `buyUpgrade` (purchases go through `actions.buyUpgrade`). The multiplier helpers are **not** needed here.
- Import `nextUnlock` from `../../gameplay/Progression`; import `LEDGER` from `../../gameplay/StarLedger` and `totalStars` from `../../gameplay/Campaign`.
- Build the goal strip once, then expose a local `refreshGoal()` that replaces the strip’s text and meter from `nextUnlock(...)` after each purchase.
- `buy` handlers call the action, and on `''`:
  - update the card in place;
  - update wallet text and `aria-label`;
  - `refreshGoal()`;
  - `game.audio.play('stamp', 1)`;
  - add `is-bought`, remove it after 700 ms.
- At the cap, replace the buy row with `<span class="b2-shop-card__owned">MAXED</span>`.
- Tabs use `aria-selected` and arrow keys exactly like the settings tabs.
- `BACK` calls `actions.back()`.
- Never call `game.save.write()` here: `Game.buyUpgrade`/`Game.buyAbility` already write.

- [ ] **Step 12.7: Remove the static shop and wire the store route**

- `settings.ts`: delete `SHOP`, the `ShopCard` interface, the shop tab/pane, the `initialTab` parameter, and the six now-unused icon imports. Signature becomes `buildSettings(game, onBack)`. The panel title stays `ADJUST THE CHAOS`.
- `UI.ts`:
  - import `buildStore`;
  - `showMenu` passes the full final action set so the interface never goes type-red:
    ```ts
    play: (index) => { ... },
    continueRun: () => { this.hud.reset(); goFullscreenOnPhones(game); game.continueRun(); },
    daily: () => { this.hud.reset(); goFullscreenOnPhones(game); game.playDaily(); },
    store: () => this.showStore(),
    settings: () => this.show(buildSettings(game, () => this.showMenu())),
    hero: (id) => game.setHero(id),
    ```
  - `showPause` settings call drops the second argument;
  - `showStore()` renders `buildStore(game, { buyUpgrade: (id) => game.buyUpgrade(id), buyAbility: (id) => game.buyAbility(id), back: () => this.showMenu() })`.
- `lobby.ts`: `Settings` nav uses `actions.settings()`, `STORE` nav uses `actions.store()`. The STORE nav no longer opens the sheet.
- `lobby.test.ts`: extend the existing `menuFor` action mock to the final shape (`play() {}, continueRun() {}, daily() {}, store() {}, settings() {}, hero() {}`) so the new `MenuActions` type-checks; behavior tests are added in Task 15.

- [ ] **Step 12.8: Write the settings regression test**

Create `src/ui/screens/settings.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../../core/Game';
import { buildSettings } from './settings';
// Copy `fakeCanvas()` and `stub2d()` from `Game.tutorial-flow.test.ts`.

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('has one settings pane and no static shop', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  document.body.append(buildSettings(game, vi.fn()));
  expect([...document.querySelectorAll('.b2-tab')].map((t) => t.textContent)).toEqual(['SETTINGS']);
  expect(document.body.textContent).not.toContain('SOON');
  expect(document.body.textContent).not.toContain('THE STORE IS RESTOCKING');
  expect(document.body.textContent).toContain('ADJUST THE CHAOS');
});
```

- [ ] **Step 12.9: Run the focused tests and typecheck**

```powershell
npx vitest run src/ui/screens/shopCards.test.ts src/ui/screens/store.test.ts src/ui/screens/settings.test.ts src/ui/screens/lobby.test.ts
npm run typecheck
```

Expected: PASS. Fix any call sites the signature change exposed.

- [ ] **Step 12.10: Commit**

```powershell
git add src/ui/screens/shopCards.ts src/ui/screens/shopCards.test.ts src/ui/screens/store.ts src/ui/screens/store.test.ts src/ui/screens/settings.test.ts src/ui/screens/settings.ts src/ui/screens/pause.ts src/ui/screens/lobby.ts src/ui/UI.ts
git commit -m "feat: open the real store and share ability cards"
```

---

### Task 13: The Star Ledger screen

**Files:**
- Create: `src/ui/screens/ledger.ts`
- Create: `src/ui/screens/ledger.test.ts`

**Interface:**

```ts
export function buildLedgerPane(game: Game): HTMLElement;
```

- [ ] **Step 13.1: Write the failing test**

Create `src/ui/screens/ledger.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../../core/Game';
import { buildLedgerPane } from './ledger';
// Copy `fakeCanvas()` and `stub2d()` from `Game.tutorial-flow.test.ts`.

function boot(): Game {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  return game;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('shows the 27-star track, the 150-star completion line, and the next reward', () => {
  const game = boot();
  game.save.data.roomStars = { 'room-1': 3, 'room-2': 3, 'room-3': 3, 'room-4': 3 };
  game.save.data.starRewardsClaimed = ['scrap_3', 'score_6', 'edge_9', 'scrap_12'];
  document.body.append(buildLedgerPane(game));
  expect(document.querySelector('.b2-ledger__title')!.textContent).toBe('STAR LEDGER');
  expect(document.querySelector('.b2-ledger__count')!.textContent).toBe('12 / 27');
  expect(document.querySelector('.b2-ledger__campaign')!.textContent).toContain('12 / 150');
  expect(document.querySelector('.b2-ledger__next')!.textContent).toContain('15★');
  expect(document.querySelector('.b2-ledger__next')!.textContent).toContain('SALVAGE RIGHTS');
  expect(document.querySelector('.b2-ledger__next')!.textContent).toContain('3 STARS TO GO');
});

it('marks paid, next, and locked rows', () => {
  const game = boot();
  game.save.data.roomStars = { 'room-1': 3, 'room-2': 3, 'room-3': 3, 'room-4': 3 };
  game.save.data.starRewardsClaimed = ['scrap_3', 'score_6', 'edge_9', 'scrap_12'];
  document.body.append(buildLedgerPane(game));
  const rows = [...document.querySelectorAll<HTMLElement>('.b2-ledger__row')];
  expect(rows).toHaveLength(9);
  expect(rows[0]!.dataset.status).toBe('paid');
  expect(rows[4]!.dataset.status).toBe('next');
  expect(rows[2]!.dataset.status).toBe('paid');
  expect(rows[3]!.dataset.status).toBe('paid');
  expect(rows[5]!.dataset.status).toBe('locked');
  expect(rows[4]!.textContent).toContain('SALVAGE RIGHTS');
});

it('celebrates a finished ledger without a claim button', () => {
  const game = boot();
  game.save.data.roomStars = Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [`room-${i + 1}`, 3]),
  );
  game.save.data.starRewardsClaimed = [
    'scrap_3', 'score_6', 'edge_9', 'scrap_12', 'scrap_15',
    'edge_18', 'scrap_21', 'cooldown_24', 'master_key',
  ];
  document.body.append(buildLedgerPane(game));
  expect(document.body.textContent).toContain('ALL LEDGER REWARDS CLAIMED. THE LEASE IS YOURS.');
  expect(document.body.textContent).toContain('27 / 27');
  expect(document.querySelectorAll('button')).toHaveLength(0);
  expect(document.querySelector('.b2-ledger__next')).toBeNull();
});
```

Use the real milestone ids from `StarLedger.ts` for the claimed list; the ones above must match the catalog exactly.

- [ ] **Step 13.2: Run it and verify it fails**

```powershell
npx vitest run src/ui/screens/ledger.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 13.3: Implement `buildLedgerPane`**

- Head: `h3.b2-ledger__title` `STAR LEDGER`; `span.b2-ledger__count` `${ledgerStars} / 27`; a `.b2-meter` with `aria-valuenow` = `Math.round(100 * ledgerStars / 27)`.
- Campaign line: `span.b2-ledger__campaign` `CAMPAIGN STARS · ${totalStars} / 150`, with a thin `.b2-meter.b2-meter--thin` at `Math.round(100 * totalStars / 150)`.
- Next strip `.b2-ledger__next`: `${milestone.stars}★ · ${milestone.name} · ${milestone.reward.toUpperCase()} · ${remaining} STARS TO GO`.
- Rows `.b2-ledger__row[data-status]` in `LEDGER` order:
  - `.b2-ledger__stars` `${milestone.stars}★`;
  - `.b2-ledger__name` name;
  - `.b2-ledger__reward` reward;
  - `.b2-ledger__status`: `PAID`, `NEXT`, `LOCKED`.
- `paid` = `starRewardsClaimed.includes(id)`; `next` = first unclaimed; everything after is `locked`.
- If no unclaimed row: append `.b2-ledger__done` `ALL LEDGER REWARDS CLAIMED. THE LEASE IS YOURS.` and omit the next strip.
- Footnote exactly: `Stars come from clearing rooms, bonus objectives, and style. Rewards are paid automatically at the results desk.`
- No buttons and no mutation path. Do not import `Game` beyond its type; accept `game: Game` for the save and call nothing on it.

- [ ] **Step 13.4: Run the test to verify it passes**

```powershell
npx vitest run src/ui/screens/ledger.test.ts
```

Expected: PASS.

- [ ] **Step 13.5: Commit**

```powershell
git add src/ui/screens/ledger.ts src/ui/screens/ledger.test.ts
git commit -m "feat: add the star ledger screen"
```

---

### Task 14: The Evidence Board

**Files:**
- Create: `src/ui/screens/evidence.ts`
- Create: `src/ui/screens/evidence.test.ts`

**Interfaces:**

```ts
export type DiscoveryFilter = 'all' | DiscoveryDefinition['group'];
export function buildEvidencePane(game: Game): HTMLElement;
```

**Filter order:** `all`, `impact`, `electric`, `fire`, `floor`, `air`, `gadget`, `style`.

- [ ] **Step 14.1: Write the failing test**

Create `src/ui/screens/evidence.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../../core/Game';
import { DISCOVERIES } from '../../gameplay/Discoveries';
import { buildEvidencePane } from './evidence';
// Copy `fakeCanvas()` and `stub2d()` from `Game.tutorial-flow.test.ts`.

function boot(): Game {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  return game;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('shows the completable count and all 166 clues', () => {
  const game = boot();
  game.save.data.discoveries = ['blunt_force', 'billiards'];
  document.body.append(buildEvidencePane(game));
  expect(document.querySelector('.b2-evidence__count')!.textContent).toBe('2 / 166');
  expect(document.querySelectorAll('.b2-evidence__card')).toHaveLength(166);
  expect(document.querySelectorAll('.b2-evidence__card.is-found')).toHaveLength(2);
});

it('shows a missing recipe as a dimmed clue', () => {
  const game = boot();
  document.body.append(buildEvidencePane(game));
  const card = document.querySelector<HTMLElement>('[data-discovery="billiards"]')!;
  expect(card.classList.contains('is-found')).toBe(false);
  expect(card.querySelector('.b2-evidence__name')!.textContent).toBe('???');
  expect(card.textContent).toContain('HEAVY THING');
  expect(card.getAttribute('aria-label')).toContain('locked');
  expect(card.querySelector('.b2-evidence__lock')).toBeTruthy();
});

it('shows a found card with its title, recipe, and FILED stamp', () => {
  const game = boot();
  game.save.data.discoveries = ['billiards'];
  document.body.append(buildEvidencePane(game));
  const card = document.querySelector<HTMLElement>('[data-discovery="billiards"]')!;
  expect(card.classList.contains('is-found')).toBe(true);
  expect(card.querySelector('.b2-evidence__name')!.textContent).toBe('BILLIARDS');
  expect(card.querySelector('.b2-evidence__stamp')!.textContent).toBe('FILED');
});

it('filters the grid and keeps the head still', () => {
  const game = boot();
  game.save.data.discoveries = ['blunt_force', 'exposed_wire'];
  document.body.append(buildEvidencePane(game));
  const head = document.querySelector('.b2-evidence__head');
  const electric = [...document.querySelectorAll<HTMLButtonElement>('.b2-evidence__filter')]
    .find((b) => b.textContent!.startsWith('ELECTRIC'))!;
  electric.click();
  expect(electric.getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector('.b2-evidence__head')).toBe(head);
  expect(document.querySelectorAll('.b2-evidence__card')).toHaveLength(
    DISCOVERIES.filter((d) => d.group === 'electric').length,
  );
});

it('keeps missing recipes visible under every filter', () => {
  const game = boot();
  document.body.append(buildEvidencePane(game));
  const impact = [...document.querySelectorAll<HTMLButtonElement>('.b2-evidence__filter')]
    .find((b) => b.textContent!.startsWith('IMPACT'))!;
  impact.click();
  const expected = DISCOVERIES.filter((d) => d.group === 'impact').length;
  expect(document.querySelectorAll('.b2-evidence__card')).toHaveLength(expected);
  expect(document.querySelectorAll('.b2-evidence__card.is-missing')).toHaveLength(expected);
  expect(document.querySelector('.b2-evidence__empty')).toBeNull();
});
```

Choose the real electric discovery id `exposed_wire` for the filter test; verify ids in `Discoveries.ts` before committing the test.

- [ ] **Step 14.2: Run it and verify it fails**

```powershell
npx vitest run src/ui/screens/evidence.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 14.3: Implement `buildEvidencePane`**

- Head `.b2-evidence__head`:
  - `h3.b2-evidence__title` `THE EVIDENCE BOARD`;
  - `.b2-evidence__count` `${found} / ${DISCOVERIES.length}`;
  - `.b2-meter` with `aria-valuenow` = `Math.round(100 * found / DISCOVERIES.length)`.
- Filter row `.b2-evidence__filters` with `aria-label="Evidence categories"`:
  - each button `.b2-evidence__filter` gets `aria-pressed`, `data-filter`, and text `ALL ${found}/${total}` or `IMPACT 2/18`;
  - the row is the horizontal scroller on mobile.
- Grid `.b2-evidence__grid`:
  - sort by `GROUP_ORDER.indexOf(group)`, then original index;
  - card is an `article` with `data-discovery`, `.is-found` or `.is-missing`, and `data-group`;
  - group color via `data-group` CSS;
  - found: name (`.b2-evidence__name`), recipe `A → B → C`, `.b2-evidence__stamp` `FILED`;
  - missing: `.b2-evidence__name` `???`, same recipe dimmed, `.b2-evidence__lock` with a lock glyph, and `aria-label="${recipe.join(' to ')}. Locked. Find this bad idea."`;
  - the recipe text is always in the DOM so it can be read aloud.
- Filtering replaces only the grid’s children. The head and filter counts do not change.
- A filter with zero catalog entries appends `.b2-evidence__empty` with `NO EVIDENCE IN THIS DRAWER YET.` Missing recipes stay visible, so a filter with entries is never empty.
- Do not add rewards, scrap, or claim buttons.

- [ ] **Step 14.4: Run the test to verify it passes**

```powershell
npx vitest run src/ui/screens/evidence.test.ts
```

Expected: PASS.

- [ ] **Step 14.5: Commit**

```powershell
git add src/ui/screens/evidence.ts src/ui/screens/evidence.test.ts
git commit -m "feat: add the evidence board"
```

---

### Task 15: Lobby shell — daily chip, goal strip, clickable stats, CONTINUE RUN

**Files:**
- Modify: `src/ui/screens/lobby.ts`
- Modify: `src/ui/screens/lobby.test.ts`
- Modify: `src/ui/UI.ts`

**`MenuActions`** already has the final shape from Task 12 (`play`, `continueRun`, `daily`, `store`, `settings`, `hero`); no interface change here. The lobby starts using `continueRun` and `daily` in this task.

**Top row:**

- `top` gets `.b2-lobby__top` with `night`, then `daily`, then `scrap`.
- Daily chip is a `<button class="b2-chip b2-lobby__daily">` with a `D` badge:
  - not played (`save.lastDaily !== todayKey()`): value `DAILY SHIFT`, label `PLAY · STREAK ${dailyStreak}`;
  - played: value `DAILY DONE`, label `PRACTICE · STREAK ${dailyStreak}`;
  - `save.dailyRareEdge`: append `<span class="b2-badge b2-lobby__rare">LEGENDARY EDGE READY</span>`;
  - `aria-label` spells out the action and the streak;
  - click calls `actions.daily()`.
- The chip is never hidden by CSS; Task 20 adds the wrap rules.

**Left column:**

- `roomsStat` and `ideasStat` become `<button type="button">` with the same classes plus `.b2-lobby__stat--button`.
- Rooms opens `openMode('rooms')`; ideas opens `openMode('evidence')`.
- `aria-label="Open the key wall. 12 of 50 rooms unlocked."` and `aria-label="Open the evidence board. 37 of 166 bad ideas found."`.
- Remove the `+` after the discovery total.
- Update the fake total in `lobby.test.ts` from `131` to `166`.

**Play area:**

- Compute `const run = runSnapshot(save); const activeRun = save.runActive && save.runFloor <= FINAL_ROOM_INDEX;`.
- Button label `CONTINUE RUN` or `PLAY`; add `.b2-lobby__playsub` under the label when `activeRun`:
  `FLOOR ${run.floor} · STREAK ${run.streak} · ${run.types} TYPES · ${formatScore(run.score)}`.
- Click: `activeRun ? actions.continueRun() : actions.play(selected)`.
- Goal strip under `playRow`, inside `.b2-lobby__play`:
  ```ts
  const goal = nextUnlock(save, totalStars(save.roomStars));
  const strip = el(goal.action ? 'button' : 'div', 'b2-goal b2-lobby__goal');
  strip.dataset.kind = goal.kind;
  if (goal.kind === 'store' && goal.progress >= 100) strip.classList.add('is-ready');
  strip.append(
    el('span', 'b2-goal__kicker', goal.kicker),
    el('strong', 'b2-goal__name', goal.name),
    el('span', 'b2-goal__detail', goal.detail),
  );
  const meter = el('div', 'b2-meter b2-goal__meter');
  const fill = el('span', 'b2-meter__fill');
  fill.style.setProperty('--b2-value', `${goal.progress}%`);
  meter.append(fill);
  strip.append(meter);
  if (strip instanceof HTMLButtonElement) {
    strip.type = 'button';
    strip.addEventListener('click', () => {
      if (goal.action === 'store') actions.store();
      else openMode('ledger');
    });
  }
  ```
- If `goal.kind === 'done'`, the strip is a div and reads `EVERYTHING UNLOCKED`.

- [ ] **Step 15.1: Extend the failing lobby tests**

Task 12 already extended the existing `menuFor` helper to the final action shape. Keep that helper; add the new cases below.

```ts
import { todayKey } from '../../gameplay/Campaign';

function menuWith(
  overrides: Record<string, unknown> = {},
  actions = {
    play: vi.fn(), continueRun: vi.fn(), daily: vi.fn(),
    store: vi.fn(), settings: vi.fn(), hero: vi.fn(),
  },
): { menu: HTMLElement; actions: typeof actions } {
  const save = new SaveManager();
  save.data.hero = 'tenant';
  const game = {
    save,
    discoveries: { total: 166, count: 0 },
    rooms: new RoomManager(),
    hero: 'tenant',
    ...overrides,
  } as unknown as Game;
  return { menu: buildMainMenu(game, actions), actions };
}

it('shows the daily chip and starts the daily', () => {
  const { menu, actions } = menuWith();
  document.body.append(menu);
  const chip = document.querySelector<HTMLButtonElement>('.b2-lobby__daily')!;
  expect(chip.textContent).toContain('DAILY SHIFT');
  expect(chip.textContent).toContain('PLAY · STREAK 0');
  chip.click();
  expect(actions.daily).toHaveBeenCalledOnce();
});
```

Build the save explicitly for the “already done” case (do not stash the save on the DOM):

```ts
it('shows PRACTICE when today is already done', () => {
  const save = new SaveManager();
  save.data.hero = 'tenant';
  save.data.lastDaily = todayKey();
  save.data.dailyStreak = 3;
  const game = {
    save, discoveries: { total: 166, count: 0 }, rooms: new RoomManager(), hero: 'tenant',
  } as unknown as Game;
  document.body.append(buildMainMenu(game, {
    play() {}, continueRun() {}, daily() {}, store() {}, settings() {}, hero() {},
  }));
  const chip = document.querySelector('.b2-lobby__daily')!;
  expect(chip.textContent).toContain('DAILY DONE');
  expect(chip.textContent).toContain('PRACTICE · STREAK 3');
});
```

Add:

```ts
it('makes both stat cards buttons that open their sheet tab', () => {
  const { menu } = menuWith();
  document.body.append(menu);
  const stats = [...menu.querySelectorAll<HTMLButtonElement>('.b2-lobby__stat')];
  expect(stats).toHaveLength(2);
  stats[0]!.click();
  expect(document.querySelector<HTMLElement>('#bonk-mode')!.hidden).toBe(false);
  expect(document.querySelector('[data-mode-tab="rooms"]')!.getAttribute('aria-selected')).toBe('true');
});

it('shows CONTINUE RUN with the saved run line', () => {
  const save = new SaveManager();
  save.data.hero = 'tenant';
  save.data.runActive = true;
  save.data.runFloor = 11;
  save.data.runStreak = 4;
  save.data.runScore = 12400;
  save.data.runBoosts = ['quick_feet', 'quick_feet', 'heavy_hands'];
  const actions = {
    play: vi.fn(), continueRun: vi.fn(), daily: vi.fn(),
    store: vi.fn(), settings: vi.fn(), hero: vi.fn(),
  };
  const game = {
    save, discoveries: { total: 166, count: 0 }, rooms: new RoomManager(), hero: 'tenant',
  } as unknown as Game;
  document.body.append(buildMainMenu(game, actions));
  const play = document.querySelector<HTMLButtonElement>('.b2-lobby__playbtn')!;
  expect(play.textContent).toContain('CONTINUE RUN');
  expect(play.textContent).toContain('FLOOR 12 · STREAK 4 · 2 TYPES · 12,400');
  play.click();
  expect(actions.continueRun).toHaveBeenCalledOnce();
  expect(actions.play).not.toHaveBeenCalled();
});

it('shows the next goal and opens the store when it is a store goal', () => {
  const save = new SaveManager();
  save.data.hero = 'tenant';
  save.data.scrap = 300;
  const actions = {
    play: vi.fn(), continueRun: vi.fn(), daily: vi.fn(),
    store: vi.fn(), settings: vi.fn(), hero: vi.fn(),
  };
  const game = {
    save, discoveries: { total: 166, count: 0 }, rooms: new RoomManager(), hero: 'tenant',
  } as unknown as Game;
  document.body.append(buildMainMenu(game, actions));
  const goal = document.querySelector<HTMLButtonElement>('.b2-lobby__goal')!;
  expect(goal.textContent).toContain('READY TO BUY');
  expect(goal.textContent).toContain('SUGAR RUSH');
  goal.click();
  expect(actions.store).toHaveBeenCalledOnce();
});
```

The “close star goal opens the ledger tab” test belongs to Task 16, once the ledger tab exists.

Import `vi` and `todayKey`.

- [ ] **Step 15.2: Run the tests and verify they fail**

```powershell
npx vitest run src/ui/screens/lobby.test.ts
```

Expected: FAIL — no daily chip, stats are divs, no run subline, no goal strip.

- [ ] **Step 15.3: Implement the lobby shell**

- Import `formatScore` from `../dom`, `todayKey`, `FINAL_ROOM_INDEX`, `totalStars` from `../../gameplay/Campaign`, `runSnapshot` from `../../gameplay/Run`, `nextUnlock` from `../../gameplay/Progression`.
- Build the daily chip, clickable stats, run-aware PLAY, and goal strip as described.
- `openMode` already exists; extend its tab type in Task 16. For this task it accepts `'rooms' | 'characters' | 'ledger' | 'evidence'` and simply selects whichever pane exists yet; add the ledger/evidence panes in Task 16. To keep this task green before the panes exist, have `openMode('ledger' | 'evidence')` fall back to `rooms` when the pane is absent. Task 16 removes the fallback.
- In `UI.ts`:
  - change `play: (index) => game.playFrom(index)` to `game.playSelected(index)` so the key wall and big button agree;
  - keep the Task 12 `continueRun`, `daily`, `store`, and `settings` routes; do not add duplicate properties;
  - the lobby now calls those routes from the CONTINUE RUN button and daily chip.

- [ ] **Step 15.4: Run the lobby test and typecheck**

```powershell
npx vitest run src/ui/screens/lobby.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 15.5: Commit**

```powershell
git add src/ui/screens/lobby.ts src/ui/screens/lobby.test.ts src/ui/UI.ts
git commit -m "feat: surface the run and daily on the lobby"
```

---

### Task 16: The flat sheet — four tabs

**Files:**
- Modify: `src/ui/screens/lobby.ts`
- Modify: `src/ui/screens/lobby.test.ts`

**Tab type:**

```ts
type SheetTab = 'rooms' | 'characters' | 'ledger' | 'evidence';
let reopenMode: SheetTab | null = null;
```

- [ ] **Step 16.1: Write the failing sheet tests**

Add to `lobby.test.ts`:

```ts
it('names the sheet YOUR FLAT / THE PLAN and offers four tabs', () => {
  const { menu } = menuWith();
  document.body.append(menu);
  expect(menu.textContent).toContain('YOUR FLAT');
  expect(menu.textContent).toContain('THE PLAN');
  const tabs = [...menu.querySelectorAll<HTMLButtonElement>('[data-mode-tab]')];
  expect(tabs.map((t) => t.textContent)).toEqual(['ROOMS', 'CHARACTERS', 'LEDGER', 'EVIDENCE']);
});

it('opens the requested tab and manages aria-selected, tabIndex and hidden together', () => {
  const { menu } = menuWith();
  document.body.append(menu);
  const ledger = menu.querySelector<HTMLButtonElement>('[data-mode-tab="ledger"]')!;
  ledger.click();
  expect(ledger.getAttribute('aria-selected')).toBe('true');
  expect(ledger.tabIndex).toBe(0);
  expect(menu.querySelector<HTMLElement>('#mode-pane-ledger')!.hidden).toBe(false);
  expect(menu.querySelector<HTMLElement>('#mode-pane-rooms')!.hidden).toBe(true);
  expect(menu.querySelector('[data-mode-tab="rooms"]')!.getAttribute('aria-selected')).toBe('false');
});

it('cycles tabs with the arrow keys and moves focus', () => {
  const { menu } = menuWith();
  document.body.append(menu);
  const rooms = menu.querySelector<HTMLButtonElement>('[data-mode-tab="rooms"]')!;
  rooms.focus();
  rooms.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(document.activeElement).toBe(menu.querySelector('[data-mode-tab="characters"]'));
  expect(menu.querySelector('[data-mode-tab="characters"]')!.getAttribute('aria-selected')).toBe('true');
});

it('opens the ledger tab for a close star goal', () => {
  const save = new SaveManager();
  save.data.hero = 'tenant';
  save.data.roomStars = { 'room-1': 1 };
  const game = {
    save, discoveries: { total: 166, count: 0 }, rooms: new RoomManager(), hero: 'tenant',
  } as unknown as Game;
  document.body.append(buildMainMenu(game, {
    play() {}, continueRun() {}, daily() {}, store() {}, settings() {}, hero() {},
  }));
  const goal = document.querySelector<HTMLButtonElement>('.b2-lobby__goal')!;
  expect(goal.textContent).toContain('NEXT STAR');
  goal.click();
  expect(document.querySelector('[data-mode-tab="ledger"]')!.getAttribute('aria-selected')).toBe('true');
});
```

- [ ] **Step 16.2: Run the tests and verify they fail**

```powershell
npx vitest run src/ui/screens/lobby.test.ts
```

Expected: FAIL — kicker/title old, two tabs.

- [ ] **Step 16.3: Implement the four tabs**

- Rename the kicker text to `YOUR FLAT` and the heading to `THE PLAN`.
- Add `ledger` and `evidence` buttons with `data-mode-tab`, `aria-controls`, and panes `#mode-pane-ledger` / `#mode-pane-evidence`.
- Mount `buildLedgerPane(game)` and `buildEvidencePane(game)` inside them.
- `setModeTab` handles all four: one active button, one visible pane, other panes `hidden`, all other tabs `tabIndex = -1`.
- Arrow keys cycle in order and wrap: rooms → characters → ledger → evidence → rooms.
- `openMode(tab)` shows the sheet and selects that tab; `openMode` calls `paneRooms.showMap(true)` only for rooms.
- Remove the Task 15 fallback for ledger/evidence.
- Clicking the backdrop or CLOSE still returns focus to PLAY.
- The hero-pick rebuild still sets `reopenMode = 'characters'` and reopens after mount.

- [ ] **Step 16.4: Run the lobby test and typecheck**

```powershell
npx vitest run src/ui/screens/lobby.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 16.5: Commit**

```powershell
git add src/ui/screens/lobby.ts src/ui/screens/lobby.test.ts
git commit -m "feat: add ledger and evidence to the flat sheet"
```

---

### Task 17: Key wall — resume floor, run banner, enter rules, confirm

**Files:**
- Modify: `src/ui/screens/rooms.ts`
- Create: `src/ui/screens/rooms.test.ts`
- Modify: `src/ui/screens/lobby.ts`

- [ ] **Step 17.1: Write the failing key-wall tests**

Create `src/ui/screens/rooms.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import type { Game } from '../../core/Game';
import { RoomManager } from '../../gameplay/RoomManager';
import { SaveManager } from '../../save/SaveManager';
import { buildRoomsPane } from './rooms';

function pane(overrides: Record<string, unknown> = {}, actions = { onEnter: vi.fn(), onSelect: vi.fn() }) {
  const save = new SaveManager();
  save.data.unlockedRoom = 12;
  Object.assign(save.data, overrides);
  const game = { save, rooms: new RoomManager() } as unknown as Game;
  return { pane: buildRoomsPane(game, actions), actions, save };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('opens on the active run floor and shows the run banner', () => {
  const { pane } = pane({
    runActive: true, runFloor: 11, runStreak: 4,
    runBoosts: ['quick_feet', 'quick_feet', 'heavy_hands'],
  });
  document.body.append(pane.root);
  expect(pane.root.querySelector('.b2-keywall__run')!.textContent)
    .toContain('FLOOR 12 · STREAK 4 · 2 TYPES');
  expect(pane.root.querySelector('.b2-keycard.is-selected')!.getAttribute('data-index')).toBe('11');
});

it('labels the footer CONTINUE RUN on the active floor', () => {
  const { pane } = pane({ runActive: true, runFloor: 11 });
  document.body.append(pane.root);
  expect(pane.root.querySelector('.b2-rooms__enter')!.textContent).toContain('CONTINUE RUN');
});

it('labels a different floor START NEW RUN and warns before wiping the run', () => {
  const { pane, actions } = pane({ runActive: true, runFloor: 11 });
  document.body.append(pane.root);
  pane.root.querySelector<HTMLButtonElement>('[data-index="5"]')!.click();
  const enter = pane.root.querySelector<HTMLButtonElement>('.b2-rooms__enter')!;
  expect(enter.textContent).toContain('START NEW RUN');
  expect(pane.root.querySelector('.b2-rooms__hint')!.textContent)
    .toContain('STARTS A NEW RUN · CURRENT RUN ENDS');
  enter.click();
  expect(actions.onEnter).not.toHaveBeenCalled();
  expect(enter.textContent).toContain('TAP AGAIN TO START');
  enter.click();
  expect(actions.onEnter).toHaveBeenCalledOnce();
  expect(actions.onEnter.mock.calls[0]![0].index).toBe(5);
});

it('starts the selected room from ENTER ROOM when no run is active', () => {
  const { pane, actions } = pane();
  document.body.append(pane.root);
  const enter = pane.root.querySelector<HTMLButtonElement>('.b2-rooms__enter')!;
  expect(enter.textContent).toContain('ENTER ROOM');
  enter.click();
  expect(actions.onEnter).toHaveBeenCalledOnce();
  expect(actions.onEnter.mock.calls[0]![0].index).toBe(12);
});
```

The hint element needs the class `b2-rooms__hint`; if it already has another class, add this one.

- [ ] **Step 17.2: Run the tests and verify they fail**

```powershell
npx vitest run src/ui/screens/rooms.test.ts
```

Expected: FAIL — opens on unlockedRoom, no run banner, footer always ENTER ROOM.

- [ ] **Step 17.3: Implement the key-wall rules**

- Delete the module-level `lastPick` from `rooms.ts`. `lobby.ts` already owns `lastRoomPick` and passes it as `options.initial`, so the pane no longer carries cross-test state.
- Compute:
  ```ts
  const run = runSnapshot(save);
  const activeRun = save.runActive && save.runFloor <= total - 1;
  const resumeRoom = Math.min(Math.max(0, activeRun ? save.runFloor : save.unlockedRoom), total - 1);
  const openThrough = tester ? total - 1 : Math.max(save.unlockedRoom, activeRun ? save.runFloor : 0);
  ```
- Selection priority: `resumeRoom` when `activeRun`; otherwise a valid `options.initial`; otherwise `resumeRoom`.
  ```ts
  let selected = resumeRoom;
  if (!activeRun && typeof options.initial === 'number') {
    selected = Math.max(0, Math.min(options.initial, openThrough));
  }
  ```
  Update the `RoomsPaneOptions.initial` comment to “Index to preselect when no run is active. Falls back to the resume room.”
- Insert a `.b2-keywall__run` strip above the `.b2-keywall` when `activeRun`, text `RUN IN PROGRESS · FLOOR ${run.floor} · STREAK ${run.streak} · ${run.types} TYPES`.
- Add `let armedFor: number | null = null;` before `select()`.
- Define `updateEnter()` before `select()`:
  ```ts
  const updateEnter = (): void => {
    const active = activeRun && selected === save.runFloor;
    const different = activeRun && selected !== save.runFloor;
    const label = different && armedFor === selected
      ? 'TAP AGAIN TO START'
      : active ? 'CONTINUE RUN' : different ? 'START NEW RUN' : 'ENTER ROOM';
    enter.replaceChildren(document.createTextNode(label));
    enter.append(chev);
    enter.classList.toggle('is-armed', different && armedFor === selected);
    if (activeRun) {
      hint.textContent = different
        ? 'STARTS A NEW RUN · CURRENT RUN ENDS'
        : 'PICKS UP WHERE YOU LEFT OFF';
    }
  };
  ```
- `select()` sets `armedFor = null` before `describe(entry)`, then calls `updateEnter()` so a different card re-arms the confirmation.
- Call `updateEnter()` once after the card loop so the initial selection paints the right label; leave the non-run `hintFor` text alone.
- Enter click:
  ```ts
  enter.addEventListener('click', () => {
    const picked = cards.find(({ entry }) => entry.index === selected);
    if (!picked) return;
    if (activeRun && selected !== save.runFloor && armedFor !== selected) {
      armedFor = selected;
      updateEnter();
      return;
    }
    options.onEnter?.({
      index: picked.entry.index,
      label: `${roomLabel(picked.entry.index)} · ${picked.entry.name}`,
      shortLabel: roomLabel(picked.entry.index),
      name: picked.entry.name,
    });
  });
  ```
  Do not call `select()` from the enter handler; the card is already selected and re-selecting would wipe the armed label.
- `pane.showMap(true)` scrolls the selected card; the selected card is now the run floor.
- In `lobby.ts`, change `onEnter: () => closeMode()` to:
  ```ts
  onEnter: (choice) => {
    closeMode();
    actions.play(choice.index);
  }
  ```
  `actions.play` maps to `game.playSelected`, which continues when the floor matches and starts a new run otherwise.
- Update `.b2-keywall__run` and armed styles in Task 20.

- [ ] **Step 17.4: Run the rooms and lobby tests and typecheck**

```powershell
npx vitest run src/ui/screens/rooms.test.ts src/ui/screens/lobby.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 17.5: Commit**

```powershell
git add src/ui/screens/rooms.ts src/ui/screens/rooms.test.ts src/ui/screens/lobby.ts
git commit -m "feat: make the key wall run-aware"
```

---

### Task 18: HUD — live run line, live scrap, failure snap-back

**Files:**
- Modify: `src/ui/screens/hud.ts`
- Create: `src/ui/screens/hud.test.ts`

- [ ] **Step 18.1: Write the failing HUD tests**

Create `src/ui/screens/hud.test.ts` using the real `Game` and the tutorial-flow fake canvas:

```ts
// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../../core/Game';
import { HUD } from './hud';
// Copy `fakeCanvas()` and `stub2d()` from `Game.tutorial-flow.test.ts`.

function boot(): { game: Game; hud: HUD; root: HTMLElement } {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  const root = document.createElement('div');
  document.body.append(root);
  const hud = new HUD(game, root, () => {});
  return { game, hud, root };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('shows the streak and distinct Edge types', () => {
  const { game, hud, root } = boot();
  game.save.data.runActive = true;
  game.save.data.runFloor = 11;
  game.save.data.runStreak = 4;
  game.save.data.runBoosts = ['quick_feet', 'quick_feet', 'heavy_hands'];
  hud.frame(0.016);
  const run = root.querySelector('.b2-hud__run')!;
  expect(run.textContent).toContain('STREAK 4');
  expect(run.textContent).toContain('EDGE 2');
  expect(run.classList.contains('is-cold')).toBe(false);
});

it('greys the streak at zero and hides the run line on a daily', () => {
  const { game, hud, root } = boot();
  game.save.data.runActive = true;
  game.save.data.runStreak = 0;
  hud.frame(0.016);
  expect(root.querySelector('.b2-hud__run')!.classList.contains('is-cold')).toBe(true);
  (game.room as unknown as { daily: boolean }).daily = true;
  hud.frame(0.016);
  expect(root.querySelector('.b2-hud__run')!.classList.contains('hidden')).toBe(true);
});

it('shows saved plus room scrap and snaps back on failure', () => {
  const { game, hud, root } = boot();
  (game as unknown as { state: string }).state = 'playing';
  game.save.data.scrap = 100;
  game.score.stats.scrap = 30;
  hud.frame(0.016);
  expect(root.querySelector('.scrap-slip')!.textContent).toBe('130');
  expect(root.querySelector('.scrap-slip')!.classList.contains('is-pulse')).toBe(true);

  (game as unknown as { setState(s: string): void }).setState('failed');
  hud.frame(0.016);
  expect(root.querySelector('.scrap-slip')!.textContent).toBe('100');
  expect(root.querySelector('.b2-hud__nosalvage')!.classList.contains('hidden')).toBe(false);
});
```

If the HUD’s first frame does not naturally add `is-pulse`, trigger the second frame with a changed value and assert `is-pulse`; the point is that a gain pulses and failure removes it.

- [ ] **Step 18.2: Run the tests and verify they fail**

```powershell
npx vitest run src/ui/screens/hud.test.ts
```

Expected: FAIL — no `.b2-hud__run`, scrap excludes room scrap, no NO SALVAGE.

- [ ] **Step 18.3: Implement the run line**

- Add `private readonly runLine: HTMLElement;` and `private readonly noSalvage: HTMLElement;`.
- After the health `bar` inside `healthWrap`, append:
  ```ts
  this.runLine = el('div', 'b2-hud__run');
  healthWrap.append(this.runLine);
  ```
- `updateRun()` called from `frame()`:
  ```ts
  const show = game.save.data.runActive && !game.room.daily;
  this.runLine.classList.toggle('hidden', !show);
  if (!show) return;
  const types = new Set(game.save.data.runBoosts).size;
  const streak = game.save.data.runStreak;
  this.runLine.classList.toggle('is-cold', streak === 0);
  const key = `${streak}|${types}`;
  if (key === this.last.run) return;
  this.last.run = key;
  this.runLine.replaceChildren(
    el('span', 'b2-hud__streak', `STREAK ${streak}`),
    el('span', 'b2-hud__edgetypes', `EDGE ${types}`),
  );
  ```
- Add `run: ''` to `this.last`.

- [ ] **Step 18.4: Implement live scrap and NO SALVAGE**

- Wallet total: `const wallet = game.state === 'failed' ? game.save.data.scrap : game.save.data.scrap + game.score.stats.scrap;`.
- Track `last.wallet` instead of `last.scrap`.
- On change:
  - `scrapSlip.textContent = wallet > 0 ? String(wallet) : ''`;
  - `scrapSlip.classList.toggle('is-empty', wallet <= 0)`;
  - `scrapSlip.classList.toggle('is-failed', game.state === 'failed')`;
  - if the new value is greater than the old and the state is `playing`, add `is-pulse`, remove it after 400 ms (guard `isConnected`).
- Add the NO SALVAGE element next to the scrap slip:
  ```ts
  this.noSalvage = el('span', 'b2-hud__nosalvage hidden', 'NO SALVAGE');
  chips.append(scoreChip, this.scrapSlip, this.noSalvage, pause);
  ```
- Toggle `hidden` on `game.state === 'failed'`.
- Do not mutate save data here; this is display only.

- [ ] **Step 18.5: Run the HUD test and typecheck**

```powershell
npx vitest run src/ui/screens/hud.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 18.6: Commit**

```powershell
git add src/ui/screens/hud.ts src/ui/screens/hud.test.ts
git commit -m "feat: show the run and live scrap in the hud"
```

---

### Task 19: Pause — current run, legendary tag, shared cards

**Files:**
- Modify: `src/ui/screens/pause.ts`
- Create: `src/ui/screens/pause.test.ts`

- [ ] **Step 19.1: Write the failing pause tests**

Create `src/ui/screens/pause.test.ts` using the real `Game`:

```ts
// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../../core/Game';
import { buildPauseMenu } from './pause';
// Copy `fakeCanvas()` and `stub2d()` from `Game.tutorial-flow.test.ts`.

function boot(): Game {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  return game;
}

function actions() {
  return {
    resume: vi.fn(), restart: vi.fn(), settings: vi.fn(), home: vi.fn(),
    buyAbility: vi.fn(() => ''), lesson: vi.fn(),
  };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('shows the current run above the powers', () => {
  const game = boot();
  game.save.data.runActive = true;
  game.save.data.runFloor = 11;
  game.save.data.runStreak = 4;
  game.save.data.runScore = 12400;
  game.save.data.runBoosts = ['quick_feet', 'quick_feet', 'heavy_hands'];
  document.body.append(buildPauseMenu(false, game, actions()));
  const section = document.querySelector('.b2-pause__run')!;
  expect(section.textContent).toContain('CURRENT RUN');
  expect(section.textContent).toContain('FLOOR 12');
  expect(section.textContent).toContain('STREAK 4');
  expect(section.textContent).toContain('12,400');
  expect(section.textContent).toContain('QUICK FEET ×2');
  expect(section.textContent).toContain('HEAVY HANDS ×1');
  expect(section.compareDocumentPosition(document.querySelector('.b2-pause__shop')!) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();
});

it('shows NO RUN IN PROGRESS when idle', () => {
  const game = boot();
  game.save.data.runActive = false;
  document.body.append(buildPauseMenu(false, game, actions()));
  expect(document.querySelector('.b2-pause__run')!.textContent).toContain('NO RUN IN PROGRESS.');
});

it('shows LEGENDARY EDGE READY until the draft consumes it', () => {
  const game = boot();
  game.save.data.dailyRareEdge = true;
  document.body.append(buildPauseMenu(false, game, actions()));
  expect(document.body.textContent).toContain('LEGENDARY EDGE READY');
});

it('labels home as MAIN MENU · RUN SAVED when a run is active', () => {
  const game = boot();
  game.save.data.runActive = true;
  document.body.append(buildPauseMenu(false, game, actions()));
  const home = [...document.querySelectorAll<HTMLButtonElement>('.b2-pause__actions button')]
    .find((b) => b.textContent!.includes('MAIN MENU'))!;
  expect(home.textContent).toContain('MAIN MENU · RUN SAVED');
});

it('renders the powers with the shared ability card', () => {
  const game = boot();
  document.body.append(buildPauseMenu(false, game, actions()));
  expect(document.querySelectorAll('.b2-pause__shop .b2-shop-card')).toHaveLength(3);
  expect(document.querySelector('.b2-pause__shop .b2-shop-card__buy')).toBeTruthy();
});
```

- [ ] **Step 19.2: Run the tests and verify they fail**

```powershell
npx vitest run src/ui/screens/pause.test.ts
```

Expected: FAIL — no current-run section or legendary tag; home label is plain.

- [ ] **Step 19.3: Implement the pause additions**

- Add imports: `runSnapshot` from `../../gameplay/Run`; `EDGE_BY_ID`, `type EdgeId` from `../../gameplay/Edges`; `formatScore` from `../dom`.
- Above `const shop = ...`, insert:
  ```ts
  const save = game.save.data;
  const runBox = el('section', 'b2-pause__run');
  runBox.setAttribute('aria-labelledby', 'b2-pause-run');
  const runTitle = el('h2', 'b2-pause__section-title', 'CURRENT RUN');
  runTitle.id = 'b2-pause-run';
  runBox.append(runTitle);
  if (save.runActive) {
    const snap = runSnapshot(save);
    runBox.append(el('p', 'b2-pause__runline',
      `FLOOR ${snap.floor} · STREAK ${snap.streak} · ${snap.types} TYPES · ${formatScore(snap.score)}`));
    const build = el('div', 'b2-pause__build');
    for (const [id, count] of edgeCounts(save.runBoosts).slice(0, 4)) {
      build.append(el('span', 'b2-pause__edge', `${EDGE_BY_ID[id as EdgeId].name} ×${count}`));
    }
    runBox.append(build);
  } else {
    runBox.append(el('p', 'b2-pause__runline', 'NO RUN IN PROGRESS.'));
  }
  if (save.dailyRareEdge) {
    runBox.append(el('span', 'b2-badge b2-pause__rare', 'LEGENDARY EDGE READY'));
  }
  ```
  Insert before `body.append(shop)` so the order is CURRENT RUN, then POWERS. Replace the later `body.append(shop)` with `body.append(runBox, shop)` and do not append `runBox` twice.
- Add one local helper at the top of `pause.ts`; do not import from `Run` (Task 6 does not export it):
  ```ts
  function edgeCounts(ids: readonly string[]): Array<[string, number]> {
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts];
  }
  ```
  Preserve first-seen order.
- Change the home button label:
  ```ts
  kitButton(save.runActive ? 'MAIN MENU · RUN SAVED' : 'BACK TO MAIN MENU', 'lavender', actions.home)
  ```
- Keep `buildAbilityCard` from Task 12; do not duplicate card markup.
- Existing replay warning remains accurate: replaying a tutorial starts a new run.

- [ ] **Step 19.4: Run the pause test and typecheck**

```powershell
npx vitest run src/ui/screens/pause.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 19.5: Commit**

```powershell
git add src/ui/screens/pause.ts src/ui/screens/pause.test.ts
git commit -m "feat: show the current run in the pause menu"
```

---

### Task 20: CSS, mobile order, reduced motion, and visual QA

**Files:**
- Create: `src/ui-kit/bonk2/shop.css`
- Modify: `src/main.ts`
- Modify: `src/ui-kit/bonk2/results.css`
- Modify: `src/ui-kit/bonk2/lobby.css`
- Modify: `src/ui-kit/bonk2/rooms.css`
- Modify: `src/ui-kit/bonk2/hud.css`
- Modify: `src/ui-kit/bonk2/panels.css`

- [ ] **Step 20.1: Create `shop.css` and import it**

Add `import './ui-kit/bonk2/shop.css';` to `src/main.ts` after `results.css`.

`shop.css` owns the new store, ledger, evidence, and shared goal-strip styles. Use only existing tokens (`--b2-ink`, `--b2-panel`, `--b2-panel-dark`, `--b2-white`, `--b2-cream`, `--b2-lime`, `--b2-lavender`, `--b2-yellow`, `--b2-red`, `--b2-display`). No new colors, fonts, or images.

**Store:**

```css
.b2-store {
  --b2-panel-w: 1040px;
  width: min(1040px, calc(100vw - 24px));
  max-height: min(94vh, 920px);
  display: flex;
  flex-direction: column;
}
.b2-store__body { display: flex; flex-direction: column; gap: 12px; min-height: 0; overflow: auto; }
.b2-store__head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.b2-store__head .b2-panel__title { margin-right: auto; }
.b2-store__promise { margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
.b2-store__wallet { background: var(--b2-ink); }
.b2-store__note { margin: 0; padding: 8px 10px; border-left: 4px solid var(--b2-yellow); background: rgba(255, 210, 63, 0.1); color: var(--b2-yellow); font-size: 12px; }
.b2-store__tabs { width: 100%; }
.b2-store__goal { width: 100%; }
.b2-store__pane[hidden] { display: none; }
.b2-store__upgrades { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; }
.b2-store__powers { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
.b2-upgrade { align-items: flex-start; }
.b2-upgrade__pips { margin-left: auto; color: var(--b2-lime); font-family: var(--b2-display); letter-spacing: 2px; font-size: 14px; }
.b2-upgrade__next { margin: 0; color: var(--b2-lavender); font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
.b2-upgrade.is-bought { animation: b2-buy-pulse 600ms ease-out; }
@keyframes b2-buy-pulse { 0% { box-shadow: 0 0 0 0 rgba(155, 229, 100, 0.8); } 100% { box-shadow: 0 0 0 12px rgba(155, 229, 100, 0); } }
```

**Shared goal strip:**

```css
.b2-goal {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: min(100%, 520px);
  padding: 8px 12px;
  border: 3px solid var(--b2-ink);
  background: var(--b2-panel-dark);
  color: var(--b2-white);
  text-align: left;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}
button.b2-goal { cursor: pointer; }
button.b2-goal:hover { transform: translateY(-1px); }
button.b2-goal:focus-visible { outline: 3px solid var(--b2-lime); outline-offset: 3px; }
.b2-goal__kicker { color: var(--b2-lime); font-family: var(--b2-display); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
.b2-goal__name { font-family: var(--b2-display); font-size: clamp(15px, 2.2vh, 19px); letter-spacing: 0.03em; text-transform: uppercase; }
.b2-goal__detail { color: rgba(255, 255, 255, 0.65); font-size: 11px; }
.b2-goal__meter { height: 6px; margin-top: 3px; }
.b2-meter--thin { height: 6px; border-width: 2px; }
.b2-goal.is-ready .b2-goal__meter .b2-meter__fill { animation: b2-goal-pulse 1200ms ease-out 1; }
@keyframes b2-goal-pulse { 0%, 100% { filter: none; } 50% { filter: brightness(1.6); } }
```

**Ledger:**

```css
.b2-ledger { display: flex; flex-direction: column; gap: 12px; }
.b2-ledger__head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.b2-ledger__title { margin: 0; font-family: var(--b2-display); font-size: clamp(20px, 3vh, 28px); color: var(--b2-white); }
.b2-ledger__count { margin-left: auto; color: var(--b2-lime); font-family: var(--b2-display); font-size: 20px; }
.b2-ledger__campaign { color: rgba(255, 255, 255, 0.65); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
.b2-ledger__next { padding: 10px 12px; border: 3px solid var(--b2-ink); background: var(--b2-lime); color: var(--b2-ink); font-family: var(--b2-display); font-size: 14px; }
.b2-ledger__rows { display: flex; flex-direction: column; gap: 6px; }
.b2-ledger__row { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px 10px; border: 2px solid var(--b2-ink); background: rgba(255, 255, 255, 0.04); }
.b2-ledger__row[data-status='paid'] { border-color: var(--b2-lime); }
.b2-ledger__row[data-status='next'] { border-color: var(--b2-yellow); background: rgba(255, 210, 63, 0.12); }
.b2-ledger__row[data-status='locked'] { opacity: 0.55; }
.b2-ledger__stars { color: var(--b2-yellow); font-family: var(--b2-display); }
.b2-ledger__name { color: var(--b2-white); font-family: var(--b2-display); font-size: 14px; }
.b2-ledger__reward { color: rgba(255, 255, 255, 0.65); font-size: 11px; }
.b2-ledger__status { font-size: 10px; letter-spacing: 0.1em; }
.b2-ledger__row[data-status='paid'] .b2-ledger__status { color: var(--b2-lime); }
.b2-ledger__row[data-status='next'] .b2-ledger__status { color: var(--b2-yellow); }
.b2-ledger__done { padding: 12px; background: var(--b2-lime); color: var(--b2-ink); font-family: var(--b2-display); }
.b2-ledger__foot { margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 11px; }
```

**Evidence:**

```css
.b2-evidence { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.b2-evidence__head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.b2-evidence__title { margin: 0; font-family: var(--b2-display); font-size: clamp(20px, 3vh, 28px); color: var(--b2-white); }
.b2-evidence__count { margin-left: auto; color: var(--b2-lime); font-family: var(--b2-display); font-size: 20px; }
.b2-evidence__filters { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
.b2-evidence__filters::-webkit-scrollbar { display: none; }
.b2-evidence__filter { flex: none; min-height: 34px; padding: 6px 10px; border: 2px solid var(--b2-ink); background: var(--b2-panel-dark); color: var(--b2-white); font-family: var(--b2-display); font-size: 11px; letter-spacing: 0.06em; white-space: nowrap; cursor: pointer; }
.b2-evidence__filter[aria-pressed='true'] { background: var(--b2-lime); color: var(--b2-ink); }
.b2-evidence__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.b2-evidence__card { position: relative; display: flex; flex-direction: column; gap: 5px; padding: 9px 10px 9px 14px; border: 2px solid var(--b2-ink); background: var(--b2-panel-dark); }
.b2-evidence__card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 6px; background: var(--b2-group, var(--b2-lavender)); }
.b2-evidence__card[data-group='impact'] { --b2-group: var(--b2-red); }
.b2-evidence__card[data-group='electric'] { --b2-group: var(--b2-yellow); }
.b2-evidence__card[data-group='fire'] { --b2-group: color-mix(in srgb, var(--b2-red) 60%, var(--b2-yellow)); }
.b2-evidence__card[data-group='floor'] { --b2-group: color-mix(in srgb, var(--b2-lavender) 55%, var(--b2-cream)); }
.b2-evidence__card[data-group='air'] { --b2-group: color-mix(in srgb, var(--b2-blue) 60%, var(--b2-white)); }
.b2-evidence__card[data-group='gadget'] { --b2-group: var(--b2-lavender); }
.b2-evidence__card[data-group='style'] { --b2-group: var(--b2-lime); }
.b2-evidence__card.is-missing { opacity: 0.6; }
.b2-evidence__name { margin: 0; color: var(--b2-white); font-family: var(--b2-display); font-size: 13px; }
.b2-evidence__recipe { color: rgba(255, 255, 255, 0.65); font-size: 10px; line-height: 1.4; }
.b2-evidence__stamp { align-self: flex-start; padding: 2px 6px; background: var(--b2-lime); color: var(--b2-ink); font-family: var(--b2-display); font-size: 9px; letter-spacing: 0.12em; }
.b2-evidence__lock { position: absolute; top: 6px; right: 6px; color: var(--b2-yellow); font-size: 13px; }
.b2-evidence__empty { padding: 18px; border: 2px dashed rgba(255, 255, 255, 0.3); color: rgba(255, 255, 255, 0.6); text-align: center; font-family: var(--b2-display); }
```

- [ ] **Step 20.2: Fix the mobile results order**

In `results.css` at `@media (max-width: 860px)`, change the grid areas from:

```css
'meta'
'hero'
'marks'
'side'
'stats';
```

to:

```css
'meta'
'hero'
'side'
'marks'
'stats';
```

Also:

- `.b2-report--draft .b2-report__body` keeps the two-column desktop grid; no new rule needed.
- Add `.b2-report__draftstatus { margin: 0; color: var(--b2-lime); font-size: 11px; }`.
- Add `.b2-report__runreport { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 2px solid rgba(255, 255, 255, 0.18); background: rgba(0, 0, 0, 0.18); }`.
- Add `.b2-report__nosalvage { color: var(--b2-red); font-family: var(--b2-display); letter-spacing: 0.08em; }`.
- Add `.b2-report__ledger { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; background: var(--b2-lime); color: var(--b2-ink); font-family: var(--b2-display); }`.
- Add `.b2-report__nextedge { color: var(--b2-yellow); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }` (the non-draft strip uses this class; keep it consistent with the Task 11 test).
- `.b2-edge` cards: `min-height: 44px`, `text-align: left`, `cursor: pointer`.
- `.b2-edge__stack { align-self: flex-start; margin-top: 2px; padding: 1px 6px; background: var(--b2-ink); color: var(--b2-lime); font-family: var(--b2-display); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }`
- `.b2-edge__stamp { align-self: flex-start; margin-top: 2px; padding: 1px 6px; background: var(--b2-lime); color: var(--b2-ink); font-family: var(--b2-display); font-size: 10px; letter-spacing: 0.12em; transform: rotate(-2deg); }`
- `.b2-edge:disabled` dims to `opacity: 0.45`; `.b2-edge.is-taken` gets `border-color: var(--b2-lime)`, and `.b2-edge.is-taken:disabled { opacity: 1; }` so the taken card stays loud.
- Stagger: `.b2-report--draft .b2-edge { animation: b2-edge-in 260ms ease-out both; }` with `nth-child` delays of 0/60/120 ms. Reduced motion disables it.
- In the reduced-motion block add `.b2-edge, .b2-report__next, .b2-report__ledger { animation: none; transition: none; }`.

- [ ] **Step 20.3: Lobby CSS**

In `lobby.css`:

- `.b2-lobby__top { flex-wrap: wrap; }` and `.b2-lobby__daily { margin-left: auto; }` on desktop so the top row is `night · daily · scrap` with space between.
- `.b2-lobby__daily` becomes a real button: `cursor: pointer`, `text-align: left`, `min-height: 46px`, hover lift, `:focus-visible` outline.
- `.b2-lobby__rare { background: var(--b2-yellow); color: var(--b2-ink); margin-left: 6px; }`.
- `.b2-lobby__stat--button { cursor: pointer; text-align: left; width: 100%; }` plus hover/focus states matching `.b2-lobby__stat`.
- `.b2-lobby__playsub { color: rgba(255, 255, 255, 0.72); font-size: clamp(10px, 1.5vh, 12px); letter-spacing: 0.05em; }`.
- `.b2-lobby__play { gap: 8px; }`.
- `.b2-lobby__goal { margin-top: 2px; }`.
- `.b2-lobby__modetabs { overflow-x: auto; scrollbar-width: none; }`, `.b2-lobby__modetabs::-webkit-scrollbar { display: none; }`, `.b2-lobby__modetabs .b2-tab { white-space: nowrap; flex: none; }`.
- At `max-width: 600px`:
  - `.b2-lobby__night { flex: 1 1 100%; }`
  - `.b2-lobby__daily, .b2-lobby__scrap { flex: 1 1 0; min-width: 0; }`
  - `.b2-lobby__daily { margin-left: 0; }`
  - `.b2-lobby__goal { width: 100%; }`
  - `.b2-lobby__goal .b2-goal__detail` stays visible; the strip is the only progression signal below 600px.
- At `max-height: 560px`:
  - `.b2-lobby__hero { width: min(52%, 220px); max-height: 26vh; }`
  - `.b2-lobby__logo { max-height: 10vh; }`
  - `.b2-lobby__goal { flex-direction: row; align-items: center; min-height: 24px; padding: 3px 8px; }`
  - `.b2-lobby__goal .b2-goal__detail, .b2-lobby__goal .b2-goal__meter { display: none; }`
  - keep `.b2-lobby__daily` visible.
- Reduced motion: disable the goal pulse and stat hover transforms.

- [ ] **Step 20.4: Key wall CSS**

In `rooms.css`:

- `.b2-keywall__run { display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: var(--b2-ink); color: var(--b2-white); font-family: var(--b2-display); font-size: 12px; letter-spacing: 0.06em; }`
- `.b2-keywall__run::before { content: ''; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--b2-lime); }` — the live text already says `RUN IN PROGRESS · ...`; the pseudo-element is the status dot only.
- `.b2-rooms__enter.is-armed { background: var(--b2-red); color: var(--b2-white); }`
- `.b2-rooms__hint { min-height: 16px; }` so the warning does not shift the footer.
- Reduced motion: no changes needed beyond the existing rules; the button color change is a state, not an animation.

- [ ] **Step 20.5: HUD CSS**

In `hud.css`:

- `.b2-hud__health { flex-wrap: wrap; }`
- `.b2-hud__run { display: flex; flex-basis: 100%; gap: 8px; padding: 2px 6px 0; font-family: var(--b2-display); font-size: 10px; letter-spacing: 0.06em; }`
- `.b2-hud__streak { color: var(--b2-lime); }`
- `.b2-hud__run.is-cold .b2-hud__streak { color: rgba(255, 255, 255, 0.5); }`
- `.b2-hud__edgetypes { color: var(--b2-lavender); }`
- `.scrap-slip.is-failed { color: var(--b2-red); }`
- `.scrap-slip.is-pulse { animation: b2-scrap-pulse 380ms ease-out; }`
- `@keyframes b2-scrap-pulse { 50% { transform: scale(1.08); } }`
- `.b2-hud__nosalvage { color: var(--b2-red); font-family: var(--b2-display); font-size: 10px; letter-spacing: 0.08em; }`
- On the mobile HUD, allow the run line to wrap under the health plate without covering the center lineup: `.b2-hud__run { max-width: 230px; }`.
- Reduced motion: disable `b2-scrap-pulse`.

- [ ] **Step 20.6: Pause CSS**

In `panels.css`:

- `.b2-pause__run { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 3px solid var(--b2-ink); background: rgba(255, 255, 255, 0.05); }`
- `.b2-pause__runline { margin: 0; color: var(--b2-white); font-family: var(--b2-display); font-size: 13px; letter-spacing: 0.04em; }`
- `.b2-pause__build { display: flex; flex-wrap: wrap; gap: 6px; }`
- `.b2-pause__edge { padding: 3px 7px; background: var(--b2-panel-dark); color: var(--b2-lavender); font-family: var(--b2-display); font-size: 10px; }`
- `.b2-pause__rare { align-self: flex-start; background: var(--b2-yellow); color: var(--b2-ink); }`
- `.b2-pause__run + .b2-pause__shop { margin-top: 10px; }`

- [ ] **Step 20.7: Visual QA**

Start the dev server:

```powershell
npm run dev
```

Open `http://localhost:5173/?unlock` and check, at 1280×800, 390×844, and 360×640:

1. Lobby: top row wraps at 360px with the night chip first and daily/scrap sharing the second row; the daily chip is never clipped.
2. Lobby: CONTINUE RUN shows the floor/streak/types/score line; the goal strip sits under the button and does not crowd PLAY.
3. Short screen (height ≤ 560px): the goal strip collapses to one line and the hero is 26vh.
4. Store: five upgrade cards, tabs visible, loop scrolls, BUY disabled with `NEEDS N SCRAP`, purchases update the wallet and pips without rebuilding.
5. Ledger: 12/27, 150-star line, next strip, PAID/NEXT/LOCKED rows.
6. Evidence: filters scroll horizontally, missing recipes are readable, the grid is 1–2 columns on phones.
7. Key wall: run strip, CONTINUE RUN vs START NEW RUN, two-tap confirm, ENTER starts the room.
8. Results: at 390px the draft appears before the small print; the actions stay outside the scroll; the first Edge card is focused.
9. HUD: run line under the health bar, live scrap, failure snap-back with NO SALVAGE.
10. Pause: CURRENT RUN above POWERS, legendary tag, MAIN MENU · RUN SAVED.
11. Reduced motion: enable the OS setting and confirm no card stagger, no goal pulse, no scrap pulse.

Save screenshots under `.screenshots/progression-*.png` for the session record. **Do not stage or commit them.**

- [ ] **Step 20.8: Run the suite and both builds**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 20.9: Commit**

```powershell
git add src/ui-kit/bonk2/shop.css src/main.ts src/ui-kit/bonk2/results.css src/ui-kit/bonk2/lobby.css src/ui-kit/bonk2/rooms.css src/ui-kit/bonk2/hud.css src/ui-kit/bonk2/panels.css
git commit -m "style: finish the progression screens and mobile layout"
```

---

### Task 21: Final verification, docs, and the CrazyGames package

**Files:**
- Modify: `CRAZYGAMES.md`
- Modify: `README.md`
- Modify: `dist-crazygames/index.html` (build output)
- Modify: `bonk-crazygames.zip` (build output)
- Modify: `../public/arcade/bonk` (web build copy)

- [ ] **Step 21.1: Correct the public counts and document the new loop**

- `CRAZYGAMES.md` line 122: change `131 discoveries` to `166 discoveries`, and extend the same cell with `permanent home upgrades, a 27-star ledger, and a first-clear daily`.
- `CRAZYGAMES.md` “Fast to load” line: update the size numbers after the final build (use the actual `index.html` and zip lengths).
- `README.md` line 50: change `(52 to find)` to `(166 to find)`.
- In `CRAZYGAMES.md`, under the description section, add one short paragraph:
  > Between rooms, pick one of three Edges. The build survives a failed room, the run score rolls back, and the failed room pays no scrap. Permanent home upgrades, a 27-star Ledger, and a first-clear daily give returning players a reason to come back.
- Do not claim new assets, network calls, or a second currency.

- [ ] **Step 21.2: Run the full verification from a clean state**

```powershell
npm test
npm run typecheck
npm run build
npm run build:crazygames
```

Expected:
- every test file passes;
- no TypeScript errors;
- `dist/` and `dist-crazygames/index.html` are written;
- the CrazyGames build is one file.

- [ ] **Step 21.3: Check the package is self-contained**

```powershell
$html = Get-Content dist-crazygames/index.html -Raw
$external = [regex]::Matches($html, '(?:src|href)="(https?://[^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$external
```

Expected: only the CrazyGames SDK URL (`https://sdk.crazygames.com/crazygames-sdk-v3.js`). No fonts, images, analytics, or other network calls.

```powershell
Select-String -Path dist-crazygames/index.html -Pattern 'assets/' -SimpleMatch
```

Expected: no matches (all images and styles are inlined).

- [ ] **Step 21.4: Rebuild the zip**

```powershell
Compress-Archive -Path dist-crazygames/index.html -DestinationPath bonk-crazygames.zip -Force
```

Then verify:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path bonk-crazygames.zip))
$zip.Entries | Select-Object FullName,Length
$zip.Dispose()
```

Expected: exactly one entry, `index.html`, at the root.

- [ ] **Step 21.5: Refresh the web build in `public/arcade/bonk`**

Preserve `poster.jpg`; replace the hashed build output:

```powershell
Remove-Item -Recurse -Force ..\public\arcade\bonk\assets
Remove-Item -Recurse -Force ..\public\arcade\bonk\sfx
Copy-Item -Recurse -Force dist\* ..\public\arcade\bonk\
```

Verify:

```powershell
Get-ChildItem ..\public\arcade\bonk | Select-Object Name,Length
Select-String -Path ..\public\arcade\bonk\index.html -Pattern 'assets/index-' -SimpleMatch
```

Expected: `index.html`, `poster.jpg`, `assets/`, `sfx/`; the HTML references the new hashed asset.

- [ ] **Step 21.6: Smoke-test both builds**

- Serve the CrazyGames build:
  ```powershell
  npx vite preview --outDir dist-crazygames --port 4173
  ```
  Open `http://localhost:4173/`. Check: menu loads, STORE opens, LEDGER and EVIDENCE tabs render, a room starts, no console errors. On localhost the CrazyGames SDK runs in test mode.
- Serve the web build:
  ```powershell
  npm run preview
  ```
  Open the printed URL, then open `/arcade/bonk/` from the parent site if the site is running. At minimum, confirm `dist/index.html` loads its hashed assets and the game starts.
- If a `file://` smoke test is used instead, expect the CrazyGames SDK script to fail offline; the game itself must still render.

- [ ] **Step 21.7: Record the final sizes**

```powershell
Get-Item dist-crazygames/index.html, bonk-crazygames.zip | Select-Object Name,Length
Get-FileHash dist-crazygames/index.html -Algorithm SHA256
```

Use these numbers in `CRAZYGAMES.md` if they differ from the placeholder text.

- [ ] **Step 21.8: Check the diff for forbidden paths**

```powershell
git status --short
git diff --name-only
```

Expected: no `.screenshots`, `.superpowers`, `crazy-goal/assets/crazy-kora-svg-pack.zip`, or `reels/` entries.

- [ ] **Step 21.9: Commit**

```powershell
git add CRAZYGAMES.md README.md bonk-crazygames.zip dist-crazygames/index.html
git add -A ../public/arcade/bonk
git commit -m "chore: rebuild the crazygames package for progression"
```

- [ ] **Step 21.10: Final report**

Report, with evidence:

- the four verification commands and their results;
- the final package size, zip size, and SHA-256;
- the screens checked and their viewport sizes;
- any deviation from the spec, including the pet-math flag (`3 × PET FRENZY + max PET TRAINING` is `3.7×`, not the spec’s `2.22×`);
- confirmation that the forbidden paths are untouched.
