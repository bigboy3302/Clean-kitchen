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
import { getDirectWorkoutVideoUrl, getYouTubeEmbedUrl } from "@/lib/workouts/media";
import { addExerciseToToday } from "@/lib/fitness/store";
import { auth } from "@/lib/firebas1e";
import { uploadWorkoutMedia } from "@/lib/uploads";
import type { Goal } from "@/lib/fitness/calc";

type Props = {
  searchTerm: string;
  onClearSearch?: () => void;
  initialBodyPart?: string;
  title?: string;
  goal?: Goal;
};

type ViewKey = "explore" | "saved" | "community";

type DisplayWorkout = {
  workout: WorkoutContent;
  saved?: SavedWorkoutRecord | null;
  community?: SavedWorkoutRecord | null;
};

type CreatorForm = {
  title: string;
  description: string;
  instructions: string;
  bodyPart: string;
  target: string;
  equipment: string;
  primaryMuscles: string;
  secondaryMuscles: string;
  equipmentList: string;
  externalMedia: string;
  mediaUrl: string;
  mediaKind: WorkoutContent["mediaType"];
  mediaName: string;
  visibility: SavedWorkoutVisibility;
};

const CREATOR_DEFAULT: CreatorForm = {
  title: "",
  description: "",
  instructions: "",
  bodyPart: "",
  target: "",
  equipment: "",
  primaryMuscles: "",
  secondaryMuscles: "",
  equipmentList: "",
  externalMedia: "",
  mediaUrl: "",
  mediaKind: "gif",
  mediaName: "",
  visibility: "private",
};

const CREATOR_STEPS = ["Basics", "Coaching", "Media"] as const;

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

const MIN_SEARCH_LENGTH = 2;

