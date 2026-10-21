# BONK 2.0 — Chaos Kit UI reskin

**Full visual replacement of the seven existing screens**
**Date:** 2026-10-21
**Status:** Draft for approval
**Source:** `everything-is-a-weapon/` (Vite + TypeScript canvas game), branch `bonk-2.0`
**Art source:** `D:\Screenshots\Bonk\bonk_ui-kit` (115 PNGs, 2×, `manifest.json`, Lilita One licence)

---

## 0. One-page summary

The game keeps every screen, flow, control and behaviour it has today. Only the
presentation changes: the torn-paper / ransom-note / plasters skin is replaced by
the Chaos Kit look — deep blue backdrop, beveled ink-outlined panels, lime and
lavender header strips, chunky Lilita One type, and the beveled lime button with a
light top edge and a chevron.

The kit's full-screen compositions (`menus/main-menu@2x.png` and friends) are
**art direction, not textures**. They contain baked labels and sample numbers
("ROOMS UNLOCKED 2/3", "12,450", "100 / 100", "HOLD THAT THOUGHT."). We recreate
their layout in DOM and CSS so every value stays live, and use the kit's
transparent PNGs — icons, characters, pets, room keys, ribbons — as real assets.

There is no new screen, no new game system, no new currency, no dead button.
Kit concepts with no data behind them (timer, waves, noise meter, trophies, store
purchases, best runs) do **not** ship.

---

## 1. Goals, non-goals, anti-goals

**Goals**

- All seven screens look like one product drawn by one hand.
- Every number, label and state remains driven by live game data.
- Desktop and phone both look deliberate; touch controls and the rotate prompt
  are skinned too.
- The old skin is fully retired: no torn paper, no ransom letters, no plasters,
  no luggage tags, no receipt.
- Existing tests keep passing; no gameplay logic changes.

**Non-goals**

- Adding screens the game does not have (store, trophies, best runs, bad-ideas
  book, challenge, language, loading, welcome).
- Gameplay, balance, save format, scoring, or new content.
- Redrawing or editing the supplied artwork.
- Localisation. The game is English-only; kit labels are English.

**Anti-goals** (these make the work a failure even if it "works")

- A screen that mixes old and new skins.
- Six agents each inventing a button, so panels differ by 2 px, radii or shadow.
- Baked PNG text showing through under live text.
- A button that does nothing, or a nav tab with no destination.
- Text that clips at 1280×720, at 1600×900, or on a 390 px wide phone.

---

## 2. Design language (extracted from the kit)

Sampled from the supplied PNGs, not invented:

| Token | Value | Use |
| --- | --- | --- |
| `--b2-ink` | `#26212D` | every outline, 5–6 px at 1× |
| `--b2-panel` | `#54465E` | panel body |
| `--b2-panel-dark` | `#22243D` | lobby stat chips, nav bar |
| `--b2-navy` | `#171336` | page backdrop behind panels |
| `--b2-blue` | `#2585FF` | primary accent, nav active, icon fills |
| `--b2-blue-deep` | `#2469C7` | lobby backdrop |
| `--b2-lime` | `#C9EF58` | positive header / primary button |
| `--b2-lime-edge` | `#ECF2AD` | 3 px top highlight inside lime buttons |
| `--b2-lavender` | `#B4A0E4` | neutral header / secondary button |
| `--b2-yellow` | `#FFCD38` | PLAY, rewards, stars |
| `--b2-red` | `#EF4B5E` | danger, damage, defeat |
| `--b2-cream` | `#FFF1D3` | HUD health plate |
| `--b2-white` | `#FFFFFF` | type |
| `--b2-floor` | `#C9B598` | only if a screen needs a warm surface |

**Shape.** Panels are irregular octagons: clipped 18 px corners at the top, 10 px
at the bottom, with a 6 px ink stroke and an 8 px hard drop shadow (no blur).
Headers are a clipped strip in lime/lavender/blue/red, inset 8 px from the panel
edge, carrying a 28–32 px Lilita One title in white with a 2 px ink outline.

