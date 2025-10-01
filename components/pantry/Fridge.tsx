// components/pantry/Fridge.tsx
"use client";

import React from "react";
import Button from "@/components/ui/Button";

type TSLike = any;

export type FridgeItem = {
  id: string;
  uid?: string;
  name: string;
  quantity: number;
  expiresAt?: TSLike | null;
  barcode?: string | null;
  nutrition?: any | null;
};

type Props = {
  items: FridgeItem[];
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  minimal?: boolean;
  onEdit?: (item: FridgeItem) => void;
  onDelete?: (item: FridgeItem) => void;
};

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const anyTs: any = v;
  if (typeof anyTs?.toDate === "function") return anyTs.toDate();
  if (typeof anyTs?.seconds === "number") return new Date(anyTs.seconds * 1000);
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return new Date(v);
  return null;
}

export default function Fridge({
  items,
  isOpen,
  onToggleOpen,
  minimal,
  onEdit,
  onDelete,
}: Props) {
  const count = items.length;
  const label = count === 1 ? "1 item" : `${count} items`;

  return (
    <div className={`fridgeWrap ${isOpen ? "open" : "closed"} ${minimal ? "mini" : ""}`}>
      <div className="fridge" aria-label="Fridge">
        <div className="badge">FRIDGE</div>
        <div className="door">
          <div className="handle" />
        </div>

        <div className="footer">
          <span className="pill">{label}</span>
          <button
            type="button"
            className="linkBtn"
            onClick={() => onToggleOpen(!isOpen)}
          >
            {isOpen ? "Close" : "Open"}
          </button>
        </div>
      </div>

      {/* TRAY — only render when OPEN so nothing shows outside while closed */}
      {isOpen && (
        <div className="tray">
          {items.length === 0 ? (
            <div className="empty">
              <span className="emoji">🧊</span>
              <div className="tTitle">Your fridge is empty</div>
              <div className="muted">Add some items to see them here.</div>
            </div>
          ) : (
            <ul className="grid">
              {items.map((it) => {
                const d = toDate(it.expiresAt);
                const exp =
                  d
                    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
                        d.getDate()
                      ).padStart(2, "0")}`
                    : "—";
                return (
                  <li key={it.id} className="card">
                    <div className="top">
                      <h4 className="name" title={it.name}>
                        {it.name}
                      </h4>
                      <div className="actions">
                        {onEdit ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onEdit(it)}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {onDelete ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDelete(it)}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="meta">
                      <span className="chip">Qty: {it.quantity}</span>
                      <span className="chip">Exp: {exp}</span>
                      {it.barcode ? <span className="chip">EAN {it.barcode}</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <style jsx>{`
        .fridgeWrap {
          display: grid;
          gap: 10px;
          transition: all 180ms ease;
        }

        /* Fridge box */
        .fridge {
          position: relative;
          width: 100%;
          border: 2px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          background:
            radial-gradient(800px 160px at -10% -30%, rgba(255, 255, 255, 0.08), transparent),
            linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(20, 24, 35, 0.28));
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04),
            0 10px 24px rgba(2, 6, 23, 0.35);
          overflow: hidden;
          display: grid;
          grid-template-rows: 1fr auto;
          height: 220px;
          transition: height 220ms ease, transform 220ms ease, box-shadow 220ms ease;
        }

        /* Closed vs open sizing */
        .fridgeWrap.closed .fridge {
          height: 220px;
        }
        .fridgeWrap.open .fridge {
          height: 280px;
        }
        .fridgeWrap.mini .fridge {
          height: 180px;
        }

        .badge {
          position: absolute;
          top: 10px;
          left: 12px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          color: rgba(255, 255, 255, 0.6);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
        }

        .door {
          position: relative;
          border-radius: 14px;
          inset: 10px;
          margin: 6px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.12));
          outline: 1px solid rgba(255, 255, 255, 0.06);
        }

        .handle {
          position: absolute;
          right: 10px;
          top: 28px;
          width: 10px;
          height: 72px;
          border-radius: 8px;
          background: linear-gradient(180deg, #e9eef7, #c9d0de);
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(2, 6, 23, 0.25);
        }

        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px 10px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          height: 28px;
          padding: 0 10px;
          font-weight: 900;
          font-size: 12px;
          color: var(--text);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
        }
        .linkBtn {
          appearance: none;
          border: none;
          background: transparent;
          color: #9ec1ff;
          font-weight: 900;
          cursor: pointer;
        }

        /* Tray (only exists in DOM when open) */
        .tray {
          border: 1px solid var(--border);
          background: var(--card-bg);
          border-radius: 16px;
          padding: 12px;
          box-shadow: 0 12px 30px rgba(2, 6, 23, 0.25);
          animation: trayIn 180ms ease-out both;
        }
        @keyframes trayIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .empty {
          text-align: center;
          padding: 20px 10px;
        }
        .emoji {
          font-size: 26px;
        }
        .tTitle {
          font-weight: 900;
          margin-top: 6px;
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
        }

        .grid {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .card {
          border: 1px solid var(--border);
          background: var(--bg);
          border-radius: 14px;
          padding: 12px;
          display: grid;
          gap: 8px;
        }
        .top {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
        }
        .name {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg2);
          font-size: 12px;
          font-weight: 800;
          color: var(--text);
        }
      `}</style>
    </div>
  );
}
