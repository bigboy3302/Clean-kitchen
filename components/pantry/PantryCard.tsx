"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Button from "@/components/ui/Button";
import type { Timestamp } from "firebase/firestore";

export type NutritionInfo = {
  name?: string | null;
  servingSize?: string | null;
  kcalPer100g?: number | null;
  kcalPerServing?: number | null;
  carbs100g?: number | null;
  sugars100g?: number | null;
  fiber100g?: number | null;
  protein100g?: number | null;
  fat100g?: number | null;
  satFat100g?: number | null;
  salt100g?: number | null;
  sodium100g?: number | null;
};

type TimestampLike =
  | Timestamp
  | Date
  | { toDate?: () => Date; seconds?: number }
  | string
  | number;

export type PantryCardItem = {
  id: string;
  name: string;
  quantity: number;
  expiresAt?: TimestampLike | null;
  barcode?: string | null;
  nutrition?: NutritionInfo | null;
  lastConsumedGrams?: number | null;
};

type Props = {
  item: PantryCardItem;
  onSave?: (patch: { name: string; quantity: number; expiresAt: string | null }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onConsume?: (payload: {
    grams: number;
    nutrients: { sugars_g: number; satFat_g: number; sodium_g: number; kcal: number };
  }) => void | Promise<void>;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  if (typeof value === "object" && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === "function") {
      try {
        return candidate.toDate();
      } catch {
        // ignore and attempt seconds fallback
      }
    }
    if (typeof candidate.seconds === "number") {
      return new Date(candidate.seconds * 1000);
    }
  }
  return null;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="chip">
      {children}
      <style jsx>{`
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 800;
          color: var(--text);
          white-space: nowrap;
        }
      `}</style>
    </span>
  );
}

