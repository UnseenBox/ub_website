# BONK: Night Shift — opening, powers, and branching runs

**Goal:** make the first ten seconds action, make powers one key, and turn PLAY into a
short branching run that tours the whole building. Keep every room, boss, asset and the
existing BONK 2.0 visual kit.

**Non-goals:** no new art, no new rooms, no changes to Endless or Daily, no rewrite of the
renderer or physics. The lobby redesign already in the working tree is left alone.

---

## 1. Controls: P is POWER, Esc is pause

- `src/input/KeyboardMouseInput.ts`
  - `KeyP` sets `raw.abilitySlot = -1` (the existing "first ready" path).
  - `Escape` emits `pause`.
  - Remove `Digit1`, `Digit2`, `Digit3`.
- `src/input/InputManager.ts` — update the `abilitySlot` comment: `-1` is POWER on every
  device.
- `src/gameplay/Abilities.ts` — every definition's `key` becomes `'P'`; document that
  P fires the first ready power and the definition key is only a label.
- `src/entities/Player.ts` — comment only: "P on desktop, the POWER button on touch."
- `src/ui/screens/hud.ts`
  - Coach art for `power` shows `P`, not `1`.
  - Power chips: only the first *ready* power carries the `P` keycap; it moves to the
    next ready chip when the first goes on cooldown. Chip `aria-label` says
    "P fires the first ready power".
- `src/ui/screens/pause.ts` — manual rows become `P = power`, `Esc = pause`. Touch manual
  keeps `POWER`.
- `src/gameplay/Tutorial.ts` — the power caption becomes `AIM + P`.

**Tests:** no keyboard test exists; the pause DOM test must still build. Add assertions to
`pause.test.ts` only if it already checks the control list.

---

## 2. Action-first room 1

Current opening: walk → grab → throw → power → pet → zap → free. The first mover waits
for the player to find the pan. Replace the mandatory plan with **throw → power → free**;
pet and the wet socket stay in the room as optional toys.

- `Tutorial.LESSONS = ['throw', 'power', 'free']`.
  - `Lesson` keeps `pet` and `zap` for old saves and for the optional code paths.
  - `MOVERS`: `throw: 1`, `power: 2`, `free: 5` (8 movers, matching room 1).
  - `begin(from)` coerces legacy selections: `move`/`grab` → `throw`; `pet`/`zap` → `free`.
- `Player.equip(game, object)` — public wrapper around the private `grab`, used by the
  opening. No gameplay rules change.
- `Game.enterRoom`
  - Default lesson becomes `throw` (not `move`).
  - On a first tutorial entry, put the pan in the hero's hand immediately after the room
    loads. The throw lesson already opens the first door after 0.9 s, so the first fight
    starts without a walk or a click.
- `Tutorial.enter('free')` banner becomes
  `ANYTHING = WEAPON` / `treat feeds the pet · water + socket`, teaching the optional
  systems in one line instead of gating them.
- The free brawl releases its five movers staggered (existing `release()` gap), so it is
  loud but survivable.

**Tests to update:** `Game.tutorial-flow.test.ts` currently expects `move`, a grab event,
and a linear `nextRoom()`. Rewrite it around: starts in `throw`, pan held, first mover
within ~2 s, clear → results → doors → chosen room.

---

## 3. Night Shift branching

### 3.1 `src/gameplay/NightShift.ts` (new, pure)

