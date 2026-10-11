# Garage Empire: Wash, Fix & Flip

A casual isometric garage-tycoon for the browser. Start with one dirty car in a
tiny garage; end with wash bays, a lift, a tire station, a detail studio, a
paint booth, a used-car lot, a premium showroom, four employees and a flipping
business. Zero runtime dependencies, ~65 KB of JS, all art and audio generated
in code.

## Play

- **Move:** WASD / arrow keys (touch: left thumb-stick).
- **Work / buy / sell:** hold or press **E** / **Space** (touch: **ACTION** button).
  Contextual prompt at the bottom always tells you what standing here does.
- **Pause / help / mute:** top-right buttons or `Esc`.
- Cars drive themselves between parking and free bays; you (and later your
  staff) do the satisfying part: washing, tires, engines, bodywork, detailing,
  paint, then flipping used cars for profit.

## Develop

```sh
npm install
npm run dev      # vite dev server
npm test         # vitest: economy invariants + gameplay-loop + 25-min soak
npm run build    # typecheck + production bundle
```

`?demo=1` on a dev server (or any build with `VITE_DEMO=1`) runs a scripted
hands-free opening wash for headless screenshot tests. It is never active in
normal play (requires the query flag).

## Ship to the arcade

```sh
npm run build:arcade   # typecheck + bundle into ../../public/arcade/garage-empire/
```

The arcade page (`/play/garage-empire`) is registered in
`data/seed/playables.ts` and embeds `public/arcade/garage-empire/index.html`.
The build uses relative paths (`base: './'`), so the same folder also works as
a CrazyGames zip upload: zip the contents of
`public/arcade/garage-empire/` (with `index.html` at the zip root).

CrazyGames notes:

- SDK integration lives in `src/ads.ts` (gameplay start/stop + celebration,
  `VITE_AD_PROVIDER=crazygames`). Ads are strictly optional; the full game
  plays with no ads and a failed SDK load never blocks gameplay.
- No rewarded placements gate progression. If one is added later, keep it an
  optional bonus (e.g. tip doubler), never a requirement.

## Architecture

| File           | System                                              |
| -------------- | --------------------------------------------------- |
| `config.ts`    | balance data + pure economy functions (tested)      |
| `sim.ts`       | customers, job routing, workers, flipping, economy  |
| `world.ts`     | static tile layout                                  |
| `cars.ts`      | parametric vehicle art (6 types + condition wear)   |
| `render.ts`    | isometric renderer, stations, characters, particles |
| `ui.ts`        | HUD, prompts, toasts, modals, touch controls        |
| `state.ts`     | localStorage save with validation + safe defaults   |
| `audio.ts`     | layered procedural shop audio (no assets)           |
| `input.ts`     | keyboard + touch input                              |
| `ads.ts`       | portal ad SDK wrapper (optional)                    |
| `main.ts`      | boot, game loop, event wiring                       |

Progression saves to `garage-empire:save:v1` (money, unlocks, hires, records,
settings). Corrupt or missing saves fall back to a fresh game.
