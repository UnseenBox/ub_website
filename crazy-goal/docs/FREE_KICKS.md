# Free Kicks: technical guide for coding agents

Written from the final code (2026-11-11). Numbers quoted here are the values in `free-kicks/free-kicks.js`; if you change a constant, update this file. Statements marked **not implemented** are approved design that does not exist in the code yet.

## 1. Overview

Free Kicks is the second game mode of CRAZY KORA. Classic is a top-down trick-shot puzzle (100 levels, rolling-ball physics). Free Kicks is one arena: a ball spot, a defensive wall, the goal and Mimi the cat in goal. The player drags back from the ball, picks GROUND or AIR and a bend, and tries to beat the wall and Mimi.

- GROUND: the ball rolls. Bend it round the wall.
- AIR: the ball has a simulated height `z`. Clear the wall, come down under the crossbar.
- Free play (one ball, endless retries) and the **Street Cup**: five stages of five kicks each, plus **Quick Five** (a seeded random set of five).

It is an isolated module. It never imports from, patches or reads the Classic bundle (`src/**`), and the only Classic data it reads is the sound/mute volume from the save (read-only).

## 2. Project architecture

```
crazy-goal/
  free-kicks/                  shipped, NOT bundled (plain browser scripts)
    free-kicks.js              the game: physics, cards, runner, progress, renderer, tutorial, audio   (CRLF)
    free-kicks.css             the arena UI (.fk-*)                                                   (CRLF)
    game-modes.js              menu layer: GAME MODES entry, mode chooser, Street Cup hub (.gm-*)    (LF)
    game-modes.css
    package.json               {"type":"commonjs"}: crazy-goal is an ES-module package, the tools are CommonJS
    tools/                     offline validator, checks, tests, playtest kit (section 13)
  src/freeKicksAssets.ts       bridge: publishes Vite's hashed asset URLs as window.CrazyKoraAssets
  vite.config.ts               plugin freeKicks(): copies the 4 files to dist/assets/ and adds their tags to index.html
```

Loading order in the built `index.html`: Classic's module script and stylesheet, then `<link>` for `game-modes.css` and `free-kicks.css`, and at the end of `<body>` `<script defer>` for `game-modes.js` then `free-kicks.js`. Deferred and module scripts run in document order, so `src/main.ts` (which imports `freeKicksAssets.ts`) has set `window.CrazyKoraAssets` before the two scripts run.

- `free-kicks.js` is one IIFE exposing `window.CrazyKoraFreeKicks = { start, stop, setCard, sets, progress, quick, physics }`.
- `game-modes.js` finds Classic's DOM (`.screen.menu`, `.menu-actions`, `.menu-play`, `#overlay`), adds a GAME MODES entry, and starts the arena with `CrazyKoraFreeKicks.start(mount, { lang, strings, star, sfx, clips, set, onBack })`. Escape handling and the Tab focus trap for the whole mode live here.
- `window.CrazyKoraAssets` = `{ star, courtyard, sfxSheet, clips: { click, glass_tap, goal, kick_ball, meow, metal, power_up, stone, tin, whistle } }`. `game-modes.js` falls back to the old literal file names when it is missing (hand-assembled folder).
- The CrazyGames edition (`vite build --mode crazygames`) does **not** include Free Kicks: the plugin does nothing in that mode.
- Dev server (`npm run dev`): the plugin serves the files from `/free-kicks/`, `CrazyKoraAssets` holds dev URLs, everything works.

## 3. Gameplay loop

1. `start(container, opts)` builds the DOM from `TEMPLATE`, sets the copy, builds the static pitch, creates the audio bus, binds events, starts one `requestAnimationFrame` loop. With `opts.set` it begins a stage run (`beginRun`), otherwise free play.
2. First time ever: the how-to-play card opens (section 8) and freezes the game.
3. Aim: pointer down within `hitRadiusWorld()` of the ball (`clamp(48 / scale, 58, 170)` world px) starts aiming; pulling back sets power: `pull` is the world distance, dead zone 18, max 250, `power = ((pull-18)/(250-18))^1.15`. Release with `power >= 0.04` shoots, otherwise the aim is cancelled. Mouse, touch and pen use Pointer Events; a second finger is ignored.
4. GROUND / AIR buttons and the bend slider (-100..100, step 5) are only live in `ready` and `aiming`.
5. Launch: `launchVelocity`: speed `520 + 900*power`, aimed along the pull direction; AIR adds `vz = 320 + 60*power`.
6. Flight is stepped at 240 Hz sub-steps (`step / (1/240)` per frame). Each step: integrate, then `checkWall`, `checkKeeper`, `checkFrame` (post/bar) and, if no frame contact, `checkGoal`, then `checkBounds`.
7. Outcome: `goal`, `saved`, `wall`, `wide`, `tooHigh`, `missed` (six states, `OUTCOMES`). After the result delay the result card shows; RETRY resets the round instantly. A shot that touched the frame and found nothing else is called `wide` (post) or `tooHigh` (bar) 0.45 s after the contact and its card says OFF THE POST / OFF THE BAR; the outcome states are still the six above.
8. Stage runs: five kicks, pips tally, kick banner (`KICK 3/5` plus the card name, no distances), restart button, stage result with stars and PRACTICE (tap a pip to replay that exact kick unscored).

