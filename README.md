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

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | production | Canonical origin for SEO, e.g. `https://unseenbox.studio` |
| `ADMIN_USERNAME` | yes | Single admin account |
| `ADMIN_PASSWORD` | yes | Use a long passphrase |
| `ADMIN_SESSION_SECRET` | production | ≥ 32 random chars. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | production | Content storage on Vercel (`KV_REST_API_URL` / `KV_REST_API_TOKEN` also work) |
| `CONTENT_KEY_PREFIX` | no | Namespace for Redis keys (default `unseenbox`) |

Credentials are only read on the server. They never reach client JavaScript.

## Deploying to Vercel

1. Import the repository in Vercel (framework preset: Next.js).
2. **Storage:** Vercel's filesystem is read-only, so connect a database for the admin to save to:
   Project → Storage → Marketplace → **Upstash Redis** → Connect. The env vars are added automatically.
   Without it the site still works (it serves the seed content), but the admin runs in read-only mode.
3. Add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` and `NEXT_PUBLIC_SITE_URL`.
4. Deploy. The first admin save copies the seed content into Redis; from then on Redis is the source of truth.

## Content & images

**Architecture:** `types/content.ts` (model) → `data/seed/*` (initial content) → `lib/content/*` (storage, queries,
mutations) → components → pages. Every editable string is a `{ en, fr, ar }` object; empty translations fall back to English.

**Storage adapters** (`lib/content/store.ts`):

- `file` — local dev / self-hosting, writes `.data/content.json` and `.data/messages.json`
- `redis` — Upstash REST API (no extra dependency)
- `readonly` — Vercel without storage; seed content only

Public pages are statically generated and cached with a tag. Each admin save calls `updateTag` + `revalidatePath`,
so changes are live on the next request, with no redeploy.

**Google Drive images:** upload the file, set sharing to *Anyone with the link*, paste the share link into any image
field. Links are normalised to `lh3.googleusercontent.com/d/<id>` (`lib/images/drive.ts`), then optimised by
`next/image` (AVIF/WebP, responsive sizes, 30-day CDN cache). The admin has a link tester under **Images guide**.

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
