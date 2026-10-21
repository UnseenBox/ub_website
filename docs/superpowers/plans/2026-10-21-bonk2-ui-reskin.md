# BONK 2.0 UI Reskin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the game's seven screens with the Chaos Kit visual language without changing gameplay, flow, or live data.

**Architecture:** One design-system stylesheet (`theme.css`) plus one scoped stylesheet and one TypeScript builder per screen. Existing entry points (`buildMainMenu`, `HUD`, `buildPauseMenu`, `buildSettings`, `buildResults`) keep their names and signatures, so `Game.ts` and `UI.ts` are untouched; their bodies move into `src/ui/screens/*` and the old modules re-export. `bonkKit.ts` and the three legacy skin stylesheets are removed from the import chain at the end.

**Tech Stack:** TypeScript 7, Vite 8, plain DOM + CSS, Canvas untouched. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-21-bonk2-ui-reskin-design.md`

## Global Constraints

- Branch: `bonk-2.0`. Never work on `main`.
- Tokens only from `theme.css`: ink `#26212D`, panel `#54465E`, panel-dark `#22243D`, navy `#171336`, blue `#2585FF`, blue-deep `#2469C7`, lime `#C9EF58`, lime-edge `#ECF2AD`, lavender `#B4A0E4`, yellow `#FFCD38`, red `#EF4B5E`, cream `#FFF1D3`, white `#FFFFFF`.
- Class prefix `b2-` for every new class. Never restyle an old class name except the contractual hooks below.
- Contractual hooks that must keep existing: `.screen`, `.screen.results`, `.screen.results.victory`, `.screen.results.failed`, `.victory-ledger-line`, `button.edge-card`, `button.coach-skip`, `.hud`, `.healthbar`, `body.playing`, `body.touch`, `body.has-powers`, `body.carrying`, `body.cinema`, `body.high-contrast`.
- Every new interactive element is a `<button>`/`<input>` with an accessible name; focus-visible never removed.
- Full-screen kit compositions (`menus/*.png`) are reference only and must never be imported.
- No new screens, features, currencies, or dead buttons.
- Verification per task: `npm run typecheck` in `everything-is-a-weapon`, then the app at `http://localhost:5183/` with a clean console, then the listed screenshots.

## Review Focus

- **Live values, not baked art:** a screenshot where the score, hp or scrap differs from the kit's sample (12,450 / 100 / 500) proves nothing from `menus/*.png` leaked in.
- **Game-queried classes:** removing or renaming `.hud`, `.healthbar`, `.screen.results`, `.coach-skip`, `.edge-card` silently breaks tests and the tutorial.
- **Body-class visibility:** `has-powers` shows POWER chips, `carrying` shows DROP, `touch` swaps layouts, `cinema` letterboxes. New CSS must respond to all four.
- **Re-render safety:** `UI.show()` destroys `#screens`. A screen that caches nodes or state in the DOM must rebuild from `game` on every call.
- **Small viewports:** 390×844 portrait and 1280×720 must not clip, overlap, or hide the primary action.

---

### Task 1: Foundation — tokens, primitives, assets, font

**Files:**
- Create: `src/ui-kit/bonk2/theme.css`
- Create: `src/ui-kit/bonk2/fonts/LilitaOne-Regular.woff2`
- Create: `src/ui-kit/bonk2/fonts/FONT-LICENSE.txt`
- Create: `src/ui-kit/bonk2/assets/**` (copy of `D:\Screenshots\Bonk\bonk_ui-kit`, folders preserved)
- Modify: `src/main.ts:1-5`

**Interfaces:**
- Produces: CSS custom properties and primitives `.b2-stage`, `.b2-panel`, `.b2-panel__head`, `.b2-panel__title`, `.b2-panel__body`, `.b2-btn` (+ `--lime|--lavender|--yellow|--blue|--red|--ghost`, `--sm|--lg`, `.b2-btn__chev`), `.b2-chip`, `.b2-badge`, `.b2-nav`, `.b2-nav__item`, `.b2-tabs`, `.b2-tab`, `.b2-meter`, `.b2-meter__fill`, `.b2-check`, `.b2-range`, `.b2-ribbon`, `.b2-icon`, `.b2-row`, `.b2-stack`.