## 4. Ball physics

World is 1040x800 px, goal line `y = 150`, mouth x 334..706 (`GOAL.left/right`), ball radius 17, default ball spot (520, 676). The ball is `{x, y, z, vx, vy, vz}`: `x,y` ground position, `z` height, `vz` vertical speed. The screen draws the ball at `(x, y - z*LIFT)` (`LIFT = 1`) with its shadow at `(x, y)`.

`integrateBall(b, dt, type, bend)` (one step, mutates `b`):
- AIR: `vz -= 900*dt; z += vz*dt`. On landing (`z <= 0`) a bounce keeps 20% of the impact speed if the impact was above 120, otherwise the ball stops bouncing. GROUND: `z = vz = 0`.
- Bend: a lateral acceleration `SHOT.curve (2600) * bend * grip`, applied perpendicular to the velocity, then the speed is restored (the velocity only turns). `bend` is -1..1; negative bends left.
- Drag: `exp(-drag*dt)` with 0.24 (ground), 0.08 (airborne, `z > 4`), 5.5 inside the net.

**Why the curve is attenuated.** With constant lateral acceleration `a` and speed `v`, the turn rate is `a/v`, which grows without bound as drag slows the ball: the old build spiralled in ever tighter circles on missed curved shots. `grip` (0..1) removes that:
`grip = smooth(speed from 90 to 240) * (1 - smooth(turned from 135 deg to 170 deg))`, where `b.turned` is the total angle the bend has turned the ball. Below 90 px/s there is no bend, and after about 170 degrees there is none. The bend is also switched off (`b.curveOff`) after a frame hit, a keeper save, and inside the net. Shots that score turn at most ~139 degrees at over 440 px/s, so they are unaffected. `SHOT.curve` itself was not changed.

**Frame collision** (`frameHit`, `frameBounce`, constants in `GOAL.frame`):
- Posts are vertical cylinders at x = 324 and 716, y = 143. The hit radius is 22 (post radius 10 + an effective ball radius of 12), so the scoring mouth is the old one: ball centre 346..694. Posts only touch a ball below 69 in height.
- The crossbar is a horizontal cylinder in the (y, z) plane at y = 146, z = 64, hit radius 5, between the posts. A ball whose height at the goal line is about 59..69 hits it; below that is a goal, above is over.
- The test is swept along each sub-step (`segCircle`), so a 1420 px/s ball cannot tunnel. The ball is put back 0.6 px outside the surface and the speed into the frame returns as `restitution * speed` (0.58 post, 0.5 bar); the sliding part keeps 90%. A contact only counts when the ball is moving into the surface, so it fires once. After a frame hit the ball stays in play: a rebound that crosses the goal line inside the mouth is a goal.

`simulateShot(scenario, shot, options)` is the headless version of all of this (same step functions, 60 Hz frames x 4 sub-steps). It is what the validator calls.

## 5. Trajectory preview

`simulatePreview(aim)` integrates with the same `integrateBall`, `wallCrossing`, `frameHit`/`frameBounce` and `goalCrossing` as the shot (no separate approximation). GROUND previews 0.34 + 0.34*power seconds (a teaser); AIR follows the whole arc to the landing, the frame or the goal line (up to 1.5 s).

- GROUND: ink dots on a thin floor rail, BLOCKED chip where the wall stops the ball, AROUND chip when the path passes the end of the wall.
- AIR: dashed shadow track on the ground; gold dashed arc with a glow, marker size grows with height; vertical stems from the ground to the ball (longer = higher); a tick at the top of the wall at the crossing; a green star + CLEAR chip when over it or a red ring + BLOCKED when too low; the highest point; a landing ellipse with a cross; POST / BAR marker if the frame would be hit; a ring (goal) or red X (over / wide) at the goal line.
- Side-view panel (`drawAirProfile`, AIR only): height against ground distance on the side of the screen away from the ball, with the wall, the crossbar line and the arc. A straight lob lies along its own line of travel when seen from above, so this is what makes height readable.
- Not simulated in the preview: Mimi.

