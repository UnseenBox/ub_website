# DON'T LET IT FIND YOU

**It hunts your body. Your noise. Your light.**

A browser survival-horror stealth game. The mouse is no longer the hunted
thing — it aims your flashlight. Monsters see your body in their gaze cones
(red on the floor), hear your footsteps (sprint = loud, sneak = whisper), and
hate — or love — your torch beam. You survive 3 hits, throw bottles (Q) to
lure, hide in lockers (SPACE), sprint on stamina (SHIFT), sneak with (C).

You control a body that walks with WASD and a flashlight that aims with the
mouse. The body is visible to everything in the room — how close, how lit,
how loud. The flashlight lets you see in the dark, but the beam itself
provokes: shining it at teeth is brave or stupid, and both are fun.

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
| `SHIFT` | Sprint. Fast, loud, drains stamina |
| `C` / `CTRL` | Sneak. Slow, quiet, harder to see |
| Mouse | Aim your flashlight |
| `F` | Toggle flashlight |
| `Q` / `G` | Throw a bottle lure |
| Left click | Use whatever is under your aim |
| Right click | Cancel a timed interaction |
| `E` | Use the nearest object |
| `SPACE` | Hide in a locker / cover, or come out |
| `R` | Restart the room |
| `ESC` | Pause |
| `F3` | Debug overlay (development builds only) |

The mouse never leaves the window: it is your flashlight aim, and the beam is
part of the stealth model — shining it at teeth provokes them.

---

## How body detection actually works

This is the part worth reading, because it is the game.

Every creature scores your **body** each step (`src/enemies/EnemyAwareness.ts`):
proximity × light level, flashlight glare in its face, footstep agitation
(sprint feeds the Hound), and how long you have stood exposed in its view.
Hiding in a locker zeroes you out entirely. Darkness blurs, never erases.

Creatures evaluate **presence sources** through one interface
(`src/stealth/AttentionSystem.ts`): your body, and the echoes machines make.

```ts
interface AttentionSource {
  x, y            // where the body / echo is
  speed           // how fast it is moving
  headingX, headingY  // body travel direction
  movementIntensity   // 0..1 agitation derived from speed
  dwellTime       // how long the body has stood exposed
  visibility      // 0..1, from the room's lighting at that point
  noiseLevel      // decaying residue of recent noise
  isReal          // false for machine echoes
  potency         // how convincing it is (0 while hidden)
}
```

`BodyAttention` implements this for the player's body (`src/stealth/BodyAttention.ts`).
`CursorDecoy` implements it for screaming machines and thrown echoes. Because they
satisfy the same interface, every awareness rule written once works for all, and
a creature that can tell them apart only has to check `isReal`.

### The awareness model

`src/enemies/EnemyAwareness.ts` scores one source against one creature as a
weighted sum. Every term is tunable per creature in `EnemyDefinition.ts`:

