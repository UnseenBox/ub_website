# CRAZY KORA — Street Level Overhaul

**Validation report — 7 November 2026**

This report separates what was implemented and verified from what could not be
verified in this environment. The work is **uncommitted** in the working tree.

---

## 1. Scope delivered

All 100 levels keep their ids (`houma-01` … `houma-100`), save format, nine
chapter boundaries and progression. The menu, HUD, level selector, result
screens, pause screen and shop were not redesigned. Chapter titles are unchanged.

Every level now defines its own street:

- **Boundary outline** — a closed polygon from left post → left wall → bottom →
  right wall → right post, built from rotated collision bands. Supports variable
  widths, bays, alcoves, angled walls, corridors, corner cutouts and connected
  sections.
- **Surface** — one of 13 painters (`paving`, `concrete`, `terracotta`,
  `asphalt`, `cobble`, `tiles`, `sand`, `wet`, `ice`, `cracked`, `rooftop`,
  `drains`, `patches`).
- **Dressing** — one of 15 non-physical landmarks (`stall`, `grill`, `cafe`,
  `fountain`, `phonebox`, `garage`, `parking`, `planter`, `washline`,
  `signpost`, `barrel`, `puddle`, `manhole`, `mural`, `parking` etc.).
- **Physics unchanged** — circles and rotated boxes only; deterministic fixed
  timestep. Rendering clips to the playable polygon; the generic pitch painter
  is removed.

### Shape library

23 outline archetypes in `data/levels/shapes.ts`:
`rect`, `alcove`, `dogleg`, `bulge`, `tapers`, `courtyard`, `atrium`, `terrace`,
`hook`, `harbour`, `twin`, `comb`, `fan`, `wedge`, `docks`, `plaza`, `zigzag`,
`cross`, `lane`, `asym`, `stair`, `ramp`, `pinch`.

Chapter shape use was audited from the level data:

| Chapter | Levels | Distinct shapes | Surfaces |
|---|---|---|---|
| THE HOUMA | 1–12 | 9 (four onboarding `rect`s) | paving, concrete, terracotta, asphalt, drains, tiles, patches |
| NEW GROUNDS | 13–24 | 12, no repeats | sand, tiles, ice, wet, cracked, asphalt, drains, terracotta |
| CRAZY LEAGUE | 25–36 | 12, no repeats | concrete, cobble, tiles, sand, terracotta, ice, rooftop |
| LEGENDS | 37–48 | 12, no repeats | concrete, wet, cobble, ice, asphalt, rooftop, tiles, cracked, paving |
| STREET KINGS | 49–60 | 12, no repeats | paving, asphalt, cobble, patches, sand, tiles, wet, terracotta |
| NIGHT LEAGUE | 61–72 | 12, no repeats | wet, asphalt, drains, concrete, cobble, ice |
| GOLDEN HOUR | 73–84 | 12, no repeats | sand, terracotta, rooftop, tiles, cracked, asphalt |
| HALL OF FAME | 85–96 | 12, no repeats | concrete, asphalt, tiles, rooftop, wet, drains, paving, ice, sand, terracotta |
| THE FINALS | 97–100 | 4, no repeats | tiles, ice, drains, terracotta |

The only duplicate-shape chapter is the tutorial chapter, where four `rect`
layouts introduce the mechanic before the silhouette vocabulary begins.

---

## 2. Static verification

| Check | Result |
|---|---|
| TypeScript (`npx tsc --noEmit`) | clean, no output |
| Arabic translation audit (`check-i18n.mjs`) | `strings 199 missing 0` |
| Playable polygon simple (no self-intersections), all 100 | pass |
| `ballStart` inside playable polygon, all 100 | pass |
| Level ids / save keys / chapter titles | unchanged |

Boundary bands are constructed overlapping at every vertex, so the collision
outline is closed by construction. Sweeps below found goal or miss on every
shot; no shot was observed escaping the playable polygon, but an exhaustive
adversarial escape fuzzer was not run.

---

## 3. Route and star validation

