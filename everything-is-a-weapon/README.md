# BONK!

*Everything is a weapon.* (The project folder and save key keep the working title, `everything-is-a-weapon`.)

You are trapped in a small room. You have no weapon. Good — use the room.

A 2D physics action sandbox for the browser. Chairs get thrown, lamps topple, bottles spill,
puddles carry current, and intruders walk into all of it. Built on native web technology only:
**TypeScript + Canvas 2D + Web Audio**, with a custom physics engine. No game engine, no physics
library, no audio files, no image assets.

- Production bundle: ~160 KB JS (≈53 KB gzipped), zero runtime dependencies.
- Dev dependencies: `vite`, `typescript`, `esbuild` (build tooling only).

---

## How to play

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Move |
| Mouse | Aim |
| Left click | Grab the highlighted object |
| Hold left click, release | Charge and throw (heavier = slower, harder hit) |
| Right click | Drop without throwing |
| `Space` | Dodge (brief invulnerability) |
| `R` | Restart the room |
| `Esc` | Pause |
| `F3` | Debug overlay (development builds only) |

**On a phone** (landscape):

| Input | Action |
| --- | --- |
| Left thumb, anywhere on the left | Move (a stick appears under your thumb) |
| Tap the right side | Grab the highlighted object (the nearest one you are facing) |
| Hold the right side, release | Charge and throw — it goes at the nearest intruder |
| Drag the right thumb while holding | Aim by hand instead |
| `DODGE` / `DROP` buttons | Dodge; drop what you are carrying |

On small screens the camera zooms in and follows you instead of showing the whole room. In
portrait the game asks you to rotate (you can dismiss it). Where the browser allows it
(Android Chrome), pressing PLAY goes fullscreen and locks landscape.

To try it on your own phone, run `npm run dev:phone` and open the "Network" address it prints
from a phone on the same Wi-Fi.

Defeat every intruder to clear the room. Plain hits work, but the score rewards creativity:
hazards, chain reactions, multi-kills and ridiculous weapons are worth far more, and each new
interaction you find is added to the **Discoveries** book (52 to find). Each room also has an
optional bonus objective shown under the intruder counter.

Things worth trying: knock a lamp into a puddle; shove a loaded table; damage a fire extinguisher;
put a candle near a spray can; hit a shield bearer from behind; throw someone's own helmet back.

---

## Build and run

```bash
npm install
npm run dev        # development server with debug tools (http://localhost:5173)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
npm run test:physics   # headless stress test of the physics engine
```

Requires Node 18+.

### Deploying to Vercel

The project is a static site; no backend is needed.

1. Push the repository to GitHub/GitLab/Bitbucket and import it in Vercel — the included
   `vercel.json` sets the framework (Vite), build command (`npm run build`) and output (`dist`).
2. Or from the CLI: `npx vercel` for a preview, `npx vercel --prod` for production.

`vite.config.ts` uses `base: './'`, so the same `dist/` folder also works when uploaded as a zip
to HTML5 portals (CrazyGames, Poki, GameDistribution, itch.io) that serve it from a sub-path.

---

## Architecture

```
src/
  main.ts                  boot, wires Game + UI, loads dev tools only in development
  core/                    Game (orchestrator), GameLoop (fixed timestep), EventBus, seeded Rng
  physics/                 RigidBody, Collision (SAT), CollisionResolver, SpatialGrid, PhysicsWorld
  entities/                Player, Enemy (+ EnemyTypes data), PhysicsObject
  objects/                 Materials, ObjectDefinitions (data), ObjectRegistry, ObjectFactory
  hazards/                 Zone + ZoneManager, Electricity, Fire, Water
  interactions/            InteractionRule (types), InteractionRegistry (the rules), Effects, InteractionSystem
  gameplay/                rooms (Room, RoomDefinitions, RoomGenerator, RoomManager), ImpactSystem,
                           Chain, ScoreSystem, DiscoverySystem, ChallengeSystem, Navigation, Tutorial
  rendering/               Renderer, Camera (+ shake, phone follow), procedural art (Player/Character/Object/Zone/Room)
  particles/               pooled particles
  audio/                   AudioManager (sound design), Synth (modal / formant / noise primitives), Music (procedural score)
  input/                   InputManager + KeyboardMouseInput + TouchInput adapters
  ui/                      DOM HUD and screens (menu, results, evidence board, pause, settings); shapes.css = torn-paper clip paths
  save/  ads/  analytics/  replay/   persistence and platform abstractions
  debug/                   F3 overlay and scripted test hooks (dev only)
```