export default function PantryCard({ item, onSave, onDelete, onConsume }: Props) {
  const d = toDate(item.expiresAt);
  const expiresStr = useMemo(() => {
    if (!d) return "";
    const y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, "0"),
      day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, [d]);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState<number>(item.quantity || 1);
  const [exp, setExp] = useState<string>(expiresStr);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const n: NutritionInfo = item.nutrition ?? {};
  const hasNutrition =
    !!item.barcode &&
    !!n &&
    Object.values({
      kcalPer100g: n.kcalPer100g,
      kcalPerServing: n.kcalPerServing,
      carbs100g: n.carbs100g,
      sugars100g: n.sugars100g,
      fiber100g: n.fiber100g,
      protein100g: n.protein100g,
      fat100g: n.fat100g,
      satFat100g: n.satFat100g,
      salt100g: n.salt100g,
      sodium100g: n.sodium100g,
    }).some((v) => v != null);

  const [nutriOpen, setNutriOpen] = useState(false);

  const [consumeOpen, setConsumeOpen] = useState(false);
  const [consumeGrams, setConsumeGrams] = useState<number>(item.lastConsumedGrams ?? 100);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const est = useMemo(() => {
    const g = Math.max(0, Number(consumeGrams) || 0);
    const f = (x?: number | null) => (x != null ? (x / 100) * g : 0);
    return {
      sugars_g: f(n.sugars100g),
      satFat_g: f(n.satFat100g),
      sodium_g: f(n.sodium100g),
      kcal: f(n.kcalPer100g),
    };
  }, [consumeGrams, n.sugars100g, n.satFat100g, n.sodium100g, n.kcalPer100g]);

  useEffect(() => {
    setName(item.name);
    setQty(item.quantity || 1);
    setExp(expiresStr);
    setConsumeGrams(item.lastConsumedGrams ?? 100);
  }, [item.id, item.name, item.quantity, expiresStr, item.lastConsumedGrams]);

  const handleSave = useCallback(async () => {
    if (onSave) {
      await onSave({
        name: name.trim() || item.name,
        quantity: Number(qty) || 1,
        expiresAt: exp ? exp : null,
      });
    }
    setEditOpen(false);
  }, [onSave, name, item.name, qty, exp]);

  useEffect(() => {
    const anyModal = editOpen || nutriOpen || consumeOpen;
    if (!anyModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditOpen(false);
        setNutriOpen(false);
        setConsumeOpen(false);
      }
      if (e.key === "Enter" && editOpen) handleSave();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => firstInputRef.current?.focus(), 50);
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.body.style.overflow = orig;
    };
  }, [editOpen, nutriOpen, consumeOpen, handleSave]);

  async function handleConsume() {
    if (!onConsume) {
      setConsumeOpen(false);
      return;
    }
    await onConsume({
      grams: Math.max(0, Number(consumeGrams) || 0),
      nutrients: est,
    });
    setConsumeOpen(false);
  }

  async function confirmDelete() {
    if (!onDelete || deleting) return;
    setDeleteErr(null);
    setDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete.";
      setDeleteErr(message);
    } finally {
      setDeleting(false);
    }
  }

  const facts: Array<{ label: string; value: number | string | null | undefined; suffix?: string }> = [
    { label: "Serving size", value: n.servingSize },
    { label: "kcal / 100g", value: n.kcalPer100g },
    { label: "kcal / serving", value: n.kcalPerServing },
    { label: "Carbs / 100g", value: n.carbs100g, suffix: "g" },
    { label: "Sugars / 100g", value: n.sugars100g, suffix: "g" },
    { label: "Fiber / 100g", value: n.fiber100g, suffix: "g" },
    { label: "Protein / 100g", value: n.protein100g, suffix: "g" },
    { label: "Fat / 100g", value: n.fat100g, suffix: "g" },
    { label: "Sat. fat / 100g", value: n.satFat100g, suffix: "g" },
    { label: "Salt / 100g", value: n.salt100g, suffix: "g" },
    { label: "Sodium / 100g", value: n.sodium100g, suffix: "g" },
  ];

  return (
    <>
      <article className="card">
        <h3 className="title" title={item.name}>
          {item.name}
        </h3>

        <div className="meta">
          <Chip>Qty: {item.quantity}</Chip>
          <Chip>Exp: {expiresStr}</Chip>
          {item.barcode ? <Chip>EAN: {item.barcode}</Chip> : null}
        </div>

        {deleteErr ? <p className="err">{deleteErr}</p> : null}

        {/* Always-visible actions */}
        <div className="actionsRow">
          {hasNutrition && onConsume ? (
            <Button onClick={() => setConsumeOpen(true)}>Consume</Button>
          ) : null}
          {hasNutrition ? (
            <Button variant="secondary" onClick={() => setNutriOpen(true)}>
              Nutrition
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          {onDelete ? (
            <Button
              variant="danger"
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          ) : null}
        </div>
      </article>

      {/* EDIT MODAL */}
      {editOpen &&
        createPortal(
          <div
            className="modalOverlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setEditOpen(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <header className="mHead">
                <div>
                  <div className="mEyebrow">Edit product</div>
                  <div className="mTitle">{item.name}</div>
                </div>
                <button
                  className="mClose"
                  onClick={() => setEditOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>
              <div className="mBody">
                <div className="mForm">
                  <label className="lbl">
                    Name
                    <input
                      ref={firstInputRef}
                      className="inp"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <div className="g2">
                    <label className="lbl">
                      Quantity
                      <input
                        className="inp"
                        type="number"
                        min={1}
                        value={String(qty)}
                        onChange={(e) =>
                          setQty(Math.max(1, Number(e.target.value) || 1))
                        }
                      />
                    </label>
                    <label className="lbl">
                      Expiry date
                      <input
                        className="inp"
                        type="date"
                        value={exp}
                        onChange={(e) => setExp(e.target.value)}
                      />
                    </label>
                  </div>
                  {item.barcode ? (
                    <div className="readonly">
                      <span className="key">Barcode</span>
                      <span className="val">{item.barcode}</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <footer className="mFoot">
                <Button variant="secondary" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save changes</Button>
              </footer>
            </div>
          </div>,
          document.body
        )}

      {/* NUTRITION MODAL */}
      {nutriOpen &&
        createPortal(
          <div
            className="modalOverlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setNutriOpen(false)}
          >
            <div className="modal modal-nutri" onClick={(e) => e.stopPropagation()}>
              <header className="mHead">
                <div>
                  <div className="mEyebrow">Nutrition facts</div>
                  <div className="mTitle">{n.name || item.name}</div>
                </div>
                <button
                  className="mClose"
                  onClick={() => setNutriOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>
              <div className="mBody mBody--single">
                <div className="nutCard big">
                  <div className="nutHead">
                    <div className="nutTitle">Per 100g / serving</div>
                    <div className="muted small">
                      {item.barcode ? `EAN ${item.barcode}` : ""}
                      {n.servingSize ? ` • ${n.servingSize}` : ""}
                    </div>
                  </div>
                  <dl className="nutGrid big">
                    {facts.map((f) =>
                      f.value == null || f.value === "" ? null : (
                        <div className="nrow" key={f.label}>
                          <dt>{f.label}</dt>
                          <dd>
                            {String(f.value)}
                            {f.suffix ? <span className="suffix">{f.suffix}</span> : null}
                          </dd>
                        </div>
                      )
                    )}
                  </dl>
                </div>
              </div>
              <footer className="mFoot">
                <Button onClick={() => setNutriOpen(false)}>Close</Button>
              </footer>
            </div>
          </div>,
          document.body
        )}

      {/* CONSUME MODAL */}
      {consumeOpen &&
        createPortal(
          <div
            className="modalOverlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setConsumeOpen(false)}
          >
            <div className="modal modal-nutri" onClick={(e) => e.stopPropagation()}>
              <header className="mHead">
                <div>
                  <div className="mEyebrow">Log consumption</div>
                  <div className="mTitle">{item.name}</div>
                </div>
                <button
                  className="mClose"
                  onClick={() => setConsumeOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>
              <div className="mBody mBody--single">
                <div className="consumeBox">
                  <label className="lbl">
                    How many grams did you consume?
                    <input
                      className="inp"
                      type="number"
                      min={0}
                      value={String(consumeGrams)}
                      onChange={(e) => setConsumeGrams(Number(e.target.value) || 0)}
                    />
                  </label>
                  <div className="est">
                    <div className="eRow">
                      <span className="k">Estimated sugar</span>
                      <strong>{est.sugars_g.toFixed(1)} g</strong>
                    </div>
                    <div className="eRow">
                      <span className="k">Estimated sat. fat</span>
                      <strong>{est.satFat_g.toFixed(1)} g</strong>
                    </div>
                    <div className="eRow">
                      <span className="k">Estimated sodium</span>
                      <strong>{est.sodium_g.toFixed(2)} g</strong>
                    </div>
                    <div className="eRow">
                      <span className="k">Estimated energy</span>
                      <strong>{Math.round(est.kcal)} kcal</strong>
                    </div>
                  </div>
                </div>
              </div>
              <footer className="mFoot">
                <Button variant="secondary" onClick={() => setConsumeOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConsume}>Log</Button>
              </footer>
            </div>
          </div>,
          document.body
        )}

      {/* DELETE CONFIRM POPUP (uses your ConfirmDialog component) */}
      {onDelete &&
        createPortal(
          <ConfirmDialog
            open={confirmOpen}
            title="Delete this item?"
            message={`“${item.name}” will be removed from your pantry.`}
            confirmText={deleting ? "Deleting…" : "Delete"}
            cancelText="Cancel"
            onConfirm={confirmDelete}
            onCancel={() => (deleting ? null : setConfirmOpen(false))}
            zIndex={3200}
          />,
          document.body
        )}

      <style jsx>{`
        .card {
          border: 1px solid var(--border);
          background: var(--card-bg);
          border-radius: 18px;
          padding: 14px;
          box-shadow: 0 10px 28px rgba(2, 6, 23, 0.06);
          display: grid;
          gap: 12px;
        }
        .title {
          margin: 0;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: var(--text);
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .actionsRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 2px;
        }
        .err {
          margin: 0;
          font-size: 13px;
          color: #7f1d1d;
          background: #fee2e2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 6px 8px;
        }

        /* Modals */
        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 3000;
        }
        .modal {
          width: min(720px, 96vw);
          max-height: 92vh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          border: 1px solid var(--border);
          background: var(--card-bg);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
        }
        .modal.modal-nutri {
          width: min(720px, 96vw);
        }
        .mHead {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg2);
        }
        .mEyebrow {
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .mTitle {
          font-weight: 900;
          font-size: 18px;
        }
        .mClose {
          border: none;
          background: transparent;
          font-size: 24px;
          color: var(--muted);
          cursor: pointer;
          line-height: 1;
        }
        .mBody {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          padding: 16px;
          overflow: auto;
        }
        .mBody--single {
          grid-template-columns: 1fr;
        }
        .mForm {
          display: grid;
          gap: 12px;
          align-content: start;
        }
        .g2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .lbl {
          display: grid;
          gap: 6px;
          font-size: 0.9rem;
          font-weight: 800;
          color: var(--text);
        }
        .inp {
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          border-radius: 12px;
          padding: 12px;
          outline: none;
        }
        .readonly {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          border: 1px dashed var(--border);
          background: var(--bg2);
          padding: 10px 12px;
          border-radius: 12px;
        }
        .readonly .key {
          color: var(--muted);
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .readonly .val {
          font-weight: 800;
        }
        .nutCard {
          border: 1px solid var(--border);
          background: var(--bg);
          border-radius: 16px;
          padding: 16px;
        }
        .nutHead {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 8px;
        }
        .nutTitle {
          font-weight: 900;
        }
        .nutGrid {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px 14px;
        }
        .nrow {
          display: contents;
        }
        dt {
          color: var(--muted);
        }
        dd {
          margin: 0;
          font-weight: 800;
        }
        .suffix {
          margin-left: 2px;
          color: var(--muted);
          font-weight: 700;
          font-size: 12px;
        }
        .consumeBox {
          display: grid;
          gap: 12px;
        }
        .est {
          display: grid;
          gap: 8px;
          border: 1px dashed var(--border);
          background: var(--bg);
          border-radius: 12px;
          padding: 10px;
        }
        .eRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .eRow .k {
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .mFoot {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          background: var(--bg2);
        }
      `}</style>
    </>
  );
}