### Method

- `__cg.sweep(level, stepDeg, powers, delay)` runs fresh level instances per
  shot, so broken glass, rung bells and moved scooters never carry over.
- Baseline: 1° around the full circle × powers
  `0.4, 0.55, 0.7, 0.85, 1.0` (1,800 shots per level).
- Exceptions: 0.5° × seven powers, plus pre-roll delays for moving parts.
- Scoring uses the same `scoreShot` analyzer as real play.

### Result

**100 / 100 levels have at least one verified goal route.** The baseline 1°
sweep found goals on every level; 12 levels did not clear their 3-star line at
1°/five powers and were rechecked at 0.5° with more powers. L86, L88, L93, L94,
L97 and others also needed mover phase delays.

Fine-sweep evidence for the exception levels:

| Level | Stars (2★ / 3★) | Best measured | Notes |
|---|---|---|---|
| 17 | 2800 / 5000 | 8050 sim · 5870 real | scooter assist |
| 18 | 2800 / 4800 | 4930 sim · 4930 real | threshold retuned |
| 28 | 2800 / 5000 | 6020 sim · 6020 real | |
| 50 | 3400 / 6200 | 13650 sim · 13650 real | taxi pinball |
| 56 | 3600 / 6600 | 11200 sim · 11200 real | bell + cat, pre-roll |
| 57 | 3600 / 6400 | 7280 sim · 7280 real | sand |
| 58 | 3800 / 5800 | 6080 sim · 12600 real | threshold retuned |
| 68 | 3800 / 6800 | 13040 sim · 14610 real | |
| 72 | 4000 / 7200 | 16280 sim · 16280 real | glass / spinner / cat, pre-roll |
| 86 | 4000 / 7400 | 15870 sim · 15870 real | |
| 88 | 4200 / 7600 | 22750 sim · 19570 real | spinner phase |
| 90 | 4200 / 6800 | 7250 sim · 7250 real | threshold retuned |
| 93 | 4400 / 7800 | 19600 sim · 19430 real | timed pre-roll |
| 94 | 4400 / 6000 | 6960 sim · 6960 real | threshold retuned |
| 97 | 4400 / 8000 | 15750 sim · 21470 real | fine aim |
| 99 | 4600 / 8400 | 20140 sim · 19600 real | real max at a different angle |
| 100 | 4800 / 8800 | 115440 sim · 80510 real | pinball finale |

Other representative ceilings: L1 5510; L44 34960 sim / 41110 real; L64 8160;
L47 39750; L48 87400; L87 241560. These are finite bounce-driven scores, not
runaway loops. L44's former 733,980-point, 98-bounce exploit is gone; current
max is ~41k with 13 bounces.

### Star threshold changes

Only five levels had their `stars` touched:

| Level | Before | After | Evidence |
|---|---|---|---|
| 56 | temporary `[2000, 2400]` clamp | `[3600, 6600]` (restored) | 11200 real |
| 18 | `[2800, 5000]` | `[2800, 4800]` | 4930 measured |
| 58 | `[3800, 6800]` | `[3800, 5800]` | 12600 real |
| 90 | `[4200, 7600]` | `[4200, 6800]` | 7250 real |
| 94 | `[4400, 7800]` | `[4400, 6000]` | 6960 real |

No other thresholds were altered.

---

## 4. Manual play through the real input path

These shots were driven by genuine `pointerdown` / `pointermove` / `pointerup`
events on the canvas, through `InputManager` → `ShotController` → `launch` →
the live game frame. No direct `fire()` calls were used.