**Frame flow** (`GameLoop` → `Game.tick` at a fixed 120 Hz, independent of display rate):

```
requestAnimationFrame → accumulate time × timeScale
  └ while accumulator ≥ 1/120:
       input.sample → player → enemies → objects
       physics.step (integrate → broad phase → narrow phase → impulses → position correction)
       ImpactSystem (contacts → chains, impact rules, feedback)
       zones.update → overlap rules (every 10th tick)
       score / tutorial / particles → sweep dead entities → room outcome
  └ render(interpolation alpha) → HUD
```

Slow motion and hit-stop only change how fast the accumulator fills, so the simulation itself
always advances in identical steps. Systems do not call each other for reactions: they emit
events (`OBJECT_BROKEN`, `ENEMY_HIT`, `ENEMY_DEFEATED`, …) on a typed `EventBus` and whoever
cares listens (scoring, analytics, audio/particles, tutorial, replay log).

The DOM is used only for menus and the HUD; everything in the room is drawn on one canvas.
Static room art is cached in an offscreen canvas; the canvas is sized to
`devicePixelRatio` (capped at 2) and the camera fits the whole room at any aspect ratio.

### The custom physics system

`src/physics` is a small top-down rigid-body engine written for this game.

- **Bodies**: position, velocity, rotation, angular velocity, mass/inverse mass, inertia,
  contact friction, restitution, linear drag, floor friction; `static`, `dynamic` and
  `kinematic` types; collision `layer`/`mask`; trigger flag; sleeping.
- **Shapes**: circles and boxes (a box is axis-aligned or oriented depending on its angle).
- **Broad phase**: uniform spatial grid (72-unit cells), arrays reused every step.
- **Narrow phase**: circle–circle, circle–box, and box–box via the separating-axis test.
- **Response**: sequential impulses with rotation, Coulomb friction and restitution (3 velocity
  iterations), followed by direct positional correction so nothing stays sunk in a wall.
- **Top-down adaptation**: "gravity" in the plane is replaced by floor friction (a constant
  deceleration). A separate cosmetic height axis (`z`, `vz`) gives throws an arc, lets things
  fall off tables and produces landing impacts; airborne bodies skid far less.
- **Stability**: velocity and spin caps, NaN guards, a restitution threshold to stop
  micro-bouncing, sleep thresholds, and a hard room-bounds clamp as an anti-tunnelling backstop.
- **Gameplay output**: every contact reports the normal impulse actually applied. Damage is
  derived from that impulse (≈ relative velocity × effective mass), never from a per-object
  constant — so a fully charged chair hurts and a gently tossed shoe does not.

`npm run test:physics` throws 60 random bodies around a room at four step rates and asserts no
NaNs, no escapes, no bodies left inside walls, bounded energy and full settling.

### Sound

There are no audio files. `audio/Synth.ts` provides three building blocks and everything is made from them:

- **Modal synthesis** — a struck object rings at a few inharmonic frequencies with separate decay
  times. Each material has its own set (wood, metal, glass, plastic), and the object's **mass sets
  the pitch**, so a table thuds, a bin clangs and a bottle tinks. Rubber "boings" with a pitch bend.
- **Formant voices** — a buzz through two moving band-pass filters reads as a mouth shape. Intruders
  grunt, yelp when shocked, panic when on fire and groan when defeated, each type at its own pitch.
  The fail jingle is a four-note sad trombone made the same way.
- **Noise and tones** — whooshes, thumps, the charge wind-up, zaps, the shatter cascade of glass.

On top of that: combos and chain reactions play **notes of a pentatonic scale** (longer chain,
longer run), live hazards add **room tone** (mains hum, fire crackle), a short synthetic reverb puts
everything in the same room. Charging a throw plays **one rising note per quarter of charge**, so
you can hear how hard the throw will be.

