# DON'T LET IT SEE YOU

**It cannot see you. It can see what you are looking at.**

A browser stealth horror game where the creatures do not hunt your character. They
hunt your mouse cursor.

You control two things at once: a body that walks with WASD, and a cursor that is
your attention. The body is invisible to everything in the room. The cursor is not.
You can stand shoulder to shoulder with a creature and be perfectly safe, right up
until you point at it.

Built with TypeScript, Vite and a hand written Canvas 2D renderer. No game engine,
no physics library, no rendering framework, no art or audio assets: every pixel is
drawn procedurally and every sound is synthesised through the Web Audio API.

---

## Running it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (http://localhost:5188 by default).

```bash
npm run build      # typecheck, then build into dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit on its own
```

The production bundle is about 176 kB of JavaScript (54 kB gzipped) plus 9 kB of
CSS, with no runtime dependencies.

### Deploying

The build output in `dist/` is fully static and uses relative asset paths
(`base: './'` in `vite.config.ts`), so it works from any subdirectory.

- **Vercel / Netlify / Cloudflare Pages:** build command `npm run build`, output
  directory `dist`.
- **itch.io:** zip the contents of `dist/` (with `index.html` at the top level of
  the zip) and upload as an HTML5 project.
- **Portals (CrazyGames, GameDistribution, Poki):** upload `dist/` as is, then
  implement an `AdProvider` for the portal's SDK. See *Connecting an ad provider*
  below.

There is no backend. Progress lives in LocalStorage, and the game runs correctly
with storage blocked (it just cannot remember anything between sessions).

---

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move your body |
| `SHIFT` | Sneak. Slower and much quieter |
| Mouse | Move your attention |
| Left click | Use whatever is under the cursor. Always makes a sound |
| Right click | Cancel a timed interaction |
| `E` | Use the nearest object without pointing at it |
| `SPACE` | Hide, or come out of hiding |
| `R` | Restart the room |
| `ESC` | Pause |
| `F3` | Debug overlay (development builds only) |

Pointer Lock is never used. The cursor stays an ordinary browser cursor, because
the whole game is about what you do with it.

---

## How cursor detection actually works

This is the part worth reading, because it is the game.

No creature ever queries the player's position for the purpose of detection. They
evaluate **attention sources**, and the player's cursor is one of them. The
interface is in `src/stealth/AttentionSystem.ts`:

```ts
interface AttentionSource {
  x, y            // where the attention is
  speed           // how fast it is moving
  headingX, headingY  // which way it is pointing, persisting while still
  movementIntensity   // 0..1 agitation derived from speed
  dwellTime       // how long it has been held in one spot
  visibility      // 0..1, from the room's lighting at that point
  noiseLevel      // decaying residue of recent clicks
  isReal          // false for decoys
  potency         // how convincing it is
}
```

`CursorSensor` implements this for the real cursor. `CursorDecoy` implements it for
fake ones. Because they satisfy the same interface, every awareness rule written
once works for both, and a creature that can tell them apart only has to check
`isReal`. There is no special casing anywhere else in the codebase.

### The awareness model

`src/enemies/EnemyAwareness.ts` scores one source against one creature as a
weighted sum. Every term is tunable per creature in `EnemyDefinition.ts`:

```
proximity  = 1 - (distance / awarenessRadius)^2      inverse square, so the whole radius is live
pointing   = max(0, dot(heading, directionToCreature))^4   raised so only a real point registers
speed      = movementIntensity * (0.45 + 0.55 * proximity)
dwell      = ramp(dwellTime, 1.1s .. 3.4s) * (0.25 + 0.75 * proximity)
neglect    = (1 - pointing) * rangeFactor            the Parasite's inversion

pressure = (proximityWeight * proximity
          + pointWeight     * pointing
          + speedWeight     * speed
          + dwellWeight     * dwell
          + neglectWeight   * neglect)
          * coneMultiplier      gazeBonus inside its own gaze cone, blindMultiplier outside
          * visibility          darkness blurs attention, it never erases it
          * potency             decoys can be less convincing than the real thing
```

Then, every fixed simulation step:

```
awareness += (pressure * reactionSpeed - interestDecay) * dt
```

