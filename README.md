# Flux Business Hub: public website (Phase 2)

Bilingual (Arabic default, RTL; English, LTR) public website for Flux Business Hub, built with Next.js (App Router) and TypeScript. It follows the Phase 2 design spec and the Flux design system (Poppins and Cairo, `brand-green` for the one primary action per page, logo on white only).

## Run

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000 redirects to /ar
npm run build && npm start   # production
npm run typecheck
```

## What is here

| Area | Where |
|---|---|
| Pages: home, spaces, space detail, packages, location and contact, about, legal, account placeholder | `app/[lang]/...` (`/ar/...` and `/en/...`, hreflang and canonical per page) |
| Translations (no hardcoded UI text) | `messages/ar.json`, `messages/en.json` (the Arabic file is type-checked against the English keys) |
| PublicCatalog contract | `lib/catalog/` (types, mock data, client) and `app/api/v1/public/*` |
| Home intro animation | `components/Intro.tsx`, `components/intro.css` |
| Branch details (placeholders to confirm) | `lib/site.ts` |
| SEO | `app/sitemap.ts`, `app/robots.ts`, LocalBusiness JSON-LD on home and contact |

## PublicCatalog (mock)

Only `isPublic` records are returned. All responses are `{ "data": ... }` and cacheable.

- `GET /api/v1/public/spaces`
- `GET /api/v1/public/spaces/:slug`
- `GET /api/v1/public/spaces/:slug/availability?date=YYYY-MM-DD` (hourly, daily or monthly shape, cached 15 seconds)
- `GET /api/v1/public/package-types`

Set `FLUX_API_URL` to point the site at the Phase 1 backend instead of the built-in sample data. Pages are pre-rendered and refreshed on the `catalog` tag; the backend calls `POST /api/revalidate` with `Authorization: Bearer $REVALIDATE_SECRET` after staff change a space, photo or price.

The sample catalogue (names, capacities, prices, package types) is illustrative until the real catalogue is connected.

## Intro animation (home only)

About 4 seconds: green sweeps cross the screen, the supplied PNG logo is revealed untouched with a wipe, the tagline fades in, then the white panel lifts and the hero rises in.

- CSS-driven, so it starts before hydration; the overlay always hides itself by 4.5 seconds.
- Plays once per browser session (`sessionStorage` flag, checked by an inline script before first paint).
- Skip button, click anywhere, or Esc. Reduced-motion setting shows a static logo for about a second and fades out.
- Sweep and wipe direction mirror in Arabic (RTL).

## Not built yet

- Customer portal and sign in (`/[lang]/account` is a placeholder that receives the booking intent as query parameters).
- Hosted checkout, holds, webhooks and transactional email (CR-1, CR-2); these belong to the backend modules in the spec.
- Contact form delivery: `/api/v1/public/contact` validates, rate-limits and has a honeypot, but only logs; connect it to the Email adapter.
- Photography, branch address, phone, email, hours, map, tagline and the legal texts are placeholders to be supplied.