**Type.** Lilita One (SIL OFL, licence supplied with the kit) for every heading,
button, chip value and HUD number. Body copy and long labels use the existing
Nunito stack so paragraphs stay readable. Numbers in HUD chips are tabular.
Letter-spacing is 0.02em on small caps labels, 0 on big numbers.

**Buttons.** One component, five colour variants. Beveled parallelogram, 4 px ink
stroke, 8 px hard bottom shadow in a darker shade of the fill, 3 px light strip
across the top edge inside the fill, label centred, optional chevron `›` at the
right. Hover lifts 2 px, active presses down onto the shadow, focus adds a 3 px
white outline offset 3 px. Disabled desaturates to 40% and loses the shadow.

**Motion.** 120–160 ms, `cubic-bezier(.2,.8,.3,1)`. Panels scale from 0.96 with
opacity; banners drop 12 px with a small overshoot. `prefers-reduced-motion`
removes all transforms and keeps opacity only. No looping animation except the
existing HUD pulses the game already drives.

---

## 3. Assets: what is used directly, what is rebuilt

**Used directly (transparent PNG, no baked text):**

- `icons/*` — toaster, lamp, pan, box, heart, coin, bolt, key, coffee, tape,
  trophy, slipper, pizza, characters ×4, pets ×4, powers ×4.
- `buttons/room-key-*.png` — the three hanging keys on the rooms board.
- `banners/bonk-cast@2x.png` — lobby centre illustration.
- `banners/bonk-logo@2x.png` — lobby wordmark (replaces the ransom letters).
- `banners/victory`, `banners/defeat`, `banners/discovery`, `banners/new-best`
  — used only where the baked headline *is* the message we want to show, and
  only as decorative banners, never as a container for live numbers.
- `banners/achievement-banner`, `banners/low-health`, `banners/boss-warning`
  are **not used**: the HUD announcement layer is disabled
  (`ANNOUNCEMENTS_VISIBLE = false`) and this reskin does not re-enable it.
- `hud/item-slot@2x.png`, `hud/countdown@2x.png`, `hud/pickup-prompt@2x.png` —
  frame art only, cropped as a background with live text laid over a flat area
  that contains no baked text. If the crop cannot avoid baked text, rebuild it.

**Rebuilt in CSS (because they carry numbers or labels that must be live):**

- `menus/*` — every full-screen composition. Reference only, never shipped.
- `hud/health`, `hud/coins`, `hud/timer`, `hud/wave`, `hud/combo`,
  `hud/boss-health`, `hud/objective`, `hud/noise-meter`, `hud/menu-*`.
- `buttons/*` that bake a word we need to change (`play`, `resume`, `retry`,
  `back`, `confirm`, `cancel`, `claim`, `equip`, `start-night`, `locked-button`,
  `share-button`). Their **shape** is reproduced in CSS; their PNG is not used.

**Not used:** `menus/main-menu-mobile`, `menus/character-select-mobile`,
`menus/shop-mobile`, `menus/room-keys-mobile` (no separate mobile layouts in
scope beyond responsive CSS), `menus/gameplay` (reference), `hud/timer`,
`hud/wave`, `hud/noise-meter`, `icons/menu-defender`, `hud/menu-night`,
`hud/menu-progress-*`, `hud/menu-scrap` (rebuilt smaller in CSS).

Assets are copied from the kit into `src/ui-kit/bonk2/assets/` with folder names
preserved. Only referenced files are emitted by Vite.

**Font.** Lilita One is not in the kit folder, only its licence. We download the
OFL woff2 from Google Fonts once into `src/ui-kit/bonk2/fonts/`, with
`FONT-LICENSE.txt` alongside. If the download fails, fall back to the bundled
Barlow Condensed Black and record it in the design log rather than silently
shipping a different look.

---

## 4. Screens

### 4.1 Lobby (main menu)

Target: `menus/main-menu@2x.png` composition, minus the shortcuts with no
destination.

- Backdrop: `--b2-blue-deep` with the kit's dotted texture (CSS radial-gradient,
  not the PNG).
