"use client";

import { useState } from "react";
import { Check, ChevronDown, Timer } from "lucide-react";
import type {
  BlockResult,
  BlockResults,
  SplitEntry,
} from "@/app/_lib/types/training";
import { cn } from "@/app/_lib/utils/index";
import {
  ANTON,
  fmtTime,
  raceSegments,
  roxzoneTotal,
  runFade,
  scoredKind,
} from "./logger-utils";
import { NumField, TimeField } from "./inputs";
import SplitLogger from "./SplitLogger";
import type { PlannedSessionDto } from "./types";

export function SplitsSummary({ splits }: { splits: SplitEntry[] }) {
  const runs = splits.filter((s) => /^Run \d+$/.test(s.label));
  const stations = splits.filter(
    (s) => !/^Run \d+$/.test(s.label) && s.label !== "Roxzone",
  );
  const rox = roxzoneTotal(splits);
  const fade = runFade(splits);
  return (
    <div className="mt-2 rounded-xl bg-black/20 p-2.5 text-xs leading-relaxed">
      <p className="text-neutral-300">
        <span className="font-semibold text-neutral-500">Runs </span>
        {runs.map((s) => fmtTime(s.sec)).join(" · ")}
        {fade !== null && (
          <span
            className={
              fade > 10
                ? "text-[#e5484d]"
                : fade > 5
                  ? "text-amber-400"
                  : "text-[#6ba3f5]"
            }
          >
            {"  "}({fade > 0 ? "+" : ""}
            {fade}% fade)
          </span>
        )}
      </p>
      <p className="mt-1 text-neutral-300">
        <span className="font-semibold text-neutral-500">Stations </span>
        {stations.map((s) => `${s.label} ${fmtTime(s.sec)}`).join(" · ")}
      </p>
      {rox > 0 && (
        <p className="mt-1 text-neutral-300">
          <span className="font-semibold text-neutral-500">Roxzone </span>
          {fmtTime(rox)} total ·{" "}
          {fmtTime(
            Math.round(
              rox /
                Math.max(1, splits.filter((s) => s.label === "Roxzone").length),
            ),
          )}{" "}
          avg (elite ~0:28)
        </p>
      )}
    </div>
  );
}

const SOURCE_LABELS: Record<PlannedSessionDto["source"], string> = {
  AUTHORED: "Hyrox plan",
  PUSHPRESS: "CrossFit DC",
  MANUAL: "Pasted",
};

/**
 * The plan doubles as the logging surface: each block has its own check
 * button, and scored blocks take their result inline under the prescription.
 */
