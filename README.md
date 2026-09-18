# UnseenBox — studio website

Website and content admin for **UnseenBox**, an independent game & creative technology studio.
Built with Next.js 16 (App Router, Turbopack), React 19, TypeScript and Tailwind CSS 4. Optimised for Vercel.

- Public site in **English, French and Arabic (RTL)** — `/en`, `/fr`, `/ar`
- Game showcase, upcoming games ("In the dark"), services, archive, studio, contact
- Content admin at `/admin` — games, services, archive entries, studio text, social links, contact inbox
- Images managed from **Google Drive** (or any https URL) without rebuilding

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the admin credentials
npm run dev
```

Open http://localhost:3000 (redirects to your browser language) and http://localhost:3000/admin.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`next typegen` + `tsc`) |
| `npm run art` | Regenerates the sample artwork in `public/media` |
| `npm run db:check` | Verifies the Neon connection and prints row counts |

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | production | Canonical origin for SEO, e.g. `https://unseenbox.studio` |
| `ADMIN_USERNAME` | yes | Single admin account |
| `ADMIN_PASSWORD` | yes | Use a long passphrase |
| `ADMIN_SESSION_SECRET` | production | ≥ 32 random chars. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `DATABASE_URL` | production | Neon Postgres connection string (`POSTGRES_URL` / `NEON_DATABASE_URL` also work) |
| `BLOB_READ_WRITE_TOKEN` | for uploads | Added automatically by Vercel when you create a Blob store. Without it the admin's upload button is disabled and images must be linked by URL |

Credentials are only read on the server. They never reach client JavaScript.

## Deploying to Vercel

1. Import the repository in Vercel (framework preset: Next.js).
2. **Database:** Vercel's filesystem is read-only, so connect Postgres for the admin to save to:
   Project → Storage → Marketplace → **Neon** → Connect. `DATABASE_URL` is added automatically.
   Without it the site still works (it serves the seed content), but the admin runs in read-only mode.
3. **Image uploads (optional):** Project → Storage → **Blob** → Create, and choose **public** access — a private store
   cannot serve images to visitors, and uploads fail with "Cannot use public access on a private store".
   `BLOB_READ_WRITE_TOKEN` is added automatically and the admin's "Upload image" button starts working.
   Google Drive links keep working either way.
