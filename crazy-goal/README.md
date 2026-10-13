# CRAZY KORA (formerly Crazy Goal)

Renamed 2026-10-09. The folder, the site slug (`crazy-goal`) and the LocalStorage keys keep the old name so saves, duel identities and links still work. Since the rename: 100 houmas in nine chapters (THE HOUMA 1–12, NEW GROUNDS 13–24, CRAZY LEAGUE 25–36, LEGENDS 37–48, STREET KINGS 49–60, NIGHT LEAGUE 61–72, GOLDEN HOUR 73–84, HALL OF FAME 85–96, THE FINALS 97–100) with ground themes (`theme` on a level: street, pitch, beach, court, clay, roof, snow, sunset, night) and ground mechanics (`grass`, `water`, `ice`, `boost`), plus pinball bumpers (`bumper`), spinning turnstiles (`spinner`), gusty fans (`fan`) and leafy hedges (`hedge` walls), ball skins unlocked by stars (`src/ball/Skins.ts`, 27 skins up to 285 stars), a settings screen (sound and music volume, English or Arabic, reset progress), chaptered level select with progress bars and best scores, HUD chapter labels with attempts and star-progress bars, a drum loop built from the effect recordings (`src/audio/Music.ts`), layered crowd celebrations with whistle and stadium horn on big goals (`src/audio/SoundLibrary.ts`), and translations in `src/core/i18n.ts` (code writes English; `tr()` swaps it; changing language reloads the page).

**How crazy can you score?**

Street football trick shots in the alleys of the houma. One ball, one goal, one shot: drag back, let go, and get it in any way you can. Off the houses, off the taxi, down the drain, through the window, past the cat. The crazier the route, the bigger the score.

No game engine and no physics library. TypeScript, Vite, Canvas 2D, Web Audio, and nothing else at runtime.

## What is in it

- **100 houmas in 9 chapters**, each introducing one idea, then mixing them. Three stars per houma, a chaptered level list with progress bars and best scores, progress saved.
- **Things in the street:** low walls, leafy hedges (soft bounce), orange crates (dead bounce), the parked taxi (lively bounce, alarm), tyre stacks (throw the ball back faster), pinball bumpers (kick it back harder, with a flash), spinning turnstiles (time your shot), gusty fans (wind that breathes), builder's sand (slows it), a washed-down slope (curves it), manholes (in one, out the other), a delivery scooter (moving, never stops), a pane of glass (bounces a soft shot, breaks for a hard one), a doorbell that opens a shutter, and Mimi the cat in goal.
- **Your last shot stays chalked on the ground**, so you can see what you did and fix it.
- **Crazy Score:** style labels for how the goal went in, a combo multiplier per bounce, a result card.
- Slingshot aiming with a short honest preview, a ball that really rolls, a net that billows, recorded sound effects, pause, mute, instant retry.
- Plays on a desktop and on a phone held upright with the same levels: the pitch is a tall alley.

- **Duels:** challenge a friend by their ID, a tap on a recent rival, or an invite link. Three ways to play: Classic (ten rounds, cards), Quick Clash (five fast rounds, cards), Pure (ten rounds, no cards). Each round is a different street that is the same for both of you, one shot each per round. In Classic and Quick you each hold six cards to play once: three boost your own shot (HARISSA burns through an obstacle, MAGNET pulls the ball into the goal, RUBBER never loses its bounce) and three land on your friend's next shot (MIMI the cat, a half SHUTTER on the goal, SMOKE over the street). Turn based, so you can play together or hours apart. A VS splash opens every duel, goals burst in the scorer's colours, and incoming tricks flash the screen.

Not built yet: spin shots, daily and endless modes, cosmetics, a settings screen, music, ads, analytics.

## Install, run, build

```bash
npm install
npm run dev       # http://localhost:5191
npm run build     # type check, then build to dist/
npm run preview   # serve dist/ on http://localhost:4191
```

## Deploy

`dist/` is a static site with relative paths (`base: './'`), so it runs from any folder.

- **Vercel / Netlify:** framework preset Vite, build command `npm run build`, output `dist`.
- **itch.io and HTML5 portals:** zip the *contents* of `dist/` so `index.html` is at the root of the archive.

