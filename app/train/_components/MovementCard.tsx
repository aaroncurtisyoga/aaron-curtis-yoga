"use client";

import { useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { WeightUnit } from "@prisma/client";
import type { SetEntry } from "@/app/_lib/types/training";
import {
  ANTON,
  setSummary,
  toUnit,
  visibleFields,
  weightStep,
} from "./logger-utils";
import { NumField, Stepper, TimeField, UnitChip } from "./inputs";
import type { LoggedMovementDto } from "./types";

type FieldKey = "weight" | "reps" | "distance" | "time";

const FIELD_LABELS: Record<FieldKey, string> = {
  weight: "Weight",
  reps: "Reps",
  distance: "Meters",
  time: "Time",
};

export default function MovementCard({
  item,
  lastSets,
  onUpdateSets,
  onRemove,
}: {
  item: LoggedMovementDto;
  lastSets?: SetEntry[];
  /** committedEntry is present only when a new set was just committed. */
  onUpdateSets: (
    itemId: string,
    sets: SetEntry[],
    committedEntry?: SetEntry,
  ) => void;
  onRemove: (itemId: string) => void;
}) {
  const fields = visibleFields(item.movement);
  const cols = useMemo(
    () =>
      (["weight", "reps", "distance", "time"] as FieldKey[]).filter(
        (f) => fields[f],
      ),
    [fields],
  );
  const showSteppers = fields.weight && cols.length <= 2;

  const [unit, setUnit] = useState<WeightUnit>(
    (item.sets.at(-1)?.unit as WeightUnit) ??
      (lastSets?.at(-1)?.unit as WeightUnit) ??
      (item.movement.defaultUnit as WeightUnit),
  );
  const [draft, setDraft] = useState<SetEntry>({});
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ghost values: last session's same set index, else the previous row today,
  // else last session's final set. Checking ✓ with untouched fields commits
  // the ghost, so a repeat set costs one tap.
  const ghost: SetEntry | undefined =
    lastSets?.[item.sets.length] ?? item.sets.at(-1) ?? lastSets?.at(-1);

  // Ghost weight is expressed in the card's active unit, so a 40 kg ghost
  // can't one-tap-commit as 40 lb after a unit toggle.
  const ghostWeight =
    ghost?.weight !== undefined && ghost?.weight !== null
      ? toUnit(
          ghost.weight,
          (ghost.unit as WeightUnit) ??
            (item.movement.defaultUnit as WeightUnit),
          unit,
        )
      : undefined;

  const grid = {
    display: "grid",
    gridTemplateColumns: `30px repeat(${cols.length}, minmax(0,1fr)) 52px`,
    gap: "8px",
    alignItems: "center",
  } as const;

  function fieldValue(entry: SetEntry, f: FieldKey): number | undefined {
    if (f === "weight") return entry.weight;
    if (f === "reps") return entry.reps;
    if (f === "distance") return entry.distanceM;
    return entry.timeSec;
  }

  function withField(
    entry: SetEntry,
    f: FieldKey,
    n: number | undefined,
  ): SetEntry {
    const next = { ...entry };
    if (f === "weight") next.weight = n;
    else if (f === "reps") next.reps = n;
    else if (f === "distance") next.distanceM = n;
    else next.timeSec = n;
    return next;
  }

  function commitDraft() {
    const entry: SetEntry = {};
    for (const f of cols) {
      const v =
        f === "weight"
          ? (draft.weight ?? ghostWeight)
          : (fieldValue(draft, f) ??
            (ghost ? fieldValue(ghost, f) : undefined));
      if (v !== undefined) Object.assign(entry, withField({}, f, v));
    }
    // An empty commit is legal on purpose: for "just did it" work (a warm-up
    // circuit, a core block) the ✓ alone logs a done-marker set.
    if (entry.weight !== undefined) entry.unit = unit;
    onUpdateSets(item.id, [...item.sets, entry], entry);
    setDraft({});
  }

  function updateCommitted(idx: number, f: FieldKey, n: number | undefined) {
    const sets = item.sets.map((s, i) => {
      if (i !== idx) return s;
      const next = withField(s, f, n);
      // Editing a weight must stamp a unit or kg movements silently chart
      // 2.2x off later; clearing the weight clears the unit with it.
      if (f === "weight")
        next.unit = n === undefined ? undefined : (s.unit ?? unit);
      return next;
    });
    onUpdateSets(item.id, sets);
  }

  function deleteSet(idx: number) {
    onUpdateSets(
      item.id,
      item.sets.filter((_, i) => i !== idx),
    );
  }

  function stepWeight(dir: 1 | -1) {
    const base = draft.weight ?? ghostWeight ?? 0;
    const next = Math.max(0, base + dir * weightStep(unit));
    setDraft((d) => ({ ...d, weight: next }));
  }

  return (
    <section className="rounded-2xl bg-[#131826] p-3">
      {/* Remove is a two-tap confirm, no dialog */}
      <div className="mb-2 flex items-center gap-2">
        <h2
          className={`${ANTON} flex-1 truncate text-lg uppercase tracking-wide text-neutral-50`}
        >
          {item.movement.name}
        </h2>
        {fields.weight && (
          <UnitChip
            unit={unit}
            onToggle={() => setUnit(unit === "LB" ? "KG" : "LB")}
          />
        )}
        <button
          type="button"
          onClick={() => {
            if (confirmingRemove) {
              onRemove(item.id);
              return;
            }
            setConfirmingRemove(true);
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
            confirmTimer.current = setTimeout(
              () => setConfirmingRemove(false),
              2500,
            );
          }}
          aria-label={
            confirmingRemove
              ? `Confirm removing ${item.movement.name}`
              : `Remove ${item.movement.name}`
          }
          className={
            confirmingRemove
              ? "min-h-11 rounded-lg bg-[#e5484d] px-3 text-sm font-semibold text-white"
              : "flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 active:bg-white/10"
          }
        >
          {confirmingRemove ? "Remove?" : <X className="h-5 w-5" />}
        </button>
      </div>

      <div style={grid} className="mb-1 px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Set
        </span>
        {cols.map((f) => (
          <span
            key={f}
            className="text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
          >
            {f === "weight"
              ? `${FIELD_LABELS[f]} (${unit.toLowerCase()})`
              : FIELD_LABELS[f]}
          </span>
        ))}
        <span />
      </div>

      {/* Committed sets: always live inputs, edits save on blur */}
      {item.sets.map((set, idx) => (
        <div key={idx} style={grid} className="mb-1.5">
          <span
            className={`${ANTON} text-center text-lg text-[#6ba3f5]`}
            aria-label={`Set ${idx + 1}`}
          >
            {idx + 1}
          </span>
          {cols.map((f) =>
            f === "time" ? (
              <TimeField
                key={f}
                valueSec={set.timeSec ?? undefined}
                onCommit={(n) => updateCommitted(idx, f, n)}
                ariaLabel={`Set ${idx + 1} time`}
              />
            ) : (
              <NumField
                key={f}
                value={fieldValue(set, f)}
                decimal={f === "weight"}
                onCommit={(n) => updateCommitted(idx, f, n)}
                ariaLabel={`Set ${idx + 1} ${FIELD_LABELS[f]}`}
              />
            ),
          )}
          <button
            type="button"
            onClick={() => deleteSet(idx)}
            aria-label={`Delete set ${idx + 1}`}
            className="flex h-11 w-full items-center justify-center rounded-lg text-neutral-600 active:bg-white/10 active:text-[#e5484d]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      ))}

      {/* Next set row, ghost-prefilled, one tap to commit */}
      <div
        style={grid}
        className="rounded-xl border border-white/10 bg-black/20 p-1.5"
      >
        <span className={`${ANTON} text-center text-lg text-neutral-400`}>
          {item.sets.length + 1}
        </span>
        {cols.map((f) => {
          if (f === "time") {
            return (
              <TimeField
                key={f}
                valueSec={draft.timeSec}
                ghostSec={ghost?.timeSec ?? undefined}
                onCommit={(n) => setDraft((d) => ({ ...d, timeSec: n }))}
                ariaLabel="Next set time"
              />
            );
          }
          if (f === "weight" && showSteppers) {
            return (
              <div key={f} className="flex items-center gap-1">
                <Stepper
                  label={`-${weightStep(unit)}`}
                  onPress={() => stepWeight(-1)}
                />
                <NumField
                  value={draft.weight}
                  ghost={ghostWeight}
                  decimal
                  onCommit={(n) => setDraft((d) => ({ ...d, weight: n }))}
                  ariaLabel="Next set weight"
                />
                <Stepper
                  label={`+${weightStep(unit)}`}
                  onPress={() => stepWeight(1)}
                />
              </div>
            );
          }
          return (
            <NumField
              key={f}
              value={fieldValue(draft, f)}
              ghost={
                f === "weight"
                  ? ghostWeight
                  : ghost
                    ? fieldValue(ghost, f)
                    : undefined
              }
              decimal={f === "weight"}
              onCommit={(n) => setDraft((d) => withField(d, f, n))}
              ariaLabel={`Next set ${FIELD_LABELS[f]}`}
            />
          );
        })}
        <button
          type="button"
          onClick={commitDraft}
          aria-label="Log set"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-cta text-white shadow-lg active:brightness-90"
        >
          <Check className="h-6 w-6" strokeWidth={3} />
        </button>
      </div>

      {lastSets && lastSets.length > 0 && (
        <p className="mt-2 px-0.5 text-xs text-neutral-500">
          Last time: {lastSets.map((s) => setSummary(s)).join(", ")}
        </p>
      )}
    </section>
  );
}
