# acy-next — Aaron Curtis Yoga

Fullstack yoga instructor website. Event management, class registration, private session booking, automated external event syncing, Google Calendar integration, Stripe payments.

## Stack

- **Next.js 16** + React 19 + TypeScript (`strict: false`, `noUnusedLocals: true`)
- **shadcn/ui** (Radix primitives in `components/ui`) + Tailwind CSS 4 + Framer Motion
- **Prisma 6** + Vercel Postgres (pooled: `POSTGRES_PRISMA_URL`, direct: `POSTGRES_URL_NON_POOLING`)
- **Clerk** for auth (RBAC — admin role in session claims metadata)
- **Stripe** for payments (events + private sessions)
- **Google Calendar** via service account (not OAuth)
- **Google Maps** for locations
- **Resend** for newsletter (signups + broadcasts, managed from `/admin/newsletter`)
- **Playwright** + Browserless.io for web scraping (event sync)
- **Vercel Blob** for file uploads
- Deploy: **Vercel** with cron jobs

## Commands

```bash
npm run dev              # Next.js dev (Turbopack)
npm run build            # Production build
npx prisma migrate dev   # Run migrations
npx prisma studio        # DB GUI
npx prisma generate      # Regenerate client
npx tsc --noEmit         # Type-check
npx playwright test      # E2E tests
```

## Key Conventions & Gotchas

### Prisma 6 (NOT Prisma 7)

- Uses `url` and `directUrl` in `prisma/schema.prisma` — this is correct for Prisma 6
- Client singleton in `app/_lib/prisma.ts` — `export default prisma` (default export, not named)
- **Serialize before sending to client**: Prisma objects have Symbol properties that break React serialization. Use `serialize()` from `app/_lib/utils/serialize.ts` (JSON round-trip)

### Next.js 16 — `proxy.ts`

- Route protection via `proxy.ts` (not `middleware.ts`) using Clerk's `clerkMiddleware`
- Admin routes check `sessionClaims.metadata.role === "admin"`
- Protected routes: `/account`, `/admin/*`, `/profile`, `/settings`

### All dates are America/New_York

- `formatDateTime()` in `app/_lib/utils/index.ts` forces `timeZone: "America/New_York"` everywhere
- Event form uses `@internationalized/date` for timezone-aware ZonedDateTime handling
- Stored as UTC DateTime in Postgres, displayed in ET

### shadcn/ui (not HeroUI — migrated)

- Import from `@/components/ui/*` (button, card, dialog, table, input, etc.)
- Two-blue system in `app/globals.css`: deep royal anchor `#0842a0` (`--primary`/`--ring` — brand, print/apparel, headings, text & links on white) + bright screen accent `#1a73e8` (`--color-cta`, exposed as `bg-cta`/`text-cta`) for primary CTAs, hovers, highlights only. Use the `accent` Button variant for conversion CTAs; most buttons stay the deep `default`. `--color-sky` #6ba3f5 is the light accent tint for text on dark (navy) surfaces. Keep bright `#1a73e8` off physical/print output.
- Fonts: Roboto Flex (sans) + Merriweather (serif)

### Newsletter (Resend)

- Signup form adds contacts to the Resend segment (`RESEND_SEGMENT_ID`)
- Compose/schedule/send from `/admin/newsletter` — drafts live in the `Newsletter` Prisma model, delivery via Resend Broadcast API (scheduling handled by Resend, no cron)
- Unsubscribes handled by Resend via `{{{RESEND_UNSUBSCRIBE_URL}}}` in the email template (`app/_lib/email/newsletter-template.ts`)
- One-time Mailchimp import: `npx tsx scripts/import-subscribers.ts <export.csv>`

### Event Sync Architecture

- Two external sources: **Bright Bear Yoga** (Momence platform) + **DC Bouldering Project** (ZoomShift)
- Scraped via Playwright on Browserless.io cloud (needs `BROWSERLESS_API_TOKEN` in ALL envs)
- Duplicate prevention: `@@unique([sourceType, sourceId])` constraint
- Cron runs daily at 8 AM UTC (`/api/cron/sync-events`, 180s timeout)
- Events deactivated when no longer found externally
- Google Calendar sync happens automatically during event CRUD (non-blocking)

### Payments

- PaymentIntent created in `/api/create-payment-intent`
- Order created from Stripe webhook confirmation (not client-side) — `/api/webhooks/stripe`
- Two order types: `EVENT` and `PRIVATE_SESSION`

### User Sync

- Clerk webhook (`/api/webhooks/clerk`) creates/updates/deletes User records in Prisma
- Database User ID stored back in Clerk `publicMetadata.userId`
- Verified via Svix

## Conventions (follow these when extending)

- **Admin auth**: server actions call `requireAdmin()` from `app/_lib/auth.ts`; API route handlers call `assertAdminRequest()` (cron routes call `assertCronRequest()`) from `app/_lib/api-auth.ts`. Both standardize on `sessionClaims.metadata.role` to match `proxy.ts` — don't re-inline `currentUser()` role checks.
- **Server-action error contract**: mutations surface failures by throwing — the catch does `return handleError(error)` (typed `never`), and the client wraps the call in try/catch. Read helpers may instead `console.error` + return an empty default for graceful degradation (see `getFeaturedEvents`).
- **Reads vs writes**: server actions live in `*.actions.ts`. `*.queries.ts` holds `unstable_cache`-wrapped versions of public/hot reads (named `*Cached`) so public + crawler traffic doesn't keep the Neon DB awake — see `event.queries.ts`, `newsletter.queries.ts`. Bust the matching tag from `app/_lib/constants/cache-tags.ts` on mutation.
- **Serialize at the server→client boundary**: return `serialize()` (`app/_lib/utils/serialize.ts`) for any Prisma object crossing into a client component; it returns a `Serialized<T>` (Dates become ISO strings).
- **Hooks**: cross-feature hooks live in `app/_hooks`; feature-local hooks colocate with their feature (e.g. `app/admin/events/_components/hooks`).
- **New sync source**: add a `SOURCE_TYPES` member (`app/_lib/constants`), a crawler in `crawlers/`, a `*-sync-service.ts` (clone an existing one), then wire it into `event-sync-service.ts`, the sync-status route, and the `admin/sync` dashboard.
- **New admin CRUD resource**: `app/admin/categories` is the reference pattern for a simple single-resource CRUD (page + `_components` + `*.actions.ts` + Zod schema in `schema.ts` + a nav entry in `adminNavLinks`).

