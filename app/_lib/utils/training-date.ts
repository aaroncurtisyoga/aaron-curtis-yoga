/**
 * Calendar-day helpers for the training tracker's @db.Date columns.
 *
 * Prisma maps a Postgres DATE to a JS Date at UTC midnight, so a "day" is
 * encoded as `YYYY-MM-DDT00:00:00.000Z`. The training day itself follows the
 * site-wide America/New_York convention.
 */

/** Today's date in ET, as a UTC-midnight Date for @db.Date columns. */
export function etToday(): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Parse a YYYY-MM-DD string into the UTC-midnight Date Prisma expects. */
export function dateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Format a @db.Date value (or its serialized ISO string) back to YYYY-MM-DD. */
export function ymdFromDate(date: Date | string): string {
  return (typeof date === "string" ? date : date.toISOString()).slice(0, 10);
}
