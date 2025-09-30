"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Timestamp } from "firebase/firestore";
import type { NutritionInfo } from "@/lib/nutrition";

type TSLike = Timestamp | { seconds: number; nanoseconds: number } | null | undefined;

export type PantryCardItem = {
  id: string;
  name: string;
  quantity: number;
  createdAt?: TSLike;
  expiresAt?: TSLike;

  // optional (your shape)
  barcode?: string | null;
  nutrition?: NutritionInfo | null;

  // legacy props (we map to nutrition if present)
  kcalPer100g?: number | null;
  kcalPerServing?: number | null;
  servingSize?: string | null;
};

type Props = {
  item: PantryCardItem;
  onDelete: () => void;
  onSave: (patch: { name: string; quantity: number; expiresAt: TSLike }) => Promise<void>;
};

function toDate(ts?: TSLike) {
  if (!ts) return null;
  const anyTs = ts as any;
  if (typeof anyTs?.toDate === "function") return anyTs.toDate();
  if (typeof anyTs?.seconds === "number") return new Date(anyTs.seconds * 1000);
  return null;
}
function fmt(ts?: TSLike) {
  const d = toDate(ts);
  return d ? d.toLocaleDateString() : "—";
}
function toDateInputValue(ts?: TSLike) {
  const d = toDate(ts);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

export default function PantryCard({ item, onDelete, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState<number>(item.quantity);
  const [date, setDate] = useState<string>(toDateInputValue(item.expiresAt));
  const minDate = todayStr();

  useEffect(() => {
    if (!editing) {
      setName(item.name);
      setQty(item.quantity);
      setDate(toDateInputValue(item.expiresAt));
    }
  }, [editing, item.name, item.quantity, item.expiresAt]);

  const nutrition = useMemo(() => {
    if (item.nutrition) return item.nutrition;
    return {
      kcalPer100g: item.kcalPer100g ?? null,
      kcalPerServing: item.kcalPerServing ?? null,
      servingSize: item.servingSize ?? null,
      name: null,
      carbs100g: null,
      sugars100g: null,
      fiber100g: null,
      protein100g: null,
      fat100g: null,
      satFat100g: null,
      salt100g: null,
      sodium100g: null,
    } as NutritionInfo;
  }, [item]);

  async function save() {
    setErr(null);
    const clean = (name || "").trim();
    if (!clean) { setErr("Please enter a name."); return; }
    if (date && date < minDate) { setErr("Expiry cannot be in the past."); return; }

    setBusy(true);
    try {
      const expiresAt: TSLike =
        date && !Number.isNaN(Date.parse(date))
          ? { seconds: Math.floor(new Date(`${date}T00:00:00`).getTime() / 1000), nanoseconds: 0 }
          : null;

      const fixedName = clean.replace(/^\p{L}/u, (m: string) => m.toUpperCase());
      await onSave({ name: fixedName, quantity: Math.max(1, Number(qty) || 1), expiresAt });
      setEditing(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save changes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`pcard ${editing ? "editing" : ""}`}>
      {/* HEADER (title + quick data) */}
      <div className="head">
        <div className="titleRow">
          <div className="avatar" aria-hidden>{item.name.slice(0,1).toUpperCase()}</div>
          <div className="title" title={item.name}>{item.name}</div>
        </div>

        <div className="chips">
          <span className="chip">Qty <b>{item.quantity}</b></span>
          <span className="chip">Expiry <b>{fmt(item.expiresAt)}</b></span>
          {nutrition?.kcalPer100g != null && (
            <span className="chip soft">kcal/100g <b>{nutrition.kcalPer100g}</b></span>
          )}
        </div>

        <div className="actions">
          {!editing ? (
            <>
              <button className="iconBtn" onClick={() => setEditing(true)} aria-label="Edit item">✎</button>
              <button
                className="iconBtn danger"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                aria-label="Delete item"
              >🗑️</button>
            </>
          ) : (
            <>
              <button className="iconBtn" onClick={() => setEditing(false)} aria-label="Close editor">✕</button>
            </>
          )}
        </div>
      </div>

      {/* NUTRITION LINE (collapsed) */}
      {!editing && (nutrition?.kcalPerServing != null || nutrition?.servingSize) && (
        <div className="subRow">
          {nutrition?.kcalPerServing != null && <span className="pill">kcal/serv <b>{nutrition.kcalPerServing}</b></span>}
          {nutrition?.servingSize && <span className="pill">serving <b>{nutrition.servingSize}</b></span>}
          {item.barcode ? <span className="pill muted">barcode <b>{item.barcode}</b></span> : null}
        </div>
      )}

      {/* EDITOR — web-message frosted sheet */}
      {editing && (
        <div className="sheet" role="group" aria-label={`Edit ${item.name}`}>
          <div className="field">
            <input
              className="input"
              value={name}
              onChange={(e)=>setName(e.currentTarget.value)}
              placeholder=" "
              aria-label="Name"
            />
            <label className="float">Name</label>
          </div>

          <div className="grid2">
            <div className="field">
              <input
                className="input"
                type="number"
                min={1}
                value={String(qty)}
                onChange={(e)=>setQty(Math.max(1, Number(e.currentTarget.value)||1))}
                placeholder=" "
                aria-label="Quantity"
              />
              <label className="float">Quantity</label>
            </div>
            <div className="field">
              <input
                className="input"
                type="date"
                min={minDate}
                value={date}
                onChange={(e)=>setDate(e.currentTarget.value)}
                placeholder=" "
                aria-label="Expiry date"
              />
              <label className="float">Expiry date</label>
            </div>
          </div>

          {err && <p className="error">{err}</p>}

          <div className="actionsRow">
            <Button onClick={save} disabled={busy} type="button">
              {busy ? "Saving…" : "Save changes"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setEditing(false)}
              disabled={busy}
              type="button"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); onDelete(); }}
              disabled={busy}
              type="button"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      <style jsx>{`
        .pcard {
          border: 1px solid var(--border);
          background: linear-gradient(180deg, color-mix(in oklab, var(--card-bg) 92%, transparent), var(--card-bg));
          border-radius: 18px;
          padding: 14px;
          box-shadow: 0 10px 28px rgba(2,6,23,.08);
          transition: box-shadow .2s ease, transform .15s ease, border-color .2s ease;
        }
        .pcard:hover { transform: translateY(-1px); box-shadow: 0 14px 44px rgba(2,6,23,.10); }

        .head {
          display:grid; grid-template-columns: 1fr auto; align-items:center; gap: 12px;
        }
        .titleRow { display:flex; align-items:center; gap:10px; min-width:0; }
        .avatar {
          width: 32px; height: 32px; border-radius: 10px;
          display:grid; place-items:center; font-weight: 900;
          background: color-mix(in oklab, var(--primary) 18%, var(--bg2));
          border: 1px solid var(--border);
          box-shadow: 0 4px 12px rgba(2,6,23,.08);
        }
        .title {
          font-weight: 900; letter-spacing:-.01em; color: var(--text);
          overflow:hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .chips { display:flex; gap:8px; flex-wrap:wrap; margin-top: 8px; }
        .chip {
          border: 1px solid var(--border);
          background: var(--bg2);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px; color: var(--text);
        }
        .chip.soft { background: #eef2ff; color:#0f172a; }
        .chip b { font-weight: 900; }

        .actions { display:flex; gap:6px; }
        .iconBtn {
          border: 1px solid var(--border);
          background: var(--bg);
          width: 30px; height: 30px; border-radius: 10px;
          cursor: pointer;
        }
        .iconBtn:hover { background: color-mix(in oklab, var(--bg2) 85%, var(--primary) 15%); }
        .iconBtn.danger { background: #fee2e2; border-color:#fecaca; }

        .subRow { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
        .pill {
          background: var(--bg2);
          border: 1px dashed var(--border);
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 12px;
        }
        .pill b { font-weight: 800; }
        .pill.muted { opacity: .8; }

        /* EDIT SHEET */
        .sheet {
          margin-top: 12px;
          border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border));
          background:
            radial-gradient(140% 120% at 100% -40%, color-mix(in oklab, var(--primary) 18%, transparent), transparent),
            color-mix(in oklab, var(--card-bg) 90%, transparent);
          backdrop-filter: blur(8px);
          border-radius: 16px;
          padding: 12px;
          box-shadow: 0 18px 50px rgba(2,6,23,.12) inset, 0 8px 30px rgba(2,6,23,.08);
          animation: sheetIn .18s ease-out both;
        }
        @keyframes sheetIn { from { opacity:0; transform: translateY(6px) } to { opacity:1; transform: translateY(0) } }

        .grid2 { display:grid; grid-template-columns: 140px 1fr; gap: 10px 12px; }
        @media (max-width:560px){ .grid2{ grid-template-columns: 1fr; } }

        .field { position: relative; }
        .input {
          width:100%; border:1px solid var(--border); border-radius: 12px;
          padding: 14px 12px 10px; background: var(--bg);
          color: var(--text); outline: none;
        }
        .input:focus {
          border-color: color-mix(in oklab, var(--primary) 60%, var(--border));
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 22%, transparent);
        }
        .float {
          position: absolute; left: 10px; top: 10px;
          padding: 0 6px; background: var(--bg);
          color: var(--muted); font-size: 12px; border-radius: 6px;
          transition: transform .12s ease, color .12s ease, top .12s ease, background .12s ease;
          pointer-events:none;
        }
        .input:not(:placeholder-shown) + .float,
        .input:focus + .float {
          top: -8px; transform: translateY(-2px); color: color-mix(in oklab, var(--primary) 70%, var(--muted));
          background: var(--card-bg);
        }

        .actionsRow { display:flex; gap:10px; justify-content:flex-end; margin-top: 10px; }
        .error {
          margin-top: 6px;
          background: color-mix(in oklab, #ef4444 12%, var(--card-bg));
          color:#7f1d1d; border:1px solid color-mix(in oklab, #ef4444 35%, var(--border));
          border-radius:10px; padding:8px 10px; font-size: 12px;
        }
      `}</style>
    </div>
  );
}