`audio/Music.ts` is the score: slow, soft, late-night lo-fi that is **written as it plays rather
than looped** — electric-piano chords picked from several four-bar phrases, a round bass and brushed
drums that only join once the movers arrive, and a sparse kalimba line improvised from a pentatonic
scale (a phrase is invented, answered once, then thrown away). It all runs through a low-pass filter
so nothing is bright or sharp. Music has its own toggle.

The pets have their own voice module, `audio/PetVoices.ts`: a pitch contour through three moving
formants, with breath noise and amplitude flutter, so a meow opens and closes like a mouth, a
bark snaps and drops, a growl rattles and a purr pulses about 26 times a second. Still no audio files.

### Interface and feedback

The interface is built from things lying around the flat rather than panels of text:

- titles and announcements are **ransom-note lettering** (every letter a different clipping, set in
  a different system typeface — no webfonts are loaded)
- buttons are **torn paper strips** held down with masking tape; the main action is a red label
- the HUD is a **luggage tag** (room), **sticking plasters** (health), a **line-up of mugshots**
  (intruders: greyed until they arrive, crossed out when defeated), a **sticky note** (bonus) and a
  **till receipt** (score, which rolls up) with a starburst **combo sticker** that runs down
- results are an **incident report on a clipboard**, finished with a rubber stamp
- discoveries are an **evidence corkboard**: pinned index cards, steps joined by red string
- pause is a **"do not disturb" door hanger**; settings are a **typed sheet**

Torn edges are CSS clip paths generated by `scripts/gen-shapes.py` into `src/ui/shapes.css`.

In the room, `rendering/Fx.ts` adds comic **sound-word bursts** (THWACK, CLANG, ZZAP, KABOOM…
chosen by material), **shockwave rings**, speed streaks, an x-ray skeleton flash on shocks, paper
popups, a knock on the door before each intruder enters, and a letterboxed slow-motion **close-up on
the final blow** followed by a "CLEARED" stamp.

### The interaction system

There are three ingredients:

1. **Tags.** Every thing (object, enemy, player, hazard zone, wall) carries a set of tags:
   its id, material and traits (`flammable`, `conductive`, `heavy`, `light`, `breakable`,
   `explosive`…) plus live state (`standing`, `burning`, `energized`, `broken`, `held`).
2. **Rules** (`InteractionRegistry.ts`). Plain data: a trigger, a source tag query, a target tag
   query and a list of effects.
   - `impact` — two physical things collided with at least `minImpulse`
   - `overlap` — a hazard zone overlaps a thing or another zone
   - `event` — a gameplay event fired for a matching thing (`OBJECT_BROKEN`, `OBJECT_FALLEN`…)
3. **Effects** (`Effects.ts`). ~25 reusable verbs: `impactDamage`, `tip`, `spawnZone`, `spill`,
   `energize`, `shock`, `ignite`, `extinguish`, `explode`, `push`, `rocket`, `transform`, …

Nothing is a scripted sequence. The lamp-in-the-puddle kill is five independent rules:
impact tips a standing lamp → landing breaks it → a broken lamp spawns an attached `electric`
zone → `electric` overlapping `water` energizes it → energized water shocks a creature.

**Chains.** A throw starts a `Chain`. Whenever one thing meaningfully affects another, the chain
is handed on with the new link's label, so a kill knows its full history
(`CHAIR → LAMP → ELECTRICITY → WATER → INTRUDER`). Chain length drives the score tiers, the
combo text and several discoveries.

---

## How to add a new object

Objects are data. Append one entry to `src/objects/ObjectDefinitions.ts`:

```ts
{
  id: 'toaster', name: 'Toaster', material: 'metal',
  shape: { kind: 'box', hw: 12, hh: 9 }, mass: 3, height: 10,
  health: 40, breakable: true, flammable: false, conductive: true, throwable: true,
  electronic: true,
},
```

That is enough for it to be grabbed, thrown, deal impulse-based damage, break, conduct
electricity, make the right collision sound and debris, and be drawn (as an extruded shape in its
material colours). Then optionally:

- **Place it**: add `{ type: 'toaster', x, y }` to a room in `RoomDefinitions.ts`, or add it to
  the `FILLER` list in `RoomGenerator.ts` so generated rooms can include it.
