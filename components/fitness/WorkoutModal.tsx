"use client";

import type { Goal } from "@/lib/fitness/calc";
import type { Exercise } from "@/lib/workouts/types";

type Props = {
  exercise: Exercise;
  goal?: Goal;
  onClose: () => void;
};

export default function WorkoutModal({ exercise, goal, onClose }: Props) {
  function cap(value: string) {
    return value.length ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  const mediaSrc = exercise.gifUrl
    ? `/api/workouts/gif?src=${encodeURIComponent(exercise.gifUrl)}`
    : exercise.imageThumbnailUrl
    ? `/api/workouts/gif?src=${encodeURIComponent(exercise.imageThumbnailUrl)}`
    : exercise.imageUrl
    ? `/api/workouts/gif?src=${encodeURIComponent(exercise.imageUrl)}`
    : exercise.id
    ? `/api/workouts/gif?id=${encodeURIComponent(exercise.id)}`
    : "/placeholder.png";

  return (
    <div className="ov" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="head">
          <div className="titleWrap">
            <h3 className="title">{cap(exercise.name)}</h3>
            {goal ? <span className={`goal ${goal}`}>{goal.toUpperCase()}</span> : null}
          </div>
          <button className="close" onClick={onClose} aria-label="Close">
            {"\u00d7"}
          </button>
        </div>

        <img className="hero" src={mediaSrc} alt={exercise.name} />

        <div className="meta">
          <span className="chip">{cap(exercise.bodyPart)}</span>
          {exercise.primaryMuscles.slice(0, 2).map((muscle) => (
            <span key={muscle} className="chip alt">
              {cap(muscle)}
            </span>
          ))}
          <span className="chip ghost">{cap(exercise.equipment)}</span>
        </div>

        {exercise.descriptionHtml ? (
          <div
            className="prose"
            dangerouslySetInnerHTML={{
              __html: exercise.descriptionHtml.replace(/<[^>]+>/g, (tag) =>
                /^(<br\s*\/?>|<p>|<\/p>|<ul>|<\/ul>|<ol>|<\/ol>|<li>|<\/li>)$/i.test(tag) ? tag : ""
              ),
            }}
          />
        ) : (
          <p className="muted">No description available.</p>
        )}
      </div>

      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px;z-index:3000}
        .sheet{width:100%;max-width:760px;background:var(--card-bg);border:1px solid var(--border);border-radius:18px;box-shadow:0 24px 64px rgba(15,23,42,.35);overflow:hidden;display:flex;flex-direction:column;gap:12px}
        .head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border)}
        .titleWrap{display:flex;align-items:center;gap:8px}
        .title{margin:0;font-size:18px;font-weight:900;color:var(--text)}
        .goal{border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800}
        .goal.bulk{background:color-mix(in oklab,var(--primary) 28%,var(--bg2))}
        .goal.cut{background:color-mix(in oklab,#ef4444 28%,var(--bg2))}
        .goal.maintain{background:color-mix(in oklab,#10b981 28%,var(--bg2))}
        .close{border:0;background:var(--primary);color:var(--primary-contrast);border-radius:10px;padding:6px 10px;font-weight:800;cursor:pointer}
        .hero{width:100%;max-height:420px;object-fit:cover;background:#0b1120}
        .meta{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px}
        .chip{font-size:11px;background:color-mix(in oklab,var(--primary) 14%,var(--bg2));border:1px solid color-mix(in oklab,var(--primary) 35%,var(--border));border-radius:999px;padding:3px 10px;color:color-mix(in oklab,var(--primary) 45%,var(--text));font-weight:600;text-transform:capitalize}
        .chip.alt{background:color-mix(in oklab,var(--primary) 10%,transparent);border-color:color-mix(in oklab,var(--primary) 25%,var(--border));color:var(--text)}
        .chip.ghost{background:color-mix(in oklab,var(--bg2) 80%,transparent);border-color:var(--border);color:var(--muted)}
        .prose{padding:0 12px 12px}
        .muted{color:var(--muted);padding:0 12px 12px;margin:0}
        @media (max-width:560px){
          .sheet{max-width:100%;border-radius:14px}
          .hero{max-height:280px}
        }
      `}</style>
    </div>
  );
}