- [ ] **Step 1: Copy the kit**

```powershell
Copy-Item -Recurse -Force "D:\Screenshots\Bonk\bonk_ui-kit\*" "D:\UnseenBox\everything-is-a-weapon\src\ui-kit\bonk2\assets\"
Copy-Item "D:\UnseenBox\everything-is-a-weapon\src\ui-kit\bonk2\assets\FONT-LICENSE.txt" "D:\UnseenBox\everything-is-a-weapon\src\ui-kit\bonk2\fonts\"
```

- [ ] **Step 2: Download Lilita One**

```powershell
Invoke-WebRequest "https://fonts.gstatic.com/s/lilitaone/v17/i7dPIFZ9Zz-WBtRtedDbYEF8RQ.woff2" -OutFile "src/ui-kit/bonk2/fonts/LilitaOne-Regular.woff2"
```

Expected: 10,672 bytes. If non-200, stop and report; do not substitute silently.

- [ ] **Step 3: Write `theme.css`**

`@font-face` for `Bonk Display` with `font-display: swap`. `:root` holds the tokens above plus `--b2-outline: 5px`, `--b2-shadow: 0 8px 0`, `--b2-ease: cubic-bezier(.2,.8,.3,1)`, `--b2-dur: 150ms`. Implement the primitives with `clip-path: polygon(...)` for the beveled corners, `box-shadow: 0 8px 0 var(--b2-ink)` for the hard shadow, and `text-shadow: 0 2px 0 var(--b2-ink), 2px 0 0 var(--b2-ink), -2px 0 0 var(--b2-ink), 0 -2px 0 var(--b2-ink)` on display type. Include `:focus-visible` and `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 4: Add the import**

In `src/main.ts`, after `import './styles.css';`, add `import './ui-kit/bonk2/theme.css';`. Leave the three legacy imports for now.

- [ ] **Step 5: Verify**

Run: `npm run typecheck` → exit 0.
Run: `npm run dev -- --port 5183 --strictPort`, open `http://localhost:5183/`. Expected: unchanged game, no console errors, network tab shows `LilitaOne-Regular.woff2` 200.

- [ ] **Step 6: Commit**

```bash
git add src/ui-kit/bonk2 src/main.ts
git commit -m "feat(bonk2): add the chaos kit theme foundation"
```

---

### Task 2: Screen skeleton — move builders, keep signatures, drop the injector

**Files:**
- Create: `src/ui/screens/{lobby,rooms,characters,hud,pause,settings,results,credits}.ts`
- Modify: `src/ui/MainMenu.ts`, `src/ui/HUD.ts`, `src/ui/PauseMenu.ts`, `src/ui/ResultsScreen.ts` (become re-exports)
- Delete: `src/ui/bonkKit.ts`
- Modify: `src/main.ts` (drop `installBonkUi`; keep the three legacy CSS imports until Task 8)

**Interfaces:**
- Produces, unchanged from today: `buildMainMenu(game: Game, actions: MenuActions): HTMLElement`, `class HUD { constructor(...) }`, `buildPauseMenu(touch: boolean, game: Game, actions: PauseActions): HTMLElement`, `buildSettings(game: Game, onBack: () => void): HTMLElement`, `buildResults(summary: RoomSummary, actions: ResultsActions): HTMLElement`.
- Consumes: Task 1 primitives.

- [ ] **Step 1: Move each builder into its screen module verbatim**

Copy the current implementation into the new file, keep the exported name and signature, and make the old module `export * from './screens/<name>';` with the same public types. Do not redesign yet.

- [ ] **Step 2: Remove `installBonkUi`**