export default function WorkoutGrid({ searchTerm, onClearSearch, initialBodyPart, title, goal }: Props) {
  const defaultFilters = useMemo<WorkoutSearchFilters>(
    () => ({ ...DEFAULT_FILTERS, bodyPart: initialBodyPart ?? "" }),
    [initialBodyPart]
  );
  const [filters, setFilters] = useState<WorkoutSearchFilters>(defaultFilters);
  const [view, setView] = useState<ViewKey>("explore");
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [creator, setCreator] = useState<CreatorForm>(CREATOR_DEFAULT);
  const [creatorStep, setCreatorStep] = useState(0);
  const [creatorError, setCreatorError] = useState<string | null>(null);
  const [creatorBusy, setCreatorBusy] = useState(false);
  const [creatorUploading, setCreatorUploading] = useState(false);

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
    const active = view === "explore" && searchTerm.trim().length >= MIN_SEARCH_LENGTH;
    setShowSearchOverlay(active);
  }, [searchTerm, view]);

  useEffect(() => {
    if (!showCreator) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showCreator]);

  useEffect(() => {
    if (!showSearchOverlay) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showSearchOverlay]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    setFilters(defaultFilters);
  }, [defaultFilters]);

  const updateFilter = (field: keyof WorkoutSearchFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = useCallback(() => setFilters(defaultFilters), [defaultFilters]);

  const handleSave = useCallback(
    async (workout: WorkoutContent, visibility: SavedWorkoutVisibility, existing?: SavedWorkoutRecord | null) => {
      try {
        setBusyId(workout.id + visibility);
        const payload = existing
          ? { id: existing.id, visibility, workout }
          : { visibility, workout };
        const saved = await savedMine.save(payload);
        setToast(`Saved "${workout.title}" (${saved.visibility})`);
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
        setToast(`Removed "${record.workout.title}" from saved`);
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
  const updateCreator = useCallback(<K extends keyof CreatorForm>(key: K, value: CreatorForm[K]) => {
    setCreator((prev) => ({ ...prev, [key]: value }));
    setCreatorError(null);
  }, []);
  const resetCreator = useCallback(() => {
    setCreator(CREATOR_DEFAULT);
    setCreatorStep(0);
    setCreatorError(null);
    setCreatorBusy(false);
    setCreatorUploading(false);
  }, []);
  const closeCreator = useCallback(() => {
    setShowCreator(false);
    resetCreator();
  }, [resetCreator]);
  const creatorMediaSrc = (creator.mediaUrl || creator.externalMedia || "").trim();
  const creatorPreviewType = creator.mediaUrl
    ? creator.mediaKind
    : detectMediaType(creatorMediaSrc ? creatorMediaSrc : null);
  const creatorCombinedMedia = creatorMediaSrc.length ? creatorMediaSrc : null;
  const basicsIncomplete = !creator.title.trim() || !creator.description.trim();
  const nextDisabled =
    creatorStep === 0
      ? basicsIncomplete
      : creatorStep === CREATOR_STEPS.length - 1
      ? creatorBusy || creatorUploading
      : false;
  const nextLabel =
    creatorStep === CREATOR_STEPS.length - 1 ? (creatorBusy ? "Saving…" : "Save workout") : "Next";
  const handleNextStep = () => {
    if (creatorStep === CREATOR_STEPS.length - 1) {
      void handleCreatorSubmit();
      return;
    }
    setCreatorStep((prev) => Math.min(prev + 1, CREATOR_STEPS.length - 1));
  };
  const handlePrevStep = () => {
    if (creatorStep === 0) {
      closeCreator();
      return;
    }
    setCreatorStep((prev) => Math.max(prev - 1, 0));
  };
  const handleCreatorFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const user = auth.currentUser;
      if (!user) {
        setCreatorError("Sign in to upload media.");
        event.target.value = "";
        return;
      }
      setCreatorUploading(true);
      setCreatorError(null);
      try {
        const uploadedUrl = await uploadWorkoutMedia(user.uid, file);
        updateCreator("mediaUrl", uploadedUrl);
        updateCreator("mediaKind", file.type.startsWith("video/") ? "mp4" : file.type.toLowerCase().includes("gif") ? "gif" : "image");
        updateCreator("mediaName", file.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed. Try again.";
        setCreatorError(message);
      } finally {
        setCreatorUploading(false);
        event.target.value = "";
      }
    },
    [updateCreator]
  );
  const handleCreatorSubmit = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setCreatorError("Sign in to save workouts.");
      return;
    }
    if (!creator.title.trim() || !creator.description.trim()) {
      setCreatorStep(0);
      setCreatorError("Add a title and description.");
      return;
    }
    setCreatorError(null);
    setCreatorBusy(true);
    try {
      const idComponent =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const workout: WorkoutContent = {
        id: `custom-${idComponent}`,
        title: creator.title.trim(),
        description: creator.description.trim(),
        mediaUrl: creatorCombinedMedia,
        mediaType: creatorPreviewType,
        previewUrl: creatorCombinedMedia,
        thumbnailUrl: creatorCombinedMedia,
        instructionsHtml: toHtml(creator.instructions.trim()),
        bodyPart: creator.bodyPart.trim() || null,
        target: creator.target.trim() || null,
        equipment: creator.equipment.trim() || null,
        source: "user",
        primaryMuscles: parseList(creator.primaryMuscles),
        secondaryMuscles: parseList(creator.secondaryMuscles),
        equipmentList: parseList(creator.equipmentList),
      };
      await savedMine.save({ visibility: creator.visibility, workout });
      await savedMine.refresh();
      if (creator.visibility === "public") {
        await savedCommunity.refresh();
      }
      closeCreator();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save workout.";
      setCreatorError(message);
    } finally {
      setCreatorBusy(false);
    }
  }, [
    closeCreator,
    creator.bodyPart,
    creator.description,
    creator.equipment,
    creator.equipmentList,
    creator.instructions,
    creator.primaryMuscles,
    creator.secondaryMuscles,
    creator.target,
    creator.title,
    creator.visibility,
    creatorCombinedMedia,
    creatorPreviewType,
    savedCommunity,
    savedMine,
  ]);

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
      setToast(`Added "${workout.title}" to Today`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add to planner";
      setToast(message);
    }
  }, []);

  const emptyStateMessage = useMemo(() => {
    if (view === "saved") {
      if (savedMine.loading) return "Loading saved workouts…";
      if (savedMine.items.length === 0) return "You haven't saved any workouts yet.";
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
        {(title || goal) && (
          <div className="sectionIntro">
            {title ? <h2 className="sectionTitle">{title}</h2> : null}
            {goal ? <p className="sectionSubtitle">Goal focus: {titleCase(goal)}</p> : null}
          </div>
        )}
        <div className="tabsRow">
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
          <div className="ctaRow">
            <button type="button" className="createBtn" onClick={() => setShowCreator(true)}>
              + Create workout
            </button>
          </div>
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

      <div className="grid">
        {activeList.map(({ workout, saved, community }) => (
          <WorkoutCard
            key={`${view}-${workout.id}-${saved?.id ?? community?.id ?? "base"}`}
            workout={workout}
            saved={saved}
            busyId={busyId}
            onOpen={() => setDetail({ workout, saved, community })}
            onSave={() => handleSave(workout, "private", saved)}
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

      {showCreator ? (
        <div className="creatorOverlay" role="dialog" aria-modal="true" aria-label="Create workout" onClick={closeCreator}>
          <div className="creatorPanel" onClick={(event) => event.stopPropagation()}>
            <header className="creatorHead">
              <div>
                <p className="creatorEyebrow">Create &amp; share</p>
                <h3>New workout</h3>
              </div>
              <button type="button" className="ghostBtn creatorClose" onClick={closeCreator}>
                Close
              </button>
            </header>
            <div className="creatorSteps">
              {CREATOR_STEPS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={clsx("stepDot", index === creatorStep && "on")}
                  aria-current={index === creatorStep}
                  onClick={() => setCreatorStep(index)}
                >
                  <span>{index + 1}</span>
                  {label}
                </button>
              ))}
            </div>
            <div className="creatorSlider">
              <div className="creatorSlides" style={{ transform: `translateX(-${creatorStep * 100}%)` }}>
                <section className="creatorSlide">
                  <div className="creatorGrid">
                    <label className="creatorField">
                      <span>Title*</span>
                      <input
                        type="text"
                        value={creator.title}
                        onChange={(event) => updateCreator("title", event.currentTarget.value)}
                        placeholder="Push-up ladder finisher"
                      />
                    </label>
                    <label className="creatorField">
                      <span>Body part</span>
                      <input
                        type="text"
                        value={creator.bodyPart}
                        onChange={(event) => updateCreator("bodyPart", event.currentTarget.value)}
                        placeholder="Full body"
                      />
                    </label>
                    <label className="creatorField">
                      <span>Target muscle</span>
                      <input
                        type="text"
                        value={creator.target}
                        onChange={(event) => updateCreator("target", event.currentTarget.value)}
                        placeholder="Chest / core"
                      />
                    </label>
                    <label className="creatorField">
                      <span>Equipment</span>
                      <input
                        type="text"
                        value={creator.equipment}
                        onChange={(event) => updateCreator("equipment", event.currentTarget.value)}
                        placeholder="Bodyweight"
                      />
                    </label>
                  </div>
                  <label className="creatorField">
                    <span>Short description*</span>
                    <textarea
                      rows={4}
                      value={creator.description}
                      onChange={(event) => updateCreator("description", event.currentTarget.value)}
                      placeholder="Explain the focus and outcome of this workout."
                    />
                  </label>
                </section>
                <section className="creatorSlide">
                  <label className="creatorField">
                    <span>Detailed instructions</span>
                    <textarea
                      rows={6}
                      value={creator.instructions}
                      onChange={(event) => updateCreator("instructions", event.currentTarget.value)}
                      placeholder="Step 1..."
                    />
                    <span className="creatorHint">Use blank lines to start a new paragraph.</span>
                  </label>
                  <div className="creatorGrid">
                    <label className="creatorField">
                      <span>Primary muscles</span>
                      <input
                        type="text"
                        value={creator.primaryMuscles}
                        onChange={(event) => updateCreator("primaryMuscles", event.currentTarget.value)}
                        placeholder="Chest, triceps"
                      />
                    </label>
                    <label className="creatorField">
                      <span>Secondary muscles</span>
                      <input
                        type="text"
                        value={creator.secondaryMuscles}
                        onChange={(event) => updateCreator("secondaryMuscles", event.currentTarget.value)}
                        placeholder="Shoulders"
                      />
                    </label>
                    <label className="creatorField">
                      <span>Equipment list</span>
                      <input
                        type="text"
                        value={creator.equipmentList}
                        onChange={(event) => updateCreator("equipmentList", event.currentTarget.value)}
                        placeholder="Timer, mat"
                      />
                    </label>
                  </div>
                </section>
                <section className="creatorSlide">
                  <div className="creatorGrid">
                    <label className="creatorField">
                      <span>Upload media</span>
                      <input type="file" accept="image/*,video/*" onChange={handleCreatorFile} disabled={creatorUploading || creatorBusy} />
                      <span className="creatorHint">Images up to 20 MB, videos up to 120 MB.</span>
                    </label>
                    <label className="creatorField">
                      <span>External media URL</span>
                      <input
                        type="url"
                        value={creator.externalMedia}
                        onChange={(event) => updateCreator("externalMedia", event.currentTarget.value)}
                        placeholder="https://example.com/move.gif"
                      />
                    </label>
                  </div>
                  {creatorMediaSrc ? (
                    <div className="creatorPreview">
                      {creatorPreviewType === "mp4" ? (
                        <video src={creatorMediaSrc} controls playsInline />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={creatorMediaSrc} alt={creator.title || "Workout media"} />
                      )}
                      <button
                        type="button"
                        className="ghostBtn creatorGhost"
                        onClick={() => {
                          updateCreator("mediaUrl", "");
                          updateCreator("externalMedia", "");
                          updateCreator("mediaName", "");
                        }}
                      >
                        Remove media
                      </button>
                    </div>
                  ) : (
                    <p className="creatorHint">Add at least one visual so others can follow your movement.</p>
                  )}
                  <div className="creatorVisibility">
                    <p className="creatorLabel">Visibility</p>
                    <div className="chips">
                      {(["private", "public"] as SavedWorkoutVisibility[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={clsx("chip", creator.visibility === option && "on")}
                          onClick={() => updateCreator("visibility", option)}
                        >
                          {option === "private" ? "Private (only me)" : "Public (share with community)"}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>
            {creatorError ? <p className="creatorError">{creatorError}</p> : null}
            <div className="creatorNav">
              <button type="button" className="ghostBtn creatorGhost" onClick={handlePrevStep} disabled={creatorBusy}>
                {creatorStep === 0 ? "Cancel" : "Back"}
              </button>
              <button type="button" className="primaryBtn" onClick={handleNextStep} disabled={nextDisabled}>
                {creatorUploading ? "Uploading…" : nextLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSearchOverlay ? (
        <div
          className="searchOverlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Search workouts for ${searchTerm}`}
          onClick={() => {
            if (onClearSearch) onClearSearch();
          }}
        >
          <div className="searchPanel" onClick={(event) => event.stopPropagation()}>
            <div className="searchHead">
              <h3>
                Results for
                <span>&ldquo;{searchTerm.trim()}&rdquo;</span>
              </h3>
              <button type="button" className="close" onClick={() => onClearSearch?.()}>
                Close
              </button>
            </div>
            <div className="searchBody">
              {loading ? (
                <p className="muted">Finding workouts…</p>
              ) : exploreList.length ? (
                <div className="searchGrid">
                  {exploreList.map(({ workout, saved, community }) => (
                    <WorkoutCard
                      key={`overlay-${workout.id}-${saved?.id ?? community?.id ?? "base"}`}
                      workout={workout}
                      saved={saved}
                      busyId={busyId}
                      onOpen={() => setDetail({ workout, saved, community })}
                      onSave={() => handleSave(workout, "private", saved)}
                    />
                  ))}
                </div>
              ) : (
                <p className="muted">{emptyStateMessage}</p>
              )}
            </div>
          </div>
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
        .sectionIntro {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
        }
        .sectionTitle {
          margin: 0;
          font-size: 1.2rem;
          color: var(--text);
        }
        .sectionSubtitle {
          margin: 0;
          font-size: 0.85rem;
          color: var(--muted);
          font-weight: 600;
        }
        .tabsRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .tabs {
          display: inline-flex;
          gap: 6px;
          background: color-mix(in oklab, var(--bg2) 90%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 82%, transparent);
          padding: 5px;
          border-radius: 999px;
          width: fit-content;
        }
        .tab {
          border: 0;
          background: transparent;
          color: var(--muted);
          font-weight: 600;
          padding: 7px 14px;
          border-radius: 999px;
          cursor: pointer;
          transition: background .15s ease, color .15s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.9rem;
          text-decoration: none;
        }
        .tab.on {
          background: var(--primary);
          color: var(--primary-contrast);
          box-shadow: 0 8px 24px color-mix(in oklab, var(--primary) 35%, transparent);
        }
        .ctaRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .createBtn {
          display: inline-flex;
          align-items: center;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 999px;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text);
          background: transparent;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .createBtn:hover {
          background: color-mix(in oklab, var(--bg) 80%, transparent);
        }
        .badge {
          background: color-mix(in oklab, var(--primary-contrast) 15%, transparent);
          color: inherit;
          border-radius: 999px;
          padding: 2px 7px;
          font-size: 11px;
          font-weight: 600;
        }
        .filters {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          align-items: end;
        }
        .reset {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: color-mix(in oklab, var(--bg) 85%, transparent);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .reset:hover {
          background: color-mix(in oklab, var(--border) 30%, var(--bg));
        }
        .grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        }
        @media (max-width: 640px) {
          .grid {
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
        }
        @media (max-width: 420px) {
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
        .searchOverlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.68);
          display: grid;
          place-items: center;
          padding: 20px;
          z-index: 2400;
        }
        .searchPanel {
          width: min(960px, 100%);
          max-height: 90vh;
          overflow: hidden auto;
          background: var(--bg2);
          border-radius: 24px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          box-shadow: 0 40px 120px rgba(15, 23, 42, 0.32);
          display: grid;
          gap: 18px;
          padding: 24px;
        }
        .searchHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .searchHead h3 {
          margin: 0;
          font-size: 1.2rem;
          color: var(--text);
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .searchHead h3 span {
          color: var(--primary);
        }
        .searchHead .close {
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: var(--bg);
          color: var(--text);
          padding: 8px 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .searchBody {
          display: grid;
          gap: 14px;
        }
        .searchGrid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        }
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px 20px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.28);
          z-index: 1200;
          color: var(--text);
          font-weight: 500;
          white-space: nowrap;
        }
        .creatorOverlay {
          position: fixed;
          inset: 0;
          background: rgba(4, 9, 20, 0.75);
          display: grid;
          place-items: center;
          padding: 20px;
          z-index: 1300;
        }
        .creatorPanel {
          width: min(960px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: color-mix(in oklab, var(--bg2) 98%, transparent);
          border-radius: 28px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          box-shadow: 0 40px 80px rgba(15, 23, 42, 0.35);
          padding: 24px;
          display: grid;
          gap: 18px;
        }
        .creatorHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .creatorEyebrow {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-size: 0.75rem;
          color: var(--muted);
          font-weight: 700;
        }
        .creatorHead h3 {
          margin: 2px 0 0;
          font-size: 1.5rem;
          color: var(--text);
        }
        .creatorSteps {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .stepDot {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          padding: 6px 14px;
          background: transparent;
          color: var(--muted);
          font-weight: 600;
          cursor: pointer;
        }
        .stepDot span {
          display: inline-flex;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          align-items: center;
          justify-content: center;
          background: color-mix(in oklab, var(--border) 80%, transparent);
          font-size: 0.75rem;
        }
        .stepDot.on {
          border-color: var(--primary);
          color: var(--primary);
        }
        .stepDot.on span {
          background: var(--primary);
          color: var(--primary-contrast);
        }
        .creatorSlider {
          overflow: hidden;
        }
        .creatorSlides {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: 100%;
          transition: transform 0.4s ease;
        }
        .creatorSlide {
          display: grid;
          gap: 16px;
          padding-right: 4px;
        }
        .creatorGrid {
          display: grid;
          gap: 12px 16px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .creatorField {
          display: grid;
          gap: 6px;
        }
        .creatorField span {
          font-weight: 600;
          color: var(--text);
        }
        .creatorField input,
        .creatorField textarea {
          border-radius: 14px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: var(--bg);
          color: var(--text);
          padding: 10px 12px;
          font: inherit;
        }
        .creatorField textarea {
          min-height: 120px;
        }
        .creatorHint {
          margin: 0;
          font-size: 0.85rem;
          color: var(--muted);
        }
        .creatorPreview {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 18px;
          padding: 12px;
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          display: grid;
          gap: 10px;
        }
        .creatorPreview img,
        .creatorPreview video {
          width: 100%;
          border-radius: 14px;
          max-height: 340px;
          object-fit: cover;
        }
        .creatorVisibility {
          display: grid;
          gap: 8px;
          margin-top: 8px;
        }
        .creatorLabel {
          font-weight: 700;
          color: var(--text);
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .chip {
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
          padding: 8px 14px;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          color: var(--text);
        }
        .chip.on {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: var(--primary);
          box-shadow: 0 12px 28px color-mix(in oklab, var(--primary) 32%, transparent);
        }
        .creatorError {
          margin: 0;
          border-radius: 12px;
          border: 1px solid color-mix(in oklab, #ef4444 60%, transparent);
          background: color-mix(in oklab, #fee2e2 80%, transparent);
          color: #7f1d1d;
          padding: 10px 12px;
          font-weight: 600;
        }
        .creatorNav {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ghostBtn.creatorClose,
        .ghostBtn.creatorGhost {
          position: relative;
          border-radius: 999px;
          padding: 10px 18px;
          border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
          font-weight: 700;
          overflow: hidden;
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          cursor: pointer;
        }
        .ghostBtn.creatorClose::after,
        .ghostBtn.creatorGhost::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, color-mix(in oklab, var(--bg2) 90%, transparent), color-mix(in oklab, var(--primary) 14%, transparent));
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .ghostBtn.creatorClose:hover::after,
        .ghostBtn.creatorGhost:hover::after {
          opacity: 1;
        }
        .ghostBtn.creatorClose {
          color: var(--text);
        }
        .ghostBtn.creatorGhost {
          color: var(--primary);
          border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
        }
        .primaryBtn {
          border: 0;
          border-radius: 999px;
          padding: 12px 24px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--primary-contrast);
          min-width: 200px;
          cursor: pointer;
          background: linear-gradient(135deg, var(--primary) 0%, color-mix(in oklab, var(--primary) 60%, #8b5cf6) 100%);
          box-shadow: 0 20px 40px color-mix(in oklab, var(--primary) 35%, transparent);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .primaryBtn:hover {
          transform: translateY(-2px);
          box-shadow: 0 26px 48px color-mix(in oklab, var(--primary) 40%, transparent);
        }
        .primaryBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        @media (max-width: 720px) {
          .searchPanel {
            padding: 20px 16px;
          }
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
  busyId: string | null;
  onOpen: () => void;
  onSave: () => Promise<void> | void;
};

function WorkoutCard({ workout, saved, busyId, onOpen, onSave }: CardProps) {
  const busy = busyId === workout.id + "public" || busyId === workout.id + "private" || busyId === saved?.id;
  const imageSrc = workout.mediaUrl || workout.thumbnailUrl;

  const tags = [
    workout.bodyPart,
    workout.target && workout.target !== workout.bodyPart ? workout.target : null,
    workout.equipment,
  ]
    .filter(Boolean)
    .slice(0, 3) as string[];

  return (
    <article className="card">
      <div
        className="media"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => event.key === "Enter" && onOpen()}
        aria-label={`View ${workout.title}`}
      >
        {imageSrc ? (
          workout.mediaUrl && workout.mediaType === "mp4" ? (
            <video src={workout.mediaUrl} muted loop playsInline autoPlay poster={workout.previewUrl || undefined} />
          ) : (
            <Image
              src={imageSrc}
              alt={workout.title}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              unoptimized={imageSrc.includes("ytimg.com")}
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
      </div>

      <div className="body">
        <h3>{workout.title}</h3>
        {tags.length ? (
          <div className="tags">
            {tags.map((tag) => (
              <span key={tag}>{titleCase(tag)}</span>
            ))}
          </div>
        ) : null}
        <div className="foot">
          <button type="button" className="detailBtn" onClick={onOpen}>
            View details
          </button>
          <button
            type="button"
            className={clsx("saveBtn", saved && "saved")}
            disabled={busy}
            onClick={onSave}
            aria-label={saved ? "Saved" : "Save workout"}
          >
            {busy ? "…" : saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .card {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 18px;
          background: var(--bg2);
          overflow: hidden;
          display: grid;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .card:hover {
          box-shadow: 0 16px 48px rgba(15, 23, 42, 0.12);
          transform: translateY(-2px);
        }
        .media {
          position: relative;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          cursor: pointer;
          background: color-mix(in oklab, var(--bg) 80%, transparent);
        }
        .media :global(video),
        .media :global(img) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .card:hover .media :global(img),
        .card:hover .media :global(video) {
          transform: scale(1.03);
        }
        .fallback {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, color-mix(in oklab, var(--primary) 30%, transparent), color-mix(in oklab, var(--bg) 20%, transparent));
          font-size: 2.5rem;
          font-weight: 800;
          color: var(--primary-contrast);
        }
        .body {
          padding: 14px 16px 16px;
          display: grid;
          gap: 10px;
        }
        h3 {
          font-size: 0.97rem;
          margin: 0;
          color: var(--text);
          font-weight: 700;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tags span {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--muted);
          background: color-mix(in oklab, var(--bg) 85%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
          border-radius: 999px;
          padding: 3px 8px;
        }
        .foot {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 2px;
        }
        .detailBtn {
          flex: 1;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: transparent;
          color: var(--text);
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .detailBtn:hover {
          background: color-mix(in oklab, var(--bg) 80%, transparent);
        }
        .saveBtn {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: transparent;
          color: var(--text);
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
          white-space: nowrap;
        }
        .saveBtn:hover {
          background: color-mix(in oklab, var(--primary) 10%, transparent);
          border-color: color-mix(in oklab, var(--primary) 40%, var(--border));
          color: color-mix(in oklab, var(--primary) 60%, var(--text));
        }
        .saveBtn.saved {
          background: color-mix(in oklab, var(--primary) 14%, transparent);
          border-color: color-mix(in oklab, var(--primary) 40%, var(--border));
          color: color-mix(in oklab, var(--primary) 55%, var(--text));
        }
        .saveBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </article>
  );
}

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
  const { workout, saved, community } = item;
  const busy = busyId === workout.id + "public" || busyId === workout.id + "private" || busyId === saved?.id;
  const tutorialUrl = getDirectWorkoutVideoUrl(workout.title, workout.externalUrl);
  const ytEmbedUrl = getYouTubeEmbedUrl(tutorialUrl);
  const imageSrc = workout.mediaUrl || workout.thumbnailUrl;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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

  const tags = [
    workout.bodyPart,
    workout.target && workout.target !== workout.bodyPart ? workout.target : null,
    workout.equipment,
  ].filter(Boolean) as string[];

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${workout.title} details`}
      onClick={onClose}
    >
      <div
        className="panel"
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="closeBtn" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="panelScroll">
          {/* Media */}
          <div className="media">
            {imageSrc ? (
              workout.mediaUrl && workout.mediaType === "mp4" ? (
                <video src={workout.mediaUrl} muted loop playsInline autoPlay poster={workout.previewUrl || undefined} />
              ) : (
                <Image
                  src={imageSrc}
                  alt={workout.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 60vw"
                  unoptimized={imageSrc.includes("ytimg.com")}
                  onError={(event) => {
                    if (event.currentTarget instanceof HTMLImageElement) {
                      event.currentTarget.src = "/placeholder.png";
                    }
                  }}
                />
              )
            ) : (
              <div className="mediaFallback" aria-hidden="true">
                <span>{workout.title.charAt(0)}</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="body">
            <div className="titleRow">
              <h2>{workout.title}</h2>
              {community?.owner ? (
                <p className="sharedBy">by {community.owner.username || community.owner.displayName || "Anonymous"}</p>
              ) : null}
            </div>

            {tags.length ? (
              <div className="tags">
                {tags.map((tag) => (
                  <span key={tag}>{titleCase(tag)}</span>
                ))}
              </div>
            ) : null}

            {workout.instructionsHtml ? (
              <div
                className="instructions"
                dangerouslySetInnerHTML={{ __html: workout.instructionsHtml }}
              />
            ) : workout.description ? (
              <p className="desc">{workout.description}</p>
            ) : null}

            {/* YouTube tutorial */}
            <div className="ytSection">
              <p className="ytLabel">Tutorial</p>
              {ytEmbedUrl ? (
                <div className="ytEmbed">
                  <iframe
                    src={ytEmbedUrl}
                    title={`${workout.title} tutorial`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : tutorialUrl ? (
                <a
                  href={tutorialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ytSearch"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="ytIcon">
                    <path fill="#fff" d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 1.97C5.12 20 12 20 12 20s6.88 0 8.6-.45a2.78 2.78 0 0 0 1.94-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                    <polygon fill="#ff0000" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
                  </svg>
                  Watch on YouTube
                  <span className="ytQuery">Open the full tutorial video</span>
                </a>
              ) : (
                <p className="ytUnavailable">Tutorial video unavailable for this workout.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="foot">
          <button type="button" className="todayBtn" onClick={() => onAddToToday(workout)}>
            Add to today
          </button>
          <div className="footActions">
            {saved ? (
              <button type="button" className="removeBtn" disabled={busy} onClick={() => onDelete(saved)}>
                Remove
              </button>
            ) : null}
            <button
              type="button"
              className={clsx("saveActionBtn", saved && "isSaved")}
              disabled={busy}
              onClick={() => onSave(workout, saved?.visibility ?? "private", saved ?? null)}
            >
              {busy ? "Saving…" : saved ? `Saved (${saved.visibility})` : "Save"}
            </button>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.7);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1400;
        }
        .panel {
          background: var(--bg2);
          border-radius: 24px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          width: min(680px, 100%);
          max-height: 92vh;
          overflow: hidden;
          display: grid;
          grid-template-rows: 1fr auto;
          position: relative;
          outline: none;
          box-shadow: 0 40px 120px rgba(15, 23, 42, 0.4);
        }
        .closeBtn {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 10;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          color: var(--text);
          font-size: 1rem;
          display: grid;
          place-items: center;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: background 0.15s ease;
        }
        .closeBtn:hover {
          background: color-mix(in oklab, var(--bg) 80%, transparent);
        }
        .panelScroll {
          overflow-y: auto;
        }
        .media {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          overflow: hidden;
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
        .mediaFallback {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, color-mix(in oklab, var(--primary) 25%, transparent), color-mix(in oklab, var(--bg) 15%, transparent));
          font-size: 4rem;
          font-weight: 800;
          color: var(--primary-contrast);
        }
        .body {
          padding: 20px 24px 24px;
          display: grid;
          gap: 16px;
        }
        .titleRow {
          display: grid;
          gap: 4px;
        }
        h2 {
          margin: 0;
          font-size: 1.4rem;
          color: var(--text);
          letter-spacing: -0.01em;
          line-height: 1.25;
        }
        .sharedBy {
          margin: 0;
          font-size: 0.82rem;
          color: color-mix(in oklab, var(--primary) 50%, var(--muted));
        }
        .tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tags span {
          background: color-mix(in oklab, var(--primary) 10%, transparent);
          border: 1px solid color-mix(in oklab, var(--primary) 28%, var(--border));
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 0.78rem;
          font-weight: 600;
          color: color-mix(in oklab, var(--primary) 45%, var(--text));
        }
        .instructions {
          color: var(--text);
          line-height: 1.65;
          font-size: 0.95rem;
        }
        .instructions :global(p) {
          margin: 0 0 10px;
        }
        .instructions :global(p:last-child) {
          margin-bottom: 0;
        }
        .instructions :global(ul),
        .instructions :global(ol) {
          margin: 0;
          padding-left: 20px;
        }
        .desc {
          margin: 0;
          color: var(--muted);
          line-height: 1.6;
          font-size: 0.95rem;
        }
        .ytSection {
          border-top: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          padding-top: 16px;
          display: grid;
          gap: 10px;
        }
        .ytLabel {
          margin: 0;
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }
        .ytEmbed {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          border-radius: 14px;
          overflow: hidden;
        }
        .ytEmbed iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .ytSearch {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 13px 20px;
          border-radius: 14px;
          border: 0;
          background: #ff0000;
          color: #fff;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.95rem;
          box-shadow: 0 8px 24px rgba(255, 0, 0, 0.28);
          transition: filter 0.15s ease, box-shadow 0.15s ease;
          width: 100%;
        }
        .ytSearch:hover {
          filter: brightness(1.1);
          box-shadow: 0 12px 32px rgba(255, 0, 0, 0.36);
        }
        .ytIcon {
          width: 26px;
          height: 26px;
          flex-shrink: 0;
        }
        .ytQuery {
          font-size: 0.82rem;
          font-weight: 400;
          opacity: 0.85;
        }
        .ytUnavailable {
          margin: 0;
          color: var(--muted);
          font-size: 0.92rem;
        }
        .foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
          flex-wrap: wrap;
          background: color-mix(in oklab, var(--bg2) 98%, transparent);
        }
        .footActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .todayBtn {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: transparent;
          color: var(--text);
          border-radius: 999px;
          padding: 10px 18px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.15s ease;
        }
        .todayBtn:hover {
          background: color-mix(in oklab, var(--bg) 80%, transparent);
        }
        .removeBtn {
          border: 1px solid color-mix(in oklab, #ef4444 40%, var(--border));
          background: transparent;
          color: #b91c1c;
          border-radius: 999px;
          padding: 10px 18px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.15s ease;
        }
        .removeBtn:hover {
          background: color-mix(in oklab, #ef4444 8%, transparent);
        }
        .removeBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .saveActionBtn {
          border: 0;
          background: var(--primary);
          color: var(--primary-contrast);
          border-radius: 999px;
          padding: 10px 22px;
          font-weight: 700;
          cursor: pointer;
          font-size: 0.9rem;
          box-shadow: 0 8px 24px color-mix(in oklab, var(--primary) 30%, transparent);
          transition: filter 0.15s ease;
        }
        .saveActionBtn:hover {
          filter: brightness(1.07);
        }
        .saveActionBtn.isSaved {
          background: color-mix(in oklab, var(--primary) 18%, transparent);
          color: color-mix(in oklab, var(--primary) 60%, var(--text));
          box-shadow: none;
          border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border));
        }
        .saveActionBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @media (max-width: 520px) {
          .panel {
            border-radius: 20px;
          }
          .body {
            padding: 16px 18px 20px;
          }
          .foot {
            padding: 14px 18px;
          }
          h2 {
            font-size: 1.2rem;
          }
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
          </div>
          <style jsx>{`
            .skeleton {
              display: grid;
              gap: 12px;
              border-radius: 18px;
              border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
              background: color-mix(in oklab, var(--bg2) 94%, transparent);
              overflow: hidden;
            }
            .block {
              aspect-ratio: 4 / 3;
              background: linear-gradient(90deg, color-mix(in oklab, var(--bg) 88%, transparent), color-mix(in oklab, var(--bg2) 70%, transparent), color-mix(in oklab, var(--bg) 88%, transparent));
              background-size: 200% 100%;
              animation: shimmer 1.4s infinite;
            }
            .lines {
              display: grid;
              gap: 8px;
              padding: 0 16px 16px;
            }
            .lines div {
              height: 12px;
              border-radius: 8px;
              background: linear-gradient(90deg, color-mix(in oklab, var(--bg) 88%, transparent), color-mix(in oklab, var(--bg2) 70%, transparent), color-mix(in oklab, var(--bg) 88%, transparent));
              background-size: 200% 100%;
              animation: shimmer 1.4s infinite;
            }
            .lines div:last-child {
              width: 60%;
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

// snippet is kept but not rendered in cards — used for aria / search descriptions if needed
void snippet;

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : ""))
    .join(" ");
}

function parseList(text: string): string[] | undefined {
  const items = text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items.slice(0, 8) : undefined;
}

function toHtml(value: string) {
  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return null;
  return blocks.map((block) => `<p>${block.replace(/\n+/g, "<br/>")}</p>`).join("");
}

function detectMediaType(source: string | null): WorkoutContent["mediaType"] {
  if (!source) return "gif";
  const lowered = source.toLowerCase();
  if (lowered.includes(".mp4") || lowered.includes("video") || lowered.startsWith("video/")) return "mp4";
  if (lowered.includes(".png") || lowered.includes(".jpg") || lowered.includes(".jpeg") || lowered.includes(".webp")) return "image";
  return "gif";
}
