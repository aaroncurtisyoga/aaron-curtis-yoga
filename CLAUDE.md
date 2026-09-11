# aaroncurtisyoga.com, Aaron Curtis Yoga

Fullstack yoga instructor website. Event management, class registration, private session booking, automated external event syncing, Google Calendar integration, Stripe payments.

## Stack

- **Next.js 16** + React 19 + TypeScript. `strict: false` but `strictNullChecks: true`, plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- **shadcn/ui** (Radix primitives in `components/ui`) + Tailwind CSS 4. No animation library (framer-motion or similar) is installed: motion comes from the `tailwindcss-animate` plugin, registered in `app/globals.css`, plus keyframes in `tailwind.config.js`
- **Prisma 6** + Postgres, Neon-backed through Vercel (pooled: `POSTGRES_PRISMA_URL`, direct: `POSTGRES_URL_NON_POOLING`)
- **Clerk** for auth (RBAC, admin role in session claims metadata)
- **Stripe** for payments (events + private sessions)
- **Google Calendar** via service account (not OAuth)
- **Google Maps** for locations
- **Resend** for newsletter (signups + broadcasts, managed from `/admin/newsletter`)
- **Playwright** + Browserless.io for web scraping (event sync)
- **Vercel Blob** for file uploads
- Deploy: **Vercel** with one daily cron

## Commands

```bash
npm run dev              # Next.js dev (Turbopack is the Next 16 default)
npm run build            # Production build
npm run check            # eslint + tsc --noEmit, run before committing
npm run validate         # check + build
npm run test:e2e         # Playwright (:ui and :debug variants exist)
npx prisma studio        # DB GUI, see the .env note below
npx prisma generate      # Regenerate client
```

Migrations: use `npx prisma migrate diff` + `npx prisma migrate deploy`, never `migrate dev`. The Prisma CLI reads `.env`, not `.env.local`, so it cannot see the app's env by default. Either put the two `POSTGRES_` URLs in `.env` or prefix commands with `npx dotenv-cli -e .env.local --`.

## Key Conventions & Gotchas

### Prisma 6 (NOT Prisma 7)

- Uses `url` and `directUrl` in `prisma/schema.prisma`, which is correct for Prisma 6
- Client singleton in `app/_lib/prisma.ts`, `export default prisma` (default export, not named)
- **Serialize before sending to client**: Prisma objects have Symbol properties that break React serialization. Use `serialize()` from `app/_lib/utils/serialize.ts` (JSON round-trip)

### Next.js 16, `proxy.ts`

- Route protection via `proxy.ts` (not `middleware.ts`) using Clerk's `clerkMiddleware`
- `/account`, `/profile`, `/settings` need a signed-in user
- `/admin` + `/admin/*` additionally require `sessionClaims.metadata.role === "admin"`
- `authorizedParties` in `proxy.ts` is an exact-match allowlist of this site's own origins (`www` and the apex, plus localhost and Vercel preview origins outside production). Anything serving this Clerk instance from a new host must be added there, or it 401s on every authenticated request. `train.` is left out on purpose: it's a separate app (the training tracker) that mints its own sessions

### All dates are America/New_York

- `formatDateTime()` in `app/_lib/utils/index.ts` forces `timeZone: "America/New_York"` everywhere
- Event form dates go through `components/ui/date-time-picker.tsx`: a `react-day-picker` calendar with `date-fns` formatting. There is no timezone library
- Crawler-parsed dates are re-interpreted as ET by helpers in `app/_lib/utils/`
- Event datetimes are stored as UTC DateTime in Postgres, displayed in ET

### shadcn/ui (migrated off HeroUI)