## CrazyGames

`npm run build:crazygames` builds the portal edition into `dist-crazygames/` (same sources, `VITE_PORTAL=crazygames`), and `crazy-kora-crazygames.zip` packs exactly that for the Developer Portal (User → Submit a game → upload the zip).

What the portal edition changes, all behind `src/portal/Portal.ts`:

- **Duels are hidden.** Their server lives on unseenbox.com, so the menu tile, the invite flow and the `?duel=` link do nothing in this build. Solo play (100 houmas, shop, skins) is untouched.
- **SDK v3** (`src/portal/Portal.ts`): loaded dynamically with a timeout, `init()` in the background, every call guarded. Outside `local` and `crazygames` environments it stays off, so the itch build behaves byte-for-byte as before.
- **Loading:** `loadingStart` at boot, `loadingStop` on the first painted menu.
- **Gameplay signals:** `gameplayStart` on PLAY / level select / resume / duel shots, `gameplayStop` on pause / level list / menu / goal / duel waits. First start measures ~6 MB initial download (limit 50, 20 for the mobile homepage).
- **Midgame ads** at the one natural break: tapping NEXT HOUMA after a goal. The game freezes (no input, muted, shop hidden, no pause card) until `adFinished`/`adError`, then the next street loads. Never in duels, never mid-shot. Too-early requests are ignored by the SDK itself.
- **Rewarded ads** for +30 coins, offered only in the pause menu (never on a gameplay screen), with a video glyph, hidden entirely during the 90 s cooldown, and the coin shop standing as the no-ad alternative. No reward on `adError`, ever.
- **Housekeeping the QA checks:** tab-hide auto-pauses, no external assets (font, sounds and art are all bundled), no `alert`/`prompt`, no custom fullscreen button, English default with Arabic switch, physics on a fixed 240 Hz step (consistent on 144/165 Hz screens).

`npm run dev` serves the plain build; append `?useLocalSdk=true` on CrazyGames domains is unnecessary — locally the SDK starts in `local` mode by itself and ad calls show test overlays.

## Controls

| Input | Action |
| --- | --- |
| Press and drag back, release | Aim, set power, shoot. The press can be anywhere, not only on the ball |
| Click or tap after a miss or a goal | Retry at once; the same press starts the next pull |
| R | Instant restart |
| Space or Enter after a goal | Next alley |
| Esc | Cancel a pull, otherwise pause |
| M | Sound on or off |
| F3 | Debug overlay (development builds) |

Touch uses the same code path as the mouse through Pointer Events. On screen there is a pause button, and retry and next buttons under the result card.

## How it fits together

```
data/levels/houma.ts   the 100 level definitions (plain data)
src/
  core/        Game (state machine), GameLoop, Time, EventBus
  input/       InputManager + Pointer, Keyboard, Touch
  physics/     RigidBody, Collision, CollisionResolver, SpatialGrid, PhysicsWorld
  ball/        Ball, ShotController, TrajectoryPreview, BallTrail
  goal/        Goal, GoalNet, GoalDetector, GoalCelebration
  levels/      LevelDefinition, Level
  mechanics/   Mechanic (base) + Tyre, Bumper, Spinner, Fan, Pipe, Zones (Sand, Slope), Scooter, Glass, Bell, Cat
  scoring/     ShotAnalyzer, StyleRecognizer, ScoreSystem
  feedback/    Feedback: every event turned into sound, particles, camera, time
  particles/   ParticleSystem, Popups
  audio/       AudioManager, SoundLibrary
  rendering/   Renderer, Camera, ArenaArt, MechanicArt, GoalArt, BallArt, AimArt
  ui/          HUD (canvas), Overlay (title, level list, pause, result buttons: DOM)
  save/        SaveManager
  debug/       DebugOverlay, TestHooks
```

Three rules hold it together:

1. **`Level` is headless.** It owns the physics world and the mechanics and knows nothing about drawing, sound or the player. A script can build one and fire a thousand shots at it, which is how levels are validated.
2. **`Game` decides what happened** (launch, bounce, goal, miss, reset) and announces it on the `EventBus`.
3. **`Feedback.ts` decides how it feels.** Sound, particles, shake and hit stop all live there, so tuning the juice never touches gameplay.