Delete `bonkKit.ts` and its call in `src/main.ts`. In `lobby.ts`, build the scene, shortcut row and gear-equivalent directly; nothing may depend on a MutationObserver or a hidden button.

- [ ] **Step 3: Keep the legacy stylesheets in place**

Do not delete the three skin CSS files yet — new screens override them class by
class, and deleting early would leave the not-yet-migrated screens unstyled.
Task 8 removes them. Grep instead for `candy-`, `powers`, `kit-` and note which
live rules still need porting.

- [ ] **Step 4: Verify the app still plays**

Run: `npm run typecheck` → 0. Run the dev server, clear the tutorial with `?unlock` off, confirm menu → play → pause → results and no console errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/ui src/ui-kit src/main.ts
git commit -m "refactor(bonk2): split UI builders into screen modules and drop the injector"
```

> From here Tasks 3–7 are independent and may run in parallel. Each owns its stylesheet and screen module; nobody edits `theme.css`, `main.ts`, or another task's files.

---

### Task 3: Lobby

**Files:**
- Create: `src/ui-kit/bonk2/lobby.css`
- Modify: `src/ui/screens/lobby.ts`

**Interfaces:**
- Consumes: `MenuActions` as today (`play`, `openMode`, `openSettings`, `openShop` — keep the existing member names), `game.save.data`, `game.discoveries`, `game.room`.
- Produces: the `.screen.menu-board` root `buildMainMenu` returns; nav buttons `[data-b2-nav=home|rooms|characters|store|settings]`.

- [ ] **Step 1: Build the composition**

Backdrop `--b2-blue-deep` with a CSS dot grid. Top-left night chip (room badge, "NIGHT SHIFT", clock, room name or "DAILY CONTRACT"); top-right scrap chip. Left column: rooms-unlocked chip with progress bar and key icon; bad-ideas chip with book icon. Centre: `assets/banners/bonk-logo@2x.png`, tagline "YOUR HOME. YOUR RULES.", `assets/banners/bonk-cast@2x.png`, current-room strip. Right: SETTINGS and STORE shortcut tiles. Bottom: lime PLAY with the selected room name, then the nav.

- [ ] **Step 2: Wire behaviour**

PLAY calls `actions.play()`. ROOMS/CHARACTERS call `actions.openMode(tab)`. STORE calls `actions.openShop()`. SETTINGS calls `actions.openSettings()`. HOME is inert-but-marked `aria-current="page"`. Every chip reads live values; no hardcoded 2/3, 500 or 03:00.

- [ ] **Step 3: Responsive**

At `max-width: 900px` collapse to: chips row on top, cast scaled to 55%, nav sticky bottom, shortcuts become two icon buttons. At `max-height: 700px` drop the tagline and cast shadow.

- [ ] **Step 4: Verify**

Screenshots at 1600×900, 1280×720 and 390×844 (portrait shows the rotate prompt over a dimmed lobby, not a broken layout). Keyboard: Tab reaches PLAY first, focus ring visible. `npm run typecheck` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/lobby.ts src/ui-kit/bonk2/lobby.css
git commit -m "feat(bonk2): rebuild the lobby in the chaos kit language"
```

---

### Task 4: Rooms and Characters

**Files:**
- Create: `src/ui-kit/bonk2/rooms.css`
- Modify: `src/ui/screens/rooms.ts`, `src/ui/screens/characters.ts`

**Interfaces:**
- Consumes: `game.save.data.unlockedRoom`, `roomStars`, `deepest`, `game.rooms` catalogue, hero ids from `core/Hero.ts`.
- Produces: `buildRoomsPane(game, onPick)` and `buildCharactersPane(game, onPick)` rendering into the MODE overlay, preserving `#bonk-mode`, `.mode-tabs`, `[data-mode-tab]`, and `#mode-pane-rooms|characters` ids.

- [ ] **Step 1: Key wall**