- Import from `@/components/ui/*` (button, card, dialog, table, input, etc.)
- Two-blue system in `app/globals.css`: deep royal anchor `#0842a0` (`--primary`/`--ring`) for brand, print/apparel, headings, and text and links on white; bright screen accent `#1a73e8` (`--color-cta`, exposed as `bg-cta`/`text-cta`) for primary CTAs, hovers, and highlights only. Use the `accent` Button variant for conversion CTAs; most buttons stay the deep `default`. `--color-sky` #6ba3f5 is the light accent tint for text on dark (navy) surfaces. Keep bright `#1a73e8` off physical and print output
- Two more tokens in the same `@theme inline` block: `--color-navy` #131826 (ink and dark surfaces) and `--color-band` #eef1fa (pale section band), exposed as `bg-navy` / `bg-band`
- Fonts loaded in `app/layout.tsx` via `next/font/google` and mapped in `tailwind.config.js`: Barlow to `font-sans`, Merriweather to `font-serif`, Anton to `font-display`
- The public site is pinned light. `app/providers.tsx` sets `forcedTheme="light"`, so `dark:` variants on public components are dead code

### Newsletter (Resend)

- Signup form adds contacts to the Resend segment (`RESEND_SEGMENT_ID`)
- Compose/schedule/send from `/admin/newsletter`. Drafts live in the `Newsletter` Prisma model, delivery via Resend Broadcast API (scheduling handled by Resend, no cron)
- Unsubscribes handled by Resend via `{{{RESEND_UNSUBSCRIBE_URL}}}` in the email template (`app/_lib/email/newsletter-template.ts`)
- One-time Mailchimp import: `npx tsx scripts/import-subscribers.ts <export.csv>`

### Event Sync Architecture

- Two external sources: **Bright Bear Yoga** (Momence platform) + **DC Bouldering Project** (ZoomShift)
- Scraped via Playwright on Browserless.io cloud (needs `BROWSERLESS_API_TOKEN` in ALL envs)
- Duplicate prevention: `@@unique([sourceType, sourceId])` constraint, plus a dedupe on `sourceId` in the crawler payload
- Retries fire only on Browserless rate-limit errors: `maxAttempts: 3`, `baseDelay: 5000`, so 5s then 10s. Anything else throws on the first try
- Events are deactivated when they stop appearing externally, with two guards: a crawl returning zero events skips deactivation entirely, and the Google Calendar entry must delete successfully first
- Google Calendar sync happens automatically during event CRUD (non-blocking)

### Payments

- Private sessions: PaymentIntent created in `/api/create-payment-intent` with metadata `type: PRIVATE_SESSION`
- Events go through Stripe Checkout instead
- Order created from Stripe webhook confirmation, never client-side (`/api/webhooks/stripe`), idempotent on `stripeId`
- Two order types: `EVENT` and `PRIVATE_SESSION`

### User Sync

- Clerk webhook (`/api/webhooks/clerk`) creates/updates/deletes User records in Prisma
- Database User ID stored back in Clerk `publicMetadata.userId`
- Verified via Svix

## Conventions (follow these when extending)

- **Admin auth**: server actions call `requireAdmin()` from `app/_lib/auth.ts`; API route handlers call `assertAdminRequest()` (cron routes call `assertCronRequest()`) from `app/_lib/api-auth.ts`. Both standardize on `sessionClaims.metadata.role` to match `proxy.ts`. Don't re-inline `currentUser()` role checks.
- **Server-action error contract**: mutations surface failures by throwing. The catch does `return handleError(error)` (typed `never`), and the client wraps the call in try/catch. Read helpers may instead `console.error` and return an empty default for graceful degradation (see `getFeaturedEvents`).
- **Reads vs writes**: server actions live in `*.actions.ts`. `*.queries.ts` holds `unstable_cache`-wrapped versions of public and hot reads (named `*Cached`) so public and crawler traffic doesn't keep the Neon DB awake. See `event.queries.ts`, `newsletter.queries.ts`. Bust the matching tag from `app/_lib/constants/cache-tags.ts` on mutation.
- **Serialize at the server to client boundary**: return `serialize()` (`app/_lib/utils/serialize.ts`) for any Prisma object crossing into a client component; it returns a `Serialized<T>` where Dates become ISO strings.
- **Hooks**: cross-feature hooks live in `app/_hooks`; feature-local hooks colocate with their feature (e.g. `app/admin/events/_components/hooks`).
- **New sync source**: add a `SOURCE_TYPES` member (`app/_lib/constants`), a crawler in `crawlers/`, a `*-sync-service.ts` (clone an existing one), then wire it into `event-sync-service.ts`, the sync-status route, and the `admin/sync` dashboard.
- **New admin CRUD resource**: `app/admin/categories` is the reference pattern for a simple single-resource CRUD (page + `_components` + `*.actions.ts` + Zod schema in `schema.ts` + a nav entry in `adminNavLinks`).

