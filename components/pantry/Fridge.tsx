"use client";

import React from "react";

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
  /** optional prop because page.tsx passes it */
  minimal?: boolean;
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

export default function Fridge({ items, isOpen, onToggleOpen }: Props) {
  const count = items.length;
  const label = count === 1 ? "1 item" : `${count} items`;

  return (
    <div className={`fridgeWrap ${isOpen ? "open" : "closed"}`}>
      <div className="fridge" aria-label="Fridge">
        <div className="badge">FRIDGE</div>

        <div className="shell">
          <div className="glass" />
          <div className="handle" />
        </div>

        <div className="footer">
          <span className="pill">{label}</span>
          <button
            type="button"
            className="linkBtn"
            onClick={() => onToggleOpen(!isOpen)}
          >
            {isOpen ? "Open" : "Close"}
          </button>
        </div>
      </div>

      {/* Only render tray when OPEN so products never show while closed */}
      {isOpen && items.length === 0 && (
  <div className="tray">
    <div className="empty">
      <span className="emoji">🧊</span>
      <div className="tTitle">Your fridge is empty</div>
      <div className="muted">Add some items to see them here.</div>
    </div>
  </div>
)}

      <style jsx>{`
        .fridgeWrap {
          display: grid;
          gap: 10px;
        }

        .fridge {
          position: relative;
          width: 100%;
          border-radius: 22px;
          overflow: hidden;
          background: linear-gradient(180deg, #f5f7fb, #dbe3ef);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12),
            inset 0 0 0 1px rgba(255, 255, 255, 0.6);
          display: grid;
          grid-template-rows: 1fr auto;
          height: 220px;
          transition: height 220ms ease, box-shadow 220ms ease,
            transform 220ms ease;
        }
        .fridgeWrap.open .fridge {
          height: 280px;
        }
        .fridgeWrap.closed .fridge {
          height: 220px;
        }

        .badge {
          position: absolute;
          top: 10px;
          left: 14px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          color: rgba(15, 23, 42, 0.35);
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.75);
        }

        .shell {
          position: relative;
          inset: 0;
        }
        .glass {
          position: absolute;
          left: 14px;
          right: 14px;
          top: 16px;
          bottom: 54px;
          border-radius: 16px;
          background: radial-gradient(
              120% 60% at -10% -20%,
              rgba(255, 255, 255, 0.9),
              rgba(255, 255, 255, 0.35) 40%,
              rgba(255, 255, 255, 0) 65%
            ),
            linear-gradient(180deg, rgba(255, 255, 255, 0.65), rgba(170, 182, 200, 0.45));
          border: 1px solid rgba(255, 255, 255, 0.85);
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05),
            inset 0 -6px 10px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(1.5px);
        }
        .handle {
          position: absolute;
          right: 24px;
          top: 44px;
          width: 10px;
          height: 78px;
          border-radius: 8px;
          background: linear-gradient(180deg, #f6f9ff, #cfd9ea);
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06),
            0 10px 18px rgba(15, 23, 42, 0.18);
        }

        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px 12px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.75),
            rgba(255, 255, 255, 0.4)
          );
          border-top: 1px solid rgba(15, 23, 42, 0.06);
        }
        .pill {
          display: inline-flex;
          align-items: center;
          height: 28px;
          padding: 0 10px;
          font-weight: 900;
          font-size: 12px;
          color: #0f172a;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
        }
        .linkBtn {
          appearance: none;
          border: none;
          background: transparent;
          color: #4f7fff;
          font-weight: 900;
          cursor: pointer;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .tray {
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #fff;
          border-radius: 18px;
          padding: 12px;
          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
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
          color: #64748b;
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
 
        .top {
          display: grid;
          grid-template-columns: 1fr;
          align-items: center;
        }
        .name {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: #0f172a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #f8fafc;
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
        }
      `}</style>
    </div>
  );
}