Boredom is always pulling awareness down, which is what gives a creature memory:
a scare does not vanish the instant you move away, it fades over a couple of
seconds. Thresholds live in `src/core/Tuning.ts`:

| Awareness | State |
| --- | --- |
| 0.30 | `SUSPICIOUS`, it stops and turns toward you |
| 0.58 | `INVESTIGATING`, it walks to where your attention was |
| 0.82 | `ALERT`, faster, and it tells the others |
| 1.00 | `PURSUING`, a detection |

### What this produces in play

Measured against the shipped tuning, in room 1:

- Cursor aimed straight at the Watcher from 130 px away: **detected in 1.35 s**.
- Cursor on the exact same pixel, approached from above so it never aims at the
  creature: **never detected at all**.
- Hound, with the cursor creeping: **nothing**. Same position, hand jittering:
  **caught in 1.75 s**.
- One click 40 px from a sleeping creature: **it wakes**. The same click from
  across the room: **it sleeps on**.

That gap between the first two lines is the entire game.

### Noise

Clicking is not UI. A click is a disturbance at a position with a loudness, in the
units the design calls for: a fingertip tap is 2, a heavy switch 5, breaking glass
10, a ringing phone 18, an alarm 25. Audible range is `level * 26` pixels, so a
tap carries 52 px and an alarm carries most of a room.

Clicking empty air still makes a sound, right where you pointed. There is no free
input.

A loud enough noise does not merely raise awareness, it **steals focus**: the
creature locks onto the noise instead of the cursor for several seconds and walks
to it, while cursor pressure against it is damped to 30%. That is what makes a
distraction work, and it works whether or not the creature is alarmed.

### Detection is not death

Being seen starts a sequence, not a game over. The creature freezes for 0.65 s (a
beat of silence, the camera pushes in, the room goes quiet), then charges. If you
break its line of sight and keep it broken for 1.5 s, it loses you, goes to
`SEARCHING`, and you bank a near miss. Surviving those is worth score. The loop the
game is built around is *oh no, wait, I can still get out of this*.

---

## Architecture

```
src/
  main.ts                  entry point and fatal-error guard
  core/
    Game.ts                mode machine, system wiring, room lifecycle
    GameLoop.ts            fixed timestep, interpolated render
    EventBus.ts            typed pub/sub
    Events.ts              the event vocabulary
    Tuning.ts              every number that decides how it feels
    Mathx.ts               vectors, rects, segment/rect intersection, seeded RNG
  input/
    InputManager.ts        abstract actions: move, sneak, interact, hide, pause
    KeyboardMouseInput.ts  desktop backend
    TouchInput.ts          touch backend scaffold (see Known limitations)
  cursor/
    CursorSensor.ts        raw pointer events to a clean, smoothed signal
    CursorController.ts    cursor state, trail, decoys, heat
    CursorState.ts         state names and the metric record
    CursorTrail.ts         visible residue of recent attention
    CursorDecoy.ts         fake cursors, five movement patterns
  stealth/
    AttentionSystem.ts     the AttentionSource interface and registry
    LineOfSight.ts         segment against axis-aligned blockers
  enemies/
    Enemy.ts               one creature: sensing, state, behaviour
    EnemyDefinition.ts     nine creatures as data
    EnemyAwareness.ts      the weighted sum above
    EnemyStateMachine.ts   state bookkeeping
    EnemyCommunication.ts  alerts between creatures
  player/Player.ts         the body
  world/
    Room.ts                live room: objects, creatures, lights, queries
    Rooms.ts               twelve hand authored rooms
    RoomGenerator.ts       seeded procedural rooms
    RoomValidator.ts       reachability gate, run before any generated room
    ObjectRegistry.ts      thirty prop kinds as data
    WorldObject.ts         a live prop
    Collision.ts           circle against AABB, axis separated
  interactions/
    InteractionSystem.ts   behaviour table, clicks, reach, hiding, light physics
    NoiseSystem.ts         sound as a gameplay object
  particles/ParticleSystem.ts
  rendering/
    Renderer.ts            canvas, DPR, letterboxing, draw order
    SceneArt.ts            room, props, character, creatures
    CursorArt.ts           the cursor, its trail, and decoys
    Lighting.ts            darkness mask and additive glow
    Camera.ts              shake and small push
    DrawUtils.ts           palette and primitives
  audio/
    AudioManager.ts        buses, room tone, heartbeat
    SoundLibrary.ts        every sound, synthesised
  gameplay/
    ObjectiveSystem.ts     objectives as conditions over world state
    ScoreSystem.ts         scoring and the perfect escape
    DiscoverySystem.ts     the discovery book, filled in by playing
    ChallengeSystem.ts     modifiers, daily challenge
    PatternMemory.ts       deterministic habit counters
    ReplaySystem.ts        seeded input recording
  ui/                      DOM overlay: HUD, menus, results
  save/SaveManager.ts      versioned LocalStorage
  ads/                     AdManager plus a mock provider
  analytics/               AnalyticsManager plus a console sink
  debug/DebugOverlay.ts    F3
```