## Project Structure

```
app/
├── (auth)/                    # Sign-in/sign-up pages (Clerk)
├── _components/               # App-wide shared: Header/, Footer, NewsletterForm, GoogleMap, Tiptap/
├── (root)/                    # Public-facing pages
│   ├── _components/           # Public page sections (EventCard, HomeHero, weekly schedule)
│   ├── events/                # Event detail pages
│   ├── newsletter/            # Public sent-issue archive
│   ├── private-sessions/      # Multi-step booking wizard
│   ├── account/               # User account
│   └── page.tsx               # Home page
├── admin/                     # Admin dashboard (RBAC protected)
│   ├── events/                # Event CRUD with EventForm, plus orders
│   ├── newsletter/            # Composer, subscribers, per-issue stats
│   ├── users/                 # User management
│   ├── categories/            # Category management
│   └── sync/                  # Sync status dashboard
├── api/
│   ├── webhooks/{clerk,stripe,resend} # Webhook handlers
│   ├── cron/sync-events/       # Daily cron (8 AM UTC, 180s)
│   ├── admin/sync/             # Manual sync endpoints
│   ├── create-payment-intent/  # Stripe
│   └── upload-blob/, upload-image/
├── _lib/
│   ├── actions/               # Server actions (*.actions.ts) + cached reads (*.queries.ts)
│   ├── auth.ts / api-auth.ts  # requireAdmin() + assertAdminRequest()/assertCronRequest()
│   ├── crawlers/              # Bright Bear + DCBP scrapers
│   ├── services/              # Sync orchestration, DB ops
│   ├── types/                 # TypeScript types
│   ├── utils/                 # formatDateTime, serialize, query builders
│   ├── prisma.ts              # Prisma singleton
│   ├── google-calendar.ts     # Google Calendar service account API
│   └── schema.ts              # Zod form schemas
├── _hooks/                    # useDisclosure, useNewsletterAutosave, useUnsavedChangesGuard,
│                              # useAutocompleteSuggestions
├── providers.tsx              # All context providers (theme forced light)
└── globals.css
e2e/                           # Playwright specs, global.setup.ts, @clerk/testing auth
prisma/                        # schema.prisma + migrations
scripts/                       # import-subscribers, recolor-app-icons, version.sh
```

## Database Schema

15 models in `prisma/schema.prisma`.

Site (9):

- **Event**: title, dates, price, isFree, isFeatured, isActive, category, location, maxAttendees, googleEventId. Two separate external flags: `isHostedExternally` (advertised but not sold here) and `isExternal` (came from a crawler), plus sourceType/sourceId
- **User**: clerkId (unique), email, firstName, lastName, photo
- **Order**: stripeId, totalAmount, type (EVENT/PRIVATE_SESSION), buyer to User, event to Event
- **EventUser**: join table (userId + eventId composite PK)
- **Location**: name, formattedAddress, lat/lng, placeId (Google Places)
- **Category**: name (unique)
- **Newsletter**: subject, content (TipTap HTML), status, scheduledAt, `sentHtml` snapshot, delivery counters, resendBroadcastId
- **NewsletterEmailEvent**: dedup ledger for Resend webhook events; one row per (newsletter, emailId, type, link)
- **Book**: reserved for a future reading-list feature; not wired to anything yet

Training tracker (6, single-user so no `userId` on any of them):

