# Sonnet 5.5 execution handoff — CRAZY KORA redesign

Copy everything below the line into a new Claude Code session opened at `D:\UnseenBox`.

---

You are the developer implementing an approved redesign of **CRAZY KORA**, a street-football trick-shot web game in `D:\UnseenBox\crazy-goal`. Its stack is TypeScript, Vite, Canvas 2D, Web Audio and plain DOM, with no engine. The design is decided. Do not redesign it; implement it.

## Read first, in this order

1. `crazy-goal/docs/superpowers/plans/2026-11-12-crazy-kora-redesign.md` is the blueprint, and the source of truth for every task. §6 holds the task specs, §7 the QA.
2. `crazy-goal/README.md`, for architecture and the dev console hooks (`window.__cg`). Parts of it are stale; task 2.6 fixes that.
3. `crazy-goal/docs/FREE_KICKS.md`, for Free Kicks' architecture, tools and safety rules.
4. Before editing any file, read the relevant part of it. Line numbers in the blueprint are from commit `6579b23` and drift.

## The decisions you must not change without stopping to ask

- **Architecture is the hybrid (Option C).**
  - The two modes stay separate in gameplay and physics.
  - They share one wallet, one star total, one selected ball, one settings / mute, one menu and one set of design tokens.
  - Classic is the campaign. Free Kicks is the skill arcade and hosts the Daily Kick. Duels stay as they are.
- **Free Kicks stays un-bundled plain JS** in `crazy-goal/free-kicks/`. It talks to Classic **only** through `window.CrazyKoraShell` (task 1.5). Do not import `src/**` into it, and do not port it to TypeScript.
- **Do not change physics or level-feel constants in either mode.** That covers `BALL_TUNING`, `SHOT_TUNING`, the `BLOCKS` table, the mechanic constants, and Free Kicks' `SHOT` / `GOAL` / `KEEPER` / cards. The only data edits allowed are task 3.3's level layout edits, each validated with `__cg.sweep`.
- **Never wipe or rename save data.**
  - `crazy-goal-save` moves to version 2 **with migration** (task 0.2).
  - Free Kicks keeps `crazy-kora-fk-progress` and `crazy-kora-fk-tutorial`.
  - Only Classic, through the shell, writes `crazy-goal-save`.
- **The GAME MODES button and CHOOSE YOUR PLAY screen are removed.** Free Kicks becomes a menu tile, unlocked after a goal in houma 3.
- **Progression and economy rules** are as specified in tasks 1.2, 1.3, 1.6 and 3.1:
  - first-clear and star-upgrade coins only;
  - the level coin once ever;
  - chapter gate of 16★ per chapter, with grandfathering.

  Put every number in named constants in `src/progression/Progression.ts`.
- **Task 4.2** (Free Kicks in the CrazyGames build) **requires explicit written approval from the owner.** Skip it and report that it is waiting.
- **Do not deploy.** Do not touch `public/arcade/crazy-goal/` unless asked.

## Order of work

Do the phases in order. Inside a phase, follow the task order unless a dependency in the blueprint allows otherwise.

- **Phase 0:** 0.1 test harness and pure `Progression.ts` (behaviour unchanged), then 0.2 save v2 migration.
- **Phase 1:**
  - 1.1 visible score targets
  - 1.2 coin economy
  - 1.3 chapter gates
  - 1.4 onboarding and boost gating
  - 1.5 `window.CrazyKoraShell`
  - 1.6 Free Kicks joins the career
- **Phase 2:**
  - 2.1 new main menu, remove GAME MODES
  - 2.2 Free Kicks unlock moment
  - 2.3 shared tokens
  - 2.4 level map gates
  - 2.5 Free Kicks HUD settings access
  - 2.6 defect sweep and docs
- **Phase 3:**
  - 3.1 Daily Kick
  - 3.2 Legend stage
  - 3.3 level variety pass for houmas 2–24
  - 3.4 ball unlock moments
- **Phase 4:**
  - 4.1 rewarded-ad moments
  - 4.3 analytics sink
  - (4.2 only with approval)

Each task in the blueprint has an Objective, Current situation, Proposed solution, Files, Dependencies, Acceptance and Testing. A task is done only when its acceptance criteria are met.

## How to work

- **Work incrementally.** One task at a time: inspect, implement, run the checks, verify in the running game, commit. Branch off `main` first (for example `crazy-kora-redesign`). Commit only files under `crazy-goal/` related to the task. The repo has unrelated uncommitted work in `everything-is-a-weapon/`; never stage it.
- **Checks after every task:** `npm run build` and `npm test` from `crazy-goal/`.
- **Checks after any `free-kicks/` change:**
  - `node free-kicks/tools/sync-cards.js --check`
  - `node free-kicks/tools/check-strings.js`
  - `node free-kicks/tools/check-quick.js`
  - `node free-kicks/tools/tests/physics.test.js`
  - `node free-kicks/tools/tests/progress.test.js`
  - `node free-kicks/tools/validate.js --check`
- **Verify in the browser.** Use the `crazy-kora-dev` entry in `D:\UnseenBox\.claude\launch.json` (Vite on port 5184). Use a fresh `localStorage` for new-player flows. The `window.__cg` hooks (`level`, `shoot`, `step`, `info`, `sweep`) are faster than manual aiming. Check layouts at 320×568, 375×812, 430×932, 768×1024 and 1920×1080, in English and Arabic (RTL).
- **Line endings.** `free-kicks/free-kicks.js` and `free-kicks/free-kicks.css` are CRLF; `game-modes.*` are LF. Edit them with the Edit tool, never `sed -i`. The card block in `free-kicks.js` is generated: edit `tools/cards.v1.json` and run `sync-cards.js`.
- **Strings.** Every new player-facing string needs English and Arabic:
  - Classic: `src/core/i18n.ts`.
  - Free Kicks: `COPY` in `game-modes.js` and `RUN_STRINGS` in `free-kicks.js`.
- **Accessibility parity.** New buttons are real `<button>`s, reachable by Tab, with Esc going back one level, aria labels translated, and `prefers-reduced-motion` respected.
- **No scope creep.** Do not add:
  - leaderboards;
  - new mechanics;
  - new modes;
  - IAP;
  - energy systems;
  - new art pipelines.

  If something in the blueprint is impossible as written, or contradicts the code, stop on that task, explain it, and propose the smallest change that keeps the design intent.
- **Preserve what works:** physics, `Feedback.ts` juice, duels, portal ad safety rules (no reward on `adError`; nothing during aiming, flight, celebration or duels), the Free Kicks tutorial, and `start` / `stop` cleanup.

## Reporting

At the end of each phase, report:

- the tasks completed, with the acceptance criteria you checked and how;
- the commands run and their results;
- screenshots or `__cg.info()` output for visual or gameplay changes;
- anything skipped, deferred or failing, and why;
- open questions for the owner (at minimum: approval for 4.2, the analytics provider for 4.3, and whether to keep the pause-menu +30 coins ad).

Do not claim a task is done if any of its acceptance criteria were not verified. Say what was not verified.