Wooden board (`--b2-floor` with grain via repeating-linear-gradient). One card per room: number plate, hanging key (`room-key-living|kitchen|bedroom@2x.png` cycled by index), name plate, star row, boss mark, best score. States: selected (lime plate, tick), ready (red plate), locked (ink plate, lock glyph). Generated/depths rooms continue below in the same card language, so every room stays reachable.

- [ ] **Step 2: Characters**

Four cards using `icons/character-*.png` mapped violet→tenant, teal→flatmate, rose→gran, lime→kid, plus `icons/pet-*`. Selected gets lime ring, crown and a SELECTED plate. Retire `heroPortrait()` canvas usage from the menu.

- [ ] **Step 3: Verify selection persistence**

Pick room 3, PLAY, confirm it starts; reload, confirm the choice persisted. Pick a hero, confirm the in-game player art matches. `npm run typecheck` → 0. Screenshots of both tabs at 1280×720 and 390×844.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/rooms.ts src/ui/screens/characters.ts src/ui-kit/bonk2/rooms.css
git commit -m "feat(bonk2): key-wall rooms and roster characters"
```

---

### Task 5: HUD, touch controls, rotate prompt

**Files:**
- Create: `src/ui-kit/bonk2/hud.css`
- Modify: `src/ui/screens/hud.ts`

**Interfaces:**
- Consumes: `game.player.hp/maxHp`, `game.score`, `game.save.data.scrap`, `game.discoveries`, `game.abilities`, `game.heat`, `game.room`, `game.challenges`, `game.tutorial`.
- Produces: same `HUD` public methods used by `Game.ts` (`frame`, `setVisible`, `banner`, `incoming`, `stamp`, `toast`, `discovery`, `unlock`, `showBoss`, `setPause…`), same `.hud` root.

- [ ] **Step 1: Rebuild the frame**

Health plate (cream, hearts = max hp, `hp / max`, thin pink bar, low state red + pulse). Room badge (blue pentagon). Score chip (coin + rolling total) and scrap chip. Combo sticker (`×N`, visible only > 1). Powers as `item-slot` framed chips with cooldown sweep, gated by `body.has-powers`. Lineup keeps canvas mugshots in kit frames; waiting greyed, defeated crossed. Boss plate with segments and phase pips. Heat recoloured. Challenge becomes the objective card. Toast uses the discovery ribbon. Coach card restyled, `button.coach-skip` preserved.

- [ ] **Step 2: Leave the dead kit concepts out**

Do not add timer, wave, noise meter, countdown or pickup prompt. If a slot looks empty without them, adjust the layout instead of inventing data.

- [ ] **Step 3: Touch + rotate**

Restyle sticks as kit discs, DODGE/DROP/POWER as `b2-btn--sm` with the existing `body.carrying` / `body.has-powers` gating. Rotate prompt becomes a kit panel, same text and dismiss.

- [ ] **Step 4: Verify states**

Force each state in DevTools: hp 1, combo 3, boss active, powers owned, carrying, touch. Screenshot each at 1600×900 and 390×844. Confirm `button.coach-skip` still exists. `npm run typecheck` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/hud.ts src/ui-kit/bonk2/hud.css
git commit -m "feat(bonk2): chaos kit hud and touch controls"
```

---

### Task 6: Pause, Settings, Credits

**Files:**
- Create: `src/ui-kit/bonk2/panels.css`
- Modify: `src/ui/screens/pause.ts`, `src/ui/screens/settings.ts`, `src/ui/screens/credits.ts`

**Interfaces:**
- Consumes: `PauseActions` and the ability shop data already used today (`ABILITIES`, `game.save.data.scrap`, `game.abilities`).
- Produces: `buildPauseMenu`, `buildSettings`, `buildCredits` with today's signatures.

- [ ] **Step 1: Pause**

"HOLD THAT THOUGHT." panel with subtitle. KEEP GOING (lime), RESTART, SETTINGS, BACK TO MAIN MENU. Powers shop as cards with icon, name, cost, owned state, buy button, scrap in the header. Controls note and MORE fold preserved. Backdrop dims the HUD (only behavioural change allowed).

