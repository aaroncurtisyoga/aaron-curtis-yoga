"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import type { MovementCategory } from "@prisma/client";
import { ANTON, setSummary } from "./logger-utils";
import type { LastSetsMap, MovementDto } from "./types";

const CATEGORY_ORDER: MovementCategory[] = [
  "BARBELL",
  "DUMBBELL",
  "MACHINE",
  "GYMNASTIC",
  "STATION",
  "CARRY",
  "CORE",
  "OTHER",
];

const CATEGORY_LABELS: Record<MovementCategory, string> = {
  BARBELL: "Barbell",
  DUMBBELL: "Dumbbell",
  MACHINE: "Machines",
  GYMNASTIC: "Bodyweight",
  STATION: "Stations",
  CARRY: "Carries",
  CORE: "Core",
  OTHER: "Other",
};

export default function MovementPicker({
  movements,
  lastSets,
  busy,
  onPick,
  onCreate,
  onClose,
}: {
  movements: MovementDto[];
  lastSets: LastSetsMap;
  busy: boolean;
  onPick: (movementId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter((m) => m.name.toLowerCase().includes(q));
  }, [movements, query]);

  const grouped = useMemo(() => {
    const map = new Map<MovementCategory, MovementDto[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const m of filtered) map.get(m.category as MovementCategory)?.push(m);
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: map.get(cat) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  const exactMatch = movements.some(
    (m) => m.name.toLowerCase() === query.trim().toLowerCase(),
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0a0e16]">
      <div className="flex items-center gap-2 border-b border-white/10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close movement picker"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-300 active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search or add a movement"
          aria-label="Search movements"
          className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 text-[17px] text-neutral-50 placeholder:text-neutral-500 focus:border-cta focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {query.trim() && !exactMatch && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCreate(query.trim())}
            className="mb-3 flex min-h-14 w-full items-center gap-3 rounded-xl border border-dashed border-cta/60 px-4 text-left text-[17px] font-semibold text-[#6ba3f5] active:bg-white/5 disabled:opacity-50"
          >
            <Plus className="h-5 w-5 shrink-0" />
            {busy ? "Adding…" : `Add “${query.trim()}”`}
          </button>
        )}

        {grouped.map(({ cat, items }) => (
          <div key={cat} className="mb-4">
            <h3
              className={`${ANTON} mb-1.5 px-1 text-sm uppercase tracking-wider text-neutral-500`}
            >
              {CATEGORY_LABELS[cat]}
            </h3>
            {items.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => onPick(m.id)}
                className="mb-1 flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-[#131826] px-4 text-left active:bg-[#1a2136] disabled:opacity-50"
              >
                <span className="text-[17px] font-semibold text-neutral-50">
                  {m.name}
                </span>
                {lastSets[m.id] && (
                  <span className="shrink-0 text-xs text-neutral-500">
                    {setSummary(lastSets[m.id][lastSets[m.id].length - 1])}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}

        {filtered.length === 0 && !query.trim() && (
          <p className="p-4 text-center text-neutral-500">
            No movements yet. Search to add one.
          </p>
        )}
      </div>
    </div>
  );
}
