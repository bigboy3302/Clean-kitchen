"use client";

import { useMemo, useState } from "react";

/* ---------- types ---------- */

export type IngredientObj = {
  name: string;
  measure?: string | null;
};

type PanelPlacement = "push" | "overlay-left" | "overlay-right";

export type RecipeCardProps = {
  title: string;
  imageUrl: string;
  description?: string;
  ingredients?: IngredientObj[];   // structured
  steps?: string[];                // lines of text
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  panelPlacement: PanelPlacement;

  minutes?: number | null;         // optional meta
  baseServings?: number | null;    // base to scale from

  /* NEW: favorites */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

/* ---------- helpers: number parsing/scaling ---------- */

function parseNumber(txt: string): number | null {
  const t = txt.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  let total = 0;
  for (const p of parts) {
    if (/^\d+(\.\d+)?$/.test(p)) total += parseFloat(p);
    else if (/^\d+\/\d+$/.test(p)) {
      const [a, b] = p.split("/").map(Number);
      if (b) total += a / b;
    }
  }
  return total > 0 ? total : null;
}

function splitMeasure(m?: string | null) {
  if (!m) return { value: null as number | null, unit: "" };
  const match = m.match(/^\s*([0-9.\s/]+)\s*(.*)$/);
  if (!match) return { value: null, unit: (m || "").trim() };
  const value = parseNumber(match[1] || "");
  const unit = (match[2] || "").trim();
  return { value, unit };
}

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : String(r);
}

/* ---------- component ---------- */