4. Add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` and `NEXT_PUBLIC_SITE_URL`.
5. Deploy. On its first query the site creates its tables and imports the seed content; from then on Neon is the
   source of truth. Nothing to migrate by hand.

## Content & images

**Architecture:** `types/content.ts` (model) → `data/seed/*` (initial content) → `lib/content/*` (storage, queries,
mutations) → components → pages. Every editable string is a `{ en, fr, ar }` object; empty translations fall back to English.

**Storage adapters** (`lib/content/store.ts`), picked by environment:

- `postgres` — Neon, whenever `DATABASE_URL` is set. One row per game, service, archive entry and message;
  localized text and short nested lists (links, dev notes, screenshots) live in JSONB columns. Schema in
  `lib/db/schema.ts`, created and seeded on first use by `ensureReady()`.
- `file` — local dev without a database, writes `.data/content.json` and `.data/messages.json`
- `readonly` — deployed without a database; seed content only

Public pages are statically generated and cached with a tag. Each admin save calls `updateTag` + `revalidatePath`,
so changes are live on the next request, with no redeploy. Rows edited straight in Neon's SQL editor bypass that
invalidation and only appear after the next admin save or redeploy — edit through `/admin` instead. In development the
cache is persisted under `.next/dev/cache`; delete that folder if a page keeps serving a stale row.

**Community reviews:** visitors rate a game 1–5 and write a review at `/community`. Submissions are stored with
`status: "pending"` and stay invisible until approved under **Admin → Reviews**, where they can also be answered publicly
or deleted. Approved ratings feed the averages shown on the games list, each game page and the community page.

**Uploading images:** any image field in the admin has an **Upload image** button. The file goes from the browser
straight to Vercel Blob (`app/api/admin/upload/route.ts` only issues a signed token, and only to a signed-in admin), so
uploads are not limited by the serverless request size. Accepted: JPEG, PNG, WebP, AVIF, GIF, SVG, up to 15 MB.

**Logo:** Admin → Studio & contact → *Website logo*. Empty falls back to the built-in vector mark.

**Footer band:** Admin → Studio & contact → *Footer band image* replaces the outlined wordmark at the foot of every
page. Empty draws the studio name instead. Roughly 7:1 fits the band; anything else is letterboxed rather than cropped.

**Home page wording:** Admin → Studio & contact → *Home page* overrides the hero (channels, headline lines, paragraph,
buttons) and every section label, heading and paragraph. Overrides live on the studio record as `home`
(`lib/content/home-copy.ts` merges them over the locale dictionary); any field left empty keeps the built-in copy, and a
translation left empty falls back to English like the rest of the site.

**Google Drive images:** upload the file, set sharing to *Anyone with the link*, paste the share link into any image
field. Links are normalised to `lh3.googleusercontent.com/d/<id>` (`lib/images/drive.ts`), then optimised by
`next/image` (AVIF/WebP, responsive sizes, 30-day CDN cache). The admin has a link tester under **Images guide**.

## Settings

**Admin → Settings** changes, without a redeploy:

- **Favicon** — replaces `/icon.svg` in browser tabs, bookmarks and the web manifest.
- **Default share image** — the Open Graph/Twitter image for pages that have no artwork of their own.
- **Admin username and password** — the current password is always required. The new pair is stored in the database
  (`settings` row; the password as a scrypt hash) and takes precedence over `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
  Locked out? Delete `adminUsername` and `adminPasswordHash` from that row and the environment variables take over again.

`ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` stay environment-only; the
page lists them for reference.

## Authentication

A single admin account, checked with a constant-time comparison. On success the server issues an HMAC-signed,
`httpOnly`, 8-hour session cookie (`lib/auth/session.ts`). Access is checked twice:

- `proxy.ts` redirects unauthenticated `/admin/*` requests to the login page;
- every admin page and every Server Action calls `requireAdmin()` (`lib/auth/guard.ts`).

Failed logins are throttled per IP. To move to a full auth provider later, replace `lib/auth/*`; callers only use
`requireAdmin()` / `getAdminSession()`.

## Project structure

```
app/
  [locale]/            public site (root layout sets lang/dir, fonts, header, footer)
    games/[slug]/      game detail (JSON-LD VideoGame)
    experiences/[slug]/archive entry
    contact/actions.ts contact form Server Action (stored in the admin inbox)
  admin/               separate root layout, login, (panel) routes, actions.ts
  sitemap.ts robots.ts manifest.ts icon.svg
components/
  layout/  home/  games/  experiences/  media/  contact/  motion/  ui/  admin/
lib/
  i18n/ (config, dictionaries, loader)   content/ (store, queries, mutations, presenters)
  auth/  images/  validation/  seo.ts  fonts.ts  navigation.ts
data/seed/             initial studio, games, services, archive
types/content.ts       the content model
proxy.ts               locale negotiation + admin gate
scripts/generate-art.mjs
```

## Design system (short version)

- **Colour:** void black `#050407`, bone `#ece8f5`, ultraviolet `#8f5bff` used as light: seams, glows, focus, active states.
- **Type:** Syne (display), Geist (text), Geist Mono (labels), Silkscreen (pixel accents), Alexandria + IBM Plex Sans Arabic for Arabic.
- **Motif:** the *unseen box*: things arrive from darkness (aperture reveals, low-signal images that develop on hover, a cursor light that uncovers hidden words).
- **Motion:** one small client island (`components/motion/motion-root.tsx`) for reveals, magnetic buttons and cursor labels. Everything honours `prefers-reduced-motion`.
- **RTL:** logical properties throughout, direction-aware arrows and carousels, no letter-spacing on Arabic.

## Placeholder content to replace

The seed games, projects, timeline, city/time zone and social URLs are **fictional samples**, and the artwork in
`public/media` is procedurally generated. Replace them from the admin before launch. Social links currently point
to platform home pages.
