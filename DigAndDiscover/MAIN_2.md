# main_2 (no art, all code)

This is the version of Dig & Discover called **main_2 (no art, all code)**: all of its art (the cottage, the tools, the store and skill icons, the rocks, the holes) is painted by code at start-up; the only image file is the pickaxe coin. It is the rock-first version with the CrazyGames fixes and the later work listed below.

The version that was in this folder and live on the site before (the friend's newest version, website commit `8a02f50`) is kept, untouched, in `backups/2026-11-16_friend-version-before-main_2/` (`live-build/` and `source/`) and as the git tag `backup-friend-version-2026-11-16`. Older backups are in the same `backups/` folder.

## What it contains

- Hole shape per tool (bowl, scoop, shouldered, wedge, terrace, spike, rubble, trench, bore).
- Five prospecting upgrades (Keen Eye, Quick Crack, Bigger Bag 5 to 10 slots, Double Find, Master Cutter) and a store Skills tab with seven skills (Big Hole, Angry Shoveler, After Image, Hot Rock, Scrap Shot, Second Wind, Haggler).
- Sound fixes (no more repeating sounds), per-tool sprites, the new cottage, balance work (`dev/upgrade-test-results.md`, `dev/stack-balance-report.md`).
- CrazyGames platform fixes: Escape is not a game key, the portal's mute setting is honoured, ads are muted only when an ad really starts, ad offers switch off when ads are disabled or blocked, iOS audio resumes from a touch. `npm run build:crazygames` builds for the portal (Full Launch) and `npm run build:crazygames-basic` for Basic Launch (no ad offers).

## Not changed on purpose

The skill balance proposal in `dev/stack-balance-report.md` is a proposal only; the game still uses the original skill numbers and prices.

## Run it

`Play Dig and Discover.bat` installs, builds and opens the game on localhost, or `npm install`, then `npm run dev` or `npm run build`. The built game in `public/arcade/dig-and-discover/` is the output of `npm run build`.
