# Newsletter provider: why Resend

**Decided July 2026. Shipped.** Mailchimp's free tier dropped to 250 subscribers, which forced a move. The two real candidates were Kit and Resend.

## What the site actually needs

A branded monthly newsletter, a signup form in the footer, and eventually transactional email for event registration confirmations. Everything else is optional.

Building it in-house was never seriously on the table. Subscriber storage is easy, but email HTML is not: no flexbox, inconsistent CSS support, and every client renders differently. Add unsubscribe and CAN-SPAM handling, bounce processing, and deliverability reputation, and it's weeks of work to land somewhere worse than a provider's free tier.

## The tradeoff

Kit is the better product for writing newsletters. Its visual editor, subscriber tags, engagement segments, and automations are all things Resend either lacks or exposes only as API primitives. Its free tier is also ten times larger: 10,000 subscribers against Resend's 1,000.

Resend wins on one axis that mattered more: it's one platform for both marketing and transactional email. Event confirmations, receipts, and the newsletter can share a sender identity, a domain reputation, and one API key. With Kit, transactional email would have meant a second provider.

The signup-form code is identical either way, one API call in a server action, so integration cost didn't break the tie.

## What I gave up

Kit's tags, engagement-based segments, and visual automations. Resend has a flat contact list per audience, so anything resembling segmentation has to be built on top of the API. That hasn't bitten yet at current list size, but it's the first thing that will hurt if the list grows or the sends get more targeted than "everyone, monthly."

## What shipped

Drafts live in the `Newsletter` Prisma model and are composed in a TipTap editor at `/admin/newsletter`. Delivery goes through the Resend Broadcast API, which also owns scheduling, so there's no cron. Unsubscribes are handled by Resend through `{{{RESEND_UNSUBSCRIBE_URL}}}` in the template. The `/api/webhooks/resend` handler feeds opens, clicks, bounces, and complaints back into per-issue counters, deduped through a `NewsletterEmailEvent` ledger.

The Mailchimp list was imported once with `npx tsx scripts/import-subscribers.ts <export.csv>`.

## Still open

Whether event registration confirmations should come from Resend too, or stay with Stripe's receipts. That was the main argument for choosing Resend and it hasn't been built yet.
