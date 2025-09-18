// components/pantry/PantryCard.tsx
"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
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

  // new (optional) stored data:
  barcode?: string | null;
  nutrition?: NutritionInfo | null;

  // legacy flat fields (still show if present)
  kcalPer100g?: number | null;
  kcalPerServing?: number | null;
  servingSize?: string | null;
};

type Props = {
  item: PantryCardItem;
  onDelete: () => void;
  onSave: (patch: { name: string; quantity: number; expiresAt: TSLike }) => Promise<void>;
};

function toDateSafe(ts?: TSLike) {
  if (!ts) return null;
  const anyTs = ts as any;
  if (typeof anyTs?.toDate === "function") return anyTs.toDate();
  if (typeof anyTs?.seconds === "number") return new Date(anyTs.seconds * 1000);
  return null;
}
function fmt(ts?: TSLike) {
  const d = toDateSafe(ts);
  return d ? d.toLocaleDateString() : "—";
}
function toDateInputValue(ts?: TSLike) {
  const d = toDateSafe(ts);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function relExpiry(expiresAt?: TSLike) {
  const d = toDateSafe(expiresAt);
  if (!d) return "No expiry";
  const t0 = new Date(); t0.setHours(0,0,0,0);
  const d0 = new Date(d); d0.setHours(0,0,0,0);
  const diff = Math.round((d0.getTime() - t0.getTime()) / 86400000); // days
  if (diff > 1) return `Expires in ${diff} days`;
  if (diff === 1) return `Expires tomorrow`;
  if (diff === 0) return `Expires today`;
  if (diff === -1) return `Expired yesterday`;
  return `Expired ${Math.abs(diff)} days ago`;
}

export default function PantryCard({ item, onDelete, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState<number>(item.quantity);
  const [date, setDate] = useState<string>(toDateInputValue(item.expiresAt));
  const [busy, setBusy] = useState(false);
  const [err,   setErr] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const minDate = todayStr();

  useMemo(() => {
    if (!editing) {
      setName(item.name);
      setQty(item.quantity);
      setDate(toDateInputValue(item.expiresAt));
    }
  }, [editing, item.name, item.quantity, item.expiresAt]);

  function isPastDate(s: string) {
    return !!s && s < minDate;
  }

  async function save() {
    setErr(null);
    if (!name.trim()) { setErr("Please enter product name."); return; }
    if (date && isPastDate(date)) { setErr("Expiry date cannot be in the past."); return; }

    setBusy(true);
    try {
      const expiresAt: TSLike =
        date && !Number.isNaN(Date.parse(date))
          ? { seconds: Math.floor(new Date(`${date}T00:00:00`).getTime() / 1000), nanoseconds: 0 }
          : null;

      await onSave({
        name: name.trim().replace(/^\p{L}/u, m => m.toUpperCase()),
        quantity: Number(qty) || 1,
        expiresAt,
      });
      setEditing(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save changes.");
    } finally {
      setBusy(false);
    }
  }

  // pick nutrition either from nested object or legacy flat props
  const n = item.nutrition || {
    kcalPer100g: item.kcalPer100g ?? null,
    kcalPerServing: item.kcalPerServing ?? null,
    servingSize: item.servingSize ?? null,
    name: null,
    carbs100g: null, sugars100g: null, fiber100g: null,
    protein100g: null, fat100g: null, satFat100g: null,
    salt100g: null, sodium100g: null
  };

  return (
    <Card>
      {!editing ? (
        <>
          <div className="row">
            <div className="main">
              <div className="title">{item.name}</div>
              <div className="meta">
                <span>Qty: <strong>{item.quantity}</strong></span>
                <span>Expiry: <strong>{fmt(item.expiresAt)}</strong></span>
                <span className="muted">{relExpiry(item.expiresAt)}</span>
              </div>
              {(n.kcalPer100g || n.kcalPerServing) && (
                <div className="kcalLine">
                  <span className="badge">kcal/100g: {n.kcalPer100g ?? "—"}</span>
                  <span className="badge">kcal/serving: {n.kcalPerServing ?? "—"}</span>
                  {n.servingSize ? <span className="badge">serving: {n.servingSize}</span> : null}
                </div>
              )}
              {(n.carbs100g || n.protein100g || n.fat100g) && (
                <button className="link" onClick={() => setShowMore(s => !s)}>
                  {showMore ? "Hide nutrition" : "More nutrition"}
                </button>
              )}
            </div>
            <div className="actions">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="danger"    size="sm" onClick={onDelete}>Delete</Button>
            </div>
          </div>

          {showMore && (
            <div className="more">
              <div className="grid">
                <div><span className="muted">Carbs/100g:</span> {n.carbs100g ?? "—"}</div>
                <div><span className="muted">Sugars/100g:</span> {n.sugars100g ?? "—"}</div>
                <div><span className="muted">Fiber/100g:</span> {n.fiber100g ?? "—"}</div>
                <div><span className="muted">Protein/100g:</span> {n.protein100g ?? "—"}</div>
                <div><span className="muted">Fat/100g:</span> {n.fat100g ?? "—"}</div>
                <div><span className="muted">Sat fat/100g:</span> {n.satFat100g ?? "—"}</div>
                <div><span className="muted">Salt/100g:</span> {n.salt100g ?? "—"}</div>
                <div><span className="muted">Sodium/100g:</span> {n.sodium100g ?? "—"}</div>
                {item.barcode ? <div><span className="muted">Barcode:</span> {item.barcode}</div> : null}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="editGrid">
            <div className="full">
              <label className="label">Name</label>
              <textarea
                className="textArea"
                rows={2}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder="Milk"
              />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input
                className="textInput"
                type="number"
                min={1}
                value={String(qty)}
                onChange={(e) => setQty(Number(e.currentTarget.value))}
              />
            </div>
            <div>
              <label className="label">Expiry date</label>
              <input
                className="textInput"
                type="date"
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.currentTarget.value)}
              />
            </div>
          </div>

          {err && <p className="error">{err}</p>}

          <div className="actions">
            <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={onDelete} disabled={busy}>Delete</Button>
          </div>
        </>
      )}

      <style jsx>{`
        .row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .main { min-width:0; }
        .title { font-weight:600; color:#111827; margin-bottom:6px; overflow-wrap:anywhere; }
        .meta { display:flex; gap:12px; flex-wrap:wrap; color:#6b7280; font-size:13px; }
        .kcalLine { display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
        .badge { background:#f1f5f9; border:1px solid #e5e7eb; padding:4px 8px; border-radius:999px; font-size:12px; color:#0f172a; }
        .actions { display:flex; gap:8px; }
        .link { margin-top:8px; background:none; border:none; padding:0; color:#0f172a; text-decoration:underline; cursor:pointer; }
        .more { margin-top:10px; }
        .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 12px; }
        @media (max-width:600px){ .grid { grid-template-columns:1fr; } }

        .editGrid { display:grid; grid-template-columns:1fr 160px 200px; gap:12px 16px; margin-bottom:10px; }
        .full { grid-column:1 / -1; }
        @media (max-width:760px){ .editGrid { grid-template-columns:1fr; } }
        .label { display:block; margin-bottom:6px; font-size:.9rem; color:#111827; font-weight:500; }
        .textInput, .textArea { width:100%; border:1px solid #d1d5db; border-radius:12px; padding:10px 12px; font-size:14px; background:#fff; }
        .textArea { resize:vertical; }
        .textInput:focus, .textArea:focus { outline:none; border-color:#9ca3af; box-shadow:0 0 0 4px rgba(17,24,39,.08); }
        .error { margin-top:6px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:6px 8px; font-size:12px; }
        .muted { color:#64748b; }
      `}</style>
    </Card>
  );
}