export default function RecipeCard({
  title,
  imageUrl,
  description,
  ingredients = [],
  steps = [],
  open,
  onOpen,
  onClose,
  panelPlacement,
  minutes = null,
  baseServings = 2,

  isFavorite = false,
  onToggleFavorite,
}: RecipeCardProps) {
  const [servings, setServings] = useState<number>(Math.max(1, baseServings || 2));
  const [tab, setTab] = useState<"ingredients" | "preparation">("ingredients");

  const factor = useMemo(() => {
    const base = baseServings && baseServings > 0 ? baseServings : 2;
    return servings / base;
  }, [servings, baseServings]);

  const scaled = useMemo(() => {
    return ingredients.map((ing) => {
      const raw = ing.measure || "";
      const { value, unit } = splitMeasure(raw);
      const measure = value != null ? `${fmt(value * factor)} ${unit}`.trim() : raw.trim();
      return { name: ing.name, measure };
    });
  }, [ingredients, factor]);

  function dec() { setServings((s) => Math.max(1, s - 1)); }
  function inc() { setServings((s) => Math.min(99, s + 1)); }

  return (
    <div className={`rk-card ${open ? "open" : ""} ${panelPlacement}`}>
      {/* LEFT: cover */}
      <div
        className="photo"
        onClick={() => (open ? onClose() : onOpen())}
        role="button"
        aria-label={open ? "Close details" : "Open details"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} className="img" />

        {/* chips */}
        <div className="chips">
          {typeof minutes === "number" && (
            <div className="pill"><h3>{minutes}</h3><span>MINS</span></div>
          )}
          <div className="pill"><h3>{servings}</h3><span>SERVINGS</span></div>
        </div>

        <div className="details">
          <h3 className="t">{title}</h3>
          {description ? <p className="d">{description}</p> : null}
        </div>
      </div>

      {/* RIGHT: slide panel */}
      {open && (
        <aside className={`panel ${panelPlacement}`} aria-hidden={!open}>
          {/* Tabs */}
          <div className="tabs" role="tablist" aria-label="Recipe sections">
            <button
              role="tab"
              aria-selected={tab === "ingredients"}
              className={`tab ${tab === "ingredients" ? "active" : ""}`}
              onClick={() => setTab("ingredients")}
            >
              INGREDIENTS
            </button>
            <button
              role="tab"
              aria-selected={tab === "preparation"}
              className={`tab ${tab === "preparation" ? "active" : ""}`}
              onClick={() => setTab("preparation")}
            >
              PREPARATION
            </button>
          </div>

          <div className="content">
            {/* Servings + Favorite */}
            <div className="servingsRow">
              <label>Servings</label>
              <div className="svCtrls">
                <button type="button" className="svBtn" onClick={dec} aria-label="Decrease servings">−</button>
                <input
                  className="svInput"
                  type="number"
                  min={1}
                  max={99}
                  value={servings}
                  onChange={(e) =>
                    setServings(Math.max(1, Math.min(99, Number(e.currentTarget.value) || 1)))
                  }
                />
                <button type="button" className="svBtn" onClick={inc} aria-label="Increase servings">+</button>
              </div>

              <button
                type="button"
                aria-pressed={isFavorite}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                className={`favBtn ${isFavorite ? "on" : ""}`}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
              >
                {isFavorite ? "★ Favorite" : "☆ Favorite"}
              </button>
            </div>

            {/* ONE section at a time */}
            {tab === "ingredients" ? (
              <div className="col">
                <p className="step">INGREDIENTS</p>
                <div className="text">
                  {scaled.length ? (
                    <ul className="ul">
                      {scaled.map((it, i) => (
                        <li key={i}>
                          <strong>{it.name}</strong>
                          {it.measure ? ` — ${it.measure}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No ingredients</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="col">
                <p className="step">PREPARATION</p>
                <div className="text">
                  {steps.length ? (
                    <ol className="ol">
                      {steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  ) : (
                    <p className="muted">No steps yet</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Close bubble */}
          <button className="toggle" onClick={onClose} type="button" aria-label="Close details">
            <span className="chev">›</span>
          </button>
        </aside>
      )}

      <style jsx>{`
        .rk-card { position: relative; height: 440px; display:flex; align-items:stretch; overflow:visible; }

        .photo {
          width:300px; height:440px; border-radius:10px; overflow:hidden; background:#eee;
          box-shadow:1px 1px 20px -5px rgba(0,0,0,.5); cursor:pointer; position:relative; flex:0 0 300px;
        }
        .img { width:100%; height:100%; object-fit:cover; display:block; transition: transform .8s ease; }
        .rk-card:hover .img { transform: scale(1.06); }

        .chips { position:absolute; left:0; top:0; display:flex; gap:8px; padding:16px; z-index:1; }
        .pill { width:60px; height:60px; border-radius:999px; display:grid; place-items:center;
          background:rgba(159, 229, 53, 0.85); text-align:center; box-shadow:0 6px 16px rgba(122, 82, 82, 0.18); }
        .pill h3{ margin:0; font-size:22px; line-height:1; margin-top:2px; }
        .pill span{ font-size:9px; font-weight:800; margin-top:-6px; }

        .details {
          position:absolute; left:0; right:0; bottom:0; padding:14px;
          background:linear-gradient(to bottom, rgba(239, 231, 231, 0) 0%, rgba(218, 160, 160, 0.65) 68%, rgba(200, 168, 168, 0.65) 100%);
          min-height:120px; color:#fff;
        }
        .t{ margin:0; font-size:20px; font-weight:800; }
        .d{ margin:6px 0 0; font-size:13px; line-height:1.35; opacity:.92; }

        .panel {
          height: 400px; border-radius:10px;
          background: linear-gradient(135deg, #fbf9f9 28%, #e8eaed 100%);
          border:1px solid rgba(169, 129, 129, 0.06); box-shadow:1px 1px 20px -5px rgba(164, 153, 153, 0.2);
        }
        .panel.push { position:relative; margin-left:10px; width:320px; display:flex; flex-direction:column; }
        .panel.overlay-right { position:absolute; top:0; left:310px; width:320px; display:flex; flex-direction:column; }
        .panel.overlay-left  { position:absolute; top:0; left:-350px; width:320px; display:flex; flex-direction:column; }

        .tabs { height:60px; display:flex; border-bottom:3px solid #ededef; background:#f4f4f6; }
        .tab { flex:1; padding:15px 0; text-align:center; font-weight:800; color:#9a96a4;
          border-top:7px solid rgba(218, 120, 149, 0); background:#fff; cursor:pointer; transition:.2s; }
        .tab.active { color:#241c3e; border-top-color:#ed346c; }
        .tab:hover { color:#241c3e; }

        .content { padding:10px 0; height:calc(100% - 60px); overflow:auto; }

        .servingsRow { display:flex; align-items:center; gap:10px; justify-content:space-between; padding:0 20px 8px 20px; }
        .servingsRow label { font-weight:800; color:#36354e; }

        .svCtrls { display:flex; align-items:center; gap:6px; }
        .svBtn { width:28px; height:28px; border-radius:8px; border:0; cursor:pointer;
          background:#ed2460; color:#fff; font-weight:800; line-height:1; }
        .svInput { width:52px; text-align:center; border:1px solid #e5e7eb; border-radius:8px; padding:6px 8px; background:#fff; }

        .favBtn {
          margin-left:auto;
          border:1px solid var(--border); border-radius:999px; padding:6px 10px;
          background:var(--bg2); color:var(--text); font-weight:700; cursor:pointer;
          transition:.2s transform, .2s background, .2s border-color;
        }
        .favBtn:hover{ transform: translateY(-1px); }
        .favBtn.on{ background:#fde68a; border-color:#f59e0b; }

        .col { padding:0 20px 8px 20px; text-align:left; }
        .step{ font-weight:800; font-size:14px; color:#36354e; margin:10px 0 6px; }
        .text{ border-left:2px solid #e3e3e3; padding:10px 16px; color:#565656; font-size:13px; }
        .ul { margin:0; padding-left:16px; display:grid; gap:6px; }
        .ol { margin:0; padding-left:18px; display:grid; gap:8px; }
        .muted{ opacity:.6; }

        .toggle {
          position:absolute; right:-15px; top:50%; transform:translateY(-50%);
          width:30px; height:30px; border-radius:999px; border:0; cursor:pointer;
          background:#ed2460; color:#fff; box-shadow:0 0 20px -2px rgba(237,36,96,1);
          display:grid; place-items:center;
        }
        .chev { display:inline-block; font-size:16px; }
      `}</style>
    </div>
  );
}
