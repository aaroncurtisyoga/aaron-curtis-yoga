"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import {
  addMovementToSession,
  attachManualWod,
  createMovement,
  deleteLoggedSession,
  removeLoggedMovement,
  updateLoggedMovement,
  updateLoggedSession,
} from "@/app/_lib/actions/training.actions";
import type {
  BlockResult,
  BlockResults,
  SetEntry,
  UpdateLoggedSessionParams,
} from "@/app/_lib/types/training";
import {
  ACTIVITY_LABELS,
  ANTON,
  fmtDay,
  fmtTime,
  scoredKind,
  ymd,
} from "./logger-utils";
import MovementCard from "./MovementCard";
import MovementPicker from "./MovementPicker";
import PlanCard from "./PlanCard";
import RestTimer from "./RestTimer";
import SessionMeta from "./SessionMeta";
import type {
  LastSetsMap,
  LoggedMovementDto,
  MovementDto,
  PlannedSessionDto,
  SessionDto,
  SessionWithMovementsDto,
} from "./types";

const REST_DEFAULT_MS = 90_000; // the plan's ~90s between strength sets

export default function Logger({
  initial,
}: {
  initial: {
    session: SessionWithMovementsDto;
    movements: MovementDto[];
    lastSets: LastSetsMap;
  };
}) {
  const router = useRouter();
  const [items, setItems] = useState<LoggedMovementDto[]>(
    initial.session.movements,
  );
  const [meta, setMeta] = useState<SessionDto>(initial.session);
  const [library, setLibrary] = useState<MovementDto[]>(initial.movements);
  const [planned, setPlanned] = useState<PlannedSessionDto | null>(
    initial.session.plannedSession ?? null,
  );
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [sync, setSync] = useState<"idle" | "saving" | "error">("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const failedOps = useRef<Map<string, () => Promise<unknown>>>(new Map());

  // Keep the screen on mid-session (Screen Wake Lock; Safari 16.4+).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {
        // Denied or unsupported. The logger still works without it.
      }
    };
    acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  // Optimistic persistence with per-entity write chains: at most one request
  // in flight per entity, and only the newest payload for an entity replays,
  // so a stale snapshot can't overwrite newer data. Session fields accumulate
  // into one patch ref read at send time, so rapid partial edits (RPE then
  // notes) both survive.
  const pendingOps = useRef<Map<string, () => Promise<unknown>>>(new Map());
  const inflightKeys = useRef<Set<string>>(new Set());
  const sessionPatch = useRef<UpdateLoggedSessionParams>({});

  const refreshSync = useCallback(() => {
    if (failedOps.current.size > 0) setSync("error");
    else if (inflightKeys.current.size > 0 || pendingOps.current.size > 0)
      setSync("saving");
    else setSync("idle");
  }, []);

  const drain = useCallback(
    async (key: string) => {
      if (inflightKeys.current.has(key)) return;
      inflightKeys.current.add(key);
      refreshSync();
      while (pendingOps.current.has(key)) {
        const op = pendingOps.current.get(key)!;
        pendingOps.current.delete(key);
        try {
          await op();
        } catch (error) {
          console.error(error);
          // Keep for retry only if nothing newer arrived meanwhile.
          if (!pendingOps.current.has(key)) failedOps.current.set(key, op);
          break;
        }
      }
      inflightKeys.current.delete(key);
      refreshSync();
      if (pendingOps.current.has(key)) void drain(key);
    },
    [refreshSync],
  );

  const persist = useCallback(
    (key: string, op: () => Promise<unknown>) => {
      failedOps.current.delete(key); // newer state supersedes a failed snapshot
      pendingOps.current.set(key, op);
      refreshSync();
      void drain(key);
    },
    [drain, refreshSync],
  );

  const retryFailed = useCallback(() => {
    for (const [key, op] of [...failedOps.current]) {
      failedOps.current.delete(key);
      if (!pendingOps.current.has(key)) pendingOps.current.set(key, op);
      void drain(key);
    }
    refreshSync();
  }, [drain, refreshSync]);

  const queueSessionPatch = useCallback(
    (patch: UpdateLoggedSessionParams) => {
      sessionPatch.current = { ...sessionPatch.current, ...patch };
      persist("session", () =>
        updateLoggedSession(meta.id, { ...sessionPatch.current }),
      );
    },
    [meta.id, persist],
  );

  function handleUpdateSets(
    itemId: string,
    sets: SetEntry[],
    committedEntry?: SetEntry,
  ) {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, sets } : it)),
    );
    persist(`lm:${itemId}`, () => updateLoggedMovement(itemId, { sets }));
    if (committedEntry) {
      const item = items.find((it) => it.id === itemId);
      const unitType = item?.movement.unitType;
      if (unitType === "WEIGHT_REPS" || unitType === "REPS") {
        setRestEndsAt(Date.now() + REST_DEFAULT_MS);
      }
    }
  }

  function handleRemoveMovement(itemId: string) {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    // Same key as set updates: the delete supersedes any pending set write.
    persist(`lm:${itemId}`, () => removeLoggedMovement(itemId));
  }

  async function handlePick(movementId: string) {
    setPickerBusy(true);
    try {
      const created = await addMovementToSession({
        sessionId: meta.id,
        movementId,
      });
      setItems((prev) => [
        ...prev,
        { ...(created as unknown as LoggedMovementDto), sets: [] },
      ]);
      setPickerOpen(false);
    } catch (error) {
      console.error(error);
      setSync("error");
    } finally {
      setPickerBusy(false);
    }
  }

  async function handleCreate(name: string) {
    setPickerBusy(true);
    try {
      const movement = (await createMovement({
        name,
      })) as unknown as MovementDto;
      setLibrary((prev) =>
        prev.some((m) => m.id === movement.id)
          ? prev
          : [...prev, movement].sort((a, b) => a.name.localeCompare(b.name)),
      );
      await handlePick(movement.id);
    } catch (error) {
      console.error(error);
      setSync("error");
      setPickerBusy(false);
    }
  }

  // The plan's headline scored block. Its result mirrors into session.score
  // so history rows and Trends read the same number.
  const scoredIndex = useMemo(() => {
    const items = planned?.blocks?.items ?? [];
    return items.findIndex((item) => scoredKind(item) !== null);
  }, [planned]);

  function applyBlockPatch(index: number, result: BlockResult) {
    const next: BlockResults = {
      ...(meta.blockResults ?? {}),
      [String(index)]: result,
    };
    const metaPatch: UpdateLoggedSessionParams = { blockResults: next };
    if (index === scoredIndex) {
      const item = planned?.blocks?.items?.[index];
      const kind = item ? scoredKind(item) : null;
      if (kind === "time" && result.timeSec !== undefined) {
        metaPatch.score = fmtTime(result.timeSec);
        metaPatch.scoreType = item?.scoreType ?? "FOR_TIME";
      } else if (
        kind === "amrap" &&
        (result.rounds !== undefined || result.reps !== undefined)
      ) {
        metaPatch.score = `${result.rounds ?? 0}+${result.reps ?? 0}`;
        metaPatch.scoreType = "AMRAP";
      }
    }
    setMeta((prev) => ({ ...prev, ...metaPatch }) as typeof prev);
    queueSessionPatch(metaPatch);
  }

  function handleBlockToggle(index: number) {
    const current = meta.blockResults?.[String(index)] ?? {};
    applyBlockPatch(index, { ...current, done: !current.done });
  }

  function handleBlockResult(index: number, patch: BlockResult) {
    const current = meta.blockResults?.[String(index)] ?? {};
    applyBlockPatch(index, { ...current, ...patch });
  }

  function patchMeta(patch: UpdateLoggedSessionParams) {
    setMeta((prev) => ({
      ...prev,
      ...patch,
      ...(patch.date ? { date: `${patch.date}T00:00:00.000Z` } : {}),
    }));
    queueSessionPatch(patch);
  }

  async function handleDeleteSession() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    try {
      await deleteLoggedSession(meta.id);
      router.replace("/train");
    } catch (error) {
      console.error(error);
      setSync("error");
    }
  }

  async function handlePasteSave() {
    if (!pasteText.trim()) return;
    setPasteBusy(true);
    try {
      const plan = (await attachManualWod(
        meta.id,
        pasteText,
      )) as unknown as PlannedSessionDto;
      setPlanned(plan);
      setPasteOpen(false);
    } catch (error) {
      console.error(error);
      setSync("error");
    } finally {
      setPasteBusy(false);
    }
  }

  const isWod =
    meta.activityType === "HYROX" || meta.activityType === "CROSSFIT";

  const garmin = initial.session.garminActivity ?? null;

  const planSection = planned ? (
    <PlanCard
      planned={planned}
      results={meta.blockResults ?? {}}
      onToggle={handleBlockToggle}
      onResult={handleBlockResult}
    />
  ) : meta.activityType === "CROSSFIT" ? (
    pasteOpen ? (
      <section className="rounded-2xl bg-[#131826] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          Paste today&rsquo;s WOD
        </p>
        <textarea
          value={pasteText}
          rows={6}
          autoFocus
          placeholder="Paste the workout text here"
          aria-label="WOD text"
          onChange={(e) => setPasteText(e.currentTarget.value)}
          className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-[16px] text-neutral-50 placeholder:text-neutral-600 focus:border-cta focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pasteBusy || !pasteText.trim()}
            onClick={handlePasteSave}
            className="min-h-12 flex-1 rounded-xl bg-cta font-semibold text-white active:brightness-90 disabled:opacity-50"
          >
            {pasteBusy ? "Saving…" : "Save WOD"}
          </button>
          <button
            type="button"
            onClick={() => setPasteOpen(false)}
            className="min-h-12 rounded-xl px-4 font-semibold text-neutral-400 active:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </section>
    ) : (
      <button
        type="button"
        onClick={() => setPasteOpen(true)}
        className="min-h-12 w-full rounded-2xl border border-dashed border-[#6ba3f5]/40 text-[15px] font-semibold text-[#6ba3f5] active:bg-white/5"
      >
        No WOD loaded. Paste it
      </button>
    )
  ) : null;

  const metaSection = (
    <SessionMeta session={meta} showScore={isWod} onPatch={patchMeta} />
  );

  const movementSection = (
    <>
      {items.map((item) => (
        <MovementCard
          key={item.id}
          item={item}
          lastSets={initial.lastSets[item.movementId]}
          onUpdateSets={handleUpdateSets}
          onRemove={handleRemoveMovement}
        />
      ))}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-[17px] font-semibold text-neutral-300 active:bg-white/5"
      >
        <Plus className="h-5 w-5" /> Add movement
      </button>
    </>
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-3 pb-44">
      {/* Top bar: rare actions live up here, out of the thumb zone */}
      <header className="sticky top-0 z-20 -mx-3 mb-3 flex items-center gap-2 bg-[#0a0e16]/95 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Link
          href="/train"
          aria-label="Back to today"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-300 active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1
            className={`${ANTON} truncate text-xl uppercase tracking-wide text-neutral-50`}
          >
            {ACTIVITY_LABELS[meta.activityType]}
          </h1>
          <label className="relative block w-fit text-xs text-neutral-500">
            {fmtDay(meta.date)}
            <input
              type="date"
              value={ymd(meta.date)}
              onChange={(e) => {
                if (e.currentTarget.value)
                  patchMeta({ date: e.currentTarget.value });
              }}
              aria-label="Session date"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
        {sync === "saving" && (
          <span
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#6ba3f5]"
            aria-label="Saving"
          />
        )}
        {sync === "error" && (
          <button
            type="button"
            onClick={retryFailed}
            className="min-h-11 rounded-lg bg-[#e5484d] px-3 text-sm font-semibold text-white"
          >
            Retry save
          </button>
        )}
        <Link
          href="/train"
          className="min-h-11 shrink-0 rounded-lg bg-cta px-4 py-2.5 text-[15px] font-semibold text-white active:brightness-90"
        >
          Done
        </Link>
      </header>

      <main className="flex flex-col gap-3">
        {planSection}
        {garmin && (
          <section className="rounded-2xl bg-[#131826] p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              From Garmin{garmin.name ? ` · ${garmin.name}` : ""}
            </p>
            <div className="flex gap-2">
              {garmin.distanceM !== null && (
                <div className="flex-1 rounded-xl bg-black/20 p-2.5">
                  <p className={`${ANTON} text-xl text-neutral-50`}>
                    {(garmin.distanceM / 1000).toFixed(2)}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    km
                  </p>
                </div>
              )}
              {garmin.avgPaceSecPerKm !== null && (
                <div className="flex-1 rounded-xl bg-black/20 p-2.5">
                  <p className={`${ANTON} text-xl text-neutral-50`}>
                    {fmtTime(Math.round(garmin.avgPaceSecPerKm))}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    /km
                  </p>
                </div>
              )}
              {garmin.avgHr !== null && (
                <div className="flex-1 rounded-xl bg-black/20 p-2.5">
                  <p className={`${ANTON} text-xl text-neutral-50`}>
                    {garmin.avgHr}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    avg bpm
                  </p>
                </div>
              )}
              {garmin.maxHr !== null && (
                <div className="flex-1 rounded-xl bg-black/20 p-2.5">
                  <p className={`${ANTON} text-xl text-neutral-50`}>
                    {garmin.maxHr}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    max bpm
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
        {isWod ? (
          <>
            {movementSection}
            {metaSection}
          </>
        ) : (
          <>
            {metaSection}
            {movementSection}
          </>
        )}

        <button
          type="button"
          onClick={handleDeleteSession}
          className={
            confirmingDelete
              ? "min-h-12 rounded-xl bg-[#e5484d] font-semibold text-white"
              : "min-h-12 rounded-xl text-sm font-semibold text-neutral-600 active:bg-white/5"
          }
        >
          {confirmingDelete ? "Tap again to delete session" : "Delete session"}
        </button>
      </main>

      {restEndsAt !== null && (
        <RestTimer
          endsAt={restEndsAt}
          onDismiss={() => setRestEndsAt(null)}
          onAdjust={(delta) => setRestEndsAt((e) => (e ?? 0) + delta * 1000)}
        />
      )}

      {pickerOpen && (
        <MovementPicker
          movements={library}
          lastSets={initial.lastSets}
          busy={pickerBusy}
          onPick={handlePick}
          onCreate={handleCreate}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