| Level | Aim | Power | Delay | Result |
|---|---|---|---|---|
| 1 | 96° | 0.70 | — | goal, 5510 |
| 17 | −119° | 0.98 | — | goal, 5870 |
| 18 | 41° | 0.85 | — | goal, 4930 (3★) |
| 28 | 33.5° | 1.00 | — | goal, 6020 |
| 44 | −132.5° | 0.85 | 0.2 s | goal, 41110 |
| 50 | −61.5° | 1.00 | — | goal, 13650 |
| 56 | 156.5° | 0.90 | 1.2 s | goal, 11200 |
| 57 | −111.5° | 0.90 | — | goal, 7280 |
| 58 | −111.9° | 0.92 | — | goal, 12600 |
| 64 | 115° | 0.70 | — | goal, 8160 |
| 68 | 121.8° | 1.00 | — | goal, 14610 |
| 72 | −106.5° | 0.90 | 0.6 s | goal, 16280 |
| 86 | 6.5° | 1.00 | — | goal, 15870 |
| 88 | 57.8° | 1.00 | 1.0 s | goal, 19570 |
| 90 | −70° | 1.00 | — | goal, 7250 |
| 93 | −109.5° | 0.95 | 1.1 s | goal, 19430 |
| 94 | −161.5° | 0.95 | 1.5 s | goal, 6960 |
| 97 | −85.4° | 1.00 | 1.12 s | goal, 21470 |
| 99 | −118° | 1.00 | — | goal, 19600 |
| 100 | 60° | 0.85 | 0.5 s | goal, 80510 |

Readability / feel notes from the pass:

- The ball and dotted aim preview remain legible on every tested surface.
- No HUD, overlay or control interfered with the pointer path.
- L97's high route needs fine aim; dragging past max pull (the game clamps
  length but preserves direction) gives enough angular precision. This is
  available to a real player.
- L56, L72, L88, L93, L94, L97 and L100 are timing/phase levels. Waiting for the
  mover is part of the puzzle; there is no softlock.
- L99's 20,140-point delayed sim line sits at a phase earlier than the real
  game's minimum pre-roll. It is not reachable by pointer; a real all-angle scan
  found 19,600 by a different route, so the 8,400 3★ line is still reachable.
- L18's 3★ line is tight: 4,930 measured vs 4,800 required (2.7% margin).
  It is reachable through real input, but may feel demanding.

---

## 5. Visual QA

Captured from the live game canvas with the HUD hidden, 100 PNGs at
`D:\Temp\opencode\previews\level-001.png` … `level-100.png`.

Contact sheets, also in that folder:

- `overview-all.png` — all 100 roads in one 10×10 sheet.
- `chapter-1.png` … `chapter-9.png` — one sheet per chapter.

Full-resolution spot checks were inspected for L44, L56, L87, L90 and L99:
silhouettes, surfaces, landmarks, obstacle overlap and ball contrast are
coherent; no floating or clipped dressing was observed.

Full-HUD screenshots were recaptured after a page reload:

- `D:\Temp\opencode\previews\hud-level-001.png`
- `D:\Temp\opencode\previews\hud-level-050.png`
- `D:\Temp\opencode\previews\hud-level-100.png`

They confirm the chapter card, best-score card and HUD remain in their original
screen positions with the new geometry underneath. The HUD itself was not
redesigned.

---

## 6. Not verified here

These items could not be checked in this environment and should be treated as
open:

- **CrazyGames SDK / live ad rendering.** The portal wrapper was only exercised
  locally; no live SDK or ad call was verified.
- **Audible audio.** Sound code paths compile and fire, but no output device was
  audited.
- **Real mobile hardware and touch feel.** Pointer events were synthetic mouse
  events at desktop resolution; no physical touch device was used.
- **Low-end mobile performance.** Previews and sweeps ran on desktop Chromium.
  No frame-time profile on a low-end phone was captured.
- **Human playthrough of all 100 levels.** Automated route sweeps cover every
  level; the manual pointer pass covered the 20 representative levels in §4.
- **Exhaustive softlock / escape fuzzing.** Boundaries are closed by
  construction and every sweep terminated as goal or miss, but no adversarial
  fuzzer searched for rare escapes.

---

## 7. Reproduce

```powershell
cd D:\UnseenBox\crazy-goal
npx tsc --noEmit
node D:\Temp\opencode\check-i18n.mjs
npm run dev -- --port 5191
```

In the browser console (dev build):

