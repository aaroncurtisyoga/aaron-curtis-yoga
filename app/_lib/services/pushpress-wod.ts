/**
 * CrossFit DC's daily WOD via PushPress Train's public widget API, the same
 * unauthenticated endpoint the "Workout" button on crossfitdc.com calls. The
 * tenant id is public (it sits in the site's HTML). One fetch per tap, result
 * cached in PlannedSession, manual paste as the fallback if this ever breaks.
 */

const TENANT_ID = "F7E1D1BE-9B7F-457F-A9E0-9C9DBD273EE9";
const BASE_URL = "https://trainapi.pushpress.com/workout/workoutOfDay/v1";

type PushPressPart = {
  workoutPartUid?: string;
  title?: string;
  workoutTitle?: string;
  description?: string;
  scoreType?: string;
  athletesNotes?: string;
  coachesNotes?: string;
};

type PushPressWod = {
  id: string;
  title?: string;
  workoutState?: string;
  athletesNotes?: string;
  partDtos?: PushPressPart[];
};

export type FetchedWod = {
  sourceId: string;
  title: string;
  rawText: string | null;
  blocks: {
    items: {
      label: string;
      text: string;
      scoreType: string | null;
      minutes: null;
    }[];
  };
};

/** date is YYYY-MM-DD. Returns null on any failure; callers degrade to paste. */
export async function fetchCrossfitWod(
  date: string,
): Promise<FetchedWod | null> {
  try {
    const [y, m, d] = date.split("-");
    const params = new URLSearchParams({
      date: `${m}/${d}/${y}`, // the API wants MM/DD/YYYY
      tenantId: TENANT_ID,
    });
    const res = await fetch(`${BASE_URL}?${params}`, {
      // 415s without this even on GET.
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PushPressWod[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const wod = data.find((w) => w.workoutState === "PUBLISHED") ?? data[0];
    // A missing id would make sourceId the literal "undefined" and collide
    // across days in the upsert.
    if (!wod.id) return null;
    const parts = wod.partDtos ?? [];
    if (parts.length === 0) return null;

    return {
      sourceId: String(wod.id),
      title: (wod.title ?? "CrossFit").trim() || "CrossFit",
      rawText: wod.athletesNotes?.trim() || null,
      blocks: {
        items: parts.map((p) => ({
          label: (p.title || p.workoutTitle || "Workout").trim(),
          text: [
            p.title && p.workoutTitle ? p.workoutTitle : null,
            p.description,
            p.athletesNotes ? `\nNotes:\n${p.athletesNotes}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          scoreType:
            p.scoreType && p.scoreType !== "NO_SCORE" ? p.scoreType : null,
          minutes: null,
        })),
      },
    };
  } catch (error) {
    console.error("PushPress WOD fetch failed:", error);
    return null;
  }
}
