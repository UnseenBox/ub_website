# Level Design & Environment Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all 100 generic rectangular football pitches with handcrafted street-football
puzzles that each have their own silhouette, surface, landmark, obstacle logic and trick-shot
identity, while keeping the camera frame, HUD, scoring formula, save format and physics
determinism untouched.

**Architecture:** The arena rectangle stays as the camera/HUD frame. Inside it, a new optional
`boundary` field replaces the four default rails with an ordered outline polygon of the playable
ground; `Level` converts that outline into overlapping rotated-box wall segments (plus a square
pillar at every vertex) so the loop is always closed and the ball can never leak. A new `surface`
field selects one of thirteen street-surface painters, and a new `dressing` field adds flat
landmark decals. A shape library in `data/levels/shapes.ts` provides ~20 outline archetypes so
each of the 100 levels composes a distinct topology from named pieces rather than by nudging
rectangles.

**Tech Stack:** TypeScript (strict), Vite 8, Canvas 2D, custom deterministic circle-vs-rotated-box
physics at 240 Hz. No new runtime dependencies. Validation through the existing
`window.__cg.sweep` test hooks.

---

## Constraints (must not regress)

| Thing | Rule |
| --- | --- |
| `arena` | Unchanged: `{ x: 450, y: 170, w: 700, h: 940 }`. Camera, HUD and shadows depend on it. |
| Goal | Stays in the top wall at `lineY = 170`. `GoalDef.x` may vary per level; posts move with it. |
| HUD / menus / result / pause / shop | Not touched. |
| Scoring | `src/scoring/*` untouched. `stars` thresholds may only move with measured evidence. |
| Save format | Untouched. Level ids stay `houma-01` … `houma-100`. |
| Physics | Circle vs rotated box only. No new collider primitives. Deterministic. |
| Duel rounds | `src/duel/DuelLevels.ts` untouched; duel levels keep the default rectangle boundary. |
| Arabic | Every new level name and hint gets an entry in `src/core/i18n.ts`. |

---

## Task 1 — Schema: variable boundary, surfaces, dressing

**Files:** `src/levels/LevelDefinition.ts`, `src/levels/Level.ts`

### 1.1 `src/levels/LevelDefinition.ts`

Add:

```ts
/** How the street is paved. Only the look changes; the ball behaves the same on all of them. */
export type Surface =
  | 'asphalt'    // worn tarmac, patched and oil-stained
  | 'concrete'   // poured slabs, hairline cracks
  | 'paving'     // the old ochre paving stones of the houma
  | 'terracotta' // market tiles
  | 'sand'       // beach sand
  | 'cracked'    // broken cement with weeds
  | 'rooftop'    // roof screed with felt patches
  | 'patches'    // asphalt with concrete repair patches
  | 'drains'     // street with a grid of manhole covers
  | 'tiles'      // courtyard zellige tile
  | 'cobble'     // old cobblestones
  | 'ice'        // frozen street
  | 'wet';       // rain-slick asphalt
```

Add:

```ts
/** A flat piece of street furniture drawn on the ground. Never solid, never in the way. */
export type DressingKind =
  | 'garage'      // blue garage door painted into a wall face
  | 'cafe'        // café frontage with two tables
  | 'mural'       // painted wall mural
  | 'fountain'    // little courtyard fountain
  | 'stairs'      // stairway up to a doorway
  | 'stall'       // market stall canopy and trestle
  | 'washline'    // washing line between two poles
  | 'manhole'     // iron manhole cover
  | 'puddle'      // shallow puddle
  | 'parking'     // painted parking bays
  | 'phonebox'    // red phone box
  | 'planter'     // concrete planter with a shrub
  | 'signpost'    // street sign
  | 'grill'       // café awning / char grill
  | 'barrel';     // oil drum

export interface DressingDef {
  kind: DressingKind;
  x: number;
  y: number;
  /** Radians, clockwise on screen. */
  angle?: number;
  /** Size hint: 1 = normal. */
  scale?: number;
}
```

Add:

```ts
/**
 * The shape of the playable ground. `points` runs from the left goal post, around the
 * street, to the right goal post. The engine closes the loop at the two ends of the top
 * wall and leaves only the goal mouth open.
 */
export interface BoundaryDef {
  points: readonly Point[];
  /** Kind for each edge. Edge 0 is the closure at the top-left corner, edge n is the
   * closure at the top-right corner; the ones between are the street edges themselves. */
  kinds?: readonly WallKind[];
  /** Wall band thickness. Defaults to `RAIL_THICKNESS`. */
  thickness?: number;
}
```

Extend `LevelDefinition`:

```ts
export interface LevelDefinition {
  // ... existing fields unchanged ...
  /** When present, replaces the default rectangular rails. */
  boundary?: BoundaryDef;
  /** What the ground is made of. Defaults to `paving`. */
  surface?: Surface;
  /** Flat landmarks painted on the ground. */
  dressing?: readonly DressingDef[];
}
```

### 1.2 `src/levels/Level.ts`

- Add `export const BOUNDARY_THICKNESS = 26;`
- `Block` gains `readonly theme?: Theme` so boundary walls can be tinted per chapter.
- `Level` gains:
  - `readonly playable: readonly Point[]` — closed polygon of the playable ground
    (starts at the arena top-left corner, ends at the arena top-right corner).
  - `readonly hasCustomBoundary: boolean`
- `build()`:
  - If `def.boundary` exists: build the boundary from the outline.
    1. `left = goal.leftPostX`, `right = goal.rightPostX`.
    2. Closed vertex list `V = [ {x:arena.x, y:arena.y}, ...points, {x:arena.x+arena.w, y:arena.y} ]`.
    3. For each consecutive pair, add a wall band: a rotated box of width `len + t`, height `t`,
       centred on the midpoint, angle = `atan2(dy, dx)`, kind from `kinds`.
       The first edge (`V0 → points[0]`) and the last edge (`points[last] → Vn`) are the top
       closures; the edge closing the loop back over the goal mouth is **not** built (the
       goal sits there) except as the two closure segments already covering it.
    4. At every vertex except the two goal posts, add a square pillar of `t × t` so no seam
       can leak. The two goal posts are left alone (the `Goal` owns them).
    5. `playable` = the closed polygon `V` plus the closing edge `Vn → V0` (the straight top
       line, which runs across the goal mouth).
  - If absent: keep today's four default blocks exactly as they are and set
    `playable` to the four arena corners.

Verification: `npm run typecheck` passes; the duel levels still build the same 4 rails.

---

## Task 2 — Shape library

**File:** `data/levels/shapes.ts` (new)

Exports a builder per archetype. Every builder takes `(arena, goal, opts)` and returns
`BoundaryDef`. Names:

| Builder | Silhouette |
| --- | --- |
| `rect` | plain rectangle (kept for the tutorial level) |
| `chamfer` | two 45° corners cut off |
| `dogleg` | one side steps in and out, S-shaped alley |
| `zigzag` | alternating side notches, three bays |
| `courtyard` | narrow throat at the bottom, wide square in the middle |
| `atrium` | octagonal, chamfered on all four corners |
| `fan` | wide at the bottom, narrow at the top |
| `tapers` | narrow at the bottom, wide at the top |
| `pocket` | rectangle with one deep side pocket |
| `terrace` | stepped sides like a hillside terrace |
| `harbour` | angled bottom edge, quay wall |
| `pinch` | hourglass, narrow waist |
| `comb` | three bays cut into one side (workshops) |
| `cross` | plus-shaped ground |
| `spiral` | outer shell plus a spiral of interior walls |
| `asym` | flat left wall, broken right wall |
| `hook` | L-shaped ground with one long leg |
| `wedge` | V-shaped ground, narrow at the bottom |
| `stair` | staircase of alternating treads |
| `plaza` | wide rectangle with deep alcoves left and right |

Each builder produces points that start exactly at `(goal.leftPostX, arena.y)` and end exactly
at `(goal.rightPostX, arena.y)`, never crossing the top edge, never leaving the arena rect.

Verification: a unit-style assertion file `data/levels/shapes.check.ts` is not shipped; instead
`Task 6` validates every generated level geometrically in the browser.

---

## Task 3 — Rendering: surfaces, landmarks, no more football pitch

**Files:** `src/rendering/ArenaArt.ts`, `src/rendering/Palette.ts`

### 3.1 Kill the pitch

Delete from `paintGround`: the halfway line, the centre circle, the penalty box, and the
chalk ring/cross around the ball start. Replace the ball start marker with a per-surface mark
(a chalk X on paving, a painted spot on asphalt, a raked circle in sand).

### 3.2 Surfaces

Add a `SURFACES` record mapping each `Surface` to `{ base, alt, line, grit, kind }` and a
painting routine. Each routine must:

- fill the base colour inside the playable polygon only (clip path from `level.playable`);
- lay a texture that reads at a glance (tarmac patches, paving bond, tile grid, sand ripples,
  cobble rows, ice cracks, tar seams);
- add 1–3 *environment marks* (manhole, drain grate, oil stain, crack, weed tuft, puddle ring);
- stay cheap: no per-pixel work, no gradients over the whole arena.

Themes still drive the surrounding neighbourhood (`paintBackdrop`) — that already varies.

### 3.3 Boundary band art

In `drawBlock`, the `wall` kind gains a theme tint: a snow cap on top for `snow`, a warm lamp
glow line for `night`, and a terracotta shade for `clay`. `Block.theme` is set from
`def.theme`.

