const SITE_URL = "https://www.aaroncurtisyoga.com";
const INSTAGRAM_URL = "https://www.instagram.com/aaroncurtisyoga/";
const YOUTUBE_URL = "https://www.youtube.com/channel/UCwwNWri2IhKxXKmQkCpj-uw";
const ROYAL = "#0842a0"; // deep anchor — email links & accents (text-weight, on white)
const NAVY = "#131826";
const INK = "#222222";

/**
 * Resend substitutes {{{contact.*}}} merge tags per-recipient only when a
 * broadcast actually sends. Previews, the sent-newsletter viewer, and test
 * sends go through APIs that DON'T substitute, so resolve the tags ourselves in
 * those contexts — using the supplied values, or each tag's own |fallback (or
 * empty when it has none) — so nobody sees a raw "{{{contact.first_name}}}".
 * Leaves {{{RESEND_UNSUBSCRIBE_URL}}} untouched (handled via unsubscribeUrl).
 */
export function resolveMergeTags(
  html: string,
  values: { firstName?: string; lastName?: string; email?: string } = {},
): string {
  const map: Record<string, string | undefined> = {
    first_name: values.firstName,
    last_name: values.lastName,
    email: values.email,
  };
  return html.replace(
    /\{\{\{\s*contact\.(first_name|last_name|email)\s*(?:\|([^}]*))?\}\}\}/g,
    (_match, field: string, fallback = "") => {
      const value = map[field];
      return (value && value.trim()) || fallback.trim();
    },
  );
}

/**
 * Placeholder strings shipped by the starter template and snippets — a send
 * that still contains one is a mistake, full stop. Keep in sync with
 * app/admin/newsletter/_lib/templates.ts.
 */
const TEMPLATE_PLACEHOLDERS = [
  "[Your message here]",
  "[Workshop name]",
  "[When · where]",
  "[What it is and why it's worth coming to]",
];

const VALID_MERGE_TAG =
  /^\{\{\{\s*(?:contact\.(?:first_name|last_name|email)\s*(?:\|[^}]*)?|RESEND_UNSUBSCRIBE_URL\s*)\}\}\}$/;

export interface NewsletterContentIssues {
  /** Certain mistakes — sending is refused while any of these exist. */
  blockers: string[];
  /** Probable mistakes — surfaced in the Send dialog but not enforced. */
  warnings: string[];
}

/**
 * Pre-send sanity check for the newsletter body. Broadcasts fire with no undo,
 * so template scaffolds ("[Your message here]") and merge tags Resend won't
 * substitute (a typo like {{{contact.firstname}}}, or double braces) are
 * blockers; other [bracketed] text — usually a note-to-self — is a warning.
 * Checked by sendNewsletter and previewed in the composer's Send dialog.
 */
export function findNewsletterContentIssues(
  html: string,
): NewsletterContentIssues {
  const blockers: string[] = [];
  const warnings: string[] = [];
  // Scan visible text so placeholders split across inline marks still match
  // and curly braces inside attributes can't false-positive.
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

  for (const placeholder of TEMPLATE_PLACEHOLDERS) {
    if (text.includes(placeholder)) {
      blockers.push(`replace the template placeholder “${placeholder}”`);
    }
  }

  const bracketed = new Set(text.match(/\[[^\[\]]{1,80}\]/g) ?? []);
  for (const match of bracketed) {
    if (!TEMPLATE_PLACEHOLDERS.includes(match)) {
      warnings.push(`“${match}” looks like an unfinished placeholder`);
    }
  }

  const tagCandidates = new Set(text.match(/\{\{+[^{}]*\}\}+/g) ?? []);
  for (const candidate of tagCandidates) {
    if (!VALID_MERGE_TAG.test(candidate)) {
      blockers.push(
        `fix the merge tag “${candidate}” — only {{{contact.first_name}}}, {{{contact.last_name}}}, and {{{contact.email}}} (triple braces) get filled in`,
      );
    }
  }

  return { blockers, warnings };
}

/**
 * Stamp every <img> with inline max-width/height styles. The <head> <style>
 * rule that normally constrains images is stripped by some clients (Gmail for
 * non-Gmail accounts, some Outlooks), and a full-resolution phone photo would
 * otherwise render at native width and blow out the 600px layout. Inline
 * styles survive those clients. No width attribute on purpose: without the
 * intrinsic size we'd either upscale small images or do nothing.
 */
function makeImagesEmailSafe(html: string): string {
  const IMG_STYLE = "max-width:100%;height:auto;";
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const styleAttr = tag.match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (!styleAttr) {
      return tag.replace(/^<img\b/i, `<img style="${IMG_STYLE}"`);
    }
    const existing = styleAttr[2] ?? styleAttr[3] ?? "";
    if (/max-width/i.test(existing)) return tag;
    const merged = `${existing.trim().replace(/;?$/, ";")}${IMG_STYLE}`;
    return tag.replace(styleAttr[0], `style="${merged}"`);
  });
}

/** Minimal entity decode for the plain-text part (TipTap escapes only these). */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

interface RenderNewsletterTextParams {
  contentHtml: string;
  /** Same contract as renderNewsletterHtml — test sends pass a real URL. */
  unsubscribeUrl?: string;
}

/**
 * Plain-text alternative for the newsletter. A missing text/plain part is a
 * classic spam-score ding, and deliverability is the whole game for a small
 * personal list. Callers should resolve contact merge tags first (see
 * resolveMergeTags) so text-only readers never see raw handlebars; the
 * unsubscribe placeholder stays for Resend to substitute.
 */
