"use client";

import { useEffect, useState } from "react";
import type { NutritionInfo } from "@/lib/nutrition";

/** Accept your full pantry item shape loosely so TS never fights you. */
export type FridgeItem = {
  id: string;
  name: string;
  quantity?: number;
  uid?: string;                    // optional on purpose
  barcode?: string | null;
  nutrition?: NutritionInfo | null;
};

export default function Fridge({
  items,
  isOpen,
  onToggleOpen,
  onEdit,
  onDelete,
}: {
  items: FridgeItem[];
  isOpen: boolean;
  onToggleOpen: (v: boolean) => void;
  onEdit?: (item: FridgeItem) => void;
  onDelete?: (item: FridgeItem) => void;
}) {
  const [open, setOpen] = useState(isOpen);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => setOpen(isOpen), [isOpen]);

  function toggle() {
    const v = !open;
    setOpen(v);
    onToggleOpen?.(v);
  }

  function hasMore(n?: NutritionInfo | null) {
    if (!n) return false;
    return [
      n.carbs100g, n.sugars100g, n.fiber100g, n.protein100g,
      n.fat100g, n.satFat100g, n.salt100g, n.sodium100g
    ].some((v) => typeof v === "number");
  }

  return (
    <div className="fridge">
      <button className="door" onClick={toggle} aria-expanded={open}>
        <span className="handle" />
        <span className="label">Fridge</span>
      </button>

      <div className={`tray ${open ? "open" : ""}`}>
        {items.length === 0 ? (
          <div className="empty">No items yet.</div>
        ) : (
          <ul className="grid">
            {items.map((it) => {
              const n = it.nutrition || {};
              const chips: string[] = [];
              if (typeof n.kcalPer100g === "number") chips.push(`${n.kcalPer100g} kcal/100g`);
              if (typeof n.protein100g === "number") chips.push(`${n.protein100g}g protein`);
              if (typeof n.fat100g === "number") chips.push(`${n.fat100g}g fat`);

              const showMore = !!expanded[it.id];

              return (
                <li key={it.id} className="cell">
                  <div className="name">{it.name}</div>

                  <div className="meta">
                    <span className="pill">Qty {it.quantity ?? 1}</span>
                    {chips.map((c, i) => (
                      <span key={i} className="pill">{c}</span>
                    ))}
                  </div>

                  <div className="row">
                    {hasMore(n) && (
                      <button
                        className="mini"
                        onClick={() =>
                          setExpanded((m) => ({ ...m, [it.id]: !m[it.id] }))
                        }
                      >
                        {showMore ? "Hide nutrition" : "More nutrition"}
                      </button>
                    )}
                    {onEdit && (
                      <button className="mini" onClick={() => onEdit(it)}>
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button className="mini danger" onClick={() => onDelete(it)}>
                        Delete
                      </button>
                    )}
                  </div>

                  {showMore && (
                    <div className="more">
                      <div className="gridMore">
                        <div><span className="muted">Carbs/100g:</span> {n.carbs100g ?? "—"}</div>
                        <div><span className="muted">Sugars/100g:</span> {n.sugars100g ?? "—"}</div>
                        <div><span className="muted">Fiber/100g:</span> {n.fiber100g ?? "—"}</div>
                        <div><span className="muted">Protein/100g:</span> {n.protein100g ?? "—"}</div>
                        <div><span className="muted">Fat/100g:</span> {n.fat100g ?? "—"}</div>
                        <div><span className="muted">Sat fat/100g:</span> {n.satFat100g ?? "—"}</div>
                        <div><span className="muted">Salt/100g:</span> {n.salt100g ?? "—"}</div>
                        <div><span className="muted">Sodium/100g:</span> {n.sodium100g ?? "—"}</div>
                        <div><span className="muted">Barcode:</span> {it.barcode ?? "—"}</div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <style jsx>{`
        .fridge { display:flex; align-items:center; gap:10px; }
        .door {
          position: relative;
          width: 140px; height: 88px; border-radius: 16px;
          background: linear-gradient(180deg, #f8fafc, #dbe1ea);
          border: 1px solid #e5e7eb;
          box-shadow: 0 12px 30px rgba(0,0,0,.06) inset, 0 6px 14px rgba(0,0,0,.05);
          cursor: pointer;
        }
        .handle {
          position: absolute; right: 12px; top: 18px; width: 6px; height: 52px; border-radius: 6px;
          background: #b7c0cd;
        }
        .label {
          position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%);
          font-size: 12px; color: #64748b;
        }

        .tray {
          min-width: 280px;
          max-width: 560px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          border-radius: 14px;
          padding: 10px;
          box-shadow: 0 16px 40px rgba(0,0,0,.06);
          transform-origin: top left;
          transform: scale(.96);
          opacity: 0;
          pointer-events: none;
          transition: .18s ease;
        }
        .tray.open { transform: scale(1); opacity: 1; pointer-events: auto; }

        .empty { color: var(--muted); font-size: 13px; padding: 4px 6px; }

        .grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .cell {
          border: 1px solid var(--border);
          background: var(--bg2);
          border-radius: 12px;
          padding: 10px;
        }
        .name { font-weight: 700; }
        .meta { display:flex; flex-wrap:wrap; gap:6px; margin: 6px 0; }
        .pill {
          border: 1px solid var(--border);
          background: #f1f5f9;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 12px;
          color: #0f172a;
        }
        .row { display:flex; gap:8px; }
        .mini {
          border:1px solid var(--border);
          background: var(--card-bg);
          border-radius:10px;
          padding:6px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .mini:hover { background: color-mix(in oklab, var(--primary) 10%, var(--bg2)); }
        .mini.danger { color:#b91c1c; border-color:#fecaca; background:#fff5f5; }
        .mini.danger:hover { background:#ffecec; }

        .more { margin-top: 8px; }
        .gridMore {
          display:grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 6px 12px;
          font-size: 13px;
        }
        @media (max-width: 560px) { .gridMore { grid-template-columns: 1fr; } }
        .muted { color:#64748b; }
      `}</style>
    </div>
  );
}
