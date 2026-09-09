"use client";

import { ReactNode, useState } from "react";
import type { UpdateLoggedSessionParams } from "@/app/_lib/types/training";
import { cn } from "@/app/_lib/utils/index";
import { ANTON, fmtTime, SCORE_TYPES } from "./logger-utils";
import { NumField, TimeField } from "./inputs";
import type { SessionDto } from "./types";

function Chip({
  active,
  children,
  onPress,
  className,
}: {
  active: boolean;
  children: ReactNode;
  onPress: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "min-h-11 rounded-lg border px-3 text-sm font-semibold",
        active
          ? "border-cta bg-cta/15 text-[#6ba3f5]"
          : "border-white/10 text-neutral-400 active:bg-white/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

function parseTimeScore(score: string | null): number | undefined {
  if (!score) return undefined;
  // Accepts m:ss and h:mm:ss — race sims and race day run past the hour.
  const m = score.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function parseAmrap(score: string | null): { rounds?: number; reps?: number } {
  const m = score?.match(/^(\d+)\s*\+\s*(\d+)$/);
  return m ? { rounds: Number(m[1]), reps: Number(m[2]) } : {};
}

/**
 * Session-level fields. Everything optional and blankable — RPE/felt/notes
 * must never cost a tap when skipped (research: mandatory classification taps
 * are the top logging complaint).
 */
export default function SessionMeta({
  session,
  showScore,
  onPatch,
}: {
  session: SessionDto;
  showScore: boolean;
  onPatch: (patch: UpdateLoggedSessionParams) => void;
}) {
  const [notes, setNotes] = useState(session.notes ?? "");
  const amrap = parseAmrap(session.score);

  const scale = (
    label: string,
    value: number | null,
    field: "rpe" | "felt",
  ) => (
    <div className="mb-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label} ${n}`}
            onClick={() => onPatch({ [field]: value === n ? null : n })}
            className={cn(
              "h-10 min-w-0 flex-1 rounded-md text-sm font-semibold",
              value === n
                ? "bg-cta text-white"
                : "bg-white/5 text-neutral-400 active:bg-white/15",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="rounded-2xl bg-[#131826] p-3">
      <h2
        className={`${ANTON} mb-3 text-lg uppercase tracking-wide text-neutral-50`}
      >
        Session
      </h2>

      {showScore && (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Score
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SCORE_TYPES.map((t) => (
              <Chip
                key={t.key}
                active={session.scoreType === t.key}
                onPress={() =>
                  onPatch(
                    session.scoreType === t.key
                      ? { scoreType: null, score: null }
                      : { scoreType: t.key },
                  )
                }
              >
                {t.label}
              </Chip>
            ))}
          </div>
          {session.scoreType === "FOR_TIME" && (
            <TimeField
              valueSec={parseTimeScore(session.score)}
              onCommit={(sec) =>
                onPatch({ score: sec === undefined ? null : fmtTime(sec) })
              }
              ariaLabel="Finish time"
              className="w-40 text-2xl"
            />
          )}
          {session.scoreType === "AMRAP" && (
            <div className="flex items-center gap-2">
              <NumField
                value={amrap.rounds}
                onCommit={(n) =>
                  onPatch({ score: `${n ?? 0}+${amrap.reps ?? 0}` })
                }
                ariaLabel="Rounds"
                className="w-24 shrink-0"
              />
              <span className="text-neutral-500">rounds +</span>
              <NumField
                value={amrap.reps}
                onCommit={(n) =>
                  onPatch({ score: `${amrap.rounds ?? 0}+${n ?? 0}` })
                }
                ariaLabel="Extra reps"
                className="w-24 shrink-0"
              />
            </div>
          )}
          {(session.scoreType === "LOAD" || session.scoreType === "REPS") && (
            <input
              type="text"
              defaultValue={session.score ?? ""}
              placeholder={session.scoreType === "LOAD" ? "225 lb" : "120"}
              aria-label="Score"
              onBlur={(e) => onPatch({ score: e.currentTarget.value || null })}
              className="w-full max-w-40 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-[19px] font-semibold text-neutral-50 placeholder:text-neutral-600 focus:border-cta focus:outline-none"
            />
          )}
        </div>
      )}

      <div className="mb-4">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Duration (min)
        </p>
        <div className="flex items-center gap-1.5">
          {[30, 45, 60, 75, 90].map((n) => (
            <Chip
              key={n}
              active={session.durationMin === n}
              onPress={() =>
                onPatch({ durationMin: session.durationMin === n ? null : n })
              }
              className="flex-1 px-0"
            >
              {n}
            </Chip>
          ))}
          <NumField
            value={session.durationMin ?? undefined}
            onCommit={(n) => onPatch({ durationMin: n ?? null })}
            ariaLabel="Duration in minutes"
            className="w-16 shrink-0"
          />
        </div>
      </div>

      {scale("Effort (RPE)", session.rpe, "rpe")}
      {scale("Felt", session.felt, "felt")}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Notes
        </p>
        <textarea
          value={notes}
          rows={3}
          placeholder="Anything worth remembering next time"
          aria-label="Session notes"
          onChange={(e) => setNotes(e.currentTarget.value)}
          onBlur={() => onPatch({ notes: notes || null })}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-[16px] text-neutral-50 placeholder:text-neutral-600 focus:border-cta focus:outline-none"
        />
      </div>
    </section>
  );
}