## 6. Goal and net

Goal frame is drawn by `drawGoalFrame` (posts, crossbar; the struck piece lights up for 0.28 s with an impact ring). Geometry: `GOAL.postR 10`, `height 56` (drawn post height), `depth 68` (net back at y = 82), mouth 372 wide. `goalCrossing` is the goal rule: the ball crosses y = 150 moving up; inside `(left+12, right-12)` and height `<= 63` is a goal, inside but higher is `tooHigh`, outside is `wide`. On a goal the ball enters the net (`inNet`, drag 5.5, back/side clamps) and `NetCloth` (a spring mesh) is punched by the entry velocity and rendered with depth. Goal feedback: confetti, flash, hit-stop, shake, sounds.

## 7. Mimi, the goalkeeper

`stepKeeper(k, b, flying, resolved, dt, keeper, air)` (pure, shared by the game, `simulateShot`):
- Idle: sways `sin(idle * 0.9) * 46` around `homeX`.
- Alert: while the ball is flying toward goal (`vy < -70`, still short of the catch line) an alert timer runs. After `alertT` (0.24 s on K2) she heads for `ball.x + ball.vx * t`, the straight-line prediction (a bent shot fools her), with chase gain 9 and acceleration 1500 px/s^2, clamped to x 346..694.
- Tiers `K1..K5` (`alertT`/`reachZ`): .30/28, .24/28 (default), .20/40, .18/52, .14/63. A card picks a tier and may override any field.
- **Ground save** (`keeperCatch`): the ball crosses the catch line `y = 208` within `reachX` (45) of her and below `reachZ`. Single save per shot; deterministic.
- **Aerial save (leap).** For a lob above her ground reach she may leap: she needs `alertT + jumpReact (0.12)` of alert time, to be nearly set (`|vx| <= 170`), and the predicted crossing within `jumpX` (22) of where she stands at the moment the ball is `jumpTime/2` (0.2 s) from the line. The leap is a 0.4 s sine arc of peak `clamp(predicted z - reachZ + 4, 8, room)` with `room = min(24, 52 - reachZ)`: total reach `reachZ + 24` but never above 52. So K1/K2 can leap to 52, K3 to 52, K4 and K5 (reach 52 / 63) do not leap. At the catch line the reach is `reachZ + current leap height` and only `jumpX` wide. A well-placed or high lob, or a bent one, still scores.
- Visuals: while leaping her body rises by the leap height, stretches, paws go up, her shadow stays on the ground and shrinks. A save plays the pounce, "MIAOU!" popup, shake, hit-stop, sparks and dust (aerial: ball stays at the height she met it); result SAVED (note says "caught it low" for AIR).

## 8. Tutorial

Three steps (AIM AND POWER, CHOOSE YOUR SHOT, APPLY BEND) in `free-kicks.js` (`TUT_ART` SVGs, `openTutorial`, `showTutorialStep`, `closeTutorial`). Small animated SVGs; every word comes from the strings. Shows automatically the first time Free Kicks starts on a device; it is marked seen the moment it is shown, in `localStorage["crazy-kora-fk-tutorial"] = "1"` (its own key; falls back to memory when storage is blocked). Buttons: SKIP, BACK, NEXT / PLAY. Esc closes only the card. The `?` button in the HUD (ready/intro phases) reopens it. While open, the game is frozen (`update(0)`), the HUD and arena are `inert`, Tab is trapped inside. `opts.tutorial === false` turns the auto-open off (tests). English and Arabic strings are in `RUN_STRINGS` (`tut*`, `helpLabel`); the bend pictures stay left-to-right in Arabic, like the slider.

## 9. Challenge design and configuration