The shot states are `menu → ready → aiming → flight → goal | missed → ready`.

## Physics

The world is top down. The alley is 700 units wide; 40 units are shown to the player as one metre.

- **Fixed step, 240 Hz**, so nothing tunnels. Rendering interpolates between steps.
- **Shapes:** circles and boxes; boxes can be rotated.
- **Static bodies** live in a `SpatialGrid`. **Movers** (the scooter, the cat) are kinematic: they follow their own path, and the ball bounces off them in their frame of reference, so a scooter coming at the ball adds its pace.
- **Response** (`CollisionResolver.ts`): restitution along the normal, fading at low speed so the ball settles; Coulomb friction on the contact slip.
- **Rolling:** a fixed deceleration plus proportional drag. Hard shots carry, slow balls stop instead of creeping.
- **Fields** (the slope) add to `body.ax / ay`, which the integrator applies and clears each step.

The aim preview runs the same `stepBody` on a ghost ball. It shows the start of the shot and the first touch only; it does not follow pipes or slopes, so later alleys are harder to read by design.

Feel is tuned in `BALL_TUNING` (`ball/Ball.ts`), `SHOT_TUNING` (`ball/ShotController.ts`), the `BLOCKS` table in `levels/Level.ts`, and the constants at the top of each mechanic.

## Adding a level

1. Add an entry to `LEVELS` in `data/levels/houma.ts`: where the ball starts, the goal, `walls`, `mechanics`, and the scores for two and three stars.
2. Run the game and call `__cg.sweep(n)` in the console, where `n` is its number. It fires every angle at several powers at a private copy of the level and lists the shots that score, with bounce counts and which mechanics they used. An empty list means the level is impossible; if every hit looks the same, it has only one answer.

## Adding a mechanic

1. Add its shape to the `MechanicDef` union in `levels/LevelDefinition.ts`.
2. Write a class in `src/mechanics/` extending `Mechanic`. Override only what it needs: `move` (every step), `contact` (the ball hit one of its bodies), `after` (after the ball moved), `reset` (new shot), `tick` (animation). Announce what it did through the `sink`.
3. Add one `case` to `Level.addMechanic`.
4. Draw it in `rendering/MechanicArt.ts`: `drawMechanicGround` if it lies flat, `drawMechanicSolid` if it stands up (set `sortY` so it sorts against the ball).
5. Give it a sound and particles in the `MECHANIC` handler of `feedback/Feedback.ts`, and a style label in `scoring/StyleRecognizer.ts` if it deserves one.

No core system changes.

## The goalkeeper

`mechanics/Cat.ts`. She sees only what the player sees: she watches the ball's current line, and after a reaction delay runs to where that line crosses hers, at a limited speed and acceleration. She cannot read a bounce before it happens. A new keeper is a new `speed` in level data, or a new class with a different `move`.

## Scoring

`ShotAnalyzer` records the facts of a shot. `StyleRecognizer` turns facts into labels, each with points. `ScoreSystem` adds them, applies the combo, and awards stars.

```
Crazy Score = (GOAL 1000 + style bonuses) x (1 + 0.15 per bounce)
```

Banks are worth 100 / 300 / 800 / 1500 for 0 to 3 bounces and 2400 and up beyond that. Using something in the street adds its own label (BOING, PINBALL WIZARD, SPIN DOCTOR, WIND RIDER, HEDGEHOPPER, BOING BOING, OFF THE TAXI, PIPE DREAM, SMASH AND GRAB, DING DONG, SCOOTER ASSIST, OFF THE CAT...), three different ones in a shot is a CHAIN REACTION, and there are labels for how it was struck (BOOMERANG, PERFECT, ROCKET, JUST ENOUGH, IN OFF THE POST). A new label is one more rule in `recognizeStyles`.

## Duels

A duel needs a server, and the only one is the UnseenBox website (`D:/DEV/UnseenBox_website`): `app/api/duel/route.ts` and `lib/duel/store.ts`, with two tables in its Neon database (`duel_players`, `duels`). Duels are versioned: version 2 (ten rounds, no mode) still plays as Classic; new duels store their mode too. The game calls `/api/duel` on its own origin, so duels work when the build is served from unseenbox.com and nowhere else; on itch.io or a portal the lobby says so and the rest of the game is unaffected. In development Vite proxies `/api` to the site running on port 3210.

