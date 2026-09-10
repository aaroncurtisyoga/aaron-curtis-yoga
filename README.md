# Aaron Curtis Yoga

Booking, payments, and class scheduling for a DC yoga instructor. Live at **[aaroncurtisyoga.com](https://aaroncurtisyoga.com)**.

![The site's home page](docs/screenshots/home.png)

I teach yoga in DC, and I built and run the site my students use. Solo build, in production on Vercel.

- **Events and checkout.** Browse, search, and register. Stripe for paid events, with the order written server-side from the webhook.
- **Private sessions.** A four-step booking wizard for session packages, ending at Stripe Elements.
- **Class sync.** Two partner studios publish schedules with no public API, so a nightly cron scrapes both and folds them into one calendar.
- **Newsletter.** Composed, scheduled, and sent from the admin area through Resend, with a public archive of past issues.
- **Admin.** Event CRUD, orders, subscribers, users, and a sync dashboard, behind a Clerk role check.
- **Google Calendar.** Every event write mirrors through to a real calendar, so students can subscribe.

## Stack

| Layer     | What                                                          |
| --------- | ------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, server actions), React 19, TypeScript |
| Data      | Prisma 6 against Neon-backed Postgres                         |
| UI        | shadcn/ui on Radix primitives, Tailwind CSS 4                 |
| Auth      | Clerk, route protection in `proxy.ts`                         |
| Payments  | Stripe                                                        |
| Email     | Resend                                                        |
| Google    | Calendar via service account, Maps for locations              |
| Scraping  | `playwright-core` against Browserless                         |
| Ops       | Vercel, cron jobs, Vercel Blob, Playwright for E2E            |

## The interesting parts

### Scraping two studios on a schedule

Bright Bear Yoga (Momence) and DC Bouldering Project (ZoomShift) both list classes I teach, and neither exposes an API. A daily cron scrapes them with Playwright running on Browserless, so there's no browser binary to install and no drift between a laptop and a serverless function.

- The two sources run sequentially inside a 180s budget, each in its own try/catch, so one studio changing its markup doesn't take the other down.
- Retries fire only on Browserless rate-limit and connection errors, three attempts at 5s then 10s. A broken selector throws on the first try, because retrying won't fix it.
- A crawl returning zero events counts as a failure, not an empty schedule. That's the difference between a studio outage and silently wiping a week off the site.
- Writes dedupe twice: on `sourceId` in the payload, since a class can appear in two month views, and at the database via `@@unique([sourceType, sourceId])`.

Scraped classes land on the public calendar next to anything I schedule myself:

![Month view of the class calendar](docs/screenshots/schedule-month.png)

### Orders are written by the Stripe webhook

Events go through a Stripe Checkout session and private sessions through a PaymentIntent, but neither writes the `Order`. That happens in `/api/webhooks/stripe`, idempotently on `stripeId`, so a student who closes the tab on the confirmation screen still gets their registration. All three webhook handlers (Stripe, Clerk, Resend) verify signatures before touching the database.

### Public reads are cached because the database bills by the minute

Hot public reads are `unstable_cache`-wrapped in `*.queries.ts` and busted by tag on mutation. That's a cost decision as much as a speed one: the Neon compute never scales to zero while crawler and search-engine traffic keeps waking it up.

### Newsletter, end to end

A TipTap editor with debounced autosave, a phone-width live preview, and an insert-event dialog that pulls real event data into the draft. Delivery and scheduling run through Resend broadcasts. Every sent issue keeps a `sentHtml` snapshot, so the public archive renders exactly what landed in inboxes. Resend's webhook feeds opens, clicks, and bounces back into per-issue stats, deduped through a ledger table so a redelivered webhook can't double-count.

There's also a private, admin-only training tracker at `/train`: a phone-first workout logger with nightly Garmin import on a second cron.

## Testing and CI

Playwright for E2E, with the config starting the dev server itself outside CI. GitHub Actions runs lint and `tsc --noEmit` on pushes and PRs to `main`, and a smoke test against the deployed Vercel preview rather than a build in the runner, then again against production after a deploy. Husky runs eslint, a type check, and prettier on staged files before a commit.

## Running it locally

```bash
cp .env.example .env.local   # then fill it in
npm install
# the Prisma CLI reads .env, not .env.local:
grep '^POSTGRES_' .env.local > .env
npx prisma migrate deploy
npm run dev
```

<details>
<summary>Setup notes</summary>

`.env.example` lists the variables the code reads, grouped by feature. Postgres, Clerk, and Stripe are the minimum to boot; everything else switches off one feature at a time.

Two gotchas. The app reads `.env.local`, but the Prisma CLI only reads `.env`, so the Postgres URLs need to be in `.env` before `migrate deploy`, and Studio wants `npx dotenv-cli -e .env.local -- npx prisma studio`. And a fresh database has no categories, so create one from `/admin` before your first event, after giving your Clerk user the `admin` role.

Other scripts: `npm run check` (lint + types), `npm run validate` (check + build), `npm run test:e2e`.

</details>

## Contact

Instagram [@aaroncurtisyoga](https://www.instagram.com/aaroncurtisyoga/) · aaroncurtisyoga@gmail.com
