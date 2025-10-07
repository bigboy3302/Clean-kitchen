
"use client";

import type { Exercise } from "@/lib/workouts/types";
import type { Goal } from "@/lib/fitness/calc";

type Props = { exercise: Exercise; goal: Goal; onClose: () => void; zIndex?: number };

export default function WorkoutModal({ exercise, goal, onClose, zIndex = 2200 }: Props) {
  const helps = explainHowItHelps(exercise, goal);

  function imgById(id: string, res = 360) {
    return `/api/workouts/gif?id=${encodeURIComponent(id)}&res=${res}`;
  }

  return (
    <div className="ov" role="dialog" aria-modal="true" onClick={onClose} style={{ zIndex }}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h3 className="title">{cap(exercise.name)}</h3>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <img
          className="gif"
          src={imgById(exercise.id)}
          alt={exercise.name}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const el = document.getElementById("gif-fallback");
            if (el) el.style.display = "block";
          }}
        />
        <div id="gif-fallback" className="fallback" style={{ display: "none" }}>
          GIF preview unavailable.
          <a
            href={imgById(exercise.id)}
            target="_blank"
            rel="noreferrer noopener"
            className="alink"
            style={{ marginLeft: 6 }}
          >
            Open image in new tab
          </a>
        </div>

        <div className="tags">
          <span className="chip">{cap(exercise.bodyPart)}</span>
          <span className="chip">{cap(exercise.target)}</span>
          <span className="chip">{cap(exercise.equipment)}</span>
        </div>

        <section className="sec">
          <h4>How this helps your goal</h4>
          <p className="p">{helps}</p>
        </section>

        <section className="sec">
          <h4>Quick form cues</h4>
          <ul className="list">
            <li>Control the full range; avoid bouncing or rushing reps.</li>
            <li>Brace your core; keep a neutral spine when applicable.</li>
            <li>Use a load that keeps 1–3 reps in reserve.</li>
            <li>Warm up first; progress weight/volume gradually.</li>
          </ul>
        </section>
      </div>

      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(64, 81, 156, 0.55);display:grid;place-items:center;padding:16px}
        .box{width:100%;max-width:880px;max-height:92vh;overflow:auto;background:#fff;border-radius:16px;border:1px solidrgb(67, 93, 146)}
        .head{position:sticky;top:0;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solidrgb(57, 90, 131)}
        .title{margin:0;font-weight:800}
        .x{border:none;background:#0f172a;color:#fff;border-radius:10px;padding:4px 10px;cursor:pointer}
        .gif{width:100%;max-height:360px;object-fit:contain;background:#f8fafc;display:block}
        .fallback{padding:10px 14px;color:#991b1b;background:#fef2f2;border-top:1px solidrgb(100, 61, 61);border-bottom:1px solidrgb(100, 79, 79)}
        .alink{color:#0f172a;text-decoration:underline}
        .tags{display:flex;gap:8px;flex-wrap:wrap;padding:10px 14px}
        .chip{font-size:12px;background:#000000;border:1px solidrgb(53, 91, 140);border-radius:999px;padding:2px 8px}
        .sec{padding:0 14px 14px}
        .p{margin:8px 0 0}
        .list{margin:8px 0 0; padding-left:18px}
      `}</style>
    </div>
  );
}

function cap(s: string) {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function explainHowItHelps(ex: Exercise, goal: Goal): string {
  const part = ex.bodyPart.toLowerCase();
  const targ = ex.target.toLowerCase();
  const equip = ex.equipment.toLowerCase();

  const strengthGain =
    "builds strength and muscle in the primary movers, supporting progressive overload over time";
  const isCardio = part.includes("cardio");
  const isCore = part.includes("waist") || targ.includes("abs") || targ.includes("core");

  let base =
    isCardio
      ? "This is a cardio-oriented movement that improves cardiovascular fitness and work capacity."
      : `This targets the ${cap(targ)} (${cap(part)}), and ${strengthGain}.`;

  if (isCore) base += " It also challenges your core and bracing.";

  if (goal === "bulk")      base += " For bulking: 3–5 sets x 6–12 reps; add small weight or reps weekly.";
  else if (goal === "cut")  base += " For cutting: 2–4 sets; keep intensity high to maintain strength; add short cardio.";
  else                      base += " For maintenance: 2–4 quality sets in a comfortable rep range.";

  if (equip.includes("barbell"))   base += " Barbell allows precise load jumps; use safety pins/spotters.";
  if (equip.includes("dumbbell"))  base += " Dumbbells help with symmetry and natural ROM.";
  if (equip.includes("kettlebell"))base += " Kettlebells: hinge from hips; keep a neutral spine.";

  return base;
}
