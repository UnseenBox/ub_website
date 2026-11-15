# Backup: Dig & Discover before the rock-first update (2026-11-15)

This folder keeps the version that was LIVE on the site before the rock-first update was published.

- `live-build/` is the exact built game that was served from `public/arcade/dig-and-discover/` (index.html, poster.jpg, assets/). To restore it: copy these files back over `public/arcade/dig-and-discover/`.
- The matching SOURCE is in git history at commit `fe5984e` (the friend's merged version, author Imad). Restore with `git checkout fe5984e -- DigAndDiscover` (then re-add this `backups` folder if needed).

What the update that replaced it changed: curios replaced by the finds system (artifacts sold, collection items, junk), the clock restored, 43 minerals incl. worthless rocks, painted icons instead of emoji, household bills, weekly debt instalments, a 30-day deadline with Game Over and Restart. See `DigAndDiscover/PROJECT_OVERVIEW.md` section 11.