## Project Structure

```
app/
├── (auth)/                    # Sign-in/sign-up pages (Clerk)
├── (root)/                    # Public-facing pages
│   ├── _components/           # Page-level shared components (Header, Footer, EventCard, etc.)
│   ├── events/                # Event detail pages
│   ├── private-sessions/      # Multi-step booking wizard
│   ├── account/               # User account
│   └── page.tsx               # Home page
├── admin/                     # Admin dashboard (RBAC protected)
│   ├── events/                # Event CRUD with EventForm
│   ├── users/                 # User management
│   ├── categories/            # Category management
│   └── sync/                  # Sync status dashboard
├── api/
│   ├── webhooks/{clerk,stripe,resend} # Webhook handlers
│   ├── cron/sync-events/       # Daily cron (8 AM UTC)
│   ├── admin/sync/             # Manual sync endpoints
│   ├── create-payment-intent/  # Stripe
│   └── upload-blob/            # Vercel Blob
├── _lib/
│   ├── actions/               # Server actions (*.actions.ts) + cached reads (*.queries.ts)
│   ├── auth.ts / api-auth.ts  # requireAdmin() + assertAdminRequest()/assertCronRequest()
│   ├── crawlers/              # Bright Bear + DCBP scrapers
│   ├── services/              # Sync orchestration, DB ops, location/category resolution
│   ├── types/                 # TypeScript types
│   ├── utils/                 # Helpers (formatDateTime, serialize, pagination, query builders)
│   ├── prisma.ts              # Prisma singleton
│   ├── google-calendar.ts     # Google Calendar service account API
│   └── schema.ts              # Zod form schemas
├── _hooks/                    # Analytics hooks (page tracking, form, A/B)
├── providers.tsx              # All context providers
└── globals.css
```

## Database Schema

9 models in `prisma/schema.prisma`:

- **Event** — title, dates, price, isFree, isFeatured, isHostedExternally, category, location, sourceType/sourceId (sync), googleEventId
- **User** — clerkId (unique), email, firstName, lastName, photo
- **Order** — stripeId, totalAmount, type (EVENT/PRIVATE_SESSION), buyer → User, event → Event
- **EventUser** — join table (userId + eventId composite PK)
- **Location** — name, formattedAddress, lat/lng, placeId (Google Places)
- **Category** — name (unique)
- **Newsletter** — subject, content (TipTap HTML), status (DRAFT/SCHEDULED/SENT), scheduledAt, `sentHtml` snapshot, delivery counters, resendBroadcastId
- **NewsletterEmailEvent** — dedup ledger for Resend webhook events (opens/clicks/bounces); one row per (newsletter, emailId, type, link)
- **Book** — reserved for a future reading-list feature; not wired to anything yet

Enums: `OrderType` (EVENT, PRIVATE_SESSION), `NewsletterStatus` (DRAFT, SCHEDULED, SENT).

Key constraint: `@@unique([sourceType, sourceId])` on Event prevents duplicate synced events.

## Key Files

| File                                      | Purpose                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| `app/_lib/prisma.ts`                      | Prisma client singleton (default export)                      |
| `app/_lib/auth.ts`                        | `requireAdmin()` guard for server actions                     |
| `app/_lib/api-auth.ts`                    | `assertAdminRequest()` / `assertCronRequest()` for API routes |
| `proxy.ts`                                | Clerk middleware — route protection + admin RBAC              |
| `app/_lib/actions/event.actions.ts`       | Event CRUD server actions                                     |
| `app/_lib/crawlers/`                      | Web scrapers for Bright Bear + DCBP                           |
| `app/_lib/services/event-sync-service.ts` | Orchestrates sync pipeline                                    |
| `app/_lib/utils/index.ts`                 | formatDateTime (ET timezone), handleError, URL query helpers  |
| `app/_lib/utils/serialize.ts`             | Prisma → plain object serializer                              |
| `app/_lib/google-calendar.ts`             | Google Calendar API (service account)                         |
| `app/_lib/schema.ts`                      | Zod validation schemas for forms                              |
| `app/admin/events/_components/EventForm/` | Complex event creation/edit form                              |
| `app/(root)/private-sessions/`            | Multi-step private session booking wizard                     |
| `vercel.json`                             | Cron schedules + function timeouts                            |

## Env Vars

Documented in `.env.example`. Key groups:

- **Database**: `POSTGRES_PRISMA_URL` (pooled), `POSTGRES_URL_NON_POOLING` (direct/migrations)
- **Auth**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- **Payments**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET`
- **Maps**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_ID`
- **Calendar**: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY_BASE64`, `GOOGLE_CALENDAR_ID`
- **Scraping**: `BROWSERLESS_API_TOKEN` (required in all envs), `ZOOMSHIFT_EMAIL`, `ZOOMSHIFT_PASSWORD`
- **Email**: `RESEND_API_KEY`, `RESEND_SEGMENT_ID`, `RESEND_FROM_EMAIL`
- **Storage**: `BLOB_READ_WRITE_TOKEN`
- **Cron**: `CRON_SECRET`
