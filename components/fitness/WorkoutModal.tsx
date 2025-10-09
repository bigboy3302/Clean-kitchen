"use client";

import type { Exercise } from "@/lib/workouts/types";

type Props = {
  exercise: Exercise;
  onAdd?: () => void;
  onClose: () => void;
};

function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

export default function WorkoutModal({ exercise, onAdd, onClose }: Props) {
  const src = exercise.gifUrl || exercise.imageThumbnailUrl || exercise.imageUrl || "/placeholder.png";

  return (
    <div className="ov" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="box" onClick={(e)=>e.stopPropagation()}>
        <div className="bh">
          <div className="bt">{cap(exercise.name)}</div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="body">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero" src={src} alt={exercise.name} loading="eager"
               onError={(e)=>{(e.currentTarget as HTMLImageElement).src="/placeholder.png"}} />
          <div className="chips">
            <span className="chip">{cap(exercise.bodyPart)}</span>
            {exercise.target ? <span className="chip alt">{cap(exercise.target)}</span> : null}
            {exercise.equipment ? <span className="chip ghost">{cap(exercise.equipment)}</span> : null}
          </div>
          <div className="actions">
            {onAdd ? <button className="btn primary" onClick={onAdd}>Add to today</button> : null}
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.6);display:grid;place-items:center;padding:12px;z-index:3000}
        .box{width:100%;max-width:720px;background:var(--card-bg);border-radius:16px;border:1px solid var(--border);overflow:hidden;display:flex;flex-direction:column}
        .bh{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding:10px 12px}
        .bt{font-weight:900}
        .x{border:none;background:transparent;color:var(--text);border-radius:8px;padding:4px 8px;cursor:pointer}
        .body{padding:12px;display:flex;flex-direction:column;gap:12px}
        .hero{width:100%;max-height:70vh;object-fit:contain;background:#000;border-radius:12px;border:1px solid var(--border)}
        .chips{display:flex;gap:8px;flex-wrap:wrap}
        .chip{font-size:12px;background:color-mix(in oklab,var(--primary) 14%,var(--bg2));border:1px solid color-mix(in oklab,var(--primary) 35%,var(--border));border-radius:999px;padding:4px 10px;color:color-mix(in oklab,var(--primary) 45%,var(--text));font-weight:700}
        .chip.alt{background:color-mix(in oklab,var(--primary) 10%,transparent);border-color:color-mix(in oklab,var(--primary) 25%,var(--border));}
        .chip.ghost{background:color-mix(in oklab,var(--bg2) 80%,transparent);border-color:var(--border);color:var(--muted)}
        .actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
        .btn{border:1px solid var(--border);border-radius:10px;padding:8px 14px;cursor:pointer;font-weight:800;background:transparent;color:var(--text)}
        .btn.primary{background:var(--primary);border-color:var(--primary);color:var(--primary-contrast)}
        @media (max-width:560px){
          .box{max-width:100%;height:100%;border-radius:0}
          .body{padding:10px}
          .hero{max-height:60vh}
        }
      `}</style>
    </div>
  );
}