```ts
export type DoorRewardKind = 'scrap' | 'edge' | 'armor';

export interface DoorReward {
  kind: DoorRewardKind;
  /** Big line on the card, e.g. "+70 SCRAP". */
  label: string;
  /** Small supporting line. */
  detail: string;
  scrap?: number;
  edge?: EdgeId;
}

export interface DoorRisk {
  /** Short chip, e.g. "BOSS", "HAZARD", "CLOCK". */
  label: string;
  detail: string;
}

export interface Door {
  index: number;
  number: number;       // 1-based room number
  name: string;         // room name
  actName: string;      // ACT I · EVICTION NOTICE
  actTagline: string;
  reward: DoorReward;
  risk: DoorRisk;
}

export const SHIFT_PICKS = 8;
export const SHIFT_DOORS = 3;

/** Tier of a room index: 0..4, ten rooms per act. */
export function shiftTier(index: number): number;

/** How many rooms (excluding the finale) this shift will visit from `startIndex`. */
export function shiftPicks(startIndex: number): number;

/** Stable door from stored state; rewards derive from `seed` + room index. */
export function buildDoor(
  index: number,
  def: RoomDefinition,
  tier: number,
  seed: number,
): Door;

/** Distinct candidate room indices for this step, excluding visited rooms. */
export function nextDoorIndices(
  step: number,
  startIndex: number,
  visited: readonly number[],
  finale: number,
  pick: (rng: Rng) => number,
): number[];
```

Rules:
- Tier bands: 0–9, 10–19, 20–29, 30–39, 40–48; room 49 is always the finale.
- The tier schedule starts at the starting room's tier and walks to tier 4:
  `tier(k) = min(4, startTier + floor(k * (5 - startTier) / SHIFT_PICKS))` for
  `k = 0..shiftPicks(startIndex)-1`. Eight picks plus the starting room and the
  finale make a ten-room night.
- Candidates are unvisited rooms in that tier. If the tier has fewer than two left, widen
  to every unvisited room from `startTier` up (never the finale).
- A door's reward is one of: `+scrap` (tier-scaled), a random Edge, or `+1 armour` for the
  next room. When three doors are offered, all three kinds appear in a random order, so
  every choice is a real trade. With two doors, two distinct kinds.
- Risk is honest and read from the room definition: boss → `BOSS`, survival objective →
  `CLOCK`, hazardous theme → `HAZARD`, otherwise `CREW`. No hidden modifiers.
- `buildDoor` uses `new Rng(hashString(`${seed}:${index}`))` so a stored door rebuilt on
  resume shows the same reward.

### 3.2 Save v9

`src/save/SaveManager.ts`:
- `SAVE_VERSION = 9`.
- New fields:
  - `runPath: number[]` — rooms entered this shift, in order.
  - `runDoors: number[]` — up to three pending door candidates.
  - `runSeed: number` — seed for door generation.
  - `runArmor: number` — armour granted by a door, consumed on entering the next room.
- `defaults`, `migrate` (`if (version < 9) { ... }`), and `sanitize` clamp indices to
  `0..FINAL_ROOM_INDEX`, dedupe `runDoors`, keep `runArmor` at 0..3, and keep a whole
  non-negative `runSeed`.
- `src/gameplay/Run.ts` extends `RunState` with the same fields and resets them in
  `startRun` / `endRun`; `sanitizeRun` clamps them and clears doors when the run dies.

### 3.3 Game flow

`src/core/Game.ts`:
- `RoomSummary.doorChoice: boolean` — true on a cleared campaign room with a pending door
  choice. Results uses it for the primary label.
- `GameUi.showDoors(doors: Door[], step: number, total: number): void`.
- `playFrom(index)` sets `runPath = [start]`, a fresh `runSeed`, clears doors/armour, then
  enters the room.
- `enterRoom` appends the room to `runPath` (no duplicates), then applies `runArmor` to the
  freshly built player and zeroes it. This is campaign-only (not daily/endless/menu).
- `continueRun()`:
  - if `runDoors` is non-empty, show the doors at the saved step;
  - otherwise repair an old save (`runPath = [runFloor]`, seed from `runFloor`) and enter
    the room.
- `summarize()` after a successful campaign clear:
  - append the current room to the path if needed;
  - if not the finale, generate and store `runDoors` for the next step (or the finale when
    the schedule is exhausted);
  - set `doorChoice = runDoors.length > 0`;
  - never generate doors for Daily or Endless.
- `nextRoom()` becomes "open the door choice": await the ad, then call `openDoors()`.
  Finale/daily still return to the menu.
