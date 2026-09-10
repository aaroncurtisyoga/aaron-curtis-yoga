"use client";

import { useEffect, useRef, useState } from "react";
import { Undo2, X } from "lucide-react";
import type { SplitEntry } from "@/app/_lib/types/training";
import { ANTON, fmtTime } from "./logger-utils";

/**
 * Full-screen lap logger for race-order blocks: one giant tap cycles
 * Run 1 → Roxzone → Station → Roxzone → Run 2 … writing every segment's
 * time. Undo last lap steps back one segment.
 */
export default function SplitLogger({
  title,
  segments,
  onFinish,
  onCancel,
}: {
  title: string;
  segments: string[];
  onFinish: (splits: SplitEntry[], totalSec: number) => void;
  onCancel: () => void;
}) {
  const [startTs, setStartTs] = useState<number | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [confirmingExit, setConfirmingExit] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const currentIndex = taps.length;
  const running = startTs !== null;
  const segmentStart = taps[taps.length - 1] ?? startTs ?? now;

  function tap() {
    if (finished.current) return;
    if (!running) {
      setStartTs(Date.now());
      return;
    }
    const nextTaps = [...taps, Date.now()];
    if (nextTaps.length >= segments.length) {
      finished.current = true;
      const splits: SplitEntry[] = segments.map((label, i) => ({
        label,
        sec: Math.round(
          ((nextTaps[i] ?? 0) - (i === 0 ? startTs! : nextTaps[i - 1])) / 1000,
        ),
      }));
      const totalSec = Math.round(
        (nextTaps[nextTaps.length - 1] - startTs!) / 1000,
      );
      onFinish(splits, totalSec);
      return;
    }
    setTaps(nextTaps);
  }

  function undo() {
    if (taps.length > 0) setTaps(taps.slice(0, -1));
    else setStartTs(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0e16]">
      <div className="flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6ba3f5]">
            Splits · {title}
          </p>
          <p className={`${ANTON} text-3xl tabular-nums text-neutral-50`}>
            {running ? fmtTime((now - startTs!) / 1000) : "0:00"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirmingExit) onCancel();
            else {
              setConfirmingExit(true);
              setTimeout(() => setConfirmingExit(false), 2500);
            }
          }}
          aria-label={
            confirmingExit
              ? "Confirm exit, splits discarded"
              : "Exit split mode"
          }
          className={
            confirmingExit
              ? "min-h-11 rounded-lg bg-[#e5484d] px-3 text-sm font-semibold text-white"
              : "flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 active:bg-white/10"
          }
        >
          {confirmingExit ? "Discard?" : <X className="h-5 w-5" />}
        </button>
      </div>

      {/* Current segment */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          {running
            ? `Segment ${currentIndex + 1} of ${segments.length}`
            : "Ready"}
        </p>
        <p
          className={`${ANTON} mt-1 text-4xl uppercase tracking-wide text-neutral-50`}
        >
          {segments[currentIndex] ?? segments[segments.length - 1]}
        </p>
        {running && (
          <p className={`${ANTON} mt-2 text-6xl tabular-nums text-[#6ba3f5]`}>
            {fmtTime((now - segmentStart) / 1000)}
          </p>
        )}
        {/* Last few completed segments, most recent first */}
        <div className="mt-4 space-y-0.5 text-sm text-neutral-500">
          {taps
            .slice(-3)
            .map((t, i, arr) => {
              const idx = taps.length - arr.length + i;
              const prev = idx === 0 ? startTs! : taps[idx - 1];
              return (
                <p key={idx}>
                  {segments[idx]} · {fmtTime((t - prev) / 1000)}
                </p>
              );
            })
            .reverse()}
        </div>
      </div>

      {/* Lap pad, in the thumb zone */}
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {running && (
          <button
            type="button"
            onClick={undo}
            className="mb-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-sm font-semibold text-neutral-400 active:bg-white/10"
          >
            <Undo2 className="h-4 w-4" /> Undo last lap
          </button>
        )}
        <button
          type="button"
          onClick={tap}
          className={`${ANTON} flex min-h-40 w-full items-center justify-center rounded-3xl text-3xl uppercase tracking-wide text-white shadow-2xl active:brightness-90 ${
            !running
              ? "bg-cta"
              : currentIndex === segments.length - 1
                ? "bg-[#e5484d]"
                : "bg-cta"
          }`}
        >
          {!running
            ? "Start"
            : currentIndex === segments.length - 1
              ? "Finish"
              : `Lap → ${segments[currentIndex + 1]}`}
        </button>
      </div>
    </div>
  );
}
