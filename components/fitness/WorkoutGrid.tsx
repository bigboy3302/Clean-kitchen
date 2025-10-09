"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Exercise } from "@/lib/workouts/types";
import type { Goal } from "@/lib/fitness/calc";
import WorkoutModal from "./WorkoutModal";
import { getWeekPlan, upsertDayItem, type WorkoutItem, type DayKey } from "@/lib/fitness/store";

type Props = {
  initialBodyPart?: string;
  title?: string;
  limit?: number;
  goal?: Goal;
};

const MIN_SEARCH_CHARS = 2;
const cache = new Map<string, Exercise[]>();

function cap(s: string) { return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function currentDayKey(date = new Date()): DayKey {
  const js = date.getDay();
  return (["sun","mon","tue","wed","thu","fri","sat"][js] as DayKey) || "mon";
}

export default function WorkoutGrid({
  initialBodyPart = "chest",
  title = "Movement library",
  limit = 12,
  goal = "maintain",
}: Props) {
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [sel, setSel] = useState<string>(initialBodyPart);
  const [q, setQ] = useState(""); const [debouncedQ, setDebouncedQ] = useState("");

  const [list, setList] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openEx, setOpenEx] = useState<Exercise | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    const id = setTimeout(()=>setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/workouts/bodyparts", { cache: "no-store" });
        const data = (await res.json()) as string[] | { error?: string };
        if (!alive) return;
        if (Array.isArray(data)) {
          setBodyParts(data);
          if (data.length && !data.includes(initialBodyPart)) setSel(data[0]);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [initialBodyPart]);

  useEffect(() => {
    let alive = true;
    setBusy(true); setErr(null);

    const hasSearch = debouncedQ.length >= MIN_SEARCH_CHARS;
    const key = hasSearch ? `q:${debouncedQ.toLowerCase()}:limit=${limit}` : `part:${sel.toLowerCase()}:limit=${limit}`;
    lastKeyRef.current = key;

    if (cache.has(key)) {
      const cached = cache.get(key)!;
      if (alive && lastKeyRef.current === key) { setList(cached); setBusy(false); }
      return;
    }

    const endpoint = hasSearch
      ? `/api/workouts?q=${encodeURIComponent(debouncedQ)}&limit=${limit}`
      : `/api/workouts?bodyPart=${encodeURIComponent(sel)}&limit=${limit}`;

    (async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const data = await res.json();
        if (!alive || lastKeyRef.current !== key) return;
        if (Array.isArray(data)) {
          const cleaned = (data as Exercise[]).filter(x => x && x.name);
          cache.set(key, cleaned); setList(cleaned);
        } else { setErr(String(data?.error || "Failed to load.")); setList([]); }
      } catch (e: any) {
        if (!alive || lastKeyRef.current !== key) return;
        setErr(e?.message || "Failed to load exercises."); setList([]);
      } finally {
        if (alive && lastKeyRef.current === key) setBusy(false);
      }
    })();

    return () => { alive = false; };
  }, [sel, debouncedQ, limit]);

  const heading = useMemo(() => {
    if (debouncedQ.length >= MIN_SEARCH_CHARS) return `Results for “${debouncedQ}”`;
    return `${cap(sel)} exercises`;
  }, [debouncedQ, sel]);

  function mediaSrc(ex: Exercise) {
    return ex.gifUrl || ex.imageThumbnailUrl || ex.imageUrl || "/placeholder.png";
  }

  function onPick(part: string) { setQ(""); setSel(part); }

  async function addToToday(ex: Exercise) {
    try {
      setAddingId(ex.id);
      const plan = await getWeekPlan();
      const day = currentDayKey();

      const item: WorkoutItem = {
        id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
        name: ex.name,
        done: false,
        exerciseId: ex.id,
        exercise: {
          id: ex.id, name: ex.name, bodyPart: ex.bodyPart, target: ex.target, equipment: ex.equipment,
          descriptionHtml: ex.descriptionHtml || "",
          imageUrl: ex.gifUrl || ex.imageUrl || "",
          imageThumbnailUrl: ex.gifUrl || ex.imageThumbnailUrl || "",
          primaryMuscles: ex.primaryMuscles?.length ? ex.primaryMuscles : (ex.target ? [ex.target] : []),
          secondaryMuscles: ex.secondaryMuscles || [],
          equipmentList: ex.equipmentList?.length ? ex.equipmentList : (ex.equipment ? [ex.equipment] : ["Bodyweight"]),
        },
      };

      await upsertDayItem(plan.weekId, day, item);
      setNotice(`Added “${cap(ex.name)}” to ${day.toUpperCase()}.`);
      setTimeout(()=>setNotice(null), 2500);
    } catch (e: any) {
      setNotice(e?.message || "Failed adding to today."); setTimeout(()=>setNotice(null), 3000);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section className="card">
      <div className="head">
        <div>
          <h3 className="h3">{title}</h3>
          <div className="sub">{heading}</div>
        </div>
        <div className="search">
          <input className="inp" placeholder="Search exercise (e.g., squat)"
            value={q} onChange={(e)=>setQ(e.currentTarget.value)} />
        </div>
      </div>

      {notice ? <div className="toast">{notice}</div> : null}

      {bodyParts.length > 0 && (
        <div className="tabs" role="tablist" aria-label="Body parts">
          {bodyParts.map((p) => (
            <button key={p} className={`tab ${sel===p?"on":""}`} onClick={()=>onPick(p)}
              role="tab" aria-selected={sel===p}>{cap(p)}</button>
          ))}
        </div>
      )}

      {busy && <p className="muted">Loading…</p>}
      {err && <p className="error">{err}</p>}
      {!busy && !err && list.length === 0 && (<p className="muted">No exercises found.</p>)}

      <div className="grid">
        {list.map((ex) => (
          <article key={`${ex.id}-${ex.name}`} className="item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaSrc(ex)}
              alt={ex.name}
              className="gif"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e)=>{(e.currentTarget as HTMLImageElement).src="/placeholder.png"}}
            />
            <div className="meta">
              <div className="name">{cap(ex.name)}</div>
              <div className="row">
                <span className="chip">{cap(ex.bodyPart)}</span>
                {ex.target ? <span className="chip alt">{cap(ex.target)}</span> : null}
                {ex.equipment ? <span className="chip ghost">{cap(ex.equipment)}</span> : null}
              </div>
              <div className="actions">
                <button className="btn ghost" onClick={()=>setOpenEx(ex)}>View</button>
                <button
                  className="btn primary"
                  disabled={addingId === ex.id}
                  onClick={() => addToToday(ex)}
                  title="Add to today's planner"
                >
                  {addingId === ex.id ? "Adding…" : "Add to today"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {openEx ? (
        <WorkoutModal
          exercise={openEx}
          onAdd={() => addToToday(openEx)}
          onClose={()=>setOpenEx(null)}
        />
      ) : null}

      <style jsx>{`
        .card{border:1px solid var(--border);background:var(--card-bg);border-radius:18px;padding:18px;box-shadow:0 18px 36px rgba(15,23,42,.06);display:flex;flex-direction:column;gap:14px}
        .head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        .h3{margin:0;font-size:20px;font-weight:800;color:var(--text)}
        .sub{color:var(--muted);font-size:13px;margin-top:2px}
        .search{flex:1; max-width: 340px; width:100%}
        .search .inp{width:100%;border:1px solid var(--border);border-radius:12px;padding:9px 12px;background:var(--bg2);color:var(--text)}
        .tabs{display:flex;gap:8px;overflow:auto;padding:6px 0 4px;margin-top:-4px}
        .tab{border:1px solid var(--border);background:var(--bg2);color:var(--text);border-radius:999px;padding:6px 12px;cursor:pointer;white-space:nowrap;font-weight:600;font-size:13px;transition:all .15s ease}
        .tab.on{background:var(--primary);border-color:var(--primary);color:var(--primary-contrast)}
        .muted{color:var(--muted)}
        .error{background:color-mix(in oklab,#ef4444 18%,var(--card-bg));color:#7f1d1d;border:1px solid color-mix(in oklab,#ef4444 45%,var(--border));border-radius:10px;padding:8px 12px;margin-top:8px;font-size:13px}
        .toast{border:1px solid color-mix(in oklab,#10b981 40%, var(--border));background:color-mix(in oklab,#10b981 12%, var(--card-bg));color:#065f46;border-radius:10px;padding:8px 12px;font-size:13px}
        .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
        @media (max-width:1200px){ .grid{grid-template-columns:repeat(3,minmax(0,1fr));} }
        @media (max-width:880px){ .grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
        @media (max-width:560px){ .grid{grid-template-columns:minmax(0,1fr);} }
        .item{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;transition:transform .18s ease, box-shadow .18s ease}
        .item:hover{transform:translateY(-2px);box-shadow:0 16px 32px rgba(15,23,42,.12)}
        .gif{width:100%;aspect-ratio:4/3;object-fit:cover;background:#000;}
        .meta{padding:14px;display:flex;flex-direction:column;gap:10px}
        .name{font-weight:800;color:var(--text);font-size:16px}
        .row{display:flex;gap:6px;flex-wrap:wrap}
        .chip{font-size:11px;background:color-mix(in oklab,var(--primary) 14%,var(--bg2));border:1px solid color-mix(in oklab,var(--primary) 35%,var(--border));border-radius:999px;padding:3px 10px;color:color-mix(in oklab,var(--primary) 45%,var(--text));font-weight:600;text-transform:capitalize}
        .chip.alt{background:color-mix(in oklab,var(--primary) 10%,transparent);border-color:color-mix(in oklab,var(--primary) 25%,var(--border));color:var(--text)}
        .chip.ghost{background:color-mix(in oklab,var(--bg2) 80%,transparent);border-color:var(--border);color:var(--muted)}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:auto;flex-wrap:wrap}
        .btn{border:1px solid var(--border);border-radius:10px;padding:7px 14px;cursor:pointer;font-weight:700}
        .btn.ghost{background:transparent;color:var(--text)}
        .btn.primary{background:var(--primary);border-color:var(--primary);color:var(--primary-contrast)}
      `}</style>
    </section>
  );
}