export default function PlanCard({
  planned,
  results,
  onToggle,
  onResult,
}: {
  planned: PlannedSessionDto;
  results: BlockResults;
  onToggle: (index: number) => void;
  onResult: (index: number, patch: BlockResult) => void;
}) {
  const [open, setOpen] = useState(true);
  const [splittingIndex, setSplittingIndex] = useState<number | null>(null);
  const items = planned.blocks?.items ?? [];
  const durationMin = planned.blocks?.durationMin;
  const week = planned.blocks?.week;
  const phase = planned.blocks?.phase;
  const doneCount = items.filter((_, i) => results[String(i)]?.done).length;

  return (
    <section className="rounded-2xl border border-[#6ba3f5]/25 bg-[#10182b]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
      >
        <div className="min-w-0 flex-1 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6ba3f5]">
            {SOURCE_LABELS[planned.source]}
            {week ? ` · Wk ${week}` : ""}
            {phase && phase !== "RACE" ? ` ${phase}` : ""}
            {durationMin ? ` · ~${durationMin} min` : ""}
          </p>
          <h2
            className={`${ANTON} truncate text-lg uppercase tracking-wide text-neutral-50`}
          >
            {planned.title}
          </h2>
        </div>
        {items.length > 0 && (
          <span
            className={cn(
              "shrink-0 text-sm font-semibold",
              doneCount === items.length ? "text-cta" : "text-neutral-500",
            )}
          >
            {doneCount}/{items.length}
          </span>
        )}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-white/10 px-3 pb-3">
          {planned.blocks?.note && (
            <p className="px-1 pt-3 text-sm text-neutral-300">
              {planned.blocks.note}
            </p>
          )}

          {items.map((item, i) => {
            const result = results[String(i)] ?? {};
            const kind = scoredKind(item);
            return (
              <div
                key={i}
                className={cn(
                  "mt-2 flex gap-3 rounded-xl p-2",
                  result.done && "bg-cta/5",
                )}
              >
                <button
                  type="button"
                  onClick={() => onToggle(i)}
                  aria-label={
                    result.done
                      ? `Mark ${item.label} not done`
                      : `Mark ${item.label} done`
                  }
                  className={cn(
                    "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                    result.done
                      ? "border-cta bg-cta text-white"
                      : "border-white/15 text-neutral-600 active:bg-white/10",
                  )}
                >
                  <Check className="h-5 w-5" strokeWidth={3} />
                </button>

                <div
                  className={cn("min-w-0 flex-1", result.done && "opacity-60")}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6ba3f5]">
                    {item.label}
                    {item.minutes ? (
                      <span className="text-neutral-500">
                        {" "}
                        · {item.minutes} min
                      </span>
                    ) : null}
                    {item.scoreType ? (
                      <span className="text-neutral-500">
                        {" "}
                        · {item.scoreType.replace(/_/g, " ").toLowerCase()}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                    {item.text}
                  </p>

                  {kind === "time" && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Time
                      </span>
                      <TimeField
                        valueSec={result.timeSec}
                        onCommit={(sec) =>
                          onResult(i, {
                            timeSec: sec,
                            done: sec !== undefined ? true : result.done,
                          })
                        }
                        ariaLabel={`${item.label} time`}
                        className="w-28"
                      />
                      {raceSegments(item) && (
                        <button
                          type="button"
                          onClick={() => setSplittingIndex(i)}
                          className="flex min-h-11 items-center gap-1.5 rounded-lg border border-[#6ba3f5]/40 px-3 text-sm font-semibold text-[#6ba3f5] active:bg-white/10"
                        >
                          <Timer className="h-4 w-4" />
                          {result.splits?.length ? "Redo splits" : "Splits"}
                        </button>
                      )}
                    </div>
                  )}
                  {kind === "time" &&
                    result.splits &&
                    result.splits.length > 0 && (
                      <SplitsSummary splits={result.splits} />
                    )}
                  {kind === "amrap" && (
                    <div className="mt-2 flex items-center gap-2">
                      <NumField
                        value={result.rounds}
                        onCommit={(n) =>
                          onResult(i, {
                            rounds: n,
                            done: n !== undefined ? true : result.done,
                          })
                        }
                        ariaLabel={`${item.label} rounds`}
                        className="w-20 shrink-0"
                      />
                      <span className="text-sm text-neutral-500">rounds +</span>
                      <NumField
                        value={result.reps}
                        onCommit={(n) =>
                          onResult(i, {
                            reps: n,
                            done: n !== undefined ? true : result.done,
                          })
                        }
                        ariaLabel={`${item.label} extra reps`}
                        className="w-20 shrink-0"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {items.length === 0 && planned.rawText && (
            <p className="px-1 pt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
              {planned.rawText}
            </p>
          )}
        </div>
      )}

      {splittingIndex !== null && items[splittingIndex] && (
        <SplitLogger
          title={items[splittingIndex].label}
          segments={raceSegments(items[splittingIndex]) ?? []}
          onCancel={() => setSplittingIndex(null)}
          onFinish={(splits, totalSec) => {
            onResult(splittingIndex, { splits, timeSec: totalSec, done: true });
            setSplittingIndex(null);
          }}
        />
      )}
    </section>
  );
}