- **Custom art**: write a draw function and call `registerObjectArt('toaster', draw)`
  (`rendering/ObjectArt.ts`).
- **Special behaviour**: add rules that match its id or a custom tag (`tags: ['pressurized']`).
  Useful definition fields: `tip` (can be knocked over), `emitters` (carries a hazard zone, like
  the candle's flame or the fan's wind; switched by `whileTag`), `surface` (things can rest on it),
  `rolls`, `funny`, `glide` (a throw that sails), `perk` (the one-line trait shown on its tag).
- **Things it does by itself**: set `behavior` to one of the kinds in `entities/Behaviors.ts` —
  `wander` (drives itself about), `seek` (chases the nearest intruder once thrown), `boomerang`
  (comes back to your hand), `flop` (thrashes about), `trap` (sets itself when left on the floor).

The physics engine is never touched.

## How to add a new interaction

Append a rule to `src/interactions/InteractionRegistry.ts`:

```ts
// Broken toasters throw sparks for a few seconds.
{
  id: 'toaster_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['toaster'],
  effects: [{ type: 'spawnZone', zone: 'electric', radius: 24, ttl: 5, attach: true }],
  discovery: 'burnt_toast',
},
// Glass shards slow the player too.
{
  id: 'glass_player', trigger: 'overlap', source: ['glass'], target: ['player'],
  effects: [{ type: 'slow', factor: 0.7, duration: 0.4 }],
},
```

Tag queries are ANDed; prefix a tag with `!` to require its absence (`['object', '!held']`).
`minImpulse` and `cooldown` are available on any rule; `moving: true` makes an impact rule fire
only when the source was the thing travelling (being hit by a broom, not walking into one).
Event rules can listen for `OBJECT_BROKEN`, `OBJECT_FALLEN`, `OBJECT_DAMAGED`, `OBJECT_THROWN` and
`OBJECT_LANDED`. To show the rule in the Discovery Book,
add an entry with the same `discovery` id to `gameplay/Discoveries.ts`.

A new effect verb is only needed when no existing one fits: add a variant to the `EffectSpec`
union in `InteractionRule.ts` and a handler of the same name in `Effects.ts` (the compiler
enforces that every variant has a handler).

## How to add an ad provider

Gameplay only talks to `AdManager` (`src/ads/AdManager.ts`). Networks plug in behind the
`AdProvider` interface:

```ts
export interface AdProvider {
  readonly name: string;
  initialize(): Promise<void>;
  isAvailable(kind: 'interstitial' | 'rewarded'): boolean;
  readonly pacing: 'self' | 'portal';
  // call onStart at the moment an ad actually begins to play
  showInterstitial(placement: AdPlacement, onStart: () => void): Promise<void>;
  showRewarded(placement: AdPlacement, onStart: () => void): Promise<boolean>;   // true = reward earned
}
```

The CrazyGames adapter is real (`src/platform/CrazyGamesPortal.ts`). A sketch of another common one:

```ts
// Google H5 Games Ads (Ad Placement API: adBreak / adConfig)
class GoogleH5Provider implements AdProvider {
  readonly name = 'google-h5';
  async initialize() { window.adConfig({ preloadAdBreaks: 'on', sound: 'on' }); }
  isAvailable() { return true; }
  showInterstitial(placement) {
    return new Promise<void>((resolve) =>
      window.adBreak({ type: 'next', name: placement, adBreakDone: () => resolve() }));
  }
  showRewarded(placement) {
    return new Promise<boolean>((resolve) => {
      let earned = false;
      window.adBreak({
        type: 'reward', name: placement,
        beforeReward: (showAd) => showAd(),
        adViewed: () => { earned = true; },
        adBreakDone: () => resolve(earned),
      });
    });
  }
}
```

Providers are handed to the game by the **portal** it is hosted on (`src/platform/`): the
build picks a `Portal`, and the portal supplies its `AdProvider`, its save storage, its mute
switch and its gameplay tracking. Two exist:

- `WebPortal` — the default (`npm run build`): no ads, `localStorage` saves.
- `CrazyGamesPortal` — `npm run build:crazygames`, written to `dist-crazygames/`. The whole
  CrazyGames SDK v3 integration is in that one file. See `CRAZYGAMES.md` for what it does and
  how to submit the game.

A provider says who paces interstitials (`pacing`):

- `self` — `AdManager`'s own limits apply: an interstitial only after every 3rd cleared room,
  never more than once per 2 minutes, and before a retry only after 3 consecutive failures.
- `portal` — the host throttles requests itself (CrazyGames: at most one every three
  minutes), so the game asks at every break between rooms and lets the host decide.

Either way `AdManager` never asks mid-action, blocks the results buttons while a request is
out, mutes audio only while an ad is actually playing, and offers the optional rewarded
**WATCH AD: CONTINUE** on the fail screen (once per room) only when the provider says a
rewarded ad can really be shown.

The bundled `MockAdProvider` reports nothing available, so the shipped game has no ads and shows
no fake ones. In development, `?mockads=1` simulates successful ads to exercise the flow.

Analytics follows the same pattern: `AnalyticsManager.addSink(sink)` with a `track(name, params)`
method; in development events are logged to the console.

---

## What is in the game

**Heroes (4), picked on the menu** (`core/Hero.ts`, looks in `rendering/PlayerArt.ts`). Each
brings a pet (`entities/Cat.ts`, `entities/Pets.ts`, `rendering/CatArt.ts`, `rendering/PetArt.ts`).
Pets are not physics bodies and cannot be hurt; each has something it does on its own and a
treat that sets it loose for 15 seconds:

| Hero | Pet | On its own | Treat |
| --- | --- | --- | --- |
| the tenant | Waffle, a sausage dog | barks from behind you; every other bark makes a mover wander over to look | *bone*: clamps onto a mover, which can barely walk |
| the flatmate | Biscuit, a cat | hides on top of the furniture; swipes once if cornered | *tuna*: disappears with a mover into a fight cloud |
| gran | Captain, a parrot | circles overhead being rude; now and then drops something that confuses a mover | *cracker*: dive-bombs one mover after another |
| the kid | Nugget, a hamster in a ball | rolls away from movers; any mover that steps on the ball trips | *seeds*: the ball doubles in size and bowls through them |

**Pickups, used up the moment you grab them** (`gameplay/Pickups.ts`; placed when a room
loads, from room 2 on, so the hand-made rooms have them too):

- *Ghost pepper* — 60 seconds of rage: 30% faster, 30% harder throws, a throw charges in a
  third of the time, the dodge recharges twice as fast, and walking into a mover hurts it.
- *The pet's treat* — see the table. Another pet's treat is just something to throw.
- *Box of plasters* — two plasters back (refused if you are not hurt).
- *Bubble wrap* — the next two hits pop instead of landing.
- *Snooze button* — every mover in the room is asleep for five seconds.

**Movers (10 + 1):** Box, Express, Crate, Pan Head, Bailiff, Tangle, and four later arrivals
(`entities/EnemyTypes.ts`): *Fragile* (goes down fast, leaves broken glass), *Nesting Box*
(splits into two Smalls), *Kaboom* (explodes when beaten: beat it next to its colleagues) and
*Trolley* (slow to turn, then charges the length of the room).

**Objects (77):** every one has a trait of its own, written on the tag that appears when you can
pick it up.

- *Core:* chair, table, lamp, shoe, book, computer, trash can, bottle, flowerpot, fan, fire
  extinguisher, candle, spray can, bookshelf, rubber ball — plus plank, paper ball and saucepan,
  which come out of other things.
- *More clutter* (`objects/MoreObjects.ts`, scattered at room load): cactus, guitar, piggy bank (and
  its coins), maple syrup, dumbbell, pizza box, globe, trophy, lava lamp, kettle.
- *Kitchen:* frying pan, plate, toaster (and its toast), banana, cooking oil, bag of flour, fridge,
  worktop, cooker.