**Implemented**
- Card: `{ id, name:{en,ar}, tier, intended, mirror, jitter, ball:{x,y}, wall:{men, dist, dx, height}, keeper:"K1".."K5" | {tier, alertT, reachZ, homeX} }`, authored in `free-kicks/tools/cards.v1.json` (17 cards, 6 sets) and embedded between the `fk-cards:begin/end` markers of `free-kicks.js` by `tools/sync-cards.js` (never edit that block by hand). `physics.resolveCard` turns a card into `{ball, wall, keeper}`; `wall.height` is the wall clearance in `z` units (58 = the original) and the drawn wall is stretched by `height/58`, so collision and picture agree.
- Universal star rule, `starsForGoals`: 3 goals = 1 star, 4 = 2, 5 = 3. Same for every stage and Quick Five.
- Stage 5 ("Pressure") lineup: 4.2, 4.1, 5.2, 4.3, 4.4. Cards 5.3 and 5.4 (Expert) are only in the `legend-future` set.
- Card and stage names in English and Arabic; no metre labels anywhere. The kick banner reads `KICK 3/5` and the card name.
- Progress (`Progress`, key `crazy-kora-fk-progress`, `{v:1, stages:{id:{stars,goals,plays}}, quick:{...}}`): best-keeping, merges across tabs, memory fallback, never writes another key. Stage 1 is open, each later stage needs one star on the previous; Quick Five needs one star on stage 3.
- Quick Five (`quick.draw(seed)` pure function of a 6-character seed): slots Easy, Easy|Medium, Medium, Medium, Hard; no Expert; no two adjacent kicks with the same intended route; contains a lob and a curl/bend; mirror 50% when it changes anything; ball jitter up to the card's `jitter` (10 px), clamped so the ball stays 300 px from the goal axis.
- Validator rules: every campaign kick needs a touch make rate of at least 35%, and at most one kick per five-kick set may be below 60%. Quick Five jitter corners are validated the same way.

**Approved but NOT implemented**
- The Legend set as a player-facing mode (a hub entry and its 2/3/4-star exception). `legend-future` exists as data and is reachable only through `start(..., {set: "legend-future"})`; it uses the universal 3/4/5 rule.
- A Quick Five seed-entry screen, a difficulty setting, a reset-progress control.

**Modelled, not measured.** All make rates assume an aim error (mouse 1.2 degrees and 3% power, touch 2.5 degrees and 6%). Real touch playtests (`tools/playtest/`) have not been run.

## 10. Audio

Free Kicks owns its own `AudioContext` (class `AudioBus`), created in `start()` and closed in `stop()`; Classic's `AudioManager` is separate and untouched.

- Sources: the classic sound sheet (`sfx.wav`, offsets in the `SFX` table, the same sheet and offsets as `src/assets/sfx.json`) plus the standalone recordings passed as `opts.clips` (from `window.CrazyKoraAssets.clips`). A clip takes priority over a sheet sound of the same name. If a clip is missing the sound falls back (`SFX_FALLBACK`) to its sheet equivalent, and with neither it is silent: no console errors. Leading and trailing silence of each clip is trimmed like Classic's `AudioManager`.
- Event to sound: kick `kick_ball` (rate 0.92 for AIR); aim start `power_up` (cut when the ball is let go or the aim is cancelled); wall `thud` + `stone` + `grit`; post `thud` + sheet `post`; bar `thud` + `post` (lower) + `tin`; ball landing `thudSoft`; save `meow` + `thudSoft`; goal sheet `net` + `cloth` + `goal`; wide / too high `thudSoft` + `grit`; missed `thudSoft` + `whistle`; stage cleared `cheer`; every button `click`.
- Level: `master = volume * 0.8`; `volume` is read once from Classic's save (`crazy-goal-save`: `muted`, `sound`), read-only. `CLIP_GAIN` sets each clip to roughly the loudness of the sheet sound it replaces. Mute works through that volume. There is no music in Free Kicks; Classic's background track (`bg music.mp3`) belongs to Classic's context.
- Autoplay: the context is created inside the PLAY click, resumed there, and `unlock()` is called on every aim press.
- Cleanup: `stop()` stops all sources, clears the clip map and closes the context; decodes that finish after `stop()` are discarded. Verified: four enter/exit cycles leave four closed contexts and no running source.
- Classic's own sound system (sheet, clips, `bg music.mp3`) is unchanged by this integration. The older generated drum music (`src/audio/Music.ts`) is no longer used by Classic; that was done upstream before this work.

## 11. UI and localization

