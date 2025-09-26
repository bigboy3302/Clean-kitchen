"use client";

import { useMemo } from "react";

type TSLike =
  | { seconds: number; nanoseconds: number }
  | Date
  | null
  | undefined;

type Nutrition = {
  carbs100g?: number | null;
  sugars100g?: number | null;
  fiber100g?: number | null;
  protein100g?: number | null;
  fat100g?: number | null;
  satFat100g?: number | null;
  salt100g?: number | null;
  sodium100g?: number | null;
  kcalPer100g?: number | null;
  kcalPerServing?: number | null;
  servingSize?: string | null;
} | null;

type Item = {
  id: string;
  uid?: string;
  name: string;
  quantity?: number;
  expiresAt?: TSLike;
  barcode?: string | null;
  nutrition?: Nutrition;
};

export default function Fridge({
  items,
  isOpen,
  onToggleOpen,
  onEdit,
  onDelete,
}: {
  items: Item[];
  isOpen: boolean;
  onToggleOpen: (v: boolean) => void;
  onEdit?: (it: Item) => void;
  onDelete?: (it: Item) => void;
}) {
  const total = items.length;

  // Decorative “peek” foods for the closed state
  const foods = useMemo(() => {
    const base = ["🥬", "🍎", "🥛", "🧀", "🥚", "🥦", "🍇", "🍓", "🥕", "🍗", "🍊", "🧃", "🥒", "🫐"];
    const count = Math.min(10, Math.max(4, Math.ceil(total / 2)));
    return Array.from({ length: count }, (_, i) => base[i % base.length]);
  }, [total]);

  const ajar = total > 0 && !isOpen;

  return (
    <div className="fridgeWrap">
      <button
        type="button"
        className={`box ${isOpen ? "open" : ""} ${ajar ? "ajar" : ""}`}
        onClick={() => onToggleOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close fridge" : "Open fridge"}
      >
        <span className="chrome" aria-hidden />
        <span className="gasket" aria-hidden />
        <span className="shelf s1" aria-hidden />
        <span className="shelf s2" aria-hidden />
        <span className="shelf s3" aria-hidden />

        {/* Door + proper handle (no scrollbar look) */}
        <span className="door" aria-hidden>
          <span className="handle" aria-hidden />
        </span>

        {total > 0 && (
          <span className="count" aria-hidden>
            {total}
          </span>
        )}

        {!isOpen && (
          <div className="pile peek" aria-hidden>
            {foods.map((g, i) => (
              <span key={i} className="food" style={{ ["--i" as any]: i }}>
                {g}
              </span>
            ))}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="content">
          <ul className="grid">
            {items.map((it, i) => {
              const n = (it.nutrition || {}) as NonNullable<Nutrition>;
              const hasCals =
                n?.kcalPer100g != null || n?.kcalPerServing != null || n?.servingSize;
              const hasMacros =
                n?.carbs100g != null ||
                n?.sugars100g != null ||
                n?.fiber100g != null ||
                n?.protein100g != null ||
                n?.fat100g != null ||
                n?.satFat100g != null ||
                n?.salt100g != null ||
                n?.sodium100g != null;

              return (
                <li className="card" key={it.id} style={{ ["--i" as any]: i }}>
                  <div className="top">
                    <div className="title" title={it.name}>{it.name}</div>
                    <div className="meta">
                      <span>Qty: <strong>{it.quantity ?? 1}</strong></span>
                      <span className="muted">Fresh</span>
                    </div>
                  </div>

                  {hasCals && (
                    <div className="badges">
                      {n?.kcalPer100g != null && <span className="badge pill">kcal/100g {n.kcalPer100g}</span>}
                      {n?.kcalPerServing != null && <span className="badge pill">kcal/serv {n.kcalPerServing}</span>}
                      {n?.servingSize && <span className="badge pill">serving {n.servingSize}</span>}
                    </div>
                  )}

                  {hasMacros && (
                    <div className="nutri">
                      <div>Carbs/100g: <strong>{n?.carbs100g ?? "—"}</strong></div>
                      <div>Sugars/100g: <strong>{n?.sugars100g ?? "—"}</strong></div>
                      <div>Fiber/100g: <strong>{n?.fiber100g ?? "—"}</strong></div>
                      <div>Protein/100g: <strong>{n?.protein100g ?? "—"}</strong></div>
                      <div>Fat/100g: <strong>{n?.fat100g ?? "—"}</strong></div>
                      <div>Sat fat/100g: <strong>{n?.satFat100g ?? "—"}</strong></div>
                      <div>Salt/100g: <strong>{n?.salt100g ?? "—"}</strong></div>
                      <div>Sodium/100g: <strong>{n?.sodium100g ?? "—"}</strong></div>
                      {it.barcode ? <div>Barcode: <strong>{it.barcode}</strong></div> : null}
                    </div>
                  )}

                  {(onEdit || onDelete) && (
                    <div className="row">
                      {onEdit && <button className="btn secondary" onClick={() => onEdit(it)}>Edit</button>}
                      {onDelete && <button className="btn danger" onClick={() => onDelete(it)}>Delete</button>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <style jsx>{`
        .fridgeWrap {
          display: grid;
          grid-template-columns: 230px 1fr;
          gap: 16px;
          align-items: start;
          width: 100%;
        }

        /* FRIDGE BODY */
        .box {
          position: sticky;
          top: 8px;
          width: 220px;
          height: 260px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background:
            radial-gradient(140% 80% at 50% -10%, #fff0 45%, rgba(255,255,255,0.55) 60%, #fff0 61%),
            linear-gradient(180deg, #e0f2fe 0%, #dbeafe 40%, #c7d2fe 100%);
          box-shadow: 0 16px 48px rgba(2, 6, 23, 0.18);
          cursor: pointer;
          perspective: 900px;
          transform-style: preserve-3d;
          transition: transform .5s cubic-bezier(.22,1,.36,1), filter .25s ease;
          overflow: hidden;
        }
        .box:hover { filter: brightness(1.04); }
        .box.open { transform: translateY(-2px) rotateX(5deg); }

        .chrome { position:absolute; inset:6px; border-radius:14px; border:1px solid rgba(255,255,255,.5); box-shadow: inset 0 1px 0 rgba(255,255,255,.35); }
        .gasket { position:absolute; inset:14px 14px 14px 40px; border-radius:10px; border:1px dashed rgba(2,6,23,.06); }

        .shelf { position:absolute; left:24px; right:56px; height:2px; background: rgba(2,6,23,.12); opacity:.6; }
        .shelf.s1 { top: 78px; }
        .shelf.s2 { top: 128px; }
        .shelf.s3 { top: 178px; }

        /* DOOR + HANDLE (no accidental scrollbars) */
        .door {
          position:absolute; top:0; bottom:0; right:0; width:106px;
          background: linear-gradient(180deg, #e2e8f0 0%, #e5e7eb 40%, #e2e8f0 100%);
          border-left: 1px solid rgba(15,23,42,.08);
          border-radius: 0 16px 16px 0;
          transform-origin: 100% 50%;
          transform: rotateY(0deg);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.3);
          transition: transform .55s cubic-bezier(.22,1,.36,1);
          will-change: transform;
          overflow: hidden; /* ensure no scrollbars */
        }
        .box.ajar .door { transform: rotateY(-14deg); }
        .box.open .door { transform: rotateY(-58deg); }

        .handle {
          position:absolute;
          top: 40px;
          left: 10px;
          width: 10px;
          height: 112px;
          border-radius: 8px;
          background: linear-gradient(180deg, #93a8c0, #6b7f96);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.35);
        }

        .count {
          position: absolute;
          top: 8px; left: 8px;
          min-width: 26px; height: 24px; padding: 0 8px;
          display:grid; place-items:center;
          background: #0ea5e9; color: #0b1220;
          font-size: 12px; font-weight: 900; border-radius: 999px;
          box-shadow: 0 4px 12px rgba(14,165,233,.35);
        }

        /* Peek foods */
        .pile { position:absolute; left:22px; right:58px; bottom:18px; top:26px; pointer-events:none; transform: translateZ(2px); }
        .food {
          position:absolute; font-size:20px; filter: drop-shadow(0 2px 6px rgba(0,0,0,.15));
          animation: chill 2.6s ease-in-out infinite; animation-delay: calc(var(--i) * 70ms);
        }
        .food:nth-child(1)  { left: 6px;  bottom: 10px; }
        .food:nth-child(2)  { left: 30px; bottom: 12px; }
        .food:nth-child(3)  { left: 54px; bottom: 14px; }
        .food:nth-child(4)  { left: 78px; bottom: 16px; }
        .food:nth-child(5)  { left: 16px; bottom: 48px; }
        .food:nth-child(6)  { left: 46px; bottom: 52px; }
        .food:nth-child(7)  { left: 74px; bottom: 56px; }
        .food:nth-child(8)  { left: 12px; bottom: 92px; }
        .food:nth-child(9)  { left: 40px; bottom: 94px; }
        .food:nth-child(10) { left: 70px; bottom: 98px; }

        @keyframes chill { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-1px) } }

        /* CONTENT GRID */
        .content {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--card-bg);
          box-shadow: 0 2px 12px rgba(16,24,40,.06), 0 16px 36px rgba(16,24,40,.08);
          padding: 14px;
          animation: contentIn .28s ease-out both;
        }
        @keyframes contentIn { from{opacity:0; transform: translateY(6px);} to{opacity:1; transform: translateY(0);} }

        .grid {
          list-style:none; margin:0; padding:0;
          display:grid; gap:14px; grid-template-columns: repeat(3, minmax(0,1fr));
        }
        @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }

        .card {
          border: 1px solid var(--border);
          background: var(--bg2);
          border-radius: 16px;
          padding: 16px;
          min-height: 140px;
          box-shadow: 0 2px 10px rgba(16,24,40,.06), 0 16px 34px rgba(16,24,40,.08);
          opacity: 0; transform: translateY(10px) scale(.98);
          animation: cardPop .46s cubic-bezier(.18,.89,.32,1.28) forwards;
          animation-delay: calc((var(--i,0)) * 70ms);
        }
        .card:hover { transform: translateY(-2px) scale(1.01); transition: transform .18s ease; }

        .top { display:grid; gap:4px; }
        .title { font-weight:800; font-size:15px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .meta { display:flex; gap:10px; flex-wrap:wrap; font-size:13px; color:var(--muted); }

        .badges { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 4px; }
        .badge {
          border: 1px solid var(--border);
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 12px;
          color: #0f172a;
          background: #eef2ff;
          /* 🔧 kill any global underline styles */
          text-decoration: none !important;
        }
        .badge * { text-decoration: none !important; }

        .nutri {
          margin-top: 8px;
          display:grid; gap:6px 12px;
          grid-template-columns: repeat(2, minmax(0,1fr));
          font-size: 13px;
        }
        @media (max-width: 560px) { .nutri { grid-template-columns: 1fr; } }

        .row { display:flex; gap:10px; justify-content:flex-end; margin-top:10px; }
        .btn { border:1px solid var(--border); background:var(--bg2); padding:8px 12px; border-radius:10px; cursor:pointer; font-weight:600; }
        .btn.secondary:hover { background: color-mix(in oklab, var(--bg2) 85%, var(--primary) 15%); }
        .btn.danger { color:#fff; background:#e11d48; border-color:#e11d48; }
        .btn.danger:hover { filter: brightness(.97); }

        @keyframes cardPop {
          0%{ opacity:0; transform: translateY(16px) scale(.96); }
          60%{ opacity:1; transform: translateY(-3px) scale(1.02); }
          100%{ opacity:1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
