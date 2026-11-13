# Publishing My House, My Rules on CrazyGames

Everything needed for the submission is in this folder:

| What | Where |
| --- | --- |
| Game to upload | `my-house-my-rules-crazygames.zip` (3.3 MB): `index.html` plus the `sfx/` folder of recorded sounds. Upload the zip as it is. |
| Landscape cover, 1920x1080 | `covers/cover-landscape-1920x1080.png` |
| Portrait cover, 800x1200 | `covers/cover-portrait-800x1200.png` |
| Square cover, 800x800 | `covers/cover-square-800x800.png` |
| Preview video, landscape 1080p | `covers/preview-landscape-1920x1080.mp4` |
| Preview video, portrait 1080p (2:3) | `covers/preview-portrait-1080x1620.mp4` |

The code, styles and UI art are one file, `index.html`, of about 2.5 MB (`npm run build:crazygames` fails above 3.0 MB).
The only other files are the recorded sounds in `sfx/`, fetched after the first tap; without them the game falls back to
synthesised sound. To rebuild the zip: `npm run build:crazygames`, then zip `dist-crazygames/index.html` with `public/sfx/*.mp3`
under `sfx/`. The covers are painted from the game's own art by `src/debug/renderCovers.ts` (instructions at the top of the file).

**Rebrand (2026-11-13).** The game was previously submitted as "BONK!" and rejected. It is now **My House, My Rules**:
new name and wordmark, a gnome invasion instead of cardboard movers, redesigned heroes, a green house palette,
a store with permanent upgrades (hearts, throw damage, speed, Power) and coins that are kept even when a room is lost.
Submit it as a new game, with the new covers.

## How ads work on CrazyGames (read this first)

CrazyGames launches every new game in two steps:

1. **Basic Launch.** The game goes live, but **ads are switched off and no revenue is shared**.
   CrazyGames watches how players respond.
2. **Full Launch.** If they select the game, ads are switched on and revenue share starts.
   The full SDK integration they require at that point is already in this build.

So the ads are built in and ready, but they only start paying after CrazyGames promotes the
game to Full Launch. During Basic Launch the build behaves correctly with ads off: nothing
freezes between rooms and the "watch ad" button removes itself after the first refusal.

## Submitting

1. Create a developer account at https://developer.crazygames.com and choose **Submit game**.
2. Game engine: **HTML5**. Upload `my-house-my-rules-crazygames.zip` as it is (`index.html` and
   the `sfx/` folder at the top level). If the page comes up as plain unstyled text, an older
   build was uploaded: delete it and upload this zip.
3. When asked about saving progress, choose **"Yes, using the Data Module from the CrazyGames
   SDK"**. The game saves through it; with any other answer the SDK refuses the saves and the
   game falls back to the browser's own storage.
4. Orientation: **landscape** on mobile. (The game's own "rotate your phone" prompt is off in
   this build; CrazyGames shows theirs.)
5. Upload the three covers and the two preview videos. The videos are under 20 seconds, silent,
   open on the cover, and show real play with no HUD or cursor. They were filmed by
   `src/debug/recordTrailer.ts` and cut by `scripts/make-trailer.py` (instructions in both files).
6. Open the **preview / QA tool** they give you and play a few rooms before sending it for review.

### Text for the form

**Title:** My House, My Rules

(Not the old "BONK!" title: this is a new game page, with new covers.)

**Category:** Action (tags: physics, funny, 2D, upgrade, mouse, mobile)

**Description:**

> It is 3:07 a.m. and the garden gnomes have got into the house. All of them. They brought a king.
>
> You have no weapon. Good: the house is full of them. Grab the frying pan, the chair, the toaster
> or the cat's dinner and throw it. Tip the lamp into the puddle. Knock the bookshelf onto three
> gnomes at once and watch their hats fly. Everything in every room can be used, and things set
> each other off: there are over 130 ways for it to go wrong for them.
>
> Every gnome you knock out drops coins, and you keep them even when a room beats you. Spend
> them in the store on extra hearts, a heavier throw, faster feet and a bigger Power, then go
> back and take the room. Fifty rooms, twenty bosses, four heroes, each with a pet that helps:
> a dog that will not let go, a cat that vanishes into a fight cloud, a dive-bombing parrot and
> a hamster in a very large ball.

**Controls (desktop):**

- WASD or arrow keys: move
- Mouse: aim
- Left click: grab what is in front of you; hold and release to throw (hold longer, throw harder)
- Right click: drop
- Space: dodge
- R: restart the room
- P or Esc: pause

**Controls (mobile):**

- Left thumb: move
- Tap the right side: grab the nearest thing
- Hold the right side and release: throw at the nearest gnome
- Buttons on the right: dodge, drop

## What the build does for CrazyGames

All of it lives in `src/platform/` and is only compiled into this build
(`npm run build:crazygames`); the normal web build has none of it.

- **SDK v3** loaded in the page head and initialised before the game starts.
- **Mid-game ads** are requested between rooms: when NEXT ROOM is pressed on the results
  screen, and when RETRY is pressed after losing. Never during play, never from a menu
  button. CrazyGames spaces them itself (at most one every three minutes) and ignores a
  request that comes too soon, so the game simply asks at every break.