- Fullscreen canvas (`.fk-arena`) with a floating HUD (`.fk-hud`, pointer-events only on real controls): BACK, title, GROUND/AIR, bend slider, `?` and the star or run tally.
- One camera transform shared by `render()` and `toWorld()`: `resize()` fits the 780x720 focus box (portrait crops to 640 wide) between the HUD and the hint pill and stores `scale`, `offX`, `offY`; the same numbers are used for drawing and for input.
- Responsive: checked from 320x568 to 2560x1080, portrait, landscape and tablet. Short landscape phones shrink the hub art and enlarge the slider hit area.
- RTL: the shell sets `dir`/`lang` from `opts.lang` (`ar` = RTL); icons mirror, letter-spacing is reset, canvas labels use the string table.
- Strings: `opts.strings` (Classic-side `COPY` in `game-modes.js`) override `RUN_STRINGS` (in `free-kicks.js`); `s(key)` falls back to English then to the key. Check with `tools/check-strings.js`. Arabic copy is unreviewed by a native speaker (`tools/arabic-review.md`).
- Reduced motion (`prefers-reduced-motion`): no shake or punch zoom, no impact ring, CSS animations off including the tutorial pictures.
- Accessibility: one polite live region announces banners, results and tutorial steps; the game is pointer-only (no keyboard aiming).

## 12. Lifecycle and cleanup

`start()` replaces any running game (`current.stop()`), then builds everything. `stop()` sets `running = false`, cancels the animation frame, clears timers, aborts the `AbortController` that owns every event listener, disconnects the `ResizeObserver`, destroys the audio bus, empties particles/trail/popups and `replaceChildren()`s the container. Verified in the merged build: one animation loop while playing, none after exit, no orphan canvas, one closed `AudioContext` per visit.

## 13. Development and testing

Run from `crazy-goal/`:

```
npm install
npm run dev          # http://localhost:5191 (Free Kicks from /free-kicks/)
npm run build        # tsc --noEmit && vite build  -> dist/
npm run preview      # http://localhost:4191
```

Open the game through a server, never `file://`. In the game, GAME MODES -> Free Kicks.

Tools (`crazy-goal/free-kicks/tools/`, Node, no dependencies):

```
node sync-cards.js --check      # embedded card library equals cards.v1.json
node check-strings.js           # EN/AR parity, every key the game asks for exists (--sheet rewrites arabic-review.md)
node check-quick.js             # 20,000 Quick Five draws obey every rule
node tests/physics.test.js      # posts, bar, bounded bend, leap envelope
node tests/progress.test.js     # progress / unlock rules
node validate.js --check        # stored metrics match the current physics and cards (exit 1 when stale)
node validate.js --workers 5    # full validation, rewrites cards.v1.metrics.json (about 3 minutes on 12 threads; ask before running on someone's machine)
node validate.js --jitter-only --out cards.v1.jitter.raw.json --workers 5 && node jitter-corners.js
```

After any change to the physics constants or rules, to a card, or to `validate.js`: run the validator and the jitter pair, then `check-quick.js`; the stored metrics contain a fingerprint of the physics behaviour (not of the file text) and refuse to be used when it changed. UI-only edits do not stale them. Never edit the stored numbers to make a check pass.

Verify the deployed build: serve `dist/` (or the deploy folder) with any static server, open GAME MODES -> Free Kicks, play a stage, press Escape, repeat.

Known limitations:
- Make rates are modelled; no human playtest has been run, so no tuning on real hands. Real touch hardware and screen readers are untested.
- Keyboard aiming does not exist.
- The AIR preview does not show Mimi. Stage 5 is no harder than stage 4 under the model (the touch odds are about the same).
- Arabic text is not reviewed by a native speaker (card 5.2 "Pressure" and stage 5 share a word).
- At 568x320 the hub's PLAY button is partly below the fold (scrolls).
- Free Kicks plays its own sound context; it does not share Classic's mute button live (volume is read when a game starts).
- `dist/` is built from source; `public/arcade/crazy-goal/` is the synced deploy copy, refresh it after a build.

## 14. Safety boundaries (do not touch when working on Free Kicks)

- Classic: everything under `src/` except the one import line in `src/main.ts` and `src/freeKicksAssets.ts`, plus `data/levels`, Classic physics, rendering, levels and the duel code.
- Save data: never write `crazy-goal-save` (Free Kicks only reads `muted` and `sound`), never touch `crazy-goal-lang` (read only), never rename the Classic keys. Free Kicks writes only `crazy-kora-fk-progress` and `crazy-kora-fk-tutorial`.
- Duels (`/api/duel`) are not used by Free Kicks.
- The CrazyGames edition must stay Free-Kicks-free unless that is requested explicitly.
- `free-kicks.js` and `free-kicks.css` use CRLF line endings, `game-modes.*` use LF. Do not run `sed -i` on them (it strips the CRs on Windows); use an editor or a script that keeps the endings.
- The embedded card block in `free-kicks.js` is generated; edit `cards.v1.json` and run `sync-cards.js`.
