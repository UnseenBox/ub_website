# Handoff — UnseenBox website (`ub_website`, Next 16, 3 locales en/fr/ar)

## Commands
`npm run typecheck` (`next typegen && tsc --noEmit`), `npx eslint <files>`, `npm run build`. node_modules installed. No test suite.

## This session did (all on origin/main unless noted)
- Removed small kicker labels site-wide (`ff805ba`; deleted `components/ui/section-label.tsx`), nav index numbers/notes (`1ca2bfc`), footer wordmark hover line (`4ac7265`).
- Play-arcade ads: new `components/ads/ad-slot.tsx` (live AdSense unit when configured, else labelled placeholder; `?adtest=1` URL param forces a Google test creative — diagnostic only, never link publicly). Slots on `/play` ×2 and `/play/[slug]` ×2 (sidebar rectangle + leaderboard). Library loads in `app/[locale]/layout.tsx` from `NEXT_PUBLIC_ADSENSE_CLIENT` (default `ca-pub-3020230827559587`), default slot `NEXT_PUBLIC_ADSENSE_SLOT` (`2539078519`, "Play Add 1"). `public/ads.txt` live. "Advertisement" label in en/fr/ar dicts (`play.ad`).
- Arcade manager: playables moved from hardcoded `lib/play.ts` into content store. New `Playable` type (`types/content.ts`, `enabled` flag + `order`), `data/seed/playables.ts`, `playables` table (Neon, auto-created; FileStore with old-file seed migration; `?? seeds` fallback in queries), `getPlayables()` (enabled only) / `getPlayableBySlug`, save/delete/restore mutations, `playableSchema`, `newPlayable()`, admin **Arcade** pages (`/admin/playables`, list/new/edit + `playable-editor.tsx`, restore button, nav item, dashboard stat). Site consumers (`/play`, `/play/[slug]`, community, sitemap, `presentPlayables(games,…)`) read the store. Commits `a8827b9` + merge `c3b770a`.
- Parallel session's games-reorder backend (`moveGame`/`moveGameAction`) was uncommitted in my tree; shipped it inside `a8827b9` because its UI was already committed without it (would have broken the build). Reorder UI itself was theirs.

## Parallel sessions did (from log)
Play-arcade background experiments (merged, latest: `f4c19b4` wordmark/colors), Crazy Kora content updates (now 48 alleys per live site), card-duel backend earlier. Branch style: feature branches + `--no-ff` merges to main.

## Open issues
- **Ads show white boxes (not filling). Verified live: slots + library + IDs + ads.txt all correct and deployed. Cause is account-side, not code.** Next step needs the USER: (1) open `/en/play?adtest=1` — test ads there prove integration; (2) AdSense → Sites must say Ready for unseenbox.com (new sites take days–weeks); check Policy center + unit active. Awaiting their reply.
- Production Neon DB needed one click post-deploy: Admin → Arcade → Restore starter arcade (live `/play` already shows edited content, so done).

## Warnings for next session
- **Shared workdir: user edits + commits in parallel.** Before committing: `git status`, `git diff --stat`, and `git diff --cached` — stage ONLY intended files explicitly (`git add -- <paths>`), never `-A`. Once, my hunks got reverted by another session (`f9c243d`) and foreign hunks got staged; I recovered. Untracked junk (`BONK.zip`, loose SVGs/logos, `crazy-goal/`, `dont-let-it-see-you/`, etc.) must NEVER be staged.
- Admin writes need Neon `DATABASE_URL`; without it admin is read-only (see panel banner). Local dev uses `.data/*.json`.
- `NEXT_PUBLIC_*` vars bake in at build time; env fallback defaults are hardcoded (fine — publisher ID is public anyway).
- Crazy Kora game source lives in `crazy-goal/` (Vite, separate); its static build is served from `public/arcade/crazy-goal/`.
