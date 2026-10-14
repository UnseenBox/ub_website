# Publishing BONK! on GameMonetize.com

Everything needed for the submission is in this folder:

| What | Where |
| --- | --- |
| Game file to upload | `bonk-gamemonetize.zip` (a single `index.html` at the zip root — `dist-gamemonetize/index.html` is the same file) |
| gameId baked into the build | `vytehkcwa8l16v4b1yet7b2ai9z5zl35` (kept in `.env.gamemonetize`) |

The game is one self-contained file of about 530 KB: the code and styles are inside
`index.html`, so the zip cannot lose an assets folder and nothing is fetched except
GameMonetize's own SDK script (`https://api.gamemonetize.com/sdk.js`).

## Submitting

1. Create / log in to your account at https://gamemonetize.com and add the game:
   **Game Management > Add game**. Fill in the title, description, category and
   thumbnail (see `covers/` for the 1920x1080 landscape, 800x1200 portrait and
   800x800 square covers made for the CrazyGames submission — check the size they ask
   for; the landscape one is the usual thumbnail).
2. **Upload**: drop `bonk-gamemonetize.zip` on the game's page (Game Management >
   My games > select the game > drop file to upload). The zip root is `index.html`
   itself, exactly as their FAQ requires.
3. **Verify SDK**: press **Verify Game** on the game's page. It checks that the page
   loads their SDK with your gameId — which is baked into this build — and that ads
   can play.
4. **Submit**: press **REQUEST ACTIVATION**.

## How ads work in this build

Their SDK (v1.2.4) shows Google IMA video ads on top of the page and tells the game
about them through two events; the build follows their README to the letter:

- **`SDK_GAME_PAUSE`** — an ad is about to cover the game. The game pauses (it is
  always between rooms when an ad can appear) and **mutes all audio**. Their one
  mandatory rule.
- **`SDK_GAME_START`** — the ad is done, whether it played or found no fill. The game
  resumes and audio comes back.
- **`SDK_BLOCKED`** — an ad blocker was detected; the game stops asking for ads.

Ads are requested with `sdk.showBanner()` only at natural breaks: when the NEXT ROOM
button is pressed on the results screen, and when RETRY is pressed after losing —
never during play and never from a menu button. This matches the norm of their
catalogue (their SDK paces nothing itself and typical games advertise on every level
end). The first ad cannot come before **45 seconds** of play. While an ad request is
open the results buttons cannot be pressed; if the request dies quietly a safety
timeout unblocks the game after 90 seconds.

**No rewarded ad.** GameMonetize's SDK has no rewarded format with a completion
callback, so the "▶ WATCH AD: CONTINUE" button known from the CrazyGames build is
absent here; the game simply hides it.

**Saves** stay in the browser's localStorage (their SDK has no data module).

## Completing "Verify Game"

Their verifier completes only when it has seen the game make an ad request, so the
session has to reach a natural break:

1. Upload the **current** zip (`bonk-gamemonetize.zip`, one index.html of about
   530 KB — not the old 28 MB BONK.zip, which has no SDK at all).
2. Make sure no ad blocker is on, then press **Verify Game** and play the window it
   opens.
3. Their SDK plays an automatic preroll ad as the page loads (its own doing, on top
   of the game's own ads) — let it finish; that alone counts as the ad request the
   verifier waits for. If no preroll appears, clear room 1 (it is the tutorial; a
   minute or two): about 45 seconds in, the first in-game ad becomes allowed and plays
   at the room's end. Failing a room and pressing RETRY triggers one too. The video
   plays over the game with the sound muted, and the game resumes when it finishes.
4. When an ad has played, the verification completes. Press **REQUEST ACTIVATION**.

If verification still does not complete: open the browser console in the verify
window and check for `[gamemonetize]` warnings — "SDK script did not load" means
something (extension, network) blocked `api.gamemonetize.com/sdk.js`, and no ad can
ever be requested.

## Rebuilding after a change

```bash
npm run build:gamemonetize
```

That writes `dist-gamemonetize/index.html`. Re-zip it (`bonk-gamemonetize.zip`) and
upload as a new version on the game's page.

The gameId comes from `.env.gamemonetize` (`GAMEMONETIZE_GAME_ID=...`); a
`GAMEMONETIZE_GAME_ID` environment variable set at build time overrides it.

To test the integration locally:

```bash
npm run dev:gamemonetize
```

Their SDK runs with the gameId from `.env.gamemonetize`; every event it fires is
logged through `window.__GM_EVENTS__`, and ads play for real — play with the browser
console open to see `SDK_READY`, `SDK_GAME_PAUSE` and `SDK_GAME_START` arrive.

## Checklist before requesting activation

- Upload the zip and open the game's preview — play a few rooms.
- Confirm the first ad only appears after 75 seconds of play and never mid-room.
- Confirm audio returns after an ad (the mandatory mute/resume pair).
- Press Verify Game, then Request activation.