The simulation runs at a fixed 1/60 s timestep with a five step catch-up cap, so
awareness and decay never depend on frame rate. Rendering gets whatever is left.

---

## Content

### Creatures

| Creature | What it reads | Teaches |
| --- | --- | --- |
| **The Watcher** | Proximity, and very strongly, being pointed at. Nearly deaf | The core rule |
| **The Hound** | Cursor speed only. No line of sight needed | Panic feeds it |
| **The Sleeper** | Sound and loitering. Sometimes only pretending to sleep | Clicks matter |
| **The Mirror** | Never moves, only turns. A gaze like a razor | Direction |
| **The Liar** | Normal senses, but its posture is a performance | Watch behaviour, not animation |
| **The Scout** | Cannot catch you. Raises the alarm for something that can | Cascades |
| **The Mimic** | Emits fake cursors of its own. Immune to yours | Deception cuts both ways |
| **The Analyst** | Reads where attention lingered, counts your habits | Repetition is punished |
| **The Parasite** | Provoked by being ignored, soothed by being looked at | Inversion |

### Objects

Thirty prop kinds, all data driven: light switch, breaker, lamp, door, exit, vent,
button, heavy switch, alarm, phone, radio, clock, fan, television, projector,
terminal, mirror, key, drawer, cabinet, locker, table, desk, shelving, crate,
chair, bottle, cup, notebook, toy.

About half carry real behaviour (lights, distractions, decoys, containers, hiding,
pickups, breakables, pushables); the rest are cover, sight blockers and noise.

### Rooms

Twelve hand authored rooms, each introducing one idea and then combining it:

1. **Room With One Door** - attention is what it hunts
2. **The Desk** - where you point beats how close you are
3. **The Lock** - using something makes a sound where it stands
4. **Kennel** - some of them only read how fast you moved
5. **Do Not Wake It** - holding still is not the same as being safe
6. **Two Of Them** - one of them does not catch you, it tells
7. **Lights** - the dark blurs you, it does not hide you
8. **Static** - noise you control is still noise
9. **The Projection** - attention does not have to be yours
10. **Everything** - all of it at once, and one of them is faking
11. **The Analyst** - it is keeping score of your habits
12. **It Wants To Be Seen** - some of them are offended by being ignored

Plus challenge mode (eight stackable modifiers), a date seeded daily challenge, and
seeded procedural rooms, every one of which is validated for reachability before it
is playable.

---

## Extending it

### Adding a creature

1. Add a kind to `EnemyKind` in `src/enemies/EnemyDefinition.ts`.
2. Add an `EnemyDefinition` with its `AwarenessProfile`. Everything about how it
   senses is weights; you should not need new sensing code.
3. Register it in `ENEMY_DEFS` and `ENEMY_ORDER`.
4. Give it a silhouette: add a case to `drawEnemy` in `src/rendering/SceneArt.ts`.
5. Place it in a room with `{ kind: 'YOUR_KIND', x, y, facing, tag }`.

Only add code if it needs a genuinely new *behaviour* (the Mimic spawning decoys,
the Analyst counting habits). Those live as flags on the definition plus a small
branch in `Enemy`.

### Adding an object

1. Add a kind to `ObjectKind` and a row to `DEFS` in
   `src/world/ObjectRegistry.ts`. The row declares size, solidity, opacity, click
   noise, states, uses, cooldown, and what it creates (light, sound, decoy,
   distraction, hiding, pickup).