```
proximity  = (1 - (distance / awarenessRadius)^2) * lightGate   closeness × how lit you are
glare      = flashlight beam shining in its face (0.42 rad cone)
speed      = movementIntensity * (0.45 + 0.55 * proximityBase)   sprint feeds, sneak starves
dwell      = standing exposed in its view for 1.4s .. 3.8s

pressure = (proximityWeight * proximity
          + pointWeight     * glare
          + speedWeight     * speed
          + dwellWeight     * dwell)
          * coneMultiplier      gazeBonus inside its own gaze cone, blindMultiplier outside
          * potency             hiding zeroes you out; Nerves x1.6
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
| 0.58 | `INVESTIGATING`, it walks to where your body was |
| 0.82 | `ALERT`, faster, and it tells the others |
| 1.00 | `PURSUING`, a detection — run, hide, or fight the light |

### What this produces in play

- Sneaking dark past the Watcher's flank: **never noticed**.
- Same path sprinting with the torch on: **chased in about a second**.
- Hound, sneaking: **nothing**. Same position, sprinting: **caught fast**.
- One footstep 40 px from a sleeping creature: **it wakes**. The same step
  sneaked from further out: **it sleeps on**.

That gap between sneaking and sprinting is the entire game.

### Noise

Using something is a disturbance at a position with a loudness, in the units
the design calls for: a fingertip tap is 2, a heavy switch 5, a thrown bottle 7,
breaking glass 10, a ringing phone 18, an alarm 25. Audible range is
`level * 26` pixels, so a tap carries 52 px and an alarm carries most of a room.

Clicking empty floor throws a bottle lure (limited ammo, keys restock). There is
no free interaction — but the mouse itself is never the liability.

A loud enough noise does not merely raise awareness, it **steals focus**: the
creature locks onto the noise instead of your body for several seconds and walks
to it, while body pressure against it is damped to 30%. That is what makes a
distraction work, and it works whether or not the creature is alarmed.

### A touch is not death

Being caught costs health, not the run: three touches kill. The creature still
freezes for 0.65 s on first detection (a beat of silence, the camera pushes in,
the room goes quiet), then charges. If you break its line of sight and keep it
broken for 1.5 s, it loses you, goes to `SEARCHING`, and you bank a near miss.
Surviving those is worth score. The loop the game is built around is
*oh no, wait, I can still get out of this*.

---

## Art direction

The room is a photograph taken in one colour.

Rendering runs in four passes, and the order *is* the art direction:

1. **Lit.** Floor, walls, props, the character and the creatures' bodies, all
   painted in pale neutral greys. These are not what you see; they are what the
   light has to work with.
2. **Light.** A half-resolution light map is built — near black where nothing
   reaches, saturated colour where a lamp does — and multiplied over the scene.
   Unlit geometry collapses to true black, and lit geometry is *stained* rather
   than tinted. Each room burns in its own hue: sodium amber, toxic green,
   sickly cyan, clinical white.
3. **Emissive.** Everything light cannot dim: the creatures' apertures, the
   ceiling panels, gold, the way out, and blood. A creature's body is drawn in
   pass one and its eye in pass three, which is why it reads as a hole in the
   room with something lit inside it.
4. **Frame.** Vignette, fixed-pattern film grain, and the red bleed that only
   appears at real danger.

Geometry is read almost entirely from **rim light**: the bright edge a surface
catches on the side facing the strongest lamp (`rimLightRect` / `rimLightCircle`).
Three things are allowed to keep their own colour through the light pass: the
flashlight beam, gold, and red. Red is violence and nothing else. Creatures are
painted near-black holes with lit apertures, and they tremble, drool, bleed
veins and bare teeth as their certainty climbs.

The interface is a surveillance logbook somebody has been scratching notes in.
Every stroke goes through one SVG displacement filter (`src/ui/Ink.ts`) so lines
come out slightly wrong, the way a line drawn by hand against a ruler does. The
HUD is a ruled sweep across the top of the frame with a mark for each creature,
placed by where it stands and lit by how interested it is, plus a vitals
cluster (health, stamina, bottles, torch) at the bottom left: it tells you the
one thing the world cannot, which is that something off to your right, outside
the light, has started hunting you.

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
    InputManager.ts        abstract actions: move, sprint, sneak, torch, throw, hide
    KeyboardMouseInput.ts  desktop backend
    TouchInput.ts          touch backend scaffold (see Known limitations)
  cursor/
    CursorSensor.ts        raw pointer events to a clean, smoothed aim signal
    CursorController.ts    aim reticle state, trail, machine echoes, heat
    CursorState.ts         state names and the metric record
    CursorTrail.ts         visible residue of recent aim
    CursorDecoy.ts         machine echoes, five movement patterns
  stealth/
    AttentionSystem.ts     the AttentionSource interface and registry
    BodyAttention.ts       the player's body as the hunted source + torch glare
    LineOfSight.ts         segment against axis-aligned blockers
  enemies/
    Enemy.ts               one creature: sensing, state, behaviour
    EnemyDefinition.ts     nine creatures as data
    EnemyAwareness.ts      the weighted sum above
    EnemyStateMachine.ts   state bookkeeping
    EnemyCommunication.ts  alerts between creatures
  player/Player.ts         the body: sprint/stamina, sneak, torch, bottles, health
  world/
    Room.ts                live room: objects, creatures, lights, queries
    Rooms.ts               twelve hand authored rooms
    RoomGenerator.ts       seeded procedural rooms
    RoomValidator.ts       reachability gate, run before any generated room
    ObjectRegistry.ts      thirty prop kinds as data
    WorldObject.ts         a live prop
    Collision.ts           circle against AABB, axis separated
  interactions/
    InteractionSystem.ts   behaviour table, aim clicks, bottle throws, hiding
    NoiseSystem.ts         sound as a gameplay object
  particles/ParticleSystem.ts
  rendering/
    Renderer.ts            canvas, DPR, letterboxing, the four draw passes
    SceneArt.ts            room, props, survivor, flashlight beam, creatures, blood
    CursorArt.ts           the aim reticle, its trail, and echoes
    Lighting.ts            the light map, bloom, vignette and grain
    Camera.ts              shake and small push
    DrawUtils.ts           palette, rim light, survey marks
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
  ui/
    Ink.ts                 the hand-drawn filter and the drawn icon set
    HUD.ts                 the ruled threat sweep and status icons
    Screens.ts             menus, results, discoveries
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
| **The Watcher** | Bodies in its gaze cone, especially lit and sprinting. Nearly deaf | The core rule |
| **The Hound** | Footstep speed and noise. No line of sight needed | Sprinting feeds it |
| **The Sleeper** | Sound and loitering. Sometimes only pretending to sleep | Tread softly |
| **The Mirror** | Never moves, only turns. A gaze like a razor | Cross behind it |
| **The Liar** | Normal senses, but its posture is a performance | Watch behaviour, not animation |
| **The Scout** | Cannot catch you. Spots you and screams for something that can | Cascades |
| **The Mimic** | Fakes footstep echoes elsewhere. Immune to your lures | Deception cuts both ways |
| **The Analyst** | Remembers your routes, counts your reused tricks | Repetition is punished |
| **The Parasite** | Rules shadow; torchlight soothes it, darkness provokes it | Carry light |

### Objects

Thirty prop kinds, all data driven: light switch, breaker, lamp, door, exit, vent,
button, heavy switch, alarm, phone, radio, clock, fan, television, projector,
terminal, mirror, key, drawer, cabinet, locker, table, desk, shelving, crate,
chair, bottle, cup, notebook, toy.

About half carry real behaviour (lights, distractions, decoys, containers, hiding,
pickups, breakables, pushables); the rest are cover, sight blockers and noise.

### Rooms

Twelve hand authored rooms, each introducing one idea and then combining it:

1. **Room With One Door** - light, noise and motion are what it hunts
2. **The Desk Ward** - flank the gaze cone, never cross it
3. **The Lock Ward** - lure it away before doing loud work
4. **Kennel of Teeth** - the Hound hunts footsteps; sneak, never sprint
5. **Do Not Wake It** - kill the torch, sneak past sleep
6. **Two Hungers** - the Scout spots you and screams for the killer
7. **Blackout Gallery** - darkness hides you, the Mirror still sees light
8. **Static Corridor** - two switches, two hunters, bottles save lives
9. **The Projection Hall** - machines scream; move while they cover you
10. **Everything Hungry** - all of it at once, and one of them is faking
11. **The Analyst Pit** - it learns your routes; never run the same line twice
12. **It Hungers in the Dark** - the Parasite rules shadow; keep the torch lit

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

Only add code if it needs a genuinely new *behaviour* (the Mimic faking
footsteps, the Analyst counting habits). Those live as flags on the definition
plus a small branch in `Enemy`.

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

### Adding a body behaviour

Movement metrics belong in `Player` and `BodyAttention` (speed, sneak, torch,
loitering). If creatures should react to a new one, add a weight to
`AwarenessProfile` and a term to `evaluateSource`. If it is a new kind of false
echo, add a pattern to `DecoyPattern` and a case to `CursorDecoy.update`.

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
  (left half walks, right half drags the aim marker) and is wired through the
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