- [ ] **Step 2: Settings**

"ADJUST THE CHAOS", tabs SETTINGS/SHOP, kit range and checks, BACK and two-step SHRED SAVE. SHOP tab keeps the six static cards with no prices and no buy buttons.

- [ ] **Step 3: Credits**

Kit modal, same copy, same Escape/backdrop/close behaviour, focus trapped as today.

- [ ] **Step 4: Verify**

Buy an ability with enough and with too little scrap; toggle every setting and reload to confirm persistence; shred twice; open credits from the lobby. `npm run typecheck` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/pause.ts src/ui/screens/settings.ts src/ui/screens/credits.ts src/ui-kit/bonk2/panels.css
git commit -m "feat(bonk2): pause, settings and credits in the chaos kit"
```

---

### Task 7: Results

**Files:**
- Create: `src/ui-kit/bonk2/results.css`
- Modify: `src/ui/screens/results.ts`

**Interfaces:**
- Consumes: `RoomSummary`, `ResultsActions`, `Campaign.starText`, edges offer, ledger.
- Produces: `buildResults` with the same signature; the root keeps `.screen.results` plus `.victory`/`.failed`; `.victory-ledger-line` and `button.edge-card` remain.

- [ ] **Step 1: Victory**

`banners/victory@2x.png` ribbon over a kit panel with "DAMAGE REPORT" lime header, huge live score, CHAOS POINTS label, stars, challenge, objective, tickets, ledger, ability offer, edge cards, next-room teaser. Buttons NEXT (lime), REPLAY, HOME; daily DONE. Keep `.victory-ledger-line` on ledger rows and `button.edge-card` on every card.

- [ ] **Step 2: Failure**

`banners/defeat@2x.png` ribbon, "INCIDENT REPORT" panel, the existing fields, red EVICTED stamp, NEW BEST plate, RETRY (lime) + CONTINUE + HOME.

- [ ] **Step 3: Verify**

Complete room 1 → victory screenshot with a real score; die → failure screenshot; pick an edge and confirm the next room starts. Run the two existing suites: `npx vitest run src/core/Game.tutorial-flow.test.ts` → green.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/results.ts src/ui-kit/bonk2/results.css
git commit -m "feat(bonk2): chaos kit damage report and failure report"
```

---

### Task 8: Integration, polish, shipped bundle

**Files:**
- Modify: `src/ui-kit/bonk2/*.css`, `src/ui/screens/*.ts` (polish only)
- Create: `.screenshots/bonk2-ui/*.png`
- Modify: `public/arcade/bonk/**` (rebuilt)

- [ ] **Step 1: Unify**

Grep the new screen CSS for hex colours, `box-shadow` recipes and `border-radius`. Any value not from a token is replaced by the matching token or per-screen variable derived from one.

- [ ] **Step 2: Cross-screen pass**

Fix the seams: header heights, panel widths, button sizes, spacing rhythm. One screenshot per screen at 1600×900, 1280×720 and 390×844 into `.screenshots/bonk2-ui/`.

- [ ] **Step 2b: Retire the old skin**

Remove `bonk-ui-kit.css`, `legacy/bonk-cartoon-ui.css`, `legacy/bonk-overlay-ui.css` and their imports, then grep for `candy-`, `kit-`, `hanger`, `clipboard`, `receipt`, `plaster`, `ransom` and delete dead rules from `styles.css`. Nothing visible may change after this step; if it does, a live rule was deleted with the dead ones.

- [ ] **Step 3: Accessibility**

Tab through every screen, confirm visible focus and Escape closing the top layer; verify `high-contrast` and `prefers-reduced-motion` still change the UI.

- [ ] **Step 4: Full verification**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all pass. Then rebuild the site copy: run the project's existing build-and-copy step used for `public/arcade/bonk` and confirm `index.html` points at the new hashed assets.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(bonk2): unify the reskin and rebuild the shipped bundle"
```