export function renderNewsletterText({
  contentHtml,
  unsubscribeUrl = "{{{RESEND_UNSUBSCRIBE_URL}}}",
}: RenderNewsletterTextParams): string {
  const body = contentHtml
    // Links become "label (url)" so CTAs survive without markup. Skip
    // self-referential labels to avoid "https://x (https://x)".
    .replace(
      /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,
      (_match, hrefDq, hrefSq, label) => {
        const href = (hrefDq ?? hrefSq ?? "").trim();
        const labelText = label.replace(/<[^>]*>/g, "").trim();
        if (!labelText) return href;
        if (!href || labelText === href) return labelText;
        return `${labelText} (${href})`;
      },
    )
    // Structure → whitespace before all remaining tags are stripped.
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\b[^>]*>/gi, "\n\n---\n\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    // The event sections lay out description/CTA lines as display:block
    // spans; without breaks on both edges they'd glue onto adjacent text.
    .replace(/<span\b[^>]*display\s*:\s*block[^>]*>/gi, "\n")
    .replace(/<\/span>/gi, "\n")
    .replace(/<\/(?:h1|h2|h3|p|ul|ol|blockquote|div)>/gi, "\n\n")
    .replace(/<\/li>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "");

  const text = decodeEntities(body)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return [
    "aaron curtis yoga",
    "",
    text,
    "",
    "---",
    `Instagram: ${INSTAGRAM_URL}`,
    `YouTube: ${YOUTUBE_URL}`,
    "",
    `You're receiving this because you signed up at ${SITE_URL}`,
    `Unsubscribe: ${unsubscribeUrl}`,
    "",
  ].join("\n");
}

interface RenderNewsletterHtmlParams {
  contentHtml: string;
  previewText?: string;
  /**
   * Resend replaces this placeholder per-recipient when sending a broadcast.
   * For test sends (transactional API), pass a real URL instead since no
   * substitution happens there.
   */
  unsubscribeUrl?: string;
  /**
   * Public archive URL for this issue. Real sends pass it so image-blocking
   * or mangled-rendering readers have an escape hatch; previews and test
   * sends omit it (there's no archive page for an unsent draft).
   */
  viewInBrowserUrl?: string;
}

/**
 * Wraps TipTap-generated HTML in an email-safe, table-based layout with the
 * Aaron Curtis Yoga wordmark (royal/navy accents) and the CAN-SPAM-required
 * unsubscribe link.
 */
export function renderNewsletterHtml({
  contentHtml,
  previewText,
  unsubscribeUrl = "{{{RESEND_UNSUBSCRIBE_URL}}}",
  viewInBrowserUrl,
}: RenderNewsletterHtmlParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<style>
  body { margin: 0; padding: 0; background-color: #ededeb; }
  .content h1, .content h2, .content h3 {
    font-family: Helvetica, Arial, sans-serif;
    color: ${INK};
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 1.25;
    margin: 26px 0 12px;
  }
  .content h1 { font-size: 24px; }
  .content h2 { font-size: 20px; }
  .content h3 { font-size: 16px; letter-spacing: 0.12em; }
  .content p { margin: 0 0 16px; }
  .content ul, .content ol { margin: 0 0 16px; padding-left: 24px; }
  .content li { margin-bottom: 6px; }
  .content blockquote {
    border-left: 4px solid ${ROYAL};
    margin: 18px 0;
    padding: 4px 0 4px 16px;
    color: #52525b;
  }
  .content a { color: ${ROYAL}; font-weight: 600; }
  .content img { max-width: 100%; height: auto; }
  .content hr { border: none; border-top: 2px solid ${INK}; margin: 26px 0; }
</style>
</head>
<body>
${
  previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : ""
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ededeb;">
  <tr>
    <td align="center" style="padding: 24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
${
  viewInBrowserUrl
    ? `        <tr>
          <td style="padding: 0 8px 8px; text-align: right; font-family: Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.4;">
            <a href="${viewInBrowserUrl}" style="color:#71717a; text-decoration: underline;">View in browser</a>
          </td>
        </tr>`
    : ""
}
        <tr>
          <td style="background-color:#ffffff; border-top: 5px solid ${NAVY}; padding: 34px 36px 6px; text-align: center;">
            <a href="${SITE_URL}" style="font-family: Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 600; font-style: italic; letter-spacing: -0.01em; color: ${INK}; text-decoration: none;">
              aaron curtis yoga
            </a>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff; padding: 22px 36px 36px;">
            <div class="content" style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #3f3f46;">
              ${makeImagesEmailSafe(contentHtml)}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 26px 8px 4px; text-align: center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
              <tr>
                <td style="padding: 0 7px;">
                  <a href="${INSTAGRAM_URL}" style="text-decoration: none;">
                    <img src="${SITE_URL}/email/instagram.png" width="28" height="28" alt="Instagram" style="display: block; border: 0; width: 28px; height: 28px;">
                  </a>
                </td>
                <td style="padding: 0 7px;">
                  <a href="${YOUTUBE_URL}" style="text-decoration: none;">
                    <img src="${SITE_URL}/email/youtube.png" width="28" height="28" alt="YouTube" style="display: block; border: 0; width: 28px; height: 28px;">
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 8px 0; text-align: center; font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 2; color: #71717a;">
            You're receiving this email because you signed up at
            <a href="${SITE_URL}" style="color:#71717a;">aaroncurtisyoga.com</a>.
            <br>
            <a href="${unsubscribeUrl}" style="color:#71717a;">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
