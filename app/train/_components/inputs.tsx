"use client";

import { useState } from "react";
import { WeightUnit } from "@prisma/client";
import { cn } from "@/app/_lib/utils/index";
import { fmtDigits, secondsToDigits } from "./logger-utils";

/**
 * Numeric field per the mobile-web research: type="text" + inputmode (not
 * type="number"), ≥16px font so iOS never zooms, select-on-focus so typing
 * replaces, parse both "." and "," and clamp on blur.
 */
export function NumField({
  value,
  ghost,
  onCommit,
  decimal = false,
  className,
  ariaLabel,
}: {
  value: number | undefined;
  ghost?: number;
  onCommit: (n: number | undefined) => void;
  decimal?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));

  // Resync while rendering when the value changes underneath us: a stepper tap,
  // a deleted set shifting the index-keyed rows up, a fresh load. An effect
  // would land this a commit late and paint one frame of the old number.
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setText(value === undefined ? "" : String(value));
  }

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      pattern={decimal ? undefined : "[0-9]*"}
      autoComplete="off"
      enterKeyHint="done"
      aria-label={ariaLabel}
      value={text}
      placeholder={ghost !== undefined ? String(ghost) : undefined}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setText(e.currentTarget.value)}
      onBlur={() => {
        const raw = text.replace(",", ".").trim();
        if (raw === "") {
          // Only a real clear commits — merely focusing and leaving an empty
          // field must not delete stored data.
          if (value !== undefined) onCommit(undefined);
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) {
          const rounded = decimal ? Math.round(n * 100) / 100 : Math.round(n);
          setText(String(rounded));
          if (rounded !== value) onCommit(rounded);
        } else {
          // Revert to last good value rather than blocking keystrokes.
          setText(value === undefined ? "" : String(value));
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={cn(
        "w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2.5 text-center text-[19px] font-semibold text-neutral-50 placeholder:text-[#5d7db0] focus:border-cta focus:outline-none",
        className,
      )}
    />
  );
}

/**
 * mm:ss field with a digit mask: typing 1432 renders 14:32, numeric keypad
 * only (a colon key would force the full keyboard).
 */
export function TimeField({
  valueSec,
  ghostSec,
  onCommit,
  className,
  ariaLabel,
}: {
  valueSec: number | undefined;
  ghostSec?: number;
  onCommit: (sec: number | undefined) => void;
  className?: string;
  ariaLabel: string;
}) {
  const [digits, setDigits] = useState(secondsToDigits(valueSec));

  const [lastValueSec, setLastValueSec] = useState(valueSec);
  if (lastValueSec !== valueSec) {
    setLastValueSec(valueSec);
    setDigits(secondsToDigits(valueSec));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9:]*"
      autoComplete="off"
      enterKeyHint="done"
      aria-label={ariaLabel}
      value={fmtDigits(digits)}
      placeholder={
        ghostSec !== undefined ? fmtDigits(secondsToDigits(ghostSec)) : "0:00"
      }
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDigits(e.currentTarget.value.replace(/\D/g, ""))}
      onBlur={() => {
        const d = digits.replace(/\D/g, "");
        if (!d) {
          if (valueSec !== undefined) onCommit(undefined);
          return;
        }
        const sec = Number(d.slice(-2)) + Number(d.slice(0, -2) || 0) * 60;
        if (sec !== valueSec) onCommit(sec);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={cn(
        "w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2.5 text-center text-[19px] font-semibold text-neutral-50 placeholder:text-[#5d7db0] focus:border-cta focus:outline-none",
        className,
      )}
    />
  );
}

/** Tappable lb/kg suffix chip — toggles the entry unit for one movement. */
export function UnitChip({
  unit,
  onToggle,
}: {
  unit: WeightUnit;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Unit: ${unit.toLowerCase()}. Tap to switch.`}
      className="min-h-11 shrink-0 rounded-lg border border-white/10 px-2.5 text-sm font-semibold uppercase text-[#6ba3f5] active:bg-white/10"
    >
      {unit.toLowerCase()}
    </button>
  );
}

/** Big square stepper button — the sweaty-hands alternative to the keyboard. */
export function Stepper({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="flex h-12 w-11 shrink-0 select-none items-center justify-center rounded-lg border border-white/10 text-xl font-semibold text-neutral-300 active:bg-white/10"
    >
      {label.startsWith("-") ? "−" : "+"}
    </button>
  );
}