```js
__cg.level(44)                         // load a level
__cg.sweep(44, 0.5, [0.8, 0.85, 0.9]) // route / score sweep
__cg.sim(44, -132.5, 0.85, 4, 0.2)    // one traced shot
__cg.shape(44)                         // playable polygon
```

The pointer-play helper used for §4 was injected into the live page for
validation and is not part of the repository.

---

## 8. Working tree

All changes are uncommitted. `git status --short` shows 24 modified files plus:

- `data/levels/shapes.ts` (new)
- `src/rendering/StreetArt.ts` (new)
- `src/feedback/Juice.ts` (new)
- `docs/` (new — plan and this report)

No commit, push or branch operation was performed.


---

## 9. Variety pass, houmas 2 to 24 (2026-11-12)

**Why.** Before the pass, 95 of the 100 levels used the centred goal and 80 started the ball at (800, 1010); in houmas 2 to 24 only five levels moved the goal (4, 6, 14, 19, 20). The first twenty-four levels are where retention is decided, so seven more moved: goal, ball start, or both. No mechanic moved, no wall moved, no star threshold changed.

**How each edit was judged.** `sweepLevel` (`src/levels/sweep.ts`, the same code behind `__cg.sweep`) fires every angle at five powers at one degree steps. A route is a group of scoring shots with the same bounce count and the same street tricks within six degrees of each other. Rule: at least **3 routes**, and **at least one 3 star shot** at one degree steps. The test `src/levels/levels.validate.test.ts` asserts this for every edited level (`npm test`); `LEVEL_TABLE=1 LEVEL_OUT=table.txt npx vitest run src/levels/levels.validate.test.ts` writes the table for houmas 2 to 24.

| Level | Goal x | Ball start | Hits | Routes | 3 star shots (angles) | Best score |
|---|---|---|---|---|---|---|
| 3 FRUIT STAND | 800 → **700** | (800, 1010) → **(880, 1010)** | 115 → 128 | 8 → 9 | 7 (3) → 7 (4) | 6530 → 5850 |
| 5 PARKED | 800 → **910** | unchanged | 45 → 52 | 10 → 7 | 4 (3) → 4 (4) | 12780 → 6890 |
| 8 DELIVERY | 800 → **690** | (800, 1010) → **(900, 1010)** | 196 → 154 | 20 → 19 | 12 (10) → 19 (14) | 16910 → 9280 |
| 10 MADAME'S WINDOW | unchanged | (800, 1010) → **(700, 1010)** | 140 → 137 | 20 → 16 | 44 (29) → 25 (19) | 16630 → 10880 |
| 13 BEACH DAY | unchanged | (800, 1010) → **(700, 1010)** | 42 → 33 | 11 → 10 | 2 (2) → 5 (5) | 6320 → 6310 |
| 15 ICE RINK | 800 → **690** | (800, 1010) → **(900, 1010)** | 215 → 197 | 57 → 66 | 96 (52) → 119 (61) | 33340 → 34220 |
| 21 TYRE PARK | 800 → **900** | unchanged | 21 → 14 | 20 → 14 | 14 (14) → 11 (11) | 30210 → 21560 |

Each goal move also moves the level's `boundary` (the outline is built around the goal, so `goalAt(x)` is passed to both). Star thresholds are unchanged: every edited level still has shots for 2 and 3 stars.

**Tried and dropped.**
- Houma 21 with the ball start moved to (700, 1010) as well as the goal: **0 scoring shots**, impossible. Only the goal moved.
- Houma 23 (MARKET DAY) with the ball start moved to (720), (760) or (840): the sweep found a 40-bounce route worth 180,000 to 220,000 points (the best score had been 7,360). Left unchanged.
- Houma 22 (SEWER LINES) has only 7 scoring shots already, so it was not touched.

**After the pass, houmas 2 to 24 have 10 levels with a moved goal (4, 6, 14, 19, 20 and the five above) and 11 with the ball start 60 or more units off the centre (2, 4, 11, 16, 18, 20 and 3, 8, 10, 13, 15).**