- Top-left: night-shift chip — room number badge + "NIGHT SHIFT" + clock +
  selected room name. No daily-contract entry point: `playDaily()` has no UI
  caller today and this reskin does not add one.
- Top-right: scrap chip — coin icon + value.
- Left: rooms-unlocked chip (value, progress bar, key icon) and bad-ideas-found
  chip (value, book icon), both live.
- Centre: `bonk-logo` PNG, tagline, `bonk-cast` illustration, current room strip.
- Right: SETTINGS shortcut (works) and STORE shortcut (opens the settings SHOP
  tab). No trophies, tonight or reward shortcuts.
- Bottom: lime PLAY button with the selected room name beneath; bottom nav with
  HOME (current), ROOMS, CHARACTERS, STORE, SETTINGS.
- Credits bar stays, restyled to the kit's small print.

All elements that exist today keep their behaviour and accessible names. ROOMS
and CHARACTERS open the existing `#bonk-mode` sheet (same tabs, Escape and focus
trap); there is no router and no new navigation stack.

### 4.2 Rooms (MODE sheet, rooms tab)

Target: `menus/level-select@2x.png` — wooden key wall.

- Header "THE KEY WALL" + "EVERY ROOM. A NEW BAD IDEA."
- Wooden board with one key card per room: number, hanging key art (the three
  supplied keys cycled by room index), room name plate, star row, boss mark,
  best score. States: selected (lime plate + tick), ready (red plate), locked
  (ink plate + lock). Depths and generated rooms keep the existing tile list
  below the board so all 9+ rooms remain reachable.
- Footer: selected room name, unlock hint, ENTER ROOM button. ENTER ROOM selects
  the room; PLAY on the lobby starts it (same two-step flow as today).
- No map toggle, no `?unlock` visuals change.

### 4.3 Characters (MODE sheet, characters tab)

Target: `menus/character-select@2x.png`.

- Four hero cards, each with the kit's `character-*` portrait (violet → tenant,
  teal → flatmate, rose → gran, lime → kid), name, note, pet portrait from
  `icons/pet-*`.
- Selected card: lime ring, crown, "SELECTED" plate. The old canvas hero
  portraits are retired; the real player art still renders in-game.
- Header "THE NIGHT SHIFT", footer hint. Clicking selects and persists exactly as
  today.

### 4.4 In-game HUD

Target: `menus/gameplay@2x.png` HUD language.

- Health: cream plate with hearts equal to max HP, numeric `hp / max`, and a thin
  pink bar. Low state turns the plate red and pulses (respecting reduced motion).
- Room badge: blue pentagon with the room number / `D` for daily.
- Score: coin chip with rolling total; scrap chip.
- Combo: starburst sticker with `×N`, only visible when combo > 1.
- Powers: one item slot per owned ability, cooldown as a radial sweep.
- Enemy lineup: keep the canvas mugshots but reframe them as kit badges; greyed
  when waiting, crossed when defeated.
- Boss bar: kit boss-health plate with name, tag, segmented fill and phase pips.
- Heat: recoloured to the kit palette, same behaviour.
- Challenge sticky: becomes the kit objective card (lime corner tab, note text).
- Discovery toast: slides in with the `banners/discovery` ribbon, keeps the
  count-up and auto-dismiss.
- Coach/tutorial: speech card in the kit's panel style, same text and skip.
- Pause button: kit icon button, same hit area.
- Timer, wave, noise meter, item pickup prompt, countdown: **not added** — no
  data exists. Any kit art for them is unused.

### 4.5 Pause

Target: `menus/pause@2x.png`.

- Panel "HOLD THAT THOUGHT." with subtitle "EVEN CHAOS NEEDS A TEA BREAK."
- Buttons: KEEP GOING (lime), RESTART, SETTINGS, BACK TO MAIN MENU (lavender).
- Powers shop below: each ability a kit card with icon, name, cost, owned state,
  buy button; the scrap counter in the header.
- Controls note and the "MORE" fold stay, restyled.
- HUD remains visible behind, dimmed by the panel's backdrop (today it is not
  dimmed; this is the one behavioural change and is deliberate).