- `openDoors()` rebuilds `Door` objects from `runDoors` (or generates them), sets state
  `cleared`, and calls `hud.showDoors(...)`.
- `chooseDoor(index)` validates against `runDoors`, applies the reward, clears the pending
  doors, pushes the path, sets `runFloor`, writes the save, and enters the room.
  - `scrap`: add to `save.scrap`.
  - `edge`: add to `save.runBoosts` (respect `EDGE_STACK_CAP`).
  - `armor`: `save.runArmor = min(3, runArmor + 1)`.
- `toMenu()` keeps pending doors intact so CONTINUE reopens them.
- `abandonRun()` / finale `endRun` clears path and doors through `endRun`.
- `summarize()` captures `shiftRooms` from `runPath` before a finale wipes it, so the
  results card reports the real shift length instead of a hardcoded 50 floors.
- `ReportProgress`, difficulty, endless, daily and Edge systems are untouched.

### 3.4 Door screen

- `src/ui/screens/doors.ts` (new): `buildDoors(doors, step, total, actions)`.
  - Stage/panel structure matching `results.ts`.
  - Kicker `NIGHT SHIFT · CHOICE N OF 9` (schedule length + the finale door).
  - Title `PICK A DOOR.`
  - Three big cards, each a `<button>` with room number, act, name, reward line, risk chip
    and `TAKE THIS DOOR`. Boss risks name the actual boss.
  - `BACK TO THE LOBBY` secondary action; the footer says the run is saved and CONTINUE
    reopens the doors.
  - The exhausted schedule becomes a single finale door: kicker
    `NIGHT SHIFT · THE LAST DOOR`, title `ONE DOOR LEFT.`
  - Focus the first card.
- `src/ui/screens/lobby.ts` / `lobby.css`: an additive `CONTINUE · PICK A DOOR` /
  `CONTINUE · ROOM N` button above PLAY when `runActive`, so a quit shift is resumable.
- `src/ui-kit/bonk2/doors.css` (new): night-shift navy, cream cards, chunky ink border,
  lime scrap / blue edge / yellow armour accents, red risk chip, hover lift, focus ring,
  reduced-motion guard, 1/2/3-door layouts.
- `src/main.ts` imports the stylesheet.
- `src/ui/UI.ts`:
  - implement `showDoors`;
  - results `next()` still calls `game.nextRoom()`, which now opens doors.
- `src/ui/screens/results.ts`:
  - primary label is `PICK A DOOR` when `summary.doorChoice`, `NEXT ROOM` otherwise;
  - the finale chip reads `RUN COMPLETE · N ROOMS`, not `50 FLOORS`.

---

## 4. Verification

- `src/gameplay/NightShift.test.ts` (new):
  - the tier schedule visits tiers 0→4 and always ends at the finale;
  - candidates never repeat visited rooms or the finale;
  - three doors always carry three distinct reward kinds;
  - the same seed rebuilds the same reward for the same room.
- Update `SaveManager.test.ts` to v9 and add a v8→v9 migration test.
- Update `Run.test.ts` fixtures for the new fields.
- Update `Game.tutorial-flow.test.ts` for the action-first opening and door choice.
- Update `results.test.ts` for the `PICK A DOOR` label and the new fixture field.
- Run `npm test` and `npm run typecheck` in `everything-is-a-weapon`.

## 5. Acceptance

1. A brand-new save starts in room 1 with the pan in hand and a mover at the door within
   roughly two seconds; the first kill can land before ten seconds.
2. P fires the first ready power; Esc pauses; 1/2/3 do nothing.
3. A campaign clear shows `PICK A DOOR`, three doors with room, reward and risk, and the
   chosen room starts immediately.
4. Quitting to the menu mid-choice and pressing CONTINUE reopens the same doors, with the
   same rewards.
5. A shift finishes at THE LAST DOOR, and the final victory still ends the run.
6. Endless and Daily flow exactly as before.