### 3.4 Landmarks

New exported `paintDressing(ctx, level)` called from `paintGround`, drawing each
`DressingDef` flat on the ground with a soft shadow, in the surface palette, at low contrast so
the ball and trajectory stay legible.

### 3.5 Goal line

Keep a clear goal line (it matters for readability) but style it per surface instead of a
white bar.

Verification: `npm run typecheck`, then Task 6 screenshots.

---

## Task 4 — The 100 levels

**File:** `data/levels/houma.ts` (full rewrite of the level bodies, keeping ids and order)

Rules for every level:

1. A **new name** and a **new hint** that state the level's actual idea. No two levels share a
   name.
2. A **shape** from the library that no other level in the same chapter uses more than once;
   neighbouring levels must have different silhouettes.
3. A **surface** that fits the story.
4. 2–6 **landmarks** placed against the walls, not in the ball's way.
5. **Interior walls** that create the puzzle: corridors, rooms, staggered gaps, angled baffles.
6. **Mechanics** that earn their place: every mechanic must change a route.
7. `ballStart` inside the playable ground, usually off-centre.
8. `goal.x` varied on roughly a third of the levels so the mouth is not always centre.
9. `stars` thresholds carried over from the old level where the difficulty is comparable;
   re-tuned only after Task 5 measurement.

Chapter identities:

| # | Chapter | Ground language | Signature mechanics |
| --- | --- | --- | --- |
| 1 | THE HOUMA (1–12) | paving, concrete, asphalt | wall, crate, car, tyre, pipe, scooter, glass, bell, cat |
| 2 | NEW GROUNDS (13–24) | sand, tiles, ice, wet, patches | water, sand, ice, grass, boost |
| 3 | CRAZY LEAGUE (25–36) | terrazzo, cobble, tiles | bumper, spinner, fan, hedge |
| 4 | LEGENDS (37–48) | sunset concrete, night asphalt, snow | mixed, spectacle set pieces |
| 5 | STREET KINGS (49–60) | dense paving + asphalt | mazery interiors, narrow windows |
| 6 | NIGHT LEAGUE (61–72) | wet asphalt, drains | scooter traffic, fans, timing |
| 7 | GOLDEN HOUR (73–84) | terracotta, sand, rooftop | slope, boost, angled walls |
| 8 | HALL OF FAME (85–96) | every surface | remixes with two mechanics per room |
| 9 | THE FINALS (97–100) | signature surfaces | everything, handcrafted |

Verification: `npm run typecheck` and the sweep in Task 5.

---

## Task 5 — Arabic

**File:** `src/core/i18n.ts`

Add an entry for every new level name and every new hint (200 strings). Keep the existing
entries that are still used.

Verification: `npm run typecheck`; a script checks every `name`/`hint` in `houma.ts` has an
`AR` entry.

---

## Task 6 — Validation

**Files:** `src/debug/TestHooks.ts` (add a `shape` hook), ad-hoc browser scripts

New hook:

```ts
/** The playable outline and the boundary blocks of a level, for geometry checks. */
shape(levelNumber?: number): { points: Point[]; blocks: number; goalX: number; width: number };
```

Checks, run over all 100 levels in the browser:

1. **Containment** — every level's boundary is closed (no gap larger than the wall thickness),
   the goal mouth is the only opening, and the ball never leaves the playable polygon.
2. **A route exists** — `__cg.sweep(n, 1, [...])` returns at least one hit for every level.
3. **Stars reachable** — for each level, the best swept score is compared with the thresholds;
   where the 2nd/3rd star is unreachable from the swept best, thresholds are lowered to the
   measured best (never raised).
4. **No escape** — sweep with a `dist` check: if the ball leaves the arena rect it is a bug.

---

## Task 7 — Previews and contact sheets

- A browser script loads each level, waits one frame, and captures the canvas via
  `toDataURL`, saving 100 PNGs under `docs/previews/`.
- Nine contact sheets (one per chapter, 12 tiles each) are composed by a Node script using
  `sharp`-free pure canvas drawing (or by an HTML page rendered in the browser and captured).
- Close-ups for the 12 most complex levels.

---

## Task 8 — Final report

Report, in the chat response:

1. Analysis of the old repetition (with the counts measured in reconnaissance).
2. The new level-design system (shapes, surfaces, composition rules).
3. The geometry implementation (schema, closure rule, determinism).
4. All 100 levels (chapter-by-chapter table of name / shape / surface / idea).
5. Validation results (sweep hits per level, stars, containment).
6. Screenshot / contact-sheet locations.
7. Modified-file list.
8. Remaining problems — explicitly separating implemented-and-verified from
   implemented-but-not-playable-here (no audio output, no real touch device, no CrazyGames SDK
   in this environment).
