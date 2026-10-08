# Chronodle

The daily history puzzle. Put 5 moments from history in order, oldest at the top.
You get 4 tries. Cards in the right spot turn green and lock in place. Cards in the
wrong spot turn yellow, with an arrow showing which way they need to move.

- **Daily puzzle**: the same puzzle for everyone each day, with a number (`Chronodle #12`)
  and a spoiler-free emoji grid to share, like Wordle.
- **Practice mode**: unlimited puzzles. Each one has a challenge link (`?p=<seed>`),
  so a friend gets exactly the same puzzle.
- **Streaks and stats** are kept in the browser. There is no backend and no account.
- **Ads**: rewarded ads for 💡 *reveal a year* (2 per puzzle) and 📺 *one more try*
  when you run out. Interstitials appear only between practice puzzles, at most one
  every 2 minutes and never in the first 2 minutes of a session.

TypeScript and Vite, no runtime dependencies. The production build is about 11 kB of
gzipped JavaScript.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173, with a fake ad overlay so you can test the ad flows
npm test           # puzzle, stats and share logic
npm run build      # type check + production build into dist/
npm run build:arcade  # same, into ../../public/arcade/chronodle for the studio site
```

## Ads

Pick the network at build time with `VITE_AD_PROVIDER` (see `.env.example`):

| Value | Use it for |
|---|---|
| `dev` | Local testing. A fake 3-second ad. This is the default in `npm run dev`. |
| `none` | No ads. Rewards are free. This is the default in production builds. |
| `crazygames` | Uploading to [CrazyGames](https://developer.crazygames.com). Uses SDK v3. |
| `h5` | Your own domain, with [Google H5 Games Ads](https://developers.google.com/ad-placement). Needs `VITE_ADSENSE_CLIENT`. |

```bash
VITE_AD_PROVIDER=crazygames npm run build      # then zip dist/ and upload it
VITE_AD_PROVIDER=h5 VITE_ADSENSE_CLIENT=ca-pub-XXXX npm run build
```

If an ad can't load (no fill, an ad blocker, or the SDK fails), the player gets the
reward anyway. The game never blocks on an ad.

When the game runs inside a portal iframe, set `VITE_SHARE_URL` to the portal's game
page so that shared results link back there.

## Deploy

`dist/` is a static site with relative paths, so it runs from any folder:

- **Vercel or Netlify**: build command `npm run build`, output folder `dist`.
- **Studio site arcade**: this folder lives in the `ub_website` repo. `npm run build:arcade`
  builds straight into `public/arcade/chronodle/`, which the /play page serves. Commit that
  build together with the source change. The listing text is in `lib/play.ts`.
- **Game portals** (CrazyGames, GameDistribution, Poki): zip the contents of `dist/`.

## Content

The events live in `src/events.ts`. Keep them well known, with dates nobody argues about.

The daily puzzle is chosen from the date and that list. Adding or removing events
changes every puzzle from that deploy onward, but a puzzle someone has already
started is kept. Ship content updates in batches rather than daily.
