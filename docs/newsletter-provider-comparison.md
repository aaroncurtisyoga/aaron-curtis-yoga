# Newsletter Provider Comparison: Kit vs Resend

Evaluating replacements for Mailchimp (free tier shrunk to 250 subscribers). Primary need: branded monthly newsletter. Secondary (future): transactional emails for event registration confirmations.

## Why use a provider vs building from scratch?

Building from scratch means: storing subscribers in your own DB, building an email composer UI, creating branded HTML email templates (email HTML is notoriously painful — no flexbox, limited CSS, every client renders differently), handling unsubscribe/CAN-SPAM compliance, bounce handling, spam complaints, deliverability reputation, and analytics. That's weeks of work.

A provider gives you all of that out of the box. The only code on your site is a signup form in the footer.

---

## Real-World Scenarios

### Scenario 1: Someone subscribes on your site

**Both Kit and Resend — identical experience:**

1. Visitor enters email in your footer form, clicks "Subscribe"
2. Your server action calls the provider's API to add the subscriber
3. Subscriber gets a confirmation/welcome email (automatic)

The code on your site is nearly identical either way — one API call in a server action.

### Scenario 2: Composing and sending a monthly newsletter

**Kit:**

1. Log into kit.com
2. Click "Broadcasts" → "New Broadcast"
3. Use their visual editor — drag in images, type text, add buttons/links
4. Apply your brand colors/fonts in the template settings (one-time setup)
5. Preview on desktop/mobile
6. Hit "Send" (or schedule for later)
7. Done. ~10 minutes.

**Resend:**

1. Log into resend.com
2. Click "Broadcasts" → "Create Broadcast"
3. Use their web editor (simpler than Kit — more like a basic rich text editor with blocks)
4. OR write a React Email template in your codebase (JSX), push to git, reference it in the broadcast
5. Preview and send
6. Done. ~10-15 minutes with web editor, longer if coding templates.

**Key difference:** Kit's editor is more polished and has more layout options (columns, image+text combos, etc.). Resend's broadcast editor is functional but more minimal. If you want to code your email templates as React components, only Resend supports that — but that's more work, not less.

### Scenario 3: Subscriber management and segmentation

**Kit:**

- Full subscriber dashboard with tags, segments, custom fields
- Visual automation builder (e.g., "when someone subscribes, send welcome sequence")
- See subscriber growth over time
- Filter by engagement (active, cold, etc.)

**Resend:**

- "Audiences" section shows contacts
- Basic list management — add, remove, view
- No tags, segments, or automations on free tier
- Much simpler (which could be a pro or con)

**Key difference:** Kit treats subscriber management as a core feature. Resend treats it as a basic contact list.

### Scenario 4: Analytics

**Kit:**

- Open rate, click rate, click map
- Per-subscriber engagement tracking
- Which links got clicked most
- Unsubscribe reasons

**Resend:**

- Open rate, click rate, bounce rate
- Per-email analytics
- More basic — focused on delivery metrics

**Key difference:** Kit gives you more creator-oriented insights. Resend gives you developer-oriented delivery metrics.

### Scenario 5: Code changes in your Next.js app

**Kit:**

- Install no new packages (just REST API calls)
- Server action: `fetch('https://api.kit.com/v4/forms/{formId}/subscribers', ...)` with the email
- Footer form stays the same UI-wise
- Env vars: `KIT_API_KEY`, `KIT_FORM_ID`
- ~20 lines of server action code

**Resend:**

- Install `resend` npm package
- Server action: `resend.contacts.create({ email, audienceId })`
- Footer form stays the same UI-wise
- Env vars: `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`
- ~15 lines of server action code

**Key difference:** Resend has a slightly nicer SDK. Kit uses plain fetch. Both are trivial.

---

## Summary

|                           | Kit                                           | Resend                                                          |
| ------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| **Writing newsletters**   | Better editor, more templates                 | Basic editor, or code in React                                  |
| **Subscriber management** | Rich (tags, segments, automations)            | Basic contact list                                              |
| **Analytics**             | Creator-focused, detailed                     | Developer-focused, delivery metrics                             |
| **Code complexity**       | Same                                          | Same                                                            |
| **Free tier**             | 10,000 subscribers                            | 1,000 contacts                                                  |
| **Best for**              | "I want to write and send newsletters easily" | "I want one platform for all email (transactional + marketing)" |

## Recommendation

- If primary need is **compose a branded monthly newsletter and send it** → Kit wins on the editing/sending experience.
- If you later want to also send **transactional emails** from your app (order confirmations, booking confirmations) from one platform → Resend wins on unification.

## Open Questions

- Would something like Partiful be better for event registration/confirmation flows?
- Do we need transactional email (event confirmations) from the same platform, or is that a separate concern?
