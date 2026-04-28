"use client";

import { useEffect, useMemo, useState } from "react";
import Container from "@/components/Container";
import { addExerciseToToday } from "@/lib/fitness/store";

type WorkoutMediaType = "gif" | "mp4" | "image";

type WorkoutContent = {
  id: string;
  title: string;
  mediaUrl: string | null;
  mediaType: WorkoutMediaType;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  description: string;
  instructionsHtml?: string | null;
  bodyPart?: string | null;
  target?: string | null;
  equipment?: string | null;
  source: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipmentList?: string[];
};

type WorkoutResponse = {
  items: WorkoutContent[];
  meta?: {
    nextOffset: number | null;
    sources?: string[];
  };
};

type QuickFilter = {
  label: string;
  bodyPart?: string;
  q?: string;
};

const QUICK_FILTERS: QuickFilter[] = [
  { label: "Full body", q: "squat" },
  { label: "Chest", bodyPart: "chest" },
  { label: "Back", bodyPart: "back" },
  { label: "Legs", bodyPart: "upper legs" },
  { label: "Core", bodyPart: "waist" },
  { label: "Cardio", bodyPart: "cardio" },
];

const BODY_PARTS = ["back", "cardio", "chest", "lower arms", "lower legs", "shoulders", "upper arms", "upper legs", "waist"];
const EQUIPMENT = ["body weight", "dumbbell", "barbell", "cable", "leverage machine", "assisted", "band"];

function titleCase(value?: string | null) {
  if (!value) return "Any";
  return value
    .split(/\s+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ""))
    .join(" ");
}

function stripHtml(html?: string | null) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getExerciseCue(workout: WorkoutContent) {
  const target = workout.target ? titleCase(workout.target) : "target muscle";
  const equipment = workout.equipment ? titleCase(workout.equipment) : "Bodyweight";
  return `Focus: ${target}. Equipment: ${equipment}. Move slow, keep control, and stop if the movement hurts.`;
}

function getLevel(workout: WorkoutContent) {
  const name = workout.title.toLowerCase();
  const equipment = workout.equipment?.toLowerCase() || "";
  if (name.includes("assisted") || equipment.includes("body weight")) return "Beginner";
  if (equipment.includes("barbell") || equipment.includes("weighted")) return "Advanced";
  return "Intermediate";
}

function buildUrl(query: string, bodyPart: string, equipment: string, offset = 0) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (bodyPart) params.set("bodyPart", bodyPart);
  if (equipment) params.set("equipment", equipment);
  params.set("limit", "12");
  if (offset) params.set("offset", String(offset));
  return `/api/workouts/search?${params.toString()}`;
}

const BODY_PART_STYLE: Record<string, { bg: string; emoji: string }> = {
  chest:       { bg: "linear-gradient(135deg,#e8d5f5,#c4a8e8)", emoji: "💪" },
  back:        { bg: "linear-gradient(135deg,#d5ecd9,#88c49a)", emoji: "🏋️" },
  "upper legs":{ bg: "linear-gradient(135deg,#fde8cc,#f5c88a)", emoji: "🦵" },
  "lower legs":{ bg: "linear-gradient(135deg,#fde8cc,#e8b06a)", emoji: "🦵" },
  shoulders:   { bg: "linear-gradient(135deg,#cce8f5,#8ac8e8)", emoji: "🤸" },
  "upper arms":{ bg: "linear-gradient(135deg,#fde0d5,#f5a898)", emoji: "💪" },
  "lower arms":{ bg: "linear-gradient(135deg,#fde0d5,#e89078)", emoji: "🤜" },
  waist:       { bg: "linear-gradient(135deg,#f5f0cc,#e8d878)", emoji: "🧘" },
  cardio:      { bg: "linear-gradient(135deg,#ffd5d5,#f58a8a)", emoji: "🏃" },
};

function ExerciseVisual({ workout, large = false }: { workout: WorkoutContent; large?: boolean }) {
  const part = (workout.bodyPart || "").toLowerCase();
  const style = BODY_PART_STYLE[part] ?? { bg: "linear-gradient(135deg,#e8ecd5,#bcc8a0)", emoji: "🏅" };
  const cls = large ? "exerciseVisual large" : "exerciseVisual";
  return (
    <div className={cls} style={{ background: style.bg }}>
      <span className="exerciseEmoji" aria-hidden>{style.emoji}</span>
      <span className="exerciseBodyLabel">{titleCase(workout.bodyPart)}</span>
      <span className="exerciseTargetLabel">{titleCase(workout.target)}</span>
    </div>
  );
}

