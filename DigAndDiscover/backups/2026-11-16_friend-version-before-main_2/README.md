# Backup: Dig & Discover before main_2 (2026-11-16)

This folder keeps the version that was LIVE and in `DigAndDiscover/` before **main_2 (no art, all code)** was published. Nothing was deleted: it is all here, and also in git history.

- `live-build/` is the exact built game that was served from `public/arcade/dig-and-discover/` (index.html, poster.jpg, assets/). To restore it: copy these files back over `public/arcade/dig-and-discover/` (remove the new `assets/` first).
- `source/` is the exact source of that version (the friend's newest version, author Imad, website commit `8a02f50`, source commit `a5c8c90`). To restore it: copy `source/` over `DigAndDiscover/` (keep the `backups` folder), then `npm install` and `npm run build`.
- Git: the tag `backup-friend-version-2026-11-16` points at commit `8a02f50`. `git checkout backup-friend-version-2026-11-16 -- DigAndDiscover public/arcade/dig-and-discover` restores both the source and the live build.
- The older backup `../2026-11-15_friend-version-before-rockfirst-update/` and `../audio-originals/` are untouched.

What main_2 changed compared with this version: the art is painted in code (no supplied art images except the coin), a hole shape per tool, five prospecting upgrades, a Skills tab with seven skills, a growable bag, sound fixes, CrazyGames platform fixes. See `DigAndDiscover/MAIN_2.md`.
