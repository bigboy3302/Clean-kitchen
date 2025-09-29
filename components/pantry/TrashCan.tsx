"use client";

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

export default function TrashCan({
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
  const slightlyOpen = total > 0 && !isOpen;

  return (
    <div className="trashWrap">
      <button
        type="button"
        className={`bin ${isOpen ? "open" : ""} ${slightlyOpen ? "peek" : ""}`}
        onClick={() => onToggleOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close trash" : "Open trash"}
      >
        <span className="lid" aria-hidden />
        {total > 0 && <span className="count">{total}</span>}

      
        {!isOpen && total > 0 && (
          <span className="peel" aria-hidden>🥫🥡🍞</span>
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
                      <span className="muted">Expired</span>
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
        .trashWrap {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 16px;
          align-items: start;
          width: 100%;
        }

        .bin {
          position: sticky; top: 8px;
          width: 200px; height: 230px;
          border-radius: 18px 18px 12px 12px;
          background: linear-gradient(180deg, #fee2e2 0%, #fecaca 42%, #fda4af 100%);
          border: 1px solid var(--border);
          box-shadow: 0 16px 48px rgba(2,6,23,.18);
          transform-style: preserve-3d;
          transition: filter .25s ease;
          cursor: pointer;
        }
        .bin:hover { filter: brightness(1.04); }

        .lid {
          position: absolute;
          top: -12px; left: 8px; right: 8px; height: 14px;
          border-radius: 12px;
          background: linear-gradient(180deg, #fecaca, #fda4af);
          border: 1px solid #fca5a5;
          transform-origin: 10% 100%;
          transform: rotateX(0deg);
          transition: transform .45s cubic-bezier(.22,1,.36,1);
        }
        .bin.peek .lid { transform: rotateX(25deg); }
        .bin.open .lid { transform: rotateX(58deg); }

        .count {
          position: absolute; top: 6px; left: 6px;
          min-width: 26px; height: 24px; padding: 0 8px;
          display:grid; place-items:center;
          background: #ef4444; color: #fff; font-weight: 900; font-size: 12px;
          border-radius: 999px; box-shadow: 0 4px 12px rgba(239, 68, 68, .35);
        }

        .peel { position:absolute; bottom: 6px; left: 12px; font-size: 18px; opacity:.8; pointer-events:none; }

        .content {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--card-bg);
          box-shadow: 0 2px 12px rgba(16,24,40,.06), 0 16px 36px rgba(16,24,40,.08);
          padding: 14px;
          animation: contentIn .28s ease-out both;
        }
        @keyframes contentIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

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
        .top { display:grid; gap:4px; }
        .title{ font-weight:800; font-size:15px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .meta { display:flex; gap:10px; flex-wrap:wrap; font-size:13px; color:var(--muted); }

        .badges { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 4px; }
        .badge {
          border: 1px solid var(--border);
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 12px;
          color: #0f172a;
          background: #fee2e2; /* soft red */
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
        .btn { border:1px solid var(--border); background: var(--bg2); padding:8px 12px; border-radius:10px; cursor:pointer; font-weight:600; }
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
