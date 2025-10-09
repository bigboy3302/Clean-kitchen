"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Goal } from "@/lib/fitness/calc";
import {
  getWeekPlan,
  upsertDayItem,
  type WorkoutItem,
  type DayKey,
} from "@/lib/fitness/store";

// Local helpers
const MIN_SEARCH_CHARS = 2;
const cache = new Map<string, Exercise[]>();

type Exercise = {
  id: string;
  name: string;
  bodyPart: string;          // ExerciseDB uses bodyPart; we show it as a chip
  target: string;            // ExerciseDB’s main target (e.g., “cardio”, “biceps”)
  equipment: string;
  gifUrl: string;            // e.g., https://d205bpvrqc9yn1.cloudfront.net/0001.gif
  imageUrl: string | null;   // (legacy compatibility)
  imageThumbnailUrl: string | null;
  descriptionHtml: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipmentList: string[];
};

type Props = {
  initialBodyPart?: string; // kept for backwards compat; here we treat it as initial target
  title?: string;
  limit?: number;
  goal?: Goal;
};

export default function WorkoutGrid({
  initialBodyPart = "back",
  title = "Exercise Library",
  limit = 12,
  goal = "maintain",
}: Props) {
  const [targets, setTargets] = useState<string[]>([]);
  const [sel, setSel] = useState<string>(initialBodyPart);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [list, setList] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openEx, setOpenEx] = useState<Exercise | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const lastKeyRef = useRef<string>("");

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 450);
    return () => clearTimeout(id);
  }, [q]);

  // Load targets for tabs (ExerciseDB “targetList” mapped on server to /api/workouts/bodyparts)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/workouts/bodyparts", { cache: "no-store" });
        const data = (await res.json()) as string[] | { error?: string };
        if (!alive) return;
        if (Array.isArray(data)) {
          setTargets(data);
          if (data.length && !data.includes(initialBodyPart)) setSel(data[0]);
        } else {
          setTargets([]);
        }
      } catch {
        if (alive) setTargets([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialBodyPart]);

  // Load exercises
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setErr(null);

    const hasSearch = debouncedQ.length >= MIN_SEARCH_CHARS;
    const key = hasSearch
      ? `q:${debouncedQ.toLowerCase()}:limit=${limit}`
      : `target:${sel.toLowerCase()}:limit=${limit}`;

    lastKeyRef.current = key;

    if (cache.has(key)) {
      const cached = cache.get(key)!;
      if (alive && lastKeyRef.current === key) {
        setList(cached);
        setBusy(false);
      }
      return;
    }

    const endpoint = hasSearch
      ? `/api/workouts?q=${encodeURIComponent(debouncedQ)}&limit=${limit}`
      : `/api/workouts?target=${encodeURIComponent(sel)}&limit=${limit}`;

    (async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const data = await res.json();
        if (!alive || lastKeyRef.current !== key) return;

        if (Array.isArray(data)) {
          // ensure name is present
          const cleaned = (data as Exercise[]).filter((x) => x && x.name);
          cache.set(key, cleaned);
          setList(cleaned);
        } else {
          setErr(String((data as any)?.error || "Failed to load."));
          setList([]);
        }
      } catch (e: any) {
        if (!alive || lastKeyRef.current !== key) return;
        setErr(e?.message || "Failed to load exercises.");
        setList([]);
      } finally {
        if (alive && lastKeyRef.current === key) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sel, debouncedQ, limit]);

  // add picked exercise to today's planner
  async function addToToday(ex: Exercise) {
    try {
      const plan = await getWeekPlan();
      const today: DayKey = getTodayKey();

      const item: WorkoutItem = {
        id: crypto.randomUUID(),
        name: ex.name,
        done: false,
        // store minimal exercise meta so Day page can render details and GIFs
        exercise: {
          id: ex.id,
          name: ex.name,
          bodyPart: ex.bodyPart,
          target: ex.target,
          equipment: ex.equipment,
          imageUrl: ex.gifUrl || ex.imageUrl || null,
          imageThumbnailUrl: ex.gifUrl || ex.imageThumbnailUrl || null,
          descriptionHtml: ex.descriptionHtml,
          primaryMuscles: ex.primaryMuscles,
          secondaryMuscles: ex.secondaryMuscles,
          equipmentList: ex.equipmentList?.length ? ex.equipmentList : [ex.equipment],
        } as any,
      };

      await upsertDayItem(plan.weekId, today, item);
      setToast(`Added “${ex.name}” to Today`);
      setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      setToast(e?.message || "Failed to add to Today");
      setTimeout(() => setToast(null), 2200);
    }
  }

  function onPick(target: string) {
    setQ("");
    setSel(target);
  }

  const heading = useMemo(() => {
    if (debouncedQ.length >= MIN_SEARCH_CHARS) return `Results for “${debouncedQ}”`;
    return `${cap(sel)} exercises`;
  }, [debouncedQ, sel]);

  function mediaSrc(ex: Exercise) {
    // Prefer ExerciseDB direct GIF; falls back to imageUrl or placeholder
    if (ex.gifUrl) return ex.gifUrl;
    if (ex.imageUrl) return ex.imageUrl;
    return "/placeholder.png";
  }

  function snippet(html: string) {
    const text = (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > 160 ? `${text.slice(0, 160)}…` : text || "No description available.";
  }

  return (
    <section className="card">
      <div className="head">
        <div>
          <h3 className="h3">{title}</h3>
          <div className="sub">{heading}</div>
        </div>
        <div className="search">
          <input
            className="inp"
            placeholder="Search exercise name (e.g., squat)"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
        </div>
      </div>

      {targets.length > 0 && (
        <div className="tabs" role="tablist" aria-label="Targets">
          {targets.map((t) => (
            <button
              key={t}
              className={`tab ${sel === t ? "on" : ""}`}
              onClick={() => onPick(t)}
              role="tab"
              aria-selected={sel === t}
            >
              {cap(t)}
            </button>
          ))}
        </div>
      )}

      {busy && <p className="muted">Loading…</p>}
      {err && <p className="error">{err}</p>}
      {!busy && !err && list.length === 0 && (
        <p className="muted">No exercises found. Try another search or target.</p>
      )}

      <div className="grid">
        {list.map((ex) => (
          <article key={`${ex.id}-${ex.name}`} className="item">
            {/* We use <img> (not next/image) because these are external GIFs */}
            <img
              src={mediaSrc(ex)}
              alt={ex.name}
              className="gif"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/placeholder.png";
              }}
            />
            <div className="meta">
              <div className="name">{cap(ex.name)}</div>
              <p className="desc">{snippet(ex.descriptionHtml)}</p>
              <div className="row">
                <span className="chip">{cap(ex.bodyPart || ex.target)}</span>
                {ex.primaryMuscles?.slice(0, 2).map((mus) => (
                  <span key={mus} className="chip alt">
                    {cap(mus)}
                  </span>
                ))}
                {ex.equipment ? <span className="chip ghost">{cap(ex.equipment)}</span> : null}
              </div>

              <div className="actions">
                <button className="btn ghost" onClick={() => setOpenEx(ex)}>
                  View
                </button>
                <button className="btn primary" onClick={() => addToToday(ex)}>
                  Add to Today
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Simple modal */}
      {openEx ? (
        <div className="ov" role="dialog" aria-modal="true" onClick={() => setOpenEx(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <div className="mt">{cap(openEx.name)}</div>
              <button className="x" onClick={() => setOpenEx(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="mbody">
              <img
                src={mediaSrc(openEx)}
                alt={openEx.name}
                className="modalGif"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/placeholder.png";
                }}
              />
              <div className="chipsRow">
                <span className="chip">{cap(openEx.bodyPart || openEx.target)}</span>
                {openEx.primaryMuscles?.slice(0, 3).map((m) => (
                  <span key={m} className="chip alt">
                    {cap(m)}
                  </span>
                ))}
                {openEx.equipment ? <span className="chip ghost">{cap(openEx.equipment)}</span> : null}
              </div>
              {openEx.descriptionHtml ? (
                <div
                  className="prose"
                  dangerouslySetInnerHTML={{ __html: openEx.descriptionHtml }}
                />
              ) : (
                <p className="muted">No description available.</p>
              )}
            </div>
            <div className="mactions">
              <button className="btn ghost" onClick={() => setOpenEx(null)}>
                Close
              </button>
              <button
                className="btn primary"
                onClick={async () => {
                  await addToToday(openEx);
                  setOpenEx(null);
                }}
              >
                Add to Today
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}

      <style jsx>{`
        .card{border:1px solid var(--border);background:var(--card-bg);border-radius:18px;padding:18px;box-shadow:0 18px 36px rgba(15,23,42,.06);display:flex;flex-direction:column;gap:14px}
        .head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        .h3{margin:0;font-size:20px;font-weight:800;color:var(--text)}
        .sub{color:var(--muted);font-size:13px;margin-top:2px}
        .search{flex:1;max-width:320px}
        .search .inp{width:100%;border:1px solid var(--border);border-radius:12px;padding:9px 12px;background:var(--bg2);color:var(--text)}
        .search .inp::placeholder{color:var(--muted)}

        .tabs{display:flex;gap:8px;overflow:auto;padding:6px 0 4px;margin-top:-4px}
        .tab{border:1px solid var(--border);background:var(--bg2);color:var(--text);border-radius:999px;padding:6px 12px;cursor:pointer;white-space:nowrap;font-weight:600;font-size:13px;transition:all .15s ease}
        .tab.on{background:var(--primary);border-color:var(--primary);color:var(--primary-contrast);box-shadow:0 8px 20px rgba(37,99,235,.22)}
        .tab:not(.on):hover{border-color:color-mix(in oklab,var(--primary) 30%,var(--border));color:color-mix(in oklab,var(--primary) 40%,var(--text))}
        .muted{color:var(--muted)}
        .error{background:color-mix(in oklab,#ef4444 18%,var(--card-bg));color:#7f1d1d;border:1px solid color-mix(in oklab,#ef4444 45%,var(--border));border-radius:10px;padding:8px 12px;margin-top:8px;font-size:13px}

        /* responsive grid */
        .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
        @media (max-width:1200px){ .grid{grid-template-columns:repeat(3,minmax(0,1fr));} }
        @media (max-width:880px){ .grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
        @media (max-width:560px){ .grid{grid-template-columns:minmax(0,1fr);} }

        .item{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;transition:transform .18s ease, box-shadow .18s ease}
        .item:hover{transform:translateY(-2px);box-shadow:0 16px 32px rgba(15,23,42,.14)}
        .gif{width:100%;aspect-ratio:4/3;object-fit:cover;background:linear-gradient(135deg,#0f172a,#1e293b);}

        .meta{padding:14px;display:flex;flex-direction:column;gap:10px}
        .name{font-weight:800;color:var(--text);font-size:16px}
        .desc{margin:0;color:var(--muted);font-size:13px;line-height:1.4;min-height:36px}
        .row{display:flex;gap:6px;flex-wrap:wrap}
        .chip{font-size:11px;background:color-mix(in oklab,var(--primary) 14%,var(--bg2));border:1px solid color-mix(in oklab,var(--primary) 35%,var(--border));border-radius:999px;padding:3px 10px;color:color-mix(in oklab,var(--primary) 45%,var(--text));font-weight:600;text-transform:capitalize}
        .chip.alt{background:color-mix(in oklab,var(--primary) 10%,transparent);border-color:color-mix(in oklab,var(--primary) 25%,var(--border));color:var(--text)}
        .chip.ghost{background:color-mix(in oklab,var(--bg2) 80%,transparent);border-color:var(--border);color:var(--muted)}

        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:auto;flex-wrap:wrap}
        .btn{border:1px solid var(--border);border-radius:10px;padding:7px 12px;font-weight:800;cursor:pointer;background:var(--bg2);color:var(--text)}
        .btn.ghost{background:var(--bg2)}
        .btn.primary{background:var(--primary);color:var(--primary-contrast);border-color:var(--primary)}
        .btn:hover{transform:translateY(-1px)}

        /* modal */
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px;z-index:2200}
        .modal{width:100%;max-width:720px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
        .mh{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border)}
        .mt{font-weight:900}
        .x{border:none;background:var(--primary);color:var(--primary-contrast);border-radius:10px;padding:4px 10px;cursor:pointer}
        .mbody{padding:12px;display:flex;flex-direction:column;gap:10px}
        .modalGif{width:100%;border-radius:12px;border:1px solid var(--border);object-fit:cover;max-height:420px}
        .chipsRow{display:flex;gap:6px;flex-wrap:wrap}
        .prose :global(p){margin:0 0 8px;color:var(--text);line-height:1.6}
        .prose :global(ul), .prose :global(ol){padding-left:18px;margin:0 0 8px}
        .mactions{display:flex;justify-content:flex-end;gap:8px;padding:10px 12px;border-top:1px solid var(--border)}

        .toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:var(--card-bg);border:1px solid var(--border);padding:8px 12px;border-radius:10px;box-shadow:0 10px 24px rgba(15,23,42,.22);z-index:2300}
      `}</style>
    </section>
  );
}

function cap(s: string) {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function getTodayKey(date = new Date()): DayKey {
  const js = date.getDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"][js] as DayKey) || "mon";
}
