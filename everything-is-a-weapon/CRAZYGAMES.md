# Publishing BONK! on CrazyGames

Everything needed for the submission is in this folder:

| What | Where |
| --- | --- |
| Game file to upload | `dist-crazygames/index.html` (the whole game is this one file; `bonk-crazygames.zip` contains the same file) |
| Landscape cover, 1920x1080 | `covers/cover-landscape-1920x1080.png` |
| Portrait cover, 800x1200 | `covers/cover-portrait-800x1200.png` |
| Square cover, 800x800 | `covers/cover-square-800x800.png` |

The game is one self-contained file of about 5.0 MB (limit: 50 MB): the code, styles and UI
art are inside `index.html`, so there is no assets folder to upload or to go missing. The only
thing it fetches is CrazyGames' own SDK script.

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
2. Game engine: **HTML5**. Upload `dist-crazygames/index.html`. If the page comes up as plain
   unstyled text, an older multi-file build was uploaded: delete it and upload this one file.
3. When asked about saving progress, choose **"Yes, using the Data Module from the CrazyGames
   SDK"**. The game saves through it; with any other answer the SDK refuses the saves and the
   game falls back to the browser's own storage.
4. Orientation: **landscape** on mobile. (The game's own "rotate your phone" prompt is off in
   this build; CrazyGames shows theirs.)
5. Upload the three covers. A preview video is also asked for; that has to be recorded from
   real play and is not in this folder.
6. Open the **preview / QA tool** they give you and play a few rooms before sending it for review.

### Text for the form

**Title:** BONK! Everything Is a Weapon

(The longer title is deliberate. CrazyGames asks for names that cannot be confused with
another game, and "Bonk" on its own is close to other physics games such as bonk.io and
Bonk Survivor. The covers show only "BONK!", which is part of this title.)

**Category:** Action (tags: physics, funny, sandbox, 2D, mouse, mobile)

**Description:**

> It is 3 a.m. and a removal crew of living cardboard boxes is trying to move you out of your
> own flat. You have no weapon. Good. The flat is full of them.
>
> Grab the chair, the toaster, the frying pan or the cat's dinner and throw it. Tip the lamp
> into the puddle. Set off the bag of flour. Knock the bookshelf onto three movers at once.
> Everything in every room can be used, and things set each other off: there are over 130
> ways for it to go wrong for them, and the game keeps a board of the ones you have found.
>
> Pick one of four heroes, each with a pet that has its own way of helping: a dog that will
> not let go, a cat that disappears into a fight cloud, a dive-bombing parrot and a hamster
> in a very large ball.

**Controls (desktop):**

- WASD or arrow keys: move
- Mouse: aim
- Left click: grab what is in front of you; hold and release to throw (hold longer, throw harder)
- Right click: drop
- Space: dodge
- R: restart the room
- Esc: pause

**Controls (mobile):**

- Left thumb: move
- Tap the right side: grab the nearest thing
- Hold the right side and release: throw at the nearest mover
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
- **No custom fullscreen** in this build, no links out of the game, no other ad network.

## How the build meets their quality guidelines

Checked against https://docs.crazygames.com/requirements/quality/ and the Basic Launch metrics:

| Guideline | In this build |
| --- | --- |
| New players land directly in gameplay | A first-time visitor starts in room 1 with no menu. The menu (heroes, daily challenge, settings) appears after that room. Returning players get the menu: one click to play. |
| Onboarding inside gameplay, visual, short, skippable | Room 1 is the tutorial: a sticky note over the hero shows the movement keys, then "click to grab", then "hold, aim, release". Each note goes away when the player does the thing; nothing blocks play. |
| Show how to control the game | A strip of key caps along the bottom of the screen during play, and the full list on the pause screen. |
| Keys adapt to the keyboard layout | Movement uses physical key positions, so it is the same four keys on every keyboard. The hints show what is printed on them (WASD, or ZQSD on a French AZERTY keyboard). Arrow keys also move. |
| Avoid Escape as the only way to do something | P pauses as well as Esc (Esc also leaves fullscreen in a browser). |
| Readable at their frame sizes | Checked at 821x462 and 907x510: no text under 11px, nothing outside the frame on the HUD, menu, pause, settings and results screens. |
| Same physics at any refresh rate | Fixed 120 Hz simulation step, independent of the display. |
| Clear goals, progression, a reason to return | Clear the room; a 50-room campaign in five acts with all 20 bosses; 131 discoveries on an evidence board; 4 heroes; a daily challenge; progress saved to the CrazyGames account. |
| Fast to load | About 5.0 MB in total (3.4 MB zipped); no loading screen. |
| No ads before the player has played | No mid-game ad in the first 75 seconds of a visit, on top of CrazyGames' own spacing. |
| Buttons honest about ads | "WATCH AD: CONTINUE" is the same size as RETRY, labelled as an advert, and never delayed or pre-selected. |
| Safe areas in the CrazyGames app | HUD and touch buttons are padded with the device safe-area insets. |
| Keyboard focus in their frame | The game takes focus at start and on every click, so keys work without an extra click. |
| English, PEGI 12, no cross-promotion | English only; cartoon slapstick against cardboard boxes; no links out of the game. |

Two things in their guidelines cannot be settled from here:

- **Audio quality.** All sound is synthesised and has not been listened to by a person on
  good speakers. Play it with sound on before submitting.
- **Difficulty.** Balance comes from scripted play. If the later acts feel unfair to a human,
  say so and the numbers can be eased; average play time and next-day return are the two
  metrics CrazyGames uses to decide on Full Launch.

## Rebuilding after a change

```bash
npm run build:crazygames
```

That writes `dist-crazygames/index.html`. Upload that file as a new version in the developer portal.

To test the integration locally:

```bash
npm run dev:crazygames
```

On localhost the SDK runs in its test mode: ads are replaced by a placeholder overlay and
every SDK call is logged to the browser console.

To redraw the covers after changing the character art, run `npm run dev`, open the game and
paste `scripts/render-covers.js` into the browser console; it writes the three PNGs into `covers/`.

## Not done here

- **Preview video.** CrazyGames asks for one; it needs recording from real play.
- **Played in CrazyGames' own preview tool.** The integration was checked against the SDK's
  local test mode only. Their QA tool is the real test and needs your developer account.
- **Touch controls on a real phone** have still only been checked in a desktop browser.
