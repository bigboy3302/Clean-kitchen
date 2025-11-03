"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useWorkoutFilters } from "@/hooks/useWorkoutFilters";
import { useWorkoutSearch } from "@/hooks/useWorkoutSearch";
import { useSavedWorkouts } from "@/hooks/useSavedWorkouts";
import type {
  SavedWorkoutRecord,
  SavedWorkoutVisibility,
  WorkoutContent,
  WorkoutSearchFilters,
} from "@/lib/workouts/types";
import { addExerciseToToday } from "@/lib/fitness/store";

type Props = {
  searchTerm: string;
};

type ViewKey = "explore" | "saved" | "community";

type DisplayWorkout = {
  workout: WorkoutContent;
  saved?: SavedWorkoutRecord | null;
  community?: SavedWorkoutRecord | null;
};

const VIEW_TABS: { key: ViewKey; label: string }[] = [
  { key: "explore", label: "Explore" },
  { key: "saved", label: "My Saved" },
  { key: "community", label: "Community" },
];

const DEFAULT_FILTERS: WorkoutSearchFilters = {
  q: "",
  bodyPart: "",
  target: "",
  equipment: "",
};

export default function WorkoutGrid({ searchTerm }: Props) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewKey>("explore");
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const mergedFilters = useMemo<WorkoutSearchFilters>(
    () => ({ ...filters, q: searchTerm }),
    [filters, searchTerm]
  );

  const { bodyParts, equipment, targets } = useWorkoutFilters();
  const { items, loading, error, hasMore, loadMore } = useWorkoutSearch(mergedFilters, { limit: 12 });
  const savedMine = useSavedWorkouts("me");
  const savedCommunity = useSavedWorkouts("public");

  const savedMap = useMemo(() => {
    const map = new Map<string, SavedWorkoutRecord>();
    for (const record of savedMine.items) {
      map.set(record.workout.id, record);
    }
    return map;
  }, [savedMine.items]);

  const exploreList: DisplayWorkout[] = useMemo(
    () => items.map((workout) => ({ workout, saved: savedMap.get(workout.id) || null, community: null })),
    [items, savedMap]
  );

  const savedList: DisplayWorkout[] = useMemo(
    () => savedMine.items.map((record) => ({ workout: record.workout, saved: record, community: null })),
    [savedMine.items]
  );

  const communityList: DisplayWorkout[] = useMemo(
    () =>
      savedCommunity.items.map((record) => ({
        workout: record.workout,
        saved: savedMap.get(record.workout.id) || null,
        community: record,
      })),
    [savedCommunity.items, savedMap]
  );

  const activeList = view === "explore" ? exploreList : view === "saved" ? savedList : communityList;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const updateFilter = (field: keyof WorkoutSearchFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const handleSave = useCallback(
    async (workout: WorkoutContent, visibility: SavedWorkoutVisibility, existing?: SavedWorkoutRecord | null) => {
      try {
        setBusyId(workout.id + visibility);
        const payload = existing
          ? { id: existing.id, visibility, workout }
          : { visibility, workout };
        const saved = await savedMine.save(payload);
        setToast(`Saved “${workout.title}” (${saved.visibility})`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save workout";
        setToast(message === "AUTH_REQUIRED" ? "Sign in to save workouts." : message);
      } finally {
        setBusyId(null);
      }
    },
    [savedMine]
  );

  const handleDelete = useCallback(
    async (record: SavedWorkoutRecord) => {
      try {
        setBusyId(record.id);
        await savedMine.destroy(record.id);
        setToast(`Removed “${record.workout.title}” from saved`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete";
        setToast(message === "AUTH_REQUIRED" ? "Sign in to manage saved workouts." : message);
      } finally {
        setBusyId(null);
      }
    },
    [savedMine]
  );

  const [detail, setDetail] = useState<DisplayWorkout | null>(null);

  const onAddToToday = useCallback(async (workout: WorkoutContent) => {
    try {
      await addExerciseToToday({
        id: workout.id,
        name: workout.title,
        bodyPart: workout.bodyPart || undefined,
        target: workout.target || undefined,
        equipment: workout.equipment || undefined,
        gifUrl: workout.mediaUrl || undefined,
        descriptionHtml: workout.instructionsHtml ?? undefined,
      });
      setToast(`Added “${workout.title}” to Today`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add to planner";
      setToast(message);
    }
  }, []);

  const emptyStateMessage = useMemo(() => {
    if (view === "saved") {
      if (savedMine.loading) return "Loading saved workouts…";
      if (savedMine.items.length === 0) return "You haven’t saved any workouts yet.";
    }
    if (view === "community") {
      if (savedCommunity.loading) return "Loading community workouts…";
      if (savedCommunity.items.length === 0) return "No public workouts yet — be the first to share.";
    }
    if (view === "explore") {
      if (loading) return "Loading workouts…";
      if (error) return error;
      return "No workouts matched your filters. Try adjusting your search.";
    }
    return "No workouts to show.";
  }, [view, savedMine.loading, savedMine.items.length, savedCommunity.loading, savedCommunity.items.length, loading, error]);

  return (
    <section className="workoutSection">
      <header className="sectionHead">
        <div className="tabs" role="tablist" aria-label="Workout views">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={view === tab.key}
              className={clsx("tab", view === tab.key && "on")}
              onClick={() => setView(tab.key)}
            >
              {tab.label}
              {tab.key === "saved" && savedMine.items.length ? (
                <span className="badge">{savedMine.items.length}</span>
              ) : null}
            </button>
          ))}
        </div>

        {view === "explore" ? (
          <div className="filters">
            <FilterSelect
              label="Body part"
              options={bodyParts}
              value={filters.bodyPart || ""}
              onChange={(value) => updateFilter("bodyPart", value)}
            />
            <FilterSelect
              label="Target"
              options={targets}
              value={filters.target || ""}
              onChange={(value) => updateFilter("target", value)}
            />
            <FilterSelect
              label="Equipment"
              options={equipment}
              value={filters.equipment || ""}
              onChange={(value) => updateFilter("equipment", value)}
            />
            <button type="button" className="reset" onClick={clearFilters}>
              Reset
            </button>
          </div>
        ) : null}
      </header>

      <div className={clsx("grid", view)}>
        {activeList.map(({ workout, saved, community }) => (
          <WorkoutCard
            key={`${view}-${workout.id}-${saved?.id ?? community?.id ?? "base"}`}
            workout={workout}
            saved={saved}
            community={community}
            view={view}
            busyId={busyId}
            onOpen={() => setDetail({ workout, saved, community })}
            onSave={(visibility) => handleSave(workout, visibility, saved)}
            onDelete={saved ? () => handleDelete(saved) : undefined}
          />
        ))}

        {loading && view === "explore" && activeList.length === 0 ? <SkeletonCards /> : null}
      </div>

      {!loading && activeList.length === 0 ? (
        <div className="empty">
          <p>{emptyStateMessage}</p>
        </div>
      ) : null}

      {view === "explore" && hasMore ? (
        <div className="loadMore">
          <button type="button" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      {detail ? (
        <DetailDialog
          item={detail}
          onClose={() => setDetail(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onAddToToday={onAddToToday}
          busyId={busyId}
        />
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}

      <style jsx>{`
        .workoutSection {
          display: grid;
          gap: 20px;
        }
        .sectionHead {
          display: grid;
          gap: 14px;
        }
        .tabs {
          display: inline-flex;
          gap: 10px;
          background: color-mix(in oklab, var(--bg2) 90%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 82%, transparent);
          padding: 6px;
          border-radius: 999px;
          width: fit-content;
        }
        .tab {
          border: 0;
          background: transparent;
          color: var(--muted);
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 999px;
          cursor: pointer;
          transition: background .15s ease, color .15s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .tab.on {
          background: var(--primary);
          color: var(--primary-contrast);
          box-shadow: 0 16px 40px color-mix(in oklab, var(--primary) 40%, transparent);
        }
        .badge {
          background: color-mix(in oklab, var(--primary-contrast) 15%, transparent);
          color: inherit;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 600;
        }
        .filters {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          align-items: end;
        }
        .reset {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: transparent;
          color: var(--text);
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .grid {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }
        @media (max-width: 640px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
        .empty {
          border: 1px dashed color-mix(in oklab, var(--border) 75%, transparent);
          border-radius: 18px;
          padding: 32px;
          text-align: center;
          color: var(--muted);
        }
        .loadMore {
          display: flex;
          justify-content: center;
        }
        .loadMore button {
          border-radius: 999px;
          background: var(--primary);
          color: var(--primary-contrast);
          border: 0;
          font-weight: 700;
          padding: 12px 24px;
          cursor: pointer;
        }
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px 18px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.28);
          z-index: 1200;
          color: var(--text);
        }
      `}</style>
    </section>
  );
}

type FilterSelectProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

function FilterSelect({ label, options, value, onChange }: FilterSelectProps) {
  return (
    <label className="filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {titleCase(option)}
          </option>
        ))}
      </select>
      <style jsx>{`
        .filter {
          display: grid;
          gap: 6px;
        }
        span {
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }
        select {
          appearance: none;
          border-radius: 12px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: var(--bg2);
          color: var(--text);
          padding: 10px 12px;
        }
      `}</style>
    </label>
  );
}

type CardProps = {
  workout: WorkoutContent;
  saved?: SavedWorkoutRecord | null;
  community?: SavedWorkoutRecord | null;
  view: ViewKey;
  busyId: string | null;
  onOpen: () => void;
  onSave: (visibility: SavedWorkoutVisibility) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
};

function WorkoutCard({ workout, saved, community, view, busyId, onOpen, onSave, onDelete }: CardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const busy = busyId === workout.id + "public" || busyId === workout.id + "private" || busyId === saved?.id;

  const label = saved
    ? saved.visibility === "public"
      ? "Public"
      : "Private"
    : "Save";

  const ownerRecord = view === "community" ? community ?? saved : saved ?? community;

  return (
    <article className="card">
      <div className="media" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen()}>
        {workout.mediaUrl ? (
          workout.mediaType === "mp4" ? (
            <video src={workout.mediaUrl} muted loop playsInline autoPlay poster={workout.previewUrl || undefined} />
          ) : (
            <Image
              src={workout.mediaUrl}
              alt={workout.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              onError={(event) => {
                if (event.currentTarget instanceof HTMLImageElement) {
                  event.currentTarget.src = "/placeholder.png";
                }
              }}
            />
          )
        ) : (
          <div className="fallback" aria-hidden="true">
            <span>{workout.title.charAt(0)}</span>
          </div>
        )}
        <button type="button" className="view" aria-label={`View ${workout.title}`}>
          View
        </button>
      </div>

      <div className="meta">
        <div className="top">
          <h3>{workout.title}</h3>
            <SaveButton
              label={label}
              open={menuOpen}
              busy={busy}
              visibility={saved?.visibility}
              onToggle={() => setMenuOpen((prev) => !prev)}
              onSelect={async (next) => {
                setMenuOpen(false);
                await onSave(next);
              }}
              onDelete={saved && onDelete ? async () => {
                setMenuOpen(false);
                await onDelete();
              } : undefined}
            allowDelete={Boolean(saved)}
            allowPrivate={true}
            allowPublic={true}
            ref={menuRef}
          />
        </div>
        <p className="desc">{snippet(workout.description)}</p>
        <div className="tags">
          {workout.bodyPart ? <span>{titleCase(workout.bodyPart)}</span> : null}
          {workout.target && workout.target !== workout.bodyPart ? <span>{titleCase(workout.target)}</span> : null}
          {workout.equipment ? <span>{titleCase(workout.equipment)}</span> : null}
        </div>
        {ownerRecord && ownerRecord.owner ? (
          <div className="owner">
            <span>
              by {ownerRecord.owner.username || ownerRecord.owner.displayName || "Anonymous"}
            </span>
            {saved ? <span className={clsx("vis", saved.visibility)}>{saved.visibility}</span> : null}
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .card {
          display: grid;
          gap: 14px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 20px;
          background: var(--bg2);
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        .media {
          position: relative;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          cursor: pointer;
        }
        .media :global(video),
        .media :global(img) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .fallback {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, color-mix(in oklab, var(--primary) 30%, transparent), color-mix(in oklab, var(--bg) 20%, transparent));
          font-size: 2rem;
          font-weight: 800;
          color: var(--primary-contrast);
        }
        .view {
          position: absolute;
          bottom: 12px;
          right: 12px;
          border: 0;
          background: rgba(15, 23, 42, 0.72);
          color: #fff;
          border-radius: 999px;
          padding: 8px 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .meta {
          padding: 0 18px 18px;
          display: grid;
          gap: 10px;
        }
        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        h3 {
          font-size: 1.05rem;
          margin: 0;
          color: var(--text);
          font-weight: 700;
        }
        .desc {
          margin: 0;
          color: var(--muted);
          font-size: 0.95rem;
          min-height: 40px;
        }
        .tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tags span {
          background: color-mix(in oklab, var(--primary) 12%, transparent);
          border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 600;
          color: color-mix(in oklab, var(--primary) 40%, var(--text));
        }
        .owner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          color: var(--muted);
        }
        .vis {
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .vis.public {
          color: color-mix(in oklab, var(--primary) 50%, var(--text));
        }
        .vis.private {
          color: var(--muted);
        }
      `}</style>
    </article>
  );
}

type SaveButtonProps = {
  label: string;
  open: boolean;
  busy: boolean;
  visibility?: SavedWorkoutVisibility;
  onToggle: () => void;
  onSelect: (visibility: SavedWorkoutVisibility) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  allowDelete: boolean;
  allowPrivate: boolean;
  allowPublic: boolean;
};

const SaveButton = React.forwardRef<HTMLDivElement, SaveButtonProps>(function SaveButton(
  { label, open, busy, visibility, onToggle, onSelect, onDelete, allowDelete, allowPrivate, allowPublic },
  ref
) {
  return (
    <div className={clsx("saveMenu", open && "open")} ref={ref as React.RefObject<HTMLDivElement>}>
      <button type="button" className="trigger" onClick={onToggle} disabled={busy} aria-expanded={open}>
        {busy ? "Saving…" : label}
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>
      {open ? (
        <div className="menu" role="menu">
          {allowPrivate ? (
            <button type="button" role="menuitem" onClick={() => onSelect("private")} className={visibility === "private" ? "active" : ""}>
              Save as private
            </button>
          ) : null}
          {allowPublic ? (
            <button type="button" role="menuitem" onClick={() => onSelect("public")} className={visibility === "public" ? "active" : ""}>
              Save as public
            </button>
          ) : null}
          {allowDelete && onDelete ? (
            <button type="button" role="menuitem" className="danger" onClick={() => onDelete()}>
              Remove from saved
            </button>
          ) : null}
        </div>
      ) : null}
      <style jsx>{`
        .saveMenu {
          position: relative;
        }
        .trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          padding: 8px 14px;
          background: color-mix(in oklab, var(--bg) 94%, transparent);
          color: var(--text);
          font-weight: 600;
          cursor: pointer;
        }
        .trigger svg {
          width: 16px;
          height: 16px;
          stroke: currentColor;
          fill: none;
        }
        .menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--bg2);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 14px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
          display: grid;
          min-width: 190px;
          overflow: hidden;
          z-index: 20;
        }
        .menu button {
          border: 0;
          background: transparent;
          text-align: left;
          padding: 10px 14px;
          font-size: 0.92rem;
          color: var(--text);
          cursor: pointer;
        }
        .menu button:hover {
          background: color-mix(in oklab, var(--primary) 10%, transparent);
        }
        .menu button.active {
          font-weight: 700;
        }
        .menu button.danger {
          color: #b91c1c;
        }
      `}</style>
    </div>
  );
});

type DetailDialogProps = {
  item: DisplayWorkout;
  onClose: () => void;
  onSave: (workout: WorkoutContent, visibility: SavedWorkoutVisibility, existing?: SavedWorkoutRecord | null) => void | Promise<void>;
  onDelete: (record: SavedWorkoutRecord) => void | Promise<void>;
  onAddToToday: (workout: WorkoutContent) => void | Promise<void>;
  busyId: string | null;
};

function DetailDialog({ item, onClose, onSave, onDelete, onAddToToday, busyId }: DetailDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const { workout, saved, community } = item;
  const busy = busyId === workout.id + "public" || busyId === workout.id + "private" || busyId === saved?.id;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={`${workout.title} details`}>
      <div className="panel" ref={panelRef} tabIndex={-1}>
        <header className="panelTop">
          <div>
            <h2>{workout.title}</h2>
            <p>{workout.description}</p>
            {community?.owner ? (
              <span className="sharedBy">
                Shared by {community.owner.username || community.owner.displayName || "Anonymous"}
              </span>
            ) : null}
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="panelBody">
          <div className="media">
            {workout.mediaUrl ? (
              workout.mediaType === "mp4" ? (
                <video src={workout.mediaUrl} muted loop playsInline autoPlay poster={workout.previewUrl || undefined} />
              ) : (
                <Image
                  src={workout.mediaUrl}
                  alt={workout.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  onError={(event) => {
                    if (event.currentTarget instanceof HTMLImageElement) {
                      event.currentTarget.src = "/placeholder.png";
                    }
                  }}
                />
              )
            ) : null}
          </div>
          <div className="info">
            <div className="chips">
              {workout.bodyPart ? <span>{titleCase(workout.bodyPart)}</span> : null}
              {workout.target && workout.target !== workout.bodyPart ? <span>{titleCase(workout.target)}</span> : null}
              {workout.equipment ? <span>{titleCase(workout.equipment)}</span> : null}
            </div>
            {workout.instructionsHtml ? (
              <div className="instructions" dangerouslySetInnerHTML={{ __html: workout.instructionsHtml }} />
            ) : (
              <p>{workout.description}</p>
            )}
          </div>
        </div>
        <footer className="panelBottom">
          <button type="button" className="secondary" onClick={() => onAddToToday(workout)}>
            Add to planner
          </button>
          <div className="actions">
            <button type="button" className="ghost" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => onSave(workout, saved?.visibility ?? "private", saved ?? null)}
            >
              {busy ? "Saving…" : saved ? `Save (${saved.visibility})` : "Save (private)"}
            </button>
            {saved ? (
              <button type="button" className="danger" disabled={busy} onClick={() => onDelete(saved)}>
                Remove
              </button>
            ) : null}
          </div>
        </footer>
      </div>
      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.65);
          display: grid;
          place-items: center;
          padding: 20px;
          z-index: 1400;
        }
        .panel {
          background: var(--bg2);
          border-radius: 24px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          width: min(900px, 100%);
          max-height: 90vh;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 0;
          outline: none;
        }
        .panelTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 24px;
          border-bottom: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
        }
        .panelTop h2 {
          margin: 0 0 8px;
          font-size: 1.4rem;
          color: var(--text);
          letter-spacing: -0.01em;
        }
        .panelTop p {
          margin: 0;
          color: var(--muted);
        }
        .sharedBy {
          display: block;
          margin-top: 6px;
          font-size: 0.85rem;
          color: color-mix(in oklab, var(--primary) 45%, var(--text));
        }
        .panelTop button {
          border: 0;
          background: transparent;
          color: var(--text);
          font-weight: 600;
          cursor: pointer;
        }
        .panelBody {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          padding: 24px;
          overflow-y: auto;
        }
        @media (max-width: 768px) {
          .panelBody {
            grid-template-columns: 1fr;
          }
        }
        .media {
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          aspect-ratio: 4 / 3;
          background: color-mix(in oklab, var(--bg) 80%, transparent);
        }
        .media :global(video),
        .media :global(img) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .info {
          display: grid;
          gap: 16px;
        }
        .chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chips span {
          background: color-mix(in oklab, var(--primary) 12%, transparent);
          border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border));
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 0.8rem;
        }
        .instructions {
          display: grid;
          gap: 10px;
          color: var(--text);
        }
        .instructions :global(p) {
          margin: 0;
          line-height: 1.6;
        }
        .instructions :global(ul), .instructions :global(ol) {
          margin: 0;
          padding-left: 20px;
        }
        .panelBottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          border-top: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
          flex-wrap: wrap;
        }
        .panelBottom button {
          border: 0;
          border-radius: 999px;
          padding: 10px 18px;
          font-weight: 600;
          cursor: pointer;
        }
        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .primary {
          background: var(--primary);
          color: var(--primary-contrast);
        }
        .secondary {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: var(--bg);
          color: var(--text);
        }
        .ghost {
          background: transparent;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
        }
        .danger {
          background: #b91c1c;
          color: #fff;
        }
      `}</style>
    </div>
  );
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="skeleton" key={index}>
          <div className="block" />
          <div className="lines">
            <div />
            <div />
            <div />
          </div>
          <style jsx>{`
            .skeleton {
              display: grid;
              gap: 12px;
              border-radius: 20px;
              border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
              background: color-mix(in oklab, var(--bg2) 94%, transparent);
              overflow: hidden;
              padding: 18px;
            }
            .block {
              height: 180px;
              border-radius: 16px;
              background: linear-gradient(90deg, color-mix(in oklab, var(--bg) 88%, transparent), color-mix(in oklab, var(--bg2) 70%, transparent), color-mix(in oklab, var(--bg) 88%, transparent));
              background-size: 200% 100%;
              animation: shimmer 1.4s infinite;
            }
            .lines {
              display: grid;
              gap: 8px;
            }
            .lines div {
              height: 12px;
              border-radius: 8px;
              background: linear-gradient(90deg, color-mix(in oklab, var(--bg) 88%, transparent), color-mix(in oklab, var(--bg2) 70%, transparent), color-mix(in oklab, var(--bg) 88%, transparent));
              background-size: 200% 100%;
              animation: shimmer 1.4s infinite;
            }
            @keyframes shimmer {
              0% { background-position: 0% 50%; }
              100% { background-position: -200% 50%; }
            }
          `}</style>
        </div>
      ))}
    </>
  );
}

function snippet(text: string, limit = 160) {
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : ""))
    .join(" ");
}