How it works:

- **Identity.** The first time the lobby opens, the server issues a six character ID and a secret. Both are kept in LocalStorage. The ID is what a friend types; the secret proves you are you. There are no accounts.
- **Rounds.** `data/duel/rounds.ts` holds the streets: what stands in each one, where the ball starts and where the goal is. A duel's seed picks and orders ten of them, the same for both players. Nothing is placed by the players.
- **Shots.** A duel street allows one shot (`shotRule: 'single'`). The outcome, the recorded path, the card played and what the street did (`events`, `movers`) go to the server.
- **Cards.** `src/abilities/Cards.ts` lists the six. A boost changes the physics of your own shot and lives in `Level` (`arm`, `magnetField`, the burn and rubber code in `step`); the aim preview uses the same magnet field, so the dotted line bends the way the ball will. A trick changes the other player's next street and lives in `buildDuelLevel` (the cat, the shutter) or is only drawn (`Game.smoke`). Each card is played once per duel, one per round; the server voids a card played twice.
- **Replays.** Your friend's shot is shown by moving the ball along their recorded path, not by running the physics again, so both players always see the same thing whatever their browser. The recorded events put the street through the same motions: the pane breaks, the shutter lifts, the burnt crate goes.
- **Order of play** is one function, `nextStep` in `DuelController.ts`: take your shot of the round, wait for theirs if it is not in, watch it, move on. A round opens once both shots of the one before are in, which is also what makes a trick land on the right shot.

The server stores each shot once and never lets a slot be overwritten. It does not re-run the physics, so it trusts the client about whether a shot went in: this is a scoreboard between friends, not an anti-cheat system. Duels from before the cards (five rounds, with traps) are no longer listed.

To add a street, add a template to `DUEL_TEMPLATES` and check it with `__cg.duelWays('<id>')` in the dev console, which counts the test shots that score on it (with a boost or a trick too, if asked). To add a card, add it to `CARDS`, to the server's `CARDS`, give it its behaviour in `Level` or `buildDuelLevel`, its look in `AbilityArt.ts` and its icon in `DuelUi.ts`.

## Sound

The effects are recordings, not synthesis. They come from two CC0 packs by Kenney (Impact Sounds, Interface Sounds; see `src/assets/CREDITS.txt`). `scripts/build-sfx.py` picks the clips the game uses, trims and levels them, and packs them end to end into one file, `src/assets/sfx.wav`, with `src/assets/sfx.json` saying where each starts. One file means one download and one decode, and WAV plays on every browser.

`SoundLibrary.ts` decides what plays when: it layers clips (a ball thump under whatever was hit), picks a heavier recording for a harder hit, and detunes each play slightly so repeats do not sound stamped. Three things are still synthesised: the taxi alarm and the scooter horn, which are electronic in real life, and the cat, for which there is no recording yet.

To change a sound, edit the `SOUNDS` table in the script (game sound, pack, file, number of variants), run it against the unzipped packs, and rebuild. To use your own recording, point an entry at your file.

## Testing without a human

In development builds `window.__cg` drives the game deterministically. Call `__cg.game.loop.stop()` first so only your steps advance time.

```js
__cg.level(7)          // jump to an alley, locked or not
__cg.shoot(-120, 0.8)  // angle in degrees (-90 is straight up the alley), power 0 to 1
__cg.step(1.5)         // advance 1.5 seconds without waiting for frames
__cg.info()            // state, ball, score, style lines
__cg.sweep(7)          // every scoring shot on alley 7
```

The dev server also accepts `POST /__poster/<name>` with a JPEG body and writes it to `.shots/`, which is how the game's own canvas is captured for checking; `POST /__poster` writes `poster.jpg`.

## Connecting ads and analytics

Neither exists yet and nothing in the game calls an SDK. Analytics is a subscriber on the `EventBus`: every event it would want is already emitted. Ads belong behind an `AdManager` interface with a mock provider, called only at natural breaks (after a result card, never during aiming, flight or a celebration), with portal SDKs as adapters.