- **Movement**: canonical movement library; name (unique), category, unitType, defaultUnit
- **PlannedSession**: a day's prescription; world (HYROX/CROSSFIT), source (AUTHORED/PUSHPRESS/MANUAL), `blocks` Json, unique sourceId
- **LoggedSession**: one thing actually done; date, activityType, rpe, felt, durationMin, score
- **LoggedMovement**: per-movement sets within a logged session
- **GarminActivity**: imported activity, upserted by `garminId`, optionally linked to a LoggedSession
- **DailyWellness**: daily readiness metrics from Garmin

Enums (8): `OrderType`, `NewsletterStatus`, `MovementCategory`, `UnitType`, `WeightUnit`, `TrainingWorld`, `PlannedSource`, `ActivityType`.

Key constraint: `@@unique([sourceType, sourceId])` on Event prevents duplicate synced events.

## Key Files

| File                                             | Purpose                                                       |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `app/_lib/prisma.ts`                             | Prisma client singleton (default export)                      |
| `app/_lib/auth.ts`                               | `requireAdmin()` guard for server actions                     |
| `app/_lib/api-auth.ts`                           | `assertAdminRequest()` / `assertCronRequest()` for API routes |
| `proxy.ts`                                       | Clerk middleware, route protection + admin RBAC               |
| `app/_lib/actions/event.actions.ts`              | Event CRUD server actions                                     |
| `app/_lib/crawlers/`                             | Web scrapers for Bright Bear + DCBP                           |
| `app/_lib/services/event-sync-service.ts`        | Orchestrates sync pipeline                                    |
| `app/_lib/services/event-database-operations.ts` | Event upsert/deactivate + Calendar reconciliation             |
| `app/_lib/utils/index.ts`                        | formatDateTime (ET), handleError, URL query helpers           |
| `app/_lib/utils/serialize.ts`                    | Prisma to plain object serializer                             |
| `app/_lib/constants/index.ts`                    | SOURCE_TYPES, adminNavLinks, table column defs                |
| `app/_lib/google-calendar.ts`                    | Google Calendar API (service account)                         |
| `app/_lib/schema.ts`                             | Zod validation schemas for forms                              |
| `app/admin/events/_components/EventForm/`        | Event creation/edit form                                      |
| `app/(root)/private-sessions/`                   | Multi-step private session booking wizard                     |
| `vercel.json`                                    | Cron schedules + function timeouts                            |

## Env Vars

`.env.example` lists the names the code reads, grouped by feature:

- **Database**: `POSTGRES_PRISMA_URL` (pooled), `POSTGRES_URL_NON_POOLING` (direct/migrations)
- **Auth**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- **Payments**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET`
- **Maps**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (the only Maps var used)
- **Calendar**: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY_BASE64`, `GOOGLE_CALENDAR_ID`
- **Scraping**: `BROWSERLESS_API_TOKEN` (required in all envs), `ZOOMSHIFT_EMAIL`, `ZOOMSHIFT_PASSWORD`
- **Email**: `RESEND_API_KEY`, `RESEND_SEGMENT_ID`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`
- **Storage**: `BLOB_READ_WRITE_TOKEN`
- **Cron**: `CRON_SECRET`, gating the scheduled job
- **App**: `NEXT_PUBLIC_SERVER_URL` (Stripe return URLs and account links)
- **Testing**: `NEXT_PUBLIC_APP_URL` (Playwright base URL, distinct from `NEXT_PUBLIC_SERVER_URL`), `CLERK_PUBLISHABLE_KEY` (unprefixed, gates `@clerk/testing`), four `E2E_CLERK_*` credentials

Known naming trap: the Clerk webhook secret is read as `CLERK_WEBHOOK_SECRET` and the Stripe one as `STRIPE_WEBHOOK_SIGNING_SECRET`, but older env files use `WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET`, and the Clerk route's own error string still says `WEBHOOK_SECRET`. If a webhook silently fails, check the name first.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