- *Bathroom:* soap, rubber duck, hairdryer, plunger, mirror, toilet, bathtub.
- *Living room and bedroom:* cushion, telly, vase, sofa, bed, alarm clock, teddy bear.
- *Garage:* tyre, skateboard, tin of paint, petrol can, toolbox, spanner.
- *Gadgets (`objects/GadgetObjects.ts`):* robot hoover, wind-up teeth, boomerang, mousetrap, rake,
  magnet, car battery, bucket, firework, pressure cooker, boombox, fish tank (and its fish), water
  cooler, office chair, bowling ball, broom, iron.

Worktop, cooker, toilet and bathtub are `fixed`: built in, but still hit, broken and used by rules.

**Materials (9):** wood, metal, glass, plastic, rubber, paper, electronic, fabric, ceramic — each
with its own friction, bounce, hardness, fragility, flammability, conductivity, sound and debris.

**Hazard zones (17):** water, electricity, fire, broken glass, foam, dirt, mud, wind, oil, flour
cloud, wet paint, feathers, steam, a magnet's pull, a boombox's music, the trigger of a set trap,
and the slipperiness carried by a banana, a bar of soap or a fish.

**Enemies — "The Movers" (6):** a removal crew of living cardboard boxes. Box; Express (a padded
envelope: fast, weaves); Crate (timber, shrugs off light objects); Pan Head (wearing your saucepan,
which soaks hits and then flies off as a throwable); Bailiff (hides behind an eviction notice,
turns slowly); Tangle (a box of fairy lights: immune to shocks, electrifies puddles, hurt by
water). Cardboard and paper burn faster than timber.

**Rooms:** a 50-room campaign in five 10-room acts. The first act opens with nine handcrafted
rooms across six kinds of room, each with its own floor, walls and fixtures — bedroom (throwing) →
home office (object collisions) → bathroom (water + electricity) → living room (fire) → kitchen
(slippery, flammable, explosive) → open plan (everything) → garage → break room. The remaining 41
rooms are deterministic generated campaign rooms with varied themes, furniture and clutter, ending
at a fixed garage showdown behind the last door. All 20 bosses appear exactly once, with late bosses
scheduled through the generated acts. Plus a date-seeded Daily Challenge and 11 bonus challenges.

**Chain reactions and interactions (all emergent from the rules):**

- object → standing lamp → falls → breaks → exposed wire
- exposed wire / sparking computer / wall socket → puddle → electrified puddle → shocked intruder
- electrified puddle → second puddle → metal object → carries the current around
- bottle → breaks → new puddle (extends an existing one) + broken glass
- fire → wood / paper → burning object → spreads → burnt away; burning things can be thrown
- fire → intruder → panics and spreads fire; water, foam or dirt put fire out
- fire or hard impact → spray can → explosion (shoves, damages, ignites, topples, chains to other cans)
- sparks → flammable objects → fire
- damaged extinguisher → rocket that trails foam → foam slows and confuses intruders
- fan → blows light objects, feeds flames
- flowerpot → dirt → smothers fire, or + water → mud that bogs everyone down
- shoved / hit table → things fall off (and break)
- big hit → bookshelf collapses → books everywhere
- broken chair → planks; broken trash can → paper balls; hard-hat helmet → throwable
- heavy object → light object → launched
- knocked-back intruder → wall or other intruder → slam damage
- wet floor → no traction for anyone on it
- banana, soap, oil or a skateboard → mover's feet go → helpless slide → wall
- bag of flour → cloud nobody can see through → any flame or spark → dust explosion
- cooking oil / petrol → slick → any flame or spark → the whole slick is on fire
- hit the alarm clock → it rings → movers walk over to look (ideally through something)
- plunger → mover's face → stumbling about blind until it drops off
- hit the toaster → toast launches; break it → sparks
- big hit → fridge topples → flattens whoever is in front and spills its contents
- toilet breaks → flood; hard hit on the bathtub → splash; both feed the electricity rules
- anything dropped on the lit cooker ring catches fire
- robot hoover → wanders the room, trips whoever walks into it, tidies up glass and dirt, carries
  whatever is put on it (a lit candle, say) → drives into a puddle → shorts out → live puddle