### 4.6 Settings

Target: `menus/settings@2x.png`.

- Panel "ADJUST THE CHAOS" with tabs SETTINGS / SHOP.
- Volume slider as a kit track and knob; four checkboxes as kit tick boxes.
- Buttons: BACK (lavender), SHRED SAVE (red, two-step confirm preserved).
- SHOP tab: the six static kit shop cards stay as a catalogue (they are not
  purchasable today); visual only, no fake prices or buy buttons.

### 4.7 Victory

Target: `menus/results@2x.png` + `banners/victory`.

- `banners/victory` ribbon ("STILL MY HOME!") over the panel.
- "DAMAGE REPORT" lime header, score huge and live, "CHAOS POINTS" label.
- Stars, challenge, objective, tickets, ledger, ability offer, edge cards, next
  room teaser: all preserved and restyled as kit rows and cards.
- Buttons keep today's logic: when an Edge offer exists there is **no** NEXT —
  picking a card advances immediately; NEXT appears only on clears with no
  offer, and a daily clear shows DONE. REPLAY and HOME always. Ad note stays.

### 4.8 Failure

Target: `menus/game-over@2x.png` + `banners/defeat`.

- `banners/defeat` ribbon ("OUT OF THE BOX.") over the panel.
- "INCIDENT REPORT" header, handwritten fields preserved, EVICTED stamp becomes
  the kit red stamp, NEW BEST sticker becomes the kit new-best plate.
- Buttons: RETRY (lime), CONTINUE (ad offer, when available), HOME.

### 4.9 Credits, rotate, fatal

- Credits: modal card in kit style, same copy and close behaviour.
- Rotate prompt: kit panel with the same text and dismiss.
- Fatal overlay: kit panel; it must stay legible and must not depend on any
  asset that may have failed to load.

### 4.10 Blocks that must survive the reskin

These exist today and are easy to lose in a rewrite. Each keeps its data and
its action, restyled only:

- Pause: the REPLAY TUTORIAL action inside the controls fold, and the
  run-ending warning copy.
- Victory: run floor/streak line, daily bonus row, contract rows, the finale
  "lease reclaimed" block, first-clear scrap, ability offer, edge cards.
- Failure: the run note (run ended / edges kept), the NEW BEST sticker, and the
  optional CONTINUE ad button.
- Lobby: the blocked-storage warning in the footer.
- Settings: the two-step SHRED SAVE confirm and the SHOP tab visibility rule.
- HUD: heat meter, boss phases, challenge card, coach hints and skip.

The reskin changes no flow: the same buttons appear under the same conditions.

---

## 5. Component contract

New stylesheet namespace `b2-`, defined once in
`src/ui-kit/bonk2/theme.css`. Screens may only use these primitives plus their
own scoped classes.

```
.b2-stage            full-viewport screen root (safe-area aware)
.b2-panel            beveled purple panel
.b2-panel__head      colour strip (variants: lime, lavender, blue, red)
.b2-panel__title
.b2-panel__body
.b2-btn              base button (variants: lime, lavender, yellow, blue, red, ghost)
.b2-btn--sm/--lg     sizes; .b2-btn__chev
.b2-chip             dark stat chip (icon, value, label)
.b2-badge            round icon badge
.b2-nav / .b2-nav__item (with .is-active)
.b2-tabs / .b2-tab
.b2-meter            track + fill (health, progress, heat, boss)
.b2-check            kit checkbox
.b2-range            kit slider
.b2-ribbon           banner image wrapper
.b2-icon             <img> sizing helper (--b2-icon-size)
.b2-stack / .b2-row  layout helpers
```

Rules: no inline colours outside tokens; no new shadow recipes; no border-radius
above 4 px except circular badges; every interactive element is a real
`<button>`/`<a>`/`<input>` with an accessible name; focus-visible is never
removed.

Files:

```
src/ui-kit/bonk2/
  theme.css            tokens + primitives (foundation, one owner)
  lobby.css            menus/lobby
  rooms.css            rooms + characters
  hud.css              in-game HUD + touch + rotate
  panels.css           pause + settings + credits
  results.css          victory + failure + banners
  assets/...           copied kit PNGs
  fonts/               Lilita One + licence
```

TypeScript: the seven screens are extracted into
`src/ui/screens/{lobby,rooms,characters,hud,pause,settings,results,credits}.ts`,
each exporting one builder/class. `MainMenu.ts`, `HUD.ts`, `PauseMenu.ts`,
`ResultsScreen.ts` become thin re-exports during the migration and are deleted
when nothing imports them. `UI.ts` and `Game.ts` keep their public behaviour;
`bonkKit.ts` (the MutationObserver injector) is removed, including the hidden
gear click-through, once the new lobby owns its own buttons directly.

---

## 6. Work split

Foundation lands first, alone, so the five screen agents share one vocabulary.

| Stage | Owner | Files | Done when |
| --- | --- | --- | --- |
| 0 Foundation | lead | `theme.css`, assets, font, `screens/` skeleton, wiring, delete `bonkKit` | app boots, lobby renders with kit primitives, typecheck green |
| A Lobby + nav | agent | `lobby.css`, `screens/lobby.ts` | lobby matches reference; PLAY/MODE/SHOP/SETTINGS all work |
| B Rooms + characters | agent | `rooms.css`, `screens/rooms.ts`, `screens/characters.ts` | selection persists; all rooms reachable |
| C HUD + touch | agent | `hud.css`, `screens/hud.ts` | every HUD element live; low-health, boss, combo, powers states verified |
| D Pause + settings + credits | agent | `panels.css`, `screens/pause.ts`, `settings.ts`, `credits.ts` | powers purchase, settings persistence, two-step shred verified |
| E Results | agent | `results.css`, `screens/results.ts` | victory and failure paths, edge selection, ad-continue verified |
| F QA + polish | lead | all | screenshots of every screen at 3 sizes, no console errors, tests green |

Agents run `opencode/deepseek-v4.1-flash-free#max` and are told: touch only your
files, use only `b2-` primitives, screenshot your screens, and report deviations
instead of inventing new components.

---

## 7. Constraints and risks

- **Do not break the game.** `UI.show()` wipes `#screens`; screens must rebuild
  from state. Any DOM the game queries by class (`.hud`, `.healthbar`, body
  classes) keeps its contract.
- **Kit is not the last word.** The current skin is layered across four files;
  removing `bonkKit.ts` and the old CSS must be done deliberately, not by
  deleting `styles.css`.
- **Asset weight.** The kit is 10.5 MB. Only referenced PNGs ship; full-screen
  references stay in `src` unimported.
- **Text baked into art** is the main polish trap. Any asset with words must be
  either unused or used where the word is correct.
- **RTL/long text** not required.
- **iOS safe areas** and 100vh are handled by the existing stage rules; do not
  regress them.

---

## 8. Acceptance

1. All seven screens and the three secondary overlays are in the kit language;
   no torn paper, plasters, receipts or ransom letters remain visible.
2. Every value is live: change hp, score, scrap, discoveries, room, stars and the
   UI follows.
3. 1600×900, 1280×720, 1024×768 and 390×844 portrait all render without clipping
   or overlap; the rotate prompt covers the portrait game case.
4. Keyboard: every action reachable by Tab, visible focus, Escape closes the top
   layer.
5. `npm run typecheck`, `npm test` and `npm run build` pass; the shipped bundle
   in `public/arcade/bonk` is regenerated once at the end. The portal builds
   (`dist-crazygames`, `dist-gamemonetize`) are **out of scope** for this
   reskin and keep the old skin until a separate release pass.
6. Screenshot set committed under `.screenshots/bonk2-ui/` for review.

---

## 9. Open questions

None blocking. The two judgement calls recorded as the builder's:

- Lilita One is downloaded rather than substituted; Barlow is the fallback only
  if the network blocks the font.
- The pause backdrop now dims the HUD (today it does not), because the kit panel
  is opaque; this is the only behavioural difference in the whole reskin.
