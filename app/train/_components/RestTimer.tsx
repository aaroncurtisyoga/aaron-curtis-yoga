"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ANTON, fmtTime } from "./logger-utils";

/**
 * In-page rest countdown, auto-started by committing a strength set. Fixed to
 * the bottom (thumb zone), adjustable ±15s, dismissible. Deliberately no
 * push/sound: web notifications are unreliable in iOS Safari, so it stays
 * glanceable instead. Vibrates at zero where supported (Android).
 */
export default function RestTimer({
  endsAt,
  onDismiss,
  onAdjust,
}: {
  endsAt: number;
  onDismiss: () => void;
  onAdjust: (deltaSec: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.ceil((endsAt - now) / 1000);

  useEffect(() => {
    if (remaining === 0 && typeof navigator !== "undefined") {
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [remaining]);

  useEffect(() => {
    if (remaining <= -5) onDismiss(); // linger a beat at 0:00, then get out of the way
  }, [remaining, onDismiss]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0f1420]/95 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Rest
        </span>
        <span
          className={`${ANTON} min-w-20 text-3xl tabular-nums ${remaining <= 0 ? "text-cta" : "text-neutral-50"}`}
          role="timer"
          aria-live="off"
        >
          {fmtTime(Math.max(0, remaining))}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAdjust(-15)}
            className="min-h-12 rounded-lg border border-white/10 px-3 text-sm font-semibold text-neutral-300 active:bg-white/10"
          >
            −15
          </button>
          <button
            type="button"
            onClick={() => onAdjust(15)}
            className="min-h-12 rounded-lg border border-white/10 px-3 text-sm font-semibold text-neutral-300 active:bg-white/10"
          >
            +15
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss rest timer"
            className="flex h-12 w-12 items-center justify-center rounded-lg text-neutral-500 active:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
