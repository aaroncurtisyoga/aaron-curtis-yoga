import { EventWithLocationAndCategory } from "@/app/_lib/types";
import { formatDateTime, richTextToPlainText } from "@/app/_lib/utils";

// Shared by the newsletter's auto-appended sections (server) and the
// composer's "Insert event" picker (client) — keep this module pure.

export const NEWSLETTER_SITE_URL = "https://www.aaroncurtisyoga.com";
export const CTA = "#1a73e8"; // bright screen accent — email CTA buttons (large fill)
const DESCRIPTION_MAX_CHARS = 160;

// Quotes too: escaped output also lands inside attribute values (alt="…").
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Trim to a word boundary near the limit and add an ellipsis.
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

/**
 * Synced events (Momence/DCBP) store their booking link in externalUrl;
 * admin-created external events use externalRegistrationUrl. Link straight to
 * whichever real booking page exists, else the event page on our site.
 */
export function eventHref(event: EventWithLocationAndCategory): string {
  const bookingUrl = event.externalRegistrationUrl || event.externalUrl;
  return (event.isHostedExternally || event.isExternal) && bookingUrl
    ? bookingUrl
    : `${NEWSLETTER_SITE_URL}/events/${event.id}`;
}

export function eventWhenLabel(event: EventWithLocationAndCategory): string {
  const { weekdayShort, monthShort, dayNumber, timeOnly } = formatDateTime(
    event.startDateTime,
  );
  return `${weekdayShort}, ${monthShort} ${dayNumber} · ${timeOnly}`;
}

export function eventListItemHtml(
  event: EventWithLocationAndCategory,
  {
    withDescription = false,
    withCta = false,
  }: { withDescription?: boolean; withCta?: boolean } = {},
): string {
  const when = eventWhenLabel(event);
  // Titles/locations come from external scrapers too — escape everything.
  const location = event.location?.name
    ? ` · ${escapeHtml(event.location.name)}`
    : "";
  const href = escapeHtml(eventHref(event));

  // Descriptions are TipTap HTML on the site — flatten, truncate, re-escape
  // (richTextToPlainText decodes entities back to raw <, >, & characters).
  let description = "";
  if (withDescription) {
    const text = richTextToPlainText(event.description);
    if (text) {
      description = `<span style="display:block; margin-top:3px; color:#52525b; font-size:14px; font-style:italic; line-height:1.5;">${escapeHtml(
        truncate(text, DESCRIPTION_MAX_CHARS),
      )}</span>`;
    }
  }

  // A bright-accent button so featured events get a clear call to action, not
  // just a linked title. Links to external registration when hosted elsewhere.
  const cta = withCta
    ? `<span style="display:block; margin-top:8px; text-align:center;"><a href="${href}" style="display:inline-block; background-color:${CTA}; color:#ffffff; text-decoration:none; font-weight:700; font-size:13px; letter-spacing:0.02em; padding:8px 16px; border-radius:4px;">Sign Up</a></span>`
    : "";

  // With a CTA button present the title needn't also be a link; without one
  // (Classes This Week) the linked title is the only way through.
  const title = withCta
    ? `<strong>${escapeHtml(event.title)}</strong>`
    : `<strong><a href="${href}">${escapeHtml(event.title)}</a></strong>`;

  const liAttr = description || cta ? ' style="margin-bottom:18px;"' : "";
  return `<li${liAttr}>${title}, ${when}${location}${description}${cta}</li>`;
}

/**
 * A standalone event card for inserting into the newsletter *body*. Unlike
 * eventListItemHtml (appended at send time, never parsed by the editor), this
 * HTML round-trips through Tiptap, so it may only use nodes the editor schema
 * knows: img, h3, p, a, strong. No spans, tables, or inline styles — the email
 * template's `.content` styles dress it up at render time.
 */
export function eventCardHtml(
  event: EventWithLocationAndCategory,
  { withImage = true }: { withImage?: boolean } = {},
): string {
  const href = escapeHtml(eventHref(event));
  const title = escapeHtml(event.title);
  const location = event.location?.name
    ? ` · ${escapeHtml(event.location.name)}`
    : "";
  const image =
    withImage && event.imageUrl
      ? `<img src="${escapeHtml(event.imageUrl)}" alt="${title}">`
      : "";

  return `${image}<h3>${title}</h3><p>${eventWhenLabel(event)}${location}</p><p><a href="${href}" target="_blank" rel="noopener noreferrer"><strong>Sign up →</strong></a></p>`;
}
