"use client";

type TSLike = { seconds: number; nanoseconds: number } | Date | null | undefined;
type Nutrition = {
  carbs100g?: number | null; sugars100g?: number | null; fiber100g?: number | null;
  protein100g?: number | null; fat100g?: number | null; satFat100g?: number | null;
  salt100g?: number | null; sodium100g?: number | null; kcalPer100g?: number | null;
  kcalPerServing?: number | null; servingSize?: string | null;
} | null;

type Item = {
  id: string; uid?: string; name: string; quantity?: number; expiresAt?: TSLike;
  barcode?: string | null; nutrition?: Nutrition;
};

export default function TrashCan({
  items, isOpen, onToggleOpen, onEdit, onDelete,
}: {
  items: Item[]; isOpen: boolean; onToggleOpen: (v: boolean) => void;
  onEdit?: (it: Item) => void; onDelete?: (it: Item) => void;
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
        <span className="metal" aria-hidden />
        <span className="lid" aria-hidden />
        <span className="hinge" aria-hidden />
        <span className="shine" aria-hidden />
        {total > 0 && <span className="count">{total}</span>}

        {!isOpen && total > 0 && (
          <span className="peel" aria-hidden>🥫🥡🍞</span>
        )}
      </button>

      {isOpen && (
        <div className="content">
          <ul className="grid">
            {items.map((it, i) => (
              <li className="card" key={it.id} style={{ ["--i" as any]: i }}>
                <div className="top">
                  <div className="title" title={it.name}>{it.name}</div>
                  <div className="meta">
                    <span>Qty: <strong>{it.quantity ?? 1}</strong></span>
                    <span className="muted">Expired</span>
                  </div>
                </div>
                {(onEdit || onDelete) && (
                  <div className="row">
                    {onEdit && <button className="btn secondary" onClick={() => onEdit(it)}>Edit</button>}
                    {onDelete && <button className="btn danger" onClick={() => onDelete(it)}>Delete</button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        .trashWrap {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 16px; align-items: start; width: 100%;
        }

        .bin {
          position: sticky; top: 8px;
          width: 210px; height: 240px; border-radius: 16px;
          border:1px solid var(--border); overflow:hidden; cursor:pointer;
          transform-style: preserve-3d; background: #f3f4f6;
          box-shadow: 0 16px 48px rgba(2,6,23,.18);
          transition: filter .25s ease, transform .45s cubic-bezier(.22,1,.36,1);
        }
        .bin.peek { animation: wobble 1.1s ease-in-out both; }
        @keyframes wobble {
          0%,100%{ transform: rotateZ(0deg) }
          40%{ transform: rotateZ(-1.2deg) }
          70%{ transform: rotateZ(.8deg) }
        }

        .metal {
          position:absolute; inset:0;
          background: linear-gradient(180deg, #fda4af 0%, #fecaca 45%, #fee2e2 100%);
        }
        .shine {
          position:absolute; inset:0;
          background:
            radial-gradient(50% 20% at 50% -6%, rgba(255,255,255,.9), transparent 60%),
            linear-gradient(90deg, rgba(255,255,255,.5), rgba(255,255,255,0) 30%);
          mix-blend-mode: screen; opacity:.7;
        }

        .lid {
          position:absolute; top:-12px; left: 10px; right: 10px; height: 16px;
          border-radius: 12px;
          background: linear-gradient(180deg, #fecaca, #fda4af);
          border:1px solid #fca5a5;
          transform-origin: 10% 100%;
          transform: rotateX(0deg);
          transition: transform .45s cubic-bezier(.22,1,.36,1);
        }
        .hinge {
          position:absolute; top:-14px; left: 14px; width: 40px; height: 4px;
          background: #b45309; border-radius: 4px; box-shadow: 0 1px 0 rgba(0,0,0,.2);
        }
        .bin.peek .lid { transform: rotateX(22deg); }
        .bin.open .lid { transform: rotateX(56deg); }

        .count {
          position: absolute; top: 6px; left: 6px;
          min-width: 26px; height: 24px; padding: 0 8px; display:grid; place-items:center;
          background: #ef4444; color: #fff; font-weight: 900; font-size: 12px; border-radius: 999px;
          box-shadow: 0 4px 12px rgba(239,68,68,.35);
        }
        .peel { position:absolute; bottom: 8px; left: 12px; font-size: 18px; opacity:.85; pointer-events:none; }

        .content {
          border: 1px solid var(--border); border-radius:16px; background: var(--card-bg);
          box-shadow: 0 2px 12px rgba(16,24,40,.06), 0 16px 36px rgba(16,24,40,.08);
          padding: 14px; animation: contentIn .28s ease-out both;
        }
        @keyframes contentIn { from { opacity:0; transform: translateY(6px) } to { opacity:1; transform: translateY(0) } }

        .grid { list-style:none; margin:0; padding:0; display:grid; gap:14px; grid-template-columns: repeat(3, minmax(0,1fr)); }
        @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }

        .card {
          border:1px solid var(--border); background: var(--bg2); border-radius:16px;
          padding: 16px; min-height:120px; box-shadow: 0 2px 10px rgba(16,24,40,.06), 0 16px 34px rgba(16,24,40,.08);
          opacity: 0; transform: translateY(10px) scale(.98);
          animation: cardPop .46s cubic-bezier(.18,.89,.32,1.28) forwards; animation-delay: calc((var(--i,0)) * 70ms);
        }
        .top { display:grid; gap:4px; }
        .title { font-weight:800; font-size:15px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .meta { display:flex; gap:10px; flex-wrap:wrap; font-size:13px; color:var(--muted); }

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