2. If it does something interesting, add one function to the `BEHAVIORS` table in
   `src/interactions/InteractionSystem.ts`. Props without an entry fall back to a
   state toggle plus their noise.
3. If it needs new art, add a case to `drawObject` in `SceneArt.ts`; otherwise set
   `art` to an existing routine.

No core file changes are needed.

### Adding a room

Add a `RoomDefinition` to `src/world/Rooms.ts` and put it in the `ROOMS` array.
A room is walls, lights, object spawns, creature spawns, an objective, and
optional scripted events. Run the validator on it:

```js
// in the dev console
const { ROOMS } = await import('/src/world/Rooms.ts');
const { validateRoom } = await import('/src/world/RoomValidator.ts');
ROOMS.map(r => ({ id: r.id, ...validateRoom(r) })).filter(r => !r.ok);
```

It checks that the player spawn is clear, that the exit and every objective object
can actually be walked to, and that no creature spawns inside a wall or on top of
the player. It caught three real authoring bugs while these rooms were being built.

### Adding a cursor behaviour

Metrics belong in `CursorSensor` (add a field to `CursorStateData` and compute it
in `update`). If creatures should react to it, add a weight to `AwarenessProfile`
and a term to `evaluateSource`. If it is a new kind of fake attention, add a
pattern to `DecoyPattern` and a case to `CursorDecoy.update`.

### Connecting an ad provider

Gameplay never touches an ad SDK. Implement one interface and hand it over:

```ts
import type { AdProvider, AdPlacement } from './ads/AdManager';

class CrazyGamesProvider implements AdProvider {
  readonly name = 'crazygames';
  async initialize() { /* load and init the portal SDK */ }
  isAvailable() { return true; }
  async showInterstitial(placement: AdPlacement) { /* ... */ }
  async showRewarded(placement: AdPlacement) { return true; }
}

// in Game's constructor, or anywhere before start()
this.ads.use(new CrazyGamesProvider());
```

`AdManager` enforces the rules that are design rather than configuration: a break
can never run while gameplay is active (a hard interlock, not a convention), never
during stealth, detection, a chase or a puzzle, and not within 150 seconds or two
rooms of the last one. Analytics works the same way through `AnalyticsManager.use`.

---

## Known limitations

- **Touch is scaffolded, not shipped.** `TouchInput` implements a two thumb layout
  (left half walks, right half drags the attention marker) and is wired through the
  same abstract actions, but it is untuned and the UI is not laid out for phones.
  Desktop is the only supported target today.
- **Lighting does not cast shadows.** Lights are radial, and walls do not occlude
  them. Line of sight is a separate, exact calculation, so this is a cosmetic
  simplification rather than a gameplay one.
- **Replay records but does not play back.** `ReplaySystem` captures the seed and
  one compact frame per simulation step, and `ReplaySystem.driveFrom` will feed
  those frames back into the input records. Nothing in the UI calls it yet.
- **The Liar's deception is a drifting sine wave.** It works, but a hand authored
  set of tells would be more interesting than a waveform.
- **Procedural rooms are competent, not clever.** They validate and they are
  playable, but they do not compose a lesson the way the authored rooms do.
- **No persistent audio ducking.** Overlapping loud sounds can stack. In practice
  the rooms are quiet enough that this rarely shows.
- **Scores are local.** There is no leaderboard and no backend by design.

## What I would build next

1. **Replay playback and a share card.** The recording format is already there and
   a shareable fifteen second clip of a near miss is exactly what this game is for.
2. **Hand authored tells for the Liar and the Analyst**, so late game creatures
   feel written rather than parameterised.
3. **A room editor**, even a crude one. The room format is plain data and the
   validator already exists; the bottleneck on content is purely authoring time.
4. **Mobile.** The input abstraction is ready. What it needs is a tuned control
   scheme and a UI pass, not an architecture change.
5. **More "the room knows" moments.** `PatternMemory` tracks habits and
   `RoomEventSpec.requiresHabit` can gate an event on them, but only room 5 uses it.
   This is the cheapest available source of memorable moments.