- **Rewarded ad:** after losing a room, "▶ WATCH AD: CONTINUE" puts you back on your feet in
  the same room, once per room. It sits beside RETRY at the same size, says plainly that it
  is an advert, and is not shown when an ad blocker is detected or when CrazyGames says ads
  are off. If no ad comes back, no reward is given, a note says so, and the button goes.
- **While an ad is being fetched** the results buttons cannot be pressed. Audio is muted only
  when an ad actually starts, and restored when it ends.
- **Gameplay start/stop** is reported every time the player gains or gives up control
  (room start, pause, results, menu). Loading start/stop is reported at boot.
- **CrazyGames' mute switch** silences the game and cannot be overridden by the in-game setting.
- **Saves** go through the SDK's data module, so progress follows a logged-in player between devices.
- **Progress percentage** (campaign rooms cleared, out of 50) is reported at start and after each room.
- **Confetti** (`happytime`) once: the first time room 50 is cleared.
- **Game context** (room number and hero) is attached for player feedback.
- **Device type** comes from the SDK's system info: on a phone or tablet the touch controls are
  shown from the first frame (a coarse pointer or the first touch also switches them on).
- **No custom fullscreen** in this build, no links out of the game, no other ad network.

## How the build meets their quality guidelines

Checked against https://docs.crazygames.com/requirements/quality/ and the Basic Launch metrics:

| Guideline | In this build |
| --- | --- |
| New players land directly in gameplay | A first-time visitor starts in House Rule 1 with no menu ("3:07 A.M. THE GNOMES GOT IN."). Returning players get the menu: one click to play. |
| Onboarding inside gameplay, visual, short, skippable | Five short House Rules, each one move: throw, water + electricity, dodge, the Power, the pet. A prompt says what to do and goes when the player does it; nothing blocks play. |
| Show how to control the game | A strip of key caps along the bottom of the screen during play, and the full list on the pause screen. |
| Keys adapt to the keyboard layout | Movement uses physical key positions, so it is the same four keys on every keyboard. The hints show what is printed on them (WASD, or ZQSD on a French AZERTY keyboard). Arrow keys also move. |
| Avoid Escape as the only way to do something | P pauses as well as Esc (Esc also leaves fullscreen in a browser). |
| Readable at their frame sizes | Checked at 800x450, 821x462 and 907x510; the store and the loss report have a compact layout under 520px of height. |
| Same physics at any refresh rate | Fixed 120 Hz simulation step, independent of the display. |
| Clear goals, progression, a reason to return | Clear the room; a 50-room campaign in five acts with all 20 bosses; 131 discoveries on an evidence board; 4 heroes; a daily challenge; progress saved to the CrazyGames account. |
| Fast to load | 3.3 MB in total: `index.html` 2.45 MB (1.3 MB gzipped) plus 71 small sounds fetched after the first tap; no loading screen. |
| No ads before the player has played | No mid-game ad in the first 75 seconds of a visit, on top of CrazyGames' own spacing. |
| Buttons honest about ads | "WATCH AD: CONTINUE" is the same size as RETRY, labelled as an advert, and never delayed or pre-selected. |
| Safe areas in the CrazyGames app | HUD and touch buttons are padded with the device safe-area insets. |
| Keyboard focus in their frame | The game takes focus at start and on every click, so keys work without an extra click. |
| English, PEGI 12, no cross-promotion | English only; cartoon slapstick against garden gnomes (they lose their hats, nobody bleeds); no links out of the game. |
| Stuck players have a way forward | Coins are kept when a room is lost: gnomes pay as they fall, bosses as they are hurt or lose a tentacle or head. The loss screen leads with UPGRADE when the purse can buy something. A scripted player clears 44 of the 50 rooms with no upgrades and 47 with them, and every room it loses still pays coins. |

Two things in their guidelines cannot be settled from here:

- **Audio quality.** Recorded sounds (`sfx/`) with synthesised fallbacks; not yet listened to
  by a person on good speakers. Play it with sound on before submitting.
- **Difficulty.** Balance comes from scripted play. If the later acts feel unfair to a human,
  say so and the numbers can be eased; average play time and next-day return are the two
  metrics CrazyGames uses to decide on Full Launch.

## Rebuilding after a change

```bash
npm run build:crazygames
```

That writes `dist-crazygames/index.html`. Zip it with `public/sfx/*.mp3` under `sfx/` (see the
top of this file) and upload the zip as a new version in the developer portal.

To test the integration locally:

```bash
npm run dev:crazygames
```

On localhost the SDK runs in its test mode: ads are replaced by a placeholder overlay and
every SDK call is logged to the browser console.

To redraw the covers after changing the character art, run `npm run dev`, open the game and run
`await (await import('/src/debug/renderCovers.ts')).renderCovers()` in the browser console; it
writes the three PNGs into `covers/`.

## Not done here

- **Preview video by a person.** The previews are real play by a simple scripted player; a
  human recording of a good run would show off more.
- **Played in CrazyGames' own preview tool.** The integration was checked against the SDK's
  local test mode only. Their QA tool is the real test and needs your developer account.
- **Touch controls on a real phone** have still only been checked in a desktop browser.