export default function FitnessPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipment, setEquipment] = useState("");
  const [items, setItems] = useState<WorkoutContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutContent | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 350);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl(debouncedQuery, bodyPart, equipment), { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load workouts. Check your workout API key and try again.");
        const data = (await res.json()) as WorkoutResponse;
        if (!alive) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setNextOffset(data.meta?.nextOffset ?? null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load workouts.");
        setItems([]);
        setNextOffset(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [debouncedQuery, bodyPart, equipment]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const summary = useMemo(() => {
    const visible = items.length;
    const withGif = items.filter((item) => item.mediaUrl || item.previewUrl).length;
    return { visible, withGif };
  }, [items]);

  async function loadMore() {
    if (nextOffset === null || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(debouncedQuery, bodyPart, equipment, nextOffset), { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load more workouts.");
      const data = (await res.json()) as WorkoutResponse;
      setItems((prev) => [...prev, ...(Array.isArray(data.items) ? data.items : [])]);
      setNextOffset(data.meta?.nextOffset ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more workouts.");
    } finally {
      setLoading(false);
    }
  }

  async function addToToday(workout: WorkoutContent) {
    try {
      await addExerciseToToday({
        id: workout.id,
        name: workout.title,
        bodyPart: workout.bodyPart || undefined,
        target: workout.target || undefined,
        equipment: workout.equipment || undefined,
        gifUrl: workout.mediaUrl || undefined,
        descriptionHtml: workout.instructionsHtml ?? workout.description,
      });
      setToast(`Added ${workout.title} to today's planner`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not add exercise to today.");
    }
  }

  function applyQuickFilter(filter: QuickFilter) {
    setQuery(filter.q || "");
    setBodyPart(filter.bodyPart || "");
    setEquipment("");
  }

  return (
    <Container as="main" className="fitnessStudio">
      <section className="fitnessHero">
        <div>
          <p className="pageEyebrow">Workout library</p>
          <h1>Learn exercises with visual demos.</h1>
          <p className="heroText">
            Search by movement, muscle group, or equipment. Each card is designed to show what the workout is, what it trains,
            and how to start without getting confused.
          </p>
        </div>

        <div className="heroStats" aria-label="Workout result summary">
          <div>
            <strong>{summary.visible}</strong>
            <span>shown</span>
          </div>
          <div>
            <strong>{summary.withGif}</strong>
            <span>visual demos</span>
          </div>
          <div>
            <strong>{bodyPart ? titleCase(bodyPart) : "All"}</strong>
            <span>focus</span>
          </div>
        </div>
      </section>

      <section className="searchPanel" aria-label="Find workouts">
        <label className="searchBox">
          <span>Search workout</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try push-up, squat, curl..." />
        </label>

        <label className="selectBox">
          <span>Body part</span>
          <select value={bodyPart} onChange={(event) => setBodyPart(event.target.value)}>
            <option value="">Any body part</option>
            {BODY_PARTS.map((part) => (
              <option key={part} value={part}>
                {titleCase(part)}
              </option>
            ))}
          </select>
        </label>

        <label className="selectBox">
          <span>Equipment</span>
          <select value={equipment} onChange={(event) => setEquipment(event.target.value)}>
            <option value="">Any equipment</option>
            {EQUIPMENT.map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="quickStart" aria-label="Quick workout filters">
        <div>
          <p className="sectionLabel">Start simple</p>
          <h2>Pick a goal and see workouts instantly.</h2>
        </div>
        <div className="quickChips">
          {QUICK_FILTERS.map((filter) => {
            const active = (filter.bodyPart && filter.bodyPart === bodyPart) || (filter.q && filter.q === query);
            return (
              <button key={filter.label} type="button" className={active ? "quickChip active" : "quickChip"} onClick={() => applyQuickFilter(filter)}>
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      {error ? <div className="errorBox">{error}</div> : null}

      <section className="workoutGrid" aria-live="polite">
        {loading && items.length === 0
          ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeletonCard" />)
          : items.map((workout) => (
              <article key={workout.id} className="workoutCard">
                <div className="mediaWrap">
                  <ExerciseVisual workout={workout} />
                  <span className="levelBadge">{getLevel(workout)}</span>
                </div>

                <div className="workoutBody">
                  <div className="workoutTitleRow">
                    <h3>{workout.title}</h3>
                    <span>{titleCase(workout.bodyPart)}</span>
                  </div>

                  <p>{workout.description || getExerciseCue(workout)}</p>

                  <div className="metaRow">
                    <span>{titleCase(workout.target)}</span>
                    <span>{titleCase(workout.equipment || "body weight")}</span>
                  </div>

                  <div className="cardActions">
                    <button type="button" className="primaryAction" onClick={() => setActiveWorkout(workout)}>
                      View demo
                    </button>
                    <button type="button" className="ghostAction" onClick={() => void addToToday(workout)}>
                      Add today
                    </button>
                  </div>
                </div>
              </article>
            ))}
      </section>

      {!loading && items.length === 0 ? (
        <section className="emptyState">
          <h2>No workouts found</h2>
          <p>Try a simpler search like “push”, “squat”, “curl”, or select only one body part.</p>
          <button type="button" onClick={() => { setQuery(""); setBodyPart(""); setEquipment(""); }}>
            Reset search
          </button>
        </section>
      ) : null}

      {nextOffset !== null ? (
        <div className="loadMore">
          <button type="button" onClick={() => void loadMore()} disabled={loading}>
            {loading ? "Loading..." : "Load more workouts"}
          </button>
        </div>
      ) : null}

      {activeWorkout ? (
        <div className="detailOverlay" role="dialog" aria-modal="true" aria-label={`${activeWorkout.title} workout demo`} onClick={() => setActiveWorkout(null)}>
          <article className="detailModal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="closeModal" onClick={() => setActiveWorkout(null)}>
              Close
            </button>

            <div className="detailMedia">
              <ExerciseVisual workout={activeWorkout} large />
            </div>

            <div className="detailContent">
              <p className="pageEyebrow">Exercise demo</p>
              <h2>{activeWorkout.title}</h2>
              <p className="detailDescription">{activeWorkout.description || getExerciseCue(activeWorkout)}</p>

              <div className="detailFacts">
                <span><b>Body</b>{titleCase(activeWorkout.bodyPart)}</span>
                <span><b>Muscle</b>{titleCase(activeWorkout.target)}</span>
                <span><b>Equipment</b>{titleCase(activeWorkout.equipment || "body weight")}</span>
              </div>

              <div className="coachBox">
                <h3>How to use this workout</h3>
                <ol>
                  <li>Watch the visual demo first so you understand the movement path.</li>
                  <li>Start with light weight or bodyweight and keep every rep controlled.</li>
                  <li>Use 2–4 sets of 8–12 reps for strength, or 30–45 seconds for cardio/core.</li>
                </ol>
              </div>

              {stripHtml(activeWorkout.instructionsHtml) ? (
                <div className="instructionsBox">
                  <h3>Extra instructions</h3>
                  <p>{stripHtml(activeWorkout.instructionsHtml)}</p>
                </div>
              ) : null}

              <button type="button" className="primaryAction wide" onClick={() => void addToToday(activeWorkout)}>
                Add to today&apos;s planner
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}

      <style jsx>{`
        .fitnessStudio {
          display: grid;
          gap: 22px;
          padding: clamp(18px, 2vw, 30px);
          color: var(--text);
        }

        .fitnessHero,
        .searchPanel,
        .quickStart,
        .emptyState {
          border-radius: 30px;
          background:
            radial-gradient(circle at 90% 0%, color-mix(in oklab, var(--primary) 13%, transparent), transparent 28%),
            color-mix(in oklab, var(--bg-raised) 92%, var(--bg) 8%);
          box-shadow: 0 24px 70px color-mix(in oklab, var(--bg) 70%, rgba(15, 23, 42, 0.16));
          border: 1px solid color-mix(in oklab, var(--border) 72%, transparent);
        }

        .fitnessHero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: end;
          padding: clamp(24px, 3vw, 42px);
          overflow: hidden;
        }

        .pageEyebrow,
        .sectionLabel {
          margin: 0 0 10px;
          color: var(--primary);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .fitnessHero h1 {
          margin: 0;
          max-width: 760px;
          font-size: clamp(2.2rem, 5vw, 5.2rem);
          line-height: 0.9;
          letter-spacing: -0.08em;
          font-weight: 950;
        }

        .heroText {
          max-width: 680px;
          margin: 18px 0 0;
          color: var(--muted);
          font-size: 1rem;
          line-height: 1.75;
        }

        .heroStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(105px, 1fr));
          gap: 10px;
        }

        .heroStats div {
          min-width: 105px;
          border-radius: 22px;
          padding: 16px;
          background: color-mix(in oklab, var(--bg) 65%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
        }

        .heroStats strong {
          display: block;
          font-size: 24px;
          line-height: 1;
          letter-spacing: -0.05em;
        }

        .heroStats span {
          display: block;
          margin-top: 7px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .searchPanel {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(180px, 240px) minmax(180px, 240px);
          gap: 12px;
          padding: 16px;
        }

        .searchBox,
        .selectBox {
          display: grid;
          gap: 8px;
          border-radius: 20px;
          padding: 12px 14px;
          background: color-mix(in oklab, var(--bg) 78%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
        }

        .searchBox span,
        .selectBox span {
          color: var(--muted);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .searchBox input,
        .selectBox select {
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--text);
          font: inherit;
          font-weight: 750;
        }

        .quickStart {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 20px;
        }

        .quickStart h2 {
          margin: 0;
          font-size: 1.45rem;
          letter-spacing: -0.055em;
        }

        .quickChips {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .quickChip,
        .primaryAction,
        .ghostAction,
        .loadMore button,
        .emptyState button,
        .closeModal {
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-weight: 900;
          transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
        }

        .quickChip {
          padding: 10px 14px;
          color: var(--text);
          background: color-mix(in oklab, var(--bg) 72%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
        }

        .quickChip:hover,
        .quickChip.active {
          transform: translateY(-1px);
          color: var(--primary-contrast);
          background: var(--primary);
        }

        .workoutGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .workoutCard {
          overflow: hidden;
          border-radius: 30px;
          background: color-mix(in oklab, var(--bg-raised) 94%, var(--bg) 6%);
          border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
          box-shadow: 0 20px 58px color-mix(in oklab, var(--bg) 70%, rgba(15, 23, 42, 0.16));
        }

        .mediaWrap {
          position: relative;
          height: 230px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 42%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 34%),
            color-mix(in oklab, var(--bg) 82%, #111 18%);
        }

        .exerciseVisual {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: inherit;
        }

        .exerciseEmoji {
          font-size: 52px;
          line-height: 1;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.12));
        }

        .exerciseBodyLabel {
          font-size: 13px;
          font-weight: 800;
          color: rgba(23,25,21,0.75);
          letter-spacing: -0.02em;
        }

        .exerciseTargetLabel {
          font-size: 11px;
          font-weight: 600;
          color: rgba(23,25,21,0.5);
        }

        .levelBadge {
          position: absolute;
          left: 14px;
          top: 14px;
          border-radius: 999px;
          padding: 7px 10px;
          color: var(--primary-contrast);
          background: var(--primary);
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .workoutBody {
          display: grid;
          gap: 14px;
          padding: 18px;
        }

        .workoutTitleRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .workoutTitleRow h3 {
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.08;
          letter-spacing: -0.055em;
        }

        .workoutTitleRow span,
        .metaRow span {
          flex-shrink: 0;
          border-radius: 999px;
          padding: 7px 10px;
          background: color-mix(in oklab, var(--primary) 12%, transparent);
          color: var(--primary);
          font-size: 11px;
          font-weight: 900;
        }

        .workoutBody p {
          margin: 0;
          min-height: 3.7em;
          color: var(--muted);
          line-height: 1.55;
          font-size: 0.92rem;
        }

        .metaRow {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .cardActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .primaryAction {
          padding: 11px 14px;
          color: var(--primary-contrast);
          background: var(--primary);
        }

        .ghostAction {
          padding: 11px 14px;
          color: var(--text);
          background: color-mix(in oklab, var(--bg) 72%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
        }

        .primaryAction:hover,
        .ghostAction:hover,
        .loadMore button:hover,
        .emptyState button:hover {
          transform: translateY(-1px);
        }

        .wide {
          width: 100%;
          margin-top: 6px;
        }

        .skeletonCard {
          height: 430px;
          border-radius: 30px;
          background: linear-gradient(90deg, color-mix(in oklab, var(--bg-raised) 88%, transparent), color-mix(in oklab, var(--border) 25%, transparent), color-mix(in oklab, var(--bg-raised) 88%, transparent));
          background-size: 240% 100%;
          animation: shimmer 1.3s linear infinite;
        }

        @keyframes shimmer {
          to { background-position: -240% 0; }
        }

        .errorBox,
        .toast {
          border-radius: 18px;
          padding: 14px 16px;
          color: var(--text);
          background: color-mix(in oklab, #ef4444 12%, var(--bg-raised));
          border: 1px solid color-mix(in oklab, #ef4444 26%, transparent);
        }

        .emptyState {
          padding: 36px;
          text-align: center;
        }

        .emptyState h2 {
          margin: 0 0 8px;
        }

        .emptyState p {
          margin: 0 auto 18px;
          max-width: 460px;
          color: var(--muted);
          line-height: 1.6;
        }

        .emptyState button,
        .loadMore button {
          padding: 12px 18px;
          color: var(--primary-contrast);
          background: var(--primary);
        }

        .loadMore {
          display: grid;
          place-items: center;
          padding: 8px 0 22px;
        }

        .loadMore button:disabled {
          opacity: 0.65;
          cursor: default;
        }

        .detailOverlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(2, 6, 23, 0.62);
          backdrop-filter: blur(12px);
        }

        .detailModal {
          position: relative;
          width: min(1060px, 100%);
          max-height: 92dvh;
          overflow: auto;
          display: grid;
          grid-template-columns: minmax(320px, 0.95fr) minmax(320px, 1.05fr);
          gap: 0;
          border-radius: 34px;
          background: var(--bg-raised);
          color: var(--text);
          box-shadow: 0 36px 120px rgba(0, 0, 0, 0.34);
        }

        .closeModal {
          position: absolute;
          right: 18px;
          top: 18px;
          z-index: 2;
          padding: 10px 14px;
          color: var(--text);
          background: color-mix(in oklab, var(--bg) 82%, transparent);
        }

        .detailMedia {
          min-height: 560px;
          padding: 24px;
          background:
            radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 38%),
            color-mix(in oklab, var(--bg) 84%, #111 16%);
        }

        .exerciseVisual.large {
          border-radius: 24px;
        }

        .exerciseVisual.large .exerciseEmoji {
          font-size: 96px;
        }

        .exerciseVisual.large .exerciseBodyLabel {
          font-size: 18px;
        }

        .exerciseVisual.large .exerciseTargetLabel {
          font-size: 14px;
        }

        .detailContent {
          display: grid;
          align-content: start;
          gap: 18px;
          padding: 42px;
        }

        .detailContent h2 {
          margin: 0;
          font-size: clamp(2rem, 4vw, 4rem);
          line-height: 0.92;
          letter-spacing: -0.08em;
        }

        .detailDescription {
          margin: 0;
          color: var(--muted);
          line-height: 1.7;
        }

        .detailFacts {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .detailFacts span {
          display: grid;
          gap: 6px;
          border-radius: 18px;
          padding: 14px;
          background: color-mix(in oklab, var(--bg) 72%, transparent);
        }

        .detailFacts b {
          color: var(--muted);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .coachBox,
        .instructionsBox {
          border-radius: 24px;
          padding: 18px;
          background: color-mix(in oklab, var(--bg) 72%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 62%, transparent);
        }

        .coachBox h3,
        .instructionsBox h3 {
          margin: 0 0 10px;
          letter-spacing: -0.045em;
        }

        .coachBox ol {
          margin: 0;
          padding-left: 20px;
          color: var(--muted);
          line-height: 1.7;
        }

        .instructionsBox p {
          margin: 0;
          color: var(--muted);
          line-height: 1.7;
        }

        .toast {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 1300;
          background: var(--primary);
          color: var(--primary-contrast);
          border: 0;
          box-shadow: 0 18px 50px color-mix(in oklab, var(--primary) 24%, transparent);
          font-weight: 900;
        }

        @media (max-width: 1120px) {
          .fitnessHero,
          .searchPanel,
          .quickStart,
          .detailModal {
            grid-template-columns: 1fr;
          }
          .heroStats {
            width: 100%;
          }
          .workoutGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .detailMedia {
            min-height: 360px;
          }
        }

        @media (max-width: 720px) {
          .fitnessStudio {
            padding: 14px;
          }
          .workoutGrid,
          .heroStats,
          .detailFacts {
            grid-template-columns: 1fr;
          }
          .quickStart {
            display: grid;
          }
          .quickChips {
            justify-content: flex-start;
          }
          .mediaWrap {
            height: 210px;
          }
          .detailContent {
            padding: 24px;
          }
        }
      `}</style>
    </Container>
  );
}