- wind-up teeth → throw them → they chase the nearest mover and nip at it until they run down
- boomerang → out, round and back to your hand; the return leg hits a Bailiff from behind
- mousetrap / rake → left on the floor they set themselves → a foot finds them
- magnet → metal objects fly to it (through whoever is in the way) and saucepans leave Pan Heads
- car battery → a wall socket you can carry: drop it in any puddle
- bucket → a puddle wherever you throw it; refill at the bath or the toilet; empty, it fits over a head
- flame or spark → firework → fizzes, takes off, bursts
- hit the pressure cooker → it whistles (movers come to look) → steam explosion → nobody can see
- throw the boombox → it plays → everyone in range has to dance
- fish tank breaks → flood, glass and three slippery fish; water cooler tips over → flood
- rubber ball off a wall → harder hit; shoe → dazes; frying pan → stuns, and blocks a lunge while
  you hold it; cushion → bursts into a cloud of feathers; teddy → clings to a face; bin → over a
  head; spanner → unscrews a saucepan hat; tin of paint → in the eyes; plate → sails like a frisbee;
  toast → lands butter side down; duck → its squeak is a decoy; tyre, office chair, bowling ball →
  bowl movers over; broom → sweeps legs; hot iron → sets them alight; hairdryer → blows hot air

---

## Testing performed

- `npm test`: 69 tests, including the 50-room schedule (all 20 bosses exactly once), deterministic
  generated layouts, the final door, the simple victory actions, and the production bundle's
  tutorial → results → next-room flow.
- `npm run test:physics`: all checks pass at 30/60/120/240 Hz.
- Verified individually: movement, grab, charge, throw, drop and dodge through real DOM
  keyboard/pointer events; enemy hit and defeat; lamp topple; electrical hazard; electrified
  puddle; multi-step chain; room clear; restart; fail and retry; pause/resume; mute and volume;
  save → page reload → progress restored; portrait and landscape resizing; production build served
  by `vite preview` with debug tools absent.
- Measured cost on a mid-range laptop in a busy room: ~0.07 ms per physics tick, ~3.7 ms per
  rendered frame at 1600×900 — roughly a quarter of the 60 FPS budget.

## Known limitations

- **Tuning was done by scripted play, not by hand.** The embedded preview used during
  development throttles animation frames, so game feel (throw weight, enemy pressure, difficulty
  curve, score values) has not been judged by a human at full frame rate. Expect a tuning pass.
- **Sound was designed blind.** Every sound and the music run without errors, but none of it has
  been listened to by a human; levels, pitches and the mix will need adjusting by ear.
- The interface uses system fonts on purpose, so the handwriting and cut-out letters will look a
  little different on Windows, macOS, Android and iOS. Only Windows rendering was checked.
- Phone controls were verified with simulated touch events at phone screen sizes, not on a
  physical device. Stick sizes, the auto-grab range and aim assist will want tuning in the hand.
  iOS Safari cannot go fullscreen or lock orientation for web pages, so there it relies on the
  rotate prompt.
- Collision is planar: height (`z`) is cosmetic apart from clearing table tops and landing
  damage, so a thrown object cannot arc over an intruder.
- Box–box contacts use a single averaged contact point. That is fine top-down, but it is not a
  stacking solver.
- Enemy pathfinding is a shared flow field: intruders path around heavy furniture and avoid
  visible fire, but they do not avoid electrified water and have no individual tactics.
- The trash can "contains" paper only in the sense that it spills paper balls when it breaks.
- Replay: the last 20 seconds of input, the room seed and a highlight log are recorded, but there
  is no playback or export yet. Particle randomness is not seeded (it never affects gameplay).
- No online leaderboards; the Daily Challenge is local.
- Debug CSS for the F3 panel ships in the stylesheet (the panel code itself does not).

## Recommended next features

1. Hands-on tuning pass, then a difficulty curve for generated rooms.
2. On-device tuning of the phone controls, haptics, and a portrait room layout.
3. Replay playback + GIF/WebM export for "share your stupidest kill".
4. More systemic objects: microwave, rug that can be pulled, ceiling fan, sprinkler, oil.
5. Enemy tactics: hazard awareness for smarter variants, a thrower, a boss room.
6. Room-to-room progression layer (map, unlockable starting conditions, mutators).
7. Leaderboards for the Daily Challenge; gamepad input adapter.
8. Real ad/analytics adapters for the target portal.
