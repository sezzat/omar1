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

## Customer portal

Sign in at `/ar/login` or `/en/login`. Signed-in screens live under `/{lang}/portal`: home, book (instant and monthly request), my bookings, packages, invoices, profile. The mock hosted checkout is `/{lang}/checkout/{session}`.

Demo accounts (password `Flux@2026`; data is in memory and resets on restart):

| Email | State |
|---|---|
| mona@example.com | Pending Approval, pending private-office request, 6 of 10 meeting-room hours, outstanding invoices |
| nour@example.com | Active (English), hot-desk package |
| omar@example.com | Suspended: can view invoices, cannot book |
| sara@example.com | Blacklisted: neutral contact-us message, status never shown |
| newbie@example.com | Active, email not verified (cannot pay online) |
| existing@example.com | Customer on file with no login: registering with this email links after verification |

Backend (mock, in `lib/portal/` and `app/api/v1/`): customer accounts and sessions (scrypt passwords, 15-minute JWT with audience `flux-customer`, rotating httpOnly refresh cookie with replay detection), registration and matching, 15-minute booking holds, package reserve and consume, 24-hour cancellation window with refund requests, signed payment webhook with idempotency, reconciliation job (`POST /api/v1/internal/reconcile`), late-payment handling, invoices with PDF, private documents with 5-minute signed links, email outbox. In development, `GET /api/v1/dev/outbox?to=` shows queued emails (verification and reset links).

Environment (see `.env.example`): `JWT_SECRET`, `GATEWAY_WEBHOOK_SECRET`, `LINK_SECRET`, `INTERNAL_SECRET` (required in production), `FLUX_HOLD_MINUTES`, `FLUX_CANCEL_WINDOW_HOURS`, `FLUX_ENABLE_DEV_API=1` to expose dev routes in a production build.

Assumptions to confirm: password rule (8+ characters with a letter and a number, because FR-SEC-003 text was not available), hot-desk day runs 09:00 to 18:00 for the cancellation deadline, bookings are 1 to 4 hours between 09:00 and 17:00, invoice PDF is English-only in the mock.

## Not built yet

- Real gateway, real email provider and the Phase 1 database: the portal runs against the in-memory mock backend.
- Contact form delivery: `/api/v1/public/contact` validates, rate-limits and has a honeypot, but only logs; connect it to the Email adapter.
- Photography, branch address, phone, email, hours, map, tagline and the legal texts are placeholders to be supplied.
